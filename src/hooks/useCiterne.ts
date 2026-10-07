import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useMemo } from 'react';

// ─── Types ───────────────────────────────────────────────────────
export interface Citerne {
  id: string;
  name: string;
  capacite_totale: number;
  quantite_actuelle: number;
  created_at: string;
  updated_at: string;
}

export interface Recharge {
  id: string;
  citerne_id: string;
  vehicle_id: string;
  driver_id: string | null;
  quantite: number;
  kilometrage: number;
  date: string;
  notes: string | null;
  created_at: string;
}

export interface PleinExterieur {
  id: string;
  vehicle_id: string;
  driver_id: string | null;
  date: string;
  quantite: number;
  cout: number;
  station: string | null;
  kilometrage: number;
  notes: string | null;
  created_at: string;
}

export interface Approvisionnement {
  id: string;
  citerne_id: string;
  quantite: number;
  cout: number;
  fournisseur: string | null;
  date: string;
  notes: string | null;
  created_at: string;
}

export interface CiterneManualAdjustment {
  id: string;
  direction: 'plus' | 'minus';
  quantity: number;
  stock_before: number;
  stock_after: number;
  note: string | null;
  created_at: string;
}

// ─── Citerne ─────────────────────────────────────────────────────
export function useCiterne() {
  return useQuery({
    queryKey: ['citerne'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('citernes')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
      if (error && error.code === 'PGRST116') {
        // No citerne exists, create one
        const { data: newCiterne, error: createError } = await supabase
          .from('citernes')
          .insert({ name: 'Citerne principale', capacite_totale: 10000, quantite_actuelle: 0 })
          .select()
          .single();
        if (createError) throw createError;
        return newCiterne as Citerne;
      }
      if (error) throw error;
      return data as Citerne;
    },
  });
}

export function useUpdateCiterne() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<Pick<Citerne, 'capacite_totale' | 'quantite_actuelle' | 'name'>>) => {
      const { data: citerne } = await supabase.from('citernes').select('id').limit(1).single();
      if (!citerne) throw new Error('No citerne found');
      const { data, error } = await supabase
        .from('citernes')
        .update(updates)
        .eq('id', citerne.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['citerne'] });
      toast({ title: 'Succès', description: 'Citerne mise à jour' });
    },
    onError: (e: Error) => {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    },
  });
}

export function useCiterneManualAdjustments() {
  return useQuery({
    queryKey: ['citerne_manual_adjustments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'citerne_manual_adjustments')
        .maybeSingle();
      if (error) throw error;
      const value = data?.value as unknown;
      if (!Array.isArray(value)) return [] as CiterneManualAdjustment[];
      return value as CiterneManualAdjustment[];
    },
  });
}

export function useCreateCiterneManualAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { citerne_id: string; direction: 'plus' | 'minus'; quantity: number; note?: string | null }) => {
      const qty = Math.max(0, Number(input.quantity || 0));
      if (!qty) throw new Error('Quantité invalide');

      const { data: citerne, error: citerneErr } = await supabase
        .from('citernes')
        .select('*')
        .eq('id', input.citerne_id)
        .single();
      if (citerneErr || !citerne) throw citerneErr || new Error('Citerne introuvable');

      const stockBefore = Number(citerne.quantite_actuelle || 0);
      const delta = input.direction === 'plus' ? qty : -qty;
      const stockAfter = Math.max(0, stockBefore + delta);

      const { error: updErr } = await supabase
        .from('citernes')
        .update({ quantite_actuelle: stockAfter, updated_at: new Date().toISOString() })
        .eq('id', input.citerne_id);
      if (updErr) throw updErr;

      const { data: settingsRow, error: settingsErr } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'citerne_manual_adjustments')
        .maybeSingle();
      if (settingsErr) throw settingsErr;

      const prev = Array.isArray(settingsRow?.value) ? (settingsRow?.value as CiterneManualAdjustment[]) : [];
      const entry: CiterneManualAdjustment = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        direction: input.direction,
        quantity: qty,
        stock_before: stockBefore,
        stock_after: stockAfter,
        note: input.note?.trim() || null,
        created_at: new Date().toISOString(),
      };
      const next = [entry, ...prev].slice(0, 200);

      const { error: upsertErr } = await supabase
        .from('app_settings')
        .upsert(
          {
            key: 'citerne_manual_adjustments',
            value: next as any,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key,user_id' }
        );
      if (upsertErr) throw upsertErr;

      return entry;
    },
    onSuccess: (entry) => {
      qc.invalidateQueries({ queryKey: ['citerne'] });
      qc.invalidateQueries({ queryKey: ['citerne_manual_adjustments'] });
      toast({
        title: 'Ajustement manuel enregistré',
        description: `${entry.direction === 'plus' ? '+' : '-'}${entry.quantity.toLocaleString()} L`,
      });
    },
    onError: (e: Error) => {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    },
  });
}

// ─── Recharges (internal) ────────────────────────────────────────
export function useRecharges() {
  return useQuery({
    queryKey: ['recharges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recharges')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      return (data || []) as Recharge[];
    },
  });
}

export function useCreateRecharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Recharge, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('recharges')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recharges'] });
      qc.invalidateQueries({ queryKey: ['citerne'] });
      toast({ title: 'Succès', description: 'Plein interne enregistré' });
    },
    onError: (e: Error) => {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    },
  });
}

