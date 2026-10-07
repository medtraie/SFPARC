
-- Citerne table: fuel tank management
CREATE TABLE public.citernes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Citerne principale',
  capacite_totale NUMERIC NOT NULL DEFAULT 10000,
  quantite_actuelle NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.citernes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users manage citernes" ON public.citernes FOR ALL USING (true) WITH CHECK (true);

-- Recharges table: internal refueling from citerne
CREATE TABLE public.recharges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  citerne_id UUID NOT NULL REFERENCES public.citernes(id) ON DELETE CASCADE,
  vehicle_id TEXT NOT NULL,
  driver_id UUID REFERENCES public.drivers(id),
  quantite NUMERIC NOT NULL,
  kilometrage INTEGER NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.recharges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users manage recharges" ON public.recharges FOR ALL USING (true) WITH CHECK (true);

-- Pleins exterieur table: external refueling
CREATE TABLE public.pleins_exterieur (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  driver_id UUID REFERENCES public.drivers(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantite NUMERIC NOT NULL,
  cout NUMERIC NOT NULL DEFAULT 0,
  station TEXT,
  kilometrage INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pleins_exterieur ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users manage pleins_exterieur" ON public.pleins_exterieur FOR ALL USING (true) WITH CHECK (true);

-- Approvisionnements: monthly citerne refills
CREATE TABLE public.approvisionnements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  citerne_id UUID NOT NULL REFERENCES public.citernes(id) ON DELETE CASCADE,
  quantite NUMERIC NOT NULL,
  cout NUMERIC NOT NULL DEFAULT 0,
  fournisseur TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.approvisionnements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users manage approvisionnements" ON public.approvisionnements FOR ALL USING (true) WITH CHECK (true);

-- Function to update citerne after internal recharge
CREATE OR REPLACE FUNCTION public.update_citerne_on_recharge()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.citernes
  SET quantite_actuelle = quantite_actuelle - NEW.quantite,
      updated_at = now()
  WHERE id = NEW.citerne_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_recharge_update_citerne
AFTER INSERT ON public.recharges
FOR EACH ROW
EXECUTE FUNCTION public.update_citerne_on_recharge();

-- Function to update citerne after approvisionnement
CREATE OR REPLACE FUNCTION public.update_citerne_on_approv()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.citernes
  SET quantite_actuelle = quantite_actuelle + NEW.quantite,
      updated_at = now()
  WHERE id = NEW.citerne_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_approv_update_citerne
AFTER INSERT ON public.approvisionnements
FOR EACH ROW
EXECUTE FUNCTION public.update_citerne_on_approv();
