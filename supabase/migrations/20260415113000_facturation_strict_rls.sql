-- Strict per-user isolation for Facturation domain
-- Goal:
--  - User A sees only User A data
--  - User B sees only User B data
--  - New account starts with empty app state

-- 1) Ensure ownership columns exist and are filled
ALTER TABLE public.fact_documents
  ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();
ALTER TABLE public.fact_document_items
  ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();
ALTER TABLE public.fact_document_events
  ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();
ALTER TABLE public.fact_delivery_logs
  ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();

UPDATE public.fact_documents
SET user_id = COALESCE(user_id, created_by)
WHERE user_id IS NULL;

UPDATE public.fact_document_items i
SET user_id = d.user_id
FROM public.fact_documents d
WHERE i.document_id = d.id
  AND i.user_id IS NULL;

UPDATE public.fact_document_events e
SET user_id = COALESCE(e.user_id, e.created_by, d.user_id)
FROM public.fact_documents d
WHERE e.document_id = d.id
  AND e.user_id IS NULL;

UPDATE public.fact_delivery_logs l
SET user_id = COALESCE(l.user_id, l.created_by, d.user_id)
FROM public.fact_documents d
WHERE l.document_id = d.id
  AND l.user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_fact_documents_user_id ON public.fact_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_fact_document_items_user_id ON public.fact_document_items(user_id);
CREATE INDEX IF NOT EXISTS idx_fact_document_events_user_id ON public.fact_document_events(user_id);
CREATE INDEX IF NOT EXISTS idx_fact_delivery_logs_user_id ON public.fact_delivery_logs(user_id);

-- 2) Make doc_number uniqueness user-scoped (avoid cross-user collisions/leaks)
ALTER TABLE public.fact_documents DROP CONSTRAINT IF EXISTS fact_documents_doc_type_doc_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS fact_documents_user_doc_number_key
  ON public.fact_documents (user_id, doc_type, doc_number);

-- 3) Replace permissive policies by strict user policies
ALTER TABLE public.fact_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_document_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_document_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_delivery_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage fact documents" ON public.fact_documents;
DROP POLICY IF EXISTS "Authenticated users can manage fact document items" ON public.fact_document_items;
DROP POLICY IF EXISTS "Authenticated users can manage fact document events" ON public.fact_document_events;
DROP POLICY IF EXISTS "Authenticated users can manage fact delivery logs" ON public.fact_delivery_logs;

DROP POLICY IF EXISTS p_user_select ON public.fact_documents;
DROP POLICY IF EXISTS p_user_insert ON public.fact_documents;
DROP POLICY IF EXISTS p_user_update ON public.fact_documents;
DROP POLICY IF EXISTS p_user_delete ON public.fact_documents;
DROP POLICY IF EXISTS p_user_select ON public.fact_document_items;
DROP POLICY IF EXISTS p_user_insert ON public.fact_document_items;
DROP POLICY IF EXISTS p_user_update ON public.fact_document_items;
DROP POLICY IF EXISTS p_user_delete ON public.fact_document_items;
DROP POLICY IF EXISTS p_user_select ON public.fact_document_events;
DROP POLICY IF EXISTS p_user_insert ON public.fact_document_events;
DROP POLICY IF EXISTS p_user_update ON public.fact_document_events;
DROP POLICY IF EXISTS p_user_delete ON public.fact_document_events;
DROP POLICY IF EXISTS p_user_select ON public.fact_delivery_logs;
DROP POLICY IF EXISTS p_user_insert ON public.fact_delivery_logs;
DROP POLICY IF EXISTS p_user_update ON public.fact_delivery_logs;
DROP POLICY IF EXISTS p_user_delete ON public.fact_delivery_logs;

CREATE POLICY fact_documents_select_own
ON public.fact_documents
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY fact_documents_insert_own
ON public.fact_documents
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = COALESCE(user_id, auth.uid())
  AND auth.uid() = COALESCE(created_by, auth.uid())
);

