import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../firebase', () => ({ database: {} }));
vi.mock('firebase/database', () => ({ ref: vi.fn(), get: vi.fn() }));
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
        mockedFetchWithTimeout
            .mockResolvedValueOnce(buildResponse([buildAthlete(3, 2, 12)]))
            .mockResolvedValueOnce(buildResponse([buildAthlete(4, 1, 8)]));

        const players = await fetchPlayerStats(2025);

        expect(mockedFetchWithTimeout).toHaveBeenNthCalledWith(
            1,
            'https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/teams/436/roster?season=2025'
        );
        expect(mockedFetchWithTimeout).toHaveBeenNthCalledWith(
            2,
            'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.europa/teams/436/roster?season=2025'
        );
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
