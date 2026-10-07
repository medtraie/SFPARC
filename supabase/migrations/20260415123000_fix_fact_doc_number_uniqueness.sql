-- Fix duplicate doc_number generation for facturation
-- Root cause:
-- previous implementation used COUNT(*) + 1, which can collide after deletes
-- or under concurrent inserts.

CREATE OR REPLACE FUNCTION public.fact_generate_doc_number(p_doc_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prefix TEXT;
  v_year TEXT;
  v_next BIGINT;
  v_doc_number TEXT;
  v_lock_key BIGINT;
BEGIN
  v_prefix := CASE p_doc_type
    WHEN 'devis' THEN 'DV'
    WHEN 'bon_commande' THEN 'BC'
    WHEN 'bon_livraison' THEN 'BL'
    WHEN 'facture' THEN 'FA'
    ELSE 'DOC'
  END;

  v_year := to_char(CURRENT_DATE, 'YYYY');

  -- Serialize generation per (user, doc_type, year) to avoid race conditions.
  v_lock_key := hashtextextended(
    coalesce(auth.uid()::text, 'anon') || '|' || p_doc_type || '|' || v_year,
    0
  );
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COALESCE(MAX(split_part(doc_number, '-', 3)::BIGINT), 0) + 1
  INTO v_next
  FROM public.fact_documents
  WHERE user_id = auth.uid()
    AND doc_type = p_doc_type
    AND split_part(doc_number, '-', 1) = v_prefix
    AND split_part(doc_number, '-', 2) = v_year
    AND split_part(doc_number, '-', 3) ~ '^[0-9]+$';

  v_doc_number := v_prefix || '-' || v_year || '-' || LPAD(v_next::TEXT, 5, '0');
  RETURN v_doc_number;
END;
$$;

