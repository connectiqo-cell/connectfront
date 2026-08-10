-- Public social profile links on mentor pages (YouTube, Instagram, X, LinkedIn).
ALTER TABLE public.mentor_profiles
  ADD COLUMN IF NOT EXISTS youtube_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS x_url text,
  ADD COLUMN IF NOT EXISTS linkedin_url text;
