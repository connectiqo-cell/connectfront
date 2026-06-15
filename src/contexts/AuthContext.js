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

  const fetchProfile = async (userId) => {
    try {

      // Create a promise that logs if it takes too long
      const slowPromise = new Promise(resolve =>
        setTimeout(() => {
          resolve();
        }, 3000)
      );

      // Fetch profile
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      // Log if it's taking too long, but don't abort
      Promise.race([profilePromise, slowPromise]);

      const { data, error } = await profilePromise;

      if (error) {
        console.error('❌ Profile fetch error:', error.message, error.code || '');

        // If profile doesn't exist and user is authenticated, sign them out
        if (error.code === 'PGRST116' || error.message.includes('not found')) {
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        // For other errors, just log and wait for next event
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
