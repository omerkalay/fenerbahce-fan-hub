const { onSchedule } = require("firebase-functions/v2/scheduler");
const { admin, db } = require('../config');

/**
 * Reconcile pending topic syncs - 5 dakikada bir
 * topicSync/allFans.pending=true olan kullanicilari bulup retry eder.
 */
const reconcileTopicSync = onSchedule(
    { schedule: "every 5 minutes", maxInstances: 1 },
    async () => {
        try {
            const snapshot = await db.ref('notifications').once('value');
            const allNotifications = snapshot.val() || {};

            const pending = [];
            for (const [userId, data] of Object.entries(allNotifications)) {
                if (data.topicSync?.allFans?.pending) {
                    pending.push({ userId, data });
                }
            }

            if (pending.length > 0) {
            console.log(`Reconciling ${pending.length} pending topic sync(s)...`);
            }

            for (const { userId, data } of pending) {
                const { desired, token } = data.topicSync.allFans;
                const syncPath = `notifications/${userId}/topicSync/allFans`;

                if (!token) {
                    if (!desired) {
                        // No token + unsubscribe = effectively synced
                        await db.ref(syncPath).update({
                            pending: false,
                            lastAttemptAt: Date.now(),
                            lastSyncedAt: Date.now(),
                            lastError: null
                        });
                    } else {
                        await db.ref(syncPath).update({
                            lastAttemptAt: Date.now(),
                            lastError: 'no token available'
                        });
                    }
                    continue;
                }

                try {
                    const result = desired
                        ? await admin.messaging().subscribeToTopic(token, 'all_fans')
                        : await admin.messaging().unsubscribeFromTopic(token, 'all_fans');

                    if (result.failureCount > 0) {
                        const reasons = result.errors?.map(e => e.error?.message || e.error?.code).join(', ') || 'unknown';
                        await db.ref(syncPath).update({
                            lastAttemptAt: Date.now(),
                            lastError: reasons
                        });
                    } else {
                        await db.ref(syncPath).update({
                            pending: false,
                            lastAttemptAt: Date.now(),
                            lastSyncedAt: Date.now(),
                            lastError: null
                        });
                        // Clean up deferred old token now that new subscribe is confirmed
                        const oldCleanupToken = data.topicSync.allFans.oldTokenToCleanup;
                        if (oldCleanupToken) {
                            try {
                                const oldResult = await admin.messaging().unsubscribeFromTopic(oldCleanupToken, 'all_fans');
                                if (oldResult.failureCount > 0) {
                                    console.warn(`Old token cleanup partial failure for ${userId.slice(0, 8)}:`, oldResult.errors);
                                } else {
                                    await db.ref(`${syncPath}/oldTokenToCleanup`).set(null);
                                }
                            } catch (cleanupErr) {
                                console.error(`Old token cleanup failed for ${userId.slice(0, 8)}:`, cleanupErr.message);
                            }
                        }
                    }
                } catch (syncErr) {
                    await db.ref(syncPath).update({
                        lastAttemptAt: Date.now(),
                        lastError: syncErr.message || 'unknown error'
                    });
                    console.error(`Topic sync failed for ${userId.slice(0, 8)}:`, syncErr.message);
                }
            }

            // Straggler cleanup: old tokens where sync already resolved but cleanup didn't complete
            for (const [userId, data] of Object.entries(allNotifications)) {
                const allFans = data.topicSync?.allFans;
                if (allFans && !allFans.pending && allFans.oldTokenToCleanup) {
                    const syncPath = `notifications/${userId}/topicSync/allFans`;
                    try {
                        const oldResult = await admin.messaging().unsubscribeFromTopic(allFans.oldTokenToCleanup, 'all_fans');
                        if (oldResult.failureCount > 0) {
                            console.warn(`Old token straggler cleanup partial failure for ${userId.slice(0, 8)}:`, oldResult.errors);
                        } else {
                            await db.ref(`${syncPath}/oldTokenToCleanup`).set(null);
                        }
                    } catch (cleanupErr) {
                        console.error(`Old token cleanup failed for ${userId.slice(0, 8)}:`, cleanupErr.message);
                    }
                }
            }
        } catch (error) {
            console.error('Topic sync reconcile failed:', error);
        }
    }
);

module.exports = { reconcileTopicSync };
