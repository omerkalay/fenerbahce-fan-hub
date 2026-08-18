import { afterEach, describe, expect, it, vi } from 'vitest';
import { ESPN_FIXTURE_COMPETITIONS, fetchEspnFenerbahceFixtures } from './espn-fixtures';

const buildResponse = (payload: unknown): Response => ({
    ok: true,
    json: vi.fn().mockResolvedValue(payload)
} as unknown as Response);

describe('ESPN fixture competitions', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('requests the domestic league and all three UEFA club competitions', async () => {
        const championsLeagueQualifyingEvent = {
            id: 'ucl-1',
            date: '2026-08-18T19:00:00Z',
            season: { displayName: 'UEFA Champions League Qualifying' },
            competitions: [{
                id: 'ucl-1',
                date: '2026-08-18T19:00:00Z',
                competitors: [
                    {
                        homeAway: 'home',
                        team: { id: '436', displayName: 'Fenerbahce' },
                        score: { displayValue: '0', value: 0 }
                    },
                    {
                        homeAway: 'away',
                        team: { id: '167', displayName: 'Olympique Lyonnais' },
                        score: { displayValue: '0', value: 0 }
                    }
                ],
                status: { type: { state: 'pre', completed: false } }
            }]
        };

        const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
            const url = String(input);
            const isChampionsQualifyingFixtures = url.includes('/uefa.champions_qual/') && url.includes('fixture=true');
            return buildResponse({ events: isChampionsQualifyingFixtures ? [championsLeagueQualifyingEvent] : [] });
        });

        const result = await fetchEspnFenerbahceFixtures(2026);
        const requestedUrls = fetchMock.mock.calls.map(([input]) => String(input));

        expect(ESPN_FIXTURE_COMPETITIONS.map(({ slug }) => slug)).toEqual([
            'tur.1',
            'uefa.champions_qual',
            'uefa.champions',
            'uefa.europa_qual',
            'uefa.europa',
            'uefa.europa.conf_qual',
            'uefa.europa.conf'
        ]);
        expect(requestedUrls).toHaveLength(14);
        expect(result.matches).toHaveLength(1);
        expect(result.matches[0]).toMatchObject({
            id: 'ucl-1',
            competitionKey: 'uefa.champions_qual',
            competitionGroup: 'europe',
            competitionLabel: 'UEFA Şampiyonlar Ligi Elemeleri'
        });
    });
});
