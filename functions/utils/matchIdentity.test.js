import { describe, expect, it } from 'vitest';
import matchIdentity from './matchIdentity.js';

const { normalizeTeamName, teamNamesMatch, isSameMatch } = matchIdentity;

describe('matchIdentity', () => {
    it('normalizes provider-specific punctuation and Turkish characters', () => {
        expect(normalizeTeamName('Fenerbahçe S.K.')).toBe('fenerbahce');
        expect(teamNamesMatch('Fenerbahçe', 'Fenerbahce SK')).toBe(true);
    });

    it('accepts common long and short club names', () => {
        expect(teamNamesMatch('Olympique Lyonnais', 'Lyon')).toBe(true);
        expect(teamNamesMatch('SL Benfica', 'Benfica')).toBe(true);
    });

    it('rejects a previous match with a different opponent', () => {
        const scheduledMatch = {
            startTimestamp: 1_787_086_800,
            homeTeam: { name: 'Fenerbahçe' },
            awayTeam: { name: 'Olympique Lyonnais' }
        };
        const previousMatch = {
            startTimestamp: 1_786_482_000,
            homeTeam: { name: 'Fenerbahce' },
            awayTeam: { name: 'Genclerbirligi' }
        };

        expect(isSameMatch(previousMatch, scheduledMatch)).toBe(false);
    });

    it('accepts the same cross-provider match within the kickoff tolerance', () => {
        const scheduledMatch = {
            startTimestamp: 1_787_086_800,
            homeTeam: { name: 'Fenerbahçe' },
            awayTeam: { name: 'Olympique Lyonnais' }
        };
        const liveMatch = {
            startTimestamp: 1_787_086_800,
            homeTeam: { name: 'Fenerbahce' },
            awayTeam: { name: 'Lyon' }
        };

        expect(isSameMatch(liveMatch, scheduledMatch)).toBe(true);
    });

    it('rejects matching team names from a different date', () => {
        const scheduledMatch = {
            startTimestamp: 1_787_086_800,
            homeTeam: { name: 'Fenerbahçe' },
            awayTeam: { name: 'Olympique Lyonnais' }
        };
        const oldMatch = {
            startTimestamp: 1_779_310_800,
            homeTeam: { name: 'Fenerbahce' },
            awayTeam: { name: 'Lyon' }
        };

        expect(isSameMatch(oldMatch, scheduledMatch)).toBe(false);
    });
});
