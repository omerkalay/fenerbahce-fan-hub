import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set env BEFORE any Firebase modules load
process.env.FIREBASE_CONFIG = JSON.stringify({
    projectId: 'test-dummy',
    databaseURL: 'https://test-dummy.firebaseio.com',
});
process.env.GCLOUD_PROJECT = 'test-dummy';

// Now import config — the real config.js will load with env vars
const config = await import('../config.js');

// Replace config exports with mocks
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockOnce = vi.fn();
const mockRef = vi.fn(() => ({
    once: mockOnce,
    update: mockUpdate,
    set: mockSet,
}));
const mockSubscribeToTopic = vi.fn();
const mockUnsubscribeFromTopic = vi.fn();
const mockVerifyIdToken = vi.fn();

// Override config exports with mocks
config.db.ref = mockRef;
Object.defineProperty(config.admin, 'messaging', {
    value: () => ({
        subscribeToTopic: mockSubscribeToTopic,
        unsubscribeFromTopic: mockUnsubscribeFromTopic,
    }),
    writable: true,
    configurable: true,
});
Object.defineProperty(config.admin, 'auth', {
    value: () => ({
        verifyIdToken: mockVerifyIdToken,
    }),
    writable: true,
    configurable: true,
});

const { handleReminder, handleReminderPreferences } = await import('./api.js');

// ─── Helpers ─────────────────────────────────────────────

function makeReq({ body, method = 'POST', authUid } = {}) {
    const headers = {};
    if (authUid) {
        headers.authorization = `Bearer fake-token-for-${authUid}`;
    }
    return { method, headers, body: body ?? {} };
}

function makeRes() {
    const res = {
        _status: 200,
        _json: null,
        status(code) { res._status = code; return res; },
        json(data) { res._json = data; return res; },
        set() { return res; },
    };
    return res;
}

function snapshotVal(val) {
    return { val: () => val };
}

function setupAuth(uid) {
    if (uid) {
        mockVerifyIdToken.mockResolvedValue({ uid });
    } else {
        mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));
    }
}

// ─── handleReminder (POST /reminder) ────────────────────

