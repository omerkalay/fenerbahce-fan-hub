const crypto = require('node:crypto');
const { admin, db } = require('../config');
const { requireAdminClaims } = require('./middleware');
const {
    getLineupSettings,
    acquireLineupWriteLock,
    releaseLineupWriteLock,
    sendStartingLineupPush
} = require('../services/lineupPublishing');
const { isFenerbahceName } = require('../utils/lineupAutomation');
const {
    DATA_RESOURCES,
    DEFAULT_DATA_SOURCE_MODES,
    refreshDataSnapshots
} = require('../services/dataSnapshots');

const MATCH_ID_PATTERN = /^\d{5,20}$/;
const ALLOWED_FORMATIONS = new Set(['4-3-3', '4-4-2', '4-2-3-1', '4-1-4-1', '3-5-2', '4-1-2-1-2 Diamond']);
const ALLOWED_PLAYER_KEYS = new Set(['slot', 'id', 'name', 'position', 'number']);
const APP_URL = 'https://omerkalay.com/fenerbahce-fan-hub/';
const NOTIFICATION_TEST_TTL_MS = 10 * 60 * 1000;
const PLAYER_STATUS_VALUES = new Set(['injured', 'suspended', 'doubtful', 'card-risk']);
const PLAYER_STATUS_SOURCES = new Set(['squad', 'manual']);
const PLAYER_STATUS_MAX_ENTRIES = 40;
const PLAYER_STATUS_LOCK_TTL_MS = 30 * 1000;
const PLAYER_STATUS_ENTRY_KEYS = new Set(['playerId', 'source', 'name', 'status', 'detail', 'returnDate']);
const DATA_SOURCE_MODES = new Set(['espn', 'cache']);
const DATA_REFRESH_RESOURCES = new Set([...DATA_RESOURCES, 'all']);

const hasOnlyKeys = (value, allowedKeys) => (
    value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every((key) => allowedKeys.has(key))
);

const normalizeDataSourceUpdate = (body) => {
    if (!hasOnlyKeys(body, new Set(['resource', 'mode']))) return null;
    if (!DATA_RESOURCES.includes(body.resource) || !DATA_SOURCE_MODES.has(body.mode)) return null;
    return { resource: body.resource, mode: body.mode };
};

const normalizeDataRefreshRequest = (body) => {
    if (!hasOnlyKeys(body, new Set(['resource', 'seasonStartYear']))) return null;
    const seasonStartYear = Number(body.seasonStartYear);
    if (!DATA_REFRESH_RESOURCES.has(body.resource)) return null;
    if (!Number.isInteger(seasonStartYear) || seasonStartYear < 2000 || seasonStartYear > 2100) return null;
    return { resource: body.resource, seasonStartYear };
};

const validateMatchId = (value) => {
    const matchId = String(value || '').trim();
    return MATCH_ID_PATTERN.test(matchId) ? matchId : null;
};

const getKnownMatch = async (matchId, database = db) => {
    const [nextSnapshot, nextThreeSnapshot] = await Promise.all([
        database.ref('cache/nextMatch').once('value'),
        database.ref('cache/next3Matches').once('value')
    ]);
    const rawNextThree = nextThreeSnapshot.val();
    const nextThree = Array.isArray(rawNextThree)
        ? rawNextThree
        : (rawNextThree && typeof rawNextThree === 'object' ? Object.values(rawNextThree) : []);
    const matches = [nextSnapshot.val(), ...nextThree].filter(Boolean);
    return matches.find((match) => String(match.id) === matchId) || null;
};

const normalizeDraft = (body) => {
    if (!hasOnlyKeys(body, new Set(['formation', 'players']))) return null;
    if (!ALLOWED_FORMATIONS.has(body.formation) || !Array.isArray(body.players) || body.players.length > 11) {
        return null;
    }

    const players = [];
    const slots = new Set();
    const names = new Set();
    const ids = new Set();
    const numbers = new Set();
    for (const raw of body.players) {
        if (!hasOnlyKeys(raw, ALLOWED_PLAYER_KEYS)) return null;
        if (
            typeof raw.slot !== 'string'
            || typeof raw.name !== 'string'
            || typeof raw.position !== 'string'
            || typeof raw.number !== 'number'
            || typeof raw.id !== 'number'
        ) return null;
        const slot = raw.slot.trim();
        const name = raw.name.trim();
        const position = raw.position.trim();
        const number = raw.number;
        const id = raw.id;
        const nameKey = name.toLocaleLowerCase('tr-TR');
        if (
            !/^[A-Z0-9_-]{1,16}$/i.test(slot)
            || name.length < 2
            || name.length > 80
            || !/\p{L}/u.test(name)
            || !position
            || position.length > 40
        ) return null;
        if (!Number.isInteger(number) || number < 1 || number > 999 || numbers.has(number)) return null;
        if (!Number.isInteger(id) || id <= 0 || slots.has(slot) || names.has(nameKey) || ids.has(id)) return null;
        slots.add(slot);
        names.add(nameKey);
        ids.add(id);
        numbers.add(number);
        players.push({ slot, id, name, position, number });
    }

    return { formation: body.formation, players };
};

