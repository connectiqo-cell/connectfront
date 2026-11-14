-- Blocking an abusive user: hides them both ways and notifies moderators by
-- filing a report in the same queue reviewers already work from.
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT user_blocks_not_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx
  ON public.user_blocks(blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_blocks_select_own" ON public.user_blocks;
CREATE POLICY "user_blocks_select_own"
  ON public.user_blocks FOR SELECT TO authenticated
  USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS "user_blocks_insert_own" ON public.user_blocks;
CREATE POLICY "user_blocks_insert_own"
  ON public.user_blocks FOR INSERT TO authenticated
  WITH CHECK (blocker_id = auth.uid() AND blocked_id <> auth.uid());

DROP POLICY IF EXISTS "user_blocks_delete_own" ON public.user_blocks;
CREATE POLICY "user_blocks_delete_own"
  ON public.user_blocks FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

-- Moderators read every block from the admin dashboard; they cannot create or
-- undo one, since unblocking is the blocker's decision alone.
DROP POLICY IF EXISTS "user_blocks_admin_select" ON public.user_blocks;
CREATE POLICY "user_blocks_admin_select"
  ON public.user_blocks FOR SELECT TO authenticated
  USING (public.is_admin());

REVOKE ALL ON TABLE public.user_blocks FROM anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.user_blocks TO authenticated;

-- Block + moderator notification in one round trip.
CREATE OR REPLACE FUNCTION public.block_user(
  p_blocked_id UUID,
  p_reason TEXT DEFAULT 'other',
  p_details TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reason TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to block a user.';
  END IF;
  IF p_blocked_id IS NULL OR p_blocked_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot block this account.';
  END IF;

  INSERT INTO user_blocks (blocker_id, blocked_id)
  VALUES (auth.uid(), p_blocked_id)
  ON CONFLICT DO NOTHING;

  v_reason := CASE
    WHEN p_reason IN ('harassment', 'hate_or_abuse', 'sexual_content',
                      'spam_or_scam', 'impersonation', 'unsafe_behavior')
      THEN p_reason
    ELSE 'other'
  END;

  INSERT INTO user_reports (
    reporter_id, reported_user_id, reason, details, context_type, context_id
  )
  VALUES (
    auth.uid(), p_blocked_id, v_reason,
    left(COALESCE(NULLIF(btrim(p_details), ''), 'Reported automatically when this user was blocked.'), 1000),
    'profile', NULL
  )
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.block_user(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.block_user(UUID, TEXT, TEXT) TO authenticated;

-- Video feeds skip anyone either side has blocked.
CREATE OR REPLACE FUNCTION public.get_public_videos_for_viewer(p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, mentor_id uuid, title text, description text, video_url text, hls_url text, thumbnail_url text, is_free boolean, "position" integer, is_promoted boolean, promoted_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    v.id, v.mentor_id, v.title, v.description,
    case when v.is_free or auth.uid() = v.mentor_id or exists (
      select 1 from learner_unlocks u
      where u.learner_id = auth.uid() and u.mentor_id = v.mentor_id
        and (u.expires_at is null or u.expires_at > now())
    ) then v.video_url else null end as video_url,
    case when v.is_free or auth.uid() = v.mentor_id or exists (
      select 1 from learner_unlocks u
      where u.learner_id = auth.uid() and u.mentor_id = v.mentor_id
        and (u.expires_at is null or u.expires_at > now())
    ) then v.hls_url else null end as hls_url,
    v.thumbnail_url, v.is_free, v."position", v.is_promoted, v.promoted_at,
    v.created_at
  from mentor_videos v
  where not exists (
    select 1 from user_blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = v.mentor_id)
       or (b.blocker_id = v.mentor_id and b.blocked_id = auth.uid())
  )
  order by v.is_promoted desc, v.promoted_at desc nulls last, v.created_at desc
  limit p_limit offset p_offset;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_video_by_id(p_video_id uuid)
 RETURNS TABLE(id uuid, mentor_id uuid, title text, description text, video_url text, hls_url text, thumbnail_url text, is_free boolean, "position" integer, is_promoted boolean, promoted_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    v.id, v.mentor_id, v.title, v.description,
    case when v.is_free or auth.uid() = v.mentor_id or exists (
      select 1 from learner_unlocks u
      where u.learner_id = auth.uid() and u.mentor_id = v.mentor_id
        and (u.expires_at is null or u.expires_at > now())
    ) then v.video_url else null end as video_url,
    case when v.is_free or auth.uid() = v.mentor_id or exists (
      select 1 from learner_unlocks u
      where u.learner_id = auth.uid() and u.mentor_id = v.mentor_id
        and (u.expires_at is null or u.expires_at > now())
    ) then v.hls_url else null end as hls_url,
    v.thumbnail_url, v.is_free, v."position", v.is_promoted, v.promoted_at,
    v.created_at
  from mentor_videos v
  where v.id = p_video_id
    and not exists (
      select 1 from user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = v.mentor_id)
         or (b.blocker_id = v.mentor_id and b.blocked_id = auth.uid())
    );
$function$;

CREATE OR REPLACE FUNCTION public.get_mentor_videos_for_viewer(p_mentor_id uuid)
 RETURNS TABLE(id uuid, mentor_id uuid, title text, description text, video_url text, hls_url text, thumbnail_url text, is_free boolean, "position" integer, is_promoted boolean, promoted_at timestamp with time zone, storage_path text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    v.id, v.mentor_id, v.title, v.description,
    case when v.is_free or auth.uid() = v.mentor_id or exists (
      select 1 from learner_unlocks u
      where u.learner_id = auth.uid() and u.mentor_id = v.mentor_id
        and (u.expires_at is null or u.expires_at > now())
    ) then v.video_url else null end as video_url,
    case when v.is_free or auth.uid() = v.mentor_id or exists (
      select 1 from learner_unlocks u
      where u.learner_id = auth.uid() and u.mentor_id = v.mentor_id
        and (u.expires_at is null or u.expires_at > now())
    ) then v.hls_url else null end as hls_url,
    v.thumbnail_url, v.is_free, v."position", v.is_promoted, v.promoted_at,
    v.storage_path, v.created_at
  from mentor_videos v
  where v.mentor_id = p_mentor_id
    and not exists (
      select 1 from user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = v.mentor_id)
         or (b.blocker_id = v.mentor_id and b.blocked_id = auth.uid())
    )
  order by v."position" asc nulls last, v.created_at asc;
$function$;
