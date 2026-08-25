import { describe, expect, it, vi } from 'vitest';

process.env.FIREBASE_CONFIG = JSON.stringify({
    projectId: 'test-dummy',
    databaseURL: 'https://test-dummy.firebaseio.com'
});
process.env.GCLOUD_PROJECT = 'test-dummy';

const { refreshDataSnapshots } = await import('./dataSnapshots.js');

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

const createMemoryDatabase = (initial = {}) => {
    const state = clone(initial);
    const pathParts = (path = '') => String(path).split('/').filter(Boolean);
    const getValue = (path = '') => pathParts(path).reduce((value, key) => value?.[key], state);
    const setValue = (path, value) => {
        const parts = pathParts(path);
        let target = state;
        for (const key of parts.slice(0, -1)) {
            if (!target[key] || typeof target[key] !== 'object') target[key] = {};
            target = target[key];
        }
        target[parts.at(-1)] = clone(value);
    };
    const snapshot = (value) => ({ val: () => clone(value) });

    return {
        state,
        ref(path = '') {
            return {
                once: async () => snapshot(getValue(path)),
                set: async (value) => setValue(path, value),
                transaction: async (updater) => {
                    const next = updater(clone(getValue(path)));
                    setValue(path, next);
                    return { committed: true, snapshot: snapshot(next) };
                }
            };
        }
    };
};

const response = (data, ok = true, status = 200) => ({
    ok,
    status,
    json: async () => clone(data)
});

const athlete = {
    id: '10',
    displayName: 'Test Player',
    statistics: {
        splits: {
            categories: [{
                stats: [
                    { name: 'totalGoals', value: 3 },
                    { name: 'goalAssists', value: 2 },
                    { name: 'appearances', value: 5 }
                ]
            }]
        }
    }
};

const event = {
    id: '750125',
    date: '2025-08-20T17:00:00.000Z',
    season: { displayName: '2025-26' },
    competitions: [{
        id: '750125',
        date: '2025-08-20T17:00:00.000Z',
        status: { type: { state: 'post', completed: true, description: 'Final' } },
        competitors: [
            {
                homeAway: 'home',
                winner: true,
                score: { value: 2, displayValue: '2' },
                team: { id: '436', displayName: 'Fenerbahçe', shortDisplayName: 'Fenerbahçe' }
            },
            {
                homeAway: 'away',
                winner: false,
                score: { value: 1, displayValue: '1' },
                team: { id: '1', displayName: 'Rakip', shortDisplayName: 'Rakip' }
            }
        ]
    }]
};

const standings = {
    children: [{
        standings: {
            entries: [{
                team: { id: '436', displayName: 'Fenerbahçe', logos: [] },
                stats: [
                    { name: 'rank', value: 1 },
                    { name: 'points', value: 9 },
                    { name: 'gamesPlayed', value: 3 }
                ]
            }]
        }
    }]
};

describe('daily data snapshots', () => {
    it('stores fixture, standings and statistics snapshots while keeping ESPN as default', async () => {
        const database = createMemoryDatabase({ cache: {} });
        const fetchImpl = vi.fn(async (url) => {
            if (url.includes('/standings?')) return response(standings);
            if (url.includes('/roster?')) {
                return response({ athletes: url.includes('/tur.1/') ? [athlete] : [] });
            }
            if (url.includes('/schedule?')) {
                return response({
                    season: { displayName: '2025-26' },
                    team: { id: '436', displayName: 'Fenerbahçe' },
                    events: url.includes('/tur.1/') ? [event] : []
                });
            }
            throw new Error(`Unexpected URL: ${url}`);
        });

        const results = await refreshDataSnapshots({
            resources: 'all',
            seasonStartYear: 2025,
            database,
            fetchImpl,
            now: 123456
        });

        expect(results).toEqual([
            { resource: 'fixtures', status: 'ok', fetchedAt: 123456 },
            { resource: 'standings', status: 'ok', fetchedAt: 123456 },
            { resource: 'statistics', status: 'ok', fetchedAt: 123456 }
        ]);
        expect(database.state.cache.dataSourceModes).toEqual({
            fixtures: 'espn',
            standings: 'espn',
            statistics: 'espn'
        });
        expect(database.state.cache.dataSnapshots[2025].fixtures.data.matches).toHaveLength(1);
        expect(database.state.cache.dataSnapshots[2025].standings.data.rows[0].points).toBe(9);
        expect(database.state.cache.dataSnapshots[2025].statistics.data).toMatchObject({
            players: [expect.objectContaining({ playerId: '10', goals: 3 })],
            form: [expect.objectContaining({ matchId: '750125', result: 'W' })]
        });
    });

    it('preserves the last good data when every ESPN fixture request fails', async () => {
        const previousData = { matches: [{ id: 'old-match' }] };
        const database = createMemoryDatabase({
            cache: {
                dataSnapshots: {
                    2025: {
                        fixtures: { data: previousData, fetchedAt: 100, status: 'ok' }
                    }
                }
            }
        });
        const fetchImpl = vi.fn(async () => response({}, false, 503));

        const results = await refreshDataSnapshots({
            resources: ['fixtures'],
            seasonStartYear: 2025,
            database,
            fetchImpl,
            now: 200
        });

        expect(results[0]).toMatchObject({ resource: 'fixtures', status: 'error', preserved: true });
        expect(database.state.cache.dataSnapshots[2025].fixtures).toMatchObject({
            data: previousData,
            fetchedAt: 100,
            lastAttemptAt: 200,
            status: 'error'
        });
    });
});
