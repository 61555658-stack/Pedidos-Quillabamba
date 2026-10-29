BEGIN;
CREATE TABLE IF NOT EXISTS public.order_vouchers (
  order_id integer PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id integer NOT NULL REFERENCES public.users(id),
  number text NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL,
  snapshot jsonb NOT NULL,
  email_status text NOT NULL DEFAULT 'not_requested'
    CHECK (email_status IN ('not_requested','pending','sending','sent','failed')),
  email_attempts integer NOT NULL DEFAULT 0,
  next_email_attempt_at timestamptz,
  last_email_requested_at timestamptz,
  email_sent_at timestamptz,
  email_lease_until timestamptz,
  email_lease_token text
);
CREATE INDEX IF NOT EXISTS order_vouchers_customer_idx ON public.order_vouchers(customer_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS order_vouchers_email_idx ON public.order_vouchers(email_status, next_email_attempt_at);
COMMIT;
