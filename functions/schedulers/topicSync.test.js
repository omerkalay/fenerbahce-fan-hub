import { describe, expect, it, vi } from 'vitest';

process.env.FIREBASE_CONFIG = JSON.stringify({
    projectId: 'test-dummy',
    databaseURL: 'https://test-dummy.firebaseio.com'
});
process.env.GCLOUD_PROJECT = 'test-dummy';

const { createTopicSyncReconciler } = await import('./topicSync.js');

const snapshot = (value) => ({ val: () => value });

const buildDatabase = ({ pending = {}, cleanup = {} } = {}) => {
    const queryOnce = vi
        .fn()
        .mockResolvedValueOnce(snapshot(pending))
        .mockResolvedValueOnce(snapshot(cleanup));
    const query = {
        orderByChild: vi.fn(() => query),
        equalTo: vi.fn(() => query),
        startAt: vi.fn(() => query),
        once: queryOnce
    };
    const update = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockResolvedValue(undefined);
    const ref = vi.fn((path) => path === 'notifications' ? query : { update, set });

    return { database: { ref }, query, queryOnce, ref, update, set };
};

describe('topic sync reconciler', () => {
    it('queries only pending syncs and deferred old-token cleanup records', async () => {
        const dbMock = buildDatabase();
        const messaging = {
            subscribeToTopic: vi.fn(),
            unsubscribeFromTopic: vi.fn()
        };

        await createTopicSyncReconciler({ database: dbMock.database, messaging })();

        expect(dbMock.query.orderByChild).toHaveBeenNthCalledWith(1, 'topicSync/allFans/pending');
        expect(dbMock.query.orderByChild).toHaveBeenNthCalledWith(2, 'topicSync/allFans/oldTokenToCleanup');
        expect(dbMock.query.equalTo).toHaveBeenCalledWith(true);
        expect(dbMock.query.startAt).toHaveBeenCalledWith('');
        expect(dbMock.queryOnce).toHaveBeenCalledTimes(2);
    });

    it('reconciles a pending subscription without scanning unrelated users', async () => {
        const dbMock = buildDatabase({
            pending: {
                'uid-1': {
                    topicSync: { allFans: { pending: true, desired: true, token: 'token-1' } }
                }
            }
        });
        const messaging = {
            subscribeToTopic: vi.fn().mockResolvedValue({ failureCount: 0 }),
            unsubscribeFromTopic: vi.fn()
        };

        await createTopicSyncReconciler({
            database: dbMock.database,
            messaging,
            now: () => 123
        })();

        expect(messaging.subscribeToTopic).toHaveBeenCalledWith('token-1', 'all_fans');
        expect(dbMock.ref).toHaveBeenCalledWith('notifications/uid-1/topicSync/allFans');
        expect(dbMock.update).toHaveBeenCalledWith({
            pending: false,
            lastAttemptAt: 123,
            lastSyncedAt: 123,
            lastError: null
        });
    });

    it('clears a deferred old token after the primary sync is already resolved', async () => {
        const data = {
            topicSync: {
                allFans: { pending: false, oldTokenToCleanup: 'old-token' }
            }
        };
        const dbMock = buildDatabase({ cleanup: { 'uid-1': data } });
        const messaging = {
            subscribeToTopic: vi.fn(),
            unsubscribeFromTopic: vi.fn().mockResolvedValue({ failureCount: 0 })
        };

        await createTopicSyncReconciler({ database: dbMock.database, messaging })();

        expect(messaging.unsubscribeFromTopic).toHaveBeenCalledWith('old-token', 'all_fans');
        expect(dbMock.ref).toHaveBeenCalledWith(
            'notifications/uid-1/topicSync/allFans/oldTokenToCleanup'
        );
        expect(dbMock.set).toHaveBeenCalledWith(null);
    });
});
