importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

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
    // FCM automatically handles notification display
    // No need to manually call showNotification - it causes duplicates!
});