export function useDeleteRecharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recharges').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recharges'] });
      qc.invalidateQueries({ queryKey: ['citerne'] });
      toast({ title: 'Succès', description: 'Plein supprimé' });
    },
    onError: (e: Error) => {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    },
  });
}

// ─── Pleins extérieur ────────────────────────────────────────────
export function usePleinsExterieur() {
  return useQuery({
    queryKey: ['pleins-exterieur'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pleins_exterieur')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      return (data || []) as PleinExterieur[];
    },
  });
}

export function useCreatePleinExterieur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<PleinExterieur, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('pleins_exterieur')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pleins-exterieur'] });
      toast({ title: 'Succès', description: 'Plein extérieur enregistré' });
    },
    onError: (e: Error) => {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    },
  });
}

export function useDeletePleinExterieur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pleins_exterieur').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pleins-exterieur'] });
      toast({ title: 'Succès', description: 'Plein supprimé' });
    },
    onError: (e: Error) => {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    },
  });
}

// ─── Approvisionnements ──────────────────────────────────────────
export function useApprovisionnements() {
  return useQuery({
    queryKey: ['approvisionnements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approvisionnements')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      return (data || []) as Approvisionnement[];
    },
  });
}

export function useCreateApprovisionnement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Approvisionnement, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('approvisionnements')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvisionnements'] });
      qc.invalidateQueries({ queryKey: ['citerne'] });
      toast({ title: 'Succès', description: 'Approvisionnement enregistré' });
    },
    onError: (e: Error) => {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    },
  });
}

export function useDeleteApprovisionnement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('approvisionnements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvisionnements'] });
      qc.invalidateQueries({ queryKey: ['citerne'] });
      toast({ title: 'Succès', description: 'Approvisionnement supprimé' });
    },
    onError: (e: Error) => {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    },
  });
}

// ─── Consumption Analysis ────────────────────────────────────────
export interface ConsumptionAnalysis {
  vehicleId: string;
  vehiclePlate: string;
  driverName: string;
  driverId: string | null;
  totalLiters: number;
  totalKm: number;
  consumptionPerKm: number;
  level: 'red' | 'green' | 'white';
  refillCount: number;
}

export function useConsumptionAnalysis() {
  const { data: recharges = [] } = useRecharges();
  const { data: pleins = [] } = usePleinsExterieur();

  return useMemo(() => {
    // Combine all refills per vehicle
    const allRefills = [
      ...recharges.map(r => ({ vehicleId: r.vehicle_id, driverId: r.driver_id, quantite: r.quantite, kilometrage: r.kilometrage, date: r.date })),
      ...pleins.map(p => ({ vehicleId: p.vehicle_id, driverId: p.driver_id, quantite: p.quantite, kilometrage: p.kilometrage, date: p.date })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Group by vehicle
    const byVehicle: Record<string, typeof allRefills> = {};
    allRefills.forEach(r => {
      if (!byVehicle[r.vehicleId]) byVehicle[r.vehicleId] = [];
      byVehicle[r.vehicleId].push(r);
    });

    const analyses: Omit<ConsumptionAnalysis, 'vehiclePlate' | 'driverName'>[] = [];

    Object.entries(byVehicle).forEach(([vehicleId, fills]) => {
      if (fills.length < 2) return; // Need at least 2 points to calculate delta
      
      let totalLiters = 0;
      let totalKm = 0;
      
      // Calculate consumption between consecutive fills
      // Logic: Distance = CurrentKm - PreviousKm
      // Consumption = Liters filled at Current (to replace what was used) or Previous? 
      // Standard method: (Liters filled) / (Distance traveled since last fill)
      // We'll take simplified approach: Sum(Liters) / (LastKm - FirstKm)
      
      const firstKm = fills[0].kilometrage;
      const lastKm = fills[fills.length - 1].kilometrage;
      const kmDiff = lastKm - firstKm;
      
      if (kmDiff <= 0) return;

      // Sum liters excluding the first fill if we assume full-to-full, 
      // but here we just sum all and divide by total distance for an average.
      // Better: Sum liters from 2nd fill onwards (which correspond to distance driven after 1st fill)
      // If we assume the tank was not empty at start.
      // Let's stick to total sum for simplicity unless we have full-tank flags.
      totalLiters = fills.reduce((s, f) => s + Number(f.quantite), 0);
      
      const consumptionPerKm = totalLiters / kmDiff;
      let level: 'red' | 'green' | 'white' = 'white';
      
      // Thresholds: > 40L/100km (0.4) for trucks? or 0.1 for cars?
      // Assuming trucks: 30-35L/100km is normal (0.3 - 0.35)
      if (consumptionPerKm >= 0.5) level = 'red'; // Very high
      else if (consumptionPerKm >= 0.25 && consumptionPerKm < 0.5) level = 'green'; // Normal range for trucks
      else level = 'white'; // Low/suspicious

      analyses.push({
        vehicleId,
        driverId: fills[fills.length - 1].driverId,
        totalLiters,
        totalKm: kmDiff,
        consumptionPerKm,
        level,
        refillCount: fills.length,
      });
    });

    return analyses;
  }, [recharges, pleins]);
}
