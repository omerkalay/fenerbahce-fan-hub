import { describe, it, expect } from 'vitest';
import {
    buildNotificationOptions,
    countActiveOptions,
    isDisablingAll,
    hasPathTraversal,
    shouldCleanupOldToken,
    canCleanupOldTokenNow,
    buildSavedOptions
} from './notificationLogic.js';

// ─── buildNotificationOptions ────────────────────────────

describe('buildNotificationOptions', () => {
    it('defaults generalNotifications to true when not explicitly false', () => {
        expect(buildNotificationOptions({}).generalNotifications).toBe(true);
        expect(buildNotificationOptions({ generalNotifications: undefined }).generalNotifications).toBe(true);
        expect(buildNotificationOptions({ generalNotifications: null }).generalNotifications).toBe(true);
    });

    it('sets generalNotifications false only when data.generalNotifications === false', () => {
        expect(buildNotificationOptions({ generalNotifications: false }).generalNotifications).toBe(false);
    });

    it('reads reminder times from nested defaultOptions', () => {
        const data = {
            defaultOptions: { threeHours: true, oneHour: true, thirtyMinutes: false, fifteenMinutes: false }
        };
        const opts = buildNotificationOptions(data);
        expect(opts.threeHours).toBe(true);
        expect(opts.oneHour).toBe(true);
        expect(opts.thirtyMinutes).toBe(false);
        expect(opts.fifteenMinutes).toBe(false);
    });

    it('reads dailyCheck from top-level data', () => {
        expect(buildNotificationOptions({ dailyCheck: true }).dailyCheck).toBe(true);
        expect(buildNotificationOptions({ dailyCheck: false }).dailyCheck).toBe(false);
        expect(buildNotificationOptions({}).dailyCheck).toBe(false);
    });

    it('preserves updatedAt from defaultOptions', () => {
        const ts = 1700000000000;
        expect(buildNotificationOptions({ defaultOptions: { updatedAt: ts } }).updatedAt).toBe(ts);
    });

    it('defaults updatedAt to null when missing', () => {
        expect(buildNotificationOptions({}).updatedAt).toBeNull();
        expect(buildNotificationOptions({ defaultOptions: {} }).updatedAt).toBeNull();
    });

    it('handles empty/undefined input', () => {
        const opts = buildNotificationOptions();
        expect(opts.generalNotifications).toBe(true);
        expect(opts.threeHours).toBe(false);
        expect(opts.dailyCheck).toBe(false);
        expect(opts.updatedAt).toBeNull();
    });

    it('coerces truthy non-boolean defaultOptions values', () => {
        const data = { defaultOptions: { threeHours: 1, oneHour: 'yes' } };
        const opts = buildNotificationOptions(data);
        expect(opts.threeHours).toBe(true);
        expect(opts.oneHour).toBe(true);
    });

    it('full enabled state', () => {
        const data = {
            generalNotifications: true,
            dailyCheck: true,
            defaultOptions: {
                threeHours: true,
                oneHour: true,
                thirtyMinutes: true,
                fifteenMinutes: true,
                updatedAt: 123
            }
        };
        const opts = buildNotificationOptions(data);
        expect(opts).toEqual({
            generalNotifications: true,
            threeHours: true,
            oneHour: true,
            thirtyMinutes: true,
            fifteenMinutes: true,
            dailyCheck: true,
            updatedAt: 123
        });
    });
});

// ─── countActiveOptions ──────────────────────────────────

describe('countActiveOptions', () => {
    it('counts only true boolean values', () => {
        expect(countActiveOptions({ generalNotifications: true, threeHours: true, oneHour: false })).toBe(2);
    });

    it('excludes updatedAt even if truthy', () => {
        expect(countActiveOptions({ generalNotifications: true, updatedAt: 12345 })).toBe(1);
    });

    it('returns 0 for all false', () => {
        expect(countActiveOptions({
            generalNotifications: false,
            threeHours: false,
            oneHour: false,
            thirtyMinutes: false,
            fifteenMinutes: false,
            dailyCheck: false
        })).toBe(0);
    });

    it('returns 6 for all enabled', () => {
        expect(countActiveOptions({
            generalNotifications: true,
            threeHours: true,
            oneHour: true,
            thirtyMinutes: true,
            fifteenMinutes: true,
            dailyCheck: true
        })).toBe(6);
    });

    it('handles empty/undefined input', () => {
        expect(countActiveOptions()).toBe(0);
        expect(countActiveOptions({})).toBe(0);
    });

    it('ignores non-boolean truthy values (e.g. string, number)', () => {
        // Only value === true counts, not truthy
        expect(countActiveOptions({ generalNotifications: 1 })).toBe(0);
        expect(countActiveOptions({ generalNotifications: 'yes' })).toBe(0);
    });
});

