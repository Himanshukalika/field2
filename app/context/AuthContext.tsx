'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { auth, signInWithGoogle, signOutUser } from '../lib/firebase';

interface AuthContextProps {
  user: User | null;
  loading: boolean;
  login: () => Promise<User | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  login: async () => null,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    }, (error) => {
      console.error("Auth state change error:", error);
      setLoading(false);
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  const login = async (): Promise<User | null> => {
    try {
      const user = await signInWithGoogle();
      setUser(user);
      return user;
    } catch (error: any) {
      // Handle popup closed by user - this is not an error that needs to be displayed to the user
      if (error.code === 'auth/popup-closed-by-user') {
        console.log('Login popup was closed by the user');
        return null;
      }
      
      // Check for specific Firebase errors that occur in production
      if (error.code === 'auth/unauthorized-domain') {
        console.error('Your domain is not authorized in Firebase. Add your domain to Firebase Console > Authentication > Settings > Authorized domains');
      } else if (error.code === 'auth/configuration-not-found') {
        console.error('Firebase configuration error. Check if environment variables are properly set in Vercel');
      }
      
      // Log and rethrow other errors
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOutUser();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 