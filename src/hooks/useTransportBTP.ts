import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { GPSwoxGeofence } from '@/hooks/useGPSwoxGeofences';

// Types
export interface Chantier {
  id: string;
  name: string;
  type: 'chantier' | 'carriere';
  address: string | null;
  city: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  contact_name: string | null;
  contact_phone: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Trajet {
  id: string;
  name: string;
  origin_chantier_id: string | null;
  destination_chantier_id: string | null;
  distance_km: number | null;
  estimated_duration_minutes: number | null;
  price_per_ton: number;
  price_per_trip: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  origin_chantier?: Chantier;
  destination_chantier?: Chantier;
}

export interface Voyage {
  id: string;
  trajet_id: string | null;
  vehicle_id: string;
  driver_id: string | null;
  voyage_date: string;
  tonnage: number;
  material_type: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  status: string;
  bon_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  trajet?: Trajet;
}

export interface Facture {
  id: string;
  facture_number: string;
  client_name: string;
  client_address: string | null;
  chantier_id: string | null;
  date_from: string;
  date_to: string;
  total_tonnage: number;
  total_trips: number;
  total_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_with_tax: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  chantier?: Chantier;
}

export interface FactureLine {
  id: string;
  facture_id: string;
  voyage_id: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  created_at: string;
}

// Chantiers hooks
export function useChantiers() {
  return useQuery({
    queryKey: ['chantiers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chantiers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Chantier[];
    },
  });
}

export function useCreateChantier() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (chantier: Omit<Chantier, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('chantiers')
        .insert(chantier)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chantiers'] });
      toast({ title: 'Chantier créé avec succès' });
    },
    onError: () => {
      toast({ title: 'Erreur lors de la création', variant: 'destructive' });
    },
  });
}

export function useUpdateChantier() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Chantier> & { id: string }) => {
      const { data, error } = await supabase
        .from('chantiers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chantiers'] });
      toast({ title: 'Chantier mis à jour' });
    },
    onError: () => {
      toast({ title: 'Erreur lors de la mise à jour', variant: 'destructive' });
    },
  });
}

export function useDeleteChantier() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chantiers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chantiers'] });
      toast({ title: 'Chantier supprimé' });
    },
    onError: () => {
      toast({ title: 'Erreur lors de la suppression', variant: 'destructive' });
    },
  });
}

export function useSyncGeofencesToChantiers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (geofences: GPSwoxGeofence[]) => {
      if (!geofences.length) {
        return { created: 0, updated: 0, total: 0 };
      }

      const { data: existingChantiers, error: fetchError } = await supabase
        .from('chantiers')
        .select('id, name, status, type, notes');
      if (fetchError) throw fetchError;

      const chantierByName = new Map(
        ((existingChantiers || []) as Array<Pick<Chantier, 'id' | 'name' | 'status' | 'type' | 'notes'>>).map((chantier) => [
          chantier.name.trim().toLowerCase(),
          chantier,
        ]),
      );

      let created = 0;
      let updated = 0;
      const noteSource = 'source:gpswox';

      for (const geofence of geofences) {
        const normalized = geofence.name.trim().toLowerCase();
        if (!normalized) continue;
        const existing = chantierByName.get(normalized);
        const nextStatus = geofence.active ? 'active' : 'inactive';

        if (!existing) {
          const { data: inserted, error: insertError } = await supabase
            .from('chantiers')
            .insert({
              name: geofence.name.trim(),
              type: 'chantier',
              status: nextStatus,
              notes: noteSource,
            })
            .select('id, name, status, type, notes')
            .single();
          if (insertError) throw insertError;
          created += 1;
          if (inserted) {
            chantierByName.set(normalized, inserted as Pick<Chantier, 'id' | 'name' | 'status' | 'type' | 'notes'>);
          }
          continue;
        }

        const needsStatusUpdate = existing.status !== nextStatus;
        const needsTypeUpdate = existing.type !== 'chantier';
        const hasSourceTag = (existing.notes || '').toLowerCase().includes(noteSource);
        const nextNotes = hasSourceTag
          ? existing.notes
          : existing.notes
            ? `${existing.notes}\n${noteSource}`
            : noteSource;
        const needsNotesUpdate = nextNotes !== existing.notes;

        if (needsStatusUpdate || needsTypeUpdate || needsNotesUpdate) {
          const { error: updateError } = await supabase
            .from('chantiers')
            .update({
              status: nextStatus,
              type: 'chantier',
              notes: nextNotes,
            })
            .eq('id', existing.id);
          if (updateError) throw updateError;
          updated += 1;
        }
      }

      return { created, updated, total: geofences.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['chantiers'] });
      queryClient.invalidateQueries({ queryKey: ['trajets'] });
      toast({
        title: 'Synchronisation GPSwox réussie',
        description: `${result.created} créé(s), ${result.updated} mis à jour`,
      });
    },
    onError: () => {
      toast({
        title: 'Erreur de synchronisation GPSwox',
        variant: 'destructive',
      });
    },
  });
}