const classifyPosition = (position = '') => {
    const value = String(position).toLowerCase();
    if (/goalkeeper|kaleci|^gk$/.test(value)) return 'GK';
    if (/defender|back|stoper|bek|^d$|^def$/.test(value)) return 'DEF';
    if (/forward|striker|wing|forvet|kanat|^f$|^fwd$/.test(value)) return 'FWD';
    return 'MID';
};

const draftToTeamLineup = (draft, team) => ({
    teamId: String(team.id || ''),
    teamName: String(team.name || ''),
    formation: draft.formation,
    formationSource: 'manual',
    starters: draft.players.map((player, order) => ({
        name: player.name,
        jersey: String(player.number),
        position: player.position,
        positionCode: '',
        positionGroup: classifyPosition(player.position),
        order
    })),
    bench: [],
    substitutions: []
});

const sanitizeLineupState = ({ detection, published, draft, settings, manualLocked, notification }) => ({
    detection: detection ? {
        status: detection.status || 'idle',
        consecutiveSeen: Number(detection.consecutiveSeen || 0),
        firstSeenAt: detection.firstSeenAt || null,
        lastSeenAt: detection.lastSeenAt || null,
        payload: detection.payload || null
    } : null,
    published: published || null,
    draft: draft || null,
    settings,
    manualLocked: manualLocked === true,
    notification: notification ? {
        status: notification.status || null,
        acceptedAt: notification.acceptedAt || null,
        failedAt: notification.failedAt || null,
        errorCode: notification.errorCode || null
    } : null
});

const normalizeNotification = (body) => {
    if (!hasOnlyKeys(body, new Set(['title', 'body', 'url', 'testId']))) return null;
    if (
        typeof body.title !== 'string'
        || typeof body.body !== 'string'
        || (body.url !== undefined && typeof body.url !== 'string')
        || (body.testId !== undefined && typeof body.testId !== 'string')
    ) return null;
    const title = body.title.trim();
    const messageBody = body.body.trim();
    if (!title || title.length > 60 || !messageBody || messageBody.length > 180) return null;

    let url;
    try {
        if ((body.url || APP_URL).length > 240) return null;
        url = new URL(body.url || APP_URL, APP_URL);
    } catch {
        return null;
    }
    if (url.origin !== 'https://omerkalay.com' || !url.pathname.startsWith('/fenerbahce-fan-hub/')) return null;

    return {
        title,
        body: messageBody,
        url: url.toString(),
        ...(body.testId ? { testId: String(body.testId) } : {})
    };
};

const notificationHash = (payload) => crypto
    .createHash('sha256')
    .update(JSON.stringify({ title: payload.title, body: payload.body, url: payload.url }))
    .digest('hex');

const normalizePlayerStatusName = (value) => String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');

const createLegacyPlayerStatusId = (name) => `legacy-${crypto
    .createHash('sha256')
    .update(normalizePlayerStatusName(name))
    .digest('hex')
    .slice(0, 16)}`;

const isValidPlayerStatusId = (playerId, source) => {
    if (source === 'squad') return /^\d{1,20}$/.test(playerId);
    return /^(?:manual-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|legacy-[0-9a-f]{16})$/i.test(playerId);
};

const normalizePublishedPlayerStatuses = (value) => {
    const rawEntries = Array.isArray(value)
        ? value
        : (value && typeof value === 'object' ? Object.values(value) : []);

    return rawEntries
        .filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
        .map((entry) => {
            const name = String(entry.name || '').trim();
            const status = String(entry.status || '');
            if (!name || !PLAYER_STATUS_VALUES.has(status)) return null;
            const requestedSource = PLAYER_STATUS_SOURCES.has(entry.source) ? entry.source : 'manual';
            const requestedId = String(entry.playerId || '').trim();
            const playerId = isValidPlayerStatusId(requestedId, requestedSource)
                ? requestedId
                : createLegacyPlayerStatusId(name);
            const source = playerId.startsWith('legacy-') ? 'manual' : requestedSource;
            return {
                playerId,
                source,
                name,
                status,
                detail: String(entry.detail || '').trim(),
                returnDate: String(entry.returnDate || '').trim(),
                updatedAt: Number.isFinite(Number(entry.updatedAt)) ? Number(entry.updatedAt) : 0
            };
        })
        .filter(Boolean);
};

