ALTER TABLE public.tourism_missions
  ADD COLUMN IF NOT EXISTS start_km NUMERIC,
  ADD COLUMN IF NOT EXISTS end_km NUMERIC,
  ADD COLUMN IF NOT EXISTS total_km NUMERIC,
  ADD COLUMN IF NOT EXISTS meal_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS driver_parking NUMERIC,
  ADD COLUMN IF NOT EXISTS driver_toll NUMERIC,
  ADD COLUMN IF NOT EXISTS driver_misc NUMERIC,
  ADD COLUMN IF NOT EXISTS driver_expenses_total NUMERIC,
  ADD COLUMN IF NOT EXISTS dossier_number TEXT,
  ADD COLUMN IF NOT EXISTS mission_number TEXT,
  ADD COLUMN IF NOT EXISTS version_number TEXT;

CREATE TABLE IF NOT EXISTS public.tourism_company_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text,
  contact_email text,
  contact_phone text,
  address text,
  tax_info text,
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
