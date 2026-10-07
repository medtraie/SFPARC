import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Driver {
  id: string;
  name: string;
  phone: string;
  license_type: string;
  license_expiry: string;
  vehicle_id: string | null;
  status: 'available' | 'on_mission' | 'off_duty';
  created_at: string;
  updated_at: string;
}

export interface DriverInsert {
  name: string;
  phone: string;
  license_type: string;
  license_expiry: string;
  vehicle_id?: string | null;
  status?: 'available' | 'on_mission' | 'off_duty';
}

async function fetchDrivers(): Promise<Driver[]> {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching drivers:', error);
    throw error;
  }

  return (data || []) as Driver[];

  
}

async function createDriver(driver: DriverInsert): Promise<Driver> {
  const { data, error } = await supabase
    .from('drivers')
    .insert(driver)
    .select()
    .single();

  if (error) {
    console.error('Error creating driver:', error);
    throw error;
  }

  return data as Driver;

}

async function updateDriver({ id, ...updates }: Partial<Driver> & { id: string }): Promise<Driver> {
  const { data, error } = await supabase
    .from('drivers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating driver:', error);
    throw error;
  }

  return data as Driver;
}

async function deleteDriver(id: string): Promise<void> {
  const { error } = await supabase
    .from('drivers')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting driver:', error);
    throw error;
  }
}

export function useDrivers() {
  return useQuery({
    queryKey: ['drivers'],
    queryFn: fetchDrivers,
    staleTime: 30000,
  });
}

export function useCreateDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDriver,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast({
        title: 'Succès',
        description: 'Le chauffeur a été ajouté avec succès',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Une erreur est survenue lors de l\'ajout du chauffeur',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateDriver,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast({
        title: 'Succès',
        description: 'Le chauffeur a été mis à jour',
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

export function useDeleteDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDriver,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast({
        title: 'Succès',
        description: 'Le chauffeur a été supprimé',
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
