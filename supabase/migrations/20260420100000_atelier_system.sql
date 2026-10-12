-- Migration for Atelier (Workshop & Manufacturing & Maintenance Management System)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Atelier Work Orders (OT - Ordres de Travail / Fabrications / Interventions)
CREATE TABLE IF NOT EXISTS public.atelier_work_orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reference TEXT NOT NULL,
  title TEXT NOT NULL,
  activity_type TEXT NOT NULL DEFAULT 'maintenance' CHECK (activity_type IN ('maintenance', 'manufacturing', 'repair', 'inspection', 'customization')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'planned', 'in_progress', 'quality_check', 'completed', 'cancelled')),
  vehicle_id TEXT, -- GPSwox or asset identifier if vehicle
  asset_name TEXT, -- Equipment, Machine or Vehicle Name
  client_or_department TEXT,
  assigned_technician TEXT,
  technician_id UUID,
  start_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_hours NUMERIC DEFAULT 0,
  actual_hours NUMERIC DEFAULT 0,
  hourly_rate NUMERIC DEFAULT 150,
  labor_cost NUMERIC DEFAULT 0,
  parts_cost NUMERIC DEFAULT 0,
  consumables_cost NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  description TEXT,
  diagnostic TEXT,
  solution TEXT,
  quality_notes TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Atelier Work Order Consumed Items & Parts
CREATE TABLE IF NOT EXISTS public.atelier_order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  work_order_id UUID REFERENCES public.atelier_work_orders(id) ON DELETE CASCADE,
  stock_item_id UUID REFERENCES public.stock_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  reference TEXT,
  category TEXT NOT NULL DEFAULT 'spare_part' CHECK (category IN ('spare_part', 'consumable', 'raw_material', 'manufactured_part')),
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'unité',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Atelier Machines & Manufacturing Workstations
CREATE TABLE IF NOT EXISTS public.atelier_machines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'machine' CHECK (type IN ('machine', 'workstation', 'tool', 'lift', 'cnc', 'welding', 'painting')),
  location TEXT,
  status TEXT NOT NULL DEFAULT 'operational' CHECK (status IN ('operational', 'in_use', 'maintenance', 'stopped')),
  last_maintenance DATE,
  next_maintenance DATE,
  hour_meter NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Atelier Production Orders / BOM (Bill of Materials - Nomenclature de fabrication)
CREATE TABLE IF NOT EXISTS public.atelier_boms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  target_item_name TEXT NOT NULL,
  description TEXT,
  version TEXT DEFAULT '1.0',
  labor_hours NUMERIC DEFAULT 0,
  components JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.atelier_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atelier_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atelier_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atelier_boms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users on atelier_work_orders"
  ON public.atelier_work_orders FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all for authenticated users on atelier_order_items"
  ON public.atelier_order_items FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all for authenticated users on atelier_machines"
  ON public.atelier_machines FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all for authenticated users on atelier_boms"
  ON public.atelier_boms FOR ALL USING (auth.role() = 'authenticated');
