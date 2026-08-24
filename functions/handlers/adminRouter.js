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

const MATCH_ID_PATTERN = /^\d{5,20}$/;
const ALLOWED_FORMATIONS = new Set(['4-3-3', '4-4-2', '4-2-3-1', '4-1-4-1', '3-5-2', '4-1-2-1-2 Diamond']);
const ALLOWED_PLAYER_KEYS = new Set(['slot', 'id', 'name', 'position', 'number']);

const hasOnlyKeys = (value, allowedKeys) => (
    value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every((key) => allowedKeys.has(key))
);

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

const handleOverview = async (_req, res, _claims, database = db) => {
    const [nextMatch, settings] = await Promise.all([
        database.ref('cache/nextMatch').once('value'),
        getLineupSettings(database)
    ]);
    return res.json({
        version: '2.13.0',
        nextMatch: nextMatch.val() || null,
        settings
    });
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
            const base = detected || published || {};
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
                homeTeam: base.homeTeam || match.homeTeam,
                awayTeam: base.awayTeam || match.awayTeam,
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

async function handleAdminRoute(req, res, segments, dependencies = {}) {
    const database = dependencies.database || db;
    const messaging = dependencies.messaging || admin.messaging();
    const authenticate = dependencies.requireAdminClaims || requireAdminClaims;
    const claims = await authenticate(req, res);
    if (!claims) return;

    const [resource, rawMatchId, action] = segments;
    try {
        if (resource === 'session' && segments.length === 1 && req.method === 'GET') return handleSession(req, res, claims);
        if (resource === 'overview' && segments.length === 1 && req.method === 'GET') return handleOverview(req, res, claims, database);
        if (resource === 'settings' && segments.length === 1 && req.method === 'PUT') return handleSettings(req, res, claims, database);
        if (resource !== 'lineups') return res.status(404).json({ error: 'Admin endpoint not found' });

        const matchId = validateMatchId(rawMatchId);
        if (!matchId) return res.status(400).json({ error: 'Invalid match ID' });
        const match = await getKnownMatch(matchId, database);
        if (!match) return res.status(404).json({ error: 'Match is not available for administration' });

        if (!action && segments.length === 2 && req.method === 'GET') return handleLineupGet(req, res, claims, matchId, match, database);
        if (action === 'draft' && segments.length === 3 && req.method === 'PUT') return handleDraftPut(req, res, claims, matchId, match, database);
        if (action === 'publish' && segments.length === 3 && req.method === 'POST') return handlePublish(req, res, claims, matchId, match, database, messaging);
        if (action === 'release' && segments.length === 3 && req.method === 'POST') return handleRelease(req, res, claims, matchId, match, database);
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
    handleAdminRoute
};
