import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GPSwoxVehicle, useGPSwoxVehicles } from '@/hooks/useGPSwoxVehicles';
import { useMemo } from 'react';

export type RevisionType = 'vidange' | 'vignette' | 'visite_technique' | 'assurance' | 'chaine_distribution' | 'adblue' | 'vidange_boite' | 'autre_document';
export type RevisionMode = 'days' | 'km';

export interface VehicleRevision {
  id: string;
  vehicle_id: string | null;
  vehicle_plate: string;
  type: RevisionType;
  mode: RevisionMode;
  interval_days: number | null;
  interval_km: number | null;
  last_date: string | null;
  last_km: number | null;
  current_km: number | null;
  reminder_km: number | null;
  next_due_date: string | null;
  next_due_km: number | null;
  status: 'pending' | 'due' | 'overdue' | 'completed';
  file_url: string | null;
  notes: string | null;
  cost?: number | null;
  garage_name: string | null;
  invoice_number: string | null;
  recurrence_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type ComputedRevision = VehicleRevision & {
  currentKm: number | null;
  remainingDays: number | null;
  remainingKm: number | null;
};

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
      queryKeys.forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
      toast({ title: successMsg });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '';
      toast({
        title: errorMsg,
        description: message || undefined,
        variant: 'destructive',
      });
    },
  });
}

export function useRevisions() {
  return useQuery({
    queryKey: ['vehicle_revisions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicle_revisions').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      return data as VehicleRevision[];
    },
  });
}

export function useCreateRevision() {
  return useCrudMutation(['vehicle_revisions'], 'Révision créée', 'Erreur création',
    async (rev: Partial<VehicleRevision>) => {
      console.log('Sending to supabase vehicle_revisions:', rev);
      const { data, error } = await supabase.from('vehicle_revisions').insert(rev as any).select().single();
      if (error) {
        console.error('Supabase vehicle_revisions insert error:', error);
        throw new Error(error.message || error.details || 'Erreur inconnue Supabase');
      }
      return data;
    });
}

export function useUpdateRevision() {
  return useCrudMutation(['vehicle_revisions'], 'Révision mise à jour', 'Erreur mise à jour',
    async ({ id, ...updates }: Partial<VehicleRevision> & { id: string }) => {
      const { data, error } = await supabase.from('vehicle_revisions').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    });
}

export function useDeleteRevision() {
  return useCrudMutation(['vehicle_revisions'], 'Révision supprimée', 'Erreur suppression',
    async (id: string) => {
      const { error } = await supabase.from('vehicle_revisions').delete().eq('id', id);
      if (error) throw error;
    });
}

export function useComputedRevisions() {
  const { data: revisions = [] } = useRevisions();
  const { data: vehicles = [] } = useGPSwoxVehicles();

  const byPlate = useMemo(() => {
    const map = new Map<string, GPSwoxVehicle>();
    vehicles.forEach(v => map.set(v.plate, v));
    return map;
  }, [vehicles]);

  const now = new Date();

  const computed = useMemo<ComputedRevision[]>(() => {
    return revisions.map((rev) => {
      const vehicle = byPlate.get(rev.vehicle_plate);
      const currentKm = vehicle?.mileage ?? null;
      let status: VehicleRevision['status'] = rev.status || 'pending';
      let remainingDays: number | null = null;
      let remainingKm: number | null = null;

      if (status !== 'completed') {
        if (rev.mode === 'days' && rev.next_due_date) {
          const due = new Date(rev.next_due_date);
          const diffDays = Math.ceil(
            (due.getTime() - now.getTime()) / 86400000
          );
          remainingDays = diffDays;
          status =
            due < now
              ? 'overdue'
              : diffDays <= 7
              ? 'due'
              : 'pending';
        } else if (rev.mode === 'km' && rev.next_due_km && currentKm != null) {
          const remaining = rev.next_due_km - currentKm;
          remainingKm = remaining;
          const reminderThreshold = rev.reminder_km ?? 200;
          status =
            remaining < 0
              ? 'overdue'
              : remaining <= reminderThreshold
              ? 'due'
              : 'pending';
        }
      }

      return {
        ...rev,
        status,
        currentKm,
        remainingDays,
        remainingKm,
      };
    });
  }, [revisions, byPlate, now]);

  return { revisions: computed, raw: revisions, vehicles };
}

export interface RevisionAlert {
  id: string;
  revision_id: string;
  vehicle_plate: string;
  type: RevisionType;
  mode: RevisionMode;
  status: 'due' | 'overdue';
  message: string;
  triggered_at: string;
  alert_date: string;
  ack: boolean;
}

export function useRevisionAlerts() {
  return useQuery({
    queryKey: ['revision_alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('revision_alerts')
        .select('*')
        .order('triggered_at', { ascending: false });
      if (error) throw error;
      return data as RevisionAlert[];
    },
    refetchInterval: 60000,
  });
}

export function useAcknowledgeRevisionAlert() {
  return useCrudMutation(['revision_alerts'], 'Alerte acquittée', 'Erreur acquittement',
    async ({ id, ack }: { id: string; ack: boolean }) => {
      const { data, error } = await supabase
        .from('revision_alerts')
        .update({ ack })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    });
}
