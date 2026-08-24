import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.FIREBASE_CONFIG = JSON.stringify({
    projectId: 'test-dummy',
    databaseURL: 'https://test-dummy.firebaseio.com'
});
process.env.GCLOUD_PROJECT = 'test-dummy';

const config = await import('../config.js');
const verifyIdToken = vi.fn();
Object.defineProperty(config.admin, 'auth', {
    value: () => ({ verifyIdToken }),
    writable: true,
    configurable: true
});

const { requireAdminClaims } = await import('./middleware.js');

const makeRes = () => {
    const res = {
        statusCode: 200,
        body: null,
        status(code) { res.statusCode = code; return res; },
        json(value) { res.body = value; return res; }
    };
    return res;
};

describe('admin authentication middleware', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 401 without a bearer token', async () => {
        const res = makeRes();
        const claims = await requireAdminClaims({ headers: {} }, res);
        expect(claims).toBeNull();
        expect(res.statusCode).toBe(401);
    });

    it('returns 403 for an authenticated non-admin user', async () => {
        verifyIdToken.mockResolvedValue({ uid: 'regular-user', admin: false });
        const res = makeRes();
        const claims = await requireAdminClaims({ headers: { authorization: 'Bearer token' } }, res);
        expect(claims).toBeNull();
        expect(res.statusCode).toBe(403);
        expect(verifyIdToken).toHaveBeenCalledWith('token', true);
    });

    it('accepts only a non-revoked token carrying the admin claim', async () => {
        verifyIdToken.mockResolvedValue({ uid: 'admin-user', admin: true });
        const res = makeRes();
        const claims = await requireAdminClaims({ headers: { authorization: 'Bearer admin-token' } }, res);
        expect(claims).toEqual({ uid: 'admin-user', admin: true });
        expect(res.statusCode).toBe(200);
        expect(verifyIdToken).toHaveBeenCalledWith('admin-token', true);
    });

    it('returns 401 when token verification or revocation checking fails', async () => {
        verifyIdToken.mockRejectedValue({ code: 'auth/id-token-revoked' });
        const res = makeRes();
        const claims = await requireAdminClaims({ headers: { authorization: 'Bearer revoked-token' } }, res);
        expect(claims).toBeNull();
        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: 'Invalid or revoked auth token' });
    });
});
