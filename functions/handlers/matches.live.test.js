import { describe, expect, it, vi } from 'vitest';

process.env.FIREBASE_CONFIG = JSON.stringify({
    projectId: 'test-dummy',
    databaseURL: 'https://test-dummy.firebaseio.com'
});
process.env.GCLOUD_PROJECT = 'test-dummy';

const { createLiveMatchHandler } = await import('./matches.js');

const snapshot = (value) => ({ val: () => value });
const makeDatabase = (values) => ({
    ref: vi.fn((path) => ({
        once: vi.fn().mockResolvedValue(snapshot(values[path] ?? null))
    }))
});
const makeRes = () => {
    const res = {
        _status: 200,
        _json: null,
        status(code) { res._status = code; return res; },
        json(value) { res._json = value; return res; }
    };
    return res;
};

const scheduledMatch = { id: 'match-1', competition: 'Süper Lig' };
const finishedMatch = { matchId: 'match-1', matchState: 'post', homeTeam: {}, awayTeam: {} };

describe('live match cache fallback', () => {
    it('returns the archived final match after the transient live cache is removed', async () => {
        const database = makeDatabase({
            'cache/nextMatch': scheduledMatch,
            'cache/liveMatch': null,
            'cache/lastFinishedMatch': finishedMatch
        });
        const sameMatch = vi.fn((candidate, current) => candidate.matchId === current.id);
        const handler = createLiveMatchHandler({ database, sameMatch, cupMatch: () => false });
        const res = makeRes();

        await handler({}, res);

        expect(res._json).toEqual(finishedMatch);
    });

    it('does not show the archived final after nextMatch changes', async () => {
        const database = makeDatabase({
            'cache/nextMatch': { id: 'match-2' },
            'cache/liveMatch': null,
            'cache/lastFinishedMatch': finishedMatch
        });
        const sameMatch = vi.fn((candidate, current) => candidate.matchId === current.id);
        const handler = createLiveMatchHandler({ database, sameMatch, cupMatch: () => false });
        const res = makeRes();

        await handler({}, res);

        expect(res._json).toEqual({ matchState: 'no-match' });
    });

    it('keeps the unsupported response for Türkiye Kupası matches', async () => {
        const database = makeDatabase({ 'cache/nextMatch': scheduledMatch });
        const handler = createLiveMatchHandler({
            database,
            sameMatch: vi.fn(),
            cupMatch: () => true
        });
        const res = makeRes();

        await handler({}, res);

        expect(res._json).toEqual({ matchState: 'unsupported' });
        expect(database.ref).toHaveBeenCalledTimes(1);
    });
});
