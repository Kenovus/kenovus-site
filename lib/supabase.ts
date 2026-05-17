import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Web: `expo-secure-store` has no native module (`ExpoSecureStore` is `{}`), so the public
 * `getItemAsync` path would call a missing `getValueWithKeyAsync`. Use `localStorage` for auth
 * session persistence on web only.
 *
 * Native: use SecureStore async API (`getItemAsync` / `setItemAsync` / `deleteItemAsync`).
 */
const authStorage =
  Platform.OS === 'web'
    ? {
        getItem: (key: string): Promise<string | null> => {
          try {
            if (typeof globalThis === 'undefined') return Promise.resolve(null);
            const storage = (globalThis as { localStorage?: Storage }).localStorage;
            return Promise.resolve(storage?.getItem(key) ?? null);
          } catch {
            return Promise.resolve(null);
          }
        },
        setItem: (key: string, value: string): Promise<void> => {
          try {
            const storage = (globalThis as { localStorage?: Storage }).localStorage;
            storage?.setItem(key, value);
          } catch {
            /* quota / private mode */
          }
          return Promise.resolve();
        },
        removeItem: (key: string): Promise<void> => {
          try {
            const storage = (globalThis as { localStorage?: Storage }).localStorage;
            storage?.removeItem(key);
          } catch {
            /* ignore */
          }
          return Promise.resolve();
        },
      }
    : {
        getItem: (key: string) => SecureStore.getItemAsync(key),
        setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        removeItem: (key: string) => SecureStore.deleteItemAsync(key),
      };

if (!isSupabaseConfigured) {
  console.warn(
    '[SonaLife] Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env file (see .env.example), then restart the dev server with: npx expo start -c',
  );
}

/**
 * Valid URL + anon key required for auth and queries. Placeholders avoid crashes on import
 * when env is missing during local iteration; API calls will fail until .env is set.
 */
const url = isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co';
const key = isSupabaseConfigured ? supabaseAnonKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

export const supabase: SupabaseClient = createClient(url, key, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
