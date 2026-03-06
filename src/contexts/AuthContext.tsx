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

const shouldUseRedirectFlow = (): boolean => {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    return isIOS && isStandalone;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getRedirectResult(auth).catch((err) => {
            console.error('Google redirect result error:', err);
        });

        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser ?? null);
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const signInWithGoogle = useCallback(async () => {
        try {
            if (shouldUseRedirectFlow()) {
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
                await signInWithRedirect(auth, googleProvider);
                return;
            }

            console.error('Google sign-in error:', error.code);
        }
    }, []);

    const signOut = useCallback(async () => {
        await firebaseSignOut(auth);
    }, []);

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
