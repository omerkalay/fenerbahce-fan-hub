const { onRequest } = require("firebase-functions/v2/https");
const { admin, db, rapidApiKey, rapidApiHost, adminRefreshKey, corsOptions, sleep } = require('../config');
const { fetchEspnSummaryForMatch } = require('../services/espn');
const { fetchNextMatches, fetchSquad, fetchImage } = require('../services/sofascore');

const buildReminderOptions = (data = {}) => ({
    threeHours: !!data.defaultOptions?.threeHours,
    oneHour: !!data.defaultOptions?.oneHour,
    thirtyMinutes: !!data.defaultOptions?.thirtyMinutes,
    fifteenMinutes: !!data.defaultOptions?.fifteenMinutes,
    dailyCheck: !!data.dailyCheck,
    updatedAt: data.defaultOptions?.updatedAt || null
});

const countActiveReminderOptions = (options = {}) => (
    Object.entries(options).filter(([key, value]) => key !== 'updatedAt' && value === true).length
);

const getBearerToken = (req) => {
    const authHeader = req.headers.authorization;
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.slice(7).trim();
    return token || null;
};

async function requireAuthenticatedUid(req, res) {
    const idToken = getBearerToken(req);
    if (!idToken) {
        res.status(401).json({ error: 'Missing bearer token' });
        return null;
    }

    try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        return decoded.uid;
    } catch (error) {
        console.error('Auth verification failed:', error);
        res.status(401).json({ error: 'Invalid auth token' });
        return null;
    }
}

const POLL_OPTIONS = new Set(['home', 'away', 'draw']);
const RATE_LIMIT_CONFIGS = {
    default: { windowMs: 60 * 1000, max: 120 },
    expensive: { windowMs: 60 * 1000, max: 20 },
    asset: { windowMs: 60 * 1000, max: 90 },
    write: { windowMs: 15 * 60 * 1000, max: 25 },
    health: { windowMs: 60 * 1000, max: 10 }
};
const rateLimitBuckets = new Map();
let nextRateLimitSweepAt = 0;

const normalizeVoteCounts = (votes = {}) => ({
    home: Number(votes.home) || 0,
    away: Number(votes.away) || 0,
    draw: Number(votes.draw) || 0
});

const getClientAddress = (req) => {
    const forwardedFor = req.headers['x-forwarded-for'];
    const forwarded = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : String(forwardedFor || '').split(',')[0].trim();

    return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
};

const shouldBypassRateLimit = (req, clientAddress) => {
    const host = String(req.headers.host || '').toLowerCase();
    return host.includes('localhost') ||
        host.includes('127.0.0.1') ||
        ['::1', '127.0.0.1', '::ffff:127.0.0.1'].includes(clientAddress);
};

const sweepRateLimitBuckets = (now) => {
    if (now < nextRateLimitSweepAt) {
        return;
    }

    for (const [key, bucket] of rateLimitBuckets.entries()) {
        if (bucket.resetAt <= now) {
            rateLimitBuckets.delete(key);
        }
    }

    nextRateLimitSweepAt = now + 60 * 1000;
};

const enforceRateLimit = (req, res, profile = 'default') => {
    if (req.method === 'OPTIONS') {
        return true;
    }

    const config = RATE_LIMIT_CONFIGS[profile] || RATE_LIMIT_CONFIGS.default;
    const now = Date.now();
    const clientAddress = getClientAddress(req);

    if (shouldBypassRateLimit(req, clientAddress)) {
        return true;
    }

    sweepRateLimitBuckets(now);

    const bucketKey = `${profile}:${clientAddress}`;
    let bucket = rateLimitBuckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= now) {
        bucket = {
            count: 0,
            resetAt: now + config.windowMs
        };
    }

    bucket.count += 1;
    rateLimitBuckets.set(bucketKey, bucket);

    const remaining = Math.max(config.max - bucket.count, 0);
    res.set('X-RateLimit-Limit', String(config.max));
    res.set('X-RateLimit-Remaining', String(remaining));
    res.set('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > config.max) {
        res.set('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
        res.status(429).json({ error: 'Too many requests. Please try again later.' });
        return false;
    }

    return true;
};

