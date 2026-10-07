import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export interface MaintenanceRecord {
  id: string;
  vehicle_id: string;
  maintenance_type: string;
  work_order_type: 'preventive' | 'corrective' | 'inspection' | null;
  priority: 'low' | 'medium' | 'high' | null;
  maintenance_date: string;
  diagnosis: string | null;
  garage: string | null;
  labor_cost: number | null;
  parts_cost: number | null;
  parts: Array<{ name: string; quantity: number; unitPrice: number; stockItemId?: string | null }> | null;
  cost: number | null;
  notes: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceInsert {
  vehicle_id: string;
  maintenance_type: string;
  work_order_type?: 'preventive' | 'corrective' | 'inspection' | null;
  priority?: 'low' | 'medium' | 'high' | null;
  maintenance_date: string;
  diagnosis?: string | null;
  garage?: string | null;
  labor_cost?: number | null;
  parts_cost?: number | null;
  parts?: Array<{ name: string; quantity: number; unitPrice: number; stockItemId?: string | null }> | null;
  cost?: number | null;
  notes?: string | null;
  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  completed_at?: string | null;
}

async function fetchMaintenance(): Promise<MaintenanceRecord[]> {
  const { data, error } = await supabase
    .from('maintenance')
    .select('*')
    .order('maintenance_date', { ascending: false });

  if (error) {
    console.error('Error fetching maintenance:', error);
    throw error;
  }

  return (data || []) as MaintenanceRecord[];
}

async function createMaintenance(record: MaintenanceInsert): Promise<MaintenanceRecord> {
  const { data, error } = await supabase
    .from('maintenance')
    .insert(record)
    .select()
    .single();

  if (error) {
    console.error('Error creating maintenance:', error);
    throw error;
  }

  return data as MaintenanceRecord;
}

async function updateMaintenance({ id, ...updates }: Partial<MaintenanceInsert> & { id: string }): Promise<MaintenanceRecord> {
  const { data, error } = await supabase
    .from('maintenance')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating maintenance:', error);
    throw error;
  }

  return data as MaintenanceRecord;
}

async function deleteMaintenance(id: string): Promise<void> {
  const { error } = await supabase
    .from('maintenance')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting maintenance:', error);
    throw error;
  }
}

export function useMaintenance() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['maintenance', user?.id || 'anonymous'],
    queryFn: fetchMaintenance,
    enabled: !!user,
    staleTime: 30000,
  });
}

export function useCreateMaintenance() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: createMaintenance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance', user?.id || 'anonymous'] });
      toast({
        title: 'Succès',
        description: 'L\'ordre de travail a été créé',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Une erreur est survenue lors de la création',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateMaintenance() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: updateMaintenance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance', user?.id || 'anonymous'] });
      toast({
        title: 'Succès',
        description: 'L\'ordre de travail a été mis à jour',
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

export function useDeleteMaintenance() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: deleteMaintenance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance', user?.id || 'anonymous'] });
      toast({
        title: 'Succès',
        description: 'L\'ordre de travail a été supprimé',
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
