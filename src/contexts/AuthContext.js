import { createContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { registerFcmToken } from '../utils/fcmToken';

export const AuthContext = createContext();

const SESSION_BOOTSTRAP_TIMEOUT_MS = 10000;

function withTimeout(promise, ms, label = 'Operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingPasswordReset, setPendingPasswordReset] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const clearLoading = () => {
      if (!cancelled) setLoading(false);
    };

    // Always unblock the UI even if getSession() never settles (common after reload).
    const safetyTimer = setTimeout(clearLoading, SESSION_BOOTSTRAP_TIMEOUT_MS);

    const bootstrapSession = async () => {
      try {
        const { data: { session: initialSession }, error } = await withTimeout(
          supabase.auth.getSession(),
          SESSION_BOOTSTRAP_TIMEOUT_MS,
          'Session bootstrap',
        );
        if (error) throw error;
        if (cancelled) return;

        if (initialSession?.user) {
          setSession(initialSession);
          setUser(initialSession.user);
          // Do not block app startup on profile query.
          fetchProfile(initialSession.user.id);
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        console.error('❌ Session bootstrap failed:', error?.message || error);
        if (!cancelled) {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } finally {
        clearTimeout(safetyTimer);
        clearLoading();
      }
    };

    bootstrapSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (cancelled) return;
        if (newSession?.user) {
          setSession(newSession);
          setUser(newSession.user);
          fetchProfile(newSession.user.id);
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
        clearTimeout(safetyTimer);
        clearLoading();
      },
    );

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const recoverProfile = async (userId) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser?.email) return false;
      const prefix = authUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15);
      const username = `${prefix}_${Math.random().toString(36).substring(2, 6)}`;
      const { error } = await supabase.from('profiles').insert({
        id: userId,
        email: authUser.email,
        name: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
        role: 'learner',
        username,
        created_at: new Date().toISOString(),
      });
      return !error;
    } catch {
      return false;
    }
  };

  const fetchProfile = async (userId) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);

      if (error) {
        console.warn('⚠️ Profile fetch error:', error.message, error.code || '');

        if (error.code === 'PGRST116' || error.message.includes('not found')) {
          // Auth user exists but profile is missing — attempt to recreate it
          // so the user is not permanently locked out (e.g. after a partial deletion)
          const recovered = await recoverProfile(userId);
          if (recovered) {
            fetchProfile(userId);
            return;
          }
          // Recovery failed — clear everything locally (server signOut may fail if
          // auth user was already deleted, so use scope:'local' to avoid the round-trip)
          await supabase.auth.signOut({ scope: 'local' });
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        setLoading(false);
        return;
      }

      if (!data) {
        console.warn('⚠️ No profile data returned for userId:', userId);
        setProfile(null);
      } else {
        if (data.is_frozen === true) {
          console.warn('🧊 Profile is frozen — signing out');
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setProfile(null);
          Alert.alert(
            'Account suspended',
            'This account has been frozen by an administrator. Contact support if you believe this is a mistake.'
          );
          setLoading(false);
          return;
        }
        setProfile(data);
        registerFcmToken(userId);
      }
      setLoading(false);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.warn('⚠️ Profile fetch timed out after 8s');
        setLoading(false);
        return;
      }
      console.error('❌ Profile fetch exception:', error.message);
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSession(null);
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  const value = {
    session,
    user,
    profile,
    loading,
    signOut,
    refreshProfile: () => user && fetchProfile(user.id),
    pendingPasswordReset,
    setPendingPasswordReset,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
