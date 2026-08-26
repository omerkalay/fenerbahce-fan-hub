const DEFAULT_NOTIFICATION_URL = '/fenerbahce-fan-hub/';
const TRUSTED_X_HOSTS = new Set(['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com']);
const TRUSTED_INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com']);

const resolveNotificationTarget = (rawUrl) => {
    const fallback = new URL(DEFAULT_NOTIFICATION_URL, self.location.origin);
    let url;
    try {
        url = new URL(rawUrl || fallback.href, self.location.origin);
    } catch {
        return { url: fallback.href, external: false };
    }
    if ((url.protocol !== 'https:' && url.origin !== self.location.origin) || url.username || url.password) {
        return { url: fallback.href, external: false };
    }

    const hostname = url.hostname.toLowerCase();
    const segments = url.pathname.split('/').filter(Boolean);
    if ((url.origin === self.location.origin || hostname === 'omerkalay.com') && url.pathname.startsWith(DEFAULT_NOTIFICATION_URL)) {
        return { url: url.href, external: false };
    }
    if (TRUSTED_X_HOSTS.has(hostname)) {
        const officialProfile = segments[0]?.toLowerCase() === 'fenerbahce';
        const officialStatus = segments.length === 3
            && segments[1]?.toLowerCase() === 'status'
            && /^\d+$/.test(segments[2] || '');
        if (officialProfile && (segments.length === 1 || officialStatus)) {
            return { url: url.href, external: true };
        }
    }
    if (TRUSTED_INSTAGRAM_HOSTS.has(hostname)) {
        const first = segments[0]?.toLowerCase();
        const trustedPath = (first === 'fenerbahce' && segments.length === 1)
            || (segments.length === 2 && new Set(['p', 'reel', 'tv']).has(first) && /^[A-Za-z0-9_-]+$/.test(segments[1] || ''));
        if (trustedPath) return { url: url.href, external: true };
    }
    return { url: fallback.href, external: false };
};

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = resolveNotificationTarget(event.notification?.data?.url);

    event.waitUntil(
        target.external
            ? self.clients.openWindow(target.url)
            : self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
                for (const client of clientList) {
                    if (client.url === target.url && 'focus' in client) return client.focus();
                    if ('navigate' in client && 'focus' in client) {
                        return client.navigate(target.url).then(() => client.focus());
                    }
                }
                return self.clients.openWindow(target.url);
            })
    );
});

importScripts('https://www.gstatic.com/firebasejs/12.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.6.0/firebase-messaging-compat.js');

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
