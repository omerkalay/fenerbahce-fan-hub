import { describe, expect, it } from 'vitest';
import { isLiveMatchForScheduledMatch, matchTeamNames, normalizeMatchTeamName } from './matchIdentity';
import type { LiveMatchData, MatchData } from '../types';

const scheduledMatch: MatchData = {
    id: 100,
    startTimestamp: 1_787_086_800,
    homeTeam: { id: 3052, name: 'Fenerbahçe' },
    awayTeam: { id: 200, name: 'Olympique Lyonnais' },
    tournament: { name: 'UEFA Champions League' }
};

describe('frontend match identity', () => {
    it('normalizes punctuation and provider spelling differences', () => {
        expect(normalizeMatchTeamName('Fenerbahçe S.K.')).toBe('fenerbahce');
        expect(matchTeamNames('Olympique Lyonnais', 'Lyon')).toBe(true);
    });

    it('rejects stale final data from another opponent', () => {
        const staleMatch: LiveMatchData = {
            matchState: 'post',
            homeTeam: { name: 'Fenerbahce', score: '2' },
            awayTeam: { name: 'Genclerbirligi', score: '1' }
        };

        expect(isLiveMatchForScheduledMatch(staleMatch, scheduledMatch)).toBe(false);
    });

    it('accepts the matching live event across providers', () => {
        const liveMatch: LiveMatchData = {
            matchState: 'in',
            startTimestamp: 1_787_086_800,
            homeTeam: { name: 'Fenerbahce', score: '1' },
            awayTeam: { name: 'Lyon', score: '1' }
        };

        expect(isLiveMatchForScheduledMatch(liveMatch, scheduledMatch)).toBe(true);
    });
});
