CREATE TABLE IF NOT EXISTS public.fuel_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_per_liter NUMERIC(10, 3) NOT NULL CHECK (price_per_liter > 0),
  source TEXT NOT NULL DEFAULT 'manual_update' CHECK (source IN ('manual_update', 'history_apply')),
  applied_from_id UUID REFERENCES public.fuel_price_history(id) ON DELETE SET NULL,
  note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fuel_price_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  target_price_id UUID REFERENCES public.fuel_price_history(id) ON DELETE CASCADE,
  actor_id UUID DEFAULT auth.uid(),
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fuel_price_history_single_active_idx
  ON public.fuel_price_history (is_active)
  WHERE is_active = true;

CREATE OR REPLACE FUNCTION public.set_active_fuel_price(
  p_price_per_liter NUMERIC,
  p_source TEXT DEFAULT 'manual_update',
  p_applied_from_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS public.fuel_price_history
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inserted public.fuel_price_history;
BEGIN
  UPDATE public.fuel_price_history
  SET is_active = false
  WHERE is_active = true;

  INSERT INTO public.fuel_price_history (
    price_per_liter,
    source,
    applied_from_id,
    note,
    is_active,
    created_by
  )
  VALUES (
    p_price_per_liter,
    COALESCE(NULLIF(p_source, ''), 'manual_update'),
    p_applied_from_id,
    p_note,
    true,
    auth.uid()
  )
  RETURNING * INTO v_inserted;

  INSERT INTO public.fuel_price_audit_logs (
    action_type,
    target_price_id,
    actor_id,
    old_value,
    new_value
  )
  VALUES (
    'set_active_price',
    v_inserted.id,
    auth.uid(),
    jsonb_build_object('applied_from_id', p_applied_from_id),
    to_jsonb(v_inserted)
  );

  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_fuel_price_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.fuel_price_audit_logs (
    action_type,
    target_price_id,
    actor_id,
    old_value,
    new_value
  )
  VALUES (
    TG_OP,
    NEW.id,
    auth.uid(),
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fuel_price_history_audit_trigger ON public.fuel_price_history;
CREATE TRIGGER fuel_price_history_audit_trigger
AFTER UPDATE ON public.fuel_price_history
FOR EACH ROW
EXECUTE FUNCTION public.log_fuel_price_update();

ALTER TABLE public.fuel_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_price_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read fuel price history" ON public.fuel_price_history;
CREATE POLICY "Authenticated users can read fuel price history"
ON public.fuel_price_history
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert fuel price history" ON public.fuel_price_history;
CREATE POLICY "Authenticated users can insert fuel price history"
ON public.fuel_price_history
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update fuel price history" ON public.fuel_price_history;
CREATE POLICY "Authenticated users can update fuel price history"
ON public.fuel_price_history
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read fuel price audit logs" ON public.fuel_price_audit_logs;
CREATE POLICY "Authenticated users can read fuel price audit logs"
ON public.fuel_price_audit_logs
FOR SELECT
TO authenticated
USING (true);

GRANT EXECUTE ON FUNCTION public.set_active_fuel_price(NUMERIC, TEXT, UUID, TEXT) TO authenticated;

INSERT INTO public.fuel_price_history (price_per_liter, source, is_active, note)
SELECT 12.5, 'manual_update', true, 'Initialisation automatique'
WHERE NOT EXISTS (SELECT 1 FROM public.fuel_price_history);
