import { describe, expect, it } from 'vitest';
import cacheRefresh from './cacheRefresh.js';

const {
    createRefreshCache,
    applyMatchFetchSuccess,
    applyMatchFetchFailure
} = cacheRefresh;

describe('cacheRefresh', () => {
    const oldMatch = { id: 10, startTimestamp: 1_800_000_000 };
    const oldSquad = [{ id: 1, name: 'Player' }];
    const oldFinishedMatch = { id: 9 };

    it('starts a refresh without discarding the last good cache', () => {
        const cache = createRefreshCache({
            existingCache: {
                nextMatch: oldMatch,
                next3Matches: [oldMatch],
                lastFinishedMatch: oldFinishedMatch,
                squad: oldSquad,
                lastUpdate: 123,
                seasonState: 'active'
            },
            now: 456,
            referenceDate: new Date('2026-07-17T03:00:00Z')
        });

        expect(cache).toMatchObject({
            nextMatch: oldMatch,
            next3Matches: [oldMatch],
            lastFinishedMatch: oldFinishedMatch,
            squad: oldSquad,
            lastUpdate: 123,
            lastAttempt: 456,
            matchFetchStatus: 'pending',
            seasonState: 'active',
            season: { startYear: 2026, label: '2026/27' }
        });
    });

    it('keeps the last good match data when the provider fails', () => {
        const initial = createRefreshCache({
            existingCache: {
                nextMatch: oldMatch,
                next3Matches: [oldMatch],
                squad: oldSquad,
                lastUpdate: 123,
                seasonState: 'active'
            },
            now: 456
        });

        expect(applyMatchFetchFailure(initial)).toMatchObject({
            nextMatch: oldMatch,
            next3Matches: [oldMatch],
            squad: oldSquad,
            lastUpdate: 123,
            lastAttempt: 456,
            matchFetchStatus: 'error',
            seasonState: 'active'
        });
    });

    it('replaces cached matches only after a successful provider response', () => {
        const newMatches = [
            { id: 20, startTimestamp: 1_900_000_000 },
            { id: 21, startTimestamp: 1_900_100_000 },
            { id: 22, startTimestamp: 1_900_200_000 },
            { id: 23, startTimestamp: 1_900_300_000 }
        ];
        const initial = createRefreshCache({ existingCache: { nextMatch: oldMatch } });
        const refreshed = applyMatchFetchSuccess(initial, newMatches, {
            now: 789,
            referenceDate: new Date('2026-08-01T00:00:00Z')
        });

        expect(refreshed).toMatchObject({
            nextMatch: newMatches[0],
            next3Matches: newMatches.slice(0, 3),
            lastUpdate: 789,
            matchFetchStatus: 'ok',
            seasonState: 'active'
        });
    });
});
