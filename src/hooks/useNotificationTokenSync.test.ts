// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { User } from 'firebase/auth';

const mockAcquireFcmToken = vi.fn();
const mockLoadFcmToken = vi.fn();
const mockLoadSavedOptionsRaw = vi.fn();
const mockPersistFcmToken = vi.fn();

vi.mock('../services/api', () => ({
    BACKEND_URL: 'https://test.example.com/api',
}));

vi.mock('../utils/notificationHelpers', () => ({
    normalizeOptions: (opts: Record<string, unknown> = {}) => ({
        generalNotifications: false,
        threeHours: false,
        oneHour: false,
        thirtyMinutes: false,
        fifteenMinutes: false,
        dailyCheck: false,
        ...opts,
    }),
    acquireFcmToken: (...args: unknown[]) => mockAcquireFcmToken(...args),
}));

vi.mock('../utils/notificationStorage', () => ({
    loadFcmToken: () => mockLoadFcmToken(),
    loadSavedOptionsRaw: () => mockLoadSavedOptionsRaw(),
    persistFcmToken: (t: string) => mockPersistFcmToken(t),
}));

import useNotificationTokenSync from './useNotificationTokenSync';

function makeUser(uid = 'user-1'): User {
    return {
        uid,
        getIdToken: vi.fn().mockResolvedValue('fake-id-token'),
    } as unknown as User;
}

describe('useNotificationTokenSync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.fetch = vi.fn();

        Object.defineProperty(window, 'Notification', {
            value: { permission: 'granted' },
            writable: true,
            configurable: true,
        });
        Object.defineProperty(navigator, 'serviceWorker', {
            value: { ready: Promise.resolve({}) },
            writable: true,
            configurable: true,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('does not run when notifications are inactive', () => {
        const user = makeUser();
        renderHook(() => useNotificationTokenSync(false, user));
        expect(mockAcquireFcmToken).not.toHaveBeenCalled();
    });

    it('does not POST when user is null', async () => {
        mockAcquireFcmToken.mockResolvedValue('some-token');
        mockLoadFcmToken.mockReturnValue('different-token');
        mockLoadSavedOptionsRaw.mockReturnValue({ generalNotifications: true });

        renderHook(() => useNotificationTokenSync(true, null));

        await waitFor(() => {
            expect(mockAcquireFcmToken).toHaveBeenCalled();
        });
        expect(globalThis.fetch).not.toHaveBeenCalled();
        expect(mockPersistFcmToken).not.toHaveBeenCalled();
    });

    it('does not POST when current token equals stored token', async () => {
        const user = makeUser();
        mockAcquireFcmToken.mockResolvedValue('same-token');
        mockLoadFcmToken.mockReturnValue('same-token');

        renderHook(() => useNotificationTokenSync(true, user));

        await waitFor(() => {
            expect(mockAcquireFcmToken).toHaveBeenCalled();
        });
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('persists token after successful sync', async () => {
        const user = makeUser();
        mockAcquireFcmToken.mockResolvedValue('new-token');
        mockLoadFcmToken.mockReturnValue('old-token');
        mockLoadSavedOptionsRaw.mockReturnValue({ generalNotifications: true });
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            status: 200,
        });

        renderHook(() => useNotificationTokenSync(true, user));

        await waitFor(() => {
            expect(mockPersistFcmToken).toHaveBeenCalledWith('new-token');
        });
    });

    it('sends POST with correct body when tokens differ', async () => {
        const user = makeUser();
        mockAcquireFcmToken.mockResolvedValue('new-token');
        mockLoadFcmToken.mockReturnValue('old-token');
        mockLoadSavedOptionsRaw.mockReturnValue({ generalNotifications: true });
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            status: 200,
        });

        renderHook(() => useNotificationTokenSync(true, user));

        await waitFor(() => {
            expect(globalThis.fetch).toHaveBeenCalled();
        });

        const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(url).toBe('https://test.example.com/api/reminder');
        expect(options.method).toBe('POST');
        const body = JSON.parse(options.body);
        expect(body.fcmToken).toBe('new-token');
        expect(body.oldFcmToken).toBe('old-token');
    });

    it('does not persist token when unmounted during async work', async () => {
        const user = makeUser();
        let resolveToken: (v: string) => void;
        mockAcquireFcmToken.mockReturnValue(
            new Promise<string>((r) => { resolveToken = r; })
        );
        mockLoadFcmToken.mockReturnValue('old-token');
        mockLoadSavedOptionsRaw.mockReturnValue({ generalNotifications: true });

        const { unmount } = renderHook(() => useNotificationTokenSync(true, user));
        unmount();

        resolveToken!('new-token');
        await vi.waitFor(() => {});

        expect(mockPersistFcmToken).not.toHaveBeenCalled();
    });

    it('does not log AbortError', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const user = makeUser();

        const abortError = new DOMException('Aborted', 'AbortError');
        mockAcquireFcmToken.mockRejectedValue(abortError);

        renderHook(() => useNotificationTokenSync(true, user));

        await vi.waitFor(() => {});

        expect(consoleSpy).not.toHaveBeenCalledWith(
            'FCM token sync error:',
            expect.objectContaining({ name: 'AbortError' })
        );

        consoleSpy.mockRestore();
    });

    it('logs non-abort errors', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const user = makeUser();
        mockAcquireFcmToken.mockRejectedValue(new Error('fcm fail'));

        renderHook(() => useNotificationTokenSync(true, user));

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith(
                'FCM token sync error:',
                expect.any(Error)
            );
        });

        consoleSpy.mockRestore();
    });

    it('does not POST when Notification.permission is not granted', async () => {
        Object.defineProperty(window, 'Notification', {
            value: { permission: 'denied' },
            writable: true,
            configurable: true,
        });

        const user = makeUser();
        mockAcquireFcmToken.mockResolvedValue('new-token');
        mockLoadFcmToken.mockReturnValue('old-token');

        renderHook(() => useNotificationTokenSync(true, user));

        await vi.waitFor(() => {});
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });
});
