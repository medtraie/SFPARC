import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type FactDocumentType = 'devis' | 'bon_commande' | 'bon_livraison' | 'facture';
export type FactTemplateType = 'classic' | 'modern' | 'minimalist' | 'creative';
export type FactDirection = 'ltr' | 'rtl';
export type FactLanguage = 'fr' | 'ar';

export interface FactDocument {
  id: string;
  doc_type: FactDocumentType;
  doc_number: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  currency: string;
  language: FactLanguage;
  direction: FactDirection;
  template_type: FactTemplateType;
  show_header: boolean;
  show_footer: boolean;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  seller_snapshot: Record<string, unknown>;
  custom_columns: string[];
  notes: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  source_document_id: string | null;
  root_document_id: string | null;
  sent_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FactDocumentItem {
  id: string;
  document_id: string;
  line_order: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_rate: number;
  tax_rate: number;
  line_subtotal: number;
  line_tax_amount: number;
  line_total: number;
  extra_fields: Record<string, string>;
}

export interface FactDocumentEvent {
  id: string;
  document_id: string;
  event_type: string;
  event_label: string;
  event_payload: unknown;
  created_by: string | null;
  created_at: string;
}

export interface FactQuickStats {
  pending_devis_amount: number;
  bl_not_invoiced_count: number;
  unpaid_invoices_count: number;
  unpaid_invoices_amount: number;
}

const FACT_DOCS_KEY = ['fact-documents'];
const FACT_DOC_DETAILS_KEY = ['fact-document-details'];
const FACT_STATS_KEY = ['fact-quick-stats'];

async function fetchFactDocuments(): Promise<FactDocument[]> {
  const { data, error } = await supabase
    .from('fact_documents')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as FactDocument[];
}

async function fetchFactDocumentDetails(documentId: string): Promise<{
  document: FactDocument | null;
  items: FactDocumentItem[];
  events: FactDocumentEvent[];
}> {
  const [docRes, itemsRes, eventsRes] = await Promise.all([
    supabase.from('fact_documents').select('*').eq('id', documentId).maybeSingle(),
    supabase.from('fact_document_items').select('*').eq('document_id', documentId).order('line_order', { ascending: true }),
    supabase.from('fact_document_events').select('*').eq('document_id', documentId).order('created_at', { ascending: false }),
  ]);
  if (docRes.error) throw docRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (eventsRes.error) throw eventsRes.error;
  return {
    document: (docRes.data as FactDocument) || null,
    items: (itemsRes.data || []) as FactDocumentItem[],
    events: (eventsRes.data || []) as FactDocumentEvent[],
  };
}

async function fetchQuickStats(): Promise<FactQuickStats> {
  const { data, error } = await supabase.rpc('fact_get_quick_stats');
  if (error) throw error;
  return ((data as FactQuickStats[])?.[0] || {
    pending_devis_amount: 0,
    bl_not_invoiced_count: 0,
    unpaid_invoices_count: 0,
    unpaid_invoices_amount: 0,
  }) as FactQuickStats;
}

async function createFactDocument(payload: {
  doc_type: FactDocumentType;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  client_address?: string;
  issue_date?: string;
  due_date?: string;
  template_type?: FactTemplateType;
  language?: FactLanguage;
  direction?: FactDirection;
  show_header?: boolean;
  show_footer?: boolean;
  notes?: string;
  custom_columns?: string[];
  source_document_id?: string | null;
}) {
  const { data, error } = await supabase.rpc('fact_create_document', {
    p_doc_type: payload.doc_type,
    p_client_name: payload.client_name,
    p_client_email: payload.client_email ?? null,
    p_client_phone: payload.client_phone ?? null,
    p_client_address: payload.client_address ?? null,
    p_issue_date: payload.issue_date ?? null,
    p_due_date: payload.due_date ?? null,
    p_template_type: payload.template_type ?? 'classic',
    p_language: payload.language ?? 'fr',
    p_direction: payload.direction ?? (payload.language === 'ar' ? 'rtl' : 'ltr'),
    p_show_header: payload.show_header ?? true,
    p_show_footer: payload.show_footer ?? true,
    p_notes: payload.notes ?? null,
    p_custom_columns: payload.custom_columns ?? [],
    p_source_document_id: payload.source_document_id ?? null,
  });
  if (error) throw error;
  return data as FactDocument;
}

async function convertFactDocument(payload: { source_document_id: string; target_doc_type: FactDocumentType }) {
  const { data, error } = await supabase.rpc('fact_convert_document', {
    p_source_document_id: payload.source_document_id,
    p_target_doc_type: payload.target_doc_type,
  });
  if (!error) return data as FactDocument;

  // Fallback path: if DB convert RPC is out-of-sync, convert client-side
  // while preserving application behavior (same target type + copied lines).
  const { data: sourceDoc, error: sourceDocError } = await supabase
    .from('fact_documents')
    .select('*')
    .eq('id', payload.source_document_id)
    .maybeSingle();
  if (sourceDocError) throw sourceDocError;
  if (!sourceDoc) throw error;

  const created = await createFactDocument({
    doc_type: payload.target_doc_type,
    client_name: sourceDoc.client_name,
    client_email: sourceDoc.client_email ?? undefined,
    client_phone: sourceDoc.client_phone ?? undefined,
    client_address: sourceDoc.client_address ?? undefined,
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: sourceDoc.due_date ?? undefined,
    template_type: sourceDoc.template_type,
    language: sourceDoc.language,
    direction: sourceDoc.direction,
    show_header: sourceDoc.show_header,
    show_footer: sourceDoc.show_footer,
    notes: sourceDoc.notes ?? undefined,
    custom_columns: sourceDoc.custom_columns ?? [],
    source_document_id: sourceDoc.id,
  });

  const { data: sourceItems, error: sourceItemsError } = await supabase
    .from('fact_document_items')
    .select('*')
    .eq('document_id', sourceDoc.id)
    .order('line_order', { ascending: true });
  if (sourceItemsError) throw sourceItemsError;

  await replaceFactDocumentItems({
    documentId: created.id,
    items: ((sourceItems || []) as FactDocumentItem[]).map((item) => ({
      line_order: item.line_order,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      discount_rate: item.discount_rate,
      tax_rate: item.tax_rate,
      extra_fields: item.extra_fields,
    })),
  });

  return created as FactDocument;
}

async function upsertFactDocument(payload: Partial<FactDocument> & { id: string }) {
  const { error } = await supabase
    .from('fact_documents')
    .update({
      status: payload.status,
      due_date: payload.due_date,
      language: payload.language,
      direction: payload.direction,
      template_type: payload.template_type,
      show_header: payload.show_header,
      show_footer: payload.show_footer,
      client_name: payload.client_name,
      client_email: payload.client_email,
      client_phone: payload.client_phone,
      client_address: payload.client_address,
      custom_columns: payload.custom_columns,
      notes: payload.notes,
      tax_rate: payload.tax_rate,
      discount_amount: payload.discount_amount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payload.id);
  if (error) throw error;
  const { data: recomputed, error: recomputeError } = await supabase.rpc('fact_recompute_totals', { p_document_id: payload.id });
  if (recomputeError) throw recomputeError;
  return recomputed as FactDocument;
}

async function replaceFactDocumentItems(payload: { documentId: string; items: Array<Partial<FactDocumentItem>> }) {
  const { error: delError } = await supabase.from('fact_document_items').delete().eq('document_id', payload.documentId);
  if (delError) throw delError;
  if (payload.items.length > 0) {
    const { error: insError } = await supabase.from('fact_document_items').insert(
      payload.items.map((item, index) => ({
        document_id: payload.documentId,
        line_order: item.line_order ?? index + 1,
        description: item.description || '',
        quantity: Number(item.quantity ?? 1),
        unit: item.unit || 'u',
        unit_price: Number(item.unit_price ?? 0),
        discount_rate: Number(item.discount_rate ?? 0),
        tax_rate: Number(item.tax_rate ?? 20),
        extra_fields: item.extra_fields ?? {},
      }))
    );
    if (insError) throw insError;
  }
  const { data: recomputed, error: recomputeError } = await supabase.rpc('fact_recompute_totals', { p_document_id: payload.documentId });
  if (recomputeError) throw recomputeError;
  return recomputed as FactDocument;
}

async function createFactDocumentEvent(payload: {
  document_id: string;
  event_type: string;
  event_label: string;
  event_payload?: unknown;
}) {
  const { error } = await supabase.from('fact_document_events').insert({
    document_id: payload.document_id,
    event_type: payload.event_type,
    event_label: payload.event_label,
    event_payload: payload.event_payload ?? null,
  });
  if (error) throw error;
}

async function sendFactDocumentEmail(payload: {
  document_id: string;
  to: string;
  subject: string;
  body: string;
}) {
  const { data: queued, error: queueError } = await supabase.rpc('fact_queue_delivery', {
    p_document_id: payload.document_id,
    p_channel: 'email',
    p_recipient: payload.to,
    p_subject: payload.subject,
    p_message_body: payload.body,
  });
  if (queueError) throw queueError;

  const deliveryId = (queued as { id?: string } | null)?.id;
  if (!deliveryId) throw new Error('Unable to queue email delivery');

  const { data: invokeResult, error: invokeError } = await supabase.functions.invoke('fact-delivery-send', {
    body: { delivery_id: deliveryId },
  });

  if (invokeError || invokeResult?.error) {
    await supabase
      .from('fact_delivery_logs')
      .update({
        status: 'failed',
        error_message: invokeError?.message || invokeResult?.error || 'Edge function error',
        processed_at: new Date().toISOString(),
      })
      .eq('id', deliveryId);

    await createFactDocumentEvent({
      document_id: payload.document_id,
      event_type: 'delivery_failed',
      event_label: 'Échec envoi Email',
      event_payload: {
        delivery_id: deliveryId,
        channel: 'email',
        status: 'failed',
        error: invokeError?.message || invokeResult?.error || 'Edge function error',
      },
    });
    throw new Error(invokeError?.message || invokeResult?.error || 'Email delivery failed');
  }
}

async function sendFactDocumentWhatsApp(payload: {
  document_id: string;
  to: string;
  body: string;
}) {
  const { data: queued, error: queueError } = await supabase.rpc('fact_queue_delivery', {
    p_document_id: payload.document_id,
    p_channel: 'whatsapp',
    p_recipient: payload.to,
    p_subject: null,
    p_message_body: payload.body,
  });
  if (queueError) throw queueError;

  const deliveryId = (queued as { id?: string } | null)?.id;
  if (!deliveryId) throw new Error('Unable to queue WhatsApp delivery');

  const { data: invokeResult, error: invokeError } = await supabase.functions.invoke('fact-delivery-send', {
    body: { delivery_id: deliveryId },
  });

  if (invokeError || invokeResult?.error) {
    await supabase
      .from('fact_delivery_logs')
      .update({
        status: 'failed',
        error_message: invokeError?.message || invokeResult?.error || 'Edge function error',
        processed_at: new Date().toISOString(),
      })
      .eq('id', deliveryId);

    await createFactDocumentEvent({
      document_id: payload.document_id,
      event_type: 'delivery_failed',
      event_label: 'Échec envoi WhatsApp',
      event_payload: {
        delivery_id: deliveryId,
        channel: 'whatsapp',
        status: 'failed',
        error: invokeError?.message || invokeResult?.error || 'Edge function error',
      },
    });
    throw new Error(invokeError?.message || invokeResult?.error || 'WhatsApp delivery failed');
  }
}

export function useFactDocuments() {
  return useQuery({
    queryKey: FACT_DOCS_KEY,
    queryFn: fetchFactDocuments,
    staleTime: 15000,
  });
}

export function useFactDocumentDetails(documentId?: string) {
  return useQuery({
    queryKey: [...FACT_DOC_DETAILS_KEY, documentId || 'none'],
    queryFn: () => fetchFactDocumentDetails(documentId!),
    enabled: !!documentId,
    staleTime: 5000,
  });
}

export function useFactQuickStats() {
  return useQuery({
    queryKey: FACT_STATS_KEY,
    queryFn: fetchQuickStats,
    staleTime: 10000,
  });
}

export function useCreateFactDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createFactDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FACT_DOCS_KEY });
      queryClient.invalidateQueries({ queryKey: FACT_STATS_KEY });
      toast({ title: 'Succès', description: 'Document créé.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useConvertFactDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: convertFactDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FACT_DOCS_KEY });
      queryClient.invalidateQueries({ queryKey: FACT_STATS_KEY });
      toast({ title: 'Succès', description: 'Document converti.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateFactDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: upsertFactDocument,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: FACT_DOCS_KEY });
      queryClient.invalidateQueries({ queryKey: [...FACT_DOC_DETAILS_KEY, vars.id] });
      queryClient.invalidateQueries({ queryKey: FACT_STATS_KEY });
      toast({ title: 'Succès', description: 'Document mis à jour.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useReplaceFactDocumentItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: replaceFactDocumentItems,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: FACT_DOCS_KEY });
      queryClient.invalidateQueries({ queryKey: [...FACT_DOC_DETAILS_KEY, vars.documentId] });
      queryClient.invalidateQueries({ queryKey: FACT_STATS_KEY });
      toast({ title: 'Succès', description: 'Lignes mises à jour.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useCreateFactDocumentEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createFactDocumentEvent,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: [...FACT_DOC_DETAILS_KEY, vars.document_id] });
      toast({ title: 'Succès', description: 'Événement timeline enregistré.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useSendFactDocumentEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendFactDocumentEmail,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: FACT_DOCS_KEY });
      queryClient.invalidateQueries({ queryKey: [...FACT_DOC_DETAILS_KEY, vars.document_id] });
      queryClient.invalidateQueries({ queryKey: FACT_STATS_KEY });
      toast({ title: 'Succès', description: 'Statut email enregistré dans timeline.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useSendFactDocumentWhatsApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendFactDocumentWhatsApp,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: FACT_DOCS_KEY });
      queryClient.invalidateQueries({ queryKey: [...FACT_DOC_DETAILS_KEY, vars.document_id] });
      queryClient.invalidateQueries({ queryKey: FACT_STATS_KEY });
      toast({ title: 'Succès', description: 'Statut WhatsApp enregistré dans timeline.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}
