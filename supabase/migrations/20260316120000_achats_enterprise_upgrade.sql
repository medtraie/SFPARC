CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.achats_suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_code TEXT NOT NULL UNIQUE,
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  ice_if TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  payment_terms TEXT,
  payment_due_days INTEGER NOT NULL DEFAULT 30,
  quality_score NUMERIC NOT NULL DEFAULT 0,
  delay_score NUMERIC NOT NULL DEFAULT 0,
  volume_score NUMERIC NOT NULL DEFAULT 0,
  branch_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.achats_purchase_requests
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.achats_suppliers(id),
  ADD COLUMN IF NOT EXISTS branch_code TEXT,
  ADD COLUMN IF NOT EXISTS workflow_level INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS rejected_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS document_hash TEXT;

ALTER TABLE public.achats_purchase_orders
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.achats_suppliers(id),
  ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES public.achats_purchase_requests(id),
  ADD COLUMN IF NOT EXISTS branch_code TEXT,
  ADD COLUMN IF NOT EXISTS workflow_level INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS rejected_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS document_hash TEXT;

ALTER TABLE public.achats_delivery_notes
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.achats_suppliers(id),
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.achats_purchase_orders(id),
  ADD COLUMN IF NOT EXISTS branch_code TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS document_hash TEXT;

ALTER TABLE public.achats_supplier_invoices
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.achats_suppliers(id),
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.achats_purchase_orders(id),
  ADD COLUMN IF NOT EXISTS delivery_id UUID REFERENCES public.achats_delivery_notes(id),
  ADD COLUMN IF NOT EXISTS branch_code TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS document_hash TEXT;

CREATE TABLE IF NOT EXISTS public.achats_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  row_id UUID NOT NULL,
  action TEXT NOT NULL,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  old_data JSONB,
  new_data JSONB
);

CREATE OR REPLACE FUNCTION public.achats_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.jwt() ->> 'app_role', auth.jwt() ->> 'role', 'buyer');
$$;

CREATE OR REPLACE FUNCTION public.achats_user_branch()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(COALESCE(auth.jwt() ->> 'branch_code', ''), '');
$$;

CREATE OR REPLACE FUNCTION public.achats_is_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT public.achats_user_role() IN ('admin', 'manager', 'finance_manager');
$$;

