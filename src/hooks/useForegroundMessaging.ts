import { useEffect } from 'react';

export function useForegroundMessaging() {
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    const setupForegroundMessaging = async () => {
      try {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        const { messaging } = await import('../firebase');
        const { onMessage } = await import('firebase/messaging');
        if (!messaging) return;

        unsubscribe = onMessage(messaging, (payload) => {
          console.log('📩 Foreground message:', payload);
          const title = payload.notification?.title || payload.data?.title;
          const body = payload.notification?.body || payload.data?.body || '';
          if (title) {
            new Notification(title, {
              body,
              icon: 'https://media.api-sports.io/football/teams/611.png',
              data: payload.data
            });
          }
        });
      } catch (err) {
        console.error('Foreground messaging setup error:', err);
      }
    };

    setupForegroundMessaging();
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);
}
