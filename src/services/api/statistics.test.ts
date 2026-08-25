import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../firebase', () => ({ database: {} }));
vi.mock('firebase/database', () => ({ ref: vi.fn(), get: vi.fn(), onValue: vi.fn() }));
vi.mock('../../utils/fetchWithTimeout', () => ({ fetchWithTimeout: vi.fn() }));

import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { fetchPlayerStats } from './statistics';

const mockedFetchWithTimeout = vi.mocked(fetchWithTimeout);

const buildAthlete = (goals: number, assists: number, appearances: number) => ({
    id: '1',
    displayName: 'Talisca',
    statistics: {
        splits: {
            categories: [{
                stats: [
                    { name: 'totalGoals', value: goals },
                    { name: 'goalAssists', value: assists },
                    { name: 'appearances', value: appearances }
                ]
            }]
        }
    }
});

const buildResponse = (athletes: ReturnType<typeof buildAthlete>[]) => ({
    ok: true,
    json: async () => ({ athletes })
}) as unknown as Response;

describe('fetchPlayerStats', () => {
    beforeEach(() => {
        mockedFetchWithTimeout.mockReset();
    });

    it('requests and combines league and Europe stats for the selected season', async () => {
        mockedFetchWithTimeout.mockImplementation(async (url) => {
            if (String(url).includes('/tur.1/')) return buildResponse([buildAthlete(3, 2, 12)]);
            if (String(url).includes('/uefa.europa/')) return buildResponse([buildAthlete(4, 1, 8)]);
            return buildResponse([]);
        });

        const players = await fetchPlayerStats(2025);

        expect(mockedFetchWithTimeout).toHaveBeenCalledWith(
            'https://site.web.api.espn.com/apis/site/v2/sports/soccer/tur.1/teams/436/roster?season=2025'
        );
        expect(mockedFetchWithTimeout).toHaveBeenCalledWith(
            'https://site.web.api.espn.com/apis/site/v2/sports/soccer/uefa.europa/teams/436/roster?season=2025'
        );
        expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(7);
        expect(players).toEqual([{
            playerId: '1',
            name: 'Talisca',
            goals: 7,
            assists: 3,
            appearances: 20,
            leagueGoals: 3,
            leagueAssists: 2,
            europaGoals: 4,
            europaAssists: 1
        }]);
    });
});
