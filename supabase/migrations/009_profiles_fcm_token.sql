-- FCM device tokens for mobile push notifications.
-- Without this column + update policy, mentor/learner tokens never save
-- and push popups never send (in-app notifications still work from bookings).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fcm_token text;

COMMENT ON COLUMN public.profiles.fcm_token IS
  'Firebase Cloud Messaging device token for push notifications';

CREATE INDEX IF NOT EXISTS profiles_fcm_token_idx
  ON public.profiles (fcm_token)
  WHERE fcm_token IS NOT NULL;

-- App calls: profiles.update({ fcm_token }).eq('id', userId)
-- RLS is enabled on profiles; without an UPDATE policy the write is denied.
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
