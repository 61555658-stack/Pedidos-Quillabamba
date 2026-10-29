-- Additive migration: existing accounts are not changed.
CREATE TABLE IF NOT EXISTS public.courier_registration_profiles (
  user_id integer PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  dni text NOT NULL CHECK (dni ~ '^[0-9]{8}$'),
  license_number text NOT NULL,
  vehicle_plate text NOT NULL,
  soat_company text NOT NULL,
  soat_policy_number text NOT NULL,
  soat_start_date date NOT NULL,
  soat_end_date date NOT NULL,
  soat_verified_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
