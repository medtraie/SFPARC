CREATE TABLE IF NOT EXISTS public.fuel_card_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_amount_mad NUMERIC(12, 2) NOT NULL DEFAULT 2000 CHECK (monthly_amount_mad > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID DEFAULT auth.uid(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fuel_vehicle_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id TEXT NOT NULL,
  month_start DATE NOT NULL,
  initial_amount_mad NUMERIC(12, 2) NOT NULL,
  spent_amount_mad NUMERIC(12, 2) NOT NULL DEFAULT 0,
  remaining_amount_mad NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, month_start)
);

CREATE TABLE IF NOT EXISTS public.fuel_card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.fuel_vehicle_cards(id) ON DELETE CASCADE,
  vehicle_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('monthly_reset', 'fuel_log_debit', 'manual_adjustment')),
  amount_mad NUMERIC(12, 2) NOT NULL,
  liters NUMERIC(12, 3),
  occurred_at DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  external_ref_type TEXT,
  external_ref_id UUID,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (external_ref_type, external_ref_id)
);

CREATE INDEX IF NOT EXISTS fuel_vehicle_cards_month_idx ON public.fuel_vehicle_cards(month_start);
CREATE INDEX IF NOT EXISTS fuel_card_transactions_card_idx ON public.fuel_card_transactions(card_id, occurred_at);

CREATE OR REPLACE FUNCTION public.current_fuel_card_month(p_ref_date DATE DEFAULT CURRENT_DATE)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT date_trunc('month', COALESCE(p_ref_date, CURRENT_DATE))::date;
$$;

CREATE OR REPLACE FUNCTION public.get_active_fuel_card_amount()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_amount NUMERIC;
BEGIN
  SELECT monthly_amount_mad
  INTO v_amount
  FROM public.fuel_card_settings
  WHERE is_active = true
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_amount IS NULL THEN
    v_amount := 2000;
  END IF;

  RETURN v_amount;
END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_fuel_card_amounts(p_card_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_initial NUMERIC;
  v_spent NUMERIC;
BEGIN
  SELECT initial_amount_mad INTO v_initial
  FROM public.fuel_vehicle_cards
  WHERE id = p_card_id;

  IF v_initial IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(CASE WHEN amount_mad < 0 THEN -amount_mad ELSE 0 END), 0)
  INTO v_spent
  FROM public.fuel_card_transactions
  WHERE card_id = p_card_id;

  UPDATE public.fuel_vehicle_cards
  SET
    spent_amount_mad = v_spent,
    remaining_amount_mad = GREATEST(v_initial - v_spent, 0),
    updated_at = now()
  WHERE id = p_card_id;
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
  v_amount := public.get_active_fuel_card_amount();

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

CREATE OR REPLACE FUNCTION public.sync_fuel_card_from_fuel_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_card public.fuel_vehicle_cards;
  v_cost NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.fuel_card_transactions
    WHERE external_ref_type = 'fuel_log'
      AND external_ref_id = OLD.id;

    SELECT *
    INTO v_card
    FROM public.fuel_vehicle_cards
    WHERE vehicle_id = OLD.vehicle_id
      AND month_start = public.current_fuel_card_month(OLD.log_date);

    IF v_card.id IS NOT NULL THEN
      PERFORM public.recompute_fuel_card_amounts(v_card.id);
    END IF;
    RETURN OLD;
  END IF;

  v_cost := COALESCE(NEW.total_cost, NEW.liters * NEW.price_per_liter, 0);
  v_card := public.ensure_fuel_vehicle_card(NEW.vehicle_id, NEW.log_date);

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
    NEW.vehicle_id,
    'fuel_log_debit',
    -v_cost,
    NEW.liters,
    NEW.log_date,
    'Débit automatique depuis plein carburant',
    'fuel_log',
    NEW.id
  )
  ON CONFLICT (external_ref_type, external_ref_id)
  DO UPDATE SET
    card_id = EXCLUDED.card_id,
    vehicle_id = EXCLUDED.vehicle_id,
    amount_mad = EXCLUDED.amount_mad,
    liters = EXCLUDED.liters,
    occurred_at = EXCLUDED.occurred_at,
    note = EXCLUDED.note;

  PERFORM public.recompute_fuel_card_amounts(v_card.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fuel_logs_card_sync_trigger ON public.fuel_logs;
CREATE TRIGGER fuel_logs_card_sync_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.fuel_logs
FOR EACH ROW
EXECUTE FUNCTION public.sync_fuel_card_from_fuel_log();

CREATE OR REPLACE FUNCTION public.get_vehicle_card_snapshot(
  p_vehicle_ids TEXT[],
  p_ref_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  vehicle_id TEXT,
  card_id UUID,
  month_start DATE,
  initial_amount_mad NUMERIC,
  spent_amount_mad NUMERIC,
  remaining_amount_mad NUMERIC,
  consumed_liters_est NUMERIC,
  remaining_liters_est NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_vehicle_id TEXT;
  v_card public.fuel_vehicle_cards;
  v_price NUMERIC;
BEGIN
  SELECT price_per_liter
  INTO v_price
  FROM public.fuel_price_history
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_price IS NULL OR v_price <= 0 THEN
    v_price := 12.5;
  END IF;

  FOREACH v_vehicle_id IN ARRAY p_vehicle_ids
  LOOP
    v_card := public.ensure_fuel_vehicle_card(v_vehicle_id, p_ref_date);
    PERFORM public.recompute_fuel_card_amounts(v_card.id);

    SELECT * INTO v_card FROM public.fuel_vehicle_cards WHERE id = v_card.id;

    vehicle_id := v_card.vehicle_id;
    card_id := v_card.id;
    month_start := v_card.month_start;
    initial_amount_mad := v_card.initial_amount_mad;
    spent_amount_mad := v_card.spent_amount_mad;
    remaining_amount_mad := v_card.remaining_amount_mad;
    consumed_liters_est := ROUND(COALESCE(v_card.spent_amount_mad / NULLIF(v_price, 0), 0), 3);
    remaining_liters_est := ROUND(COALESCE(v_card.remaining_amount_mad / NULLIF(v_price, 0), 0), 3);
    RETURN NEXT;
  END LOOP;
END;
$$;

ALTER TABLE public.fuel_card_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_vehicle_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_card_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read fuel card settings" ON public.fuel_card_settings;
CREATE POLICY "Authenticated users can read fuel card settings"
ON public.fuel_card_settings
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can update fuel card settings" ON public.fuel_card_settings;
CREATE POLICY "Authenticated users can update fuel card settings"
ON public.fuel_card_settings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read fuel vehicle cards" ON public.fuel_vehicle_cards;
CREATE POLICY "Authenticated users can read fuel vehicle cards"
ON public.fuel_vehicle_cards
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage fuel vehicle cards" ON public.fuel_vehicle_cards;
CREATE POLICY "Authenticated users can manage fuel vehicle cards"
ON public.fuel_vehicle_cards
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read fuel card transactions" ON public.fuel_card_transactions;
CREATE POLICY "Authenticated users can read fuel card transactions"
ON public.fuel_card_transactions
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage fuel card transactions" ON public.fuel_card_transactions;
CREATE POLICY "Authenticated users can manage fuel card transactions"
ON public.fuel_card_transactions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

GRANT EXECUTE ON FUNCTION public.ensure_fuel_vehicle_card(TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vehicle_card_snapshot(TEXT[], DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_fuel_card_amount() TO authenticated;

INSERT INTO public.fuel_card_settings (monthly_amount_mad, is_active)
SELECT 2000, true
WHERE NOT EXISTS (SELECT 1 FROM public.fuel_card_settings);
