CREATE TABLE IF NOT EXISTS public.fact_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type TEXT NOT NULL CHECK (doc_type IN ('devis', 'bon_commande', 'bon_livraison', 'facture')),
  doc_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  currency TEXT NOT NULL DEFAULT 'MAD',
  language TEXT NOT NULL DEFAULT 'fr' CHECK (language IN ('fr', 'ar')),
  direction TEXT NOT NULL DEFAULT 'ltr' CHECK (direction IN ('ltr', 'rtl')),
  template_type TEXT NOT NULL DEFAULT 'classic' CHECK (template_type IN ('classic', 'modern', 'minimalist', 'creative')),
  show_header BOOLEAN NOT NULL DEFAULT true,
  show_footer BOOLEAN NOT NULL DEFAULT true,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  client_address TEXT,
  seller_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  custom_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(6, 2) NOT NULL DEFAULT 20,
  tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  source_document_id UUID REFERENCES public.fact_documents(id) ON DELETE SET NULL,
  root_document_id UUID REFERENCES public.fact_documents(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (doc_type, doc_number)
);

CREATE TABLE IF NOT EXISTS public.fact_document_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.fact_documents(id) ON DELETE CASCADE,
  line_order INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL,
  quantity NUMERIC(12, 3) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'u',
  unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount_rate NUMERIC(6, 2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(6, 2) NOT NULL DEFAULT 20,
  line_subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
  line_tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  line_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  extra_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fact_document_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.fact_documents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_label TEXT NOT NULL,
  event_payload JSONB,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fact_documents_type_status_idx ON public.fact_documents(doc_type, status);
CREATE INDEX IF NOT EXISTS fact_documents_source_idx ON public.fact_documents(source_document_id);
CREATE INDEX IF NOT EXISTS fact_document_items_document_idx ON public.fact_document_items(document_id, line_order);
CREATE INDEX IF NOT EXISTS fact_document_events_document_idx ON public.fact_document_events(document_id, created_at DESC);

ALTER TABLE public.fact_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_document_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_document_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage fact documents" ON public.fact_documents;
CREATE POLICY "Authenticated users can manage fact documents"
ON public.fact_documents
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage fact document items" ON public.fact_document_items;
CREATE POLICY "Authenticated users can manage fact document items"
ON public.fact_document_items
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage fact document events" ON public.fact_document_events;
CREATE POLICY "Authenticated users can manage fact document events"
ON public.fact_document_events
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.fact_get_societe_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_snapshot JSONB;
BEGIN
  SELECT value::jsonb
  INTO v_snapshot
  FROM public.app_settings
  WHERE key = 'societe_profile'
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_snapshot IS NULL THEN
    SELECT to_jsonb(t)
    INTO v_snapshot
    FROM (
      SELECT
        company_name,
        contact_email,
        contact_phone,
        address,
        tax_info,
        logo_url
      FROM public.tourism_company_profile
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1
    ) t;
  END IF;

  IF v_snapshot IS NULL THEN
    v_snapshot := '{}'::jsonb;
  END IF;

  RETURN v_snapshot;
END;
$$;

CREATE OR REPLACE FUNCTION public.fact_generate_doc_number(p_doc_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prefix TEXT;
  v_count BIGINT;
BEGIN
  v_prefix := CASE p_doc_type
    WHEN 'devis' THEN 'DV'
    WHEN 'bon_commande' THEN 'BC'
    WHEN 'bon_livraison' THEN 'BL'
    WHEN 'facture' THEN 'FA'
    ELSE 'DOC'
  END;

  SELECT COUNT(*) + 1 INTO v_count
  FROM public.fact_documents
  WHERE doc_type = p_doc_type;

  RETURN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYY') || '-' || LPAD(v_count::TEXT, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.fact_recompute_totals(p_document_id UUID)
RETURNS public.fact_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_doc public.fact_documents;
  v_subtotal NUMERIC;
  v_tax NUMERIC;
BEGIN
  SELECT * INTO v_doc
  FROM public.fact_documents
  WHERE id = p_document_id;

  IF v_doc.id IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  UPDATE public.fact_document_items
  SET
    line_subtotal = ROUND((quantity * unit_price) * (1 - COALESCE(discount_rate, 0) / 100), 2),
    line_tax_amount = ROUND(((quantity * unit_price) * (1 - COALESCE(discount_rate, 0) / 100)) * (COALESCE(tax_rate, 0) / 100), 2),
    line_total = ROUND(((quantity * unit_price) * (1 - COALESCE(discount_rate, 0) / 100)) * (1 + COALESCE(tax_rate, 0) / 100), 2),
    updated_at = now()
  WHERE document_id = p_document_id;

  SELECT
    COALESCE(SUM(line_subtotal), 0),
    COALESCE(SUM(line_tax_amount), 0)
  INTO v_subtotal, v_tax
  FROM public.fact_document_items
  WHERE document_id = p_document_id;

  UPDATE public.fact_documents
  SET
    subtotal = ROUND(v_subtotal, 2),
    tax_amount = ROUND(v_tax, 2),
    total_amount = ROUND(v_subtotal + v_tax - COALESCE(discount_amount, 0), 2),
    updated_at = now()
  WHERE id = p_document_id
  RETURNING * INTO v_doc;

  RETURN v_doc;
END;
$$;

CREATE OR REPLACE FUNCTION public.fact_create_document(
  p_doc_type TEXT,
  p_client_name TEXT,
  p_client_email TEXT DEFAULT NULL,
  p_client_phone TEXT DEFAULT NULL,
  p_client_address TEXT DEFAULT NULL,
  p_issue_date DATE DEFAULT CURRENT_DATE,
  p_due_date DATE DEFAULT NULL,
  p_template_type TEXT DEFAULT 'classic',
  p_language TEXT DEFAULT 'fr',
  p_direction TEXT DEFAULT 'ltr',
  p_show_header BOOLEAN DEFAULT true,
  p_show_footer BOOLEAN DEFAULT true,
  p_notes TEXT DEFAULT NULL,
  p_custom_columns JSONB DEFAULT '[]'::jsonb,
  p_source_document_id UUID DEFAULT NULL
)
RETURNS public.fact_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_doc public.fact_documents;
  v_source public.fact_documents;
  v_root UUID;
BEGIN
  IF p_source_document_id IS NOT NULL THEN
    SELECT * INTO v_source
    FROM public.fact_documents
    WHERE id = p_source_document_id;
  END IF;

  v_root := CASE
    WHEN v_source.id IS NULL THEN NULL
    WHEN v_source.root_document_id IS NULL THEN v_source.id
    ELSE v_source.root_document_id
  END;

  INSERT INTO public.fact_documents (
    doc_type,
    doc_number,
    status,
    issue_date,
    due_date,
    template_type,
    language,
    direction,
    show_header,
    show_footer,
    client_name,
    client_email,
    client_phone,
    client_address,
    seller_snapshot,
    custom_columns,
    notes,
    source_document_id,
    root_document_id,
    created_by
  )
  VALUES (
    p_doc_type,
    public.fact_generate_doc_number(p_doc_type),
    'draft',
    COALESCE(p_issue_date, CURRENT_DATE),
    p_due_date,
    COALESCE(p_template_type, 'classic'),
    COALESCE(p_language, 'fr'),
    COALESCE(p_direction, CASE WHEN COALESCE(p_language, 'fr') = 'ar' THEN 'rtl' ELSE 'ltr' END),
    COALESCE(p_show_header, true),
    COALESCE(p_show_footer, true),
    COALESCE(p_client_name, v_source.client_name),
    COALESCE(p_client_email, v_source.client_email),
    COALESCE(p_client_phone, v_source.client_phone),
    COALESCE(p_client_address, v_source.client_address),
    public.fact_get_societe_snapshot(),
    COALESCE(p_custom_columns, COALESCE(v_source.custom_columns, '[]'::jsonb)),
    COALESCE(p_notes, v_source.notes),
    p_source_document_id,
    v_root,
    auth.uid()
  )
  RETURNING * INTO v_doc;

  IF v_source.id IS NOT NULL THEN
    INSERT INTO public.fact_document_items (
      document_id,
      line_order,
      description,
      quantity,
      unit,
      unit_price,
      discount_rate,
      tax_rate,
      line_subtotal,
      line_tax_amount,
      line_total,
      extra_fields
    )
    SELECT
      v_doc.id,
      line_order,
      description,
      quantity,
      unit,
      unit_price,
      discount_rate,
      tax_rate,
      line_subtotal,
      line_tax_amount,
      line_total,
      extra_fields
    FROM public.fact_document_items
    WHERE document_id = v_source.id
    ORDER BY line_order;
  END IF;

  INSERT INTO public.fact_document_events (
    document_id,
    event_type,
    event_label,
    event_payload,
    created_by
  )
  VALUES (
    v_doc.id,
    CASE WHEN v_source.id IS NULL THEN 'created' ELSE 'converted' END,
    CASE WHEN v_source.id IS NULL THEN 'Document créé' ELSE 'Document converti depuis ' || v_source.doc_type END,
    jsonb_build_object('source_document_id', p_source_document_id, 'doc_type', p_doc_type),
    auth.uid()
  );

  PERFORM public.fact_recompute_totals(v_doc.id);
  SELECT * INTO v_doc FROM public.fact_documents WHERE id = v_doc.id;
  RETURN v_doc;
END;
$$;

CREATE OR REPLACE FUNCTION public.fact_convert_document(
  p_source_document_id UUID,
  p_target_doc_type TEXT
)
RETURNS public.fact_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_source public.fact_documents;
  v_doc public.fact_documents;
BEGIN
  SELECT * INTO v_source
  FROM public.fact_documents
  WHERE id = p_source_document_id;

  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'Source document not found';
  END IF;

  v_doc := public.fact_create_document(
    p_target_doc_type,
    v_source.client_name,
    v_source.client_email,
    v_source.client_phone,
    v_source.client_address,
    CURRENT_DATE,
    CASE WHEN p_target_doc_type = 'facture' THEN CURRENT_DATE + INTERVAL '30 days' ELSE NULL END,
    v_source.template_type,
    v_source.language,
    v_source.direction,
    v_source.show_header,
    v_source.show_footer,
    v_source.notes,
    v_source.custom_columns,
    v_source.id
  );

  UPDATE public.fact_documents
  SET
    status = CASE
      WHEN v_source.doc_type = 'devis' THEN 'approved'
      WHEN v_source.doc_type = 'bon_commande' THEN 'ordered'
      WHEN v_source.doc_type = 'bon_livraison' THEN 'delivered'
      ELSE status
    END,
    updated_at = now()
  WHERE id = v_source.id;

  INSERT INTO public.fact_document_events (
    document_id,
    event_type,
    event_label,
    event_payload,
    created_by
  )
  VALUES (
    v_source.id,
    'converted_out',
    'Converti vers ' || p_target_doc_type,
    jsonb_build_object('target_document_id', v_doc.id, 'target_doc_type', p_target_doc_type),
    auth.uid()
  );

  RETURN v_doc;
END;
$$;

CREATE OR REPLACE FUNCTION public.fact_get_quick_stats()
RETURNS TABLE (
  pending_devis_amount NUMERIC,
  bl_not_invoiced_count BIGINT,
  unpaid_invoices_count BIGINT,
  unpaid_invoices_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((
      SELECT SUM(total_amount)
      FROM public.fact_documents
      WHERE doc_type = 'devis'
        AND status IN ('draft', 'sent', 'pending')
    ), 0) AS pending_devis_amount,
    COALESCE((
      SELECT COUNT(*)
      FROM public.fact_documents bl
      WHERE bl.doc_type = 'bon_livraison'
        AND NOT EXISTS (
          SELECT 1
          FROM public.fact_documents fa
          WHERE fa.doc_type = 'facture'
            AND (fa.source_document_id = bl.id OR fa.root_document_id = COALESCE(bl.root_document_id, bl.id))
        )
    ), 0) AS bl_not_invoiced_count,
    COALESCE((
      SELECT COUNT(*)
      FROM public.fact_documents
      WHERE doc_type = 'facture'
        AND status IN ('issued', 'sent', 'partial', 'overdue')
    ), 0) AS unpaid_invoices_count,
    COALESCE((
      SELECT SUM(total_amount)
      FROM public.fact_documents
      WHERE doc_type = 'facture'
        AND status IN ('issued', 'sent', 'partial', 'overdue')
    ), 0) AS unpaid_invoices_amount;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fact_get_societe_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fact_generate_doc_number(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fact_recompute_totals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fact_create_document(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fact_convert_document(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fact_get_quick_stats() TO authenticated;
