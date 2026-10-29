-- Additive development migration. Production schema is applied by Publish.
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS opening_hours jsonb;
