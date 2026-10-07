
-- Exercices comptables
CREATE TABLE public.accounting_fiscal_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.accounting_fiscal_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage fiscal_years" ON public.accounting_fiscal_years FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Plan comptable marocain
CREATE TABLE public.accounting_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  class integer NOT NULL CHECK (class BETWEEN 1 AND 7),
  parent_code text,
  account_type text NOT NULL DEFAULT 'detail',
  nature text NOT NULL DEFAULT 'debit',
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.accounting_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage accounts" ON public.accounting_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Journaux comptables
CREATE TABLE public.accounting_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  journal_type text NOT NULL DEFAULT 'general',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.accounting_journals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage journals" ON public.accounting_journals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Écritures comptables (en-tête)
CREATE TABLE public.accounting_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number text NOT NULL,
  entry_date date NOT NULL,
  journal_id uuid REFERENCES public.accounting_journals(id) NOT NULL,
  fiscal_year_id uuid REFERENCES public.accounting_fiscal_years(id) NOT NULL,
  description text NOT NULL,
  reference text,
  source_type text,
  source_id uuid,
  status text NOT NULL DEFAULT 'draft',
  total_debit numeric NOT NULL DEFAULT 0,
  total_credit numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage entries" ON public.accounting_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Lignes d'écritures
CREATE TABLE public.accounting_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid REFERENCES public.accounting_entries(id) ON DELETE CASCADE NOT NULL,
  account_id uuid REFERENCES public.accounting_accounts(id) NOT NULL,
  label text NOT NULL,
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  tva_rate numeric DEFAULT 0,
  tva_amount numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.accounting_entry_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage entry_lines" ON public.accounting_entry_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Déclarations TVA
CREATE TABLE public.accounting_tva_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  regime text NOT NULL DEFAULT 'monthly',
  tva_collected_20 numeric NOT NULL DEFAULT 0,
  tva_collected_14 numeric NOT NULL DEFAULT 0,
  tva_collected_10 numeric NOT NULL DEFAULT 0,
  tva_collected_7 numeric NOT NULL DEFAULT 0,
  tva_deductible_immobilisations numeric NOT NULL DEFAULT 0,
  tva_deductible_charges numeric NOT NULL DEFAULT 0,
  tva_due numeric NOT NULL DEFAULT 0,
  credit_report numeric NOT NULL DEFAULT 0,
  tva_to_pay numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.accounting_tva_declarations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage tva_declarations" ON public.accounting_tva_declarations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insérer le plan comptable marocain de base (classes 1-7)
