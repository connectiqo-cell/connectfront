-- Promote mentor library videos to the top of the learner Videos feed.
ALTER TABLE public.mentor_videos
  ADD COLUMN IF NOT EXISTS is_promoted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.mentor_videos.is_promoted IS
  'When true, video sorts above non-promoted videos in the global Videos feed.';
COMMENT ON COLUMN public.mentor_videos.promoted_at IS
  'When the video was last promoted; used to order among promoted videos.';

CREATE INDEX IF NOT EXISTS mentor_videos_promoted_feed_idx
  ON public.mentor_videos (is_promoted DESC, promoted_at DESC NULLS LAST, created_at DESC);
