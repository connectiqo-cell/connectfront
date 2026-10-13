import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL as ENV_URL, SUPABASE_ANON_KEY as ENV_KEY } from '@env';

function trimEnv(value) {
  if (value == null || typeof value !== 'string') return value;
  return value.replace(/\r$/, '').trim();
}

export const SUPABASE_URL = trimEnv(ENV_URL);
export const SUPABASE_ANON_KEY = trimEnv(ENV_KEY);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_ANON_KEY. Set both in .env at the project root (see .env.example), then restart Metro with cache reset: yarn start --reset-cache'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** Default supabase-js storage key: sb-<project ref>-auth-token */
const SESSION_STORAGE_KEY = `sb-${SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0]}-auth-token`;

/**
 * The persisted session, read straight from AsyncStorage — no network.
 * Used when getSession() stalls on a token refresh over a bad connection:
 * a stale session is still a signed-in user, and autoRefreshToken keeps trying.
 */
export async function readStoredSession() {
  try {
    const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.user ? parsed : null;
  } catch {
    return null;
  }
}
