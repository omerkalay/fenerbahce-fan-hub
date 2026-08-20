import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchFenerbahceFixtures } from './combined-fixtures';

const buildResponse = (payload: unknown, ok = true): Response => ({
    ok,
    json: vi.fn().mockResolvedValue(payload)
} as unknown as Response);

const espnEvent = {
    id: 'league-1',
    date: '2026-08-22T18:30:00Z',
    season: { displayName: '2026-27 Turkish Super Lig' },
    competitions: [{
        id: 'league-1',
        date: '2026-08-22T18:30:00Z',
        competitors: [
            { homeAway: 'home', team: { id: '436', displayName: 'Fenerbahce' }, score: { value: 0, displayValue: '0' } },
            { homeAway: 'away', team: { id: '999', displayName: 'Besiktas' }, score: { value: 0, displayValue: '0' } }
        ],
        status: { type: { state: 'pre', completed: false } }
    }]
};

const cupEvent = {
    id: 987,
    startTimestamp: Date.parse('2026-08-21T18:30:00Z') / 1000,
    homeTeam: { id: 999, name: 'Besiktas' },
    awayTeam: { id: 3052, name: 'Fenerbahce' },
    tournament: { uniqueTournament: { id: 96, name: 'Türkiye Kupası' }, name: 'Türkiye Kupası' },
    status: { code: 0, type: 'notstarted', description: 'Not started' }
};

describe('combined fixtures', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('merges ESPN and SofaScore matches in chronological order', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
            const url = String(input);
            if (url.includes('/cup-fixtures')) {
                return buildResponse({ source: 'SofaScore', seasonStartYear: 2026, lastUpdate: 1, matches: [cupEvent] });
            }
            const isLeagueFixture = url.includes('/tur.1/') && url.includes('fixture=true');
            return buildResponse({ events: isLeagueFixture ? [espnEvent] : [] });
        });

        const result = await fetchFenerbahceFixtures(2026);

        expect(result.error).toBe(false);
        expect(result.matches.map(({ source, id }) => `${source}:${id}`)).toEqual([
            'sofascore:987',
            'espn:league-1'
        ]);
    });

    it('keeps ESPN fixtures and reports a non-blocking warning when cup cache fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
            const url = String(input);
            if (url.includes('/cup-fixtures')) return buildResponse({}, false);
            const isLeagueFixture = url.includes('/tur.1/') && url.includes('fixture=true');
            return buildResponse({ events: isLeagueFixture ? [espnEvent] : [] });
        });

        const result = await fetchFenerbahceFixtures(2026);

        expect(result.error).toBe(false);
        expect(result.matches).toHaveLength(1);
        expect(result.warning).toContain('Türkiye Kupası');
    });
});