const normalizePlayerStatusDraft = (body) => {
    if (!hasOnlyKeys(body, new Set(['baseRevision', 'entries']))) return null;
    if (!Number.isInteger(body.baseRevision) || body.baseRevision < 0) return null;
    if (!Array.isArray(body.entries) || body.entries.length > PLAYER_STATUS_MAX_ENTRIES) return null;

    const ids = new Set();
    const names = new Set();
    const entries = [];
    for (const raw of body.entries) {
        if (!hasOnlyKeys(raw, PLAYER_STATUS_ENTRY_KEYS)) return null;
        const source = String(raw.source || '');
        const name = String(raw.name || '').trim().replace(/\s+/g, ' ');
        const status = String(raw.status || '');
        const detail = String(raw.detail || '').trim();
        const returnDate = String(raw.returnDate || '').trim();
        let playerId = String(raw.playerId || '').trim();

        if (
            !PLAYER_STATUS_SOURCES.has(source)
            || !PLAYER_STATUS_VALUES.has(status)
            || name.length < 2
            || name.length > 80
            || !/\p{L}/u.test(name)
            || detail.length > 160
            || returnDate.length > 60
        ) return null;

        if (!playerId && source === 'manual') playerId = `manual-${crypto.randomUUID()}`;
        if (!isValidPlayerStatusId(playerId, source)) return null;

        const nameKey = normalizePlayerStatusName(name);
        const idKey = `${source}:${playerId.toLowerCase()}`;
        if (ids.has(idKey) || names.has(nameKey)) return null;
        ids.add(idKey);
        names.add(nameKey);
        entries.push({
            playerId,
            source,
            name,
            status,
            detail,
            returnDate: status === 'injured' || status === 'doubtful' ? returnDate : ''
        });
    }

    return { baseRevision: body.baseRevision, entries };
};

const canonicalizeSquadPlayerStatuses = async (draft, database = db) => {
    if (!draft.entries.some((entry) => entry.source === 'squad')) return draft;
    const squadSnapshot = await database.ref('cache/squad').once('value');
    const rawSquad = squadSnapshot.val();
    const squad = Array.isArray(rawSquad)
        ? rawSquad
        : (rawSquad && typeof rawSquad === 'object' ? Object.values(rawSquad) : []);
    const squadById = new Map(squad
        .filter((player) => player && typeof player === 'object')
        .map((player) => [String(player.id || ''), String(player.name || '').trim()]));
    const entries = [];
    for (const entry of draft.entries) {
        if (entry.source !== 'squad') {
            entries.push(entry);
            continue;
        }
        const canonicalName = squadById.get(entry.playerId);
        if (!canonicalName || normalizePlayerStatusName(canonicalName) !== normalizePlayerStatusName(entry.name)) {
            return null;
        }
        entries.push({ ...entry, name: canonicalName });
    }
    return { ...draft, entries };
};

const authorizeManualPlayerStatusIds = async (draft, newManualIndexes, uid, database = db) => {
    const providedManualEntries = draft.entries.filter((entry, index) => (
        entry.source === 'manual' && !newManualIndexes.has(index)
    ));
    if (providedManualEntries.length === 0) return draft;

    const [publishedSnapshot, ownDraftSnapshot] = await Promise.all([
        database.ref('admin/playerStatus').once('value'),
        database.ref(`ops/playerStatus/drafts/${uid}`).once('value')
    ]);
    const allowedIds = new Set(normalizePublishedPlayerStatuses(publishedSnapshot.val())
        .filter((entry) => entry.source === 'manual')
        .map((entry) => entry.playerId));
    const ownDraft = ownDraftSnapshot.val();
    const normalizedOwnDraft = hasOnlyKeys(ownDraft, new Set(['baseRevision', 'entries', 'updatedAt']))
        ? normalizePlayerStatusDraft({ baseRevision: ownDraft.baseRevision, entries: ownDraft.entries })
        : null;
    for (const entry of normalizedOwnDraft?.entries || []) {
        if (entry.source === 'manual') allowedIds.add(entry.playerId);
    }

    return providedManualEntries.every((entry) => allowedIds.has(entry.playerId)) ? draft : null;
};

const acquirePlayerStatusLock = async (database, operationId, now = Date.now()) => {
    const lockRef = database.ref('ops/playerStatus/writeLock');
    const result = await lockRef.transaction((current) => {
        if (current?.expiresAt > now) return;
        return { operationId, acquiredAt: now, expiresAt: now + PLAYER_STATUS_LOCK_TTL_MS };
    });
    return result.committed;
};

const releasePlayerStatusLock = async (database, operationId) => {
    await database.ref('ops/playerStatus/writeLock').transaction((current) => (
        current?.operationId === operationId ? null : current
    ));
};

const writeAudit = (uid, action, details = {}, database = db) => database.ref('ops/adminAudit').push({
    uid,
    action,
    details,
    createdAt: Date.now()
});

const handleSession = async (_req, res, claims) => res.json({
    authenticated: true,
    admin: true,
    uid: claims.uid
});

