-- Create chantiers (construction sites / quarries) table
CREATE TABLE public.chantiers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'chantier', -- 'chantier' or 'carriere'
    address TEXT,
    city TEXT,
    gps_lat NUMERIC,
    gps_lng NUMERIC,
    contact_name TEXT,
    contact_phone TEXT,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'inactive'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create trajets (routes) table
CREATE TABLE public.trajets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    origin_chantier_id UUID REFERENCES public.chantiers(id) ON DELETE SET NULL,
    destination_chantier_id UUID REFERENCES public.chantiers(id) ON DELETE SET NULL,
    distance_km NUMERIC,
    estimated_duration_minutes INTEGER,
    price_per_ton NUMERIC NOT NULL DEFAULT 0,
    price_per_trip NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create voyages (trips) table
CREATE TABLE public.voyages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    trajet_id UUID REFERENCES public.trajets(id) ON DELETE SET NULL,
    vehicle_id TEXT NOT NULL,
    driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
    voyage_date DATE NOT NULL,
    tonnage NUMERIC NOT NULL DEFAULT 0,
    material_type TEXT, -- 'sable', 'gravier', 'beton', etc.
    departure_time TIME,
    arrival_time TIME,
    status TEXT NOT NULL DEFAULT 'completed', -- 'pending', 'in_progress', 'completed', 'cancelled'
    bon_number TEXT, -- Bon de livraison number
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create factures (invoices) table
CREATE TABLE public.factures (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    facture_number TEXT NOT NULL UNIQUE,
    client_name TEXT NOT NULL,
    client_address TEXT,
    chantier_id UUID REFERENCES public.chantiers(id) ON DELETE SET NULL,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    total_tonnage NUMERIC NOT NULL DEFAULT 0,
    total_trips INTEGER NOT NULL DEFAULT 0,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    tax_rate NUMERIC NOT NULL DEFAULT 20,
    tax_amount NUMERIC NOT NULL DEFAULT 0,
    total_with_tax NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'sent', 'paid', 'cancelled'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create facture_lines table for invoice details
CREATE TABLE public.facture_lines (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    facture_id UUID NOT NULL REFERENCES public.factures(id) ON DELETE CASCADE,
    voyage_id UUID REFERENCES public.voyages(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'tonne',
    unit_price NUMERIC NOT NULL DEFAULT 0,
    total_price NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.chantiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trajets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voyages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facture_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chantiers
CREATE POLICY "Authenticated users can view chantiers" ON public.chantiers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create chantiers" ON public.chantiers FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update chantiers" ON public.chantiers FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete chantiers" ON public.chantiers FOR DELETE USING (true);

-- RLS Policies for trajets
CREATE POLICY "Authenticated users can view trajets" ON public.trajets FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create trajets" ON public.trajets FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update trajets" ON public.trajets FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete trajets" ON public.trajets FOR DELETE USING (true);

-- RLS Policies for voyages
CREATE POLICY "Authenticated users can view voyages" ON public.voyages FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create voyages" ON public.voyages FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update voyages" ON public.voyages FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete voyages" ON public.voyages FOR DELETE USING (true);

-- RLS Policies for factures
CREATE POLICY "Authenticated users can view factures" ON public.factures FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create factures" ON public.factures FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update factures" ON public.factures FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete factures" ON public.factures FOR DELETE USING (true);

-- RLS Policies for facture_lines
CREATE POLICY "Authenticated users can view facture_lines" ON public.facture_lines FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create facture_lines" ON public.facture_lines FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update facture_lines" ON public.facture_lines FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete facture_lines" ON public.facture_lines FOR DELETE USING (true);

-- Create triggers for updated_at
CREATE TRIGGER update_chantiers_updated_at BEFORE UPDATE ON public.chantiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_trajets_updated_at BEFORE UPDATE ON public.trajets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_voyages_updated_at BEFORE UPDATE ON public.voyages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_factures_updated_at BEFORE UPDATE ON public.factures FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();