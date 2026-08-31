import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

process.env.FIREBASE_CONFIG = JSON.stringify({
    projectId: 'test-dummy',
    databaseURL: 'https://test-dummy.firebaseio.com'
});
process.env.GCLOUD_PROJECT = 'test-dummy';

const require = createRequire(import.meta.url);
const { api } = require('./handlers/api');
const {
    dailyDataRefresh,
    dailyDataRefreshEurope,
    runDailyDataRefresh
} = require('./schedulers/dailyRefresh');
const {
    updateLiveMatch,
    updateLiveMatchEurope,
    runUpdateLiveMatch
} = require('./schedulers/liveMatch');
const {
    checkMatchNotifications,
    checkMatchNotificationsEurope,
    runCheckMatchNotifications
} = require('./schedulers/notifications');
const {
    reconcileTopicSync,
    reconcileTopicSyncEurope
} = require('./schedulers/topicSync');

const region = (fn) => fn.__endpoint.region;
const schedule = (fn) => fn.__endpoint.scheduleTrigger.schedule;

describe('regional function deployment', () => {
    it('keeps the HTTP API available in both regions during cutover', () => {
        expect(region(api)).toEqual(['us-central1', 'europe-west1']);
    });

    it('keeps rollback schedulers in the US and creates equivalent Europe schedulers', () => {
        const pairs = [
            [dailyDataRefresh, dailyDataRefreshEurope],
            [updateLiveMatch, updateLiveMatchEurope],
            [checkMatchNotifications, checkMatchNotificationsEurope],
            [reconcileTopicSync, reconcileTopicSyncEurope]
        ];

        for (const [usFunction, europeFunction] of pairs) {
            expect(region(usFunction)).toEqual(['us-central1']);
            expect(region(europeFunction)).toEqual(['europe-west1']);
            expect(schedule(europeFunction)).toBe(schedule(usFunction));
        }
    });

    it('exposes shared handlers instead of duplicating scheduler behavior', () => {
        expect(runDailyDataRefresh).toBeTypeOf('function');
        expect(runUpdateLiveMatch).toBeTypeOf('function');
        expect(runCheckMatchNotifications).toBeTypeOf('function');
    });
});
