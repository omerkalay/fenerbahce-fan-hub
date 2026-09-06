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
    dailyDataRefreshEurope,
    runDailyDataRefresh
} = require('./schedulers/dailyRefresh');
const {
    updateLiveMatchEurope,
    runUpdateLiveMatch
} = require('./schedulers/liveMatch');
const {
    checkMatchNotificationsEurope,
    runCheckMatchNotifications
} = require('./schedulers/notifications');
const {
    reconcileTopicSyncEurope
} = require('./schedulers/topicSync');

const region = (fn) => fn.__endpoint.region;
const schedule = (fn) => fn.__endpoint.scheduleTrigger.schedule;

describe('regional function deployment', () => {
    it('keeps the legacy HTTP API available while old PWA clients still use it', () => {
        expect(region(api)).toEqual(['us-central1', 'europe-west1']);
    });

    it('deploys only Europe schedulers with their established schedules', () => {
        const scheduledFunctions = [
            [dailyDataRefreshEurope, '0 3 * * *'],
            [updateLiveMatchEurope, 'every 1 minutes'],
            [checkMatchNotificationsEurope, 'every 1 minutes'],
            [reconcileTopicSyncEurope, 'every 5 minutes']
        ];

        for (const [fn, expectedSchedule] of scheduledFunctions) {
            expect(region(fn)).toEqual(['europe-west1']);
            expect(schedule(fn)).toBe(expectedSchedule);
        }
        expect(checkMatchNotificationsEurope.__endpoint.maxInstances).toBe(1);
        expect(reconcileTopicSyncEurope.__endpoint.maxInstances).toBe(1);
    });

    it('does not reintroduce retired US schedulers through the deployment entry point', () => {
        expect(Object.keys(require('./index')).sort()).toEqual([
            'api',
            'checkMatchNotificationsEurope',
            'dailyDataRefreshEurope',
            'reconcileTopicSyncEurope',
            'updateLiveMatchEurope'
        ]);
    });

    it('exposes shared handlers instead of duplicating scheduler behavior', () => {
        expect(runDailyDataRefresh).toBeTypeOf('function');
        expect(runUpdateLiveMatch).toBeTypeOf('function');
        expect(runCheckMatchNotifications).toBeTypeOf('function');
    });
});