describe('handleReminder', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRef.mockImplementation(() => ({
            once: mockOnce,
            update: mockUpdate,
            set: mockSet,
        }));
        config.db.ref = mockRef;
        mockSubscribeToTopic.mockResolvedValue({ failureCount: 0 });
        mockUnsubscribeFromTopic.mockResolvedValue({ failureCount: 0 });
        mockOnce.mockResolvedValue(snapshotVal(null));
    });

    it('returns early when auth fails (no bearer token)', async () => {
        const res = makeRes();
        await handleReminder(makeReq(), res);
        expect(res._status).toBe(401);
    });

    it('returns 403 when uid in body mismatches authenticated uid', async () => {
        setupAuth('real-uid');
        const res = makeRes();
        await handleReminder(makeReq({ authUid: 'real-uid', body: { uid: 'other-uid', options: {} } }), res);
        expect(res._status).toBe(403);
        expect(res._json).toEqual({ error: 'UID mismatch' });
    });

    it('returns 400 when options is missing', async () => {
        setupAuth('uid-1');
        const res = makeRes();
        await handleReminder(makeReq({ authUid: 'uid-1', body: { fcmToken: 'tok' } }), res);
        expect(res._status).toBe(400);
        expect(res._json).toEqual({ error: 'Missing options' });
    });

    it('returns 400 when fcmToken is missing and not disabling all', async () => {
        setupAuth('uid-1');
        const res = makeRes();
        await handleReminder(makeReq({
            authUid: 'uid-1',
            body: { options: { generalNotifications: true } },
        }), res);
        expect(res._status).toBe(400);
        expect(res._json).toEqual({ error: 'Missing fcmToken' });
    });

    it('returns 400 when fcmToken contains slash (path traversal)', async () => {
        setupAuth('uid-1');
        const res = makeRes();
        await handleReminder(makeReq({
            authUid: 'uid-1',
            body: { fcmToken: 'abc/def', options: { generalNotifications: true } },
        }), res);
        expect(res._status).toBe(400);
        expect(res._json).toEqual({ error: 'Invalid token format' });
    });

    it('returns 400 when oldFcmToken contains slash', async () => {
        setupAuth('uid-1');
        const res = makeRes();
        await handleReminder(makeReq({
            authUid: 'uid-1',
            body: { fcmToken: 'clean', oldFcmToken: '../bad', options: { generalNotifications: true } },
        }), res);
        expect(res._status).toBe(400);
        expect(res._json).toEqual({ error: 'Invalid token format' });
    });

    it('accepts disable-all without fcmToken (generalNotifications false + no token)', async () => {
        setupAuth('uid-1');
        const res = makeRes();
        await handleReminder(makeReq({
            authUid: 'uid-1',
            body: {
                options: {
                    generalNotifications: false, dailyCheck: false,
                    threeHours: false, oneHour: false,
                    thirtyMinutes: false, fifteenMinutes: false,
                },
            },
        }), res);
        expect(res._status).toBe(200);
        expect(res._json.success).toBe(true);
    });

    it('saves expected DB paths under notifications/{uid}', async () => {
        setupAuth('uid-1');
        const res = makeRes();
        await handleReminder(makeReq({
            authUid: 'uid-1',
            body: {
                fcmToken: 'tok-abc',
                options: {
                    generalNotifications: true, dailyCheck: true,
                    threeHours: true, oneHour: false,
                    thirtyMinutes: false, fifteenMinutes: false,
                },
            },
        }), res);

        const rootUpdateCall = mockRef.mock.calls.find(
            (c) => c.length === 0 || c[0] === undefined
        );
        expect(rootUpdateCall).toBeDefined();

        const updateCalls = mockUpdate.mock.calls;
        expect(updateCalls.length).toBeGreaterThanOrEqual(1);
        const rootUpdates = updateCalls[0][0];

        expect(rootUpdates['notifications/uid-1/fcmToken']).toBe('tok-abc');
        expect(rootUpdates['notifications/uid-1/tokenInvalidAt']).toBeNull();
        expect(rootUpdates['notifications/uid-1/tokenInvalidCode']).toBeNull();
        expect(rootUpdates['notifications/uid-1/dailyCheck']).toBe(true);
        expect(rootUpdates['notifications/uid-1/defaultOptions/threeHours']).toBe(true);
        expect(rootUpdates['notifications/uid-1/defaultOptions/oneHour']).toBe(false);
        expect(rootUpdates['notifications/uid-1/defaultOptions/thirtyMinutes']).toBe(false);
        expect(rootUpdates['notifications/uid-1/defaultOptions/fifteenMinutes']).toBe(false);
        expect(rootUpdates['notifications/uid-1/defaultOptions/updatedAt']).toEqual(expect.any(Number));
        expect(rootUpdates['notifications/uid-1/generalNotifications']).toBe(true);
        expect(rootUpdates['notifications/uid-1/topicSync/allFans/pending']).toBe(true);
        expect(rootUpdates['notifications/uid-1/topicSync/allFans/desired']).toBe(true);
        expect(rootUpdates['notifications/uid-1/topicSync/allFans/token']).toBe('tok-abc');
    });

    it('POST response contains required shape fields', async () => {
        setupAuth('uid-1');
        const res = makeRes();
        await handleReminder(makeReq({
            authUid: 'uid-1',
            body: {
                fcmToken: 'tok-abc',
                options: {
                    generalNotifications: true, dailyCheck: false,
                    threeHours: true, oneHour: false,
                    thirtyMinutes: false, fifteenMinutes: false,
                },
            },
        }), res);

        expect(res._status).toBe(200);
        const body = res._json;
        expect(body).toHaveProperty('success', true);
        expect(body).toHaveProperty('message');
        expect(body).toHaveProperty('topicSyncPending');
        expect(body).toHaveProperty('dailyCheckActive');
        expect(body).toHaveProperty('activeNotifications');
        expect(body).toHaveProperty('options');

        expect(body.options).toHaveProperty('generalNotifications');
        expect(body.options).toHaveProperty('threeHours');
        expect(body.options).toHaveProperty('oneHour');
        expect(body.options).toHaveProperty('thirtyMinutes');
        expect(body.options).toHaveProperty('fifteenMinutes');
        expect(body.options).toHaveProperty('dailyCheck');
        expect(body.options).toHaveProperty('updatedAt');
    });

    it('topicSyncPending is false when subscribe succeeds', async () => {
        setupAuth('uid-1');
        mockSubscribeToTopic.mockResolvedValue({ failureCount: 0 });
        const res = makeRes();
        await handleReminder(makeReq({
            authUid: 'uid-1',
            body: { fcmToken: 'tok', options: { generalNotifications: true } },
        }), res);
        expect(res._json.topicSyncPending).toBe(false);
    });

    it('topicSyncPending is true when subscribe fails', async () => {
        setupAuth('uid-1');
        mockSubscribeToTopic.mockResolvedValue({
            failureCount: 1,
            errors: [{ error: { message: 'INVALID_ARGUMENT' } }],
        });
        const res = makeRes();
        await handleReminder(makeReq({
            authUid: 'uid-1',
            body: { fcmToken: 'tok', options: { generalNotifications: true } },
        }), res);
        expect(res._json.topicSyncPending).toBe(true);
    });

    it('topicSyncPending is false when unsubscribing with no token (disable-all)', async () => {
        setupAuth('uid-1');
        mockOnce.mockResolvedValue(snapshotVal(null));
        const res = makeRes();
        await handleReminder(makeReq({
            authUid: 'uid-1',
            body: {
                options: {
                    generalNotifications: false, dailyCheck: false,
                    threeHours: false, oneHour: false,
                    thirtyMinutes: false, fifteenMinutes: false,
                },
            },
        }), res);
        expect(res._json.topicSyncPending).toBe(false);
    });

    it('subscribes to all_fans topic when generalNotifications is true', async () => {
        setupAuth('uid-1');
        const res = makeRes();
        await handleReminder(makeReq({
            authUid: 'uid-1',
            body: { fcmToken: 'tok-sub', options: { generalNotifications: true } },
        }), res);
        expect(mockSubscribeToTopic).toHaveBeenCalledWith('tok-sub', 'all_fans');
    });

    it('unsubscribes from all_fans topic when generalNotifications is false', async () => {
        setupAuth('uid-1');
        const res = makeRes();
        await handleReminder(makeReq({
            authUid: 'uid-1',
            body: { fcmToken: 'tok-unsub', options: { generalNotifications: false, dailyCheck: true } },
        }), res);
        expect(mockUnsubscribeFromTopic).toHaveBeenCalledWith('tok-unsub', 'all_fans');
    });

    it('defers old token cleanup to topicSync/allFans/oldTokenToCleanup when sync is pending', async () => {
        setupAuth('uid-1');
        mockSubscribeToTopic.mockResolvedValue({
            failureCount: 1,
            errors: [{ error: { message: 'fail' } }],
        });
        const res = makeRes();
        await handleReminder(makeReq({
            authUid: 'uid-1',
            body: {
                fcmToken: 'new-tok', oldFcmToken: 'old-tok',
                options: { generalNotifications: true },
            },
        }), res);

        const setCalls = mockSet.mock.calls;
        const deferCall = setCalls.find((c) => c[0] === 'old-tok');
        expect(deferCall).toBeDefined();

        const refCalls = mockRef.mock.calls;
        const deferRefCall = refCalls.find(
            (c) => c[0] === 'notifications/uid-1/topicSync/allFans/oldTokenToCleanup'
        );
        expect(deferRefCall).toBeDefined();
    });

    it('activeNotifications reflects correct count', async () => {
        setupAuth('uid-1');
        const res = makeRes();
        await handleReminder(makeReq({
            authUid: 'uid-1',
            body: {
                fcmToken: 'tok',
                options: {
                    generalNotifications: true, dailyCheck: true,
                    threeHours: true, oneHour: false,
                    thirtyMinutes: false, fifteenMinutes: false,
                },
            },
        }), res);
        expect(res._json.activeNotifications).toBe(3);
    });

    it('dailyCheckActive matches options.dailyCheck', async () => {
        setupAuth('uid-1');
        const res = makeRes();
        await handleReminder(makeReq({
            authUid: 'uid-1',
            body: { fcmToken: 'tok', options: { generalNotifications: true, dailyCheck: true } },
        }), res);
        expect(res._json.dailyCheckActive).toBe(true);
    });

    it('returns 500 when db.ref().update throws', async () => {
        setupAuth('uid-1');
        mockUpdate.mockRejectedValueOnce(new Error('DB down'));
        const res = makeRes();
        await handleReminder(makeReq({
            authUid: 'uid-1',
            body: { fcmToken: 'tok', options: { generalNotifications: true } },
        }), res);
        expect(res._status).toBe(500);
        expect(res._json).toEqual({ error: 'Failed to save preferences' });
    });
});