CREATE POLICY fact_documents_update_own
ON public.fact_documents
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY fact_documents_delete_own
ON public.fact_documents
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY fact_document_items_select_own
ON public.fact_document_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.fact_documents d
    WHERE d.id = fact_document_items.document_id
      AND d.user_id = auth.uid()
  )
);

CREATE POLICY fact_document_items_insert_own
ON public.fact_document_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.fact_documents d
    WHERE d.id = fact_document_items.document_id
      AND d.user_id = auth.uid()
  )
);

CREATE POLICY fact_document_items_update_own
ON public.fact_document_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.fact_documents d
    WHERE d.id = fact_document_items.document_id
      AND d.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.fact_documents d
    WHERE d.id = fact_document_items.document_id
      AND d.user_id = auth.uid()
  )
);

CREATE POLICY fact_document_items_delete_own
ON public.fact_document_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.fact_documents d
    WHERE d.id = fact_document_items.document_id
      AND d.user_id = auth.uid()
  )
);

CREATE POLICY fact_document_events_select_own
ON public.fact_document_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.fact_documents d
    WHERE d.id = fact_document_events.document_id
      AND d.user_id = auth.uid()
  )
);

CREATE POLICY fact_document_events_insert_own
ON public.fact_document_events
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.fact_documents d
    WHERE d.id = fact_document_events.document_id
      AND d.user_id = auth.uid()
  )
);

CREATE POLICY fact_document_events_update_own
ON public.fact_document_events
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.fact_documents d
    WHERE d.id = fact_document_events.document_id
      AND d.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.fact_documents d
    WHERE d.id = fact_document_events.document_id
      AND d.user_id = auth.uid()
  )
);

CREATE POLICY fact_document_events_delete_own
ON public.fact_document_events
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.fact_documents d
    WHERE d.id = fact_document_events.document_id
      AND d.user_id = auth.uid()
  )
);

CREATE POLICY fact_delivery_logs_select_own
ON public.fact_delivery_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.fact_documents d
    WHERE d.id = fact_delivery_logs.document_id
      AND d.user_id = auth.uid()
  )
);

CREATE POLICY fact_delivery_logs_insert_own
ON public.fact_delivery_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.fact_documents d
    WHERE d.id = fact_delivery_logs.document_id
      AND d.user_id = auth.uid()
  )
);

CREATE POLICY fact_delivery_logs_update_own
ON public.fact_delivery_logs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.fact_documents d
    WHERE d.id = fact_delivery_logs.document_id
      AND d.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.fact_documents d
    WHERE d.id = fact_delivery_logs.document_id
      AND d.user_id = auth.uid()
  )
);

CREATE POLICY fact_delivery_logs_delete_own
ON public.fact_delivery_logs
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.fact_documents d
    WHERE d.id = fact_delivery_logs.document_id
      AND d.user_id = auth.uid()
  )
);

