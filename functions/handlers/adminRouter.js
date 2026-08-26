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
const { version: APP_VERSION } = require('../package.json');

const MATCH_ID_PATTERN = /^\d{5,20}$/;
const FORMATION_PLACE_SLOTS = Object.freeze({
    '4-3-3': ['GK', 'RB', 'LB', 'CM2', 'CB2', 'CB1', 'CM3', 'CM1', 'ST', 'RW', 'LW'],
    '4-4-2': ['GK', 'RB', 'LB', 'CM1', 'CB2', 'CB1', 'RM', 'CM2', 'ST2', 'ST1', 'LM'],
    '4-2-3-1': ['GK', 'RB', 'LB', 'CDM1', 'CB2', 'CB1', 'RAM', 'CDM2', 'ST', 'CAM', 'LAM'],
    '4-1-4-1': ['GK', 'RB', 'LB', 'CDM', 'CB2', 'CB1', 'RM', 'CM2', 'ST', 'CM1', 'LM'],
    '3-5-2': ['GK', 'RWB', 'LWB', 'CB1', 'CB2', 'CB3', 'CM2', 'CM1', 'ST1', 'ST2', 'CM3'],
    '4-1-2-1-2 Diamond': ['GK', 'RB', 'LB', 'CDM', 'CB2', 'CB1', 'CM2', 'CM1', 'ST2', 'CAM', 'ST1']
});
const ALLOWED_FORMATIONS = new Set(Object.keys(FORMATION_PLACE_SLOTS));
const ALLOWED_PLAYER_KEYS = new Set(['slot', 'id', 'name', 'position', 'number']);
const APP_URL = 'https://omerkalay.com/fenerbahce-fan-hub/';
const NOTIFICATION_TEST_TTL_MS = 10 * 60 * 1000;
const NOTIFICATION_GROUP_MAX_MEMBERS = 25;
const NOTIFICATION_GROUP_NAME_MAX_LENGTH = 40;
const NOTIFICATION_USER_PAGE_SIZE = 100;
const NOTIFICATION_URL_MAX_LENGTH = 300;
const NOTIFICATION_GROUP_ID_PATTERN = /^[0-9a-f-]{36}$/i;
const NOTIFICATION_USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const INVALID_NOTIFICATION_TOKEN_CODES = new Set([
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered'
]);
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

    const allowedSlots = new Set(FORMATION_PLACE_SLOTS[body.formation]);
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
        if (!allowedSlots.has(slot)) return null;
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

const draftToTeamLineup = (draft, team) => {
    const formationSlots = FORMATION_PLACE_SLOTS[draft.formation];
    return {
        teamId: String(team.id || ''),
        teamName: String(team.name || ''),
        formation: draft.formation,
        formationSource: 'manual',
        starters: draft.players.map((player, order) => ({
            name: player.name,
            jersey: String(player.number),
            position: player.position,
            positionCode: player.slot,
            formationSlot: player.slot,
            formationPlace: formationSlots.indexOf(player.slot) + 1,
            positionGroup: classifyPosition(player.position),
            order
        })),
        bench: [],
        substitutions: []
    };
};

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

const normalizeNotificationAudience = (value) => {
    if (value === undefined) return { type: 'topic', topic: 'all_fans' };
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

    if (value.type === 'topic') {
        if (!hasOnlyKeys(value, new Set(['type', 'topic'])) || value.topic !== 'all_fans') return null;
        return { type: 'topic', topic: 'all_fans' };
    }

    if (value.type === 'users') {
        if (!hasOnlyKeys(value, new Set(['type', 'userUids'])) || !Array.isArray(value.userUids)) return null;
        if (value.userUids.some((uid) => typeof uid !== 'string')) return null;
        const userUids = [...new Set(value.userUids.map((uid) => String(uid || '').trim()))].sort();
        if (
            userUids.length < 1
            || userUids.length > NOTIFICATION_GROUP_MAX_MEMBERS
            || userUids.some((uid) => !NOTIFICATION_USER_ID_PATTERN.test(uid))
        ) return null;
        return { type: 'users', userUids };
    }

    if (value.type === 'group') {
        if (!hasOnlyKeys(value, new Set(['type', 'groupId', 'revision']))) return null;
        const groupId = String(value.groupId || '').trim();
        if (!NOTIFICATION_GROUP_ID_PATTERN.test(groupId) || !Number.isInteger(value.revision) || value.revision < 1) {
            return null;
        }
        return { type: 'group', groupId, revision: value.revision };
    }

    return null;
};

