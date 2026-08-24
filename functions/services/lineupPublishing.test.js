import { describe, expect, it, vi } from 'vitest';

process.env.FIREBASE_CONFIG = JSON.stringify({
    projectId: 'test-dummy',
    databaseURL: 'https://test-dummy.firebaseio.com'
});
process.env.GCLOUD_PROJECT = 'test-dummy';

const {
    acquireLineupWriteLock,
    releaseLineupWriteLock,
    mergeDetectedOpponentWithManual,
    mergePublishedWithLiveLineups,
    observeEspnLineups
} = await import('./lineupPublishing.js');

const clone = (value) => value == null ? value : structuredClone(value);

const createDatabase = (initial = {}) => {
    const root = clone(initial);
    const partsFor = (path) => String(path || '').split('/').filter(Boolean);
    const read = (path) => partsFor(path).reduce((value, key) => value?.[key], root);
    const write = (path, value) => {
        const parts = partsFor(path);
        const key = parts.pop();
        let parent = root;
        for (const part of parts) {
            parent[part] ||= {};
            parent = parent[part];
        }
        if (value === null) delete parent[key];
        else parent[key] = clone(value);
    };
    const snapshot = (value) => ({ val: () => clone(value) });

    return {
        data: root,
        ref(path) {
            return {
                once: async () => snapshot(read(path)),
                set: async (value) => write(path, value),
                update: async (value) => write(path, { ...(read(path) || {}), ...clone(value) }),
                transaction: async (updater) => {
                    const current = clone(read(path));
                    const next = updater(current);
                    if (next === undefined) return { committed: false, snapshot: snapshot(current) };
                    write(path, next);
                    return { committed: true, snapshot: snapshot(next) };
                }
            };
        }
    };
};

const makeTeam = (teamId, teamName) => ({
    teamId,
    teamName,
    formation: '4-2-3-1',
    starters: Array.from({ length: 11 }, (_, index) => ({
        name: `${teamName} Player ${index + 1}`,
        jersey: String(index + 1),
        position: index === 0 ? 'Goalkeeper' : 'Midfielder',
        positionGroup: index === 0 ? 'GK' : 'MID',
        formationPlace: index + 1
    })),
    bench: [],
    substitutions: []
});

const lineups = {
    home: makeTeam('1', 'Fenerbahce'),
    away: makeTeam('2', 'Opponent')
};

const scheduledMatch = {
    id: 401888314,
    startTimestamp: 2_000_000,
    homeTeam: { id: 1, name: 'Fenerbahce' },
    awayTeam: { id: 2, name: 'Opponent' }
};

const observe = (database, messaging, overrides = {}) => observeEspnLineups({
    database,
    messaging,
    scheduledMatch,
    espnEventId: '750125',
    league: 'tur.1',
    matchState: 'pre',
    lineups,
    homeTeam: scheduledMatch.homeTeam,
    awayTeam: scheduledMatch.awayTeam,
    now: 1_999_000_000,
    ...overrides
});

