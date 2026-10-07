-- Module: Location de véhicules

CREATE TABLE IF NOT EXISTS public.rental_vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_url TEXT,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  registration TEXT NOT NULL UNIQUE,
  vehicle_type TEXT NOT NULL DEFAULT 'car',
  fuel_capacity NUMERIC,
  current_mileage NUMERIC,
  price_per_day NUMERIC NOT NULL DEFAULT 0,
  price_per_week NUMERIC NOT NULL DEFAULT 0,
  price_per_month NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available',
  gps_imei TEXT,
  fuel_consumption NUMERIC,
  insurance_company TEXT,
  insurance_expiry DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rental_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  driver_license_number TEXT,
  driver_license_expiry DATE,
  driver_license_photo_url TEXT,
  id_document_url TEXT,
  security_deposit_amount NUMERIC NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rental_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_number TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES public.rental_clients(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL REFERENCES public.rental_vehicles(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  price_per_day NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  security_deposit NUMERIC NOT NULL DEFAULT 0,
  options JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rental_reservations_date_check CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.rental_rentals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rental_number TEXT NOT NULL UNIQUE,
  reservation_id UUID REFERENCES public.rental_reservations(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES public.rental_clients(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL REFERENCES public.rental_vehicles(id) ON DELETE RESTRICT,
  start_datetime TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_datetime TIMESTAMPTZ,
  actual_return_datetime TIMESTAMPTZ,
  start_mileage NUMERIC,
  end_mileage NUMERIC,
  fuel_level_start NUMERIC,
  fuel_level_end NUMERIC,
  total_price NUMERIC NOT NULL DEFAULT 0,
  extra_charges NUMERIC NOT NULL DEFAULT 0,
  late_penalty NUMERIC NOT NULL DEFAULT 0,
  missing_fuel_charge NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rental_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rental_id UUID NOT NULL REFERENCES public.rental_rentals(id) ON DELETE CASCADE,
  contract_number TEXT NOT NULL UNIQUE,
  contract_json JSONB,
  signature_data_url TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rental_inspections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rental_id UUID REFERENCES public.rental_rentals(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.rental_vehicles(id) ON DELETE CASCADE,
  inspection_type TEXT NOT NULL,
  checklist JSONB,
  fuel_level NUMERIC,
  mileage NUMERIC,
  photos JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rental_fuel_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.rental_vehicles(id) ON DELETE CASCADE,
  rental_id UUID REFERENCES public.rental_rentals(id) ON DELETE SET NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  liters NUMERIC NOT NULL DEFAULT 0,
  fuel_price_total NUMERIC NOT NULL DEFAULT 0,
  mileage NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rental_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  rental_id UUID NOT NULL REFERENCES public.rental_rentals(id) ON DELETE CASCADE,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  amount_total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  email_sent BOOLEAN NOT NULL DEFAULT false,
  invoice_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rental_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_type TEXT NOT NULL,
  title TEXT,
  message TEXT,
  payload JSONB,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rental_reservations_vehicle_dates ON public.rental_reservations(vehicle_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_rental_rentals_vehicle_status ON public.rental_rentals(vehicle_id, status);
CREATE INDEX IF NOT EXISTS idx_rental_rentals_client_status ON public.rental_rentals(client_id, status);

ALTER TABLE public.rental_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_fuel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users manage rental_vehicles" ON public.rental_vehicles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users manage rental_clients" ON public.rental_clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users manage rental_reservations" ON public.rental_reservations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users manage rental_rentals" ON public.rental_rentals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users manage rental_contracts" ON public.rental_contracts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users manage rental_inspections" ON public.rental_inspections FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users manage rental_fuel_logs" ON public.rental_fuel_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users manage rental_invoices" ON public.rental_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users manage rental_notifications" ON public.rental_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

