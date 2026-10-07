-- Create personnel table
CREATE TABLE public.personnel (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    cin TEXT,
    role TEXT NOT NULL DEFAULT 'driver', -- driver, mechanic, admin, staff
    phone TEXT,
    email TEXT,
    address TEXT,
    cnss_number TEXT,
    birth_date DATE,
    hire_date DATE,
    contract_type TEXT, -- CDI, CDD, ANAPEC, etc.
    status TEXT NOT NULL DEFAULT 'active', -- active, inactive, suspended
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for personnel
ALTER TABLE public.personnel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage personnel" ON public.personnel FOR ALL USING (true) WITH CHECK (true);

-- Create personnel_documents table (Dossier administratif)
CREATE TABLE public.personnel_documents (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    personnel_id UUID NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    document_type TEXT NOT NULL, -- contract, cnss, insurance, other
    document_number TEXT,
    issue_date DATE,
    expiry_date DATE,
    file_url TEXT,
    notes TEXT,
    status TEXT DEFAULT 'valid', -- valid, expired, pending
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for personnel_documents
ALTER TABLE public.personnel_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage personnel_documents" ON public.personnel_documents FOR ALL USING (true) WITH CHECK (true);

-- Create driving_licenses table (Permis de conduire)
CREATE TABLE public.driving_licenses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    personnel_id UUID NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
    license_number TEXT NOT NULL,
    categories TEXT[], -- ['B', 'C', 'EC']
    issue_date DATE,
    expiry_date DATE NOT NULL,
    scan_url TEXT,
    status TEXT DEFAULT 'valid', -- valid, expired, suspended
    points_balance INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for driving_licenses
ALTER TABLE public.driving_licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage driving_licenses" ON public.driving_licenses FOR ALL USING (true) WITH CHECK (true);

-- Create medical_visits table (Visites médicales)
CREATE TABLE public.medical_visits (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    personnel_id UUID NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
    visit_date DATE NOT NULL,
    visit_type TEXT NOT NULL, -- hiring, periodic, return_to_work
    next_visit_date DATE,
    doctor_name TEXT,
    diagnosis TEXT,
    fitness_status TEXT NOT NULL DEFAULT 'fit', -- fit, unfit, fit_with_restrictions
    document_url TEXT,
    cost DECIMAL(10, 2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for medical_visits
ALTER TABLE public.medical_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage medical_visits" ON public.medical_visits FOR ALL USING (true) WITH CHECK (true);

-- Create infractions table (Gestion des infractions)
CREATE TABLE public.infractions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    personnel_id UUID NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
    vehicle_id TEXT, -- Optional link to vehicle (GPSwox ID)
    infraction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    infraction_type TEXT NOT NULL, -- speeding, parking, red_light, etc.
    location TEXT,
    amount DECIMAL(10, 2) NOT NULL,
    points_deducted INTEGER DEFAULT 0,
    status TEXT DEFAULT 'unpaid', -- unpaid, paid, contested
    payment_date DATE,
    document_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for infractions
ALTER TABLE public.infractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage infractions" ON public.infractions FOR ALL USING (true) WITH CHECK (true);