// Trajets hooks
export function useTrajets() {
  return useQuery({
    queryKey: ['trajets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trajets')
        .select(`
          *,
          origin_chantier:chantiers!trajets_origin_chantier_id_fkey(*),
          destination_chantier:chantiers!trajets_destination_chantier_id_fkey(*)
        `)
        .order('name');
      if (error) throw error;
      return data as Trajet[];
    },
  });
}

export function useCreateTrajet() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (trajet: Omit<Trajet, 'id' | 'created_at' | 'updated_at' | 'origin_chantier' | 'destination_chantier'>) => {
      const { data, error } = await supabase
        .from('trajets')
        .insert(trajet)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trajets'] });
      toast({ title: 'Trajet créé avec succès' });
    },
    onError: () => {
      toast({ title: 'Erreur lors de la création', variant: 'destructive' });
    },
  });
}

export function useUpdateTrajet() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Trajet> & { id: string }) => {
      const { data, error } = await supabase
        .from('trajets')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trajets'] });
      toast({ title: 'Trajet mis à jour' });
    },
    onError: () => {
      toast({ title: 'Erreur lors de la mise à jour', variant: 'destructive' });
    },
  });
}

export function useDeleteTrajet() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('trajets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trajets'] });
      toast({ title: 'Trajet supprimé' });
    },
    onError: () => {
      toast({ title: 'Erreur lors de la suppression', variant: 'destructive' });
    },
  });
}

// Voyages hooks
export function useVoyages() {
  return useQuery({
    queryKey: ['voyages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('voyages')
        .select(`
          *,
          trajet:trajets(
            *,
            origin_chantier:chantiers!trajets_origin_chantier_id_fkey(*),
            destination_chantier:chantiers!trajets_destination_chantier_id_fkey(*)
          )
        `)
        .order('voyage_date', { ascending: false });
      if (error) throw error;
      return data as Voyage[];
    },
  });
}

export function useCreateVoyage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (voyage: Omit<Voyage, 'id' | 'created_at' | 'updated_at' | 'trajet'>) => {
      const { data, error } = await supabase
        .from('voyages')
        .insert(voyage)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voyages'] });
      toast({ title: 'Voyage enregistré avec succès' });
    },
    onError: () => {
      toast({ title: 'Erreur lors de l\'enregistrement', variant: 'destructive' });
    },
  });
}

export function useUpdateVoyage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Voyage> & { id: string }) => {
      const { data, error } = await supabase
        .from('voyages')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voyages'] });
      toast({ title: 'Voyage mis à jour' });
    },
    onError: () => {
      toast({ title: 'Erreur lors de la mise à jour', variant: 'destructive' });
    },
  });
}

export function useDeleteVoyage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('voyages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voyages'] });
      toast({ title: 'Voyage supprimé' });
    },
    onError: () => {
      toast({ title: 'Erreur lors de la suppression', variant: 'destructive' });
    },
  });
}

// Factures hooks
export function useFactures() {
  return useQuery({
    queryKey: ['factures'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('factures')
        .select(`
          *,
          chantier:chantiers(*)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Facture[];
    },
  });
}

export function useCreateFacture() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (facture: Omit<Facture, 'id' | 'created_at' | 'updated_at' | 'chantier'>) => {
      const { data, error } = await supabase
        .from('factures')
        .insert(facture)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factures'] });
      toast({ title: 'Facture créée avec succès' });
    },
    onError: () => {
      toast({ title: 'Erreur lors de la création', variant: 'destructive' });
    },
  });
}

export function useUpdateFacture() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Facture> & { id: string }) => {
      const { data, error } = await supabase
        .from('factures')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factures'] });
      toast({ title: 'Facture mise à jour' });
    },
    onError: () => {
      toast({ title: 'Erreur lors de la mise à jour', variant: 'destructive' });
    },
  });
}

export function useDeleteFacture() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('factures').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factures'] });
      toast({ title: 'Facture supprimée' });
    },
    onError: () => {
      toast({ title: 'Erreur lors de la suppression', variant: 'destructive' });
    },
  });
}

// Stats for dashboard
export function useTransportStats() {
  const { data: voyages } = useVoyages();
  const { data: factures } = useFactures();
  const { data: chantiers } = useChantiers();

  const stats = {
    totalVoyages: voyages?.length || 0,
    totalTonnage: voyages?.reduce((sum, v) => sum + Number(v.tonnage), 0) || 0,
    totalRevenue: factures?.filter(f => f.status === 'paid').reduce((sum, f) => sum + Number(f.total_with_tax), 0) || 0,
    pendingInvoices: factures?.filter(f => f.status === 'draft' || f.status === 'sent').length || 0,
    activeChantiers: chantiers?.filter(c => c.status === 'active').length || 0,
  };

  return stats;
}