const normalizeNotificationUrl = (value) => {
    const raw = String(value || APP_URL).trim();
    if (!raw || raw.length > NOTIFICATION_URL_MAX_LENGTH) return null;

    let url;
    try {
        url = new URL(raw, APP_URL);
    } catch {
        return null;
    }

    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase();
    const segments = url.pathname.split('/').filter(Boolean);

    if (hostname === 'omerkalay.com' && url.pathname.startsWith('/fenerbahce-fan-hub/')) {
        return url.toString();
    }

    if (new Set(['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com']).has(hostname)) {
        if (segments[0]?.toLowerCase() !== 'fenerbahce') return null;
        if (segments.length === 1) return url.toString();
        if (segments.length === 3 && segments[1]?.toLowerCase() === 'status' && /^\d+$/.test(segments[2])) {
            return url.toString();
        }
        return null;
    }

    if (new Set(['instagram.com', 'www.instagram.com']).has(hostname)) {
        const first = segments[0]?.toLowerCase();
        if (first === 'fenerbahce' && segments.length === 1) return url.toString();
        if (segments.length === 2 && new Set(['p', 'reel', 'tv']).has(first) && /^[A-Za-z0-9_-]+$/.test(segments[1] || '')) {
            return url.toString();
        }
    }

    return null;
};

const normalizeNotification = (body) => {
    if (!hasOnlyKeys(body, new Set(['title', 'body', 'url', 'audience', 'testId']))) return null;
    if (
        typeof body.title !== 'string'
        || typeof body.body !== 'string'
        || (body.url !== undefined && typeof body.url !== 'string')
        || (body.audience !== undefined && (typeof body.audience !== 'object' || body.audience === null))
        || (body.testId !== undefined && typeof body.testId !== 'string')
    ) return null;
    const title = body.title.trim();
    const messageBody = body.body.trim();
    if (!title || title.length > 60 || !messageBody || messageBody.length > 180) return null;
    const url = normalizeNotificationUrl(body.url);
    const audience = normalizeNotificationAudience(body.audience);
    if (!url || !audience) return null;

    return {
        title,
        body: messageBody,
        url,
        audience,
        ...(body.testId ? { testId: String(body.testId) } : {})
    };
};

const notificationHash = (payload) => crypto
    .createHash('sha256')
    .update(JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url,
        audience: payload.audience || { type: 'topic', topic: 'all_fans' }
    }))
    .digest('hex');

const notificationData = (payload, type) => ({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    type
});

const normalizeNotificationGroup = (body, requireRevision = false) => {
    const allowedKeys = requireRevision
        ? new Set(['name', 'userUids', 'baseRevision'])
        : new Set(['name', 'userUids']);
    if (!hasOnlyKeys(body, allowedKeys)) return null;
    const name = String(body.name || '').trim().replace(/\s+/g, ' ');
    if (!Array.isArray(body.userUids) || body.userUids.some((uid) => typeof uid !== 'string')) return null;
    const userUids = Array.isArray(body.userUids)
        ? [...new Set(body.userUids.map((uid) => String(uid || '').trim()))].sort()
        : [];
    if (
        name.length < 2
        || name.length > NOTIFICATION_GROUP_NAME_MAX_LENGTH
        || !/[\p{L}\p{N}]/u.test(name)
        || userUids.length < 1
        || userUids.length > NOTIFICATION_GROUP_MAX_MEMBERS
        || userUids.some((uid) => !NOTIFICATION_USER_ID_PATTERN.test(uid))
    ) return null;
    if (requireRevision && (!Number.isInteger(body.baseRevision) || body.baseRevision < 1)) return null;
    return {
        name,
        userUids,
        ...(requireRevision ? { baseRevision: body.baseRevision } : {})
    };
};