const resolveRateLimitProfile = (endpoint, method) => {
    if (endpoint === 'match-summary' || endpoint === 'matchSummary') {
        return 'expensive';
    }

    if (
        endpoint === 'player-image' ||
        endpoint === 'playerImage' ||
        endpoint === 'team-image' ||
        endpoint === 'teamImage'
    ) {
        return 'asset';
    }

    if (endpoint === 'health') {
        return 'health';
    }

    if (
        method === 'POST' && (
            endpoint === 'reminder' ||
            endpoint === 'poll-vote' ||
            endpoint === 'pollVote'
        )
    ) {
        return 'write';
    }

    return 'default';
};

const getRequestOrigin = (req) => {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = Array.isArray(forwardedProto)
        ? forwardedProto[0]
        : String(forwardedProto || req.protocol || 'https').split(',')[0].trim();
    const forwardedHost = req.headers['x-forwarded-host'];
    const host = Array.isArray(forwardedHost)
        ? forwardedHost[0]
        : String(forwardedHost || req.headers.host || '').split(',')[0].trim();

    return host ? `${protocol}://${host}`.replace(/\/+$/g, '') : '';
};

const buildApiBaseUrl = (req) => {
    const origin = getRequestOrigin(req);
    return origin ? `${origin}/api` : 'https://us-central1-fb-hub-ed9de.cloudfunctions.net/api';
};

// Handler functions
async function handleNextMatch(req, res) {
    const snapshot = await db.ref('cache/nextMatch').once('value');
    const data = snapshot.val();
    if (!data) {
        return res.status(404).json({ error: 'No match data. Run /refresh first.' });
    }
    return res.json(data);
}

async function handleNext3Matches(req, res) {
    const snapshot = await db.ref('cache/next3Matches').once('value');
    const data = snapshot.val() || [];
    return res.json(data);
}

async function handleSquad(req, res) {
    const snapshot = await db.ref('cache/squad').once('value');
    const squad = snapshot.val() || [];

    // Add photo URLs
    const baseUrl = buildApiBaseUrl(req);
    const enrichedSquad = squad.map(player => ({
        ...player,
        photo: `${baseUrl}/player-image/${player.id}`
    }));

    return res.json(enrichedSquad);
}

async function handleStandings(req, res) {
    const snapshot = await db.ref('cache/standings').once('value');
    const data = snapshot.val() || [];
    return res.json(data);
}

async function handleLiveMatch(req, res) {
    try {
        const liveSnapshot = await db.ref('cache/liveMatch').once('value');
        const liveData = liveSnapshot.val();
        if (liveData) {
            return res.json(liveData);
        }

        const lastFinishedSnapshot = await db.ref('cache/lastFinishedMatch').once('value');
        const lastFinished = lastFinishedSnapshot.val();
        if (lastFinished) {
            return res.json(lastFinished);
        }

        return res.json({ matchState: 'no-match' });
    } catch (error) {
        console.error('Live match error:', error);
        return res.status(500).json({ error: 'Failed to fetch live match' });
    }
}

async function handleMatchSummary(req, res, matchId) {
    if (!matchId) {
        return res.status(400).json({ error: 'Match ID required' });
    }

    const normalizedMatchId = String(matchId);

    try {
        const snapshot = await db.ref(`cache/matchSummaries/${normalizedMatchId}`).once('value');
        const cachedSummary = snapshot.val();
        if (cachedSummary) {
            return res.json(cachedSummary);
        }

        const fetchedSummary = await fetchEspnSummaryForMatch(normalizedMatchId);
        if (!fetchedSummary) {
            return res.status(404).json({ error: 'Match summary not found' });
        }

        await db.ref(`cache/matchSummaries/${normalizedMatchId}`).set(fetchedSummary);
        return res.json(fetchedSummary);
    } catch (error) {
        console.error('Match summary error:', error);
        return res.status(500).json({ error: 'Failed to fetch match summary' });
    }
}