const handlePlayerStatusGet = async (_req, res, claims, database = db) => {
    const [publishedSnapshot, draftSnapshot, stateSnapshot] = await Promise.all([
        database.ref('admin/playerStatus').once('value'),
        database.ref(`ops/playerStatus/drafts/${claims.uid}`).once('value'),
        database.ref('ops/playerStatus/state').once('value')
    ]);
    const published = normalizePublishedPlayerStatuses(publishedSnapshot.val());
    const state = stateSnapshot.val() || {};
    const revision = Number.isInteger(state.revision) && state.revision >= 0 ? state.revision : 0;
    const draft = draftSnapshot.val();
    const fallbackPublishedAt = published.reduce((latest, entry) => Math.max(latest, entry.updatedAt || 0), 0);
    return res.json({
        published,
        draft: draft && draft.baseRevision === revision && Array.isArray(draft.entries) ? draft : null,
        revision,
        lastPublishedAt: Number(state.lastPublishedAt || fallbackPublishedAt || 0) || null
    });
};

const handlePlayerStatusDraftPut = async (req, res, claims, database = db) => {
    const newManualIndexes = new Set(Array.isArray(req.body?.entries)
        ? req.body.entries
            .map((entry, index) => entry?.source === 'manual' && !String(entry?.playerId || '').trim() ? index : -1)
            .filter((index) => index >= 0)
        : []);
    const normalizedDraft = normalizePlayerStatusDraft(req.body);
    if (!normalizedDraft) return res.status(400).json({ error: 'Invalid player status draft' });
    const canonicalDraft = await canonicalizeSquadPlayerStatuses(normalizedDraft, database);
    if (!canonicalDraft) return res.status(400).json({ error: 'Squad player identity does not match the current squad' });
    const draft = await authorizeManualPlayerStatusIds(canonicalDraft, newManualIndexes, claims.uid, database);
    if (!draft) return res.status(400).json({ error: 'Manual player identity was not created by the server' });

    const operationId = crypto.randomUUID();
    const now = Date.now();
    const acquired = await acquirePlayerStatusLock(database, operationId, now);
    if (!acquired) return res.status(409).json({ error: 'Another player status operation is in progress' });

    try {
        const revisionSnapshot = await database.ref('ops/playerStatus/state/revision').once('value');
        const revision = Number.isInteger(revisionSnapshot.val()) ? revisionSnapshot.val() : 0;
        if (draft.baseRevision !== revision) {
            return res.status(409).json({ error: 'Player status data changed; reload before saving' });
        }
        const value = { ...draft, updatedAt: now };
        await database.ref(`ops/playerStatus/drafts/${claims.uid}`).set(value);
        await writeAudit(claims.uid, 'playerStatus.draft.saved', { entryCount: value.entries.length, revision }, database);
        return res.json({ success: true, draft: value });
    } finally {
        await releasePlayerStatusLock(database, operationId);
    }
};

const handlePlayerStatusPublish = async (req, res, claims, database = db) => {
    if (!hasOnlyKeys(req.body || {}, new Set(['baseRevision']))
        || !Number.isInteger(req.body.baseRevision)
        || req.body.baseRevision < 0) {
        return res.status(400).json({ error: 'Invalid player status publish request' });
    }

    const operationId = crypto.randomUUID();
    const now = Date.now();
    const acquired = await acquirePlayerStatusLock(database, operationId, now);
    if (!acquired) return res.status(409).json({ error: 'Another player status operation is in progress' });

    try {
        const [revisionSnapshot, draftSnapshot] = await Promise.all([
            database.ref('ops/playerStatus/state/revision').once('value'),
            database.ref(`ops/playerStatus/drafts/${claims.uid}`).once('value')
        ]);
        const revision = Number.isInteger(revisionSnapshot.val()) ? revisionSnapshot.val() : 0;
        const storedDraft = draftSnapshot.val();
        const draft = hasOnlyKeys(storedDraft, new Set(['baseRevision', 'entries', 'updatedAt']))
            ? normalizePlayerStatusDraft({ baseRevision: storedDraft.baseRevision, entries: storedDraft.entries })
            : null;
        if (req.body.baseRevision !== revision || draft?.baseRevision !== revision) {
            return res.status(409).json({ error: 'Player status draft is missing or stale' });
        }

        const entries = draft.entries.map((entry) => ({ ...entry, updatedAt: now }));
        const nextRevision = revision + 1;
        const auditKey = database.ref('ops/adminAudit').push().key || crypto.randomUUID();
        await database.ref().update({
            'admin/playerStatus': entries.length > 0 ? entries : null,
            'ops/playerStatus/state': {
                revision: nextRevision,
                lastPublishedAt: now,
                updatedBy: claims.uid
            },
            [`ops/playerStatus/drafts/${claims.uid}`]: null,
            'ops/playerStatus/writeLock': null,
            [`ops/adminAudit/${auditKey}`]: {
                uid: claims.uid,
                action: 'playerStatus.published',
                details: { entryCount: entries.length, revision: nextRevision },
                createdAt: now
            }
        });
        return res.json({
            success: true,
            published: entries,
            revision: nextRevision,
            lastPublishedAt: now
        });
    } finally {
        await releasePlayerStatusLock(database, operationId);
    }
};

