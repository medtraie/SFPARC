import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Mission {
  id: string;
  vehicle_id: string;
  driver_id: string | null;
  departure_zone: string;
  arrival_zone: string;
  mission_date: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  notes: string | null;
  fuel_quantity: number | null;
  price_per_liter: number | null;
  fuel_cost: number | null;
  discount_rate: number | null;
  discount_amount: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  total_before_cap: number | null;
  max_total_cost: number | null;
  cash_amount: number | null;
  extra_fees: number | null;
  total_cost: number | null;
  created_at: string;
  updated_at: string;
}

export interface MissionInsert {
  vehicle_id: string;
  driver_id?: string | null;
  departure_zone: string;
  arrival_zone: string;
  mission_date: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string | null;
  fuel_quantity?: number | null;
  price_per_liter?: number | null;
  fuel_cost?: number | null;
  discount_rate?: number | null;
  discount_amount?: number | null;
  tax_rate?: number | null;
  tax_amount?: number | null;
  total_before_cap?: number | null;
  max_total_cost?: number | null;
  cash_amount?: number | null;
  extra_fees?: number | null;
  total_cost?: number | null;
}

async function fetchMissions(): Promise<Mission[]> {
  const { data, error } = await supabase
    .from('missions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching missions:', error);
    throw error;
  }

  return (data || []) as Mission[];
}

async function createMission(mission: MissionInsert): Promise<Mission> {
  const { data, error } = await supabase
    .from('missions')
    .insert(mission)
    .select()
    .single();

  if (error) {
    console.error('Error creating mission:', error);
    throw error;
  }

  return data as Mission;
}

async function updateMission({ id, ...updates }: Partial<Mission> & { id: string }): Promise<Mission> {
  const { data, error } = await supabase
    .from('missions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating mission:', error);
    throw error;
  }

  return data as Mission;
}

async function deleteMission(id: string): Promise<void> {
  const { error } = await supabase
    .from('missions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting mission:', error);
    throw error;
  }
}

export function useMissions() {
  return useQuery({
    queryKey: ['missions'],
    queryFn: fetchMissions,
    staleTime: 30000,
  });
}

export function useCreateMission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      toast({
        title: 'Succès',
        description: 'La mission a été créée avec succès',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Une erreur est survenue lors de la création de la mission',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateMission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      toast({
        title: 'Succès',
        description: 'La mission a été mise à jour',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Une erreur est survenue lors de la mise à jour',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteMission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      toast({
        title: 'Succès',
        description: 'La mission a été supprimée',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Une erreur est survenue lors de la suppression',
        variant: 'destructive',
      });
    },
  });
}
