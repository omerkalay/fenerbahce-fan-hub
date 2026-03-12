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

        const syncToken = async () => {
            try {
                if (!('Notification' in window) || Notification.permission !== 'granted') return;
                if (!('serviceWorker' in navigator)) return;

                const currentToken = await acquireFcmToken();
                if (!currentToken) return;

                const storedToken = loadFcmToken();
                if (currentToken === storedToken) return;

                const savedOptions = loadSavedOptionsRaw();
                if (!savedOptions || !user) return;

                const options = normalizeOptions(savedOptions);
                const idToken = await user.getIdToken();
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
                    })
                });

                if (!response.ok) {
                    throw new Error(`Backend error: ${response.status}`);
                }

                persistFcmToken(currentToken);
            } catch (err) {
                console.error('FCM token sync error:', err);
            }
        };

        syncToken();
    }, [hasActiveNotifications, user]);
};

export default useNotificationTokenSync;
