CREATE TABLE IF NOT EXISTS public.fuel_card_vehicle_amounts (
  vehicle_id TEXT PRIMARY KEY,
  monthly_amount_mad NUMERIC(12, 2) NOT NULL CHECK (monthly_amount_mad > 0),
  updated_by UUID DEFAULT auth.uid(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fuel_card_vehicle_amounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read vehicle card amounts" ON public.fuel_card_vehicle_amounts;
CREATE POLICY "Authenticated users can read vehicle card amounts"
ON public.fuel_card_vehicle_amounts
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage vehicle card amounts" ON public.fuel_card_vehicle_amounts;
CREATE POLICY "Authenticated users can manage vehicle card amounts"
ON public.fuel_card_vehicle_amounts
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.get_vehicle_monthly_card_amount(
  p_vehicle_id TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_vehicle_amount NUMERIC;
  v_default_amount NUMERIC;
BEGIN
  SELECT monthly_amount_mad
  INTO v_vehicle_amount
  FROM public.fuel_card_vehicle_amounts
  WHERE vehicle_id = p_vehicle_id;

  IF v_vehicle_amount IS NOT NULL AND v_vehicle_amount > 0 THEN
    RETURN v_vehicle_amount;
  END IF;

  v_default_amount := public.get_active_fuel_card_amount();
  IF v_default_amount IS NULL OR v_default_amount <= 0 THEN
    v_default_amount := 2000;
  END IF;

  RETURN v_default_amount;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_vehicle_monthly_card_amount(
  p_vehicle_id TEXT,
  p_monthly_amount_mad NUMERIC
)
RETURNS public.fuel_card_vehicle_amounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.fuel_card_vehicle_amounts;
BEGIN
  INSERT INTO public.fuel_card_vehicle_amounts (
    vehicle_id,
    monthly_amount_mad,
    updated_by,
    updated_at
  )
  VALUES (
    p_vehicle_id,
    p_monthly_amount_mad,
    auth.uid(),
    now()
  )
  ON CONFLICT (vehicle_id)
  DO UPDATE SET
    monthly_amount_mad = EXCLUDED.monthly_amount_mad,
    updated_by = auth.uid(),
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_fuel_vehicle_card(
  p_vehicle_id TEXT,
  p_ref_date DATE DEFAULT CURRENT_DATE
)
RETURNS public.fuel_vehicle_cards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_card public.fuel_vehicle_cards;
  v_month_start DATE;
  v_amount NUMERIC;
BEGIN
  v_month_start := public.current_fuel_card_month(p_ref_date);
  v_amount := public.get_vehicle_monthly_card_amount(p_vehicle_id);

  SELECT *
  INTO v_card
  FROM public.fuel_vehicle_cards
  WHERE vehicle_id = p_vehicle_id
    AND month_start = v_month_start
  LIMIT 1;

  IF v_card.id IS NULL THEN
    INSERT INTO public.fuel_vehicle_cards (
      vehicle_id,
      month_start,
      initial_amount_mad,
      spent_amount_mad,
      remaining_amount_mad
    )
    VALUES (
      p_vehicle_id,
      v_month_start,
      v_amount,
      0,
      v_amount
    )
    RETURNING * INTO v_card;

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
      'monthly_reset',
      v_amount,
      NULL,
      v_month_start,
      'Recharge mensuelle automatique',
      'monthly_reset',
      NULL
    );
  END IF;

  RETURN v_card;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vehicle_monthly_card_amount(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_vehicle_monthly_card_amount(TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_fuel_vehicle_card(TEXT, DATE) TO authenticated;