const summarizeUefaJourney = (value) => {
    if (!value || typeof value !== 'object') return null;
    const entries = Object.entries(value)
        .map(([seasonStartYear, payload]) => ({
            seasonStartYear: Number(seasonStartYear),
            lastUpdate: Number(payload?.lastUpdate || 0),
            stale: payload?.stale === true,
            participationState: String(payload?.participation?.state || 'unknown')
        }))
        .filter((entry) => Number.isInteger(entry.seasonStartYear) && entry.lastUpdate > 0)
        .sort((first, second) => second.lastUpdate - first.lastUpdate);
    return entries[0] || null;
};

const handleOverview = async (_req, res, _claims, database = db) => {
    const [lastUpdate, nextMatch, uefaJourney, health, settings, pending, cleanup, dataSourceModes, season, dataSnapshots] = await Promise.all([
        database.ref('cache/lastUpdate').once('value'),
        database.ref('cache/nextMatch').once('value'),
        database.ref('cache/uefaJourney').once('value'),
        database.ref('ops/health').once('value'),
        getLineupSettings(database),
        database.ref('notifications').orderByChild('topicSync/allFans/pending').equalTo(true).once('value'),
        database.ref('notifications').orderByChild('topicSync/allFans/oldTokenToCleanup').startAt('').once('value'),
        database.ref('cache/dataSourceModes').once('value'),
        database.ref('cache/season').once('value'),
        database.ref('cache/dataSnapshots').once('value')
    ]);
    const nextMatchValue = nextMatch.val() || null;
    const nextMatchId = validateMatchId(nextMatchValue?.id);
    const startingLineupPushSnapshot = nextMatchId
        ? await database.ref(`ops/lineups/${nextMatchId}/notification`).once('value')
        : null;
    const startingLineupPush = startingLineupPushSnapshot?.val() || null;
    return res.json({
        version: '2.15.0',
        lastCacheUpdate: lastUpdate.val() || null,
        nextMatch: nextMatchValue,
        uefaJourney: summarizeUefaJourney(uefaJourney.val()),
        health: health.val() || {},
        settings,
        dataSources: {
            modes: { ...DEFAULT_DATA_SOURCE_MODES, ...(dataSourceModes.val() || {}) },
            seasonStartYear: Number(season.val()?.startYear || 0) || null,
            snapshots: dataSnapshots.val() || {}
        },
        topicSync: {
            pending: pending.numChildren(),
            cleanupPending: cleanup.numChildren()
        },
        startingLineupPush: startingLineupPush ? {
            status: startingLineupPush.status || null,
            acceptedAt: startingLineupPush.acceptedAt || null,
            failedAt: startingLineupPush.failedAt || null,
            errorCode: startingLineupPush.errorCode || null
        } : null
    });
};

const handleDataSourcePut = async (req, res, claims, database = db) => {
    const update = normalizeDataSourceUpdate(req.body);
    if (!update) return res.status(400).json({ error: 'Invalid data source update' });
    await database.ref(`cache/dataSourceModes/${update.resource}`).set(update.mode);
    await writeAudit(claims.uid, 'data_source.updated', update, database);
    const snapshot = await database.ref('cache/dataSourceModes').once('value');
    return res.json({
        success: true,
        modes: { ...DEFAULT_DATA_SOURCE_MODES, ...(snapshot.val() || {}) }
    });
};

const handleDataRefresh = async (req, res, claims, database = db, refreshSnapshots = refreshDataSnapshots) => {
    const request = normalizeDataRefreshRequest(req.body);
    if (!request) return res.status(400).json({ error: 'Invalid data refresh request' });
    const resources = request.resource === 'all' ? 'all' : [request.resource];
    const results = await refreshSnapshots({
        resources,
        seasonStartYear: request.seasonStartYear,
        database
    });
    await writeAudit(claims.uid, 'data_cache.refreshed', {
        resource: request.resource,
        seasonStartYear: request.seasonStartYear,
        results
    }, database);
    return res.json({ success: true, results });
};

const handleLineupGet = async (_req, res, claims, matchId, match, database = db) => {
    const [detection, published, draft, settings, manualLocked, notification] = await Promise.all([
        database.ref(`ops/lineups/${matchId}/detection`).once('value'),
        database.ref(`cache/matchLineups/${matchId}`).once('value'),
        database.ref(`ops/adminDrafts/${claims.uid}/${matchId}`).once('value'),
        getLineupSettings(database),
        database.ref(`ops/lineups/${matchId}/manualLocked`).once('value'),
        database.ref(`ops/lineups/${matchId}/notification`).once('value')
    ]);
    return res.json({
        match,
        ...sanitizeLineupState({
            detection: detection.val(),
            published: published.val(),
            draft: draft.val(),
            settings,
            manualLocked: manualLocked.val(),
            notification: notification.val()
        })
    });
};

