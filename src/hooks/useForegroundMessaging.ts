import { useEffect } from 'react';
import { resolveNotificationTarget } from '../utils/notificationLinks';

export function useForegroundMessaging(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let unsubscribe: (() => void) | undefined;
    const setupForegroundMessaging = async () => {
      try {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        const { getFirebaseMessaging } = await import('../firebase');
        const { onMessage } = await import('firebase/messaging');
        const messaging = await getFirebaseMessaging();
        if (!messaging) return;

        unsubscribe = onMessage(messaging, (payload) => {
          console.log('📩 Foreground message:', payload);
          const title = payload.notification?.title || payload.data?.title;
          const body = payload.notification?.body || payload.data?.body || '';
          if (title) {
            const notification = new Notification(title, {
              body,
              icon: 'https://media.api-sports.io/football/teams/611.png',
              data: payload.data
            });
            notification.onclick = () => {
              notification.close();
              const target = resolveNotificationTarget(payload.data?.url, window.location.origin);
              if (target.external) {
                window.open(target.url, '_blank', 'noopener,noreferrer');
              } else {
                window.location.assign(target.url);
              }
            };
          }
        });
      } catch (err) {
        console.error('Foreground messaging setup error:', err);
      }
    };

    setupForegroundMessaging();
    return () => { if (unsubscribe) unsubscribe(); };
  }, [enabled]);
}
