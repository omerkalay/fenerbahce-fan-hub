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
    normalizeNotificationAudience,
    normalizeNotificationUrl,
    normalizeNotificationGroup,
    maskEmail,
    normalizeDataSourceUpdate,
    normalizeDataRefreshRequest,
    normalizePlayerStatusDraft,
    normalizePublishedPlayerStatuses,
    notificationHash,
    handleAdminRoute
} = await import('./adminRouter.js');

const makeReq = (method = 'GET', body = {}, query = {}) => ({ method, body, headers: {}, query });
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
        expect(normalizeDraft({ ...valid, players: [{ ...valid.players[0], slot: 'ST3' }] })).toBeNull();
        expect(normalizeDraft({ ...valid, players: [{ ...valid.players[0], id: '1' }] })).toBeNull();
        expect(normalizeDraft({ ...valid, players: [{ ...valid.players[0], number: 0 }] })).toBeNull();
        expect(normalizeDraft({ ...valid, players: [valid.players[0], { ...valid.players[0], slot: 'RB', id: 2 }] })).toBeNull();
        expect(normalizeDraft('{"formation":"4-2-3-1"}')).toBeNull();
    });

    it('normalizes manual drafts into canonical formation-place order', () => {
        const draft = normalizeDraft({
            formation: '4-2-3-1',
            players: [
                { slot: 'ST', id: 1, name: 'Striker', position: 'Forward', number: 9 },
                { slot: 'GK', id: 2, name: 'Goalkeeper', position: 'Goalkeeper', number: 1 },
                { slot: 'RAM', id: 3, name: 'Right Attacker', position: 'Midfielder', number: 10 },
                { slot: 'LB', id: 4, name: 'Left Back', position: 'Defender', number: 3 }
            ]
        });

        expect(draft?.players.map((player) => player.slot)).toEqual(['GK', 'LB', 'RAM', 'ST']);
    });

    it('strictly validates data source and cache refresh controls', () => {
        expect(normalizeDataSourceUpdate({ resource: 'fixtures', mode: 'cache' })).toEqual({ resource: 'fixtures', mode: 'cache' });
        expect(normalizeDataSourceUpdate({ resource: 'statistics', mode: 'espn' })).toEqual({ resource: 'statistics', mode: 'espn' });
        expect(normalizeDataSourceUpdate({ resource: 'unknown', mode: 'cache' })).toBeNull();
        expect(normalizeDataSourceUpdate({ resource: 'fixtures', mode: 'firebase' })).toBeNull();
        expect(normalizeDataSourceUpdate({ resource: 'fixtures', mode: 'cache', uid: 'forged' })).toBeNull();

        expect(normalizeDataRefreshRequest({ resource: 'all', seasonStartYear: 2026 })).toEqual({ resource: 'all', seasonStartYear: 2026 });
        expect(normalizeDataRefreshRequest({ resource: 'standings', seasonStartYear: 2025 })).toEqual({ resource: 'standings', seasonStartYear: 2025 });
        expect(normalizeDataRefreshRequest({ resource: 'fixtures', seasonStartYear: 1999 })).toBeNull();
        expect(normalizeDataRefreshRequest({ resource: 'unknown', seasonStartYear: 2026 })).toBeNull();
    });

    it('restricts notification content, audiences, and trusted destinations', () => {
        const valid = normalizeNotification({ title: 'Test', body: 'Message', url: '/fenerbahce-fan-hub/' });
        expect(valid?.url).toBe('https://omerkalay.com/fenerbahce-fan-hub/');
        expect(valid?.audience).toEqual({ type: 'topic', topic: 'all_fans' });
        expect(normalizeNotificationUrl('https://x.com/Fenerbahce/status/123456')).toBe('https://x.com/Fenerbahce/status/123456');
        expect(normalizeNotificationUrl('https://www.instagram.com/p/ABC_123/')).toBe('https://www.instagram.com/p/ABC_123/');
        expect(normalizeNotification({ title: 'Test', body: 'Message', url: 'https://attacker.example/' })).toBeNull();
        expect(normalizeNotificationUrl('https://x.com/attacker/status/123456')).toBeNull();
        expect(normalizeNotificationUrl('https://instagram.com.evil.example/p/ABC/')).toBeNull();
        expect(normalizeNotification({ title: 'x'.repeat(61), body: 'Message' })).toBeNull();
        expect(normalizeNotification({ title: 'Test', body: 'x'.repeat(181) })).toBeNull();
        expect(normalizeNotification({ title: 'Test', body: 'Message', url: `/fenerbahce-fan-hub/${'x'.repeat(300)}` })).toBeNull();
        expect(normalizeNotification({ title: 'Test', body: 'Message', uid: 'fake-admin' })).toBeNull();
        expect(normalizeNotificationAudience({ type: 'users', userUids: ['friend-b', 'friend-a', 'friend-a'] })).toEqual({
            type: 'users',
            userUids: ['friend-a', 'friend-b']
        });
        expect(normalizeNotificationAudience({ type: 'users', userUids: [] })).toBeNull();
        expect(normalizeNotificationAudience({ type: 'users', userUids: [123] })).toBeNull();
        expect(normalizeNotificationAudience({ type: 'topic', topic: 'other' })).toBeNull();
        expect(normalizeNotificationAudience({ type: 'group', groupId: '550e8400-e29b-41d4-a716-446655440000', revision: 2 })).toEqual({
            type: 'group',
            groupId: '550e8400-e29b-41d4-a716-446655440000',
            revision: 2
        });
        expect(normalizeNotificationGroup({ name: ' Arkadaşlar ', userUids: ['friend-b', 'friend-a'] })).toEqual({
            name: 'Arkadaşlar',
            userUids: ['friend-a', 'friend-b']
        });
        expect(maskEmail('omer@example.com')).toBe('o***@example.com');
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
            { method: 'PUT', segments: ['data-source'] },
            { method: 'POST', segments: ['data-refresh'] },
            { method: 'GET', segments: ['player-status'] },
            { method: 'PUT', segments: ['player-status', 'draft'] },
            { method: 'POST', segments: ['player-status', 'publish'] },
            { method: 'GET', segments: ['lineups', '401888314'] },
            { method: 'PUT', segments: ['lineups', '401888314', 'draft'] },
            { method: 'POST', segments: ['lineups', '401888314', 'publish'] },
            { method: 'POST', segments: ['lineups', '401888314', 'release'] },
            { method: 'POST', segments: ['lineups', '401888314', 'unpublish'] },
            { method: 'GET', segments: ['users'] },
            { method: 'GET', segments: ['notification-groups'] },
            { method: 'POST', segments: ['notification-groups'] },
            { method: 'PUT', segments: ['notification-groups', '550e8400-e29b-41d4-a716-446655440000'] },
            { method: 'DELETE', segments: ['notification-groups', '550e8400-e29b-41d4-a716-446655440000'] },
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

    it('lets an authenticated admin switch data sources and refresh snapshots', async () => {
        const database = createMemoryDatabase({ cache: {} });
        const refreshDataSnapshots = vi.fn().mockResolvedValue([
            { resource: 'fixtures', status: 'ok', fetchedAt: 123 }
        ]);
        const dependencies = {
            requireAdminClaims: vi.fn().mockResolvedValue({ uid: 'admin-uid', admin: true }),
            database,
            messaging: { send: vi.fn() },
            refreshDataSnapshots
        };

        const sourceRes = makeRes();
        await handleAdminRoute(makeReq('PUT', { resource: 'fixtures', mode: 'cache' }), sourceRes, ['data-source'], dependencies);
        expect(sourceRes.statusCode).toBe(200);
        expect(sourceRes.body.modes).toEqual({ fixtures: 'cache', standings: 'espn', statistics: 'espn' });
        expect(database.state.cache.dataSourceModes.fixtures).toBe('cache');

        const refreshRes = makeRes();
        await handleAdminRoute(makeReq('POST', { resource: 'all', seasonStartYear: 2026 }), refreshRes, ['data-refresh'], dependencies);
        expect(refreshRes.statusCode).toBe(200);
        expect(refreshDataSnapshots).toHaveBeenCalledWith({
            resources: 'all',
            seasonStartYear: 2026,
            database
        });
        expect(Object.values(database.state.ops.adminAudit)).toEqual(expect.arrayContaining([
            expect.objectContaining({ action: 'data_source.updated', uid: 'admin-uid' }),
            expect.objectContaining({ action: 'data_cache.refreshed', uid: 'admin-uid' })
        ]));
    });

    it('removes a published lineup without deleting its draft or ESPN detection', async () => {
        const published = {
            matchId: '401888314',
            homeTeam: { id: 436, name: 'Fenerbahçe' },
            awayTeam: { id: 100, name: 'Opponent' },
            lineups: { home: { starters: [{ name: 'Goalkeeper' }] }, away: null },
            publishedAt: 100,
            updatedAt: 100
        };
        const detection = { status: 'ready', payload: published };
        const draft = { formation: '4-2-3-1', players: [], updatedAt: 90 };
        const database = createMemoryDatabase({
            cache: {
                nextMatch: {
                    id: 401888314,
                    startTimestamp: 1_800_000_000,
                    homeTeam: { id: 436, name: 'Fenerbahçe' },
                    awayTeam: { id: 100, name: 'Opponent' }
                },
                next3Matches: [],
                matchLineups: { '401888314': published }
            },
            ops: {
                lineups: { '401888314': { detection, manualLocked: true } },
                adminDrafts: { 'admin-uid': { '401888314': draft } }
            }
        });
        const res = makeRes();
        await handleAdminRoute(makeReq('POST', {}), res, ['lineups', '401888314', 'unpublish'], {
            requireAdminClaims: vi.fn().mockResolvedValue({ uid: 'admin-uid', admin: true }),
            database,
            messaging: { send: vi.fn() }
        });

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ success: true, published: null, manualLocked: true });
        expect(database.state.cache.matchLineups?.['401888314']).toBeUndefined();
        expect(database.state.ops.lineups['401888314'].manualLocked).toBe(true);
        expect(database.state.ops.lineups['401888314'].detection).toEqual(detection);
        expect(database.state.ops.adminDrafts['admin-uid']['401888314']).toEqual(draft);
        expect(Object.values(database.state.ops.adminAudit)).toEqual(expect.arrayContaining([
            expect.objectContaining({
                action: 'lineup.unpublished',
                uid: 'admin-uid',
                details: expect.objectContaining({ matchId: '401888314', hadPublishedLineup: true })
            })
        ]));
    });

    it('publishes the exact manual formation slots independently of draft array order', async () => {
        const slotPlayers = [
            ['RAM', 'Greenwood', 'Forward'],
            ['GK', 'Ederson', 'Midfielder'],
            ['LAM', 'Aydin', 'Midfielder'],
            ['CAM', 'Talisca', 'Midfielder'],
            ['ST', 'Muriqi', 'Forward'],
            ['CDM1', 'Kante', 'Midfielder'],
            ['CDM2', 'Guendouzi', 'Midfielder'],
            ['LB', 'Brown', 'Defender'],
            ['CB1', 'Ake', 'Defender'],
            ['CB2', 'Skriniar', 'Defender'],
            ['RB', 'Semedo', 'Defender']
        ];
        const draft = {
            formation: '4-2-3-1',
            players: slotPlayers.map(([slot, name, position], index) => ({
                slot,
                name,
                position,
                id: index + 1,
                number: index + 1
            }))
        };
        const database = createMemoryDatabase({
            cache: {
                nextMatch: {
                    id: 401888314,
                    startTimestamp: 1_800_000_000,
                    homeTeam: { id: 436, name: 'Fenerbahçe' },
                    awayTeam: { id: 100, name: 'Opponent' }
                },
                next3Matches: []
            },
            ops: { adminDrafts: { 'admin-uid': { '401888314': draft } } }
        });
        const res = makeRes();

        await handleAdminRoute(makeReq('POST', { mode: 'manual' }), res, ['lineups', '401888314', 'publish'], {
            requireAdminClaims: vi.fn().mockResolvedValue({ uid: 'admin-uid', admin: true }),
            database,
            messaging: { send: vi.fn() }
        });

        expect(res.statusCode).toBe(200);
        const starters = database.state.cache.matchLineups['401888314'].lineups.home.starters;
        const byName = (name) => starters.find((player) => player.name === name);
        expect(starters.map((player) => player.formationSlot)).toEqual([
            'GK', 'RB', 'LB', 'CDM1', 'CB2', 'CB1', 'RAM', 'CDM2', 'ST', 'CAM', 'LAM'
        ]);
        expect(byName('Muriqi')).toMatchObject({ formationSlot: 'ST', formationPlace: 9, positionCode: 'ST' });
        expect(byName('Greenwood')).toMatchObject({ formationSlot: 'RAM', formationPlace: 7, positionCode: 'RAM' });
        expect(byName('Ederson')).toMatchObject({ formationSlot: 'GK', formationPlace: 1, positionCode: 'GK' });
        expect(database.state.ops.lineups['401888314'].manualLocked).toBe(true);
        expect(res.body.published.sources).toEqual({ home: 'manual', away: null });
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

    it('returns a paginated, masked notification directory without exposing device tokens', async () => {
        const database = createMemoryDatabase({
            notifications: {
                'friend-a': { fcmToken: 'secret-token-a', generalNotifications: true },
                'friend-b': { fcmToken: 'secret-token-b', generalNotifications: false }
            }
        });
        const authService = {
            listUsers: vi.fn().mockResolvedValue({
                users: [
                    { uid: 'friend-a', displayName: 'Ali', email: 'ali@example.com', photoURL: 'https://images.example/ali.png', disabled: false },
                    { uid: 'friend-b', displayName: '', email: 'b@example.com', photoURL: 'javascript:alert(1)', disabled: false },
                    { uid: 'invalid uid', displayName: 'Unsupported', email: 'unsupported@example.com', disabled: false }
                ],
                pageToken: 'next-page'
            })
        };
        const res = makeRes();

        await handleAdminRoute(makeReq('GET', {}, { limit: '50', pageToken: 'current-page' }), res, ['users'], {
            requireAdminClaims: vi.fn().mockResolvedValue({ uid: 'admin-uid', admin: true }),
            database,
            authService,
            messaging: { send: vi.fn() }
        });

        expect(res.statusCode).toBe(200);
        expect(authService.listUsers).toHaveBeenCalledWith(50, 'current-page');
        expect(res.body.nextPageToken).toBe('next-page');
        expect(res.body.users).toEqual([
            expect.objectContaining({ id: 'friend-a', displayName: 'Ali', maskedEmail: 'a***@example.com', notificationStatus: 'eligible', eligible: true }),
            expect.objectContaining({ id: 'friend-b', displayName: 'İsimsiz kullanıcı', maskedEmail: 'b***@example.com', photoURL: null, notificationStatus: 'opted_out', eligible: false }),
            expect.objectContaining({ id: 'invalid uid', notificationStatus: 'unsupported', eligible: false })
        ]);
        expect(JSON.stringify(res.body)).not.toContain('secret-token');
    });

    it('creates, revision-updates, lists, and deletes private saved notification groups', async () => {
        const database = createMemoryDatabase({
            notifications: {
                'friend-a': { fcmToken: 'token-a', generalNotifications: true },
                'friend-b': { fcmToken: 'token-b', generalNotifications: true }
            }
        });
        const users = [
            { uid: 'friend-a', disabled: false },
            { uid: 'friend-b', disabled: false }
        ];
        const dependencies = {
            requireAdminClaims: vi.fn().mockResolvedValue({ uid: 'admin-uid', admin: true }),
            database,
            authService: { getUsers: vi.fn().mockResolvedValue({ users, notFound: [] }) },
            messaging: { send: vi.fn() }
        };

        const createRes = makeRes();
        await handleAdminRoute(makeReq('POST', { name: 'Yakın arkadaşlar', userUids: ['friend-b', 'friend-a'] }), createRes, ['notification-groups'], dependencies);
        expect(createRes.statusCode).toBe(201);
        expect(createRes.body.group).toMatchObject({ name: 'Yakın arkadaşlar', userUids: ['friend-a', 'friend-b'], revision: 1 });
        const groupId = createRes.body.group.id;
        expect(database.state.ops.adminNotificationGroups['admin-uid'][groupId].updatedBy).toBe('admin-uid');

        const updateRes = makeRes();
        await handleAdminRoute(makeReq('PUT', { name: 'Maç ekibi', userUids: ['friend-a'], baseRevision: 1 }), updateRes, ['notification-groups', groupId], dependencies);
        expect(updateRes.statusCode).toBe(200);
        expect(updateRes.body.group).toMatchObject({ name: 'Maç ekibi', userUids: ['friend-a'], revision: 2 });

        const listRes = makeRes();
        await handleAdminRoute(makeReq('GET'), listRes, ['notification-groups'], dependencies);
        expect(listRes.body.groups).toEqual([expect.objectContaining({ id: groupId, name: 'Maç ekibi', revision: 2 })]);

        const staleDeleteRes = makeRes();
        await handleAdminRoute(makeReq('DELETE', { baseRevision: 1 }), staleDeleteRes, ['notification-groups', groupId], dependencies);
        expect(staleDeleteRes.statusCode).toBe(409);

        const deleteRes = makeRes();
        await handleAdminRoute(makeReq('DELETE', { baseRevision: 2 }), deleteRes, ['notification-groups', groupId], dependencies);
        expect(deleteRes.statusCode).toBe(200);
        expect(database.state.ops.adminNotificationGroups?.['admin-uid']?.[groupId]).toBeUndefined();
    });

    it('requires an exact self-test before targeted delivery and clears only invalid current tokens', async () => {
        const database = createMemoryDatabase({
            notifications: {
                'admin-uid': { fcmToken: 'admin-token', generalNotifications: true },
                'friend-a': { fcmToken: 'invalid-token-a', generalNotifications: true },
                'friend-b': { fcmToken: 'token-b', generalNotifications: false }
            }
        });
        const messaging = {
            send: vi.fn().mockResolvedValue('self-test-message'),
            sendEachForMulticast: vi.fn().mockResolvedValue({
                successCount: 0,
                failureCount: 1,
                responses: [{ success: false, error: { code: 'messaging/registration-token-not-registered' } }]
            })
        };
        const authService = {
            getUsers: vi.fn().mockResolvedValue({
                users: [
                    { uid: 'friend-a', disabled: false },
                    { uid: 'friend-b', disabled: false }
                ],
                notFound: []
            })
        };
        const dependencies = {
            requireAdminClaims: vi.fn().mockResolvedValue({ uid: 'admin-uid', admin: true }),
            database,
            authService,
            messaging
        };
        const payload = {
            title: 'Maç başladı',
            body: 'Resmî paylaşımı aç.',
            url: 'https://x.com/Fenerbahce/status/123456',
            audience: { type: 'users', userUids: ['friend-a', 'friend-b'] }
        };

        const untestedRes = makeRes();
        await handleAdminRoute(makeReq('POST', { ...payload, testId: '550e8400-e29b-41d4-a716-446655440000' }), untestedRes, ['notifications', 'send'], dependencies);
        expect(untestedRes.statusCode).toBe(409);
        expect(messaging.sendEachForMulticast).not.toHaveBeenCalled();

        const testRes = makeRes();
        await handleAdminRoute(makeReq('POST', payload), testRes, ['notifications', 'test'], dependencies);
        expect(testRes.statusCode).toBe(200);
        expect(messaging.send).toHaveBeenCalledWith(expect.objectContaining({
            token: 'admin-token',
            data: expect.objectContaining({ url: payload.url, type: 'adminTest' })
        }));

        const changedRes = makeRes();
        await handleAdminRoute(makeReq('POST', { ...payload, body: 'Değişti', testId: testRes.body.testId }), changedRes, ['notifications', 'send'], dependencies);
        expect(changedRes.statusCode).toBe(409);
        expect(messaging.sendEachForMulticast).not.toHaveBeenCalled();

        const sendRes = makeRes();
        await handleAdminRoute(makeReq('POST', { ...payload, testId: testRes.body.testId }), sendRes, ['notifications', 'send'], dependencies);
        expect(sendRes.statusCode).toBe(200);
        expect(sendRes.body.delivery).toEqual({ requested: 2, eligible: 1, accepted: 0, failed: 1, skipped: 1 });
        expect(messaging.sendEachForMulticast).toHaveBeenCalledWith({
            tokens: ['invalid-token-a'],
            data: expect.objectContaining({ type: 'adminTargeted', url: payload.url })
        });
        expect(database.state.notifications['friend-a']).toMatchObject({
            fcmToken: null,
            tokenInvalidCode: 'messaging/registration-token-not-registered'
        });
        expect(database.state.notifications['friend-b'].fcmToken).toBe('token-b');
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
