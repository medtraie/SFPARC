import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AchatsSupplier {
  id: string;
  supplier_code: string;
  legal_name: string;
  trade_name: string | null;
  ice_if: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  payment_terms: string | null;
  payment_due_days: number;
  quality_score: number;
  delay_score: number;
  volume_score: number;
  branch_code: string | null;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseRequestItem {
  id: string;
  request_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface PurchaseRequest {
  id: string;
  request_number: string;
  requester_name: string | null;
  supplier_name: string | null;
  supplier_id?: string | null;
  branch_code?: string | null;
  request_date: string;
  needed_date: string | null;
  status: string;
  workflow_level?: number;
  total_amount: number;
  notes: string | null;
  approved_by?: string | null;
  rejected_by?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  document_hash?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  items?: PurchaseRequestItem[];
}

export interface PurchaseOrderItem {
  id: string;
  order_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  order_number: string;
  supplier_name: string;
  supplier_id?: string | null;
  request_id?: string | null;
  branch_code?: string | null;
  order_date: string;
  expected_delivery_date: string | null;
  status: string;
  workflow_level?: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  approved_by?: string | null;
  rejected_by?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  document_hash?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  items?: PurchaseOrderItem[];
}

export interface DeliveryNoteItem {
  id: string;
  delivery_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface DeliveryNote {
  id: string;
  delivery_number: string;
  supplier_name: string;
  supplier_id?: string | null;
  order_number: string | null;
  order_id?: string | null;
  branch_code?: string | null;
  delivery_date: string;
  status: string;
  total_amount: number;
  notes: string | null;
  document_hash?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  items?: DeliveryNoteItem[];
}

export interface SupplierInvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface SupplierInvoice {
  id: string;
  invoice_number: string;
  supplier_name: string;
  supplier_id?: string | null;
  order_id?: string | null;
  delivery_id?: string | null;
  branch_code?: string | null;
  invoice_date: string;
  due_date: string | null;
  status: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  document_hash?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  items?: SupplierInvoiceItem[];
}

export interface AchatsAlert {
  id: string;
  alert_type: 'invoice_overdue' | 'delivery_delay' | 'budget_exceeded';
  record_id: string | null;
  reference: string | null;
  supplier_name: string | null;
  title: string;
  due_at: string | null;
  amount: number | null;
}

export interface CashForecastItem {
  horizon: '30' | '60' | '90' | string;
  obligations: number;
}

export interface AchatsKpis {
  monthlyPurchases: number;
  averagePaymentDelayDays: number;
  overdueInvoiceRate: number;
}

export interface TopSupplier {
  supplierId: string | null;
  supplierName: string;
  volume: number;
  qualityScore: number;
  delayScore: number;
  delayCount: number;
}

function useCrudMutation<T>(
  queryKeys: string[],
  successMsg: string,
  errorMsg: string,
  mutationFn: (data: T) => Promise<unknown>
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

const invalidateKeys = [
  'achats_purchase_requests',
  'achats_purchase_requests_paged',
  'achats_purchase_orders',
  'achats_purchase_orders_paged',
  'achats_delivery_notes',
  'achats_delivery_notes_paged',
  'achats_supplier_invoices',
  'achats_supplier_invoices_paged',
  'achats_suppliers',
  'achats_alerts',
  'achats_cash_forecast',
  'achats_dashboard_kpis',
  'achats_top_suppliers',
];

export function useAchatsSuppliers() {
  return useQuery({
    queryKey: ['achats_suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('achats_suppliers')
        .select('*')
        .is('deleted_at', null)
        .order('legal_name', { ascending: true });
      if (error) throw error;
      return (data || []) as AchatsSupplier[];
    },
  });
}

export function useCreateSupplier() {
  return useCrudMutation(
    invalidateKeys,
    'Fournisseur créé',
    'Erreur création fournisseur',
    async (supplier: Partial<AchatsSupplier>) => {
      const { error } = await supabase.from('achats_suppliers').insert(supplier as never);
      if (error) throw error;
    }
  );
}

export function useUpdateSupplier() {
  return useCrudMutation(
    invalidateKeys,
    'Fournisseur mis à jour',
    'Erreur mise à jour fournisseur',
    async (payload: { id: string; supplier: Partial<AchatsSupplier> }) => {
      const { error } = await supabase.from('achats_suppliers').update(payload.supplier as never).eq('id', payload.id);
      if (error) throw error;
    }
  );
}

export function useDeleteSupplier() {
  return useCrudMutation(
    invalidateKeys,
    'Fournisseur archivé',
    'Erreur archivage fournisseur',
    async (id: string) => {
      const { error } = await supabase
        .from('achats_suppliers')
        .update({ deleted_at: new Date().toISOString(), is_active: false } as never)
        .eq('id', id);
      if (error) throw error;
    }
  );
}

export function usePurchaseRequests() {
  return useQuery({
    queryKey: ['achats_purchase_requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('achats_purchase_requests')
        .select('*, items:achats_purchase_request_items(*)')
        .is('deleted_at', null)
        .order('request_date', { ascending: false });
      if (error) throw error;
      return (data || []) as PurchaseRequest[];
    },
  });
}

export function usePurchaseRequestsPaged(page: number, pageSize: number) {
  return useQuery({
    queryKey: ['achats_purchase_requests_paged', page, pageSize],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, count, error } = await supabase
        .from('achats_purchase_requests')
        .select('*', { count: 'exact' })
        .is('deleted_at', null)
        .order('request_date', { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { data: (data || []) as PurchaseRequest[], count: count ?? (data?.length || 0) };
    },
    placeholderData: (prev) => prev,
    staleTime: 60000,
  });
}

export function useCreatePurchaseRequest() {
  return useCrudMutation(
    invalidateKeys,
    'Demande d’achat créée',
    'Erreur création demande',
    async (payload: { request: Partial<PurchaseRequest>; items: Omit<PurchaseRequestItem, 'id' | 'request_id' | 'created_at'>[] }) => {
      const { data, error } = await supabase.from('achats_purchase_requests').insert(payload.request as never).select().single();
      if (error) throw error;
      if (payload.items.length) {
        const items = payload.items.map((item) => ({ ...item, request_id: data.id }));
        const { error: itemsError } = await supabase.from('achats_purchase_request_items').insert(items as never);
        if (itemsError) throw itemsError;
      }
      return data;
    }
  );
}

export function useUpdatePurchaseRequest() {
  return useCrudMutation(
    invalidateKeys,
    'Demande d’achat mise à jour',
    'Erreur mise à jour demande',
    async (payload: { id: string; request: Partial<PurchaseRequest>; items: Omit<PurchaseRequestItem, 'id' | 'request_id' | 'created_at'>[] }) => {
      const { data, error } = await supabase
        .from('achats_purchase_requests')
        .update(payload.request as never)
        .eq('id', payload.id)
        .is('deleted_at', null)
        .select()
        .single();
      if (error) throw error;
      const { error: deleteError } = await supabase.from('achats_purchase_request_items').delete().eq('request_id', payload.id);
      if (deleteError) throw deleteError;
      if (payload.items.length) {
        const items = payload.items.map((item) => ({ ...item, request_id: payload.id }));
        const { error: itemsError } = await supabase.from('achats_purchase_request_items').insert(items as never);
        if (itemsError) throw itemsError;
      }
      return data;
    }
  );
}

export function useBulkUpdatePurchaseRequestsStatus() {
  return useCrudMutation(
    invalidateKeys,
    'Statut des demandes mis à jour',
    'Erreur mise à jour groupée des demandes',
    async (payload: { ids: string[]; status: string }) => {
      if (!payload.ids.length) return;
      const { error } = await supabase
        .from('achats_purchase_requests')
        .update({ status: payload.status } as never)
        .in('id', payload.ids)
        .is('deleted_at', null);
      if (error) throw error;
    }
  );
}

export function useDeletePurchaseRequest() {
  return useCrudMutation(
    invalidateKeys,
    'Demande d’achat archivée',
    'Erreur archivage demande',
    async (id: string) => {
      const { error } = await supabase
        .from('achats_purchase_requests')
        .update({ deleted_at: new Date().toISOString() } as never)
        .eq('id', id);
      if (error) throw error;
    }
  );
}

export function usePurchaseOrders() {
  return useQuery({
    queryKey: ['achats_purchase_orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('achats_purchase_orders')
        .select('*, items:achats_purchase_order_items(*)')
        .is('deleted_at', null)
        .order('order_date', { ascending: false });
      if (error) throw error;
      return (data || []) as PurchaseOrder[];
    },
  });
}

export function usePurchaseOrdersPaged(page: number, pageSize: number) {
  return useQuery({
    queryKey: ['achats_purchase_orders_paged', page, pageSize],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, count, error } = await supabase
        .from('achats_purchase_orders')
        .select('*', { count: 'exact' })
        .is('deleted_at', null)
        .order('order_date', { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { data: (data || []) as PurchaseOrder[], count: count ?? (data?.length || 0) };
    },
    placeholderData: (prev) => prev,
    staleTime: 60000,
  });
}

export function useCreatePurchaseOrder() {
  return useCrudMutation(
    invalidateKeys,
    'Bon de commande créé',
    'Erreur création bon',
    async (payload: { order: Partial<PurchaseOrder>; items: Omit<PurchaseOrderItem, 'id' | 'order_id' | 'created_at'>[] }) => {
      const { data, error } = await supabase.from('achats_purchase_orders').insert(payload.order as never).select().single();
      if (error) throw error;
      if (payload.items.length) {
        const items = payload.items.map((item) => ({ ...item, order_id: data.id }));
        const { error: itemsError } = await supabase.from('achats_purchase_order_items').insert(items as never);
        if (itemsError) throw itemsError;
      }
      return data;
    }
  );
}

export function useUpdatePurchaseOrder() {
  return useCrudMutation(
    invalidateKeys,
    'Bon de commande mis à jour',
    'Erreur mise à jour bon',
    async (payload: { id: string; order: Partial<PurchaseOrder>; items: Omit<PurchaseOrderItem, 'id' | 'order_id' | 'created_at'>[] }) => {
      const { data, error } = await supabase
        .from('achats_purchase_orders')
        .update(payload.order as never)
        .eq('id', payload.id)
        .is('deleted_at', null)
        .select()
        .single();
      if (error) throw error;
      const { error: deleteError } = await supabase.from('achats_purchase_order_items').delete().eq('order_id', payload.id);
      if (deleteError) throw deleteError;
      if (payload.items.length) {
        const items = payload.items.map((item) => ({ ...item, order_id: payload.id }));
        const { error: itemsError } = await supabase.from('achats_purchase_order_items').insert(items as never);
        if (itemsError) throw itemsError;
      }
      return data;
    }
  );
}

export function useBulkUpdatePurchaseOrdersStatus() {
  return useCrudMutation(
    invalidateKeys,
    'Statut des commandes mis à jour',
    'Erreur mise à jour groupée des commandes',
    async (payload: { ids: string[]; status: string }) => {
      if (!payload.ids.length) return;
      const { error } = await supabase
        .from('achats_purchase_orders')
        .update({ status: payload.status } as never)
        .in('id', payload.ids)
        .is('deleted_at', null);
      if (error) throw error;
    }
  );
}

export function useDeletePurchaseOrder() {
  return useCrudMutation(
    invalidateKeys,
    'Bon de commande archivé',
    'Erreur archivage bon',
    async (id: string) => {
      const { error } = await supabase
        .from('achats_purchase_orders')
        .update({ deleted_at: new Date().toISOString() } as never)
        .eq('id', id);
      if (error) throw error;
    }
  );
}

export function useDeliveryNotes() {
  return useQuery({
    queryKey: ['achats_delivery_notes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('achats_delivery_notes')
        .select('*, items:achats_delivery_note_items(*)')
        .is('deleted_at', null)
        .order('delivery_date', { ascending: false });
      if (error) throw error;
      return (data || []) as DeliveryNote[];
    },
  });
}

export function useDeliveryNotesPaged(page: number, pageSize: number) {
  return useQuery({
    queryKey: ['achats_delivery_notes_paged', page, pageSize],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, count, error } = await supabase
        .from('achats_delivery_notes')
        .select('*', { count: 'exact' })
        .is('deleted_at', null)
        .order('delivery_date', { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { data: (data || []) as DeliveryNote[], count: count ?? (data?.length || 0) };
    },
    placeholderData: (prev) => prev,
    staleTime: 60000,
  });
}

export function useCreateDeliveryNote() {
  return useCrudMutation(
    invalidateKeys,
    'Bon de livraison créé',
    'Erreur création bon de livraison',
    async (payload: { note: Partial<DeliveryNote>; items: Omit<DeliveryNoteItem, 'id' | 'delivery_id' | 'created_at'>[] }) => {
      const { data, error } = await supabase.from('achats_delivery_notes').insert(payload.note as never).select().single();
      if (error) throw error;
      if (payload.items.length) {
        const items = payload.items.map((item) => ({ ...item, delivery_id: data.id }));
        const { error: itemsError } = await supabase.from('achats_delivery_note_items').insert(items as never);
        if (itemsError) throw itemsError;
      }
      return data;
    }
  );
}

export function useUpdateDeliveryNote() {
  return useCrudMutation(
    invalidateKeys,
    'Bon de livraison mis à jour',
    'Erreur mise à jour bon de livraison',
    async (payload: { id: string; note: Partial<DeliveryNote>; items: Omit<DeliveryNoteItem, 'id' | 'delivery_id' | 'created_at'>[] }) => {
      const { data, error } = await supabase
        .from('achats_delivery_notes')
        .update(payload.note as never)
        .eq('id', payload.id)
        .is('deleted_at', null)
        .select()
        .single();
      if (error) throw error;
      const { error: deleteError } = await supabase.from('achats_delivery_note_items').delete().eq('delivery_id', payload.id);
      if (deleteError) throw deleteError;
      if (payload.items.length) {
        const items = payload.items.map((item) => ({ ...item, delivery_id: payload.id }));
        const { error: itemsError } = await supabase.from('achats_delivery_note_items').insert(items as never);
        if (itemsError) throw itemsError;
      }
      return data;
    }
  );
}

export function useBulkUpdateDeliveryNotesStatus() {
  return useCrudMutation(
    invalidateKeys,
    'Statut des livraisons mis à jour',
    'Erreur mise à jour groupée des livraisons',
    async (payload: { ids: string[]; status: string }) => {
      if (!payload.ids.length) return;
      const { error } = await supabase
        .from('achats_delivery_notes')
        .update({ status: payload.status } as never)
        .in('id', payload.ids)
        .is('deleted_at', null);
      if (error) throw error;
    }
  );
}

export function useDeleteDeliveryNote() {
  return useCrudMutation(
    invalidateKeys,
    'Bon de livraison archivé',
    'Erreur archivage bon de livraison',
    async (id: string) => {
      const { error } = await supabase
        .from('achats_delivery_notes')
        .update({ deleted_at: new Date().toISOString() } as never)
        .eq('id', id);
      if (error) throw error;
    }
  );
}

export function useSupplierInvoices() {
  return useQuery({
    queryKey: ['achats_supplier_invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('achats_supplier_invoices')
        .select('*, items:achats_supplier_invoice_items(*)')
        .is('deleted_at', null)
        .order('invoice_date', { ascending: false });
      if (error) throw error;
      return (data || []) as SupplierInvoice[];
    },
  });
}

export function useSupplierInvoicesPaged(page: number, pageSize: number) {
  return useQuery({
    queryKey: ['achats_supplier_invoices_paged', page, pageSize],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, count, error } = await supabase
        .from('achats_supplier_invoices')
        .select('*', { count: 'exact' })
        .is('deleted_at', null)
        .order('invoice_date', { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { data: (data || []) as SupplierInvoice[], count: count ?? (data?.length || 0) };
    },
    placeholderData: (prev) => prev,
    staleTime: 60000,
  });
}

export function usePurchaseRequestItems(requestId: string | null) {
  return useQuery({
    queryKey: ['achats_purchase_request_items', requestId],
    enabled: !!requestId,
    queryFn: async () => {
      const { data, error } = await supabase.from('achats_purchase_request_items').select('*').eq('request_id', requestId);
      if (error) throw error;
      return (data || []) as PurchaseRequestItem[];
    },
  });
}

export function usePurchaseOrderItems(orderId: string | null) {
  return useQuery({
    queryKey: ['achats_purchase_order_items', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase.from('achats_purchase_order_items').select('*').eq('order_id', orderId);
      if (error) throw error;
      return (data || []) as PurchaseOrderItem[];
    },
  });
}

export function useDeliveryNoteItems(deliveryId: string | null) {
  return useQuery({
    queryKey: ['achats_delivery_note_items', deliveryId],
    enabled: !!deliveryId,
    queryFn: async () => {
      const { data, error } = await supabase.from('achats_delivery_note_items').select('*').eq('delivery_id', deliveryId);
      if (error) throw error;
      return (data || []) as DeliveryNoteItem[];
    },
  });
}

export function useSupplierInvoiceItems(invoiceId: string | null) {
  return useQuery({
    queryKey: ['achats_supplier_invoice_items', invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase.from('achats_supplier_invoice_items').select('*').eq('invoice_id', invoiceId);
      if (error) throw error;
      return (data || []) as SupplierInvoiceItem[];
    },
  });
}

export function useCreateSupplierInvoice() {
  return useCrudMutation(
    invalidateKeys,
    'Facture fournisseur créée',
    'Erreur création facture',
    async (payload: { invoice: Partial<SupplierInvoice>; items: Omit<SupplierInvoiceItem, 'id' | 'invoice_id' | 'created_at'>[] }) => {
      const { data, error } = await supabase.from('achats_supplier_invoices').insert(payload.invoice as never).select().single();
      if (error) throw error;
      if (payload.items.length) {
        const items = payload.items.map((item) => ({ ...item, invoice_id: data.id }));
        const { error: itemsError } = await supabase.from('achats_supplier_invoice_items').insert(items as never);
        if (itemsError) throw itemsError;
      }
      return data;
    }
  );
}

export function useUpdateSupplierInvoice() {
  return useCrudMutation(
    invalidateKeys,
    'Facture fournisseur mise à jour',
    'Erreur mise à jour facture',
    async (payload: { id: string; invoice: Partial<SupplierInvoice>; items: Omit<SupplierInvoiceItem, 'id' | 'invoice_id' | 'created_at'>[] }) => {
      const { data, error } = await supabase
        .from('achats_supplier_invoices')
        .update(payload.invoice as never)
        .eq('id', payload.id)
        .is('deleted_at', null)
        .select()
        .single();
      if (error) throw error;
      const { error: deleteError } = await supabase.from('achats_supplier_invoice_items').delete().eq('invoice_id', payload.id);
      if (deleteError) throw deleteError;
      if (payload.items.length) {
        const items = payload.items.map((item) => ({ ...item, invoice_id: payload.id }));
        const { error: itemsError } = await supabase.from('achats_supplier_invoice_items').insert(items as never);
        if (itemsError) throw itemsError;
      }
      return data;
    }
  );
}

export function useBulkUpdateSupplierInvoicesStatus() {
  return useCrudMutation(
    invalidateKeys,
    'Statut des factures mis à jour',
    'Erreur mise à jour groupée des factures',
    async (payload: { ids: string[]; status: string }) => {
      if (!payload.ids.length) return;
      const { error } = await supabase
        .from('achats_supplier_invoices')
        .update({ status: payload.status } as never)
        .in('id', payload.ids)
        .is('deleted_at', null);
      if (error) throw error;
    }
  );
}

export function useDeleteSupplierInvoice() {
  return useCrudMutation(
    invalidateKeys,
    'Facture fournisseur archivée',
    'Erreur archivage facture',
    async (id: string) => {
      const { error } = await supabase
        .from('achats_supplier_invoices')
        .update({ deleted_at: new Date().toISOString() } as never)
        .eq('id', id);
      if (error) throw error;
    }
  );
}

export function useAchatsAlerts() {
  return useQuery({
    queryKey: ['achats_alerts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('achats_alerts').select('*');
      if (error) throw error;
      return (data || []) as AchatsAlert[];
    },
    staleTime: 60000,
  });
}

export function useAchatsCashForecast() {
  return useQuery({
    queryKey: ['achats_cash_forecast'],
    queryFn: async () => {
      const { data, error } = await supabase.from('achats_cash_forecast').select('*').order('horizon');
      if (error) throw error;
      return (data || []) as CashForecastItem[];
    },
    staleTime: 60000,
  });
}

export function useSubmitPurchaseRequest() {
  return useCrudMutation(
    invalidateKeys,
    'Demande soumise',
    'Erreur soumission demande',
    async (id: string) => {
      const { error } = await supabase
        .from('achats_purchase_requests')
        .update({ status: 'submitted' } as never)
        .eq('id', id)
        .is('deleted_at', null);
      if (error) throw error;
    }
  );
}

export function useApprovePurchaseRequest() {
  return useCrudMutation(
    invalidateKeys,
    'Demande approuvée',
    'Erreur approbation demande',
    async (id: string) => {
      const { error } = await supabase
        .from('achats_purchase_requests')
        .update({ status: 'approved' } as never)
        .eq('id', id)
        .is('deleted_at', null);
      if (error) throw error;
    }
  );
}

export function useRejectPurchaseRequest() {
  return useCrudMutation(
    invalidateKeys,
    'Demande rejetée',
    'Erreur rejet demande',
    async (id: string) => {
      const { error } = await supabase
        .from('achats_purchase_requests')
        .update({ status: 'rejected' } as never)
        .eq('id', id)
        .is('deleted_at', null);
      if (error) throw error;
    }
  );
}

export function useSubmitPurchaseOrder() {
  return useCrudMutation(
    invalidateKeys,
    'Commande soumise',
    'Erreur soumission commande',
    async (id: string) => {
      const { error } = await supabase
        .from('achats_purchase_orders')
        .update({ status: 'submitted' } as never)
        .eq('id', id)
        .is('deleted_at', null);
      if (error) throw error;
    }
  );
}

export function useApprovePurchaseOrder() {
  return useCrudMutation(
    invalidateKeys,
    'Commande approuvée',
    'Erreur approbation commande',
    async (id: string) => {
      const { error } = await supabase
        .from('achats_purchase_orders')
        .update({ status: 'approved' } as never)
        .eq('id', id)
        .is('deleted_at', null);
      if (error) throw error;
    }
  );
}

export function useRejectPurchaseOrder() {
  return useCrudMutation(
    invalidateKeys,
    'Commande rejetée',
    'Erreur rejet commande',
    async (id: string) => {
      const { error } = await supabase
        .from('achats_purchase_orders')
        .update({ status: 'rejected' } as never)
        .eq('id', id)
        .is('deleted_at', null);
      if (error) throw error;
    }
  );
}

export function useMarkDeliveryReceived() {
  return useCrudMutation(
    invalidateKeys,
    'Livraison réceptionnée',
    'Erreur mise à jour livraison',
    async (id: string) => {
      const { error } = await supabase
        .from('achats_delivery_notes')
        .update({ status: 'received' } as never)
        .eq('id', id)
        .is('deleted_at', null);
      if (error) throw error;
    }
  );
}

export function useMarkInvoicePaid() {
  return useCrudMutation(
    invalidateKeys,
    'Facture marquée payée',
    'Erreur paiement facture',
    async (id: string) => {
      const { error } = await supabase
        .from('achats_supplier_invoices')
        .update({ status: 'paid' } as never)
        .eq('id', id)
        .is('deleted_at', null);
      if (error) throw error;
    }
  );
}

export function useAchatsDashboardKpis() {
  return useQuery({
    queryKey: ['achats_dashboard_kpis'],
    queryFn: async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStartIso = monthStart.toISOString().split('T')[0];
      const todayIso = new Date().toISOString().split('T')[0];

      const [{ data: monthInvoices, error: monthErr }, { data: overdueInvoices, error: overdueErr }, { data: paidInvoices, error: paidErr }] =
        await Promise.all([
          supabase
            .from('achats_supplier_invoices')
            .select('total_amount')
            .is('deleted_at', null)
            .gte('invoice_date', monthStartIso)
            .lte('invoice_date', todayIso),
          supabase
            .from('achats_supplier_invoices')
            .select('id', { count: 'exact' })
            .is('deleted_at', null)
            .eq('status', 'overdue'),
          supabase
            .from('achats_supplier_invoices')
            .select('invoice_date, due_date')
            .is('deleted_at', null)
            .eq('status', 'paid')
            .not('due_date', 'is', null),
        ]);

      if (monthErr) throw monthErr;
      if (overdueErr) throw overdueErr;
      if (paidErr) throw paidErr;

      const monthlyPurchases = (monthInvoices || []).reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0);
      const totalInvoicesCount = monthInvoices?.length || 0;
      const overdueCount = overdueInvoices?.length || 0;
      const overdueInvoiceRate = totalInvoicesCount ? (overdueCount / totalInvoicesCount) * 100 : 0;
      const avgDelay =
        (paidInvoices || []).reduce((sum, invoice) => {
          const due = invoice.due_date ? new Date(invoice.due_date).getTime() : 0;
          const paidDate = new Date(invoice.invoice_date).getTime();
          if (!due) return sum;
          const diffDays = Math.max(0, Math.round((paidDate - due) / (1000 * 60 * 60 * 24)));
          return sum + diffDays;
        }, 0) / Math.max(1, (paidInvoices || []).length);

      return {
        monthlyPurchases,
        overdueInvoiceRate,
        averagePaymentDelayDays: Number.isFinite(avgDelay) ? avgDelay : 0,
      } as AchatsKpis;
    },
    staleTime: 60000,
  });
}

export function useAchatsTopSuppliers() {
  return useQuery({
    queryKey: ['achats_top_suppliers'],
    queryFn: async () => {
      const { data: invoices, error: invErr } = await supabase
        .from('achats_supplier_invoices')
        .select('supplier_id, supplier_name, total_amount')
        .is('deleted_at', null);
      if (invErr) throw invErr;

      const { data: suppliers, error: supErr } = await supabase
        .from('achats_suppliers')
        .select('id, legal_name, quality_score, delay_score')
        .is('deleted_at', null);
      if (supErr) throw supErr;

      const { data: delayedOrders, error: delErr } = await supabase
        .from('achats_purchase_orders')
        .select('supplier_id, expected_delivery_date, status')
        .is('deleted_at', null)
        .in('status', ['approved', 'sent']);
      if (delErr) throw delErr;

      const suppliersMap = new Map(
        (suppliers || []).map((supplier) => [
          supplier.id,
          {
            legal_name: supplier.legal_name,
            quality_score: Number(supplier.quality_score || 0),
            delay_score: Number(supplier.delay_score || 0),
          },
        ])
      );

      const delayCounter = new Map<string, number>();
      (delayedOrders || []).forEach((order) => {
        if (!order.supplier_id || !order.expected_delivery_date) return;
        if (new Date(order.expected_delivery_date) < new Date()) {
          delayCounter.set(order.supplier_id, (delayCounter.get(order.supplier_id) || 0) + 1);
        }
      });

      const aggregate = new Map<string, TopSupplier>();
      (invoices || []).forEach((invoice) => {
        const key = invoice.supplier_id || invoice.supplier_name || 'unknown';
        const existing = aggregate.get(key);
        const supplierData = invoice.supplier_id ? suppliersMap.get(invoice.supplier_id) : null;
        const supplierName = invoice.supplier_name || supplierData?.legal_name || 'Fournisseur';
        if (existing) {
          existing.volume += Number(invoice.total_amount || 0);
          return;
        }
        aggregate.set(key, {
          supplierId: invoice.supplier_id || null,
          supplierName,
          volume: Number(invoice.total_amount || 0),
          qualityScore: supplierData?.quality_score || 0,
          delayScore: supplierData?.delay_score || 0,
          delayCount: invoice.supplier_id ? delayCounter.get(invoice.supplier_id) || 0 : 0,
        });
      });

      return Array.from(aggregate.values())
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 5);
    },
    staleTime: 60000,
  });
}
