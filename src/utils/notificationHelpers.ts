/**
 * Pure notification option helpers — no side effects.
 */
import type { NotificationOptions } from '../types';

export const createEmptyOptions = (): NotificationOptions => ({
    generalNotifications: false,
    threeHours: false,
    oneHour: false,
    thirtyMinutes: false,
    fifteenMinutes: false,
    dailyCheck: false
});

export const normalizeOptions = (options?: Partial<NotificationOptions>): NotificationOptions => ({
    ...createEmptyOptions(),
    ...options
});

export const countEnabledOptions = (options: NotificationOptions): number => (
    Object.entries(options).filter(([key, value]) => key !== 'updatedAt' && value === true).length
);

export const MATCH_OPTION_KEYS = ['threeHours', 'oneHour', 'thirtyMinutes', 'fifteenMinutes', 'dailyCheck'] as const;

export const countMatchOptions = (options: NotificationOptions): number => (
    MATCH_OPTION_KEYS.filter(key => options[key]).length
);

const VAPID_KEY = 'BL36u1e0V4xvIyP8n_Nh1Uc_EZTquN1vNv58E3wm_q3IsQ916MfhsbF1NATwfeoitmAIyhMTC5TdhB7CSBRAz-4';

/** Try getToken; on AbortError clear stale push subscription and retry once. */
export const acquireFcmToken = async (): Promise<string | null> => {
    const { messaging } = await import('../firebase');
    const { getToken } = await import('firebase/messaging');
    if (!messaging) return null;

    const registration = await navigator.serviceWorker.ready;

    const attempt = () =>
        getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });

    try {
        return await attempt();
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            console.warn('Push subscription stale, clearing and retrying\u2026');
            try {
                const sub = await registration.pushManager.getSubscription();
                if (sub) await sub.unsubscribe();
            } catch { /* ignore unsubscribe failure */ }
            return await attempt();
        }
        throw err;
    }
};
