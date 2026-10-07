import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface FuelLog {
  id: string;
  vehicle_id: string;
  driver_id: string | null;
  log_date: string;
  liters: number;
  price_per_liter: number;
  total_cost: number;
  station: string;
  mileage: number;
  created_at: string;
  updated_at: string;
}

export interface FuelLogInsert {
  vehicle_id: string;
  driver_id?: string | null;
  log_date: string;
  liters: number;
  price_per_liter: number;
  station: string;
  mileage: number;
}

async function fetchFuelLogs(): Promise<FuelLog[]> {
  const { data, error } = await supabase
    .from('fuel_logs')
    .select('*')
    .order('log_date', { ascending: false });

  if (error) {
    console.error('Error fetching fuel logs:', error);
    throw error;
  }

  return data || [];
}

async function createFuelLog(log: FuelLogInsert): Promise<FuelLog> {
  const { data, error } = await supabase
    .from('fuel_logs')
    .insert(log)
    .select()
    .single();

  if (error) {
    console.error('Error creating fuel log:', error);
    throw error;
  }

  return data;
}

async function updateFuelLog({ id, ...updates }: Partial<FuelLogInsert> & { id: string }): Promise<FuelLog> {
  const { data, error } = await supabase
    .from('fuel_logs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating fuel log:', error);
    throw error;
  }

  return data;
}

async function deleteFuelLog(id: string): Promise<void> {
  const { error } = await supabase
    .from('fuel_logs')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting fuel log:', error);
    throw error;
  }
}

export function useFuelLogs() {
  return useQuery({
    queryKey: ['fuel-logs'],
    queryFn: fetchFuelLogs,
    staleTime: 30000,
  });
}

export function useCreateFuelLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createFuelLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-logs'] });
      toast({
        title: 'Succès',
        description: 'Le plein carburant a été enregistré',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Une erreur est survenue lors de l\'enregistrement',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateFuelLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateFuelLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-logs'] });
      toast({
        title: 'Succès',
        description: 'Le plein carburant a été mis à jour',
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

export function useDeleteFuelLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteFuelLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-logs'] });
      toast({
        title: 'Succès',
        description: 'Le plein carburant a été supprimé',
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
