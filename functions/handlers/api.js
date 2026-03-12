const { onRequest } = require("firebase-functions/v2/https");
const { rapidApiKey, rapidApiHost, adminRefreshKey, corsOptions } = require('../config');
const { enforceRateLimit, resolveRateLimitProfile } = require('./middleware');
const { handleNextMatch, handleNext3Matches, handleLiveMatch, handleMatchSummary, handleStandings } = require('./matches');
const { handleSquad } = require('./squad');
const { handlePlayerImage, handleTeamImage } = require('./assets');
const { handlePollVote } = require('./polls');
const { handleHealth, handleRefresh } = require('./admin');
const { handleReminder, handleReminderPreferences } = require('./reminders');

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

    console.log(`[api] ${req.method} /${path}`);

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
                    message: 'Fenerbahce Fan Hub API (Firebase)',
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
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = { api, handleReminder, handleReminderPreferences };
