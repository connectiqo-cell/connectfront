-- Allow guests (Welcome / Discover previews) to browse mentors publicly.
-- Without this, anon JWT gets [] or RLS errors while authenticated users still see mentors.

-- mentor_profiles: public catalog read
ALTER TABLE public.mentor_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mentor_profiles_select_public" ON public.mentor_profiles;
CREATE POLICY "mentor_profiles_select_public"
  ON public.mentor_profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- profiles: needed for name/avatar embed on mentor cards
-- (email may still be selected by clients — avoid storing secrets on this table)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_public"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