// ─── isDisablingAll ──────────────────────────────────────

describe('isDisablingAll', () => {
    it('returns true when all options are falsy', () => {
        expect(isDisablingAll({
            generalNotifications: false,
            dailyCheck: false,
            threeHours: false,
            oneHour: false,
            thirtyMinutes: false,
            fifteenMinutes: false
        })).toBe(true);
    });

    it('returns true when all options are missing/undefined', () => {
        expect(isDisablingAll({})).toBe(true);
    });

    it('returns false when only generalNotifications is true', () => {
        expect(isDisablingAll({ generalNotifications: true })).toBe(false);
    });

    it('returns false when only dailyCheck is true', () => {
        expect(isDisablingAll({ dailyCheck: true })).toBe(false);
    });

    it('returns false when only threeHours is true', () => {
        expect(isDisablingAll({ threeHours: true })).toBe(false);
    });

    it('returns false when only oneHour is true', () => {
        expect(isDisablingAll({ oneHour: true })).toBe(false);
    });

    it('returns false when only thirtyMinutes is true', () => {
        expect(isDisablingAll({ thirtyMinutes: true })).toBe(false);
    });

    it('returns false when only fifteenMinutes is true', () => {
        expect(isDisablingAll({ fifteenMinutes: true })).toBe(false);
    });

    it('generalNotifications on + all match options off is NOT disabling all', () => {
        expect(isDisablingAll({
            generalNotifications: true,
            dailyCheck: false,
            threeHours: false,
            oneHour: false,
            thirtyMinutes: false,
            fifteenMinutes: false
        })).toBe(false);
    });

    it('match options on + generalNotifications off is NOT disabling all', () => {
        expect(isDisablingAll({
            generalNotifications: false,
            threeHours: true,
            oneHour: true
        })).toBe(false);
    });
});

// ─── hasPathTraversal ────────────────────────────────────

describe('hasPathTraversal', () => {
    it('detects slash in string', () => {
        expect(hasPathTraversal('abc/def')).toBe(true);
        expect(hasPathTraversal('../etc/passwd')).toBe(true);
    });

    it('returns false for clean token', () => {
        expect(hasPathTraversal('abc123def')).toBe(false);
    });

    it('returns false for non-string values', () => {
        expect(hasPathTraversal(null)).toBe(false);
        expect(hasPathTraversal(undefined)).toBe(false);
        expect(hasPathTraversal(123)).toBe(false);
        expect(hasPathTraversal(true)).toBe(false);
    });

    it('returns false for empty string', () => {
        expect(hasPathTraversal('')).toBe(false);
    });
});

// ─── shouldCleanupOldToken ───────────────────────────────

describe('shouldCleanupOldToken', () => {
    it('returns true when old token exists and differs from both fcm and uid', () => {
        expect(shouldCleanupOldToken({
            oldFcmToken: 'old-tok',
            fcmToken: 'new-tok',
            authenticatedUid: 'uid-123'
        })).toBe(true);
    });

    it('returns false when oldFcmToken is null/undefined', () => {
        expect(shouldCleanupOldToken({ oldFcmToken: null, fcmToken: 'x', authenticatedUid: 'y' })).toBe(false);
        expect(shouldCleanupOldToken({ oldFcmToken: undefined, fcmToken: 'x', authenticatedUid: 'y' })).toBe(false);
    });

    it('returns false when oldFcmToken equals fcmToken', () => {
        expect(shouldCleanupOldToken({
            oldFcmToken: 'same',
            fcmToken: 'same',
            authenticatedUid: 'uid'
        })).toBe(false);
    });

    it('returns false when oldFcmToken equals authenticatedUid', () => {
        expect(shouldCleanupOldToken({
            oldFcmToken: 'uid-123',
            fcmToken: 'new-tok',
            authenticatedUid: 'uid-123'
        })).toBe(false);
    });

    it('returns false for empty string oldFcmToken', () => {
        expect(shouldCleanupOldToken({
            oldFcmToken: '',
            fcmToken: 'new',
            authenticatedUid: 'uid'
        })).toBe(false);
    });
});

// ─── canCleanupOldTokenNow ───────────────────────────────

describe('canCleanupOldTokenNow', () => {
    it('safe: sync confirmed (not pending)', () => {
        expect(canCleanupOldTokenNow({ topicSyncPending: false, desiredTopicState: true })).toBe(true);
    });

    it('safe: unsubscribing (desired=false), even if pending', () => {
        expect(canCleanupOldTokenNow({ topicSyncPending: true, desiredTopicState: false })).toBe(true);
    });

    it('safe: both false', () => {
        expect(canCleanupOldTokenNow({ topicSyncPending: false, desiredTopicState: false })).toBe(true);
    });

    it('defer: pending + subscribing (would create coverage gap)', () => {
        expect(canCleanupOldTokenNow({ topicSyncPending: true, desiredTopicState: true })).toBe(false);
    });
});

