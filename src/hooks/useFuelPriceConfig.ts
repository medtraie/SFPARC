import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface FuelPriceHistoryRecord {
  id: string;
  price_per_liter: number;
  source: 'manual_update' | 'history_apply';
  applied_from_id: string | null;
  note: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface FuelPriceAuditLog {
  id: string;
  action_type: string;
  target_price_id: string | null;
  actor_id: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
}

const FUEL_PRICE_QUERY_KEY = ['fuel-price-history'];
const FUEL_PRICE_AUDIT_QUERY_KEY = ['fuel-price-audit'];

async function fetchFuelPriceHistory(): Promise<FuelPriceHistoryRecord[]> {
  const { data, error } = await supabase
    .from('fuel_price_history')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as FuelPriceHistoryRecord[];
}

async function fetchFuelPriceAuditLogs(): Promise<FuelPriceAuditLog[]> {
  const { data, error } = await supabase
    .from('fuel_price_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data || []) as FuelPriceAuditLog[];
}

async function setActiveFuelPrice(params: {
  price_per_liter: number;
  source: 'manual_update' | 'history_apply';
  applied_from_id?: string | null;
  note?: string | null;
}): Promise<FuelPriceHistoryRecord> {
  const { data, error } = await supabase.rpc('set_active_fuel_price', {
    p_price_per_liter: params.price_per_liter,
    p_source: params.source,
    p_applied_from_id: params.applied_from_id ?? null,
    p_note: params.note ?? null,
  });

  if (error) throw error;
  return data as FuelPriceHistoryRecord;
}

export function useFuelPriceHistory() {
  return useQuery({
    queryKey: FUEL_PRICE_QUERY_KEY,
    queryFn: fetchFuelPriceHistory,
    staleTime: 30000,
  });
}

export function useFuelPriceAuditLogs(enabled = false) {
  return useQuery({
    queryKey: FUEL_PRICE_AUDIT_QUERY_KEY,
    queryFn: fetchFuelPriceAuditLogs,
    staleTime: 30000,
    enabled,
  });
}

export function useSetActiveFuelPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setActiveFuelPrice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FUEL_PRICE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: FUEL_PRICE_AUDIT_QUERY_KEY });
      toast({
        title: 'Succès',
        description: 'Le prix carburant a été appliqué avec succès.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de mettre à jour le prix carburant',
        variant: 'destructive',
      });
    },
  });
}
