import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.FIREBASE_CONFIG = JSON.stringify({
    projectId: 'test-dummy',
    databaseURL: 'https://test-dummy.firebaseio.com'
});
process.env.GCLOUD_PROJECT = 'test-dummy';

const {
    validateMatchId,
    normalizeDraft,
    normalizeNotification,
    normalizePlayerStatusDraft,
    normalizePublishedPlayerStatuses,
    notificationHash,
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

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const createMemoryDatabase = (initial = {}) => {
    const state = clone(initial);
    let pushIndex = 0;
    const pathParts = (path = '') => String(path).split('/').filter(Boolean);
    const getValue = (path = '') => pathParts(path).reduce((value, key) => value?.[key], state);
    const setValue = (path, value) => {
        const parts = pathParts(path);
        if (parts.length === 0) throw new Error('Root set is not supported in this test helper');
        let target = state;
        for (const key of parts.slice(0, -1)) {
            if (!target[key] || typeof target[key] !== 'object') target[key] = {};
            target = target[key];
        }
        const key = parts.at(-1);
        if (value === null) delete target[key];
        else target[key] = clone(value);
    };
    const snapshot = (value) => ({
        val: () => clone(value),
        numChildren: () => value && typeof value === 'object' ? Object.keys(value).length : 0
    });
    const database = {
        state,
        ref(path = '') {
            return {
                once: async () => snapshot(getValue(path)),
                set: async (value) => setValue(path, value),
                update: async (updates) => {
                    for (const [childPath, value] of Object.entries(updates)) {
                        setValue([path, childPath].filter(Boolean).join('/'), value);
                    }
                },
                transaction: async (updater) => {
                    const current = clone(getValue(path));
                    const next = updater(current);
                    if (next === undefined) return { committed: false, snapshot: snapshot(current) };
                    setValue(path, next);
                    return { committed: true, snapshot: snapshot(next) };
                },
                push: (value) => {
                    const key = `audit-${++pushIndex}`;
                    if (value !== undefined) setValue([path, key].filter(Boolean).join('/'), value);
                    return { key };
                }
            };
        }
    };
    return database;
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

    it('restricts notification content and internal URLs', () => {
        const valid = normalizeNotification({ title: 'Test', body: 'Message', url: '/fenerbahce-fan-hub/' });
        expect(valid?.url).toBe('https://omerkalay.com/fenerbahce-fan-hub/');
        expect(normalizeNotification({ title: 'Test', body: 'Message', url: 'https://attacker.example/' })).toBeNull();
        expect(normalizeNotification({ title: 'x'.repeat(61), body: 'Message' })).toBeNull();
        expect(normalizeNotification({ title: 'Test', body: 'x'.repeat(181) })).toBeNull();
        expect(normalizeNotification({ title: 'Test', body: 'Message', url: `/fenerbahce-fan-hub/${'x'.repeat(250)}` })).toBeNull();
        expect(normalizeNotification({ title: 'Test', body: 'Message', uid: 'fake-admin' })).toBeNull();
        expect(notificationHash(valid)).toHaveLength(64);
    });

    it('strictly validates player status drafts and server-owned fields', () => {
        const valid = {
            baseRevision: 2,
            entries: [{
                playerId: '12345',
                source: 'squad',
                name: 'Test Player',
                status: 'injured',
                detail: 'Muscle injury',
                returnDate: 'Two weeks'
            }]
        };
        expect(normalizePlayerStatusDraft(valid)).toEqual(valid);
        expect(normalizePlayerStatusDraft({ ...valid, admin: true })).toBeNull();
        expect(normalizePlayerStatusDraft({ ...valid, uid: 'fake' })).toBeNull();
        expect(normalizePlayerStatusDraft({ ...valid, updatedAt: Date.now() })).toBeNull();
        expect(normalizePlayerStatusDraft({ ...valid, entries: [{ ...valid.entries[0], status: 'fit' }] })).toBeNull();
        expect(normalizePlayerStatusDraft({ ...valid, entries: [{ ...valid.entries[0], playerId: '../123' }] })).toBeNull();
        expect(normalizePlayerStatusDraft({ ...valid, entries: [{ ...valid.entries[0], extra: true }] })).toBeNull();
        expect(normalizePlayerStatusDraft({ ...valid, entries: [{ ...valid.entries[0], detail: 'x'.repeat(161) }] })).toBeNull();
        expect(normalizePlayerStatusDraft({ ...valid, entries: [valid.entries[0], { ...valid.entries[0] }] })).toBeNull();
        expect(normalizePlayerStatusDraft({ baseRevision: 0, entries: Array.from({ length: 41 }, (_, index) => ({ ...valid.entries[0], playerId: String(index + 1), name: `Player ${index}` })) })).toBeNull();
        expect(normalizePlayerStatusDraft('{"baseRevision":0,"entries":[]}')).toBeNull();

        const manual = normalizePlayerStatusDraft({
            baseRevision: 0,
            entries: [{ source: 'manual', name: 'Manual Player', status: 'suspended', detail: '', returnDate: '' }]
        });
        expect(manual?.entries[0].playerId).toMatch(/^manual-[0-9a-f-]{36}$/);
        expect(normalizePlayerStatusDraft({ baseRevision: 0, entries: [] })).toEqual({ baseRevision: 0, entries: [] });
    });

    it('normalizes legacy published player status arrays without trusting paths', () => {
        const result = normalizePublishedPlayerStatuses({
            first: { name: 'Legacy Player', status: 'doubtful', detail: '', returnDate: '', updatedAt: 123 },
            ignored: { name: 'Invalid', status: 'unknown' }
        });
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ source: 'manual', name: 'Legacy Player', status: 'doubtful', updatedAt: 123 });
        expect(result[0].playerId).toMatch(/^legacy-[0-9a-f]{16}$/);
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
            { method: 'GET', segments: ['player-status'] },
            { method: 'PUT', segments: ['player-status', 'draft'] },
            { method: 'POST', segments: ['player-status', 'publish'] },
            { method: 'GET', segments: ['lineups', '401888314'] },
            { method: 'PUT', segments: ['lineups', '401888314', 'draft'] },
            { method: 'POST', segments: ['lineups', '401888314', 'publish'] },
            { method: 'POST', segments: ['lineups', '401888314', 'release'] },
            { method: 'POST', segments: ['notifications', 'test'] },
            { method: 'POST', segments: ['notifications', 'send'] }
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

    it('lets an authenticated admin save and atomically publish a revisioned status draft', async () => {
        const database = createMemoryDatabase({
            cache: { squad: [{ id: 43601, name: 'Squad Player' }] },
            admin: { playerStatus: [{ name: 'Legacy', status: 'injured', detail: '', returnDate: '', updatedAt: 10 }] },
            ops: { playerStatus: { state: { revision: 0, lastPublishedAt: 10 } } }
        });
        const dependencies = {
            requireAdminClaims: vi.fn().mockResolvedValue({ uid: 'admin-uid', admin: true }),
            database,
            messaging: { send: vi.fn() }
        };
        const entries = [
            { playerId: '43601', source: 'squad', name: 'Squad Player', status: 'injured', detail: 'Ankle', returnDate: '10 days' },
            { playerId: '', source: 'manual', name: 'Manual Player', status: 'suspended', detail: 'One match', returnDate: '' }
        ];

        const saveRes = makeRes();
        await handleAdminRoute(makeReq('PUT', { baseRevision: 0, entries }), saveRes, ['player-status', 'draft'], dependencies);
        expect(saveRes.statusCode).toBe(200);
        expect(database.state.admin.playerStatus[0].name).toBe('Legacy');

        const publishRes = makeRes();
        await handleAdminRoute(makeReq('POST', { baseRevision: 0 }), publishRes, ['player-status', 'publish'], dependencies);
        expect(publishRes.statusCode).toBe(200);
        expect(publishRes.body.revision).toBe(1);
        expect(database.state.admin.playerStatus[0]).toMatchObject({ playerId: '43601', name: 'Squad Player', updatedAt: expect.any(Number) });
        expect(database.state.admin.playerStatus[1]).toMatchObject({ source: 'manual', name: 'Manual Player', updatedAt: expect.any(Number) });
        expect(database.state.admin.playerStatus[1].playerId).toMatch(/^manual-[0-9a-f-]{36}$/);
        expect(database.state.ops.playerStatus.state).toMatchObject({ revision: 1, updatedBy: 'admin-uid' });
        expect(database.state.ops.playerStatus.drafts?.['admin-uid']).toBeUndefined();
        expect(Object.values(database.state.ops.adminAudit)).toEqual(expect.arrayContaining([
            expect.objectContaining({ action: 'playerStatus.published', uid: 'admin-uid' })
        ]));

        const getRes = makeRes();
        await handleAdminRoute(makeReq('GET'), getRes, ['player-status'], dependencies);
        expect(getRes.statusCode).toBe(200);
        expect(getRes.body).toMatchObject({ revision: 1, draft: null });
        expect(getRes.body.published).toHaveLength(2);

        const editRes = makeRes();
        const editableEntries = getRes.body.published.map(({ updatedAt: _updatedAt, ...entry }) => entry);
        await handleAdminRoute(makeReq('PUT', { baseRevision: 1, entries: editableEntries }), editRes, ['player-status', 'draft'], dependencies);
        expect(editRes.statusCode).toBe(200);
        expect(dependencies.messaging.send).not.toHaveBeenCalled();
    });

    it('returns 409 for a stale player status revision and supports publishing an empty list', async () => {
        const database = createMemoryDatabase({ ops: { playerStatus: { state: { revision: 3 } } } });
        const dependencies = {
            requireAdminClaims: vi.fn().mockResolvedValue({ uid: 'admin-uid', admin: true }),
            database,
            messaging: { send: vi.fn() }
        };
        const staleRes = makeRes();
        await handleAdminRoute(makeReq('PUT', { baseRevision: 2, entries: [] }), staleRes, ['player-status', 'draft'], dependencies);
        expect(staleRes.statusCode).toBe(409);

        const saveRes = makeRes();
        await handleAdminRoute(makeReq('PUT', { baseRevision: 3, entries: [] }), saveRes, ['player-status', 'draft'], dependencies);
        expect(saveRes.statusCode).toBe(200);
        const publishRes = makeRes();
        await handleAdminRoute(makeReq('POST', { baseRevision: 3 }), publishRes, ['player-status', 'publish'], dependencies);
        expect(publishRes.statusCode).toBe(200);
        expect(publishRes.body.published).toEqual([]);
        expect(database.state.admin?.playerStatus).toBeUndefined();
    });

    it('rejects a forged squad identity even for an authenticated admin request', async () => {
        const database = createMemoryDatabase({
            cache: { squad: [{ id: 123, name: 'Canonical Player' }] },
            ops: { playerStatus: { state: { revision: 0 } } }
        });
        const res = makeRes();
        await handleAdminRoute(makeReq('PUT', {
            baseRevision: 0,
            entries: [{ playerId: '123', source: 'squad', name: 'Forged Name', status: 'injured', detail: '', returnDate: '' }]
        }), res, ['player-status', 'draft'], {
            requireAdminClaims: vi.fn().mockResolvedValue({ uid: 'admin-uid', admin: true }),
            database,
            messaging: { send: vi.fn() }
        });
        expect(res.statusCode).toBe(400);
        expect(database.state.ops.playerStatus.drafts).toBeUndefined();
    });

    it('rejects a client-invented manual player ID', async () => {
        const database = createMemoryDatabase({ ops: { playerStatus: { state: { revision: 0 } } } });
        const res = makeRes();
        await handleAdminRoute(makeReq('PUT', {
            baseRevision: 0,
            entries: [{
                playerId: 'manual-00000000-0000-4000-8000-000000000000',
                source: 'manual',
                name: 'Forged Manual Player',
                status: 'injured',
                detail: '',
                returnDate: ''
            }]
        }), res, ['player-status', 'draft'], {
            requireAdminClaims: vi.fn().mockResolvedValue({ uid: 'admin-uid', admin: true }),
            database,
            messaging: { send: vi.fn() }
        });
        expect(res.statusCode).toBe(400);
        expect(database.state.ops.playerStatus.drafts).toBeUndefined();
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
