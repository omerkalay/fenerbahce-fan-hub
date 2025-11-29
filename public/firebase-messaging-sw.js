importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

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
    // FCM automatically handles notification display
    // No need to manually call showNotification - it causes duplicates!
});