CREATE OR REPLACE FUNCTION public.achats_set_actor_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    NEW.updated_by := COALESCE(NEW.updated_by, auth.uid());
    NEW.branch_code := COALESCE(NEW.branch_code, public.achats_user_branch());
  ELSE
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.achats_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.achats_generate_number(prefix TEXT, num_column TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  y TEXT := to_char(CURRENT_DATE, 'YYYY');
  seq_num INTEGER;
  sql_stmt TEXT;
BEGIN
  sql_stmt := format(
    'SELECT COALESCE(MAX(CASE WHEN split_part(%I, ''-'', 2) = %L THEN split_part(%I, ''-'', 3)::INTEGER END), 0) + 1 FROM %I.%I',
    num_column, y, num_column, 'public', TG_TABLE_NAME
  );
  EXECUTE sql_stmt INTO seq_num;
  RETURN prefix || '-' || y || '-' || lpad(seq_num::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.achats_fill_document_number_hash()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  doc_prefix TEXT;
  doc_number TEXT;
  date_text TEXT;
BEGIN
  IF TG_TABLE_NAME = 'achats_purchase_requests' THEN
    doc_prefix := 'DA';
    IF COALESCE(NEW.request_number, '') = '' THEN
      NEW.request_number := public.achats_generate_number(doc_prefix, 'request_number');
    END IF;
    doc_number := NEW.request_number;
    date_text := NEW.request_date::TEXT;
  ELSIF TG_TABLE_NAME = 'achats_purchase_orders' THEN
    doc_prefix := 'BC';
    IF COALESCE(NEW.order_number, '') = '' THEN
      NEW.order_number := public.achats_generate_number(doc_prefix, 'order_number');
    END IF;
    doc_number := NEW.order_number;
    date_text := NEW.order_date::TEXT;
  ELSIF TG_TABLE_NAME = 'achats_delivery_notes' THEN
    doc_prefix := 'BL';
    IF COALESCE(NEW.delivery_number, '') = '' THEN
      NEW.delivery_number := public.achats_generate_number(doc_prefix, 'delivery_number');
    END IF;
    doc_number := NEW.delivery_number;
    date_text := NEW.delivery_date::TEXT;
  ELSE
    doc_prefix := 'FF';
    IF COALESCE(NEW.invoice_number, '') = '' THEN
      NEW.invoice_number := public.achats_generate_number(doc_prefix, 'invoice_number');
    END IF;
    doc_number := NEW.invoice_number;
    date_text := NEW.invoice_date::TEXT;
  END IF;

  NEW.document_hash := encode(
    digest(
      COALESCE(doc_number, '') || '|' ||
      COALESCE(NEW.supplier_name, '') || '|' ||
      COALESCE(date_text, '') || '|' ||
      COALESCE(NEW.total_amount::TEXT, '0'),
      'sha256'
    ),
    'hex'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.achats_can_transition(entity_name TEXT, old_status TEXT, new_status TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  role_name TEXT := public.achats_user_role();
BEGIN
  IF new_status = old_status OR old_status IS NULL THEN
    RETURN true;
  END IF;

  IF entity_name = 'request' THEN
    RETURN (
      (old_status = 'draft' AND new_status = 'submitted')
      OR (old_status = 'rejected' AND new_status IN ('draft', 'submitted'))
      OR (old_status = 'submitted' AND new_status IN ('approved', 'rejected') AND role_name IN ('admin', 'manager'))
    );
  ELSIF entity_name = 'order' THEN
    RETURN (
      (old_status = 'draft' AND new_status = 'submitted')
      OR (old_status = 'submitted' AND new_status IN ('approved', 'rejected') AND role_name IN ('admin', 'manager'))
      OR (old_status = 'approved' AND new_status IN ('sent', 'cancelled'))
      OR (old_status = 'sent' AND new_status IN ('received', 'cancelled'))
      OR (old_status = 'rejected' AND new_status = 'draft')
    );
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.achats_enforce_workflow()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'achats_purchase_requests' THEN
      IF NOT public.achats_can_transition('request', OLD.status, NEW.status) THEN
        RAISE EXCEPTION 'Transition invalide pour la demande d''achat (% -> %)', OLD.status, NEW.status;
      END IF;
      IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
        NEW.approved_by := auth.uid();
        NEW.approved_at := now();
      ELSIF NEW.status = 'rejected' AND OLD.status <> 'rejected' THEN
        NEW.rejected_by := auth.uid();
        NEW.rejected_at := now();
      END IF;
    ELSIF TG_TABLE_NAME = 'achats_purchase_orders' THEN
      IF NOT public.achats_can_transition('order', OLD.status, NEW.status) THEN
        RAISE EXCEPTION 'Transition invalide pour le bon de commande (% -> %)', OLD.status, NEW.status;
      END IF;
      IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
        NEW.approved_by := auth.uid();
        NEW.approved_at := now();
      ELSIF NEW.status = 'rejected' AND OLD.status <> 'rejected' THEN
        NEW.rejected_by := auth.uid();
        NEW.rejected_at := now();
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.achats_validate_three_way_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_order public.achats_purchase_orders%ROWTYPE;
  v_delivery public.achats_delivery_notes%ROWTYPE;
BEGIN
  IF NEW.status = 'paid' THEN
    IF NEW.order_id IS NULL OR NEW.delivery_id IS NULL THEN
      RAISE EXCEPTION 'Paiement bloqué: ordre et livraison obligatoires pour la facture.';
    END IF;

    SELECT * INTO v_order FROM public.achats_purchase_orders WHERE id = NEW.order_id AND deleted_at IS NULL;
    SELECT * INTO v_delivery FROM public.achats_delivery_notes WHERE id = NEW.delivery_id AND deleted_at IS NULL;

    IF v_order.id IS NULL OR v_delivery.id IS NULL THEN
      RAISE EXCEPTION 'Paiement bloqué: bon de commande ou bon de livraison introuvable.';
    END IF;
    IF v_delivery.order_id IS DISTINCT FROM v_order.id THEN
      RAISE EXCEPTION 'Paiement bloqué: BL non lié au BC.';
    END IF;
    IF NEW.supplier_id IS NOT NULL AND v_order.supplier_id IS NOT NULL AND NEW.supplier_id <> v_order.supplier_id THEN
      RAISE EXCEPTION 'Paiement bloqué: fournisseur facture différent du BC.';
    END IF;
    IF abs(COALESCE(NEW.total_amount, 0) - COALESCE(v_order.total_amount, 0)) > 1 THEN
      RAISE EXCEPTION 'Paiement bloqué: total facture hors tolérance par rapport au BC.';
    END IF;
  END IF;

  IF NEW.status IN ('draft', 'received') AND NEW.due_date IS NOT NULL AND NEW.due_date < CURRENT_DATE THEN
    NEW.status := 'overdue';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.achats_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.achats_audit_logs (table_name, row_id, action, changed_by, old_data, new_data)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_achats_suppliers_set_actor_fields ON public.achats_suppliers;
CREATE TRIGGER trg_achats_suppliers_set_actor_fields
BEFORE INSERT OR UPDATE ON public.achats_suppliers
FOR EACH ROW EXECUTE FUNCTION public.achats_set_actor_fields();

DROP TRIGGER IF EXISTS trg_achats_suppliers_set_updated_at ON public.achats_suppliers;
CREATE TRIGGER trg_achats_suppliers_set_updated_at
BEFORE UPDATE ON public.achats_suppliers
FOR EACH ROW EXECUTE FUNCTION public.achats_set_updated_at();

DROP TRIGGER IF EXISTS trg_achats_purchase_requests_set_actor_fields ON public.achats_purchase_requests;
CREATE TRIGGER trg_achats_purchase_requests_set_actor_fields
BEFORE INSERT OR UPDATE ON public.achats_purchase_requests
FOR EACH ROW EXECUTE FUNCTION public.achats_set_actor_fields();

DROP TRIGGER IF EXISTS trg_achats_purchase_orders_set_actor_fields ON public.achats_purchase_orders;
CREATE TRIGGER trg_achats_purchase_orders_set_actor_fields
BEFORE INSERT OR UPDATE ON public.achats_purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.achats_set_actor_fields();

DROP TRIGGER IF EXISTS trg_achats_delivery_notes_set_actor_fields ON public.achats_delivery_notes;
CREATE TRIGGER trg_achats_delivery_notes_set_actor_fields
BEFORE INSERT OR UPDATE ON public.achats_delivery_notes
FOR EACH ROW EXECUTE FUNCTION public.achats_set_actor_fields();

DROP TRIGGER IF EXISTS trg_achats_supplier_invoices_set_actor_fields ON public.achats_supplier_invoices;
CREATE TRIGGER trg_achats_supplier_invoices_set_actor_fields
BEFORE INSERT OR UPDATE ON public.achats_supplier_invoices
FOR EACH ROW EXECUTE FUNCTION public.achats_set_actor_fields();

DROP TRIGGER IF EXISTS trg_achats_purchase_requests_set_updated_at ON public.achats_purchase_requests;
CREATE TRIGGER trg_achats_purchase_requests_set_updated_at
BEFORE UPDATE ON public.achats_purchase_requests
FOR EACH ROW EXECUTE FUNCTION public.achats_set_updated_at();

DROP TRIGGER IF EXISTS trg_achats_purchase_orders_set_updated_at ON public.achats_purchase_orders;
CREATE TRIGGER trg_achats_purchase_orders_set_updated_at
BEFORE UPDATE ON public.achats_purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.achats_set_updated_at();

DROP TRIGGER IF EXISTS trg_achats_delivery_notes_set_updated_at ON public.achats_delivery_notes;
CREATE TRIGGER trg_achats_delivery_notes_set_updated_at
BEFORE UPDATE ON public.achats_delivery_notes
FOR EACH ROW EXECUTE FUNCTION public.achats_set_updated_at();

DROP TRIGGER IF EXISTS trg_achats_supplier_invoices_set_updated_at ON public.achats_supplier_invoices;
CREATE TRIGGER trg_achats_supplier_invoices_set_updated_at
BEFORE UPDATE ON public.achats_supplier_invoices
FOR EACH ROW EXECUTE FUNCTION public.achats_set_updated_at();

DROP TRIGGER IF EXISTS trg_achats_purchase_requests_fill_number_hash ON public.achats_purchase_requests;
CREATE TRIGGER trg_achats_purchase_requests_fill_number_hash
BEFORE INSERT OR UPDATE ON public.achats_purchase_requests
FOR EACH ROW EXECUTE FUNCTION public.achats_fill_document_number_hash();

DROP TRIGGER IF EXISTS trg_achats_purchase_orders_fill_number_hash ON public.achats_purchase_orders;
CREATE TRIGGER trg_achats_purchase_orders_fill_number_hash
BEFORE INSERT OR UPDATE ON public.achats_purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.achats_fill_document_number_hash();

DROP TRIGGER IF EXISTS trg_achats_delivery_notes_fill_number_hash ON public.achats_delivery_notes;
CREATE TRIGGER trg_achats_delivery_notes_fill_number_hash
BEFORE INSERT OR UPDATE ON public.achats_delivery_notes
FOR EACH ROW EXECUTE FUNCTION public.achats_fill_document_number_hash();

DROP TRIGGER IF EXISTS trg_achats_supplier_invoices_fill_number_hash ON public.achats_supplier_invoices;
CREATE TRIGGER trg_achats_supplier_invoices_fill_number_hash
BEFORE INSERT OR UPDATE ON public.achats_supplier_invoices
FOR EACH ROW EXECUTE FUNCTION public.achats_fill_document_number_hash();

DROP TRIGGER IF EXISTS trg_achats_purchase_requests_workflow ON public.achats_purchase_requests;
CREATE TRIGGER trg_achats_purchase_requests_workflow
BEFORE UPDATE ON public.achats_purchase_requests
FOR EACH ROW EXECUTE FUNCTION public.achats_enforce_workflow();

DROP TRIGGER IF EXISTS trg_achats_purchase_orders_workflow ON public.achats_purchase_orders;
CREATE TRIGGER trg_achats_purchase_orders_workflow
BEFORE UPDATE ON public.achats_purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.achats_enforce_workflow();

DROP TRIGGER IF EXISTS trg_achats_supplier_invoices_three_way_match ON public.achats_supplier_invoices;
CREATE TRIGGER trg_achats_supplier_invoices_three_way_match
BEFORE INSERT OR UPDATE ON public.achats_supplier_invoices
FOR EACH ROW EXECUTE FUNCTION public.achats_validate_three_way_match();

DROP TRIGGER IF EXISTS trg_achats_suppliers_audit ON public.achats_suppliers;
CREATE TRIGGER trg_achats_suppliers_audit
AFTER INSERT OR UPDATE OR DELETE ON public.achats_suppliers
FOR EACH ROW EXECUTE FUNCTION public.achats_audit_trigger();

DROP TRIGGER IF EXISTS trg_achats_purchase_requests_audit ON public.achats_purchase_requests;
CREATE TRIGGER trg_achats_purchase_requests_audit
AFTER INSERT OR UPDATE OR DELETE ON public.achats_purchase_requests
FOR EACH ROW EXECUTE FUNCTION public.achats_audit_trigger();

DROP TRIGGER IF EXISTS trg_achats_purchase_orders_audit ON public.achats_purchase_orders;
CREATE TRIGGER trg_achats_purchase_orders_audit
AFTER INSERT OR UPDATE OR DELETE ON public.achats_purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.achats_audit_trigger();

DROP TRIGGER IF EXISTS trg_achats_delivery_notes_audit ON public.achats_delivery_notes;
CREATE TRIGGER trg_achats_delivery_notes_audit
AFTER INSERT OR UPDATE OR DELETE ON public.achats_delivery_notes
FOR EACH ROW EXECUTE FUNCTION public.achats_audit_trigger();

DROP TRIGGER IF EXISTS trg_achats_supplier_invoices_audit ON public.achats_supplier_invoices;
CREATE TRIGGER trg_achats_supplier_invoices_audit
AFTER INSERT OR UPDATE OR DELETE ON public.achats_supplier_invoices
FOR EACH ROW EXECUTE FUNCTION public.achats_audit_trigger();

CREATE INDEX IF NOT EXISTS idx_achats_suppliers_name ON public.achats_suppliers(legal_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_achats_suppliers_branch ON public.achats_suppliers(branch_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_achats_requests_number_status_date ON public.achats_purchase_requests(request_number, status, request_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_achats_requests_supplier_status ON public.achats_purchase_requests(supplier_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_achats_orders_number_status_date ON public.achats_purchase_orders(order_number, status, order_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_achats_orders_supplier_status ON public.achats_purchase_orders(supplier_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_achats_deliveries_number_status_date ON public.achats_delivery_notes(delivery_number, status, delivery_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_achats_invoices_number_status_date ON public.achats_supplier_invoices(invoice_number, status, invoice_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_achats_invoices_due_date ON public.achats_supplier_invoices(due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_achats_invoices_order_delivery ON public.achats_supplier_invoices(order_id, delivery_id) WHERE deleted_at IS NULL;

ALTER TABLE public.achats_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achats_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users manage achats_purchase_requests" ON public.achats_purchase_requests;
DROP POLICY IF EXISTS "Auth users manage achats_purchase_orders" ON public.achats_purchase_orders;
DROP POLICY IF EXISTS "Auth users manage achats_delivery_notes" ON public.achats_delivery_notes;
DROP POLICY IF EXISTS "Auth users manage achats_supplier_invoices" ON public.achats_supplier_invoices;
DROP POLICY IF EXISTS "Auth users manage achats_purchase_request_items" ON public.achats_purchase_request_items;
DROP POLICY IF EXISTS "Auth users manage achats_purchase_order_items" ON public.achats_purchase_order_items;
DROP POLICY IF EXISTS "Auth users manage achats_delivery_note_items" ON public.achats_delivery_note_items;
DROP POLICY IF EXISTS "Auth users manage achats_supplier_invoice_items" ON public.achats_supplier_invoice_items;

CREATE POLICY "achats_requests_select_secure" ON public.achats_purchase_requests
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND (
    branch_code IS NULL
    OR branch_code = public.achats_user_branch()
    OR public.achats_is_manager()
  )
);

CREATE POLICY "achats_requests_write_secure" ON public.achats_purchase_requests
FOR ALL TO authenticated
USING (
  deleted_at IS NULL
  AND (
    branch_code IS NULL
    OR branch_code = public.achats_user_branch()
    OR public.achats_is_manager()
  )
)
WITH CHECK (
  deleted_at IS NULL
  AND (
    branch_code IS NULL
    OR branch_code = public.achats_user_branch()
    OR public.achats_is_manager()
  )
);

CREATE POLICY "achats_orders_select_secure" ON public.achats_purchase_orders
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND (
    branch_code IS NULL
    OR branch_code = public.achats_user_branch()
    OR public.achats_is_manager()
  )
);

CREATE POLICY "achats_orders_write_secure" ON public.achats_purchase_orders
FOR ALL TO authenticated
USING (
  deleted_at IS NULL
  AND (
    branch_code IS NULL
    OR branch_code = public.achats_user_branch()
    OR public.achats_is_manager()
  )
)
WITH CHECK (
  deleted_at IS NULL
  AND (
    branch_code IS NULL
    OR branch_code = public.achats_user_branch()
    OR public.achats_is_manager()
  )
);

CREATE POLICY "achats_deliveries_select_secure" ON public.achats_delivery_notes
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND (
    branch_code IS NULL
    OR branch_code = public.achats_user_branch()
    OR public.achats_is_manager()
  )
);

CREATE POLICY "achats_deliveries_write_secure" ON public.achats_delivery_notes
FOR ALL TO authenticated
USING (
  deleted_at IS NULL
  AND (
    branch_code IS NULL
    OR branch_code = public.achats_user_branch()
    OR public.achats_is_manager()
  )
)
WITH CHECK (
  deleted_at IS NULL
  AND (
    branch_code IS NULL
    OR branch_code = public.achats_user_branch()
    OR public.achats_is_manager()
  )
);

CREATE POLICY "achats_invoices_select_secure" ON public.achats_supplier_invoices
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND (
    branch_code IS NULL
    OR branch_code = public.achats_user_branch()
    OR public.achats_is_manager()
  )
);

CREATE POLICY "achats_invoices_write_secure" ON public.achats_supplier_invoices
FOR ALL TO authenticated
USING (
  deleted_at IS NULL
  AND (
    branch_code IS NULL
    OR branch_code = public.achats_user_branch()
    OR public.achats_is_manager()
  )
)
WITH CHECK (
  deleted_at IS NULL
  AND (
    branch_code IS NULL
    OR branch_code = public.achats_user_branch()
    OR public.achats_is_manager()
  )
);

CREATE POLICY "achats_items_requests_secure" ON public.achats_purchase_request_items
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.achats_purchase_requests r
    WHERE r.id = request_id
      AND r.deleted_at IS NULL
      AND (
        r.branch_code IS NULL
        OR r.branch_code = public.achats_user_branch()
        OR public.achats_is_manager()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.achats_purchase_requests r
    WHERE r.id = request_id
      AND r.deleted_at IS NULL
      AND (
        r.branch_code IS NULL
        OR r.branch_code = public.achats_user_branch()
        OR public.achats_is_manager()
      )
  )
);

CREATE POLICY "achats_items_orders_secure" ON public.achats_purchase_order_items
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.achats_purchase_orders o
    WHERE o.id = order_id
      AND o.deleted_at IS NULL
      AND (
        o.branch_code IS NULL
        OR o.branch_code = public.achats_user_branch()
        OR public.achats_is_manager()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.achats_purchase_orders o
    WHERE o.id = order_id
      AND o.deleted_at IS NULL
      AND (
        o.branch_code IS NULL
        OR o.branch_code = public.achats_user_branch()
        OR public.achats_is_manager()
      )
  )
);

CREATE POLICY "achats_items_deliveries_secure" ON public.achats_delivery_note_items
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.achats_delivery_notes d
    WHERE d.id = delivery_id
      AND d.deleted_at IS NULL
      AND (
        d.branch_code IS NULL
        OR d.branch_code = public.achats_user_branch()
        OR public.achats_is_manager()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.achats_delivery_notes d
    WHERE d.id = delivery_id
      AND d.deleted_at IS NULL
      AND (
        d.branch_code IS NULL
        OR d.branch_code = public.achats_user_branch()
        OR public.achats_is_manager()
      )
  )
);

CREATE POLICY "achats_items_invoices_secure" ON public.achats_supplier_invoice_items
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.achats_supplier_invoices i
    WHERE i.id = invoice_id
      AND i.deleted_at IS NULL
      AND (
        i.branch_code IS NULL
        OR i.branch_code = public.achats_user_branch()
        OR public.achats_is_manager()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.achats_supplier_invoices i
    WHERE i.id = invoice_id
      AND i.deleted_at IS NULL
      AND (
        i.branch_code IS NULL
        OR i.branch_code = public.achats_user_branch()
        OR public.achats_is_manager()
      )
  )
);

CREATE POLICY "achats_suppliers_select_secure" ON public.achats_suppliers
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND (
    branch_code IS NULL
    OR branch_code = public.achats_user_branch()
    OR public.achats_is_manager()
  )
);

CREATE POLICY "achats_suppliers_write_secure" ON public.achats_suppliers
FOR ALL TO authenticated
USING (
  deleted_at IS NULL
  AND public.achats_user_role() IN ('admin', 'manager', 'buyer', 'finance_manager')
)
WITH CHECK (
  deleted_at IS NULL
  AND public.achats_user_role() IN ('admin', 'manager', 'buyer', 'finance_manager')
);

CREATE POLICY "achats_audit_read_secure" ON public.achats_audit_logs
FOR SELECT TO authenticated
USING (public.achats_user_role() IN ('admin', 'manager', 'finance_manager'));

CREATE OR REPLACE VIEW public.achats_alerts AS
SELECT
  gen_random_uuid() AS id,
  'invoice_overdue'::TEXT AS alert_type,
  i.id AS record_id,
  i.invoice_number AS reference,
  i.supplier_name AS supplier_name,
  format('Facture %s en retard', i.invoice_number) AS title,
  i.due_date::TIMESTAMPTZ AS due_at,
  i.total_amount AS amount
FROM public.achats_supplier_invoices i
WHERE i.deleted_at IS NULL
  AND i.status IN ('received', 'overdue')
  AND i.due_date IS NOT NULL
  AND i.due_date < CURRENT_DATE

UNION ALL

SELECT
  gen_random_uuid() AS id,
  'delivery_delay'::TEXT AS alert_type,
  o.id AS record_id,
  o.order_number AS reference,
  o.supplier_name AS supplier_name,
  format('Livraison en retard pour %s', o.order_number) AS title,
  o.expected_delivery_date::TIMESTAMPTZ AS due_at,
  o.total_amount AS amount
FROM public.achats_purchase_orders o
WHERE o.deleted_at IS NULL
  AND o.status IN ('approved', 'sent')
  AND o.expected_delivery_date IS NOT NULL
  AND o.expected_delivery_date < CURRENT_DATE

UNION ALL

SELECT
  gen_random_uuid() AS id,
  'budget_exceeded'::TEXT AS alert_type,
  NULL::UUID AS record_id,
  to_char(CURRENT_DATE, 'YYYY-MM') AS reference,
  NULL::TEXT AS supplier_name,
  'Dépassement du budget mensuel Achats'::TEXT AS title,
  date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day' AS due_at,
  monthly_stats.total_month AS amount
FROM (
  SELECT COALESCE(SUM(total_amount), 0) AS total_month
  FROM public.achats_supplier_invoices
  WHERE deleted_at IS NULL
    AND invoice_date >= date_trunc('month', CURRENT_DATE)::DATE
    AND invoice_date < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::DATE
) monthly_stats
CROSS JOIN LATERAL (
  SELECT COALESCE((value ->> 'monthly_limit')::NUMERIC, 0) AS monthly_limit
  FROM public.app_settings
  WHERE key = 'achats_budget'
  LIMIT 1
) budget
WHERE budget.monthly_limit > 0
  AND monthly_stats.total_month > budget.monthly_limit;

CREATE OR REPLACE VIEW public.achats_cash_forecast AS
SELECT
  date_bucket.bucket::TEXT AS horizon,
  COALESCE(SUM(i.total_amount), 0) AS obligations
FROM (
  SELECT '30'::TEXT AS bucket, (CURRENT_DATE + INTERVAL '30 days')::DATE AS end_date
  UNION ALL
  SELECT '60'::TEXT AS bucket, (CURRENT_DATE + INTERVAL '60 days')::DATE AS end_date
  UNION ALL
  SELECT '90'::TEXT AS bucket, (CURRENT_DATE + INTERVAL '90 days')::DATE AS end_date
) date_bucket
LEFT JOIN public.achats_supplier_invoices i
  ON i.deleted_at IS NULL
  AND i.status IN ('received', 'overdue')
  AND i.due_date IS NOT NULL
  AND i.due_date <= date_bucket.end_date
GROUP BY date_bucket.bucket
ORDER BY date_bucket.bucket;
