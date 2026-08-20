import { describe, expect, it } from 'vitest';
import cupFixtures from './cupFixtures.js';

const {
    isTurkeyCupMatch,
    mergeCupFixtureMatches,
    mergeCupFixturesIntoCache,
    shouldFetchCupResults
} = cupFixtures;

const buildMatch = ({
    id,
    timestamp,
    tournamentId = 96,
    tournamentName = 'Türkiye Kupası',
    status = { type: 'notstarted', code: 0 }
}) => ({
    id,
    startTimestamp: timestamp,
    tournament: {
        uniqueTournament: { id: tournamentId, name: tournamentName }
    },
    status
});

describe('cupFixtures', () => {
    it('recognizes the tournament id and localized name fallbacks', () => {
        expect(isTurkeyCupMatch(buildMatch({ id: 1, timestamp: 1_800_000_000 }))).toBe(true);
        expect(isTurkeyCupMatch(buildMatch({
            id: 2,
            timestamp: 1_800_000_000,
            tournamentId: 999,
            tournamentName: 'Türkiye Kupası'
        }))).toBe(true);
        expect(isTurkeyCupMatch(buildMatch({
            id: 3,
            timestamp: 1_800_000_000,
            tournamentId: 999,
            tournamentName: 'Turkish Cup'
        }))).toBe(true);
        expect(isTurkeyCupMatch(buildMatch({
            id: 4,
            timestamp: 1_800_000_000,
            tournamentId: 52,
            tournamentName: 'Trendyol Süper Lig'
        }))).toBe(false);
    });

    it('merges updates by id, preserves old fixtures, and sorts chronologically', () => {
        const first = buildMatch({ id: 10, timestamp: Date.UTC(2026, 11, 15) / 1000 });
        const second = buildMatch({ id: 11, timestamp: Date.UTC(2027, 1, 10) / 1000 });
        const completedSecond = buildMatch({
            id: 11,
            timestamp: Date.UTC(2027, 1, 10) / 1000,
            status: { type: 'finished', code: 100 }
        });

        const merged = mergeCupFixtureMatches([second], [first, completedSecond], 2026);

        expect(merged.map(({ id }) => id)).toEqual([10, 11]);
        expect(merged[1].status.type).toBe('finished');
    });

    it('stores current-and-later coverage without discarding an existing fixture', () => {
        const existing = buildMatch({ id: 20, timestamp: Date.UTC(2026, 11, 15) / 1000 });
        const incoming = buildMatch({ id: 21, timestamp: Date.UTC(2027, 1, 10) / 1000 });
        const cache = {
            cupFixtures: {
                2026: { source: 'SofaScore', seasonStartYear: 2026, lastUpdate: 1, matches: [existing] }
            }
        };

        const updated = mergeCupFixturesIntoCache(cache, [incoming], {
            seasonStartYear: 2026,
            now: 2
        });

        expect(updated.cupFixtures[2026]).toMatchObject({
            source: 'SofaScore',
            seasonStartYear: 2026,
            lastUpdate: 2
        });
        expect(updated.cupFixtures[2026].matches.map(({ id }) => id)).toEqual([20, 21]);
    });

    it('requests result refresh only for started, unfinished cup fixtures', () => {
        const started = buildMatch({ id: 30, timestamp: 1_800_000_000 });
        const finished = buildMatch({
            id: 31,
            timestamp: 1_800_000_000,
            status: { type: 'finished', code: 100 }
        });

        expect(shouldFetchCupResults([started], 1_800_000_001_000)).toBe(true);
        expect(shouldFetchCupResults([finished], 1_800_000_001_000)).toBe(false);
    });
});
