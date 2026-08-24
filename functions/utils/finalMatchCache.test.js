import { describe, expect, it, vi } from 'vitest';
import {
    FINAL_LIVE_CACHE_TTL_MS,
    buildFinalMatchCachePlan,
    shouldStopFinalPolling
} from './finalMatchCache.js';

const liveData = {
    matchId: 'match-1',
    matchState: 'post',
    homeTeam: { name: 'Fenerbahçe', score: '2' },
    awayTeam: { name: 'Rakip', score: '1' }
};

describe('final match cache plan', () => {
    it('marks the first final result and keeps the transient live cache for five minutes', () => {
        const plan = buildFinalMatchCachePlan({ liveData, now: 1_000 });

        expect(plan.expired).toBe(false);
        expect(plan.finalizedAt).toBe(1_000);
        expect(plan.livePayload.postMarkedAt).toBe(1_000);
        expect(plan.finalPayload).toMatchObject({
            matchId: 'match-1',
            finalizedAt: 1_000,
            archivedAt: 1_000,
            liveCacheClearedAt: null
        });
    });

    it('preserves the original final timestamp on later scheduler runs', () => {
        const plan = buildFinalMatchCachePlan({
            liveData,
            existingFinal: { ...liveData, finalizedAt: 1_000, archivedAt: 900 },
            now: 1_000 + FINAL_LIVE_CACHE_TTL_MS - 1
        });

        expect(plan.expired).toBe(false);
        expect(plan.finalizedAt).toBe(1_000);
        expect(plan.finalPayload.archivedAt).toBe(900);
    });

    it('expires only the transient live cache after five minutes', () => {
        const now = 1_000 + FINAL_LIVE_CACHE_TTL_MS;
        const plan = buildFinalMatchCachePlan({
            liveData,
            existingFinal: { ...liveData, finalizedAt: 1_000, archivedAt: 900 },
            now
        });

        expect(plan.expired).toBe(true);
        expect(plan.finalPayload).toMatchObject({
            matchId: 'match-1',
            finalizedAt: 1_000,
            liveCacheClearedAt: now
        });
    });

    it('stops ESPN polling only for the same finalized scheduled match', () => {
        const matches = vi.fn((finalData, scheduledMatch) => finalData.matchId === scheduledMatch.id);
        const now = 1_000 + FINAL_LIVE_CACHE_TTL_MS;

        expect(shouldStopFinalPolling({
            finalData: { ...liveData, finalizedAt: 1_000 },
            scheduledMatch: { id: 'match-1' },
            now,
            matches
        })).toBe(true);
        expect(shouldStopFinalPolling({
            finalData: { ...liveData, finalizedAt: 1_000 },
            scheduledMatch: { id: 'match-2' },
            now,
            matches
        })).toBe(false);
    });
});
