ALTER TABLE public.maintenance
ADD COLUMN IF NOT EXISTS work_order_type TEXT CHECK (work_order_type IN ('preventive', 'corrective', 'inspection')),
ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS diagnosis TEXT,
ADD COLUMN IF NOT EXISTS garage TEXT,
ADD COLUMN IF NOT EXISTS labor_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS parts_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS parts JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

UPDATE public.maintenance
SET
  work_order_type = COALESCE(work_order_type, 'corrective'),
  priority = COALESCE(priority, 'medium'),
  labor_cost = COALESCE(labor_cost, 0),
  parts_cost = COALESCE(parts_cost, 0),
  parts = COALESCE(parts, '[]'::jsonb)
WHERE work_order_type IS NULL
   OR priority IS NULL
   OR labor_cost IS NULL
   OR parts_cost IS NULL
   OR parts IS NULL;
