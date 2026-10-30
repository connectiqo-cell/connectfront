import { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase, readStoredSession } from '../lib/supabase';
import { registerFcmToken } from '../utils/fcmToken';
import { recordAppBuild } from '../utils/forceUpdate';
import { isMentorFreezeActive } from '../utils/mentorFreeze';

export const AuthContext = createContext();

// Short, because a timeout now falls back to the persisted session instead of
// dumping the user on Welcome — no reason to stare at the splash for 10s.
const SESSION_BOOTSTRAP_TIMEOUT_MS = 4000;

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
  const [mentorFreeze, setMentorFreeze] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingPasswordReset, setPendingPasswordReset] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const clearLoading = () => {
      if (!cancelled) setLoading(false);
    };

    const adoptSession = (next) => {
      if (cancelled) return;
      if (next?.user) {
        setSession(next);
        setUser(next.user);
        // Do not block app startup on profile query.
        fetchProfile(next.user.id);
      } else {
        setSession(null);
        setUser(null);
        setProfile(null);
      }
    };

    const bootstrapSession = async () => {
      try {
        const { data: { session: initialSession }, error } = await withTimeout(
          supabase.auth.getSession(),
          SESSION_BOOTSTRAP_TIMEOUT_MS,
          'Session bootstrap',
        );
        if (error) throw error;
        adoptSession(initialSession);
      } catch (error) {
        // Slow/offline network: getSession() stalls refreshing an expired token.
        // Treating that as signed-out flashed Welcome, then jumped to Home once
        // the refresh landed. The stored session is the truth; keep the user in.
        console.warn('⚠️ Session bootstrap failed, using stored session:', error?.message || error);
        adoptSession(await readStoredSession());
      } finally {
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
        clearLoading();
      },
    );

    return () => {
      cancelled = true;
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
        // Signup stores role in metadata; the row may be recovered here before
        // SignupScreen's own createProfile() runs after OTP verification.
        role: authUser.user_metadata?.role || 'learner',
        username,
        created_at: new Date().toISOString(),
      });
      // 23505 = row already exists (signup's createProfile got there first).
      return !error || error.code === '23505';
    } catch {
      return false;
    }
  };

  const fetchProfile = async (userId) => {
    recordAppBuild(userId);

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
          setMentorFreeze(null);
          setLoading(false);
          return;
        }
        setLoading(false);
        return;
      }

      if (!data) {
        console.warn('⚠️ No profile data returned for userId:', userId);
        setProfile(null);
        setMentorFreeze(null);
      } else {
        if (data.is_frozen === true) {
          console.warn('🧊 Profile is frozen — signing out');
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setProfile(null);
          setMentorFreeze(null);
          Alert.alert(
            'Account suspended',
            'This account has been frozen by an administrator. Contact support if you believe this is a mistake.'
          );
          setLoading(false);
          return;
        }
        setProfile(data);
        registerFcmToken(userId);

        // Mentor-side freeze (does not sign out — learner features stay available).
        try {
          const { data: mentorRow } = await supabase
            .from('mentor_profiles')
            .select('mentor_frozen, mentor_frozen_until, mentor_freeze_reason')
            .eq('id', userId)
            .maybeSingle();
          if (mentorRow && isMentorFreezeActive(mentorRow)) {
            setMentorFreeze({
              active: true,
              until: mentorRow.mentor_frozen_until,
              reason: mentorRow.mentor_freeze_reason,
            });
          } else {
            setMentorFreeze(null);
          }
        } catch (freezeErr) {
          console.warn('⚠️ Mentor freeze status fetch failed:', freezeErr?.message || freezeErr);
          setMentorFreeze(null);
        }
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

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSession(null);
      setUser(null);
      setProfile(null);
      setMentorFreeze(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }, []);

  const refreshProfile = useCallback(() => {
    if (user) fetchProfile(user.id);
  }, [user]);

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      mentorFreeze,
      isMentorSideFrozen: Boolean(mentorFreeze?.active),
      loading,
      signOut,
      refreshProfile,
      pendingPasswordReset,
      setPendingPasswordReset,
    }),
    [
      session,
      user,
      profile,
      mentorFreeze,
      loading,
      signOut,
      refreshProfile,
      pendingPasswordReset,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
