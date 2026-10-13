-- Mentors must be able to publish their own schedule (INSERT/UPDATE/DELETE).
-- Error seen in app: "new row violates row-level security policy for table availability_slots"
-- when RLS is on but INSERT policies are missing or too strict (e.g. role checks).

ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;

-- Drop every existing policy so we can recreate a known-good set.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'availability_slots'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.availability_slots',
      pol.policyname
    );
  END LOOP;
END $$;

-- Ensure is_admin() exists (admins table). Safe if already defined.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.admins
      WHERE user_id = auth.uid()
    )
    OR COALESCE(
      (
        SELECT (to_jsonb(p)->>'is_admin')::boolean
        FROM public.profiles p
        WHERE p.id = auth.uid()
      ),
      false
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Learners + mentors need to read slots for booking / schedule UI.
CREATE POLICY "availability_slots_select"
  ON public.availability_slots
  FOR SELECT
  TO authenticated
  USING (true);

-- Mentors publish only their own rows (mentor_id must match auth user).
CREATE POLICY "availability_slots_insert_own"
  ON public.availability_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    mentor_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY "availability_slots_update_own"
  ON public.availability_slots
  FOR UPDATE
  TO authenticated
  USING (
    mentor_id = auth.uid()
    OR public.is_admin()
  )
  WITH CHECK (
    mentor_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY "availability_slots_delete_own"
  ON public.availability_slots
  FOR DELETE
  TO authenticated
  USING (
    mentor_id = auth.uid()
    OR public.is_admin()
  );

GRANT SELECT ON TABLE public.availability_slots TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.availability_slots TO authenticated;
