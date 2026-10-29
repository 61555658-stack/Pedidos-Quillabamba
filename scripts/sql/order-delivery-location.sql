-- Preserve addresses for existing orders and older APK clients.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_location jsonb;
