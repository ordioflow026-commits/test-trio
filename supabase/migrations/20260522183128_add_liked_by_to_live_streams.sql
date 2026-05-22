ALTER TABLE public.live_streams
ADD COLUMN IF NOT EXISTS liked_by text[] DEFAULT '{}'::text[];
