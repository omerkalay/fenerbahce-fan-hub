importScripts('https://www.gstatic.com/firebasejs/12.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.6.0/firebase-messaging-compat.js');

const DEFAULT_NOTIFICATION_URL = '/fenerbahce-fan-hub/';

// Initialize the Firebase app in the service worker by passing in the messagingSenderId.
firebase.initializeApp({
    apiKey: "AIzaSyA0GXc2SsjtbsDYzf1agK4zbTJ5IvxPFxs",
    authDomain: "fb-hub-ed9de.firebaseapp.com",
    projectId: "fb-hub-ed9de",
    storageBucket: "fb-hub-ed9de.firebasestorage.app",
    messagingSenderId: "426764789152",
    appId: "1:426764789152:web:9e989667bda7568059f0c5",
});

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

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
