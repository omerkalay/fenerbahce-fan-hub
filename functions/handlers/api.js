const { onRequest } = require("firebase-functions/v2/https");
const { admin, db, rapidApiKey, rapidApiHost, adminRefreshKey, corsOptions, sleep } = require('../config');
const { fetchEspnSummaryForMatch } = require('../services/espn');
const { fetchNextMatches, fetchSquad, fetchImage } = require('../services/sofascore');

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
    const baseUrl = `https://us-central1-fb-hub-ed9de.cloudfunctions.net/api`;
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

async function handleReminder(req, res) {
    const { uid, fcmToken, oldFcmToken, options } = req.body;

    if (!uid || !fcmToken || !options) {
        return res.status(400).json({ error: 'Missing uid, fcmToken or options' });
    }

    try {
        await admin.messaging().subscribeToTopic(fcmToken, 'all_fans');
    } catch (subError) {
        console.error('Topic subscription failed:', subError);
    }

    try {
        // Clean up old token-based entries (migration from pre-auth structure)
        if (oldFcmToken && oldFcmToken !== fcmToken) {
            // Remove any legacy token-keyed entry
            await db.ref(`notifications/${oldFcmToken}`).remove();
        }

        const userRef = db.ref(`notifications/${uid}`);
        const snapshot = await userRef.once('value');
        const currentData = snapshot.val() || {};

        currentData.fcmToken = fcmToken;
        currentData.dailyCheck = options.dailyCheck || false;
        currentData.defaultOptions = {
            threeHours: options.threeHours || false,
            oneHour: options.oneHour || false,
            thirtyMinutes: options.thirtyMinutes || false,
            fifteenMinutes: options.fifteenMinutes || false,
            updatedAt: Date.now()
        };

        if (currentData.matches) {
            delete currentData.matches;
        }

        await userRef.set(currentData);

        const activeCount = Object.values(currentData.defaultOptions)
            .filter(v => v === true).length;

        return res.json({
            success: true,
            message: 'Preferences saved',
            dailyCheckActive: currentData.dailyCheck,
            activeNotifications: activeCount
        });

    } catch (error) {
        console.error('Reminder save error:', error);
        return res.status(500).json({ error: 'Failed to save preferences' });
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

    console.log(`📥 ${req.method} /${path}`);

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
                        '/reminder (POST)',
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
