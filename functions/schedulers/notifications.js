const { onSchedule } = require("firebase-functions/v2/scheduler");
const { admin, db, ISTANBUL_TIMEZONE } = require('../config');
const { buildNotificationSchedule } = require('../utils/notificationSchedule');
const { PRIMARY_REGION, US_ROLLBACK_REGION } = require('../regions');

/**
 * Checks cached match notification windows every minute without calling a sports API.
 */
const runCheckMatchNotifications = async (_event) => {
    const schedulerStartedAt = Date.now();
    let healthStatus = 'ok';
    let healthErrorCode = null;
    try {
        const matchesSnapshot = await db.ref('cache/next3Matches').once('value');
        const nextMatches = matchesSnapshot.val();

        if (!nextMatches || !Array.isArray(nextMatches) || nextMatches.length === 0) {
            return;
        }

        const now = Date.now();
        const schedule = buildNotificationSchedule(nextMatches, now, ISTANBUL_TIMEZONE);
        if (!schedule.shouldReadNotifications) {
            return;
        }

        const notifSnapshot = await db.ref('notifications').once('value');
        const allNotifications = notifSnapshot.val() || {};

        const userCount = Object.keys(allNotifications).length;
        if (userCount === 0) {
            return;
        }

        const maxDelayMs = schedule.matchWindows.reduce(
            (maximum, window) => Math.max(maximum, window.delayMs),
            0
        );
        console.log(
            `[notifications] due daily=${Boolean(schedule.dailyMatch)} matchWindows=${schedule.matchWindows.length} ` +
            `users=${userCount} maxDelayMs=${maxDelayMs}`
        );

        const pendingNotificationsMap = new Map();

        const toSentArray = (val) => {
            if (Array.isArray(val)) return val;
            if (val && typeof val === 'object') return Object.values(val);
            return [];
        };

        const queueNotification = (key, payload) => {
            if (!pendingNotificationsMap.has(key)) {
                pendingNotificationsMap.set(key, {
                    token: payload.token,
                    message: payload.message,
                    successUpdates: {},
                    sentTargets: [],
                    userIds: new Set()
                });
            }

            const entry = pendingNotificationsMap.get(key);
            entry.userIds.add(payload.userId);

            if (payload.successUpdates) {
                Object.assign(entry.successUpdates, payload.successUpdates);
            }

            if (payload.sentPath && payload.optionKey) {
                entry.sentTargets.push({
                    sentPath: payload.sentPath,
                    optionKey: payload.optionKey,
                    baseSentList: payload.baseSentList
                });
            }
        };

        for (const [userId, playerData] of Object.entries(allNotifications)) {
            const token = playerData.fcmToken;
            if (!token) {
                console.log(`Skipping ${userId.slice(0, 8)}... (no valid fcmToken)`);
                continue;
            }

            if (playerData.dailyCheck && schedule.dailyMatch) {
                const todayStr = schedule.todayKey;
                const nextMatch = schedule.dailyMatch;
                const matchDate = new Date(nextMatch.startTimestamp * 1000);
                const lastDaily = playerData.lastDailyNotification;
                if (!lastDaily || lastDaily !== todayStr) {
                    const timeString = matchDate.toLocaleTimeString('tr-TR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: ISTANBUL_TIMEZONE
                    });

                    queueNotification(`daily:${token}:${todayStr}`, {
                        userId,
                        token,
                        message: {
                            token,
                            data: {
                                title: '📅 Bugün Maç Var!',
                                body: `💛💙 ${nextMatch.homeTeam.name} - ${nextMatch.awayTeam.name} | ${timeString}`,
                                url: 'https://omerkalay.com/fenerbahce-fan-hub/'
                            }
                        },
                        successUpdates: {
                            [`notifications/${userId}/lastDailyNotification`]: todayStr
                        }
                    });
                }
            }

            if (!playerData.defaultOptions) continue;

            const defaultOpts = playerData.defaultOptions;
            const sentNotificationsMap = playerData.sentNotifications || {};

            for (const window of schedule.matchWindows) {
                const { match, matchId, matchTime, optionKey, timeText } = window;
                const sentForMatch = toSentArray(sentNotificationsMap[matchId]);
                if (!defaultOpts[optionKey]) continue;
                if (sentForMatch.includes(optionKey)) continue;

                const timeString = new Date(matchTime).toLocaleTimeString('tr-TR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: ISTANBUL_TIMEZONE
                });

                const sentPath = `notifications/${userId}/sentNotifications/${matchId}`;
                queueNotification(`${matchId}:${optionKey}:${token}`, {
                    userId,
                    token,
                    message: {
                        token,
                        data: {
                            title: `💛💙 ${match.homeTeam.name} - ${match.awayTeam.name}`,
                            body: `${timeString} · ${timeText}`,
                            matchId: matchId,
                            type: optionKey,
                            url: 'https://omerkalay.com/fenerbahce-fan-hub/'
                        }
                    },
                    sentPath,
                    optionKey,
                    baseSentList: sentForMatch
                });
            }
        }

        const pendingNotifications = Array.from(pendingNotificationsMap.values());
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
                Object.assign(updates, item.successUpdates);

                for (const target of item.sentTargets) {
                    if (!sentAccumulator[target.sentPath]) {
                        sentAccumulator[target.sentPath] = [...target.baseSentList];
                    }
                    if (!sentAccumulator[target.sentPath].includes(target.optionKey)) {
                        sentAccumulator[target.sentPath].push(target.optionKey);
                    }
                }
                return;
            }

            const errorCode = result.reason?.code || result.reason?.errorInfo?.code;
            if (errorCode === 'messaging/registration-token-not-registered' || errorCode === 'messaging/invalid-registration-token') {
                item.userIds.forEach((userId) => {
                    invalidTokenDeletes[`notifications/${userId}/fcmToken`] = null;
                    invalidTokenDeletes[`notifications/${userId}/tokenInvalidAt`] = Date.now();
                    invalidTokenDeletes[`notifications/${userId}/tokenInvalidCode`] = errorCode;
                });
                console.log(`🧹 Marking invalid token: ${item.token.slice(0, 10)}...`);
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

        console.log(
            `[notifications] complete queued=${pendingNotifications.length} sent=${success} failed=${failed} ` +
            `durationMs=${Date.now() - schedulerStartedAt}`
        );

    } catch (error) {
        console.error('❌ Notification check failed:', error);
        healthStatus = 'error';
        healthErrorCode = error?.code || 'notifications/unknown';
    } finally {
        await db.ref('ops/health/notificationScheduler').set({
            lastRunAt: schedulerStartedAt,
            completedAt: Date.now(),
            durationMs: Date.now() - schedulerStartedAt,
            status: healthStatus,
            errorCode: healthErrorCode
        }).catch((healthError) => {
            console.error('Notification health update failed:', healthError?.code || 'unknown');
        });
    }
};

const checkMatchNotificationsOptions = {
    schedule: "every 1 minutes",
    maxInstances: 1
};

const checkMatchNotifications = onSchedule({
    ...checkMatchNotificationsOptions,
    region: US_ROLLBACK_REGION
}, runCheckMatchNotifications);

const checkMatchNotificationsEurope = onSchedule({
    ...checkMatchNotificationsOptions,
    region: PRIMARY_REGION
}, runCheckMatchNotifications);

module.exports = {
    checkMatchNotifications,
    checkMatchNotificationsEurope,
    runCheckMatchNotifications
};
