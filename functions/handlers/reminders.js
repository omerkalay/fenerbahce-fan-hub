const { admin, db } = require('../config');
const { requireAuthenticatedUid } = require('./middleware');
const {
    buildNotificationOptions,
    countActiveOptions,
    isDisablingAll,
    hasPathTraversal,
    shouldCleanupOldToken,
    canCleanupOldTokenNow,
    buildSavedOptions
} = require('./notificationLogic');

async function handleReminder(req, res) {
    const authenticatedUid = await requireAuthenticatedUid(req, res);
    if (!authenticatedUid) {
        return;
    }

    const { uid, fcmToken, oldFcmToken, options } = req.body || {};

    if (uid && uid !== authenticatedUid) {
        return res.status(403).json({ error: 'UID mismatch' });
    }

    if (!options) {
        return res.status(400).json({ error: 'Missing options' });
    }

    if (!fcmToken && !isDisablingAll(options)) {
        return res.status(400).json({ error: 'Missing fcmToken' });
    }

    if (hasPathTraversal(fcmToken) || hasPathTraversal(oldFcmToken)) {
        return res.status(400).json({ error: 'Invalid token format' });
    }

    try {
        const currentSnapshot = await db.ref(`notifications/${authenticatedUid}`).once('value');
        const currentData = currentSnapshot.val() || {};

        const basePath = `notifications/${authenticatedUid}`;
        const rootUpdates = {};

        if (fcmToken) {
            rootUpdates[`${basePath}/fcmToken`] = fcmToken;
            rootUpdates[`${basePath}/tokenInvalidAt`] = null;
            rootUpdates[`${basePath}/tokenInvalidCode`] = null;
        }

        rootUpdates[`${basePath}/dailyCheck`] = !!options.dailyCheck;
        rootUpdates[`${basePath}/defaultOptions/threeHours`] = !!options.threeHours;
        rootUpdates[`${basePath}/defaultOptions/oneHour`] = !!options.oneHour;
        rootUpdates[`${basePath}/defaultOptions/thirtyMinutes`] = !!options.thirtyMinutes;
        rootUpdates[`${basePath}/defaultOptions/fifteenMinutes`] = !!options.fifteenMinutes;
        rootUpdates[`${basePath}/defaultOptions/updatedAt`] = Date.now();
        rootUpdates[`${basePath}/generalNotifications`] = !!options.generalNotifications;

        if (currentData.matches) {
            rootUpdates[`${basePath}/matches`] = null;
        }

        // Legacy migration: token-keyed -> uid-keyed
        if (fcmToken && authenticatedUid !== fcmToken) {
            const legacySnapshot = await db.ref(`notifications/${fcmToken}`).once('value');
            const legacyData = legacySnapshot.val();
            if (legacyData && typeof legacyData === 'object') {
                if (legacyData.sentNotifications && !currentData.sentNotifications) {
                    rootUpdates[`${basePath}/sentNotifications`] = legacyData.sentNotifications;
                }
                if (legacyData.lastDailyNotification && !currentData.lastDailyNotification) {
                    rootUpdates[`${basePath}/lastDailyNotification`] = legacyData.lastDailyNotification;
                }
                rootUpdates[`notifications/${fcmToken}`] = null;
            }
        }

        if (oldFcmToken && oldFcmToken !== fcmToken && oldFcmToken !== authenticatedUid) {
            rootUpdates[`notifications/${oldFcmToken}`] = null;
        }

        // DB-first: include topic sync pending state in the atomic write
        const topicToken = fcmToken || currentData.fcmToken;
        const desiredTopicState = !!options.generalNotifications;
        rootUpdates[`${basePath}/topicSync/allFans/pending`] = true;
        rootUpdates[`${basePath}/topicSync/allFans/desired`] = desiredTopicState;
        rootUpdates[`${basePath}/topicSync/allFans/token`] = topicToken || null;
        rootUpdates[`${basePath}/topicSync/allFans/lastAttemptAt`] = null;
        rootUpdates[`${basePath}/topicSync/allFans/lastError`] = null;

        await db.ref().update(rootUpdates);

        // Attempt topic sync after DB commit
        let topicSyncPending = true;
        if (topicToken) {
            try {
                const topicResult = desiredTopicState
                    ? await admin.messaging().subscribeToTopic(topicToken, 'all_fans')
                    : await admin.messaging().unsubscribeFromTopic(topicToken, 'all_fans');
                if (topicResult.failureCount > 0) {
                    const reasons = topicResult.errors?.map(e => e.error?.message || e.error?.code).join(', ') || 'unknown';
                    await db.ref(`${basePath}/topicSync/allFans`).update({
                        lastAttemptAt: Date.now(),
                        lastError: reasons
                    });
                } else {
                    await db.ref(`${basePath}/topicSync/allFans`).update({
                        pending: false,
                        lastAttemptAt: Date.now(),
                        lastSyncedAt: Date.now(),
                        lastError: null
                    });
                    topicSyncPending = false;
                }
            } catch (topicErr) {
                await db.ref(`${basePath}/topicSync/allFans`).update({
                    lastAttemptAt: Date.now(),
                    lastError: topicErr.message || 'unknown error'
                });
            }
        } else if (!desiredTopicState) {
            // No token + unsubscribe desired = effectively synced
            await db.ref(`${basePath}/topicSync/allFans`).update({
                pending: false,
                lastAttemptAt: Date.now(),
                lastSyncedAt: Date.now(),
                lastError: null
            });
            topicSyncPending = false;
        }

        // Old token topic cleanup: defer if current subscribe is pending to avoid coverage gap
        const hasOldToken = shouldCleanupOldToken({ oldFcmToken, fcmToken, authenticatedUid });
        if (hasOldToken) {
            if (canCleanupOldTokenNow({ topicSyncPending, desiredTopicState })) {
                // Safe: new token confirmed, or unsubscribing anyway
                try {
                    const oldResult = await admin.messaging().unsubscribeFromTopic(oldFcmToken, 'all_fans');
                    if (oldResult.failureCount > 0) {
                        const code = oldResult.errors?.[0]?.error?.code;
                        if (code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered') {
                            console.info(`Old token expired, cleanup skipped: ${oldFcmToken.slice(0, 10)}...`);
                        } else {
                            console.warn('Old token topic unsubscribe partial failure:', oldResult.errors);
                            await db.ref(`${basePath}/topicSync/allFans/oldTokenToCleanup`).set(oldFcmToken);
                        }
                    }
                } catch (oldTopicErr) {
                    const code = oldTopicErr.code || oldTopicErr.errorInfo?.code;
                    if (code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered') {
                        console.info(`Old token expired, cleanup skipped: ${oldFcmToken.slice(0, 10)}...`);
                    } else {
                        console.error('Old token topic unsubscribe failed:', oldTopicErr);
                        await db.ref(`${basePath}/topicSync/allFans/oldTokenToCleanup`).set(oldFcmToken);
                    }
                }
            } else {
                // Defer: reconciler will clean up after current sync succeeds
                await db.ref(`${basePath}/topicSync/allFans/oldTokenToCleanup`).set(oldFcmToken);
            }
        }

        const savedOptions = buildSavedOptions(options, rootUpdates[`${basePath}/defaultOptions/updatedAt`]);
        const activeCount = countActiveOptions(savedOptions);

        return res.json({
            success: true,
            message: topicSyncPending ? 'Preferences saved, topic sync pending' : 'Preferences saved',
            topicSyncPending,
            dailyCheckActive: savedOptions.dailyCheck,
            activeNotifications: activeCount,
            options: savedOptions
        });

    } catch (error) {
        console.error('Reminder save error:', error);
        return res.status(500).json({ error: 'Failed to save preferences' });
    }
}

async function handleReminderPreferences(req, res) {
    const authenticatedUid = await requireAuthenticatedUid(req, res);
    if (!authenticatedUid) {
        return;
    }

    try {
        const snapshot = await db.ref(`notifications/${authenticatedUid}`).once('value');
        const data = snapshot.val();
        if (!data) {
            return res.status(404).json({ error: 'Preferences not found' });
        }

        const options = buildNotificationOptions(data);
        return res.json({
            uid: authenticatedUid,
            fcmToken: data.fcmToken || null,
            activeNotifications: countActiveOptions(options),
            topicSyncPending: !!data.topicSync?.allFans?.pending,
            options
        });
    } catch (error) {
        console.error('Reminder fetch error:', error);
        return res.status(500).json({ error: 'Failed to fetch preferences' });
    }
}

module.exports = { handleReminder, handleReminderPreferences };
