import { describe, expect, it } from 'vitest';
import {
    formatSeasonLabel,
    getCurrentSeasonStartYear,
    getRecentSeasonOptions,
    isDateInSeason,
    isHistoricalSeason
} from './seasons';

describe('season helpers', () => {
    const referenceDate = new Date('2026-07-12T12:00:00Z');

    it('uses July as the start of a football season', () => {
        expect(getCurrentSeasonStartYear(new Date('2026-06-30T12:00:00Z'))).toBe(2025);
        expect(getCurrentSeasonStartYear(referenceDate)).toBe(2026);
    });

    it('formats and lists recent seasons', () => {
        expect(formatSeasonLabel(2025)).toBe('2025/26');
        expect(getRecentSeasonOptions(referenceDate, 2)).toEqual([
            { startYear: 2026, label: '2026/27', badge: 'Güncel' },
            { startYear: 2025, label: '2025/26', badge: undefined }
        ]);
    });

    it('identifies historical seasons', () => {
        expect(isHistoricalSeason(2025, referenceDate)).toBe(true);
        expect(isHistoricalSeason(2026, referenceDate)).toBe(false);
    });

    it('keeps only matches inside the selected season window', () => {
        expect(isDateInSeason('2025-07-01T00:00:00Z', 2025)).toBe(true);
        expect(isDateInSeason('2026-06-30T23:59:59Z', 2025)).toBe(true);
        expect(isDateInSeason('2026-07-01T00:00:00Z', 2025)).toBe(false);
        expect(isDateInSeason('invalid-date', 2025)).toBe(false);
    });
});