const normalizeGroupDelete = (body) => (
    hasOnlyKeys(body, new Set(['baseRevision']))
    && Number.isInteger(body.baseRevision)
    && body.baseRevision >= 1
        ? { baseRevision: body.baseRevision }
        : null
);

const maskEmail = (email) => {
    const value = String(email || '').trim();
    const at = value.lastIndexOf('@');
    if (at <= 0 || at === value.length - 1) return null;
    const local = value.slice(0, at);
    return `${local.slice(0, 1)}***@${value.slice(at + 1).toLowerCase()}`;
};

const sanitizePhotoUrl = (value) => {
    try {
        const url = new URL(String(value || ''));
        return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
    } catch {
        return null;
    }
};

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
        version: APP_VERSION,
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

const getNotificationEligibility = (user, notificationRecord) => {
    if (user.disabled) return { status: 'disabled', eligible: false };
    const token = typeof notificationRecord?.fcmToken === 'string' ? notificationRecord.fcmToken : '';
    if (!token || token !== token.trim()) {
        return { status: 'no_device', eligible: false };
    }
    if (notificationRecord.generalNotifications !== true) {
        return { status: 'opted_out', eligible: false };
    }
    return { status: 'eligible', eligible: true };
};

const sanitizeAdminUser = (user, notificationRecord) => {
    const eligibility = getNotificationEligibility(user, notificationRecord);
    return {
        id: user.uid,
        displayName: String(user.displayName || '').trim() || 'İsimsiz kullanıcı',
        maskedEmail: maskEmail(user.email),
        photoURL: sanitizePhotoUrl(user.photoURL),
        disabled: user.disabled === true,
        notificationStatus: eligibility.status,
        eligible: eligibility.eligible
    };
};

const handleNotificationUsersList = async (req, res, database, authService) => {
    const query = req.query || {};
    if (!hasOnlyKeys(query, new Set(['limit', 'pageToken']))) {
        return res.status(400).json({ error: 'Invalid user directory query' });
    }
    const limit = query.limit === undefined ? NOTIFICATION_USER_PAGE_SIZE : Number(query.limit);
    const pageToken = query.pageToken === undefined ? undefined : String(query.pageToken);
    if (!Number.isInteger(limit) || limit < 1 || limit > NOTIFICATION_USER_PAGE_SIZE) {
        return res.status(400).json({ error: 'Invalid user directory limit' });
    }
    if (pageToken !== undefined && (!pageToken || pageToken.length > 2000)) {
        return res.status(400).json({ error: 'Invalid user directory page token' });
    }

    const result = await authService.listUsers(limit, pageToken);
    const users = await Promise.all(result.users.map(async (user) => {
        if (!NOTIFICATION_USER_ID_PATTERN.test(user.uid)) {
            return {
                id: user.uid,
                displayName: String(user.displayName || '').trim() || 'İsimsiz kullanıcı',
                maskedEmail: maskEmail(user.email),
                photoURL: sanitizePhotoUrl(user.photoURL),
                disabled: user.disabled === true,
                notificationStatus: 'unsupported',
                eligible: false
            };
        }
        const snapshot = await database.ref(`notifications/${user.uid}`).once('value');
        return sanitizeAdminUser(user, snapshot.val() || {});
    }));

    return res.json({ users, nextPageToken: result.pageToken || null });
};

const sanitizeNotificationGroup = (groupId, value) => {
    if (!NOTIFICATION_GROUP_ID_PATTERN.test(groupId) || !value || typeof value !== 'object') return null;
    const normalized = normalizeNotificationGroup({ name: value.name, userUids: value.userUids });
    const revision = Number(value.revision);
    if (!normalized || !Number.isInteger(revision) || revision < 1) return null;
    return {
        id: groupId,
        name: normalized.name,
        userUids: normalized.userUids,
        revision,
        createdAt: Number(value.createdAt || 0),
        updatedAt: Number(value.updatedAt || 0)
    };
};

const loadNotificationGroup = async (database, uid, groupId) => {
    const snapshot = await database.ref(`ops/adminNotificationGroups/${uid}/${groupId}`).once('value');
    const value = snapshot.val();
    return value ? sanitizeNotificationGroup(groupId, value) : null;
};

