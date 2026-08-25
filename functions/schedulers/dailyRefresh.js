const { onSchedule } = require("firebase-functions/v2/scheduler");
const { db, rapidApiKey, rapidApiHost, sleep, formatDateKey } = require('../config');
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
const { refreshDataSnapshots } = require('../services/dataSnapshots');

/**
 * Runs once per day, fetching SofaScore and ESPN data into the Firebase cache.
 * The 03:00 UTC schedule is 06:00 in Istanbul.
 */
const dailyDataRefresh = onSchedule({
    schedule: "0 3 * * *",
    secrets: [rapidApiKey, rapidApiHost]
}, async (_event) => {
    const runStartedAt = Date.now();
    let runStatus = 'ok';
    let errorCode = null;
    console.log('⏰ Daily data refresh started (03:00 UTC = 06:00 TR)');

    try {
        const now = Date.now();
        const referenceDate = new Date(now);
        const existingCacheSnapshot = await db.ref('cache').once('value');
        const existingCache = existingCacheSnapshot.val() || {};
        let cache = createRefreshCache({ existingCache, now, referenceDate });

        // 1. Fetch matches from SofaScore
        console.log('1️⃣ Fetching matches from SofaScore...');
        try {
            const events = await fetchNextMatches();
            cache = applyMatchFetchSuccess(cache, events, { now, referenceDate });
            cache = mergeCupFixturesIntoCache(cache, events, {
                seasonStartYear: cache.season.startYear,
                now
            });
            if (events.length > 0) {
                console.log(`✅ Fetched ${events.length} matches`);
            } else {
                console.log('No upcoming matches returned');
            }
        } catch (error) {
            cache = applyMatchFetchFailure(cache);
            console.error(`❌ Match fetch failed: ${error.message}`);
        }

        await sleep(2000); // Rate limit protection

        const currentCupPayload = cache.cupFixtures?.[cache.season.startYear];
        if (shouldFetchCupResults(currentCupPayload?.matches, now)) {
            console.log('1️⃣ Updating completed Türkiye Kupası fixtures from SofaScore...');
            try {
                const lastEvents = await fetchLastMatches();
                cache = mergeCupFixturesIntoCache(cache, lastEvents, {
                    seasonStartYear: cache.season.startYear,
                    now
                });
                console.log('✅ Türkiye Kupası fixture results updated');
            } catch (error) {
                console.error(`❌ Türkiye Kupası result refresh failed: ${error.message}`);
            }
            await sleep(1000);
        }

        // 2. Fetch squad from SofaScore
        console.log('2️⃣ Fetching squad from SofaScore...');
        try {
            cache.squad = await fetchSquad();
            console.log(`✅ Fetched ${cache.squad.length} players`);
        } catch (error) {
            console.error(`❌ Squad fetch failed: ${error.message}`);
        }

        // 3. Save to Firebase
        console.log('3️⃣ Saving to Firebase cache...');
        const cacheUpdates = { ...cache };
        delete cacheUpdates.uefaJourney;
        await db.ref('cache').update(cacheUpdates);
        const snapshotResults = await refreshDataSnapshots({
            resources: 'all',
            seasonStartYear: cache.season.startYear,
            now
        });
        if (snapshotResults.some((result) => result.status === 'error')) {
            console.warn('Core data snapshots completed with preserved fallback data:', snapshotResults);
        } else {
            console.log('Core data snapshots refreshed successfully');
        }
        try {
            await refreshUefaJourneyCache(cache.season.startYear, { now });
            console.log('✅ UEFA journey cache updated');
        } catch (error) {
            console.error(`❌ UEFA journey refresh failed: ${error.message}`);
        }
        try {
            const imageStats = await refreshCachedImagesForCache(cache);
            console.log('Image cache refresh complete:', imageStats);
        } catch (error) {
            console.error(`Image cache refresh failed: ${error.message}`);
        }
        console.log(`✨ Cache updated at ${new Date().toISOString()}`);

        // 5. Remove poll data that no longer belongs to the current match.
        console.log('5️⃣ Cleaning up old poll data...');
        const currentMatchId = String(cache.nextMatch?.id);
        const pollsSnapshot = await db.ref('match_polls').once('value');
        const allPolls = pollsSnapshot.val() || {};
        const deleteOps = {};
        for (const pollMatchId of Object.keys(allPolls)) {
            if (pollMatchId !== currentMatchId) {
                deleteOps[`match_polls/${pollMatchId}`] = null;
            }
        }
        if (Object.keys(deleteOps).length > 0) {
            await db.ref().update(deleteOps);
            console.log(`🗑️ Removed ${Object.keys(deleteOps).length} stale poll records`);
        } else {
            console.log('✅ No stale poll records to remove');
        }

        // 6. Remove sent-notification records for matches outside the active window.
        console.log('6️⃣ Cleaning up old notification records...');
        const activeMatchIds = new Set(
            cache.next3Matches.map(m => String(m.id))
        );
        const notifSnapshot = await db.ref('notifications').once('value');
        const allNotifs = notifSnapshot.val() || {};
        const notifDeletes = {};
        for (const [token, data] of Object.entries(allNotifs)) {
            if (data.sentNotifications) {
                for (const matchId of Object.keys(data.sentNotifications)) {
                    if (!activeMatchIds.has(matchId)) {
                        notifDeletes[`notifications/${token}/sentNotifications/${matchId}`] = null;
                    }
                }
            }
            if (data.lastDailyNotification) {
                const todayKey = formatDateKey(Date.now());
                if (data.lastDailyNotification !== todayKey) {
                    notifDeletes[`notifications/${token}/lastDailyNotification`] = null;
                }
            }
        }
        if (Object.keys(notifDeletes).length > 0) {
            await db.ref().update(notifDeletes);
            console.log(`🗑️ Removed ${Object.keys(notifDeletes).length} stale notification records`);
        } else {
            console.log('✅ No stale notification records to remove');
        }

    } catch (error) {
        runStatus = 'error';
        errorCode = error?.code || 'daily-refresh/unknown';
        console.error('❌ Daily refresh failed:', error);
    } finally {
        await db.ref('ops/health/dailyDataRefresh').set({
            lastRunAt: runStartedAt,
            completedAt: Date.now(),
            durationMs: Date.now() - runStartedAt,
            status: runStatus,
            errorCode
        }).catch((healthError) => {
            console.error('Daily refresh health update failed:', healthError?.code || 'unknown');
        });
    }
});

module.exports = { dailyDataRefresh };
