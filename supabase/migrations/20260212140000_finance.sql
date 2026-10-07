-- Finance Module Migrations (Multi-caisses, Règlements, Journal bancaire)

-- 1. Cash Registers (Caisses)
CREATE TABLE IF NOT EXISTS public.finance_cash_registers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    currency TEXT DEFAULT 'MAD',
    initial_balance DECIMAL(15, 2) DEFAULT 0,
    current_balance DECIMAL(15, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Bank Accounts & Checkbooks (Banques et Chéquiers)
CREATE TABLE IF NOT EXISTS public.finance_bank_accounts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    bank_name TEXT NOT NULL,
    account_number TEXT UNIQUE,
    rib TEXT,
    initial_balance DECIMAL(15, 2) DEFAULT 0,
    current_balance DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_checkbooks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    bank_account_id UUID NOT NULL REFERENCES public.finance_bank_accounts(id) ON DELETE CASCADE,
    series_start TEXT NOT NULL,
    series_end TEXT NOT NULL,
    current_number TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Payments (Règlements Client/Fournisseur)
CREATE TABLE IF NOT EXISTS public.finance_payments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_type TEXT NOT NULL, -- 'income' (client), 'expense' (fournisseur)
    payment_method TEXT NOT NULL, -- 'cash', 'check', 'transfer', 'virement'
    amount DECIMAL(15, 2) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference_number TEXT, -- check number or transfer reference
    
    -- Links to other modules (optional)
    entity_name TEXT, -- Client or Supplier name
    invoice_id UUID, -- Optional link to an invoice
    
    -- Link to source/destination
    cash_register_id UUID REFERENCES public.finance_cash_registers(id) ON DELETE SET NULL,
    bank_account_id UUID REFERENCES public.finance_bank_accounts(id) ON DELETE SET NULL,
    
    status TEXT DEFAULT 'completed', -- 'pending', 'completed', 'cancelled'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Cash Transactions (Log for balance tracking)
CREATE TABLE IF NOT EXISTS public.finance_cash_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    cash_register_id UUID NOT NULL REFERENCES public.finance_cash_registers(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES public.finance_payments(id) ON DELETE SET NULL,
    transaction_type TEXT NOT NULL, -- 'in', 'out', 'transfer'
    amount DECIMAL(15, 2) NOT NULL,
    balance_after DECIMAL(15, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.finance_cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_checkbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_cash_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users manage finance_cash_registers" ON public.finance_cash_registers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Auth users manage finance_bank_accounts" ON public.finance_bank_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Auth users manage finance_checkbooks" ON public.finance_checkbooks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Auth users manage finance_payments" ON public.finance_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Auth users manage finance_cash_transactions" ON public.finance_cash_transactions FOR ALL USING (true) WITH CHECK (true);

-- Functions to update balances (Triggers could be added later)