const handleDraftPut = async (req, res, claims, matchId, _match, database = db) => {
    const draft = normalizeDraft(req.body);
    if (!draft) return res.status(400).json({ error: 'Invalid lineup draft' });

    const value = { ...draft, updatedAt: Date.now() };
    await database.ref(`ops/adminDrafts/${claims.uid}/${matchId}`).set(value);
    await writeAudit(claims.uid, 'lineup.draft.saved', { matchId, playerCount: draft.players.length }, database);
    return res.json({ success: true, draft: value });
};

const handlePublish = async (req, res, claims, matchId, match, database = db, messaging = admin.messaging()) => {
    if (!hasOnlyKeys(req.body || {}, new Set(['mode']))) return res.status(400).json({ error: 'Invalid publish request' });
    const mode = req.body?.mode;
    if (!['detected', 'manual'].includes(mode)) return res.status(400).json({ error: 'Invalid publish mode' });

    const now = Date.now();
    const operationId = crypto.randomUUID();
    const acquired = await acquireLineupWriteLock(database, matchId, operationId, now);
    if (!acquired) return res.status(409).json({ error: 'Another lineup operation is in progress' });

    let payload;
    try {
        if (mode === 'detected') {
            const [detectionSnapshot, publishedSnapshot] = await Promise.all([
                database.ref(`ops/lineups/${matchId}/detection`).once('value'),
                database.ref(`cache/matchLineups/${matchId}`).once('value')
            ]);
            const detection = detectionSnapshot.val();
            if (detection?.status !== 'ready' || !detection.payload) {
                return res.status(409).json({ error: 'ESPN lineup is not ready' });
            }
            payload = {
                ...detection.payload,
                publishedAt: publishedSnapshot.val()?.publishedAt || now,
                updatedAt: now
            };
        } else {
            const [draftSnapshot, detectedSnapshot, publishedSnapshot] = await Promise.all([
                database.ref(`ops/adminDrafts/${claims.uid}/${matchId}`).once('value'),
                database.ref(`ops/lineups/${matchId}/detection/payload`).once('value'),
                database.ref(`cache/matchLineups/${matchId}`).once('value')
            ]);
            const draft = draftSnapshot.val();
            if (!draft || !Array.isArray(draft.players) || draft.players.length !== 11) {
                return res.status(409).json({ error: 'Manual lineup must contain exactly 11 players' });
            }
            const detected = detectedSnapshot.val();
            const published = publishedSnapshot.val();
            const candidateBase = detected || published || {};
            const base = !candidateBase.matchId || String(candidateBase.matchId) === String(matchId)
                ? candidateBase
                : {};
            const homeIsFenerbahce = isFenerbahceName(match.homeTeam?.name);
            const awayIsFenerbahce = isFenerbahceName(match.awayTeam?.name);
            if (homeIsFenerbahce === awayIsFenerbahce) {
                return res.status(409).json({ error: 'The selected match does not include one Fenerbahçe team' });
            }
            const fenerSide = homeIsFenerbahce ? 'home' : 'away';
            const team = fenerSide === 'home' ? match.homeTeam : match.awayTeam;
            const opponentSide = fenerSide === 'home' ? 'away' : 'home';
            payload = {
                ...base,
                matchId,
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
                lineups: {
                    ...(base.lineups || {}),
                    [fenerSide]: draftToTeamLineup(draft, team),
                    [opponentSide]: base.lineups?.[opponentSide] || null
                },
                sources: {
                    ...(base.sources || {}),
                    [fenerSide]: 'manual',
                    [opponentSide]: base.sources?.[opponentSide] || null
                },
                publishedAt: published?.publishedAt || now,
                updatedAt: now
            };
        }

        await database.ref().update({
            [`ops/lineups/${matchId}/manualLocked`]: mode === 'manual',
            [`cache/matchLineups/${matchId}`]: payload
        });
        await writeAudit(claims.uid, 'lineup.published', { matchId, mode, operationId }, database);
    } finally {
        await releaseLineupWriteLock(database, matchId, operationId);
    }

    const settings = await getLineupSettings(database);
    const matchTime = Number(match.startTimestamp) * 1000;
    const notification = settings.autoPushLineups && Number.isFinite(matchTime) && now < matchTime
        ? await sendStartingLineupPush({ database, messaging, matchId, now })
        : { sent: false, reason: 'disabled' };
    return res.json({ success: true, published: payload, notification });
};

