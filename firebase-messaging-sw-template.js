importScripts('https://www.gstatic.com/firebasejs/12.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.6.0/firebase-messaging-compat.js');

const DEFAULT_NOTIFICATION_URL = '/fenerbahce-fan-hub/';

// Initialize the Firebase app in the service worker by passing in the messagingSenderId.
firebase.initializeApp({
    apiKey: "{{VITE_FIREBASE_API_KEY}}",
    authDomain: "{{VITE_FIREBASE_AUTH_DOMAIN}}",
    projectId: "{{VITE_FIREBASE_PROJECT_ID}}",
    storageBucket: "{{VITE_FIREBASE_STORAGE_BUCKET}}",
    messagingSenderId: "{{VITE_FIREBASE_MESSAGING_SENDER_ID}}",
    appId: "{{VITE_FIREBASE_APP_ID}}",
});

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    // Skip if notification payload exists — browser auto-displays those
    if (payload.notification) return;

    const d = payload.data || {};
    const notificationTitle = d.title || 'Fenerbahçe Fan Hub';
    const notificationOptions = {
        body: d.body || '',
        data: {
            url: d.url || DEFAULT_NOTIFICATION_URL,
        },
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = new URL(event.notification?.data?.url || DEFAULT_NOTIFICATION_URL, self.location.origin).href;

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url === targetUrl && 'focus' in client) {
                    return client.focus();
                }

                if ('navigate' in client && 'focus' in client) {
                    return client.navigate(targetUrl).then(() => client.focus());
                }
            }

            return self.clients.openWindow(targetUrl);
        })
    );
});
