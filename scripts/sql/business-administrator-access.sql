BEGIN;
CREATE TABLE IF NOT EXISTS public.business_administrator_credentials (
  user_id integer PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  password_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS business_admin_verified_at timestamptz;
COMMIT;
