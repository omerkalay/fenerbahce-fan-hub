
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const fetch = require("node-fetch"); // Use node-fetch for compatibility
require('dotenv').config(); // Load .env for local testing

try {
    admin.initializeApp();
    console.log('✅ Firebase Admin initialized');
} catch (e) {
    console.error('❌ Firebase Admin initialization failed:', e);
}

const FENERBAHCE_ID = 3052;
const API_KEY = process.env.RAPIDAPI_KEY;
const API_HOST = process.env.RAPIDAPI_HOST;

if (!API_KEY) console.warn('⚠️ WARNING: RAPIDAPI_KEY is missing in environment!');

const MATCH_NOTIFICATION_CONFIG = {
    threeHours: {
        offsetMs: 3 * 60 * 60 * 1000,
        timeText: '3 saat kaldı',
        badge: '⏳ 3 Saat'
    },
    oneHour: {
        offsetMs: 1 * 60 * 60 * 1000,
        timeText: '1 saat kaldı',
        badge: '⌛️ 1 Saat'
    },
    thirtyMinutes: {
        offsetMs: 30 * 60 * 1000,
        timeText: '30 dakika kaldı',
        badge: '🕒 30dk'
    },
    fifteenMinutes: {
        offsetMs: 15 * 60 * 1000,
        timeText: '15 dakika kaldı',
        badge: '⚡️ 15dk'
    }
};

// Core logic shared between Scheduler and HTTP trigger
async function checkMatches() {
    console.log('🔍 Running checkMatches logic...');

    try {
        // node-fetch is now used, no need to check for global fetch

        // 1. Fetch Next Match Data
        console.log('1️⃣ Fetching next match data...');
        const headers = {
            'x-rapidapi-key': API_KEY,
            'x-rapidapi-host': API_HOST
        };

        if (!API_KEY) {
            throw new Error('API_KEY is missing');
        }

        const response = await fetch(`https://${API_HOST}/teams/get-next-matches?teamId=${FENERBAHCE_ID}`, { headers });
        if (!response.ok) {
            throw new Error(`API call failed with status: ${response.status} ${response.statusText}`);
        }

        const matchData = await response.json();
        console.log('✅ Match data fetched successfully');

        if (!matchData.events || matchData.events.length === 0) {
            console.log('ℹ️ No upcoming matches found');
            return;
        }

        // Get next 3 matches to check against
        const nextMatches = matchData.events.slice(0, 3);
        const now = Date.now();
        const db = admin.database();

        // 2. Read User Preferences
        console.log('2️⃣ Reading user preferences from DB...');
        const snapshot = await db.ref('notifications').once('value');
        const allNotifications = snapshot.val() || {};
        console.log(`✅ Found preferences for ${Object.keys(allNotifications).length} users`);

        const notificationsToSend = [];
        const updates = {};

        // 3. Check each user's preferences
        console.log('3️⃣ Checking preferences...');
        for (const [playerId, playerData] of Object.entries(allNotifications)) {
            if (!playerData.matches) continue;

            for (const [matchId, matchOptions] of Object.entries(playerData.matches)) {
                // Find corresponding match in fetched data
                const match = nextMatches.find(m => String(m.id) === String(matchId));

                if (!match) {
                    // Match might be old or not in next 3, skip for now (or clean up)
                    continue;
                }

                const matchTime = match.startTimestamp * 1000;
                const sentNotifications = matchOptions.sentNotifications || [];

                // Check each time option
                for (const [optionKey, config] of Object.entries(MATCH_NOTIFICATION_CONFIG)) {
                    if (!matchOptions[optionKey]) continue; // User didn't select this option
                    if (sentNotifications.includes(optionKey)) continue; // Already sent

                    const triggerTime = matchTime - config.offsetMs;

                    // Check if it's time to send (within last 2 minutes to be safe)
                    if (now >= triggerTime && now < matchTime) {
                        // Prepare notification
                        const isHome = match.homeTeam.id === FENERBAHCE_ID;
                        const opponent = isHome ? match.awayTeam.name : match.homeTeam.name;
                        const matchDate = new Date(matchTime);
                        // Adjust to TR time (UTC+3) roughly for display string
                        const timeString = matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });

                        const title = `💛💙 Fenerbahçe - ${opponent}`;
                        const body = `${timeString} · ${config.timeText}`;

                        notificationsToSend.push({
                            token: playerId,
                            notification: {
                                title: title,
                                body: body
                            },
                            data: {
                                matchId: String(match.id),
                                type: optionKey,
                                url: 'https://omerkalay.com/fenerbahce-fan-hub/'
                            },
                            webpush: {
                                fcmOptions: {
                                    link: 'https://omerkalay.com/fenerbahce-fan-hub/'
                                }
                            }
                        });

                        // Mark as sent in DB update
                        const sentPath = `notifications/${playerId}/matches/${matchId}/sentNotifications`;
                        const newSentList = [...sentNotifications, optionKey];
                        updates[sentPath] = newSentList;

                        console.log(`🔔 Queuing ${optionKey} notification for user ${playerId.substring(0, 10)}...`);
                    }
                }
            }
        }

        // 4. Send Notifications (Batch)
        if (notificationsToSend.length > 0) {
            console.log(`🚀 Sending ${notificationsToSend.length} notifications...`);

            // Send individually (sendAll is deprecated or complex for mixed payloads, loop is fine for this scale)
            const promises = notificationsToSend.map(msg => admin.messaging().send(msg));
            const results = await Promise.allSettled(promises);

            const successCount = results.filter(r => r.status === 'fulfilled').length;
            const failCount = results.filter(r => r.status === 'rejected').length;

            console.log(`✅ Sent: ${successCount}, ❌ Failed: ${failCount}`);
        } else {
            console.log('ℹ️ No notifications to send at this time');
        }

        // 5. Update Database (Mark as sent)
        if (Object.keys(updates).length > 0) {
            await db.ref().update(updates);
            console.log('💾 Database updated with sent status');
        }

    } catch (error) {
        console.error('❌ CRITICAL ERROR in checkMatches:', error);
        // We catch the error so the function doesn't crash the process, but we log it clearly
    }
}

// Scheduled function (Production)
exports.checkMatchNotificationsV2 = onSchedule("every 1 minutes", async (event) => {
    console.log('⏰ Cloud Function triggered: checkMatchNotificationsV2');
    await checkMatches();
});
