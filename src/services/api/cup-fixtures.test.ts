import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MatchData } from '../../types';
import { fetchCupFixtures, normalizeCupFixtureMatch } from './cup-fixtures';

const cupMatch: MatchData = {
    id: 987,
    startTimestamp: Date.UTC(2026, 11, 16, 17, 30) / 1000,
    timeValid: true,
    winnerCode: 1,
    homeTeam: { id: 3052, name: 'Fenerbahce', shortName: 'Fenerbahce', nameCode: 'FEN' },
    awayTeam: { id: 999, name: 'Besiktas', shortName: 'Besiktas', nameCode: 'BES' },
    homeScore: { current: 2 },
    awayScore: { current: 1 },
    tournament: { name: 'Türkiye Kupası', uniqueTournament: { id: 96, name: 'Türkiye Kupası' } },
    roundInfo: { round: 5 },
    status: { code: 100, type: 'finished', description: 'Ended' }
};

describe('Türkiye Kupası fixture normalization', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('maps a SofaScore event to the common fixture model', () => {
        expect(normalizeCupFixtureMatch(cupMatch)).toMatchObject({
            id: '987',
            source: 'sofascore',
            summaryAvailable: false,
            competitionGroup: 'cup',
            competitionLabel: 'Türkiye Kupası',
            roundLabel: '5. Tur',
            status: { state: 'post', completed: true },
            homeTeam: { id: '3052', name: 'Fenerbahçe', score: '2', winner: true },
            awayTeam: { id: '999', name: 'Beşiktaş', score: '1', winner: false },
            resultCode: 'G',
            resultLabel: 'Galibiyet'
        });
    });

    it('does not call the backend for seasons before coverage began', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch');
        const result = await fetchCupFixtures(2025);

        expect(fetchMock).not.toHaveBeenCalled();
        expect(result).toMatchObject({ source: 'SofaScore', seasonStartYear: 2025, matches: [] });
    });
});