async function handlePlayerImage(req, res, playerId) {
    if (!playerId) {
        return res.status(400).json({ error: 'Player ID required' });
    }

    try {
        const result = await fetchImage('player', playerId);
        if (!result) {
            return res.status(404).send('Image not found');
        }

        res.set('Content-Type', result.contentType);
        res.set('Cache-Control', 'public, max-age=86400');
        return res.send(result.buffer);
    } catch (error) {
        console.error('Player image error:', error);
        return res.status(500).send('Error loading image');
    }
}

async function handleTeamImage(req, res, teamId) {
    if (!teamId) {
        return res.status(400).json({ error: 'Team ID required' });
    }

    try {
        const result = await fetchImage('team', teamId);
        if (!result) {
            return res.status(404).send('Image not found');
        }

        res.set('Content-Type', result.contentType);
        res.set('Cache-Control', 'public, max-age=86400');
        return res.send(result.buffer);
    } catch (error) {
        console.error('Team image error:', error);
        return res.status(500).send('Error loading image');
    }
}


async function handlePollVote(req, res) {
    const authenticatedUid = await requireAuthenticatedUid(req, res);
    if (!authenticatedUid) {
        return;
    }

    const { matchId, option } = req.body || {};
    const normalizedMatchId = String(matchId || '').trim();
    const normalizedOption = String(option || '').trim();

    if (!normalizedMatchId) {
        return res.status(400).json({ error: 'Match ID required' });
    }

    if (normalizedMatchId.includes('/')) {
        return res.status(400).json({ error: 'Invalid match ID' });
    }

    if (!POLL_OPTIONS.has(normalizedOption)) {
        return res.status(400).json({ error: 'Invalid vote option' });
    }

    const pollRef = db.ref(`match_polls/${normalizedMatchId}`);

    try {
        let existingVote = null;
        const transactionResult = await pollRef.transaction((currentData) => {
            const current = currentData && typeof currentData === 'object' ? currentData : {};
            const currentUsers = current.users && typeof current.users === 'object' ? current.users : {};
            const previousVote = typeof currentUsers[authenticatedUid] === 'string'
                ? currentUsers[authenticatedUid]
                : null;

            if (previousVote) {
                existingVote = previousVote;
                return current;
            }

            const nextVotes = normalizeVoteCounts(current.votes);
            nextVotes[normalizedOption] = (nextVotes[normalizedOption] || 0) + 1;

            return {
                ...current,
                votes: nextVotes,
                users: {
                    ...currentUsers,
                    [authenticatedUid]: normalizedOption
                },
                updatedAt: Date.now()
            };
        });

        const pollData = transactionResult.snapshot.val() || {};
        const votes = normalizeVoteCounts(pollData.votes);
        const userVote = existingVote || pollData.users?.[authenticatedUid] || normalizedOption;
        const totalVotes = votes.home + votes.away + votes.draw;

        return res.json({
            success: true,
            alreadyVoted: Boolean(existingVote),
            userVote,
            votes,
            totalVotes
        });
    } catch (error) {
        console.error('Poll vote error:', error);
        return res.status(500).json({ error: 'Oy kaydedilemedi.' });
    }
}
async function handleReminder(req, res) {
    const authenticatedUid = await requireAuthenticatedUid(req, res);
    if (!authenticatedUid) {
        return;
    }

    const { uid, fcmToken, oldFcmToken, options } = req.body || {};

    if (uid && uid !== authenticatedUid) {
        return res.status(403).json({ error: 'UID mismatch' });
    }

    if (!options) {
        return res.status(400).json({ error: 'Missing options' });
    }

    const isDisablingAll = !options.dailyCheck && !options.threeHours &&
        !options.oneHour && !options.thirtyMinutes && !options.fifteenMinutes;

    if (!fcmToken && !isDisablingAll) {
        return res.status(400).json({ error: 'Missing fcmToken' });
    }

    const hasPathTraversal = (v) => typeof v === 'string' && v.includes('/');
    if (hasPathTraversal(fcmToken) || hasPathTraversal(oldFcmToken)) {
        return res.status(400).json({ error: 'Invalid token format' });
    }

    if (fcmToken) {
        try {
            await admin.messaging().subscribeToTopic(fcmToken, 'all_fans');
        } catch (subError) {
            console.error('Topic subscription failed:', subError);
        }
    }

    try {
        const currentSnapshot = await db.ref(`notifications/${authenticatedUid}`).once('value');
        const currentData = currentSnapshot.val() || {};

        const basePath = `notifications/${authenticatedUid}`;
        const rootUpdates = {};

        if (fcmToken) {
            rootUpdates[`${basePath}/fcmToken`] = fcmToken;
            rootUpdates[`${basePath}/tokenInvalidAt`] = null;
            rootUpdates[`${basePath}/tokenInvalidCode`] = null;
        }

        rootUpdates[`${basePath}/dailyCheck`] = !!options.dailyCheck;
        rootUpdates[`${basePath}/defaultOptions/threeHours`] = !!options.threeHours;
        rootUpdates[`${basePath}/defaultOptions/oneHour`] = !!options.oneHour;
        rootUpdates[`${basePath}/defaultOptions/thirtyMinutes`] = !!options.thirtyMinutes;
        rootUpdates[`${basePath}/defaultOptions/fifteenMinutes`] = !!options.fifteenMinutes;
        rootUpdates[`${basePath}/defaultOptions/updatedAt`] = Date.now();

        if (currentData.matches) {
            rootUpdates[`${basePath}/matches`] = null;
        }

        // Legacy migration: token-keyed → uid-keyed
        if (fcmToken && authenticatedUid !== fcmToken) {
            const legacySnapshot = await db.ref(`notifications/${fcmToken}`).once('value');
            const legacyData = legacySnapshot.val();
            if (legacyData && typeof legacyData === 'object') {
                if (legacyData.sentNotifications && !currentData.sentNotifications) {
                    rootUpdates[`${basePath}/sentNotifications`] = legacyData.sentNotifications;
                }
                if (legacyData.lastDailyNotification && !currentData.lastDailyNotification) {
                    rootUpdates[`${basePath}/lastDailyNotification`] = legacyData.lastDailyNotification;
                }
                rootUpdates[`notifications/${fcmToken}`] = null;
            }
        }

        if (oldFcmToken && oldFcmToken !== fcmToken && oldFcmToken !== authenticatedUid) {
            rootUpdates[`notifications/${oldFcmToken}`] = null;
        }

        await db.ref().update(rootUpdates);

        const reminderOptions = {
            threeHours: !!options.threeHours,
            oneHour: !!options.oneHour,
            thirtyMinutes: !!options.thirtyMinutes,
            fifteenMinutes: !!options.fifteenMinutes,
            dailyCheck: !!options.dailyCheck,
            updatedAt: rootUpdates[`${basePath}/defaultOptions/updatedAt`]
        };
        const activeCount = countActiveReminderOptions(reminderOptions);

        return res.json({
            success: true,
            message: 'Preferences saved',
            dailyCheckActive: reminderOptions.dailyCheck,
            activeNotifications: activeCount,
            options: reminderOptions
        });

    } catch (error) {
        console.error('Reminder save error:', error);
        return res.status(500).json({ error: 'Failed to save preferences' });
    }
}

