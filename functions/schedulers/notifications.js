const { onSchedule } = require("firebase-functions/v2/scheduler");
const { admin, db, FENERBAHCE_ID, ISTANBUL_TIMEZONE, formatDateKey } = require('../config');

/**
 * Check Match Notifications - Her dakika çalışır
 * ARTIK API CALL YAPMIYOR! Cache'den okuyor.
 */
const checkMatchNotifications = onSchedule("every 1 minutes", async (event) => {
    try {
        const matchesSnapshot = await db.ref('cache/next3Matches').once('value');
        const nextMatches = matchesSnapshot.val();

        if (!nextMatches || !Array.isArray(nextMatches) || nextMatches.length === 0) {
            return;
        }

        const notifSnapshot = await db.ref('notifications').once('value');
        const allNotifications = notifSnapshot.val() || {};

        if (Object.keys(allNotifications).length === 0) {
            return;
        }

        const MATCH_CONFIG = {
            threeHours: { offsetMs: 3 * 60 * 60 * 1000, timeText: '3 saat kaldı' },
            oneHour: { offsetMs: 1 * 60 * 60 * 1000, timeText: '1 saat kaldı' },
            thirtyMinutes: { offsetMs: 30 * 60 * 1000, timeText: '30 dakika kaldı' },
            fifteenMinutes: { offsetMs: 15 * 60 * 1000, timeText: '15 dakika kaldı' }
        };

        const now = Date.now();
        const pendingNotifications = [];

        const istanbulParts = new Intl.DateTimeFormat('en-US', {
            timeZone: ISTANBUL_TIMEZONE,
            hour: 'numeric',
            minute: 'numeric',
            hour12: false
        }).formatToParts(new Date(now));
        const istanbulHour = parseInt(istanbulParts.find(p => p.type === 'hour').value);
        const istanbulMinute = parseInt(istanbulParts.find(p => p.type === 'minute').value);
        const isDailyCheckTime = istanbulHour === 9 && istanbulMinute <= 4;

        const toSentArray = (val) => {
            if (Array.isArray(val)) return val;
            if (val && typeof val === 'object') return Object.values(val);
            return [];
        };

        for (const [playerId, playerData] of Object.entries(allNotifications)) {
            if (playerData.dailyCheck && isDailyCheckTime) {
                const todayStr = formatDateKey(now);
                const nextMatch = nextMatches[0];
                const matchDate = new Date(nextMatch.startTimestamp * 1000);
                const matchDayStr = formatDateKey(matchDate.getTime());

                if (matchDayStr === todayStr) {
                    const lastDaily = playerData.lastDailyNotification;
                    if (!lastDaily || lastDaily !== todayStr) {
                        const isHome = nextMatch.homeTeam.id === FENERBAHCE_ID;
                        const opponent = isHome ? nextMatch.awayTeam.name : nextMatch.homeTeam.name;
                        const timeString = matchDate.toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: ISTANBUL_TIMEZONE
                        });

                        pendingNotifications.push({
                            playerId,
                            message: {
                                token: playerId,
                                notification: {
                                    title: '📅 Bugün Maç Var!',
                                    body: `💛💙 Fenerbahçe - ${opponent} | ${timeString}`
                                },
                                webpush: {
                                    fcmOptions: { link: 'https://omerkalay.com/fenerbahce-fan-hub/' }
                                }
                            },
                            successUpdates: {
                                [`notifications/${playerId}/lastDailyNotification`]: todayStr
                            }
                        });
                    }
                }
            }

            if (!playerData.defaultOptions) continue;

            const defaultOpts = playerData.defaultOptions;
            const sentNotificationsMap = playerData.sentNotifications || {};

            for (const match of nextMatches) {
                const matchId = String(match.id);
                const matchTime = match.startTimestamp * 1000;
                const sentForMatch = toSentArray(sentNotificationsMap[matchId]);

                for (const [optionKey, config] of Object.entries(MATCH_CONFIG)) {
                    if (!defaultOpts[optionKey]) continue;
                    if (sentForMatch.includes(optionKey)) continue;

                    const triggerTime = matchTime - config.offsetMs;
                    const triggerWindowEnd = triggerTime + (5 * 60 * 1000);

                    if (now >= triggerTime && now < triggerWindowEnd) {
                        const isHome = match.homeTeam.id === FENERBAHCE_ID;
                        const opponent = isHome ? match.awayTeam.name : match.homeTeam.name;
                        const timeString = new Date(matchTime).toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: ISTANBUL_TIMEZONE
                        });

                        const sentPath = `notifications/${playerId}/sentNotifications/${matchId}`;
                        pendingNotifications.push({
                            playerId,
                            matchId,
                            message: {
                                token: playerId,
                                notification: {
                                    title: `💛💙 Fenerbahçe - ${opponent}`,
                                    body: `${timeString} · ${config.timeText}`
                                },
                                data: {
                                    matchId: matchId,
                                    type: optionKey
                                },
                                webpush: {
                                    fcmOptions: { link: 'https://omerkalay.com/fenerbahce-fan-hub/' }
                                }
                            },
                            sentPath,
                            optionKey,
                            baseSentList: sentForMatch
                        });
                    }
                }
            }
        }

        if (pendingNotifications.length === 0) {
            return;
        }

        console.log(`🔔 Sending ${pendingNotifications.length} notifications...`);
        const results = await Promise.allSettled(
            pendingNotifications.map(item => admin.messaging().send(item.message))
        );
        const success = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        console.log(`✅ Sent: ${success}, ❌ Failed: ${failed}`);

        const updates = {};
        const invalidTokenDeletes = {};
        const sentAccumulator = {};

        results.forEach((result, index) => {
            const item = pendingNotifications[index];
            if (result.status === 'fulfilled') {
                if (item.successUpdates) {
                    Object.assign(updates, item.successUpdates);
                }
                if (item.sentPath && item.optionKey) {
                    if (!sentAccumulator[item.sentPath]) {
                        sentAccumulator[item.sentPath] = [...item.baseSentList];
                    }
                    sentAccumulator[item.sentPath].push(item.optionKey);
                }
                return;
            }

            const errorCode = result.reason?.code || result.reason?.errorInfo?.code;
            if (errorCode === 'messaging/registration-token-not-registered' || errorCode === 'messaging/invalid-registration-token') {
                invalidTokenDeletes[`notifications/${item.playerId}`] = null;
                console.log(`🧹 Removing invalid token: ${item.playerId.slice(0, 10)}...`);
            }
        });

        for (const [sentPath, sentList] of Object.entries(sentAccumulator)) {
            updates[sentPath] = sentList;
        }

        for (const deletePath of Object.keys(invalidTokenDeletes)) {
            for (const updatePath of Object.keys(updates)) {
                if (updatePath === deletePath || updatePath.startsWith(`${deletePath}/`)) {
                    delete updates[updatePath];
                }
            }
        }

        const dbUpdates = { ...updates, ...invalidTokenDeletes };
        if (Object.keys(dbUpdates).length > 0) {
            await db.ref().update(dbUpdates);
        }

    } catch (error) {
        console.error('❌ Notification check failed:', error);
    }
});

module.exports = { checkMatchNotifications };