// ─── handleReminderPreferences (GET /reminder) ──────────

describe('handleReminderPreferences', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRef.mockImplementation(() => ({
            once: mockOnce,
            update: mockUpdate,
            set: mockSet,
        }));
        config.db.ref = mockRef;
    });

    it('returns early when auth fails', async () => {
        const res = makeRes();
        await handleReminderPreferences(makeReq({ method: 'GET' }), res);
        expect(res._status).toBe(401);
    });

    it('returns 404 when no preferences exist', async () => {
        setupAuth('uid-1');
        mockOnce.mockResolvedValue(snapshotVal(null));
        const res = makeRes();
        await handleReminderPreferences(makeReq({ method: 'GET', authUid: 'uid-1' }), res);
        expect(res._status).toBe(404);
        expect(res._json).toEqual({ error: 'Preferences not found' });
    });

    it('returns normalized options, activeNotifications, and topicSyncPending', async () => {
        setupAuth('uid-1');
        mockOnce.mockResolvedValue(snapshotVal({
            fcmToken: 'tok-stored',
            generalNotifications: true,
            dailyCheck: true,
            defaultOptions: {
                threeHours: true, oneHour: false,
                thirtyMinutes: false, fifteenMinutes: false,
                updatedAt: 12345,
            },
            topicSync: { allFans: { pending: true } },
        }));
        const res = makeRes();
        await handleReminderPreferences(makeReq({ method: 'GET', authUid: 'uid-1' }), res);

        expect(res._status).toBe(200);
        const body = res._json;
        expect(body.uid).toBe('uid-1');
        expect(body.fcmToken).toBe('tok-stored');
        expect(body.activeNotifications).toBe(3);
        expect(body.topicSyncPending).toBe(true);
        expect(body.options).toEqual({
            generalNotifications: true,
            threeHours: true, oneHour: false,
            thirtyMinutes: false, fifteenMinutes: false,
            dailyCheck: true, updatedAt: 12345,
        });
    });

    it('topicSyncPending is false when no pending sync', async () => {
        setupAuth('uid-1');
        mockOnce.mockResolvedValue(snapshotVal({ generalNotifications: false }));
        const res = makeRes();
        await handleReminderPreferences(makeReq({ method: 'GET', authUid: 'uid-1' }), res);
        expect(res._json.topicSyncPending).toBe(false);
    });

    it('fcmToken defaults to null when not stored', async () => {
        setupAuth('uid-1');
        mockOnce.mockResolvedValue(snapshotVal({ generalNotifications: true }));
        const res = makeRes();
        await handleReminderPreferences(makeReq({ method: 'GET', authUid: 'uid-1' }), res);
        expect(res._json.fcmToken).toBeNull();
    });

    it('returns 500 when db read throws', async () => {
        setupAuth('uid-1');
        mockOnce.mockRejectedValueOnce(new Error('DB read error'));
        const res = makeRes();
        await handleReminderPreferences(makeReq({ method: 'GET', authUid: 'uid-1' }), res);
        expect(res._status).toBe(500);
        expect(res._json).toEqual({ error: 'Failed to fetch preferences' });
    });
});
