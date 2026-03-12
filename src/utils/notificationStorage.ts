import type { NotificationOptions } from '../types';
import { normalizeOptions, createEmptyOptions } from './notificationHelpers';

const OPTIONS_KEY = 'fb_notification_options';
const ACTIVE_KEY = 'fb_has_notifications';
export const FCM_TOKEN_KEY = 'fb_fcm_token';

export const loadSavedOptions = (): NotificationOptions => {
    const saved = localStorage.getItem(OPTIONS_KEY);
    if (saved) {
        try {
            return normalizeOptions(JSON.parse(saved));
        } catch {
            return createEmptyOptions();
        }
    }
    return createEmptyOptions();
};

export const loadHasNotifications = (): boolean =>
    localStorage.getItem(ACTIVE_KEY) === 'true';

export const persistOptions = (options: NotificationOptions, hasActive: boolean): void => {
    if (hasActive) {
        localStorage.setItem(ACTIVE_KEY, 'true');
        localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
    } else {
        localStorage.removeItem(ACTIVE_KEY);
        localStorage.removeItem(OPTIONS_KEY);
    }
};

export const clearNotificationStorage = (): void => {
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem(OPTIONS_KEY);
};

export const loadFcmToken = (): string | null =>
    localStorage.getItem(FCM_TOKEN_KEY);

export const persistFcmToken = (token: string): void =>
    localStorage.setItem(FCM_TOKEN_KEY, token);

export const clearFcmToken = (): void =>
    localStorage.removeItem(FCM_TOKEN_KEY);

export const loadSavedOptionsRaw = (): NotificationOptions | null => {
    const saved = localStorage.getItem(OPTIONS_KEY);
    if (!saved) return null;
    try {
        return normalizeOptions(JSON.parse(saved));
    } catch {
        return null;
    }
};