async function handleReminderPreferences(req, res) {
    const authenticatedUid = await requireAuthenticatedUid(req, res);
    if (!authenticatedUid) {
        return;
    }

    try {
        const snapshot = await db.ref(`notifications/${authenticatedUid}`).once('value');
        const data = snapshot.val();
        if (!data) {
            return res.status(404).json({ error: 'Preferences not found' });
        }

        const options = buildReminderOptions(data);
        return res.json({
            uid: authenticatedUid,
            fcmToken: data.fcmToken || null,
            activeNotifications: countActiveReminderOptions(options),
            options
        });
    } catch (error) {
        console.error('Reminder fetch error:', error);
        return res.status(500).json({ error: 'Failed to fetch preferences' });
    }
}

async function handleHealth(req, res) {
    const cacheSnapshot = await db.ref('cache/lastUpdate').once('value');
    const lastUpdate = cacheSnapshot.val();

    const notifSnapshot = await db.ref('notifications').once('value');
    const notifCount = Object.keys(notifSnapshot.val() || {}).length;

    return res.json({
        status: 'ok',
        platform: 'Firebase Cloud Functions',
        lastCacheUpdate: lastUpdate ? new Date(lastUpdate).toISOString() : null,
        subscribedUsers: notifCount
    });
}

async function handleRefresh(req, res) {
    const adminKey = req.headers['x-admin-key'] || req.query.key;
    if (!adminKey || adminKey !== adminRefreshKey.value()) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    console.log('🔄 Manual refresh triggered');

    try {
        const existingSummariesSnapshot = await db.ref('cache/matchSummaries').once('value');
        const existingMatchSummaries = existingSummariesSnapshot.val() || {};

        const cache = {
            nextMatch: null,
            next3Matches: [],
            lastFinishedMatch: null,
            matchSummaries: existingMatchSummaries,
            squad: [],
            lastUpdate: Date.now()
        };

        // Fetch matches
        try {
            const events = await fetchNextMatches();
            if (events.length > 0) {
                cache.nextMatch = events[0];
                cache.next3Matches = events.slice(0, 3);
            }
        } catch (error) {
            console.error('❌ Match fetch failed:', error.message);
        }

        await sleep(1000);

        // Fetch squad
        try {
            const squad = await fetchSquad();
            // handleRefresh doesn't include marketValue in its mapping
            cache.squad = squad.map(({ marketValue, ...rest }) => rest);
        } catch (error) {
            console.error('❌ Squad fetch failed:', error.message);
        }

        await db.ref('cache').set(cache);

        return res.json({
            success: true,
            message: 'Cache refreshed',
            lastUpdate: new Date(cache.lastUpdate).toISOString(),
            stats: {
                matches: cache.next3Matches.length,
                squad: cache.squad.length
            }
        });

    } catch (error) {
        console.error('Refresh error:', error);
        return res.status(500).json({ error: 'Refresh failed', details: error.message });
    }
}