const handleRelease = async (req, res, claims, matchId, _match, database = db) => {
    if (!hasOnlyKeys(req.body || {}, new Set())) return res.status(400).json({ error: 'Invalid release request' });

    const now = Date.now();
    const operationId = crypto.randomUUID();
    const acquired = await acquireLineupWriteLock(database, matchId, operationId, now);
    if (!acquired) return res.status(409).json({ error: 'Another lineup operation is in progress' });

    try {
        const [detectionSnapshot, existingSnapshot] = await Promise.all([
            database.ref(`ops/lineups/${matchId}/detection`).once('value'),
            database.ref(`cache/matchLineups/${matchId}`).once('value')
        ]);
        const detection = detectionSnapshot.val();
        const updates = { [`ops/lineups/${matchId}/manualLocked`]: false };
        if (detection?.status === 'ready' && detection.payload) {
            updates[`cache/matchLineups/${matchId}`] = {
                ...detection.payload,
                publishedAt: existingSnapshot.val()?.publishedAt || now,
                updatedAt: now
            };
        }
        await database.ref().update(updates);
        await writeAudit(claims.uid, 'lineup.manual_lock.released', { matchId, operationId }, database);
    } finally {
        await releaseLineupWriteLock(database, matchId, operationId);
    }
    return res.json({ success: true, manualLocked: false });
};

const handleUnpublish = async (req, res, claims, matchId, _match, database = db) => {
    if (!hasOnlyKeys(req.body || {}, new Set())) return res.status(400).json({ error: 'Invalid unpublish request' });

    const now = Date.now();
    const operationId = crypto.randomUUID();
    const acquired = await acquireLineupWriteLock(database, matchId, operationId, now);
    if (!acquired) return res.status(409).json({ error: 'Another lineup operation is in progress' });

    try {
        const publishedSnapshot = await database.ref(`cache/matchLineups/${matchId}`).once('value');
        await database.ref().update({
            [`cache/matchLineups/${matchId}`]: null,
            [`ops/lineups/${matchId}/manualLocked`]: true
        });
        await writeAudit(claims.uid, 'lineup.unpublished', {
            matchId,
            operationId,
            hadPublishedLineup: Boolean(publishedSnapshot.val())
        }, database);
    } finally {
        await releaseLineupWriteLock(database, matchId, operationId);
    }
    return res.json({ success: true, published: null, manualLocked: true });
};

const handleSettings = async (req, res, claims, database = db) => {
    if (!hasOnlyKeys(req.body, new Set(['autoPublishLineups', 'autoPushLineups']))) {
        return res.status(400).json({ error: 'Invalid settings request' });
    }
    if (typeof req.body.autoPublishLineups !== 'boolean' || typeof req.body.autoPushLineups !== 'boolean') {
        return res.status(400).json({ error: 'Invalid settings request' });
    }
    const settings = {
        autoPublishLineups: req.body.autoPublishLineups === true,
        autoPushLineups: req.body.autoPushLineups === true
    };
    if (settings.autoPushLineups && !settings.autoPublishLineups) {
        return res.status(400).json({ error: 'Automatic push requires automatic publishing' });
    }
    await database.ref('ops/adminSettings/lineups').set({ ...settings, updatedAt: Date.now(), updatedBy: claims.uid });
    await writeAudit(claims.uid, 'lineup.settings.updated', settings, database);
    return res.json({ success: true, settings });
};

const handleNotificationTest = async (req, res, claims, database = db, messaging = admin.messaging()) => {
    const payload = normalizeNotification(req.body);
    if (!payload || payload.testId) return res.status(400).json({ error: 'Invalid notification payload' });
    const tokenSnapshot = await database.ref(`notifications/${claims.uid}/fcmToken`).once('value');
    const token = tokenSnapshot.val();
    if (!token) return res.status(409).json({ error: 'No notification token is registered for this admin device' });

    const messageId = await messaging.send({ token, data: { ...payload, type: 'adminTest' } });
    const testId = crypto.randomUUID();
    const testedAt = Date.now();
    await database.ref(`ops/adminNotificationTests/${claims.uid}/${testId}`).set({
        hash: notificationHash(payload),
        payload,
        testedAt,
        expiresAt: testedAt + NOTIFICATION_TEST_TTL_MS,
        messageId
    });
    await writeAudit(claims.uid, 'notification.test.accepted', { testId }, database);
    return res.json({ success: true, status: 'accepted', testId, expiresAt: testedAt + NOTIFICATION_TEST_TTL_MS });
};

