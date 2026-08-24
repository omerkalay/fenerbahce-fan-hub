import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';

type SignInOutcome = 'success' | 'redirect' | 'cancelled';

export interface AuthContextType {
    user: User | null;
    loading: boolean;
    adminLoading: boolean;
    isAdmin: boolean;
    signInWithGoogle: () => Promise<SignInOutcome>;
    signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    adminLoading: true,
    isAdmin: false,
    signInWithGoogle: async () => 'cancelled',
    signOut: async () => {}
});

export const useAuth = () => useContext(AuthContext);
