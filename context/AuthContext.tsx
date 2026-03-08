
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { AuthService } from '../services/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password?: string) => Promise<void>;
  register: (email: string, password?: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Try to restore existing session (persisted in localStorage by Supabase)
        const existingUser = await AuthService.getSession();
        setUser(existingUser);
      } catch (error) {
        console.error("Auth init failed", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const signIn = async (email: string, password?: string) => {
    setLoading(true);
    try {
      const loggedInUser = await AuthService.login(email, password);
      setUser(loggedInUser);
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password?: string, name?: string) => {
    setLoading(true);
    try {
      const registeredUser = await AuthService.register(email, password, name);
      // Depending on Supabase settings, registeredUser might be null if email confirmation is required.
      // We set user only if we got a valid session back immediately.
      if (registeredUser) {
        setUser(registeredUser);
      }
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await AuthService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, register, signOut, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
