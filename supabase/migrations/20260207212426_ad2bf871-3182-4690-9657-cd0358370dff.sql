-- Table des clients touristiques
CREATE TABLE public.tourism_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des missions touristiques
CREATE TABLE public.tourism_missions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference TEXT NOT NULL,
  client_id UUID REFERENCES public.tourism_clients(id) ON DELETE SET NULL,
  mission_type TEXT NOT NULL DEFAULT 'transfer', -- transfer, excursion, circuit, rental
  title TEXT NOT NULL,
  description TEXT,
  vehicle_id TEXT,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  passengers_count INTEGER DEFAULT 1,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  pickup_location TEXT,
  dropoff_location TEXT,
  status TEXT NOT NULL DEFAULT 'planned', -- planned, dispatched, in_progress, completed, cancelled
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
  notes TEXT,
  driver_instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des étapes d'itinéraire (waypoints)
CREATE TABLE public.tourism_waypoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID NOT NULL REFERENCES public.tourism_missions(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL DEFAULT 1,
  location_name TEXT NOT NULL,
  address TEXT,
  gps_lat NUMERIC,
  gps_lng NUMERIC,
  planned_arrival TIME,
  planned_departure TIME,
  actual_arrival TIME,
  actual_departure TIME,
  distance_from_previous_km NUMERIC,
  duration_from_previous_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table de facturation touristique
CREATE TABLE public.tourism_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES public.tourism_clients(id) ON DELETE SET NULL,
  mission_id UUID REFERENCES public.tourism_missions(id) ON DELETE SET NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  billing_type TEXT NOT NULL DEFAULT 'flat', -- flat, hourly, per_km, custom
  hours_worked NUMERIC DEFAULT 0,
  hourly_rate NUMERIC DEFAULT 0,
  kilometers NUMERIC DEFAULT 0,
  per_km_rate NUMERIC DEFAULT 0,
  flat_rate NUMERIC DEFAULT 0,
  custom_lines JSONB DEFAULT '[]'::jsonb,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 20,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, paid, cancelled
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.tourism_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tourism_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tourism_waypoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tourism_invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies for tourism_clients
CREATE POLICY "Authenticated users can view tourism_clients" ON public.tourism_clients FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create tourism_clients" ON public.tourism_clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update tourism_clients" ON public.tourism_clients FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete tourism_clients" ON public.tourism_clients FOR DELETE USING (true);

-- RLS policies for tourism_missions
CREATE POLICY "Authenticated users can view tourism_missions" ON public.tourism_missions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create tourism_missions" ON public.tourism_missions FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update tourism_missions" ON public.tourism_missions FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete tourism_missions" ON public.tourism_missions FOR DELETE USING (true);

-- RLS policies for tourism_waypoints
CREATE POLICY "Authenticated users can view tourism_waypoints" ON public.tourism_waypoints FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create tourism_waypoints" ON public.tourism_waypoints FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update tourism_waypoints" ON public.tourism_waypoints FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete tourism_waypoints" ON public.tourism_waypoints FOR DELETE USING (true);

-- RLS policies for tourism_invoices
CREATE POLICY "Authenticated users can view tourism_invoices" ON public.tourism_invoices FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create tourism_invoices" ON public.tourism_invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update tourism_invoices" ON public.tourism_invoices FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete tourism_invoices" ON public.tourism_invoices FOR DELETE USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_tourism_clients_updated_at BEFORE UPDATE ON public.tourism_clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tourism_missions_updated_at BEFORE UPDATE ON public.tourism_missions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tourism_invoices_updated_at BEFORE UPDATE ON public.tourism_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();