-- Create app_settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users (Read)
CREATE POLICY "Enable read access for authenticated users" ON public.app_settings
    FOR SELECT USING (auth.role() = 'authenticated');

-- Create policy for authenticated users (Update)
CREATE POLICY "Enable update access for authenticated users" ON public.app_settings
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Create policy for authenticated users (Insert)
CREATE POLICY "Enable insert access for authenticated users" ON public.app_settings
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Insert default module settings
INSERT INTO public.app_settings (key, value, description)
VALUES (
    'module_activation',
    '{
        "dashboard": true,
        "vehicles": true,
        "drivers": true,
        "personnel": true,
        "live_map": true,
        "missions": true,
        "transport_btp": true,
        "transport_touristique": true,
        "transport_voyageurs": true,
        "transport_tms": true,
        "fuel": true,
        "finance": true
    }'::JSONB,
    'Configuration de l''activation des modules de l''application'
) ON CONFLICT (key) DO NOTHING;
