import React, { createContext, useContext } from 'react';
import { isSupabaseConfigured } from '../services/supabase';

export const PERSONAL_USER_ID = '00000000-0000-4000-8000-000000000001';

export interface PersonalUser {
  id: string;
  email: string;
  user_metadata: {
    full_name: string;
  };
  created_at: string;
}

interface AuthContextType {
  session: { user: PersonalUser } | null;
  user: PersonalUser;
  isLoading: false;
  authError: null;
  isConfigured: boolean;
  signInWithEmail: () => Promise<{ success: boolean }>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

const PERSONAL_DEFAULT_USER: PersonalUser = {
  id: PERSONAL_USER_ID,
  email: 'uso.pessoal@edumods.local',
  user_metadata: {
    full_name: 'Eduardo',
  },
  created_at: '2026-01-01T00:00:00.000Z',
};

const AuthContext = createContext<AuthContextType>({
  session: { user: PERSONAL_DEFAULT_USER },
  user: PERSONAL_DEFAULT_USER,
  isLoading: false,
  authError: null,
  isConfigured: isSupabaseConfigured(),
  signInWithEmail: async () => ({ success: true }),
  signOut: async () => {},
  clearAuthError: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const configured = isSupabaseConfigured();

  return (
    <AuthContext.Provider
      value={{
        session: { user: PERSONAL_DEFAULT_USER },
        user: PERSONAL_DEFAULT_USER,
        isLoading: false,
        authError: null,
        isConfigured: configured,
        signInWithEmail: async () => ({ success: true }),
        signOut: async () => {},
        clearAuthError: () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
