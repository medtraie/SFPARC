
-- TMS Clients
CREATE TABLE public.tms_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  ice TEXT, -- Identifiant Commun de l'Entreprise (Morocco tax ID)
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tms_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can manage tms_clients" ON public.tms_clients FOR ALL USING (true) WITH CHECK (true);

-- TMS Tarifs (pricing rules per km + weight)
CREATE TABLE public.tms_tarifs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  client_id UUID REFERENCES public.tms_clients(id) ON DELETE SET NULL,
  price_per_km NUMERIC NOT NULL DEFAULT 0,
  price_per_ton NUMERIC NOT NULL DEFAULT 0,
  min_price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MAD',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tms_tarifs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can manage tms_tarifs" ON public.tms_tarifs FOR ALL USING (true) WITH CHECK (true);

-- TMS Devis (quotes)
CREATE TABLE public.tms_devis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  devis_number TEXT NOT NULL,
  client_id UUID REFERENCES public.tms_clients(id) ON DELETE SET NULL,
  tarif_id UUID REFERENCES public.tms_tarifs(id) ON DELETE SET NULL,
  pickup_address TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  distance_km NUMERIC NOT NULL DEFAULT 0,
  weight_tons NUMERIC NOT NULL DEFAULT 0,
  merchandise_type TEXT,
  amount_ht NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 20,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  amount_ttc NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, accepted, rejected, expired
  valid_until DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tms_devis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can manage tms_devis" ON public.tms_devis FOR ALL USING (true) WITH CHECK (true);

-- TMS Transport Orders
CREATE TABLE public.tms_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL,
  devis_id UUID REFERENCES public.tms_devis(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.tms_clients(id) ON DELETE SET NULL,
  tarif_id UUID REFERENCES public.tms_tarifs(id) ON DELETE SET NULL,
  vehicle_id TEXT,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  pickup_address TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  pickup_date DATE NOT NULL,
  delivery_date DATE,
  distance_km NUMERIC NOT NULL DEFAULT 0,
  weight_tons NUMERIC NOT NULL DEFAULT 0,
  merchandise_type TEXT,
  status TEXT NOT NULL DEFAULT 'planned', -- planned, loading, in_transit, delivered, cancelled
  amount_ht NUMERIC NOT NULL DEFAULT 0,
  -- Cost tracking
  fuel_cost NUMERIC NOT NULL DEFAULT 0,
  toll_cost NUMERIC NOT NULL DEFAULT 0,
  driver_cost NUMERIC NOT NULL DEFAULT 0,
  other_costs NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tms_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can manage tms_orders" ON public.tms_orders FOR ALL USING (true) WITH CHECK (true);

-- TMS Invoices
CREATE TABLE public.tms_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  client_id UUID REFERENCES public.tms_clients(id) ON DELETE SET NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_distance_km NUMERIC NOT NULL DEFAULT 0,
  total_weight_tons NUMERIC NOT NULL DEFAULT 0,
  amount_ht NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 20,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  amount_ttc NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  profit NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, paid, cancelled
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tms_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can manage tms_invoices" ON public.tms_invoices FOR ALL USING (true) WITH CHECK (true);

-- TMS Invoice Lines (link invoices to orders)
CREATE TABLE public.tms_invoice_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.tms_invoices(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.tms_orders(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tms_invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can manage tms_invoice_lines" ON public.tms_invoice_lines FOR ALL USING (true) WITH CHECK (true);
