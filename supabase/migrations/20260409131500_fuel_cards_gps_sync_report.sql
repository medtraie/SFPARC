CREATE TABLE IF NOT EXISTS public.fuel_gpswox_sync_state (
  vehicle_id TEXT PRIMARY KEY,
  last_fuel_level_l NUMERIC(12, 3) NOT NULL DEFAULT 0,
  last_sync_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fuel_card_vehicle_controls (
  vehicle_id TEXT PRIMARY KEY,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID DEFAULT auth.uid(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fuel_gpswox_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_card_vehicle_controls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage gps sync state" ON public.fuel_gpswox_sync_state;
CREATE POLICY "Authenticated users can manage gps sync state"
ON public.fuel_gpswox_sync_state
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read vehicle card controls" ON public.fuel_card_vehicle_controls;
CREATE POLICY "Authenticated users can read vehicle card controls"
ON public.fuel_card_vehicle_controls
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage vehicle card controls" ON public.fuel_card_vehicle_controls;
CREATE POLICY "Authenticated users can manage vehicle card controls"
ON public.fuel_card_vehicle_controls
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_fuel_card_vehicle_enabled(
  p_vehicle_id TEXT,
  p_is_enabled BOOLEAN,
  p_note TEXT DEFAULT NULL
)
RETURNS public.fuel_card_vehicle_controls
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_control public.fuel_card_vehicle_controls;
BEGIN
  INSERT INTO public.fuel_card_vehicle_controls (
    vehicle_id,
    is_enabled,
    updated_by,
    updated_at
  )
  VALUES (
    p_vehicle_id,
    p_is_enabled,
    auth.uid(),
    now()
  )
  ON CONFLICT (vehicle_id)
  DO UPDATE SET
    is_enabled = EXCLUDED.is_enabled,
    updated_by = auth.uid(),
    updated_at = now()
  RETURNING * INTO v_control;

  RETURN v_control;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_gpswox_fuel_to_card(
  p_vehicle_id TEXT,
  p_fuel_level_l NUMERIC,
  p_event_at TIMESTAMPTZ DEFAULT now(),
  p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_state public.fuel_gpswox_sync_state;
  v_control public.fuel_card_vehicle_controls;
  v_card public.fuel_vehicle_cards;
  v_delta_l NUMERIC;
  v_price NUMERIC;
  v_cost NUMERIC;
BEGIN
  IF p_vehicle_id IS NULL OR p_fuel_level_l IS NULL OR p_fuel_level_l < 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.fuel_card_vehicle_controls (vehicle_id, is_enabled, updated_by, updated_at)
  VALUES (p_vehicle_id, true, auth.uid(), now())
  ON CONFLICT (vehicle_id) DO NOTHING;

  SELECT * INTO v_control
  FROM public.fuel_card_vehicle_controls
  WHERE vehicle_id = p_vehicle_id;

  SELECT * INTO v_state
  FROM public.fuel_gpswox_sync_state
  WHERE vehicle_id = p_vehicle_id;

  IF v_state.vehicle_id IS NULL THEN
    INSERT INTO public.fuel_gpswox_sync_state(vehicle_id, last_fuel_level_l, last_sync_at, updated_at)
    VALUES (p_vehicle_id, p_fuel_level_l, p_event_at, now());
    RETURN;
  END IF;

  IF v_state.last_sync_at IS NOT NULL AND p_event_at <= v_state.last_sync_at THEN
    RETURN;
  END IF;

  v_delta_l := p_fuel_level_l - v_state.last_fuel_level_l;

  UPDATE public.fuel_gpswox_sync_state
  SET
    last_fuel_level_l = p_fuel_level_l,
    last_sync_at = p_event_at,
    updated_at = now()
  WHERE vehicle_id = p_vehicle_id;

  IF COALESCE(v_control.is_enabled, true) = false THEN
    RETURN;
  END IF;

  IF v_delta_l <= 0.5 THEN
    RETURN;
  END IF;

  SELECT price_per_liter INTO v_price
  FROM public.fuel_price_history
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_price IS NULL OR v_price <= 0 THEN
    v_price := 12.5;
  END IF;

  v_cost := ROUND(v_delta_l * v_price, 2);
  v_card := public.ensure_fuel_vehicle_card(p_vehicle_id, p_event_at::date);

  INSERT INTO public.fuel_card_transactions (
    card_id,
    vehicle_id,
    transaction_type,
    amount_mad,
    liters,
    occurred_at,
    note,
    external_ref_type,
    external_ref_id
  )
  VALUES (
    v_card.id,
    p_vehicle_id,
    'fuel_log_debit',
    -v_cost,
    v_delta_l,
    p_event_at::date,
    COALESCE(p_note, 'Débit auto depuis variation GPSwox'),
    'gpswox_refuel',
    gen_random_uuid()
  );

  PERFORM public.recompute_fuel_card_amounts(v_card.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_fuel_card_report(
  p_days INTEGER DEFAULT 30,
  p_vehicle_ids TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  vehicle_id TEXT,
  month_start DATE,
  consumed_mad NUMERIC,
  consumed_liters NUMERIC,
  remaining_mad NUMERIC,
  remaining_liters_est NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_days INTEGER;
  v_price NUMERIC;
BEGIN
  v_days := GREATEST(COALESCE(p_days, 30), 1);

  SELECT price_per_liter INTO v_price
  FROM public.fuel_price_history
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_price IS NULL OR v_price <= 0 THEN
    v_price := 12.5;
  END IF;

  RETURN QUERY
  SELECT
    c.vehicle_id,
    c.month_start,
    COALESCE(SUM(CASE WHEN t.amount_mad < 0 THEN -t.amount_mad ELSE 0 END), 0) AS consumed_mad,
    COALESCE(SUM(CASE WHEN t.amount_mad < 0 THEN COALESCE(t.liters, 0) ELSE 0 END), 0) AS consumed_liters,
    c.remaining_amount_mad AS remaining_mad,
    ROUND(COALESCE(c.remaining_amount_mad / NULLIF(v_price, 0), 0), 3) AS remaining_liters_est
  FROM public.fuel_vehicle_cards c
  LEFT JOIN public.fuel_card_transactions t
    ON t.card_id = c.id
   AND t.occurred_at >= (CURRENT_DATE - (v_days - 1))
  WHERE p_vehicle_ids IS NULL OR c.vehicle_id = ANY(p_vehicle_ids)
  GROUP BY c.vehicle_id, c.month_start, c.remaining_amount_mad
  ORDER BY c.vehicle_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_fuel_card_vehicle_enabled(TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_gpswox_fuel_to_card(TEXT, NUMERIC, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fuel_card_report(INTEGER, TEXT[]) TO authenticated;
