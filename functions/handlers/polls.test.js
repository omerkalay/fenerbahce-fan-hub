import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.FIREBASE_CONFIG = JSON.stringify({
    projectId: 'test-dummy',
    databaseURL: 'https://test-dummy.firebaseio.com',
});
process.env.GCLOUD_PROJECT = 'test-dummy';

const config = await import('../config.js');

const mockTransaction = vi.fn();
const mockRef = vi.fn(() => ({ transaction: mockTransaction }));
const mockVerifyIdToken = vi.fn();

config.db.ref = mockRef;
Object.defineProperty(config.admin, 'auth', {
    value: () => ({ verifyIdToken: mockVerifyIdToken }),
    writable: true,
    configurable: true,
});

const { handlePollVote } = await import('./polls.js');

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

function setupAuth(uid) {
    if (uid) {
        mockVerifyIdToken.mockResolvedValue({ uid });
    } else {
        mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));
    }
}

describe('handlePollVote', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        config.db.ref = mockRef;
    });

    it('returns early (401) when auth is missing', async () => {
        const res = makeRes();
        await handlePollVote(makeReq(), res);
        expect(res._status).toBe(401);
    });

    it('returns 400 when matchId is missing', async () => {
        setupAuth('uid-1');
        const res = makeRes();
        await handlePollVote(
            makeReq({ authUid: 'uid-1', body: { option: 'home' } }),
            res
        );
        expect(res._status).toBe(400);
        expect(res._json).toEqual({ error: 'Match ID required' });
    });

    it('returns 400 when matchId contains slash', async () => {
        setupAuth('uid-1');
        const res = makeRes();
        await handlePollVote(
            makeReq({ authUid: 'uid-1', body: { matchId: 'a/b', option: 'home' } }),
            res
        );
        expect(res._status).toBe(400);
        expect(res._json).toEqual({ error: 'Invalid match ID' });
    });

    it('returns 400 for invalid vote option', async () => {
        setupAuth('uid-1');
        const res = makeRes();
        await handlePollVote(
            makeReq({ authUid: 'uid-1', body: { matchId: '123', option: 'invalid' } }),
            res
        );
        expect(res._status).toBe(400);
        expect(res._json).toEqual({ error: 'Invalid vote option' });
    });

    it('increments correct count on first vote', async () => {
        setupAuth('uid-1');
        mockTransaction.mockImplementation(async (fn) => {
            const result = fn(null);
            return { snapshot: { val: () => result } };
        });

        const res = makeRes();
        await handlePollVote(
            makeReq({ authUid: 'uid-1', body: { matchId: '123', option: 'home' } }),
            res
        );

        expect(res._status).toBe(200);
        expect(res._json.success).toBe(true);
        expect(res._json.votes.home).toBe(1);
        expect(res._json.votes.away).toBe(0);
        expect(res._json.votes.draw).toBe(0);
        expect(res._json.userVote).toBe('home');
        expect(res._json.alreadyVoted).toBe(false);
    });

    it('returns alreadyVoted true when user votes again', async () => {
        setupAuth('uid-1');
        mockTransaction.mockImplementation(async (fn) => {
            const existing = {
                votes: { home: 5, away: 3, draw: 2 },
                users: { 'uid-1': 'home' },
            };
            const result = fn(existing);
            return { snapshot: { val: () => result } };
        });

        const res = makeRes();
        await handlePollVote(
            makeReq({ authUid: 'uid-1', body: { matchId: '123', option: 'away' } }),
            res
        );

        expect(res._json.alreadyVoted).toBe(true);
        expect(res._json.userVote).toBe('home');
        expect(res._json.votes.home).toBe(5);
    });

    it('returns 500 when transaction throws', async () => {
        setupAuth('uid-1');
        mockTransaction.mockRejectedValue(new Error('DB error'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = makeRes();
        await handlePollVote(
            makeReq({ authUid: 'uid-1', body: { matchId: '123', option: 'draw' } }),
            res
        );

        expect(res._status).toBe(500);
        expect(res._json).toEqual({ error: 'Oy kaydedilemedi.' });
        consoleSpy.mockRestore();
    });

    it('normalizes votes correctly from existing data', async () => {
        setupAuth('uid-2');
        mockTransaction.mockImplementation(async (fn) => {
            const existing = {
                votes: { home: 10, away: 'garbage', draw: null },
                users: {},
            };
            const result = fn(existing);
            return { snapshot: { val: () => result } };
        });

        const res = makeRes();
        await handlePollVote(
            makeReq({ authUid: 'uid-2', body: { matchId: '456', option: 'away' } }),
            res
        );

        expect(res._json.votes.home).toBe(10);
        expect(res._json.votes.away).toBe(1);
        expect(res._json.votes.draw).toBe(0);
    });
});