const loadEligibleRecipients = async (userUids, database, authService) => {
    const authResult = await authService.getUsers(userUids.map((uid) => ({ uid })));
    const usersByUid = new Map(authResult.users.map((user) => [user.uid, user]));
    const seenTokens = new Set();
    const recipients = [];

    for (const uid of userUids) {
        const user = usersByUid.get(uid);
        if (!user || user.disabled) continue;
        const snapshot = await database.ref(`notifications/${uid}`).once('value');
        const notificationRecord = snapshot.val() || {};
        const eligibility = getNotificationEligibility(user, notificationRecord);
        const token = typeof notificationRecord.fcmToken === 'string' ? notificationRecord.fcmToken : '';
        if (!eligibility.eligible || !token || seenTokens.has(token)) continue;
        seenTokens.add(token);
        recipients.push({ uid, token });
    }

    return {
        requested: userUids.length,
        eligible: recipients.length,
        skipped: userUids.length - recipients.length,
        recipients
    };
};

const validateGroupMembers = async (userUids, database, authService) => {
    const authResult = await authService.getUsers(userUids.map((uid) => ({ uid })));
    const usersByUid = new Map(authResult.users.map((user) => [user.uid, user]));
    const eligibility = await Promise.all(userUids.map(async (uid) => {
        const user = usersByUid.get(uid);
        if (!user || user.disabled) return false;
        const snapshot = await database.ref(`notifications/${uid}`).once('value');
        return getNotificationEligibility(user, snapshot.val() || {}).eligible;
    }));
    return eligibility.every(Boolean);
};

const handleNotificationGroupsList = async (_req, res, claims, database) => {
    const snapshot = await database.ref(`ops/adminNotificationGroups/${claims.uid}`).once('value');
    const rawGroups = snapshot.val() || {};
    const groups = Object.entries(rawGroups)
        .map(([groupId, value]) => sanitizeNotificationGroup(groupId, value || {}))
        .filter(Boolean)
        .sort((left, right) => right.updatedAt - left.updatedAt || left.name.localeCompare(right.name, 'tr'));
    return res.json({ groups });
};

const handleNotificationGroupCreate = async (req, res, claims, database, authService) => {
    const input = normalizeNotificationGroup(req.body);
    if (!input) return res.status(400).json({ error: 'Invalid notification group' });
    if (!await validateGroupMembers(input.userUids, database, authService)) {
        return res.status(409).json({ error: 'Every group member must have active general notifications' });
    }
    const now = Date.now();
    const groupId = crypto.randomUUID();
    const group = {
        name: input.name,
        userUids: input.userUids,
        revision: 1,
        createdAt: now,
        updatedAt: now,
        updatedBy: claims.uid
    };
    await database.ref(`ops/adminNotificationGroups/${claims.uid}/${groupId}`).set(group);
    await writeAudit(claims.uid, 'notification.group.created', {
        groupId,
        memberCount: group.userUids.length
    }, database);
    return res.status(201).json({ success: true, group: sanitizeNotificationGroup(groupId, group) });
};

const handleNotificationGroupUpdate = async (req, res, claims, groupId, database, authService) => {
    if (!NOTIFICATION_GROUP_ID_PATTERN.test(groupId)) {
        return res.status(400).json({ error: 'Invalid notification group ID' });
    }
    const input = normalizeNotificationGroup(req.body, true);
    if (!input) return res.status(400).json({ error: 'Invalid notification group' });
    if (!await validateGroupMembers(input.userUids, database, authService)) {
        return res.status(409).json({ error: 'Every group member must have active general notifications' });
    }
    const groupRef = database.ref(`ops/adminNotificationGroups/${claims.uid}/${groupId}`);
    const existingSnapshot = await groupRef.once('value');
    if (!existingSnapshot.val()) return res.status(404).json({ error: 'Notification group not found' });
    const now = Date.now();
    const result = await groupRef.transaction((current) => {
        if (!current || Number(current.revision || 1) !== input.baseRevision) return;
        return {
            ...current,
            name: input.name,
            userUids: input.userUids,
            revision: input.baseRevision + 1,
            updatedAt: now,
            updatedBy: claims.uid
        };
    });
    if (!result.committed) return res.status(409).json({ error: 'Notification group changed' });
    const group = sanitizeNotificationGroup(groupId, result.snapshot.val());
    await writeAudit(claims.uid, 'notification.group.updated', {
        groupId,
        revision: group.revision,
        memberCount: group.userUids.length
    }, database);
    return res.json({ success: true, group });
};

