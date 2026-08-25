import { describe, it, expect } from 'vitest';
import {
    isHalftimeDisplay,
    resolveGoalTeamId,
    formatGoalSummaryText
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
