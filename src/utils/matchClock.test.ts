import { describe, it, expect } from 'vitest';
import { formatMatchClock } from './matchClock';

describe('formatMatchClock', () => {
    it('formats regular minute with quote', () => {
        expect(formatMatchClock("45'")).toBe("45'");
    });

    it('formats bare number as minute', () => {
        expect(formatMatchClock('45')).toBe("45'");
    });

    it('formats stoppage time', () => {
        expect(formatMatchClock("90+5")).toBe("90+5'");
        expect(formatMatchClock("90'+5'")).toBe("90+5'");
        expect(formatMatchClock("45+2")).toBe("45+2'");
    });

    it('normalizes unicode prime to ASCII quote', () => {
        expect(formatMatchClock('90\u2032')).toBe("90'");
    });

    it('strips whitespace', () => {
        expect(formatMatchClock('  45  ')).toBe("45'");
        expect(formatMatchClock(" 90 + 3 ")).toBe("90+3'");
    });

    it('returns empty string for empty/undefined input', () => {
        expect(formatMatchClock('')).toBe('');
        expect(formatMatchClock()).toBe('');
    });

    it('returns non-matching input as-is (normalized)', () => {
        expect(formatMatchClock('HT')).toBe('HT');
        expect(formatMatchClock('FT')).toBe('FT');
    });
});
