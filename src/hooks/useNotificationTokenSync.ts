import { useEffect } from 'react';
import type { User } from 'firebase/auth';
import { BACKEND_URL } from '../services/api';
import { normalizeOptions, acquireFcmToken } from '../utils/notificationHelpers';
import { loadFcmToken, loadSavedOptionsRaw, persistFcmToken } from '../utils/notificationStorage';

/**
 * Syncs the FCM token with the backend when active notifications exist
 * and the locally-stored token differs from the current browser token.
 */
const useNotificationTokenSync = (hasActiveNotifications: boolean, user: User | null): void => {
    useEffect(() => {
        if (!hasActiveNotifications) return;

        const abortController = new AbortController();

        const syncToken = async () => {
            try {
                if (!('Notification' in window) || Notification.permission !== 'granted') return;
                if (!('serviceWorker' in navigator)) return;

                const currentToken = await acquireFcmToken();
                if (!currentToken || abortController.signal.aborted) return;

                const storedToken = loadFcmToken();
                if (currentToken === storedToken) return;

                const savedOptions = loadSavedOptionsRaw();
                if (!savedOptions || !user) return;

                const options = normalizeOptions(savedOptions);
                const idToken = await user.getIdToken();
                if (abortController.signal.aborted) return;

                const response = await fetch(`${BACKEND_URL}/reminder`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${idToken}`
                    },
                    body: JSON.stringify({
                        fcmToken: currentToken,
                        oldFcmToken: storedToken || undefined,
                        options
                    }),
                    signal: abortController.signal
                });

                if (!response.ok) {
                    throw new Error(`Backend error: ${response.status}`);
                }

                // Final guard before persisting locally
                if (abortController.signal.aborted) return;
                persistFcmToken(currentToken);
            } catch (err) {
                if ((err as Error).name === 'AbortError') return;
                console.error('FCM token sync error:', err);
            }
        };

        syncToken();

        return () => { abortController.abort(); };
    }, [hasActiveNotifications, user]);
};

export default useNotificationTokenSync;
