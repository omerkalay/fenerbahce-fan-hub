/**
 * Pure notification decision helpers — no side effects, no Firebase.
 * Extracted from api.js for testability.
 */

const buildNotificationOptions = (data = {}) => ({
    generalNotifications: data.generalNotifications !== false,
    threeHours: !!data.defaultOptions?.threeHours,
    oneHour: !!data.defaultOptions?.oneHour,
    thirtyMinutes: !!data.defaultOptions?.thirtyMinutes,
    fifteenMinutes: !!data.defaultOptions?.fifteenMinutes,
    dailyCheck: !!data.dailyCheck,
    updatedAt: data.defaultOptions?.updatedAt || null
});

const countActiveOptions = (options = {}) => (
    Object.entries(options).filter(([key, value]) => key !== 'updatedAt' && value === true).length
);

const isDisablingAll = (options) => (
    !options.generalNotifications && !options.dailyCheck &&
    !options.threeHours && !options.oneHour && !options.thirtyMinutes && !options.fifteenMinutes
);

const hasPathTraversal = (v) => typeof v === 'string' && v.includes('/');

/**
 * Determines whether an old token should be cleaned up from topics.
 * Returns true when the old token exists and differs from both
 * the current token and the authenticated UID.
 */
const shouldCleanupOldToken = ({ oldFcmToken, fcmToken, authenticatedUid }) => (
    !!oldFcmToken && oldFcmToken !== fcmToken && oldFcmToken !== authenticatedUid
);

/**
 * Determines whether it is safe to immediately unsubscribe the old token
 * from topics (vs deferring to a reconciler).
 *
 * Safe when: new token sync is confirmed (!topicSyncPending)
 *         OR the user is unsubscribing anyway (!desiredTopicState).
 */
const canCleanupOldTokenNow = ({ topicSyncPending, desiredTopicState }) => (
    !topicSyncPending || !desiredTopicState
);

/**
 * Builds the savedOptions object for the reminder response.
 */
const buildSavedOptions = (options, updatedAt) => ({
    generalNotifications: !!options.generalNotifications,
    threeHours: !!options.threeHours,
    oneHour: !!options.oneHour,
    thirtyMinutes: !!options.thirtyMinutes,
    fifteenMinutes: !!options.fifteenMinutes,
    dailyCheck: !!options.dailyCheck,
    updatedAt
});

module.exports = {
    buildNotificationOptions,
    countActiveOptions,
    isDisablingAll,
    hasPathTraversal,
    shouldCleanupOldToken,
    canCleanupOldTokenNow,
    buildSavedOptions
};
