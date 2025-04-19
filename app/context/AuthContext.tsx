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
      // Check if Firebase config exists before attempting login
      if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || !process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) {
        console.error('Firebase configuration missing. Check environment variables in Vercel.');
        throw new Error('Firebase configuration missing. Please check deployment settings.');
      }
      
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
        console.error('Vercel deployment error: Your domain is not authorized in Firebase. Add your Vercel domain to Firebase Console > Authentication > Settings > Authorized domains');
        throw new Error('Authentication failed: This domain is not authorized in Firebase. Please contact the administrator.');
      } else if (error.code === 'auth/configuration-not-found') {
        console.error('Vercel deployment error: Firebase configuration missing. Check if environment variables are properly set in Vercel. See VERCEL_DEPLOYMENT.md for instructions.');
        throw new Error('Authentication failed: Firebase configuration issue. Please contact the administrator.');
      } else if (error.code === 'auth/internal-error') {
        console.error('Firebase internal error. This may be caused by missing environment variables in Vercel or a misconfiguration.');
        throw new Error('Authentication service error. Please try again later.');
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