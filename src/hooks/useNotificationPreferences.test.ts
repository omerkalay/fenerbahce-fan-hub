// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { User } from 'firebase/auth';

vi.mock('../services/api', () => ({
    BACKEND_URL: 'https://test.example.com/api',
}));

vi.mock('../utils/notificationHelpers', () => ({
    createEmptyOptions: () => ({
        generalNotifications: false,
        threeHours: false,
        oneHour: false,
        thirtyMinutes: false,
        fifteenMinutes: false,
        dailyCheck: false,
    }),
    normalizeOptions: (opts: Record<string, unknown> = {}) => ({
        generalNotifications: false,
        threeHours: false,
        oneHour: false,
        thirtyMinutes: false,
        fifteenMinutes: false,
        dailyCheck: false,
        ...opts,
    }),
    countEnabledOptions: (opts: Record<string, boolean>) =>
        Object.entries(opts).filter(([k, v]) => k !== 'updatedAt' && v === true).length,
    countMatchOptions: (opts: Record<string, boolean>) =>
        ['threeHours', 'oneHour', 'thirtyMinutes', 'fifteenMinutes', 'dailyCheck']
            .filter((k) => opts[k]).length,
    acquireFcmToken: vi.fn(),
}));

const mockPersistOptions = vi.fn();
const mockClearNotificationStorage = vi.fn();
const mockPersistFcmToken = vi.fn();
const mockClearFcmToken = vi.fn();
const mockLoadFcmToken = vi.fn(() => null);

vi.mock('../utils/notificationStorage', () => ({
    loadSavedOptions: () => ({
        generalNotifications: false,
        threeHours: false,
        oneHour: false,
        thirtyMinutes: false,
        fifteenMinutes: false,
        dailyCheck: false,
    }),
    loadHasNotifications: () => false,
    persistOptions: (...args: unknown[]) => mockPersistOptions(...args),
    clearNotificationStorage: () => mockClearNotificationStorage(),
    loadFcmToken: () => mockLoadFcmToken(),
    persistFcmToken: (t: string) => mockPersistFcmToken(t),
    clearFcmToken: () => mockClearFcmToken(),
    loadSavedOptionsRaw: () => null,
}));

vi.mock('./useNotificationTokenSync', () => ({
    default: vi.fn(),
}));

import useNotificationPreferences from './useNotificationPreferences';

function makeUser(uid = 'user-1'): User {
    return {
        uid,
        getIdToken: vi.fn().mockResolvedValue('fake-id-token'),
    } as unknown as User;
}

describe('useNotificationPreferences', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('clears state when user is null', async () => {
        const { result } = renderHook(() => useNotificationPreferences(null));

        await waitFor(() => {
            expect(result.current.hasActiveNotifications).toBe(false);
        });
        expect(result.current.selectedOptions.generalNotifications).toBe(false);
        expect(mockClearNotificationStorage).toHaveBeenCalled();
    });

    it('clears state when user changes from logged-in to null', async () => {
        const user = makeUser();
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                options: { generalNotifications: true, threeHours: true },
            }),
        });

        const { result, rerender } = renderHook(
            ({ u }) => useNotificationPreferences(u),
            { initialProps: { u: user as User | null } }
        );

        await waitFor(() => {
            expect(result.current.hasActiveNotifications).toBe(true);
        });

        rerender({ u: null });

        await waitFor(() => {
            expect(result.current.hasActiveNotifications).toBe(false);
            expect(result.current.selectedOptions.generalNotifications).toBe(false);
        });
        expect(mockClearNotificationStorage).toHaveBeenCalled();
    });

    it('falls back to clean state when GET /reminder returns 404', async () => {
        const user = makeUser();
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false,
            status: 404,
        });

        const { result } = renderHook(() => useNotificationPreferences(user));

        await waitFor(() => {
            expect(mockClearNotificationStorage).toHaveBeenCalled();
        });
        expect(result.current.hasActiveNotifications).toBe(false);
    });

    it('sets correct state after successful load', async () => {
        const user = makeUser();
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                options: { generalNotifications: true, threeHours: true },
                fcmToken: 'server-token',
            }),
        });

        const { result } = renderHook(() => useNotificationPreferences(user));

        await waitFor(() => {
            expect(result.current.selectedOptions.generalNotifications).toBe(true);
            expect(result.current.selectedOptions.threeHours).toBe(true);
        });
        expect(result.current.hasActiveNotifications).toBe(true);
        expect(mockPersistOptions).toHaveBeenCalled();
        expect(mockPersistFcmToken).toHaveBeenCalledWith('server-token');
    });

    it('clears fcmToken when server response has no fcmToken', async () => {
        const user = makeUser();
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                options: { generalNotifications: true },
            }),
        });

        renderHook(() => useNotificationPreferences(user));

        await waitFor(() => {
            expect(mockClearFcmToken).toHaveBeenCalled();
        });
    });

    it('does not let a stale request overwrite a newer user state', async () => {
        const userA = makeUser('user-A');
        const userB = makeUser('user-B');

        let resolveA: (v: unknown) => void;
        const pendingA = new Promise((r) => { resolveA = r; });

        (globalThis.fetch as ReturnType<typeof vi.fn>)
            .mockImplementationOnce(() => pendingA)
            .mockImplementationOnce(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        options: { generalNotifications: true, dailyCheck: true },
                    }),
                })
            );

        const { result, rerender } = renderHook(
            ({ u }) => useNotificationPreferences(u),
            { initialProps: { u: userA as User | null } }
        );

        rerender({ u: userB });

        await waitFor(() => {
            expect(result.current.selectedOptions.dailyCheck).toBe(true);
        });

        resolveA!({
            ok: true,
            status: 200,
            json: async () => ({
                options: { generalNotifications: false, oneHour: true },
            }),
        });

        await vi.waitFor(() => {
            expect(result.current.selectedOptions.dailyCheck).toBe(true);
        });
        expect(result.current.selectedOptions.oneHour).toBe(false);
    });

    it('does not log AbortError on cleanup', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const user = makeUser();

        const abortError = new DOMException('The operation was aborted.', 'AbortError');
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(abortError);

        const { unmount } = renderHook(() => useNotificationPreferences(user));
        unmount();

        await vi.waitFor(() => {});
        expect(consoleSpy).not.toHaveBeenCalledWith(
            expect.stringContaining('Notification preferences load error'),
            expect.objectContaining({ name: 'AbortError' })
        );

        consoleSpy.mockRestore();
    });

    it('logs non-abort errors', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const user = makeUser();

        (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network fail'));

        renderHook(() => useNotificationPreferences(user));

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith(
                'Notification preferences load error:',
                expect.any(Error)
            );
        });

        consoleSpy.mockRestore();
    });
});