const handleNotificationSend = async (req, res, claims, database = db, messaging = admin.messaging()) => {
    const payload = normalizeNotification(req.body);
    if (!payload?.testId || !/^[0-9a-f-]{36}$/i.test(payload.testId)) {
        return res.status(400).json({ error: 'A valid testId is required' });
    }
    const testSnapshot = await database.ref(`ops/adminNotificationTests/${claims.uid}/${payload.testId}`).once('value');
    const test = testSnapshot.val();
    const now = Date.now();
    if (!test || test.expiresAt < now || test.hash !== notificationHash(payload)) {
        return res.status(409).json({ error: 'The tested notification expired or its content changed' });
    }

    const sendRef = database.ref(`ops/adminNotificationSends/${payload.testId}`);
    const lock = await sendRef.transaction((current) => current ? undefined : {
        status: 'sending',
        uid: claims.uid,
        startedAt: now,
        payload: { title: payload.title, body: payload.body, url: payload.url }
    });
    if (!lock.committed) return res.status(409).json({ error: 'This notification was already submitted' });

    try {
        const messageId = await messaging.send({
            topic: 'all_fans',
            data: { title: payload.title, body: payload.body, url: payload.url, type: 'adminBroadcast' }
        });
        await sendRef.update({ status: 'accepted', acceptedAt: Date.now(), messageId });
        await writeAudit(claims.uid, 'notification.broadcast.accepted', { testId: payload.testId }, database);
        return res.json({ success: true, status: 'accepted' });
    } catch (error) {
        await sendRef.update({ status: 'failed', failedAt: Date.now(), errorCode: error?.code || 'messaging/unknown' });
        await writeAudit(claims.uid, 'notification.broadcast.failed', { testId: payload.testId }, database);
        return res.status(502).json({ success: false, status: 'failed', error: 'Firebase rejected the notification' });
    }
};

async function handleAdminRoute(req, res, segments, dependencies = {}) {
    const database = dependencies.database || db;
    const messaging = dependencies.messaging || admin.messaging();
    const authenticate = dependencies.requireAdminClaims || requireAdminClaims;
    const refreshSnapshots = dependencies.refreshDataSnapshots || refreshDataSnapshots;
    const claims = await authenticate(req, res);
    if (!claims) return;

    const [resource, rawMatchId, action] = segments;
    try {
        if (resource === 'session' && segments.length === 1 && req.method === 'GET') return handleSession(req, res, claims);
        if (resource === 'overview' && segments.length === 1 && req.method === 'GET') return handleOverview(req, res, claims, database);
        if (resource === 'settings' && segments.length === 1 && req.method === 'PUT') return handleSettings(req, res, claims, database);
        if (resource === 'data-source' && segments.length === 1 && req.method === 'PUT') {
            return handleDataSourcePut(req, res, claims, database);
        }
        if (resource === 'data-refresh' && segments.length === 1 && req.method === 'POST') {
            return handleDataRefresh(req, res, claims, database, refreshSnapshots);
        }
        if (resource === 'player-status') {
            if (segments.length === 1 && req.method === 'GET') {
                return handlePlayerStatusGet(req, res, claims, database);
            }
            if (segments.length === 2 && rawMatchId === 'draft' && req.method === 'PUT') {
                return handlePlayerStatusDraftPut(req, res, claims, database);
            }
            if (segments.length === 2 && rawMatchId === 'publish' && req.method === 'POST') {
                return handlePlayerStatusPublish(req, res, claims, database);
            }
            return res.status(405).json({ error: 'Method not allowed' });
        }
        if (resource === 'notifications' && rawMatchId === 'test' && req.method === 'POST') {
            if (segments.length !== 2) return res.status(404).json({ error: 'Admin endpoint not found' });
            return handleNotificationTest(req, res, claims, database, messaging);
        }
        if (resource === 'notifications' && rawMatchId === 'send' && req.method === 'POST') {
            if (segments.length !== 2) return res.status(404).json({ error: 'Admin endpoint not found' });
            return handleNotificationSend(req, res, claims, database, messaging);
        }
        if (resource !== 'lineups') return res.status(404).json({ error: 'Admin endpoint not found' });

        const matchId = validateMatchId(rawMatchId);
        if (!matchId) return res.status(400).json({ error: 'Invalid match ID' });
        const match = await getKnownMatch(matchId, database);
        if (!match) return res.status(404).json({ error: 'Match is not available for administration' });

        if (!action && segments.length === 2 && req.method === 'GET') return handleLineupGet(req, res, claims, matchId, match, database);
        if (action === 'draft' && segments.length === 3 && req.method === 'PUT') return handleDraftPut(req, res, claims, matchId, match, database);
        if (action === 'publish' && segments.length === 3 && req.method === 'POST') return handlePublish(req, res, claims, matchId, match, database, messaging);
        if (action === 'release' && segments.length === 3 && req.method === 'POST') return handleRelease(req, res, claims, matchId, match, database);
        if (action === 'unpublish' && segments.length === 3 && req.method === 'POST') return handleUnpublish(req, res, claims, matchId, match, database);
        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Admin request failed:', error?.code || error?.message || 'unknown');
        return res.status(500).json({ error: 'Admin operation failed' });
    }
}

module.exports = {
    MATCH_ID_PATTERN,
    validateMatchId,
    normalizeDraft,
    normalizeNotification,
    normalizeDataSourceUpdate,
    normalizeDataRefreshRequest,
    normalizePlayerStatusDraft,
    normalizePublishedPlayerStatuses,
    notificationHash,
    summarizeUefaJourney,
    handleAdminRoute
};