// ─── buildSavedOptions ───────────────────────────────────

describe('buildSavedOptions', () => {
    it('normalizes all option flags to booleans', () => {
        const opts = buildSavedOptions({
            generalNotifications: 1,
            threeHours: 'yes',
            oneHour: null,
            thirtyMinutes: undefined,
            fifteenMinutes: 0,
            dailyCheck: true
        }, 999);
        expect(opts).toEqual({
            generalNotifications: true,
            threeHours: true,
            oneHour: false,
            thirtyMinutes: false,
            fifteenMinutes: false,
            dailyCheck: true,
            updatedAt: 999
        });
    });

    it('carries updatedAt through', () => {
        const ts = Date.now();
        const opts = buildSavedOptions({}, ts);
        expect(opts.updatedAt).toBe(ts);
    });

    it('all false options', () => {
        const opts = buildSavedOptions({
            generalNotifications: false,
            threeHours: false,
            oneHour: false,
            thirtyMinutes: false,
            fifteenMinutes: false,
            dailyCheck: false
        }, null);
        expect(countActiveOptions(opts)).toBe(0);
    });

    it('all true options', () => {
        const opts = buildSavedOptions({
            generalNotifications: true,
            threeHours: true,
            oneHour: true,
            thirtyMinutes: true,
            fifteenMinutes: true,
            dailyCheck: true
        }, 1);
        expect(countActiveOptions(opts)).toBe(6);
    });
});

// ─── Cross-function integration contracts ────────────────

describe('notification decision contracts', () => {
    it('disabling all → no fcmToken required (token can be absent)', () => {
        const options = {
            generalNotifications: false,
            dailyCheck: false,
            threeHours: false,
            oneHour: false,
            thirtyMinutes: false,
            fifteenMinutes: false
        };
        expect(isDisablingAll(options)).toBe(true);
        // handler allows missing token when disabling all
    });

    it('enabling any single option → fcmToken required', () => {
        const combos = [
            { generalNotifications: true },
            { dailyCheck: true },
            { threeHours: true },
            { oneHour: true },
            { thirtyMinutes: true },
            { fifteenMinutes: true }
        ];
        for (const opts of combos) {
            expect(isDisablingAll(opts)).toBe(false);
        }
    });

    it('buildNotificationOptions + countActiveOptions consistency', () => {
        // Full DB data → should count correctly
        const data = {
            generalNotifications: true,
            dailyCheck: true,
            defaultOptions: { threeHours: true, oneHour: false, thirtyMinutes: true, fifteenMinutes: false }
        };
        const opts = buildNotificationOptions(data);
        expect(countActiveOptions(opts)).toBe(4); // general, daily, 3h, 30m
    });

    it('generalNotifications only (topic subscription, no match reminders)', () => {
        const data = { generalNotifications: true };
        const opts = buildNotificationOptions(data);
        expect(opts.generalNotifications).toBe(true);
        expect(opts.threeHours).toBe(false);
        expect(opts.oneHour).toBe(false);
        expect(opts.thirtyMinutes).toBe(false);
        expect(opts.fifteenMinutes).toBe(false);
        expect(opts.dailyCheck).toBe(false);
        expect(countActiveOptions(opts)).toBe(1);
    });

    it('match reminders without generalNotifications', () => {
        const data = {
            generalNotifications: false,
            dailyCheck: true,
            defaultOptions: { threeHours: true, oneHour: true }
        };
        const opts = buildNotificationOptions(data);
        expect(opts.generalNotifications).toBe(false);
        expect(countActiveOptions(opts)).toBe(3); // daily, 3h, 1h
        expect(isDisablingAll(opts)).toBe(false);
    });

    it('old token cleanup deferred when new subscribe is still pending', () => {
        const hasOld = shouldCleanupOldToken({
            oldFcmToken: 'old', fcmToken: 'new', authenticatedUid: 'uid'
        });
        expect(hasOld).toBe(true);

        // Subscribe still pending → defer
        expect(canCleanupOldTokenNow({ topicSyncPending: true, desiredTopicState: true })).toBe(false);
    });

    it('old token cleanup proceeds when unsubscribing even if pending', () => {
        expect(canCleanupOldTokenNow({ topicSyncPending: true, desiredTopicState: false })).toBe(true);
    });
});
