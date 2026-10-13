-- Thumbs up / thumbs down on mentor_videos (Videos feed).
-- One reaction per (video, user); switching replaces the row.

CREATE TABLE IF NOT EXISTS public.video_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.mentor_videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('like', 'dislike')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (video_id, user_id)
);

CREATE INDEX IF NOT EXISTS video_reactions_video_id_idx ON public.video_reactions(video_id);

ALTER TABLE public.video_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS video_reactions_select_all ON public.video_reactions;
CREATE POLICY video_reactions_select_all ON public.video_reactions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS video_reactions_insert_own ON public.video_reactions;
CREATE POLICY video_reactions_insert_own ON public.video_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS video_reactions_update_own ON public.video_reactions;
CREATE POLICY video_reactions_update_own ON public.video_reactions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS video_reactions_delete_own ON public.video_reactions;
CREATE POLICY video_reactions_delete_own ON public.video_reactions
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE VIEW public.video_reaction_counts AS
  SELECT
    video_id,
    COUNT(*) FILTER (WHERE reaction = 'like') AS like_count,
    COUNT(*) FILTER (WHERE reaction = 'dislike') AS dislike_count
  FROM public.video_reactions
  GROUP BY video_id;

GRANT SELECT ON public.video_reaction_counts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_reactions TO authenticated;
