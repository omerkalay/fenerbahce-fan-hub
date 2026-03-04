const { onSchedule } = require("firebase-functions/v2/scheduler");
const { db, rapidApiKey, rapidApiHost, sleep, formatDateKey } = require('../config');
const { fetchNextMatches, fetchSquad } = require('../services/sofascore');

/**
 * Daily Data Refresh - Günde 1 kez çalışır
 * SofaScore ve ESPN'den veri çeker, Firebase'e cache'ler
 * 03:00 UTC = 06:00 TR
 */
const dailyDataRefresh = onSchedule({
    schedule: "0 3 * * *",
    secrets: [rapidApiKey, rapidApiHost]
}, async (event) => {
    console.log('⏰ Daily data refresh started (03:00 UTC = 06:00 TR)');

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

        // 1. Fetch matches from SofaScore
        console.log('1️⃣ Fetching matches from SofaScore...');
        try {
            const events = await fetchNextMatches();
            if (events.length > 0) {
                cache.nextMatch = events[0];
                cache.next3Matches = events.slice(0, 3);
                console.log(`✅ Fetched ${events.length} matches`);
            }
        } catch (error) {
            console.error(`❌ Match fetch failed: ${error.message}`);
        }

        await sleep(2000); // Rate limit protection

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
        await db.ref('cache').set(cache);
        console.log(`✨ Cache updated at ${new Date().toISOString()}`);

        // 5. Eski poll verilerini temizle
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
            console.log(`🗑️ Silinen eski poll: ${Object.keys(deleteOps).length}`);
        } else {
            console.log('✅ Temizlenecek eski poll yok');
        }

        // 6. Eski sentNotifications kayıtlarını temizle
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
            console.log(`🗑️ Silinen eski notification kayıtları: ${Object.keys(notifDeletes).length}`);
        } else {
            console.log('✅ Temizlenecek eski notification kaydı yok');
        }

    } catch (error) {
        console.error('❌ Daily refresh failed:', error);
    }
});

module.exports = { dailyDataRefresh };
