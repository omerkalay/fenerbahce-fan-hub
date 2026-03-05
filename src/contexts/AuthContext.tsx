import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { auth, googleProvider } from '../firebase';
import {
    onAuthStateChanged,
    signInAnonymously,
    signInWithPopup,
    signOut as firebaseSignOut,
    type User
} from 'firebase/auth';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isAnonymous: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    isAnonymous: true,
    signInWithGoogle: async () => {},
    signOut: async () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                setLoading(false);
            } else {
                try {
                    await signInAnonymously(auth);
                } catch (err) {
                    console.error('Anonymous sign-in failed:', err);
                    setLoading(false);
                }
            }
        });
        return unsubscribe;
    }, []);

    const signInWithGoogle = useCallback(async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (err: unknown) {
            const error = err as { code?: string };
            if (error.code === 'auth/popup-closed-by-user' ||
                error.code === 'auth/cancelled-popup-request') {
                // User closed popup, do nothing
            } else {
                console.error('Google sign-in error:', error.code);
            }
        }
    }, []);

    const signOut = useCallback(async () => {
        await firebaseSignOut(auth);
    }, []);

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            isAnonymous: user?.isAnonymous ?? true,
            signInWithGoogle,
            signOut
        }}>
            {children}
        </AuthContext.Provider>
    );
};
