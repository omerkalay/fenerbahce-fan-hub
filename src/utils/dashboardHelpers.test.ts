import { describe, it, expect } from 'vitest';
import {
    isHalftimeDisplay,
    resolveGoalTeamId,
    formatGoalSummaryText,
    normalizeStartingXIPlayer,
    normalizeStartingXIArray,
    normalizeStartingXIData
} from './dashboardHelpers';
import type { MatchEvent } from '../types';

describe('isHalftimeDisplay', () => {
    it('returns true for "HT" status', () => {
        expect(isHalftimeDisplay('HT')).toBe(true);
    });

    it('returns true for "halftime" status', () => {
        expect(isHalftimeDisplay('halftime')).toBe(true);
    });

    it('returns true for "Half Time" status', () => {
        expect(isHalftimeDisplay('Half Time')).toBe(true);
    });

    it('returns true for "devre arası" status', () => {
        expect(isHalftimeDisplay('Devre Arası')).toBe(true);
    });

    it('returns true when clock is "HT"', () => {
        expect(isHalftimeDisplay('', 'HT')).toBe(true);
    });

    it('returns false for normal status', () => {
        expect(isHalftimeDisplay("45'", "45'")).toBe(false);
    });

    it('handles undefined/empty inputs', () => {
        expect(isHalftimeDisplay()).toBe(false);
        expect(isHalftimeDisplay('', '')).toBe(false);
    });
});

describe('resolveGoalTeamId', () => {
    it('returns team as string', () => {
        expect(resolveGoalTeamId({ team: '123', player: '', clock: '' })).toBe('123');
    });

    it('returns empty string when team is missing', () => {
        expect(resolveGoalTeamId({ player: 'test', clock: '' })).toBe('');
    });
});

describe('formatGoalSummaryText', () => {
    it('returns player name for normal goal', () => {
        const event: MatchEvent = { player: 'Dzeko', clock: "10'" };
        expect(formatGoalSummaryText(event)).toBe('Dzeko');
    });

    it('adds (P) for penalty', () => {
        const event: MatchEvent = { player: 'Dzeko', isPenalty: true, clock: '' };
        expect(formatGoalSummaryText(event)).toBe('Dzeko (P)');
    });

    it('adds (K.K) for own goal', () => {
        const event: MatchEvent = { player: 'Opponent', isOwnGoal: true, clock: '' };
        expect(formatGoalSummaryText(event)).toBe('Opponent (K.K)');
    });

    it('adds both markers', () => {
        const event: MatchEvent = { player: 'Player', isPenalty: true, isOwnGoal: true, clock: '' };
        expect(formatGoalSummaryText(event)).toBe('Player (P) (K.K)');
    });

    it('defaults to "Gol" when player name is empty', () => {
        const event: MatchEvent = { player: '', clock: '' };
        expect(formatGoalSummaryText(event)).toBe('Gol');
    });
});

describe('normalizeStartingXIPlayer', () => {
    it('returns valid player', () => {
        const result = normalizeStartingXIPlayer({ name: 'Test Player', number: 10, group: 'MID' });
        expect(result).toEqual({ name: 'Test Player', number: 10, group: 'MID' });
    });

    it('returns null for missing name', () => {
        expect(normalizeStartingXIPlayer({ name: '', number: 1, group: 'GK' })).toBeNull();
    });

    it('returns null for invalid number', () => {
        expect(normalizeStartingXIPlayer({ name: 'Player', number: 'abc', group: 'DEF' })).toBeNull();
    });

    it('returns null for invalid group', () => {
        expect(normalizeStartingXIPlayer({ name: 'Player', number: 5, group: 'INVALID' })).toBeNull();
    });

    it('returns null for null/undefined input', () => {
        expect(normalizeStartingXIPlayer(null)).toBeNull();
        expect(normalizeStartingXIPlayer(undefined)).toBeNull();
    });

    it('normalizes group to uppercase', () => {
        const result = normalizeStartingXIPlayer({ name: 'Player', number: 7, group: 'fwd' });
        expect(result?.group).toBe('FWD');
    });

    it('trims name', () => {
        const result = normalizeStartingXIPlayer({ name: '  Player  ', number: 3, group: 'DEF' });
        expect(result?.name).toBe('Player');
    });

    it('converts string number to numeric', () => {
        const result = normalizeStartingXIPlayer({ name: 'Player', number: '99', group: 'GK' });
        expect(result?.number).toBe(99);
    });
});

describe('normalizeStartingXIArray', () => {
    it('normalizes a valid array', () => {
        const input = [
            { name: 'GK Player', number: 1, group: 'GK' },
            { name: 'DEF Player', number: 3, group: 'DEF' },
        ];
        const result = normalizeStartingXIArray(input);
        expect(result).toHaveLength(2);
    });

    it('filters out invalid entries', () => {
        const input = [
            { name: 'Valid', number: 1, group: 'GK' },
            null,
            { name: '', number: 5, group: 'DEF' },
        ];
        const result = normalizeStartingXIArray(input);
        expect(result).toHaveLength(1);
    });

    it('handles object values (Firebase RTDB style)', () => {
        const input = {
            '0': { name: 'Player A', number: 1, group: 'GK' },
            '1': { name: 'Player B', number: 2, group: 'DEF' },
        };
        const result = normalizeStartingXIArray(input);
        expect(result).toHaveLength(2);
    });

    it('returns empty array for non-iterable input', () => {
        expect(normalizeStartingXIArray(42)).toHaveLength(0);
        expect(normalizeStartingXIArray(null)).toHaveLength(0);
    });
});

describe('normalizeStartingXIData', () => {
    it('returns valid StartingXIData', () => {
        const input = {
            publishedAt: 1700000000,
            starters: [{ name: 'Player', number: 1, group: 'GK' }],
            bench: [{ name: 'Sub', number: 12, group: 'DEF' }],
        };
        const result = normalizeStartingXIData(input);
        expect(result).not.toBeNull();
        expect(result!.starters).toHaveLength(1);
        expect(result!.bench).toHaveLength(1);
        expect(result!.publishedAt).toBe(1700000000);
    });

    it('returns null when starters are empty', () => {
        const input = { publishedAt: 123, starters: [] };
        expect(normalizeStartingXIData(input)).toBeNull();
    });

    it('returns null for null/undefined input', () => {
        expect(normalizeStartingXIData(null)).toBeNull();
        expect(normalizeStartingXIData(undefined)).toBeNull();
    });

    it('defaults publishedAt to Date.now() when invalid', () => {
        const input = {
            publishedAt: 'invalid',
            starters: [{ name: 'Player', number: 1, group: 'GK' }],
        };
        const result = normalizeStartingXIData(input);
        expect(result).not.toBeNull();
        expect(typeof result!.publishedAt).toBe('number');
        expect(result!.publishedAt).toBeGreaterThan(0);
    });
});
