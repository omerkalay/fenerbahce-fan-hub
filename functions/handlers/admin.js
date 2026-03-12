const { db, adminRefreshKey, sleep } = require('../config');
const { fetchNextMatches, fetchSquad } = require('../services/sofascore');

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
    console.log('Manual refresh triggered');

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
            console.error('Match fetch failed:', error.message);
        }

        await sleep(1000);

        // Fetch squad
        try {
            const squad = await fetchSquad();
            // handleRefresh doesn't include marketValue in its mapping
            cache.squad = squad.map(({ marketValue: _mv, ...rest }) => rest);
        } catch (error) {
            console.error('Squad fetch failed:', error.message);
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

module.exports = { handleHealth, handleRefresh };
