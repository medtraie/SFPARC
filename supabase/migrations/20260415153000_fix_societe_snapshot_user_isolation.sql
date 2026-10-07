CREATE OR REPLACE FUNCTION public.fact_get_societe_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_settings JSONB := '{}'::jsonb;
  v_table RECORD;
BEGIN
  -- Always read the current authenticated user's settings row only.
  SELECT value::jsonb
  INTO v_settings
  FROM public.app_settings
  WHERE key = 'societe_profile'
    AND user_id = auth.uid()
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  -- Read fallback profile strictly for the same user to avoid cross-user leakage.
  SELECT
    company_name,
    contact_email,
    contact_phone,
    address,
    tax_info,
    logo_url,
    signature_url
  INTO v_table
  FROM public.tourism_company_profile
  WHERE user_id = auth.uid()
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  RETURN jsonb_build_object(
    'company_name', COALESCE(NULLIF(v_settings->>'company_name', ''), v_table.company_name),
    'contact_email', COALESCE(NULLIF(v_settings->>'contact_email', ''), v_table.contact_email),
    'contact_phone', COALESCE(NULLIF(v_settings->>'contact_phone', ''), v_table.contact_phone),
    'address', COALESCE(NULLIF(v_settings->>'address', ''), v_table.address),
    'tax_info', COALESCE(NULLIF(v_settings->>'tax_info', ''), v_table.tax_info),
    'logo_url', COALESCE(NULLIF(v_settings->>'logo_url', ''), v_table.logo_url),
    'signature_url', COALESCE(NULLIF(v_settings->>'signature_url', ''), v_table.signature_url)
  );
END;
$$;
