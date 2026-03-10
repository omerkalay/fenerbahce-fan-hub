import { describe, it, expect } from 'vitest';
import {
    normalizeEventFlags,
    normalizeSummaryEvents,
    parseSummaryKeyEvent,
    pickOrderedSummaryStats
} from './espn-helpers.js';

// Inline config constant — no Firebase dependency needed
const SUMMARY_STAT_GROUPS = [
    { label: 'Toplam Şut', keys: ['totalShots'] },
    { label: 'İsabetli Şut', keys: ['shotsOnTarget'] },
    { label: 'Topla Oynama %', keys: ['possessionPct', 'possession'] },
    { label: 'Korner', keys: ['wonCorners', 'corners'] },
    { label: 'Faul', keys: ['foulsCommitted', 'fouls'] },
    { label: 'Sarı Kart', keys: ['yellowCards', 'yellowCard'] },
    { label: 'Kırmızı Kart', keys: ['redCards', 'redCard'] }
];

describe('normalizeEventFlags', () => {
    it('returns boolean flags for all event types', () => {
        const result = normalizeEventFlags({ isGoal: 1, isPenalty: 0, isOwnGoal: '', isYellowCard: true, isRedCard: false, isSubstitution: undefined });
        expect(result.isGoal).toBe(true);
        expect(result.isPenalty).toBe(false);
        expect(result.isOwnGoal).toBe(false);
        expect(result.isYellowCard).toBe(false); // Goal trumps yellow
        expect(result.isRedCard).toBe(false); // Goal trumps red
        expect(result.isSubstitution).toBe(false);
    });

    it('clears yellow card when red card is present', () => {
        const result = normalizeEventFlags({ isRedCard: true, isYellowCard: true });
        expect(result.isRedCard).toBe(true);
        expect(result.isYellowCard).toBe(false);
    });

    it('handles empty / default input', () => {
        const result = normalizeEventFlags();
        expect(result.isGoal).toBe(false);
        expect(result.isYellowCard).toBe(false);
    });

    it('preserves extra fields', () => {
        const result = normalizeEventFlags({ clock: "45'", player: 'Test', isGoal: true });
        expect(result.clock).toBe("45'");
        expect(result.player).toBe('Test');
    });
});

describe('normalizeSummaryEvents', () => {
    it('filters to goals and cards only, excluding substitutions', () => {
        const events = [
            { isGoal: true, player: 'A', clock: '10' },
            { isSubstitution: true, player: 'B', clock: '60' },
            { isYellowCard: true, player: 'C', clock: '30' },
            { isRedCard: true, player: 'D', clock: '80' },
            { player: 'E', clock: '50' },
        ];
        const result = normalizeSummaryEvents(events);
        expect(result).toHaveLength(3);
        expect(result[0].player).toBe('A');
        expect(result[1].player).toBe('C');
        expect(result[2].player).toBe('D');
    });

    it('returns empty array for empty input', () => {
        expect(normalizeSummaryEvents([])).toHaveLength(0);
        expect(normalizeSummaryEvents()).toHaveLength(0);
    });

    it('normalizes team to string', () => {
        const events = [{ isGoal: true, team: 123 }];
        const result = normalizeSummaryEvents(events);
        expect(result[0].team).toBe('123');
    });
});

describe('parseSummaryKeyEvent', () => {
    it('returns null for substitution events', () => {
        expect(parseSummaryKeyEvent({ type: { type: 'substitution' } })).toBeNull();
    });

    it('parses a goal event', () => {
        const item = {
            scoringPlay: true,
            type: { type: 'goal', text: 'Goal' },
            clock: { displayValue: "23'" },
            team: { id: '100' },
            participants: [{ athlete: { displayName: 'Player A' } }],
        };
        const result = parseSummaryKeyEvent(item);
        expect(result).not.toBeNull();
        expect(result.isGoal).toBe(true);
        expect(result.player).toBe('Player A');
        expect(result.team).toBe('100');
        expect(result.clock).toBe("23'");
    });

    it('parses a yellow card event', () => {
        const item = {
            type: { type: 'yellow-card', text: 'Yellow Card' },
            clock: { displayValue: "45'" },
            team: { id: '200' },
            participants: [{ athlete: { displayName: 'Player B' } }],
        };
        const result = parseSummaryKeyEvent(item);
        expect(result.isYellowCard).toBe(true);
        expect(result.isGoal).toBe(false);
    });

    it('parses a red card event', () => {
        const item = {
            type: { type: 'red-card', text: 'Red Card' },
            clock: { displayValue: "70'" },
            team: { id: '300' },
            participants: [{ athlete: { displayName: 'Player C' } }],
        };
        const result = parseSummaryKeyEvent(item);
        expect(result.isRedCard).toBe(true);
    });

    it('returns null for non-matching event type', () => {
        const item = {
            type: { type: 'other', text: 'Something Else' },
            participants: [],
        };
        expect(parseSummaryKeyEvent(item)).toBeNull();
    });

    it('identifies own goal correctly', () => {
        const item = {
            scoringPlay: true,
            ownGoal: true,
            type: { type: 'goal', text: 'Own Goal' },
            clock: { displayValue: "55'" },
            team: { id: '100' },
            participants: [{ athlete: { displayName: 'Unlucky Player' } }],
        };
        const result = parseSummaryKeyEvent(item);
        expect(result.isGoal).toBe(true);
        expect(result.isOwnGoal).toBe(true);
        expect(result.assist).toBe('');
    });

    it('extracts assist from participants', () => {
        const item = {
            scoringPlay: true,
            type: { type: 'goal', text: 'Goal' },
            clock: { displayValue: "30'" },
            team: { id: '100' },
            participants: [
                { athlete: { displayName: 'Scorer' } },
                { athlete: { displayName: 'Assister' } },
            ],
        };
        const result = parseSummaryKeyEvent(item);
        expect(result.isGoal).toBe(true);
        expect(result.assist).toBe('Assister');
    });
});

describe('pickOrderedSummaryStats', () => {
    it('picks stats in config order', () => {
        const homeMap = new Map([['totalShots', '10'], ['possessionPct', '55%']]);
        const awayMap = new Map([['totalShots', '8'], ['possessionPct', '45%']]);
        const result = pickOrderedSummaryStats(homeMap, awayMap, SUMMARY_STAT_GROUPS);
        expect(result).toHaveLength(2);
        expect(result[0].label).toBe('Toplam Şut');
        expect(result[1].label).toBe('Topla Oynama %');
    });

    it('returns empty when no stats match', () => {
        const homeMap = new Map([['unknownStat', '1']]);
        const awayMap = new Map();
        const result = pickOrderedSummaryStats(homeMap, awayMap, SUMMARY_STAT_GROUPS);
        expect(result).toHaveLength(0);
    });
});
