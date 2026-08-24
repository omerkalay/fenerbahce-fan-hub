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
 * Trust an old token only when it matches the token already stored for the
 * authenticated user and the request is rotating to a different new token.
 * Client-provided token values must never identify another RTDB record.
 */
const resolveTrustedOldToken = ({ oldFcmToken, fcmToken, storedFcmToken }) => {
    if (!oldFcmToken || !fcmToken || !storedFcmToken) return null;
    if (oldFcmToken === fcmToken) return null;
    return oldFcmToken === storedFcmToken ? oldFcmToken : null;
};

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
    resolveTrustedOldToken,
    canCleanupOldTokenNow,
    buildSavedOptions
};
