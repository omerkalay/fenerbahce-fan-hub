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

type SignInOutcome = 'success' | 'redirect' | 'cancelled';
type SignInErrorCode =
    | 'auth/pwa-cross-origin-redirect-unsupported'
    | 'auth/popup-blocked-required'
    | 'auth/sign-in-failed';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<SignInOutcome>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    signInWithGoogle: async () => 'cancelled',
    signOut: async () => {}
});

export const useAuth = () => useContext(AuthContext);

const REDIRECT_PENDING_KEY = 'fb_auth_redirect_pending';
const REDIRECT_PENDING_TTL_MS = 5 * 60 * 1000;
const PWA_CROSS_ORIGIN_ERROR_MESSAGE = 'PWA içinde Google girişi bu kurulumla tamamlanamıyor. Şimdilik uygulamayı normal tarayıcıda açıp giriş yap.';
const POPUP_BLOCKED_ERROR_MESSAGE = 'Google girişi için açılır pencere engellendi. Popup izni verip tekrar dene.';
const DEFAULT_SIGN_IN_ERROR_MESSAGE = 'Google girişi başlatılamadı. Lütfen tekrar dene.';

const createSignInError = (code: SignInErrorCode, message: string) => (
    Object.assign(new Error(message), { code })
);

export const getSignInErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return DEFAULT_SIGN_IN_ERROR_MESSAGE;
};

const isStandaloneDisplayMode = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
};

const shouldStartWithRedirect = (): boolean => {
    if (typeof window === 'undefined') return false;
    return isStandaloneDisplayMode() && !hasCrossOriginAuthDomain();
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
        localStorage.setItem(REDIRECT_PENDING_KEY, String(Date.now()));
    }, []);

    const clearRedirectPending = useCallback(() => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(REDIRECT_PENDING_KEY);
    }, []);

    const hasRedirectPending = useCallback(() => {
        if (typeof window === 'undefined') return false;
        const pendingValue = localStorage.getItem(REDIRECT_PENDING_KEY);
        if (!pendingValue) return false;

        const pendingTimestamp = Number(pendingValue);
        if (!Number.isFinite(pendingTimestamp)) {
            return true;
        }

        if ((Date.now() - pendingTimestamp) > REDIRECT_PENDING_TTL_MS) {
            localStorage.removeItem(REDIRECT_PENDING_KEY);
            return false;
        }

        return true;
    }, []);

    const processRedirectResult = useCallback(async () => {
        try {
            const result = await getRedirectResult(auth);
            if (result?.user) {
                setUser(result.user);
            }

            if (result?.user || auth.currentUser) {
                clearRedirectPending();
            }
        } catch (err) {
            const error = err as { code?: string; message?: string };
            if (error.code === 'auth/missing-initial-state' ||
                error.message?.includes('missing initial state')) {
                clearRedirectPending();
            }
            console.error('Google redirect result error:', err);
        }
    }, [clearRedirectPending]);

    useEffect(() => {
        hasRedirectPending();
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

        if (isStandaloneDisplayMode() && hasCrossOriginAuthDomain()) {
            console.warn(
                'Installed PWA auth is using a cross-origin authDomain. Popup sign-in will be tried first because redirect may not return reliably until authDomain is moved behind the app domain.'
            );
        }

        return () => {
            window.clearTimeout(retryTimer);
            window.removeEventListener('focus', handleAppResume);
            window.removeEventListener('pageshow', handleAppResume);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            unsubscribe();
        };
    }, [clearRedirectPending, hasRedirectPending, processRedirectResult]);

    const signInWithGoogle = useCallback(async (): Promise<SignInOutcome> => {
        if (auth.currentUser) {
            return 'success';
        }

        const startedAt = Date.now();
        const standaloneMode = isStandaloneDisplayMode();
        const crossOriginAuthDomain = hasCrossOriginAuthDomain();

        try {
            if (shouldStartWithRedirect()) {
                markRedirectPending();
                await signInWithRedirect(auth, googleProvider);
                return 'redirect';
            }

            await signInWithPopup(auth, googleProvider);
            return 'success';
        } catch (err: unknown) {
            const error = err as { code?: string };
            const popupClosedQuickly = (Date.now() - startedAt) < 1500;

            if (error.code === 'auth/popup-closed-by-user' ||
                error.code === 'auth/cancelled-popup-request') {
                if (standaloneMode && crossOriginAuthDomain && popupClosedQuickly) {
                    throw createSignInError(
                        'auth/pwa-cross-origin-redirect-unsupported',
                        PWA_CROSS_ORIGIN_ERROR_MESSAGE
                    );
                }

                if (standaloneMode && popupClosedQuickly && !crossOriginAuthDomain) {
                    markRedirectPending();
                    await signInWithRedirect(auth, googleProvider);
                    return 'redirect';
                }

                return 'cancelled';
            }

            if (error.code === 'auth/popup-blocked') {
                throw createSignInError(
                    'auth/popup-blocked-required',
                    POPUP_BLOCKED_ERROR_MESSAGE
                );
            }

            if (error.code === 'auth/operation-not-supported-in-this-environment') {
                if (crossOriginAuthDomain) {
                    throw createSignInError(
                        'auth/pwa-cross-origin-redirect-unsupported',
                        PWA_CROSS_ORIGIN_ERROR_MESSAGE
                    );
                }

                markRedirectPending();
                await signInWithRedirect(auth, googleProvider);
                return 'redirect';
            }

            console.error('Google sign-in error:', error.code, err);
            throw createSignInError(
                'auth/sign-in-failed',
                DEFAULT_SIGN_IN_ERROR_MESSAGE
            );
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
