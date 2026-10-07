import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Types
export interface TMSClient {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  ice: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TMSTarif {
  id: string;
  name: string;
  client_id: string | null;
  price_per_km: number;
  price_per_ton: number;
  min_price: number;
  currency: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client?: TMSClient;
}

export interface TMSDevis {
  id: string;
  devis_number: string;
  client_id: string | null;
  tarif_id: string | null;
  pickup_address: string;
  delivery_address: string;
  distance_km: number;
  weight_tons: number;
  merchandise_type: string | null;
  amount_ht: number;
  tax_rate: number;
  tax_amount: number;
  amount_ttc: number;
  status: string;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client?: TMSClient;
  tarif?: TMSTarif;
}

export interface TMSOrder {
  id: string;
  order_number: string;
  devis_id: string | null;
  client_id: string | null;
  tarif_id: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  pickup_address: string;
  delivery_address: string;
  pickup_date: string;
  delivery_date: string | null;
  distance_km: number;
  weight_tons: number;
  merchandise_type: string | null;
  status: string;
  amount_ht: number;
  fuel_cost: number;
  toll_cost: number;
  driver_cost: number;
  other_costs: number;
  total_cost: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client?: TMSClient;
}

export interface TMSInvoice {
  id: string;
  invoice_number: string;
  client_id: string | null;
  date_from: string;
  date_to: string;
  total_orders: number;
  total_distance_km: number;
  total_weight_tons: number;
  amount_ht: number;
  tax_rate: number;
  tax_amount: number;
  amount_ttc: number;
  total_cost: number;
  profit: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client?: TMSClient;
}

// Helper for mutations
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
    onError: () => {
      toast({ title: errorMsg, variant: 'destructive' });
    },
  });
}

// ── Clients ──
export function useTMSClients() {
  return useQuery({
    queryKey: ['tms_clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tms_clients').select('*').order('name');
      if (error) throw error;
      return data as TMSClient[];
    },
  });
}

export function useCreateTMSClient() {
  return useCrudMutation(['tms_clients'], 'Client créé', 'Erreur création client',
    async (client: Partial<TMSClient>) => {
      const { data, error } = await supabase.from('tms_clients').insert(client as any).select().single();
      if (error) throw error;
      return data;
    });
}

export function useDeleteTMSClient() {
  return useCrudMutation(['tms_clients'], 'Client supprimé', 'Erreur suppression',
    async (id: string) => {
      const { error } = await supabase.from('tms_clients').delete().eq('id', id);
      if (error) throw error;
    });
}

// ── Tarifs ──
export function useTMSTarifs() {
  return useQuery({
    queryKey: ['tms_tarifs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tms_tarifs').select('*, client:tms_clients(*)').order('name');
      if (error) throw error;
      return data as TMSTarif[];
    },
  });
}

export function useCreateTMSTarif() {
  return useCrudMutation(['tms_tarifs'], 'Tarif créé', 'Erreur création tarif',
    async (tarif: Partial<TMSTarif>) => {
      const { data, error } = await supabase.from('tms_tarifs').insert(tarif as any).select().single();
      if (error) throw error;
      return data;
    });
}

export function useDeleteTMSTarif() {
  return useCrudMutation(['tms_tarifs'], 'Tarif supprimé', 'Erreur suppression',
    async (id: string) => {
      const { error } = await supabase.from('tms_tarifs').delete().eq('id', id);
      if (error) throw error;
    });
}

// ── Devis ──
export function useTMSDevis() {
  return useQuery({
    queryKey: ['tms_devis'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tms_devis').select('*, client:tms_clients(*), tarif:tms_tarifs(*)').order('created_at', { ascending: false });
      if (error) throw error;
      return data as TMSDevis[];
    },
  });
}

export function useCreateTMSDevis() {
  return useCrudMutation(['tms_devis'], 'Devis créé', 'Erreur création devis',
    async (devis: Partial<TMSDevis>) => {
      const { data, error } = await supabase.from('tms_devis').insert(devis as any).select().single();
      if (error) throw error;
      return data;
    });
}

export function useUpdateTMSDevis() {
  return useCrudMutation(['tms_devis'], 'Devis mis à jour', 'Erreur mise à jour',
    async ({ id, ...updates }: Partial<TMSDevis> & { id: string }) => {
      const { data, error } = await supabase.from('tms_devis').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    });
}

export function useDeleteTMSDevis() {
  return useCrudMutation(['tms_devis'], 'Devis supprimé', 'Erreur suppression',
    async (id: string) => {
      const { error } = await supabase.from('tms_devis').delete().eq('id', id);
      if (error) throw error;
    });
}

// ── Orders ──
export function useTMSOrders() {
  return useQuery({
    queryKey: ['tms_orders'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tms_orders').select('*, client:tms_clients(*)').order('pickup_date', { ascending: false });
      if (error) throw error;
      return data as TMSOrder[];
    },
  });
}

export function useCreateTMSOrder() {
  return useCrudMutation(['tms_orders'], 'Ordre créé', 'Erreur création ordre',
    async (order: Partial<TMSOrder>) => {
      const { data, error } = await supabase.from('tms_orders').insert(order as any).select().single();
      if (error) throw error;
      return data;
    });
}

export function useUpdateTMSOrder() {
  return useCrudMutation(['tms_orders'], 'Ordre mis à jour', 'Erreur mise à jour',
    async ({ id, ...updates }: Partial<TMSOrder> & { id: string }) => {
      const { data, error } = await supabase.from('tms_orders').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    });
}

export function useDeleteTMSOrder() {
  return useCrudMutation(['tms_orders'], 'Ordre supprimé', 'Erreur suppression',
    async (id: string) => {
      const { error } = await supabase.from('tms_orders').delete().eq('id', id);
      if (error) throw error;
    });
}

// ── Invoices ──
export function useTMSInvoices() {
  return useQuery({
    queryKey: ['tms_invoices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tms_invoices').select('*, client:tms_clients(*)').order('created_at', { ascending: false });
      if (error) throw error;
      return data as TMSInvoice[];
    },
  });
}

export function useCreateTMSInvoice() {
  return useCrudMutation(['tms_invoices'], 'Facture créée', 'Erreur création facture',
    async (invoice: Partial<TMSInvoice>) => {
      const { data, error } = await supabase.from('tms_invoices').insert(invoice as any).select().single();
      if (error) throw error;
      return data;
    });
}

export function useUpdateTMSInvoice() {
  return useCrudMutation(['tms_invoices'], 'Facture mise à jour', 'Erreur mise à jour',
    async ({ id, ...updates }: Partial<TMSInvoice> & { id: string }) => {
      const { data, error } = await supabase.from('tms_invoices').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    });
}

export function useDeleteTMSInvoice() {
  return useCrudMutation(['tms_invoices'], 'Facture supprimée', 'Erreur suppression',
    async (id: string) => {
      const { error } = await supabase.from('tms_invoices').delete().eq('id', id);
      if (error) throw error;
    });
}
