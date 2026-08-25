import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
const database = getDatabase(app);

// Initialize Firebase Auth
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

let messagingRequest: Promise<Messaging | null> | null = null;

const getFirebaseMessaging = (): Promise<Messaging | null> => {
    if (!messagingRequest) {
        messagingRequest = isSupported()
            .then((supported) => supported ? getMessaging(app) : null)
            .catch((error) => {
                console.error('Firebase Messaging initialization failed:', error);
                return null;
            });
    }
    return messagingRequest;
};

export { database, getFirebaseMessaging, auth, googleProvider };