describe('lineup publishing', () => {
    it('serializes lineup writes and only lets the lock owner release them', async () => {
        const database = createDatabase();

        expect(await acquireLineupWriteLock(database, '401888314', 'first', 1000)).toBe(true);
        expect(await acquireLineupWriteLock(database, '401888314', 'second', 2000)).toBe(false);
        await releaseLineupWriteLock(database, '401888314', 'second');
        expect(database.data.ops.lineups['401888314'].writeLock.operationId).toBe('first');
        await releaseLineupWriteLock(database, '401888314', 'first');
        expect(database.data.ops.lineups['401888314'].writeLock).toBeUndefined();
    });

    it('keeps the first rollout in observation-only mode by default', async () => {
        const database = createDatabase();
        const messaging = { send: vi.fn() };

        expect((await observe(database, messaging)).status).toBe('observing');
        const second = await observe(database, messaging, { now: 1_999_060_000 });

        expect(second).toMatchObject({ status: 'ready', published: false, reason: 'auto-publish-disabled' });
        expect(database.data.cache?.matchLineups).toBeUndefined();
        expect(messaging.send).not.toHaveBeenCalled();
    });

    it('publishes after two stable observations and permanently deduplicates the push', async () => {
        const database = createDatabase({
            ops: { adminSettings: { lineups: { autoPublishLineups: true, autoPushLineups: true } } }
        });
        const messaging = { send: vi.fn().mockResolvedValue('message-1') };

        await observe(database, messaging);
        const second = await observe(database, messaging, { now: 1_999_060_000 });
        const third = await observe(database, messaging, { now: 1_999_120_000 });

        expect(second.published).toBe(true);
        expect(second.notification.sent).toBe(true);
        expect(third.notification).toEqual({ sent: false, reason: 'deduplicated' });
        expect(messaging.send).toHaveBeenCalledTimes(1);
        expect(database.data.cache.matchLineups['401888314'].espnEventId).toBe('750125');
        expect(database.data.cache.matchLineups['401888314'].updatedAt).toBe(1_999_060_000);
    });

    it('publishes a late lineup without sending a notification', async () => {
        const database = createDatabase({
            ops: { adminSettings: { lineups: { autoPublishLineups: true, autoPushLineups: true } } }
        });
        const messaging = { send: vi.fn() };

        await observe(database, messaging, { matchState: 'in', now: 2_000_010_000 });
        const result = await observe(database, messaging, { matchState: 'in', now: 2_000_070_000 });

        expect(result).toMatchObject({ published: true, notification: { sent: false, reason: 'disabled' } });
        expect(messaging.send).not.toHaveBeenCalled();
    });

    it('records a failed push permanently instead of risking a duplicate retry', async () => {
        const database = createDatabase({
            ops: { adminSettings: { lineups: { autoPublishLineups: true, autoPushLineups: true } } }
        });
        const messaging = { send: vi.fn().mockRejectedValue({ code: 'messaging/internal-error' }) };

        await observe(database, messaging);
        const second = await observe(database, messaging, { now: 1_999_060_000 });
        const third = await observe(database, messaging, { now: 1_999_120_000 });

        expect(second.notification).toEqual({
            sent: false,
            reason: 'failed',
            errorCode: 'messaging/internal-error'
        });
        expect(third.notification).toEqual({ sent: false, reason: 'deduplicated' });
        expect(messaging.send).toHaveBeenCalledTimes(1);
        expect(database.data.ops.lineups['401888314'].notification.status).toBe('failed');
    });

    it('waits for two observations before replacing an already published changed lineup', async () => {
        const database = createDatabase({
            ops: { adminSettings: { lineups: { autoPublishLineups: true, autoPushLineups: false } } }
        });
        const messaging = { send: vi.fn() };
        await observe(database, messaging);
        await observe(database, messaging, { now: 1_999_060_000 });

        const changedLineups = clone(lineups);
        changedLineups.home.starters[10].name = 'Late Replacement';
        const third = await observe(database, messaging, { lineups: changedLineups, now: 1_999_120_000 });
        expect(third).toMatchObject({ status: 'observing' });
        expect(database.data.cache.matchLineups['401888314'].lineups.home.starters[10].name)
            .toBe('Fenerbahce Player 11');

        const fourth = await observe(database, messaging, { lineups: changedLineups, now: 1_999_180_000 });
        expect(fourth).toMatchObject({ status: 'ready', published: true });
        expect(database.data.cache.matchLineups['401888314'].lineups.home.starters[10].name)
            .toBe('Late Replacement');
    });

    it('never overwrites a manually locked Fenerbahce lineup', async () => {
        const database = createDatabase({
            ops: {
                adminSettings: { lineups: { autoPublishLineups: true, autoPushLineups: true } },
                lineups: { '401888314': { manualLocked: true } }
            }
        });
        const messaging = { send: vi.fn() };

        await observe(database, messaging);
        const result = await observe(database, messaging, { now: 1_999_060_000 });

        expect(result).toMatchObject({ published: false, reason: 'manual-lock' });
        expect(database.data.cache?.matchLineups).toBeUndefined();
        expect(messaging.send).not.toHaveBeenCalled();
    });

    it('updates the ESPN opponent while preserving a manually published Fenerbahce lineup', () => {
        const existing = {
            homeTeam: scheduledMatch.homeTeam,
            awayTeam: scheduledMatch.awayTeam,
            lineups: clone(lineups),
            sources: { home: 'manual', away: 'espn' },
            publishedAt: 100
        };
        existing.lineups.home.starters[0].name = 'Manual Goalkeeper';
        const detected = {
            ...existing,
            lineups: clone(lineups),
            sources: { home: 'espn', away: 'espn' }
        };
        detected.lineups.away.starters[0].name = 'Updated Opponent Goalkeeper';

        const merged = mergeDetectedOpponentWithManual(existing, detected, 200);

        expect(merged.lineups.home.starters[0].name).toBe('Manual Goalkeeper');
        expect(merged.lineups.away.starters[0].name).toBe('Updated Opponent Goalkeeper');
        expect(merged.sources).toEqual({ home: 'manual', away: 'espn' });
        expect(merged.publishedAt).toBe(100);
    });

    it('keeps published starters while adding live substitutions', () => {
        const published = clone(lineups);
        const live = clone(lineups);
        live.home.starters[1].name = 'Unexpected overwrite';
        live.home.substitutions = [{ playerIn: 'Sub', playerOut: 'Starter', minute: '70' }];

        const merged = mergePublishedWithLiveLineups(published, live);
        expect(merged.home.starters[1].name).toBe('Fenerbahce Player 2');
        expect(merged.home.substitutions).toEqual(live.home.substitutions);
    });
});
