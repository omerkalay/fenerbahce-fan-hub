import { describe, expect, it } from 'vitest';
import espnCompetitions from './espnCompetitions.js';

const { ESPN_LEAGUES, getEspnLeaguesForMatch } = espnCompetitions;

describe('ESPN competitions', () => {
    it('covers the main and qualifying stages of all UEFA club competitions', () => {
        expect(ESPN_LEAGUES).toEqual([
            'tur.1',
            'uefa.champions_qual',
            'uefa.champions',
            'uefa.europa_qual',
            'uefa.europa',
            'uefa.europa.conf_qual',
            'uefa.europa.conf'
        ]);
    });

    it('limits a Champions League match to its qualifying and main feeds', () => {
        const match = {
            tournament: {
                uniqueTournament: { name: 'UEFA Champions League' }
            }
        };

        expect(getEspnLeaguesForMatch(match)).toEqual([
            'uefa.champions_qual',
            'uefa.champions'
        ]);
    });

    it('uses the domestic feed for Süper Lig matches', () => {
        const match = { tournament: { name: 'Trendyol Süper Lig' } };
        expect(getEspnLeaguesForMatch(match)).toEqual(['tur.1']);
    });

    it('does not scan ESPN leagues for a Türkiye Kupası match', () => {
        const match = { tournament: { uniqueTournament: { name: 'Türkiye Kupası' } } };
        expect(getEspnLeaguesForMatch(match)).toEqual([]);

        const idOnlyMatch = { tournament: { uniqueTournament: { id: 96, name: 'Domestic Cup' } } };
        expect(getEspnLeaguesForMatch(idOnlyMatch)).toEqual([]);
    });

    it('uses the manual fallback for an unsupported tournament', () => {
        const match = { tournament: { name: 'Friendly Match' } };
        expect(getEspnLeaguesForMatch(match)).toEqual([]);
    });
});
