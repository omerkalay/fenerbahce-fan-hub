import { describe, it, expect } from 'vitest';
import {
    createEmptyOptions,
    normalizeOptions,
    countEnabledOptions,
    countMatchOptions,
    MATCH_OPTION_KEYS,
} from './notificationHelpers';

describe('createEmptyOptions', () => {
    it('returns all false', () => {
        const opts = createEmptyOptions();
        expect(opts.generalNotifications).toBe(false);
        expect(opts.threeHours).toBe(false);
        expect(opts.oneHour).toBe(false);
        expect(opts.thirtyMinutes).toBe(false);
        expect(opts.fifteenMinutes).toBe(false);
        expect(opts.dailyCheck).toBe(false);
    });
});

describe('normalizeOptions', () => {
    it('fills missing keys with false', () => {
        const opts = normalizeOptions({ generalNotifications: true });
        expect(opts.generalNotifications).toBe(true);
        expect(opts.threeHours).toBe(false);
        expect(opts.dailyCheck).toBe(false);
    });

    it('handles undefined', () => {
        const opts = normalizeOptions();
        expect(opts.generalNotifications).toBe(false);
    });
});

describe('countEnabledOptions', () => {
    it('counts true values excluding updatedAt', () => {
        const opts = {
            generalNotifications: true,
            threeHours: true,
            oneHour: false,
            thirtyMinutes: false,
            fifteenMinutes: false,
            dailyCheck: true,
            updatedAt: 12345 as unknown as boolean,
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(countEnabledOptions(opts as any)).toBe(3);
    });

    it('returns 0 for all false', () => {
        expect(countEnabledOptions(createEmptyOptions())).toBe(0);
    });
});

describe('countMatchOptions', () => {
    it('counts only match-related options', () => {
        const opts = normalizeOptions({
            generalNotifications: true,
            threeHours: true,
            oneHour: true,
        });
        expect(countMatchOptions(opts)).toBe(2);
    });

    it('returns 0 when no match options are set', () => {
        const opts = normalizeOptions({ generalNotifications: true });
        expect(countMatchOptions(opts)).toBe(0);
    });
});

describe('countEnabledOptions — edge cases', () => {
    it('returns 6 when all options are true', () => {
        const opts = normalizeOptions({
            generalNotifications: true,
            threeHours: true,
            oneHour: true,
            thirtyMinutes: true,
            fifteenMinutes: true,
            dailyCheck: true,
        });
        expect(countEnabledOptions(opts)).toBe(6);
    });

    it('generalNotifications only → count 1', () => {
        expect(countEnabledOptions(normalizeOptions({ generalNotifications: true }))).toBe(1);
    });

    it('match reminders without generalNotifications', () => {
        const opts = normalizeOptions({
            generalNotifications: false,
            threeHours: true,
            oneHour: true,
            thirtyMinutes: true,
            fifteenMinutes: true,
            dailyCheck: true,
        });
        expect(countEnabledOptions(opts)).toBe(5);
    });
});

describe('normalizeOptions — edge cases', () => {
    it('preserves all true values', () => {
        const all = {
            generalNotifications: true,
            threeHours: true,
            oneHour: true,
            thirtyMinutes: true,
            fifteenMinutes: true,
            dailyCheck: true,
        };
        expect(normalizeOptions(all)).toEqual(all);
    });

    it('overrides only provided keys', () => {
        const opts = normalizeOptions({ dailyCheck: true, fifteenMinutes: true });
        expect(opts.dailyCheck).toBe(true);
        expect(opts.fifteenMinutes).toBe(true);
        expect(opts.generalNotifications).toBe(false);
        expect(opts.threeHours).toBe(false);
    });
});

describe('countMatchOptions — edge cases', () => {
    it('returns 5 when all match options enabled', () => {
        const opts = normalizeOptions({
            threeHours: true,
            oneHour: true,
            thirtyMinutes: true,
            fifteenMinutes: true,
            dailyCheck: true,
        });
        expect(countMatchOptions(opts)).toBe(5);
    });

    it('does not count generalNotifications', () => {
        const opts = normalizeOptions({
            generalNotifications: true,
            threeHours: false,
            oneHour: false,
            thirtyMinutes: false,
            fifteenMinutes: false,
            dailyCheck: false,
        });
        expect(countMatchOptions(opts)).toBe(0);
    });
});

describe('MATCH_OPTION_KEYS', () => {
    it('contains 5 entries', () => {
        expect(MATCH_OPTION_KEYS).toHaveLength(5);
    });

    it('does not include generalNotifications', () => {
        expect(MATCH_OPTION_KEYS).not.toContain('generalNotifications');
    });

    it('contains all expected keys', () => {
        expect(MATCH_OPTION_KEYS).toContain('threeHours');
        expect(MATCH_OPTION_KEYS).toContain('oneHour');
        expect(MATCH_OPTION_KEYS).toContain('thirtyMinutes');
        expect(MATCH_OPTION_KEYS).toContain('fifteenMinutes');
        expect(MATCH_OPTION_KEYS).toContain('dailyCheck');
    });
});
