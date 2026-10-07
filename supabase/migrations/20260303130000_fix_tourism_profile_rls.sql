-- Enable RLS for tourism_company_profile if not already enabled
ALTER TABLE public.tourism_company_profile ENABLE ROW LEVEL SECURITY;

-- Policy for select
CREATE POLICY "Allow select for authenticated users on tourism_company_profile" 
ON public.tourism_company_profile FOR SELECT 
TO authenticated 
USING (true);

-- Policy for insert
CREATE POLICY "Allow insert for authenticated users on tourism_company_profile" 
ON public.tourism_company_profile FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Policy for update
CREATE POLICY "Allow update for authenticated users on tourism_company_profile" 
ON public.tourism_company_profile FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Policy for delete
CREATE POLICY "Allow delete for authenticated users on tourism_company_profile" 
ON public.tourism_company_profile FOR DELETE 
TO authenticated 
USING (true);
