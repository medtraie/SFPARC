import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// Types
export interface TourismClient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TourismMission {
  id: string;
  reference: string;
  reference_mission?: string | null;
  client_id: string | null;
  mission_type: 'transfer' | 'excursion' | 'circuit' | 'rental';
  title: string;
  description: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  passengers_count: number;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  start_km?: number | null;
  end_km?: number | null;
  total_km?: number | null;
  meal_amount?: number | null;
  driver_parking?: number | null;
  driver_toll?: number | null;
  driver_misc?: number | null;
  driver_expenses_total?: number | null;
  dossier_number?: string | null;
  mission_number?: string | null;
  version_number?: string | null;
  status: 'planned' | 'dispatched' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  notes: string | null;
  driver_instructions: string | null;
  observations_end_mission?: string | null;
  created_at: string;
  updated_at: string;
  client?: TourismClient;
  driver?: { id: string; name: string };
  waypoints?: TourismWaypoint[];
}

export interface TourismWaypoint {
  id: string;
  mission_id: string;
  sequence_order: number;
  location_name: string;
  address: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  planned_arrival: string | null;
  planned_departure: string | null;
  actual_arrival: string | null;
  actual_departure: string | null;
  distance_from_previous_km: number | null;
  duration_from_previous_minutes: number | null;
  notes: string | null;
  created_at: string;
}

export interface TourismInvoice {
  id: string;
  invoice_number: string;
  client_id: string | null;
  mission_id: string | null;
  invoice_date: string;
  due_date: string | null;
  billing_type: 'flat' | 'hourly' | 'per_km' | 'custom';
  hours_worked: number;
  hourly_rate: number;
  kilometers: number;
  per_km_rate: number;
  flat_rate: number;
  custom_lines: { description: string; quantity: number; unit_price: number; total: number }[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
  client?: TourismClient;
  mission?: TourismMission;
}

// Clients
export function useTourismClients() {
  return useQuery({
    queryKey: ['tourism-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tourism_clients')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as TourismClient[];
    },
  });
}

export function useCreateTourismClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (client: Omit<TourismClient, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('tourism_clients')
        .insert(client)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tourism-clients'] });
      toast({ title: 'Succès', description: 'Client créé avec succès' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateTourismClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TourismClient> & { id: string }) => {
      const { data, error } = await supabase
        .from('tourism_clients')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tourism-clients'] });
      toast({ title: 'Succès', description: 'Client mis à jour' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteTourismClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tourism_clients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tourism-clients'] });
      toast({ title: 'Succès', description: 'Client supprimé' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

// Missions
export function useTourismMissions() {
  return useQuery({
    queryKey: ['tourism-missions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tourism_missions')
        .select(`
          *,
          client:tourism_clients(*),
          driver:drivers(id, name),
          waypoints:tourism_waypoints(*)
        `)
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data as unknown as TourismMission[];
    },
  });
}

export function useCreateTourismMission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mission: Omit<TourismMission, 'id' | 'created_at' | 'updated_at' | 'client' | 'driver' | 'waypoints'>) => {
      const { data, error } = await supabase
        .from('tourism_missions')
        .insert(mission)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tourism-missions'] });
      toast({ title: 'Succès', description: 'Mission créée avec succès' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateTourismMission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TourismMission> & { id: string }) => {
      // Remove nested objects before updating
      const { client, driver, waypoints, ...cleanUpdates } = updates as TourismMission;
      const { data, error } = await supabase
        .from('tourism_missions')
        .update(cleanUpdates)
        .eq('id', id)
        .select(`
          *,
          client:tourism_clients(*),
          driver:drivers(id, name),
          waypoints:tourism_waypoints(*)
        `)
        .single();
      if (error) throw error;
      return data as unknown as TourismMission;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tourism-missions'] });
      toast({ title: 'Succès', description: 'Mission mise à jour' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteTourismMission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tourism_missions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tourism-missions'] });
      toast({ title: 'Succès', description: 'Mission supprimée' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

// Waypoints
export function useCreateTourismWaypoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (waypoint: Omit<TourismWaypoint, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('tourism_waypoints')
        .insert(waypoint)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tourism-missions'] });
      toast({ title: 'Succès', description: 'Étape ajoutée' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteTourismWaypoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tourism_waypoints').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tourism-missions'] });
      toast({ title: 'Succès', description: 'Étape supprimée' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

// Invoices
export function useTourismInvoices() {
  return useQuery({
    queryKey: ['tourism-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tourism_invoices')
        .select(`
          *,
          client:tourism_clients(*),
          mission:tourism_missions(*)
        `)
        .order('invoice_date', { ascending: false });
      if (error) throw error;
      return data as unknown as TourismInvoice[];
    },
  });
}

export function useCreateTourismInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invoice: Omit<TourismInvoice, 'id' | 'created_at' | 'updated_at' | 'client' | 'mission'>) => {
      const { data, error } = await supabase
        .from('tourism_invoices')
        .insert(invoice)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tourism-invoices'] });
      toast({ title: 'Succès', description: 'Facture créée avec succès' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateTourismInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TourismInvoice> & { id: string }) => {
      const { client, mission, ...cleanUpdates } = updates as TourismInvoice;
      const { data, error } = await supabase
        .from('tourism_invoices')
        .update(cleanUpdates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tourism-invoices'] });
      toast({ title: 'Succès', description: 'Facture mise à jour' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteTourismInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tourism_invoices').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tourism-invoices'] });
      toast({ title: 'Succès', description: 'Facture supprimée' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

// Generate unique reference
export function generateMissionReference(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TT${year}${month}-${random}`;
}

export function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `FT${year}${month}-${random}`;
}
