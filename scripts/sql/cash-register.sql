-- Additive migration. Preserve existing public tables and data.
BEGIN;
CREATE TABLE IF NOT EXISTS public.cashier_credentials (
  username text PRIMARY KEY,
  shift text NOT NULL CHECK (shift IN ('morning','afternoon')),
  password_hash text NOT NULL
);
INSERT INTO public.cashier_credentials(username,shift,password_hash) VALUES
('caja1m','morning','scrypt$6d0b8b95274c5047ccec23a8128c7151$3197b15182af3d50dc7aca39a6b659ae2185e67ec668423f6bbcafe8c57420a547cefe632bfa807e974d6fe8a7cf085210a0232d624dc9163125045fee65c861'),
('caja1t','afternoon','scrypt$6d0b8b95274c5047ccec23a8128c7151$3197b15182af3d50dc7aca39a6b659ae2185e67ec668423f6bbcafe8c57420a547cefe632bfa807e974d6fe8a7cf085210a0232d624dc9163125045fee65c861')
ON CONFLICT(username) DO NOTHING;
CREATE TABLE IF NOT EXISTS public.cash_shifts (
  id serial PRIMARY KEY,
  business_id integer NOT NULL REFERENCES public.restaurants(id),
  opened_by integer NOT NULL REFERENCES public.users(id),
  username text NOT NULL REFERENCES public.cashier_credentials(username),
  shift text NOT NULL CHECK (shift IN ('morning','afternoon')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by integer REFERENCES public.users(id),
  CHECK (closed_at IS NULL OR closed_at >= opened_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS cash_shifts_one_open_register
  ON public.cash_shifts(business_id,username) WHERE closed_at IS NULL;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS business_mode text NOT NULL DEFAULT 'choose';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS cash_shift_id integer REFERENCES public.cash_shifts(id);
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS cashier_login_failures integer NOT NULL DEFAULT 0;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS cashier_lock_until timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cash_shift_id integer REFERENCES public.cash_shifts(id);
CREATE INDEX IF NOT EXISTS orders_cash_shift_idx ON public.orders(cash_shift_id);
CREATE TABLE IF NOT EXISTS public.cash_order_events (
  id serial PRIMARY KEY,
  shift_id integer NOT NULL REFERENCES public.cash_shifts(id),
  order_id integer NOT NULL REFERENCES public.orders(id),
  action text NOT NULL CHECK(action IN ('released','assigned')),
  courier_id integer REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cash_events_shift_idx ON public.cash_order_events(shift_id);
COMMIT;
