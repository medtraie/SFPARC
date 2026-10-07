-- Achats: Demandes d'achat
CREATE TABLE public.achats_purchase_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_number TEXT NOT NULL,
  requester_name TEXT,
  supplier_name TEXT,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  needed_date DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.achats_purchase_request_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.achats_purchase_requests(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'u',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.achats_purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achats_purchase_request_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users manage achats_purchase_requests" ON public.achats_purchase_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Auth users manage achats_purchase_request_items" ON public.achats_purchase_request_items FOR ALL USING (true) WITH CHECK (true);

-- Achats: Bons de commandes
CREATE TABLE public.achats_purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 20,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.achats_purchase_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.achats_purchase_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'u',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.achats_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achats_purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users manage achats_purchase_orders" ON public.achats_purchase_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Auth users manage achats_purchase_order_items" ON public.achats_purchase_order_items FOR ALL USING (true) WITH CHECK (true);

-- Achats: Bons de livraisons
CREATE TABLE public.achats_delivery_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_number TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  order_number TEXT,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.achats_delivery_note_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id UUID NOT NULL REFERENCES public.achats_delivery_notes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'u',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.achats_delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achats_delivery_note_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users manage achats_delivery_notes" ON public.achats_delivery_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Auth users manage achats_delivery_note_items" ON public.achats_delivery_note_items FOR ALL USING (true) WITH CHECK (true);

-- Achats: Factures fournisseurs
CREATE TABLE public.achats_supplier_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 20,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.achats_supplier_invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.achats_supplier_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'u',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.achats_supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achats_supplier_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users manage achats_supplier_invoices" ON public.achats_supplier_invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Auth users manage achats_supplier_invoice_items" ON public.achats_supplier_invoice_items FOR ALL USING (true) WITH CHECK (true);
