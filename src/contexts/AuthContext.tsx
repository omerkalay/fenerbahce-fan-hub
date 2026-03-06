import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { auth, googleProvider } from '../firebase';
import {
    onAuthStateChanged,
    getRedirectResult,
    signInWithPopup,
    signInWithRedirect,
    signOut as firebaseSignOut,
    type User
} from 'firebase/auth';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    signInWithGoogle: async () => {},
    signOut: async () => {}
});

export const useAuth = () => useContext(AuthContext);

const REDIRECT_PENDING_KEY = 'fb_auth_redirect_pending';

const shouldUseRedirectFlow = (): boolean => {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    return isIOS && isStandalone;
};

const hasCrossOriginAuthDomain = (): boolean => {
    if (typeof window === 'undefined') return false;
    const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
    return Boolean(authDomain && authDomain !== window.location.hostname);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const markRedirectPending = useCallback(() => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(REDIRECT_PENDING_KEY, '1');
    }, []);

    const clearRedirectPending = useCallback(() => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(REDIRECT_PENDING_KEY);
    }, []);

    const hasRedirectPending = useCallback(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem(REDIRECT_PENDING_KEY) === '1';
    }, []);

    const processRedirectResult = useCallback(async () => {
        if (!hasRedirectPending() && !auth.currentUser) {
            return;
        }

        try {
            const result = await getRedirectResult(auth);
            if (result?.user) {
                setUser(result.user);
            }

            if (result?.user || auth.currentUser) {
                clearRedirectPending();
            }
        } catch (err) {
            console.error('Google redirect result error:', err);
        }
    }, [clearRedirectPending, hasRedirectPending]);

    useEffect(() => {
        void processRedirectResult();
        const retryTimer = window.setTimeout(() => {
            void processRedirectResult();
        }, 600);

        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser ?? null);
            if (firebaseUser) {
                clearRedirectPending();
            }
            setLoading(false);
        });

        const handleAppResume = () => {
            if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
                return;
            }
            void processRedirectResult();
            window.setTimeout(() => {
                void processRedirectResult();
            }, 600);
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void processRedirectResult();
            }
        };

        window.addEventListener('focus', handleAppResume);
        window.addEventListener('pageshow', handleAppResume);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        if (shouldUseRedirectFlow() && hasCrossOriginAuthDomain()) {
            console.warn(
                'iOS PWA auth is using a cross-origin authDomain. Redirect sign-in may not return reliably until authDomain is moved behind the app domain.'
            );
        }

        return () => {
            window.clearTimeout(retryTimer);
            window.removeEventListener('focus', handleAppResume);
            window.removeEventListener('pageshow', handleAppResume);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            unsubscribe();
        };
    }, [clearRedirectPending, processRedirectResult]);

    const signInWithGoogle = useCallback(async () => {
        try {
            if (shouldUseRedirectFlow()) {
                markRedirectPending();
                await signInWithRedirect(auth, googleProvider);
                return;
            }

            await signInWithPopup(auth, googleProvider);
        } catch (err: unknown) {
            const error = err as { code?: string };

            if (error.code === 'auth/popup-closed-by-user' ||
                error.code === 'auth/cancelled-popup-request') {
                return;
            }

            if (error.code === 'auth/popup-blocked' ||
                error.code === 'auth/operation-not-supported-in-this-environment') {
                markRedirectPending();
                await signInWithRedirect(auth, googleProvider);
                return;
            }

            console.error('Google sign-in error:', error.code);
        }
    }, [markRedirectPending]);

    const signOut = useCallback(async () => {
        clearRedirectPending();
        await firebaseSignOut(auth);
    }, [clearRedirectPending]);

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            signInWithGoogle,
            signOut
        }}>
            {children}
        </AuthContext.Provider>
    );
};
