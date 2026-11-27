import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  auth,
  googleProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from '../lib/firebase';
import { isAuthorizedBlcEmail } from '../lib/authConfig';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  isSigningIn: boolean;
  authError: string | null;
  isBlcAuthorized: boolean;
  signInWithGoogle: () => Promise<User | null>;
  signOutUser: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      currentUser => {
        setUser(currentUser);
        setAuthReady(true);
      },
      error => {
        console.error('Firebase Auth state error:', error);
        setAuthError(error.message || 'Authentication listener error');
        setAuthReady(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async (): Promise<User | null> => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      return result.user;
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return null;
      }
      const message =
        code === 'auth/popup-blocked'
          ? 'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.'
          : err?.message || 'Could not sign in with Google.';
      setAuthError(message);
      return null;
    } finally {
      setIsSigningIn(false);
    }
  };

  const signOutUser = async (): Promise<void> => {
    setAuthError(null);
    try {
      await signOut(auth);
      setUser(null);
    } catch (err: any) {
      setAuthError(err?.message || 'Could not sign out.');
    }
  };

  const isBlcAuthorized = Boolean(user && isAuthorizedBlcEmail(user.email));

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        isSigningIn,
        authError,
        isBlcAuthorized,
        signInWithGoogle,
        signOutUser,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
