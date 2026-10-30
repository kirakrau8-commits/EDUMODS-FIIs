import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../services/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  authError: string | null;
  isConfigured: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    let isMounted = true;

    if (!configured) {
      setIsLoading(false);
      setAuthError('Supabase não configurado. Defina as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no ambiente.');
      return;
    }

    // 1. Verificar sessão inicial no Supabase Auth
    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession }, error }) => {
        if (!isMounted) return;
        if (error) {
          console.error('Erro ao verificar sessão Supabase:', error.message);
          setAuthError('Falha ao verificar sessão prévia. Faça login novamente.');
          setSession(null);
          setUser(null);
        } else {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Falha de rede ao consultar Supabase Auth:', err);
        setAuthError('Falha ao conectar com o serviço de autenticação do Supabase.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    // 2. Escutar eventos de autenticação em tempo real
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return;

      if (event === 'SIGNED_IN') {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setAuthError(null);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
      } else if (event === 'TOKEN_REFRESHED') {
        setSession(newSession);
        setUser(newSession?.user ?? null);
      } else if (event === 'USER_UPDATED') {
        setUser(newSession?.user ?? null);
      }

      // Se a sessão expirou e o usuário foi deslogado
      if (!newSession && event === 'SIGNED_OUT' && session) {
        setAuthError('Sua sessão expirou. Faça login novamente para continuar.');
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [configured]);

  const signInWithEmail = async (email: string, password: string) => {
    setAuthError(null);

    if (!configured) {
      const msg =
        'Supabase não configurado. Adicione VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY para conectar ao banco de autenticação.';
      setAuthError(msg);
      return { success: false, error: msg };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        let friendlyMessage = 'Erro na autenticação. Verifique os dados informados.';

        if (
          error.message.includes('Invalid login credentials') ||
          error.message.includes('invalid_grant') ||
          error.message.includes('Email not confirmed')
        ) {
          friendlyMessage = 'Credenciais inválidas ou senha incorreta. Verifique seu e-mail e senha cadastrados no Supabase.';
        } else if (
          error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError') ||
          error.message.includes('fetch')
        ) {
          friendlyMessage = 'Falha ao conectar com o serviço de autenticação. Verifique sua conexão com a internet ou a URL do Supabase.';
        } else if (error.message.includes('Email link is invalid or has expired')) {
          friendlyMessage = 'Sua sessão expirou. Faça login novamente.';
        } else {
          friendlyMessage = `Erro de autenticação: ${error.message}`;
        }

        setAuthError(friendlyMessage);
        return { success: false, error: friendlyMessage };
      }

      setSession(data.session);
      setUser(data.user);
      setAuthError(null);
      return { success: true };
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error && err.message.includes('fetch')
          ? 'Falha ao conectar com o serviço de autenticação. Verifique sua rede e a configuração do Supabase.'
          : 'Ocorreu um erro inesperado durante a tentativa de login.';
      setAuthError(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Erro ao encerrar sessão no Supabase:', err);
    } finally {
      setSession(null);
      setUser(null);
      setAuthError(null);
    }
  };

  const clearAuthError = () => setAuthError(null);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isLoading,
        authError,
        isConfigured: configured,
        signInWithEmail,
        signOut,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