// Main API - Express-style routing
const api = onRequest({
    ...corsOptions,
    secrets: [rapidApiKey, rapidApiHost, adminRefreshKey]
}, async (req, res) => {
    const path = req.path.replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
    const segments = path.split('/');
    const endpoint = segments[0];
    const param = segments[1];
    const rateLimitProfile = resolveRateLimitProfile(endpoint, req.method);

    console.log(`📥 ${req.method} /${path}`);

    if (!enforceRateLimit(req, res, rateLimitProfile)) {
        return;
    }

    try {
        switch (endpoint) {
            case 'next-match':
            case 'nextMatch':
                return await handleNextMatch(req, res);

            case 'next-3-matches':
            case 'next3Matches':
                return await handleNext3Matches(req, res);

            case 'squad':
                return await handleSquad(req, res);

            case 'standings':
                return await handleStandings(req, res);

            case 'live-match':
            case 'liveMatch':
                return await handleLiveMatch(req, res);

            case 'match-summary':
            case 'matchSummary':
                return await handleMatchSummary(req, res, param);

            case 'player-image':
            case 'playerImage':
                return await handlePlayerImage(req, res, param);

            case 'team-image':
            case 'teamImage':
                return await handleTeamImage(req, res, param);

            case 'reminder':
                if (req.method === 'POST') {
                    return await handleReminder(req, res);
                }
                if (req.method === 'GET') {
                    return await handleReminderPreferences(req, res);
                }
                return res.status(405).json({ error: 'Method not allowed' });

            case 'poll-vote':
            case 'pollVote':
                if (req.method === 'POST') {
                    return await handlePollVote(req, res);
                }
                return res.status(405).json({ error: 'Method not allowed' });

            case 'health':
                return await handleHealth(req, res);

            case 'refresh':
                return await handleRefresh(req, res);

            default:
                return res.json({
                    message: 'Fenerbahçe Fan Hub API (Firebase)',
                    version: '2.0.0',
                    endpoints: [
                        '/next-match',
                        '/next-3-matches',
                        '/squad',
                        '/standings',
                        '/live-match',
                        '/match-summary/:matchId',
                        '/player-image/:id',
                        '/team-image/:id',
                        '/reminder (GET, POST)',
                        '/poll-vote (POST)',
                        '/health',
                        '/refresh'
                    ]
                });
        }
    } catch (error) {
        console.error('❌ API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = { api };



