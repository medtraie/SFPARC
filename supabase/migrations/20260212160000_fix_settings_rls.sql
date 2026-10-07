-- Fix RLS for app_settings to allow INSERT
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'app_settings' AND policyname = 'Enable insert access for authenticated users'
    ) THEN
        CREATE POLICY "Enable insert access for authenticated users" ON public.app_settings
            FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;
