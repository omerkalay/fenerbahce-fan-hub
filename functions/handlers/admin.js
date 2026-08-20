const { db, adminRefreshKey, sleep } = require('../config');
const { fetchNextMatches, fetchLastMatches, fetchSquad } = require('../services/sofascore');
const { refreshCachedImagesForCache } = require('../services/imageCache');
const {
    createRefreshCache,
    applyMatchFetchSuccess,
    applyMatchFetchFailure
} = require('../utils/cacheRefresh');
const {
    mergeCupFixturesIntoCache,
    shouldFetchCupResults
} = require('../utils/cupFixtures');
const { refreshUefaJourneyCache } = require('../services/uefaJourney');

async function handleHealth(req, res) {
    const cacheSnapshot = await db.ref('cache/lastUpdate').once('value');
    const lastUpdate = cacheSnapshot.val();

    const notifSnapshot = await db.ref('notifications').once('value');
    const notifCount = Object.keys(notifSnapshot.val() || {}).length;
    const imageCacheSnapshot = await db.ref('imageCache/meta').once('value');
    const imageCache = imageCacheSnapshot.val() || null;

    return res.json({
        status: 'ok',
        platform: 'Firebase Cloud Functions',
        lastCacheUpdate: lastUpdate ? new Date(lastUpdate).toISOString() : null,
        imageCache,
        subscribedUsers: notifCount
    });
}

async function handleRefresh(req, res) {
    const adminKey = req.headers['x-admin-key'];
    if (!adminKey || adminKey !== adminRefreshKey.value()) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    console.log('Manual refresh triggered');

    try {
        const now = Date.now();
        const referenceDate = new Date(now);
        const existingCacheSnapshot = await db.ref('cache').once('value');
        const existingCache = existingCacheSnapshot.val() || {};
        let cache = createRefreshCache({ existingCache, now, referenceDate });

        // Fetch matches
        try {
            const events = await fetchNextMatches();
            cache = applyMatchFetchSuccess(cache, events, { now, referenceDate });
            cache = mergeCupFixturesIntoCache(cache, events, {
                seasonStartYear: cache.season.startYear,
                now
            });
        } catch (error) {
            cache = applyMatchFetchFailure(cache);
            console.error('Match fetch failed:', error.message);
        }

        await sleep(1000);

        const currentCupPayload = cache.cupFixtures?.[cache.season.startYear];
        if (shouldFetchCupResults(currentCupPayload?.matches, now)) {
            try {
                const lastEvents = await fetchLastMatches();
                cache = mergeCupFixturesIntoCache(cache, lastEvents, {
                    seasonStartYear: cache.season.startYear,
                    now
                });
            } catch (error) {
                console.error(`Türkiye Kupası result refresh failed: ${error.message}`);
            }
            await sleep(1000);
        }

        // Fetch squad
        try {
            const squad = await fetchSquad();
            // handleRefresh doesn't include marketValue in its mapping
            cache.squad = squad.map(({ marketValue: _mv, ...rest }) => rest);
        } catch (error) {
            console.error('Squad fetch failed:', error.message);
        }

        const cacheUpdates = { ...cache };
        delete cacheUpdates.uefaJourney;
        await db.ref('cache').update(cacheUpdates);
        let uefaJourney = null;
        try {
            uefaJourney = await refreshUefaJourneyCache(cache.season.startYear, { now });
        } catch (error) {
            console.error(`UEFA journey refresh failed: ${error.message}`);
        }
        const imageStats = await refreshCachedImagesForCache(cache);

        return res.json({
            success: true,
            message: 'Cache refreshed',
            lastUpdate: cache.lastUpdate ? new Date(cache.lastUpdate).toISOString() : null,
            stats: {
                matches: cache.next3Matches.length,
                squad: cache.squad.length,
                uefaJourney: uefaJourney?.participation?.state || null,
                images: imageStats
            }
        });

    } catch (error) {
        console.error('Refresh error:', error);
        return res.status(500).json({ error: 'Refresh failed', details: error.message });
    }
}

module.exports = { handleHealth, handleRefresh };
