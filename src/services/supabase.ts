import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase environment variables configured via VITE_
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  '';

export const isSupabaseConfigured = (): boolean => {
  return (
    typeof supabaseUrl === 'string' &&
    supabaseUrl.trim().length > 0 &&
    typeof supabasePublishableKey === 'string' &&
    supabasePublishableKey.trim().length > 0
  );
};

// Create a singleton Supabase client with safe fallback if env vars are missing
let supabaseInstance: SupabaseClient;

try {
  if (isSupabaseConfigured()) {
    supabaseInstance = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'edumods_fii_supabase_auth',
      },
    });
  } else {
    // Dummy client placeholder to prevent crashes before user sets environment variables
    supabaseInstance = createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
} catch {
  supabaseInstance = createClient('https://placeholder.supabase.co', 'placeholder-key', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const supabase = supabaseInstance;
export { supabaseUrl };
