import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface OilBarrelConfig {
  id: string;
  name: string;
  capacity_liters: number;
  created_at: string;
}

export interface OilPurchase {
  id: string;
  purchase_date: string;
  barrel_capacity_liters: number;
  barrels_count: number;
  total_liters: number;
  total_amount: number;
  payment_method: string;
  notes: string | null;
  created_at: string;
}

export interface OilConsumption {
  id: string;
  consumption_date: string;
  vehicle_plate: string;
  driver_name: string;
  liters: number;
  notes: string | null;
  created_at: string;
}

export interface OilDrain {
  id: string;
  drain_date: string;
  liters: number;
  notes: string | null;
  created_at: string;
}

function useCrudMutation<T>(
  queryKeys: string[],
  successMsg: string,
  errorMsg: string,
  mutationFn: (data: T) => Promise<any>
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryKeys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      toast({ title: successMsg });
    },
    onError: () => {
      toast({ title: errorMsg, variant: 'destructive' });
    },
  });
}

export function useOilBarrels() {
  return useQuery({
    queryKey: ['oil_barrels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('oil_barrels')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as OilBarrelConfig[];
    },
  });
}

export function useOilPurchases() {
  return useQuery({
    queryKey: ['oil_purchases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('oil_purchases')
        .select('*')
        .order('purchase_date', { ascending: false });
      if (error) throw error;
      return (data || []) as OilPurchase[];
    },
  });
}

export function useOilConsumptions() {
  return useQuery({
    queryKey: ['oil_consumptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('oil_consumptions')
        .select('*')
        .order('consumption_date', { ascending: false });
      if (error) throw error;
      return (data || []) as OilConsumption[];
    },
  });
}

export function useOilDrains() {
  return useQuery({
    queryKey: ['oil_drains'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('oil_drains')
        .select('*')
        .order('drain_date', { ascending: false });
      if (error) throw error;
      return (data || []) as OilDrain[];
    },
  });
}

export function useCreateOilBarrel() {
  return useCrudMutation(
    ['oil_barrels'],
    'Baril ajouté',
    'Erreur lors de la création du baril',
    async (payload: { name: string; capacity_liters: number }) => {
      const { data, error } = await supabase
        .from('oil_barrels')
        .insert({
          name: payload.name,
          capacity_liters: payload.capacity_liters,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  );
}

export function useUpdateOilBarrel() {
  return useCrudMutation(
    ['oil_barrels'],
    'Baril mis à jour',
    'Erreur lors de la mise à jour du baril',
    async (payload: { id: string; name: string; capacity_liters: number }) => {
      const { data, error } = await supabase
        .from('oil_barrels')
        .update({
          name: payload.name,
          capacity_liters: payload.capacity_liters,
        } as any)
        .eq('id', payload.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  );
}

export function useDeleteOilBarrel() {
  return useCrudMutation(
    ['oil_barrels'],
    'Baril supprimé',
    'Erreur lors de la suppression du baril',
    async (id: string) => {
      const { error } = await supabase.from('oil_barrels').delete().eq('id', id);
      if (error) throw error;
    }
  );
}

export function useCreateOilPurchase() {
  return useCrudMutation(
    ['oil_purchases', 'oil_barrels'],
    'Achat enregistré',
    'Erreur lors de l’enregistrement de l’achat',
    async (payload: {
      purchase_date: string;
      barrel_capacity_liters: number;
      barrels_count: number;
      total_amount: number;
      payment_method: string;
      notes?: string | null;
      barrel_id?: string | null;
    }) => {
      const total_liters = payload.barrel_capacity_liters * payload.barrels_count;
      const { data, error } = await supabase
        .from('oil_purchases')
        .insert({
          purchase_date: payload.purchase_date,
          barrel_capacity_liters: payload.barrel_capacity_liters,
          barrels_count: payload.barrels_count,
          total_liters,
          total_amount: payload.total_amount,
          payment_method: payload.payment_method,
          notes: payload.notes ?? null,
          barrel_id: payload.barrel_id ?? null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  );
}

export function useCreateOilConsumption() {
  return useCrudMutation(
    ['oil_consumptions'],
    'Consommation enregistrée',
    'Erreur lors de l’enregistrement de la consommation',
    async (payload: {
      consumption_date: string;
      vehicle_plate: string;
      driver_name: string;
      liters: number;
      notes?: string | null;
      barrel_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('oil_consumptions')
        .insert({
          consumption_date: payload.consumption_date,
          vehicle_plate: payload.vehicle_plate,
          driver_name: payload.driver_name,
          liters: payload.liters,
          notes: payload.notes ?? null,
          barrel_id: payload.barrel_id ?? null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  );
}

export function useCreateOilDrain() {
  return useCrudMutation(
    ['oil_drains'],
    'Vidange enregistrée',
    'Erreur lors de l’enregistrement de la vidange',
    async (payload: {
      drain_date: string;
      liters: number;
      notes?: string | null;
      barrel_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('oil_drains')
        .insert({
          drain_date: payload.drain_date,
          liters: payload.liters,
          notes: payload.notes ?? null,
          barrel_id: payload.barrel_id ?? null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  );
}
