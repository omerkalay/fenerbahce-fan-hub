import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.FIREBASE_CONFIG = JSON.stringify({
    projectId: 'test-dummy',
    databaseURL: 'https://test-dummy.firebaseio.com'
});
process.env.GCLOUD_PROJECT = 'test-dummy';

const {
    validateMatchId,
    normalizeDraft,
    handleAdminRoute
} = await import('./adminRouter.js');

const makeReq = (method = 'GET', body = {}) => ({ method, body, headers: {} });
const makeRes = () => {
    const res = {
        statusCode: 200,
        body: null,
        status(code) { res.statusCode = code; return res; },
        json(value) { res.body = value; return res; }
    };
    return res;
};

describe('admin route validation', () => {
    beforeEach(() => vi.clearAllMocks());

    it('rejects path injection and accepts numeric provider match IDs', () => {
        expect(validateMatchId('401888314')).toBe('401888314');
        expect(validateMatchId('../401888314')).toBeNull();
        expect(validateMatchId('40188/8314')).toBeNull();
        expect(validateMatchId('abcde')).toBeNull();
        expect(validateMatchId('1234')).toBeNull();
        expect(validateMatchId('1'.repeat(21))).toBeNull();
        expect(validateMatchId('40188.8314')).toBeNull();
    });

    it('strictly validates lineup drafts and rejects unknown fields', () => {
        const valid = {
            formation: '4-2-3-1',
            players: [{ slot: 'GK', id: 1, name: 'Goalkeeper', position: 'Goalkeeper', number: 1 }]
        };
        expect(normalizeDraft(valid)?.players).toHaveLength(1);
        expect(normalizeDraft({ ...valid, admin: true })).toBeNull();
        expect(normalizeDraft({ ...valid, players: [{ ...valid.players[0], slot: '../GK' }] })).toBeNull();
        expect(normalizeDraft({ ...valid, players: [{ ...valid.players[0], id: '1' }] })).toBeNull();
        expect(normalizeDraft({ ...valid, players: [{ ...valid.players[0], number: 0 }] })).toBeNull();
        expect(normalizeDraft({ ...valid, players: [valid.players[0], { ...valid.players[0], slot: 'RB', id: 2 }] })).toBeNull();
        expect(normalizeDraft('{"formation":"4-2-3-1"}')).toBeNull();
    });

    it('stops every admin route when authentication fails', async () => {
        const authenticate = vi.fn(async (_req, res) => {
            res.status(403).json({ error: 'Administrator access required' });
            return null;
        });
        const routes = [
            { method: 'GET', segments: ['session'] },
            { method: 'GET', segments: ['overview'] },
            { method: 'PUT', segments: ['settings'] },
            { method: 'GET', segments: ['lineups', '401888314'] },
            { method: 'PUT', segments: ['lineups', '401888314', 'draft'] },
            { method: 'POST', segments: ['lineups', '401888314', 'publish'] },
            { method: 'POST', segments: ['lineups', '401888314', 'release'] },
        ];

        for (const route of routes) {
            const res = makeRes();
            await handleAdminRoute(makeReq(route.method), res, route.segments, {
                requireAdminClaims: authenticate,
                database: { ref: vi.fn() },
                messaging: { send: vi.fn() }
            });
            expect(res.statusCode).toBe(403);
        }
        expect(authenticate).toHaveBeenCalledTimes(routes.length);
    });

    it('returns an admin session only after the shared gate succeeds', async () => {
        const res = makeRes();
        await handleAdminRoute(makeReq('GET'), res, ['session'], {
            requireAdminClaims: vi.fn().mockResolvedValue({ uid: 'admin-uid', admin: true }),
            database: { ref: vi.fn() },
            messaging: { send: vi.fn() }
        });
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ authenticated: true, admin: true, uid: 'admin-uid' });
    });

    it('does not accept extra path segments on an otherwise valid endpoint', async () => {
        const res = makeRes();
        await handleAdminRoute(makeReq('GET'), res, ['session', 'unexpected'], {
            requireAdminClaims: vi.fn().mockResolvedValue({ uid: 'admin-uid', admin: true }),
            database: { ref: vi.fn() },
            messaging: { send: vi.fn() }
        });
        expect(res.statusCode).toBe(404);
        expect(res.body).toEqual({ error: 'Admin endpoint not found' });
    });
});
