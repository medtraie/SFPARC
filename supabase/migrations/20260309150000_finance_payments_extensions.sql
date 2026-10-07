-- Extend finance_payments to support dedicated Dépenses & Recettes sections

ALTER TABLE public.finance_payments
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS source_module TEXT,
  ADD COLUMN IF NOT EXISTS source_id UUID,
  ADD COLUMN IF NOT EXISTS attachment_url TEXT;

CREATE INDEX IF NOT EXISTS finance_payments_payment_type_date_idx
  ON public.finance_payments (payment_type, payment_date);

CREATE INDEX IF NOT EXISTS finance_payments_category_idx
  ON public.finance_payments (category);

CREATE INDEX IF NOT EXISTS finance_payments_source_idx
  ON public.finance_payments (source_module, source_id);
