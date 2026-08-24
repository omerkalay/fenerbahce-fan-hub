import { describe, expect, it } from 'vitest';
import { buildNotificationSchedule } from './notificationSchedule.js';

const matchAt = (id, isoDate) => ({
    id,
    startTimestamp: Math.floor(new Date(isoDate).getTime() / 1000),
    homeTeam: { name: 'Fenerbahçe' },
    awayTeam: { name: 'Rakip' }
});

describe('buildNotificationSchedule', () => {
    it('skips notification records when no daily or match window is active', () => {
        const matches = [matchAt('m1', '2026-08-25T17:00:00Z')];
        const schedule = buildNotificationSchedule(matches, new Date('2026-08-24T12:00:00Z').getTime());

        expect(schedule.shouldReadNotifications).toBe(false);
        expect(schedule.dailyMatch).toBeNull();
        expect(schedule.matchWindows).toEqual([]);
    });

    it('opens the daily window only from 09:00 through 09:04 Istanbul time', () => {
        const matches = [matchAt('m1', '2026-08-24T17:00:00Z')];
        const active = buildNotificationSchedule(matches, new Date('2026-08-24T06:03:00Z').getTime());
        const late = buildNotificationSchedule(matches, new Date('2026-08-24T06:05:00Z').getTime());

        expect(active.dailyMatch?.id).toBe('m1');
        expect(active.shouldReadNotifications).toBe(true);
        expect(late.dailyMatch).toBeNull();
    });

    it('returns only the match reminder window that is currently due', () => {
        const matches = [matchAt('m1', '2026-08-24T17:00:00Z')];
        const schedule = buildNotificationSchedule(matches, new Date('2026-08-24T16:02:00Z').getTime());

        expect(schedule.matchWindows).toHaveLength(1);
        expect(schedule.matchWindows[0]).toMatchObject({
            matchId: 'm1',
            optionKey: 'oneHour',
            timeText: '1 saat kaldı',
            delayMs: 2 * 60 * 1000
        });
    });

    it('keeps the five-minute late-delivery tolerance and closes at minute five', () => {
        const matches = [matchAt('m1', '2026-08-24T17:00:00Z')];
        const inside = buildNotificationSchedule(matches, new Date('2026-08-24T16:04:59Z').getTime());
        const outside = buildNotificationSchedule(matches, new Date('2026-08-24T16:05:00Z').getTime());

        expect(inside.matchWindows.map((window) => window.optionKey)).toContain('oneHour');
        expect(outside.matchWindows.map((window) => window.optionKey)).not.toContain('oneHour');
    });
});