INSERT INTO public.accounting_accounts (code, name, class, account_type, nature) VALUES
-- Classe 1: Comptes de financement permanent
('1', 'Comptes de financement permanent', 1, 'title', 'credit'),
('11', 'Capitaux propres', 1, 'title', 'credit'),
('1111', 'Capital social', 1, 'detail', 'credit'),
('1140', 'Réserve légale', 1, 'detail', 'credit'),
('1181', 'Résultats nets en instance d''affectation', 1, 'detail', 'credit'),
('1191', 'Résultat net de l''exercice (bénéfice)', 1, 'detail', 'credit'),
('1199', 'Résultat net de l''exercice (perte)', 1, 'detail', 'debit'),
('14', 'Dettes de financement', 1, 'title', 'credit'),
('1481', 'Emprunts auprès des établissements de crédit', 1, 'detail', 'credit'),
-- Classe 2: Comptes d'actif immobilisé
('2', 'Comptes d''actif immobilisé', 2, 'title', 'debit'),
('21', 'Immobilisations en non-valeurs', 2, 'title', 'debit'),
('2111', 'Frais de constitution', 2, 'detail', 'debit'),
('22', 'Immobilisations incorporelles', 2, 'title', 'debit'),
('2220', 'Brevets, marques, droits', 2, 'detail', 'debit'),
('23', 'Immobilisations corporelles', 2, 'title', 'debit'),
('2311', 'Terrains nus', 2, 'detail', 'debit'),
('2321', 'Bâtiments', 2, 'detail', 'debit'),
('2340', 'Matériel de transport', 2, 'detail', 'debit'),
('2351', 'Mobilier de bureau', 2, 'detail', 'debit'),
('2355', 'Matériel informatique', 2, 'detail', 'debit'),
('28', 'Amortissements des immobilisations', 2, 'title', 'credit'),
('2834', 'Amortissements du matériel de transport', 2, 'detail', 'credit'),
-- Classe 3: Comptes d'actif circulant
('3', 'Comptes d''actif circulant', 3, 'title', 'debit'),
('31', 'Stocks', 3, 'title', 'debit'),
('3111', 'Marchandises', 3, 'detail', 'debit'),
('34', 'Créances de l''actif circulant', 3, 'title', 'debit'),
('3421', 'Clients', 3, 'detail', 'debit'),
('3455', 'État - TVA récupérable', 3, 'detail', 'debit'),
('3458', 'État - Autres comptes débiteurs', 3, 'detail', 'debit'),
-- Classe 4: Comptes de passif circulant
('4', 'Comptes de passif circulant', 4, 'title', 'credit'),
('44', 'Dettes du passif circulant', 4, 'title', 'credit'),
('4411', 'Fournisseurs', 4, 'detail', 'credit'),
('4452', 'État - Impôts, taxes et assimilés', 4, 'detail', 'credit'),
('4455', 'État - TVA facturée', 4, 'detail', 'credit'),
('4457', 'État - Impôts et taxes à payer', 4, 'detail', 'credit'),
('4458', 'État - Autres comptes créditeurs', 4, 'detail', 'credit'),
-- Classe 5: Comptes de trésorerie
('5', 'Comptes de trésorerie', 5, 'title', 'debit'),
('51', 'Trésorerie - Actif', 5, 'title', 'debit'),
('5141', 'Banques', 5, 'detail', 'debit'),
('5161', 'Caisse', 5, 'detail', 'debit'),
-- Classe 6: Comptes de charges
('6', 'Comptes de charges', 6, 'title', 'debit'),
('61', 'Charges d''exploitation', 6, 'title', 'debit'),
('6111', 'Achats de marchandises', 6, 'detail', 'debit'),
('6121', 'Achats de matières premières', 6, 'detail', 'debit'),
('6125', 'Achats de carburants', 6, 'detail', 'debit'),
('6131', 'Locations', 6, 'detail', 'debit'),
('6132', 'Redevances de leasing', 6, 'detail', 'debit'),
('6134', 'Entretien et réparations', 6, 'detail', 'debit'),
('6135', 'Primes d''assurances', 6, 'detail', 'debit'),
('6142', 'Transports', 6, 'detail', 'debit'),
('6144', 'Publicité', 6, 'detail', 'debit'),
('6147', 'Services bancaires', 6, 'detail', 'debit'),
('6161', 'Impôts et taxes directs', 6, 'detail', 'debit'),
('6171', 'Rémunérations du personnel', 6, 'detail', 'debit'),
('6174', 'Charges sociales', 6, 'detail', 'debit'),
('6193', 'DEA des immobilisations corporelles', 6, 'detail', 'debit'),
('63', 'Charges financières', 6, 'title', 'debit'),
('6311', 'Intérêts des emprunts', 6, 'detail', 'debit'),
('6386', 'Escomptes accordés', 6, 'detail', 'debit'),
-- Classe 7: Comptes de produits
('7', 'Comptes de produits', 7, 'title', 'credit'),
('71', 'Produits d''exploitation', 7, 'title', 'credit'),
('7111', 'Ventes de marchandises', 7, 'detail', 'credit'),
('7121', 'Ventes de biens produits', 7, 'detail', 'credit'),
('7124', 'Ventes de services', 7, 'detail', 'credit'),
('7127', 'Ventes et produits accessoires', 7, 'detail', 'credit'),
('73', 'Produits financiers', 7, 'title', 'credit'),
('7381', 'Intérêts et produits assimilés', 7, 'detail', 'credit'),
('7386', 'Escomptes obtenus', 7, 'detail', 'credit');

-- Insérer les journaux de base
INSERT INTO public.accounting_journals (code, name, journal_type) VALUES
('AC', 'Journal des Achats', 'purchases'),
('VT', 'Journal des Ventes', 'sales'),
('BQ', 'Journal de Banque', 'bank'),
('CA', 'Journal de Caisse', 'cash'),
('OD', 'Opérations Diverses', 'general');

-- Triggers updated_at
CREATE TRIGGER update_accounting_fiscal_years_updated_at BEFORE UPDATE ON public.accounting_fiscal_years FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_accounting_accounts_updated_at BEFORE UPDATE ON public.accounting_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_accounting_journals_updated_at BEFORE UPDATE ON public.accounting_journals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_accounting_entries_updated_at BEFORE UPDATE ON public.accounting_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_accounting_tva_declarations_updated_at BEFORE UPDATE ON public.accounting_tva_declarations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