const handleNotificationGroupDelete = async (req, res, claims, groupId, database) => {
    if (!NOTIFICATION_GROUP_ID_PATTERN.test(groupId)) {
        return res.status(400).json({ error: 'Invalid notification group ID' });
    }
    const input = normalizeGroupDelete(req.body);
    if (!input) return res.status(400).json({ error: 'Invalid notification group deletion' });
    const groupRef = database.ref(`ops/adminNotificationGroups/${claims.uid}/${groupId}`);
    const existingSnapshot = await groupRef.once('value');
    if (!existingSnapshot.val()) return res.status(404).json({ error: 'Notification group not found' });
    const result = await groupRef.transaction((current) => {
        if (!current || Number(current.revision || 1) !== input.baseRevision) return;
        return null;
    });
    if (!result.committed) return res.status(409).json({ error: 'Notification group changed' });
    await writeAudit(claims.uid, 'notification.group.deleted', { groupId }, database);
    return res.json({ success: true });
};

const validateNotificationAudience = async (audience, claims, database) => {
    if (audience.type !== 'group') return { valid: true, group: null };
    const group = await loadNotificationGroup(database, claims.uid, audience.groupId);
    return {
        valid: Boolean(group && group.revision === audience.revision),
        group
    };
};

const clearInvalidNotificationToken = async (database, recipient, errorCode) => {
    if (!INVALID_NOTIFICATION_TOKEN_CODES.has(errorCode)) return;
    await database.ref(`notifications/${recipient.uid}`).transaction((current) => {
        if (!current || current.fcmToken !== recipient.token) return;
        return {
            ...current,
            fcmToken: null,
            tokenInvalidAt: Date.now(),
            tokenInvalidCode: errorCode
        };
    });
};

