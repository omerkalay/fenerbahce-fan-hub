const { onSchedule } = require("firebase-functions/v2/scheduler");
const { admin, db } = require('../config');

const isTerminalTokenCode = (code) =>
    code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered';

const readTopicSyncWork = async (database) => {
    const notificationsRef = database.ref('notifications');
    const [pendingSnapshot, cleanupSnapshot] = await Promise.all([
        notificationsRef
            .orderByChild('topicSync/allFans/pending')
            .equalTo(true)
            .once('value'),
        notificationsRef
            .orderByChild('topicSync/allFans/oldTokenToCleanup')
            .startAt('')
            .once('value')
    ]);

    const workByUser = new Map();
    for (const snapshot of [pendingSnapshot, cleanupSnapshot]) {
        for (const [userId, data] of Object.entries(snapshot.val() || {})) {
            workByUser.set(userId, data);
        }
    }
    return Array.from(workByUser, ([userId, data]) => ({ userId, data }));
};

const clearOldTopicToken = async ({ database, messaging, userId, syncPath, oldToken }) => {
    if (!oldToken) return;

    try {
        const oldResult = await messaging.unsubscribeFromTopic(oldToken, 'all_fans');
        if (oldResult.failureCount > 0) {
            const code = oldResult.errors?.[0]?.error?.code;
            if (!isTerminalTokenCode(code)) {
                console.warn(`Old token cleanup partial failure for ${userId.slice(0, 8)}...`, oldResult.errors);
                return;
            }
            console.info(`Old token expired, cleanup cleared for ${userId.slice(0, 8)}...`);
        }
        await database.ref(`${syncPath}/oldTokenToCleanup`).set(null);
    } catch (cleanupErr) {
        const code = cleanupErr.code || cleanupErr.errorInfo?.code;
        if (isTerminalTokenCode(code)) {
            console.info(`Old token expired, cleanup cleared for ${userId.slice(0, 8)}...`);
            await database.ref(`${syncPath}/oldTokenToCleanup`).set(null);
            return;
        }
        console.error(`Old token cleanup failed for ${userId.slice(0, 8)}...`, cleanupErr.message);
    }
};

const createTopicSyncReconciler = ({
    database = db,
    messaging = admin.messaging(),
    now = () => Date.now()
} = {}) => async () => {
    try {
        const work = await readTopicSyncWork(database);
        if (work.length > 0) {
            console.log(`[topicSync] reconciling users=${work.length}`);
        }

        for (const { userId, data } of work) {
            const allFans = data.topicSync?.allFans;
            if (!allFans) continue;

            const syncPath = `notifications/${userId}/topicSync/allFans`;
            let primarySyncReady = !allFans.pending;

            if (allFans.pending) {
                const { desired, token } = allFans;

                if (!token) {
                    if (!desired) {
                        await database.ref(syncPath).update({
                            pending: false,
                            lastAttemptAt: now(),
                            lastSyncedAt: now(),
                            lastError: null
                        });
                        primarySyncReady = true;
                    } else {
                        await database.ref(syncPath).update({
                            lastAttemptAt: now(),
                            lastError: 'no token available'
                        });
                    }
                } else {
                    try {
                        const result = desired
                            ? await messaging.subscribeToTopic(token, 'all_fans')
                            : await messaging.unsubscribeFromTopic(token, 'all_fans');

                        if (result.failureCount > 0) {
                            const reasons = result.errors
                                ?.map((entry) => entry.error?.message || entry.error?.code)
                                .join(', ') || 'unknown';
                            await database.ref(syncPath).update({
                                lastAttemptAt: now(),
                                lastError: reasons
                            });
                        } else {
                            await database.ref(syncPath).update({
                                pending: false,
                                lastAttemptAt: now(),
                                lastSyncedAt: now(),
                                lastError: null
                            });
                            primarySyncReady = true;
                        }
                    } catch (syncErr) {
                        await database.ref(syncPath).update({
                            lastAttemptAt: now(),
                            lastError: syncErr.message || 'unknown error'
                        });
                        console.error(`Topic sync failed for ${userId.slice(0, 8)}...`, syncErr.message);
                    }
                }
            }

            if (primarySyncReady && allFans.oldTokenToCleanup) {
                await clearOldTopicToken({
                    database,
                    messaging,
                    userId,
                    syncPath,
                    oldToken: allFans.oldTokenToCleanup
                });
            }
        }
    } catch (error) {
        console.error('Topic sync reconcile failed:', error);
    }
};

const runTopicSyncReconciler = createTopicSyncReconciler();

const reconcileTopicSync = onSchedule(
    { schedule: "every 5 minutes", maxInstances: 1 },
    runTopicSyncReconciler
);

module.exports = {
    reconcileTopicSync,
    createTopicSyncReconciler,
    readTopicSyncWork
};
