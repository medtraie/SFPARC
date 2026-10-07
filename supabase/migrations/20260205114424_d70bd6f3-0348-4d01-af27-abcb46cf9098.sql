-- Create drivers table
CREATE TABLE public.drivers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  license_type TEXT NOT NULL DEFAULT 'B',
  license_expiry DATE NOT NULL,
  vehicle_id TEXT, -- GPSwox vehicle ID (string)
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'on_mission', 'off_duty')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create missions table
CREATE TABLE public.missions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id TEXT NOT NULL, -- GPSwox vehicle ID
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  departure_zone TEXT NOT NULL,
  arrival_zone TEXT NOT NULL,
  mission_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create fuel_logs table
CREATE TABLE public.fuel_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id TEXT NOT NULL, -- GPSwox vehicle ID
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  log_date DATE NOT NULL,
  liters DECIMAL(10,2) NOT NULL,
  price_per_liter DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(10,2) GENERATED ALWAYS AS (liters * price_per_liter) STORED,
  station TEXT NOT NULL,
  mileage INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create maintenance table
CREATE TABLE public.maintenance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id TEXT NOT NULL, -- GPSwox vehicle ID
  maintenance_type TEXT NOT NULL,
  maintenance_date DATE NOT NULL,
  cost DECIMAL(10,2),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for drivers (all authenticated users have full access)
CREATE POLICY "Authenticated users can view drivers" 
ON public.drivers FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create drivers" 
ON public.drivers FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update drivers" 
ON public.drivers FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete drivers" 
ON public.drivers FOR DELETE 
TO authenticated
USING (true);

-- Create RLS policies for missions
CREATE POLICY "Authenticated users can view missions" 
ON public.missions FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create missions" 
ON public.missions FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update missions" 
ON public.missions FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete missions" 
ON public.missions FOR DELETE 
TO authenticated
USING (true);

-- Create RLS policies for fuel_logs
CREATE POLICY "Authenticated users can view fuel_logs" 
ON public.fuel_logs FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create fuel_logs" 
ON public.fuel_logs FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update fuel_logs" 
ON public.fuel_logs FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete fuel_logs" 
ON public.fuel_logs FOR DELETE 
TO authenticated
USING (true);

-- Create RLS policies for maintenance
CREATE POLICY "Authenticated users can view maintenance" 
ON public.maintenance FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create maintenance" 
ON public.maintenance FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update maintenance" 
ON public.maintenance FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete maintenance" 
ON public.maintenance FOR DELETE 
TO authenticated
USING (true);

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_drivers_updated_at
BEFORE UPDATE ON public.drivers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_missions_updated_at
BEFORE UPDATE ON public.missions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fuel_logs_updated_at
BEFORE UPDATE ON public.fuel_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_maintenance_updated_at
BEFORE UPDATE ON public.maintenance
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();