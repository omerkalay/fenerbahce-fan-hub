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

describe('MATCH_OPTION_KEYS', () => {
    it('contains 5 entries', () => {
        expect(MATCH_OPTION_KEYS).toHaveLength(5);
    });

    it('does not include generalNotifications', () => {
        expect(MATCH_OPTION_KEYS).not.toContain('generalNotifications');
    });
});