-- 4) Harden security-definer functions to user scope
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
  WHERE doc_type = p_doc_type
    AND user_id = auth.uid();

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
  WHERE id = p_document_id
    AND user_id = auth.uid();

  IF v_doc.id IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  UPDATE public.fact_document_items
  SET
    line_subtotal = ROUND((quantity * unit_price) * (1 - COALESCE(discount_rate, 0) / 100), 2),
    line_tax_amount = ROUND(((quantity * unit_price) * (1 - COALESCE(discount_rate, 0) / 100)) * (COALESCE(tax_rate, 0) / 100), 2),
    line_total = ROUND(((quantity * unit_price) * (1 - COALESCE(discount_rate, 0) / 100)) * (1 + COALESCE(tax_rate, 0) / 100), 2),
    updated_at = now(),
    user_id = COALESCE(user_id, auth.uid())
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
    updated_at = now(),
    user_id = COALESCE(user_id, auth.uid())
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
    WHERE id = p_source_document_id
      AND user_id = auth.uid();
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
    created_by,
    user_id
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
    auth.uid(),
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
      extra_fields,
      user_id
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
      extra_fields,
      auth.uid()
    FROM public.fact_document_items
    WHERE document_id = v_source.id
    ORDER BY line_order;
  END IF;

  INSERT INTO public.fact_document_events (
    document_id,
    event_type,
    event_label,
    event_payload,
    created_by,
    user_id
  )
  VALUES (
    v_doc.id,
    CASE WHEN v_source.id IS NULL THEN 'created' ELSE 'converted' END,
    CASE WHEN v_source.id IS NULL THEN 'Document créé' ELSE 'Document converti depuis ' || v_source.doc_type END,
    jsonb_build_object('source_document_id', p_source_document_id, 'doc_type', p_doc_type),
    auth.uid(),
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
  WHERE id = p_source_document_id
    AND user_id = auth.uid();

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
  WHERE id = v_source.id
    AND user_id = auth.uid();

  INSERT INTO public.fact_document_events (
    document_id,
    event_type,
    event_label,
    event_payload,
    created_by,
    user_id
  )
  VALUES (
    v_source.id,
    'converted_out',
    'Converti vers ' || p_target_doc_type,
    jsonb_build_object('target_document_id', v_doc.id, 'target_doc_type', p_target_doc_type),
    auth.uid(),
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
        AND user_id = auth.uid()
    ), 0) AS pending_devis_amount,
    COALESCE((
      SELECT COUNT(*)
      FROM public.fact_documents bl
      WHERE bl.doc_type = 'bon_livraison'
        AND bl.user_id = auth.uid()
        AND NOT EXISTS (
          SELECT 1
          FROM public.fact_documents fa
          WHERE fa.user_id = auth.uid()
            AND fa.doc_type = 'facture'
            AND (fa.source_document_id = bl.id OR fa.root_document_id = COALESCE(bl.root_document_id, bl.id))
        )
    ), 0) AS bl_not_invoiced_count,
    COALESCE((
      SELECT COUNT(*)
      FROM public.fact_documents
      WHERE doc_type = 'facture'
        AND status IN ('issued', 'sent', 'partial', 'overdue')
        AND user_id = auth.uid()
    ), 0) AS unpaid_invoices_count,
    COALESCE((
      SELECT SUM(total_amount)
      FROM public.fact_documents
      WHERE doc_type = 'facture'
        AND status IN ('issued', 'sent', 'partial', 'overdue')
        AND user_id = auth.uid()
    ), 0) AS unpaid_invoices_amount;
END;
$$;

CREATE OR REPLACE FUNCTION public.fact_queue_delivery(
  p_document_id UUID,
  p_channel TEXT,
  p_recipient TEXT,
  p_subject TEXT DEFAULT NULL,
  p_message_body TEXT DEFAULT NULL
)
RETURNS public.fact_delivery_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_delivery public.fact_delivery_logs;
  v_doc public.fact_documents;
BEGIN
  SELECT * INTO v_doc
  FROM public.fact_documents
  WHERE id = p_document_id
    AND user_id = auth.uid();

  IF v_doc.id IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  INSERT INTO public.fact_delivery_logs (
    document_id,
    channel,
    recipient,
    subject,
    message_body,
    status,
    created_by,
    user_id
  )
  VALUES (
    p_document_id,
    p_channel,
    p_recipient,
    p_subject,
    p_message_body,
    'queued',
    auth.uid(),
    auth.uid()
  )
  RETURNING * INTO v_delivery;

  INSERT INTO public.fact_document_events (
    document_id,
    event_type,
    event_label,
    event_payload,
    created_by,
    user_id
  )
  VALUES (
    p_document_id,
    'delivery_queued',
    CASE WHEN p_channel = 'whatsapp' THEN 'WhatsApp en file d''attente' ELSE 'Email en file d''attente' END,
    jsonb_build_object(
      'delivery_id', v_delivery.id,
      'channel', p_channel,
      'recipient', p_recipient,
      'status', 'queued'
    ),
    auth.uid(),
    auth.uid()
  );

  RETURN v_delivery;
END;
$$;

