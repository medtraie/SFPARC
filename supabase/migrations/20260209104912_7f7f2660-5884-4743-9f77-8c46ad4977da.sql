-- Transport de Voyageurs (Passenger Transport) Module

-- Lines table (خطوط النقل)
CREATE TABLE public.passenger_lines (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    departure_city TEXT NOT NULL,
    arrival_city TEXT NOT NULL,
    distance_km NUMERIC,
    estimated_duration_minutes INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Stations/Stops table (المحطات)
CREATE TABLE public.passenger_stations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    line_id UUID NOT NULL REFERENCES public.passenger_lines(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    sequence_order INTEGER NOT NULL DEFAULT 1,
    distance_from_start_km NUMERIC DEFAULT 0,
    gps_lat NUMERIC,
    gps_lng NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Fares table (التعريفات حسب المحطات)
CREATE TABLE public.passenger_fares (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    line_id UUID NOT NULL REFERENCES public.passenger_lines(id) ON DELETE CASCADE,
    from_station_id UUID NOT NULL REFERENCES public.passenger_stations(id) ON DELETE CASCADE,
    to_station_id UUID NOT NULL REFERENCES public.passenger_stations(id) ON DELETE CASCADE,
    fare_amount NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(line_id, from_station_id, to_station_id)
);

-- Trips/Departures table (الرحلات المجدولة)
CREATE TABLE public.passenger_trips (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    line_id UUID NOT NULL REFERENCES public.passenger_lines(id) ON DELETE CASCADE,
    trip_date DATE NOT NULL,
    departure_time TIME NOT NULL,
    arrival_time TIME,
    vehicle_id TEXT,
    driver_id UUID REFERENCES public.drivers(id),
    status TEXT NOT NULL DEFAULT 'scheduled',
    available_seats INTEGER DEFAULT 50,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tickets table (التذاكر)
CREATE TABLE public.passenger_tickets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_number TEXT NOT NULL UNIQUE,
    trip_id UUID NOT NULL REFERENCES public.passenger_trips(id) ON DELETE CASCADE,
    from_station_id UUID NOT NULL REFERENCES public.passenger_stations(id),
    to_station_id UUID NOT NULL REFERENCES public.passenger_stations(id),
    fare_amount NUMERIC NOT NULL,
    issue_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'valid',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Baggage tickets table (تذاكر الأمتعة)
CREATE TABLE public.passenger_baggage (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    baggage_number TEXT NOT NULL UNIQUE,
    ticket_id UUID REFERENCES public.passenger_tickets(id) ON DELETE SET NULL,
    trip_id UUID NOT NULL REFERENCES public.passenger_trips(id) ON DELETE CASCADE,
    weight_kg NUMERIC,
    fee_amount NUMERIC NOT NULL DEFAULT 0,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'checked',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.passenger_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passenger_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passenger_fares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passenger_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passenger_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passenger_baggage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for passenger_lines
CREATE POLICY "Authenticated users can view passenger_lines" ON public.passenger_lines FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create passenger_lines" ON public.passenger_lines FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update passenger_lines" ON public.passenger_lines FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete passenger_lines" ON public.passenger_lines FOR DELETE USING (true);

-- RLS Policies for passenger_stations
CREATE POLICY "Authenticated users can view passenger_stations" ON public.passenger_stations FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create passenger_stations" ON public.passenger_stations FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update passenger_stations" ON public.passenger_stations FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete passenger_stations" ON public.passenger_stations FOR DELETE USING (true);

-- RLS Policies for passenger_fares
CREATE POLICY "Authenticated users can view passenger_fares" ON public.passenger_fares FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create passenger_fares" ON public.passenger_fares FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update passenger_fares" ON public.passenger_fares FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete passenger_fares" ON public.passenger_fares FOR DELETE USING (true);

-- RLS Policies for passenger_trips
CREATE POLICY "Authenticated users can view passenger_trips" ON public.passenger_trips FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create passenger_trips" ON public.passenger_trips FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update passenger_trips" ON public.passenger_trips FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete passenger_trips" ON public.passenger_trips FOR DELETE USING (true);

-- RLS Policies for passenger_tickets
CREATE POLICY "Authenticated users can view passenger_tickets" ON public.passenger_tickets FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create passenger_tickets" ON public.passenger_tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update passenger_tickets" ON public.passenger_tickets FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete passenger_tickets" ON public.passenger_tickets FOR DELETE USING (true);

-- RLS Policies for passenger_baggage
CREATE POLICY "Authenticated users can view passenger_baggage" ON public.passenger_baggage FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create passenger_baggage" ON public.passenger_baggage FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update passenger_baggage" ON public.passenger_baggage FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete passenger_baggage" ON public.passenger_baggage FOR DELETE USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_passenger_lines_updated_at BEFORE UPDATE ON public.passenger_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_passenger_fares_updated_at BEFORE UPDATE ON public.passenger_fares FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_passenger_trips_updated_at BEFORE UPDATE ON public.passenger_trips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();