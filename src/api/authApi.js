import { supabase } from '../lib/supabase';
import { getSupabaseErrorMessage } from '../lib/supabaseErrorHandler';

function generateUsername(email) {
  const prefix = email.split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 15);
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${prefix}_${suffix}`;
}

export const authApi = {
  /** Mirrors the web portal: only creates the auth.users row. The `profiles`
   * insert needs auth.uid() = id under RLS, so it can't happen until a session
   * exists — signUp() returns session: null while email confirmation is on.
   * Call createProfile() right away if a session came back, otherwise after
   * verifySignupOtp() succeeds. name/role ride along in user_metadata so
   * AuthContext's profile recovery builds the same row if it wins the race. */
  signUp: async ({ email, password, name, role }) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name, role } },
      });
      if (authError) throw authError;

      return {
        user: authData.user,
        session: authData.session,
        needsVerification: !authData.session,
      };
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /** Creates the `profiles` row — call only once a session exists (see signUp above).
   * ignoreDuplicates: AuthContext may already have recovered the row from metadata. */
  createProfile: async ({ userId, email, name, role }) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert(
          {
            id: userId,
            email,
            name,
            role,
            username: generateUsername(email),
            created_at: new Date().toISOString(),
          },
          { onConflict: 'id', ignoreDuplicates: true },
        );
      if (error) throw error;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /** Confirms the 6-digit code from the "Confirm signup" email. Must be type
   * "signup" — the type "email" used by verifyOtp is rejected for fresh signups. */
  verifySignupOtp: async (email, otp) => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.trim(),
        type: 'signup',
      });
      if (error) throw error;
      return { user: data.user, session: data.session };
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /** Re-sends the signup confirmation code (e.g. the first one expired or never arrived). */
  resendSignupOtp: async (email) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
      });
      if (error) throw error;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  signIn: async ({ email, password }) => {
    try {

      // Sign in with email and password
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Don't fetch profile here - let AuthContext listener do it
      // This prevents double-fetching and timeout issues
      return {
        user: data.user,
        session: data.session,
      };
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  sendPasswordResetOtp: async (email) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  verifyOtp: async (email, otp) => {
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.trim(),
        type: 'email',
      });
      if (error) throw error;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  updatePassword: async (newPassword) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getProfile: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },
};
