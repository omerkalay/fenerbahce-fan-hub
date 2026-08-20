import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.FIREBASE_CONFIG = JSON.stringify({
    projectId: 'test-dummy',
    databaseURL: 'https://test-dummy.firebaseio.com',
});
process.env.GCLOUD_PROJECT = 'test-dummy';

const serviceMocks = {
    refresh: vi.fn(),
    read: vi.fn(),
    summary: vi.fn((payload) => ({
        source: 'ESPN',
        seasonStartYear: payload.seasonStartYear,
        state: payload.participation.state,
        title: payload.participation.competition?.shortName || 'Avrupa Yolculuğu'
    }))
};

const { createUefaJourneyHandler } = await import('./matches.js');
const handleUefaJourney = createUefaJourneyHandler({
    readCache: serviceMocks.read,
    refreshCache: serviceMocks.refresh,
    summarize: serviceMocks.summary,
    now: () => Date.now()
});

const makeReq = ({ method = 'GET', query = {} } = {}) => ({ method, query });
const makeRes = () => {
    const res = {
        _status: 200,
        _json: null,
        status(code) { res._status = code; return res; },
        json(data) { res._json = data; return res; }
    };
    return res;
};

const payload = ({ lastUpdate = Date.now() } = {}) => ({
    source: 'ESPN',
    seasonStartYear: 2026,
    lastUpdate,
    stale: false,
    participation: {
        state: 'qualifying',
        competition: null,
        qualifier: { key: 'champions', qualifierName: 'UEFA Şampiyonlar Ligi Elemeleri' },
        phaseLabel: 'Eleme Play-off Turu'
    },
    standings: null,
    fenerPath: [],
    bracket: null
});

describe('handleUefaJourney', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        serviceMocks.read.mockResolvedValue(payload());
    });

    it('accepts only GET with a valid season start year', async () => {
        const methodRes = makeRes();
        await handleUefaJourney(makeReq({ method: 'POST', query: { seasonStartYear: '2026' } }), methodRes);
        expect(methodRes._status).toBe(405);

        const yearRes = makeRes();
        await handleUefaJourney(makeReq({ query: { seasonStartYear: 'abc' } }), yearRes);
        expect(yearRes._status).toBe(400);
        expect(serviceMocks.read).not.toHaveBeenCalled();
    });

    it('serves the compact summary from a fresh cache without fetching ESPN', async () => {
        const res = makeRes();
        await handleUefaJourney(makeReq({
            query: { seasonStartYear: '2026', summary: 'true' }
        }), res);

        expect(res._status).toBe(200);
        expect(res._json).toMatchObject({ title: 'Avrupa Yolculuğu', state: 'qualifying' });
        expect(serviceMocks.refresh).not.toHaveBeenCalled();
    });

    it('fills a missing cache once and returns the refreshed payload', async () => {
        const refreshed = payload({ lastUpdate: 123 });
        serviceMocks.read.mockResolvedValue(null);
        serviceMocks.refresh.mockResolvedValue(refreshed);
        const res = makeRes();

        await handleUefaJourney(makeReq({ query: { seasonStartYear: '2026' } }), res);

        expect(serviceMocks.refresh).toHaveBeenCalledWith(2026);
        expect(res._json).toEqual(refreshed);
    });

    it('returns stale cache if a current-season refresh fails', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-20T12:00:00Z'));
        const oldPayload = payload({ lastUpdate: Date.now() - 40 * 60 * 60 * 1000 });
        serviceMocks.read.mockResolvedValue(oldPayload);
        serviceMocks.refresh.mockRejectedValue(new Error('ESPN down'));
        const res = makeRes();

        await handleUefaJourney(makeReq({ query: { seasonStartYear: '2026' } }), res);

        expect(res._status).toBe(200);
        expect(res._json).toMatchObject({ stale: true, seasonStartYear: 2026 });
        vi.useRealTimers();
    });
});