const handleNotificationTest = async (req, res, claims, database = db, messaging = admin.messaging()) => {
    const payload = normalizeNotification(req.body);
    if (!payload || payload.testId) return res.status(400).json({ error: 'Invalid notification payload' });
    const audienceState = await validateNotificationAudience(payload.audience, claims, database);
    if (!audienceState.valid) return res.status(409).json({ error: 'Notification group changed or was removed' });
    const tokenSnapshot = await database.ref(`notifications/${claims.uid}/fcmToken`).once('value');
    const token = tokenSnapshot.val();
    if (!token) return res.status(409).json({ error: 'No notification token is registered for this admin device' });

    const messageId = await messaging.send({ token, data: notificationData(payload, 'adminTest') });
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

const summarizeNotificationAudience = (audience) => {
    if (audience.type === 'topic') return { type: 'topic', topic: 'all_fans' };
    if (audience.type === 'group') {
        return { type: 'group', groupId: audience.groupId, revision: audience.revision };
    }
    return { type: 'users', recipientCount: audience.userUids.length };
};

const handleNotificationSend = async (
    req,
    res,
    claims,
    database = db,
    messaging = admin.messaging(),
    authService = admin.auth()
) => {
    const payload = normalizeNotification(req.body);
    if (!payload?.testId || !NOTIFICATION_GROUP_ID_PATTERN.test(payload.testId)) {
        return res.status(400).json({ error: 'A valid testId is required' });
    }
    const testSnapshot = await database.ref(`ops/adminNotificationTests/${claims.uid}/${payload.testId}`).once('value');
    const test = testSnapshot.val();
    const now = Date.now();
    if (!test || test.expiresAt < now || test.hash !== notificationHash(payload)) {
        return res.status(409).json({ error: 'The tested notification expired or its content changed' });
    }
    const audienceState = await validateNotificationAudience(payload.audience, claims, database);
    if (!audienceState.valid) return res.status(409).json({ error: 'Notification group changed or was removed' });

    const sendRef = database.ref(`ops/adminNotificationSends/${payload.testId}`);
    const lock = await sendRef.transaction((current) => current ? undefined : {
        status: 'sending',
        uid: claims.uid,
        startedAt: now,
        payload: {
            title: payload.title,
            body: payload.body,
            url: payload.url,
            audience: summarizeNotificationAudience(payload.audience)
        }
    });
    if (!lock.committed) return res.status(409).json({ error: 'This notification was already submitted' });

    try {
        if (payload.audience.type === 'topic') {
            const messageId = await messaging.send({
                topic: 'all_fans',
                data: notificationData(payload, 'adminBroadcast')
            });
            await sendRef.update({ status: 'accepted', acceptedAt: Date.now(), messageId });
            await writeAudit(claims.uid, 'notification.broadcast.accepted', {
                testId: payload.testId,
                audience: { type: 'topic', topic: 'all_fans' }
            }, database);
            return res.json({ success: true, status: 'accepted', audience: { type: 'topic' } });
        }

        const userUids = payload.audience.type === 'group'
            ? audienceState.group.userUids
            : payload.audience.userUids;
        const resolved = await loadEligibleRecipients(userUids, database, authService);
        let accepted = 0;
        let failed = 0;
        if (resolved.recipients.length > 0) {
            const multicastResult = await messaging.sendEachForMulticast({
                tokens: resolved.recipients.map((recipient) => recipient.token),
                data: notificationData(payload, 'adminTargeted')
            });
            accepted = Number(multicastResult.successCount || 0);
            failed = Number(multicastResult.failureCount || 0);
            await Promise.all((multicastResult.responses || []).map(async (response, index) => {
                if (response.success) return;
                const recipient = resolved.recipients[index];
                if (!recipient) return;
                await clearInvalidNotificationToken(database, recipient, response.error?.code || 'messaging/unknown');
            }));
        }
        const delivery = {
            requested: resolved.requested,
            eligible: resolved.eligible,
            accepted,
            failed,
            skipped: resolved.skipped
        };
        await sendRef.update({ status: 'accepted', acceptedAt: Date.now(), delivery });
        await writeAudit(claims.uid, 'notification.targeted.accepted', {
            testId: payload.testId,
            audience: summarizeNotificationAudience(payload.audience),
            delivery
        }, database);
        return res.json({ success: true, status: 'accepted', audience: { type: payload.audience.type }, delivery });
    } catch (error) {
        await sendRef.update({ status: 'failed', failedAt: Date.now(), errorCode: error?.code || 'messaging/unknown' });
        await writeAudit(claims.uid, 'notification.send.failed', {
            testId: payload.testId,
            audience: summarizeNotificationAudience(payload.audience)
        }, database);
        return res.status(502).json({ success: false, status: 'failed', error: 'Firebase rejected the notification' });
    }
};

async function handleAdminRoute(req, res, segments, dependencies = {}) {
    const database = dependencies.database || db;
    const messaging = dependencies.messaging || admin.messaging();
    const authService = dependencies.authService || admin.auth();
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
        if (resource === 'users' && segments.length === 1 && req.method === 'GET') {
            return handleNotificationUsersList(req, res, database, authService);
        }
        if (resource === 'notification-groups') {
            if (segments.length === 1 && req.method === 'GET') {
                return handleNotificationGroupsList(req, res, claims, database);
            }
            if (segments.length === 1 && req.method === 'POST') {
                return handleNotificationGroupCreate(req, res, claims, database, authService);
            }
            if (segments.length === 2 && req.method === 'PUT') {
                return handleNotificationGroupUpdate(req, res, claims, rawMatchId, database, authService);
            }
            if (segments.length === 2 && req.method === 'DELETE') {
                return handleNotificationGroupDelete(req, res, claims, rawMatchId, database);
            }
            return res.status(405).json({ error: 'Method not allowed' });
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
            return handleNotificationSend(req, res, claims, database, messaging, authService);
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
    normalizeNotificationAudience,
    normalizeNotificationUrl,
    normalizeNotificationGroup,
    maskEmail,
    normalizeDataSourceUpdate,
    normalizeDataRefreshRequest,
    normalizePlayerStatusDraft,
    normalizePublishedPlayerStatuses,
    notificationHash,
    summarizeUefaJourney,
    handleAdminRoute
};
