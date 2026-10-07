import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConvertFactDocument, useCreateFactDocument, useCreateFactDocumentEvent, useFactDocumentDetails, useFactDocuments, useReplaceFactDocumentItems, useUpdateFactDocument, type FactDocument, type FactDocumentType } from '@/hooks/useFacturation';
import { ArrowLeft, ArrowRightLeft, Copy, Eye, FileDown, History, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTourismCompanyProfile, useUpsertTourismCompanyProfile } from '@/hooks/useTourismCompany';
import { supabase } from '@/integrations/supabase/client';

type EditableItem = {
  id?: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_rate: number;
  tax_rate: number;
};

const nextTypeMap: Record<FactDocumentType, FactDocumentType | null> = {
  devis: 'bon_commande',
  bon_commande: 'bon_livraison',
  bon_livraison: 'facture',
  facture: null,
};

const paymentWorkflow = [
  { value: 'paid', label: 'Payé' },
  { value: 'unpaid', label: 'Non payé' },
  { value: 'partial', label: 'Partiel' },
] as const;
const docTypeLabels: Record<FactDocumentType, string> = {
  devis: 'Devis',
  bon_commande: 'Commande',
  bon_livraison: 'Livraison',
  facture: 'Facture',
};
const nonInvoiceWorkflow: Record<Exclude<FactDocumentType, 'facture'>, Array<{ value: string; label: string }>> = {
  devis: [
    { value: 'draft', label: 'Brouillon' },
    { value: 'sent', label: 'Envoyé' },
    { value: 'approved', label: 'Accepté' },
    { value: 'rejected', label: 'Refusé' },
  ],
  bon_commande: [
    { value: 'draft', label: 'Brouillon' },
    { value: 'sent', label: 'Envoyée' },
    { value: 'approved', label: 'Confirmée' },
  ],
  bon_livraison: [
    { value: 'draft', label: 'Brouillon' },
    { value: 'sent', label: 'Expédiée' },
    { value: 'delivered', label: 'Livrée' },
  ],
};

const PDF_TEMPLATES = ['classic', 'modern'] as const;
type PdfTemplate = (typeof PDF_TEMPLATES)[number];

const extractClientIceFromNotes = (notesValue: string | null | undefined) => {
  if (!notesValue) return '';
  const match = notesValue.match(/\[ICE_CLIENT:([^\]]+)\]/i);
  return match?.[1]?.trim() || '';
};

const stripIceMarker = (notesValue: string | null | undefined) => {
  if (!notesValue) return '';
  return notesValue.replace(/\n?\[ICE_CLIENT:[^\]]+\]\s*/gi, '').trim();
};

const composeNotesWithIce = (plainNotes: string, clientIce: string) => {
  const cleanedNotes = stripIceMarker(plainNotes);
  const ice = clientIce.trim();
  if (!ice) return cleanedNotes;
  return `${cleanedNotes}${cleanedNotes ? '\n' : ''}[ICE_CLIENT:${ice}]`;
};

const CREDIT_NOTE_MARKER = '[AVOIR_FACTURE]';
const hasCreditNoteMarker = (notesValue: string | null | undefined) =>
  typeof notesValue === 'string' && notesValue.includes(CREDIT_NOTE_MARKER);

const buildAvoirDisplayNumber = (documentId: string, issueDate: string, documents: FactDocument[]) => {
  const targetYear = String(new Date(issueDate).getFullYear());
  const avoirDocs = documents
    .filter((d) => d.doc_type === 'facture' && hasCreditNoteMarker(d.notes))
    .sort((a, b) => {
      const dateDelta = new Date(a.issue_date).getTime() - new Date(b.issue_date).getTime();
      if (dateDelta !== 0) return dateDelta;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  const index = avoirDocs.findIndex((d) => d.id === documentId);
  const sequence = String(index >= 0 ? index + 1 : avoirDocs.length + 1).padStart(5, '0');
  return `AV-${targetYear}-${sequence}`;
};

const UNITS_FR = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
const TEENS_FR = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const TENS_FR = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

const frBelow100 = (n: number): string => {
  if (n < 10) return UNITS_FR[n];
  if (n < 20) return TEENS_FR[n - 10];
  if (n < 70) {
    const ten = Math.floor(n / 10);
    const unit = n % 10;
    if (unit === 1 && ten !== 8) return `${TENS_FR[ten]} et un`;
    return unit === 0 ? TENS_FR[ten] : `${TENS_FR[ten]}-${UNITS_FR[unit]}`;
  }
  if (n < 80) {
    const rem = n - 60;
    return rem === 11 ? 'soixante et onze' : `soixante-${frBelow100(rem)}`;
  }
  const rem = n - 80;
  if (rem === 0) return 'quatre-vingts';
  return `quatre-vingt-${frBelow100(rem)}`;
};

const frBelow1000 = (n: number): string => {
  if (n < 100) return frBelow100(n);
  const hundred = Math.floor(n / 100);
  const rem = n % 100;
  const hundredWord = hundred === 1 ? 'cent' : `${UNITS_FR[hundred]} cent`;
  if (rem === 0) return hundred > 1 ? `${hundredWord}s` : hundredWord;
  return `${hundredWord} ${frBelow100(rem)}`;
};

const numberToFrenchWords = (n: number): string => {
  const value = Math.floor(Math.max(0, n));
  if (value === 0) return 'zéro';
  const millions = Math.floor(value / 1000000);
  const thousands = Math.floor((value % 1000000) / 1000);
  const rest = value % 1000;
  const parts: string[] = [];
  if (millions > 0) parts.push(`${frBelow1000(millions)} ${millions > 1 ? 'millions' : 'million'}`);
  if (thousands > 0) parts.push(thousands === 1 ? 'mille' : `${frBelow1000(thousands)} mille`);
  if (rest > 0) parts.push(frBelow1000(rest));
  return parts.join(' ');
};

import { statusLabels } from './Facturation';

export default function FacturationDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { documentId } = useParams<{ documentId: string }>();
  const { data, isLoading } = useFactDocumentDetails(documentId);
  const { data: docs = [] } = useFactDocuments();
  const { data: company, isLoading: companyLoading } = useTourismCompanyProfile();
  const upsertCompanyProfile = useUpsertTourismCompanyProfile();
  const updateDoc = useUpdateFactDocument();
  const replaceItems = useReplaceFactDocumentItems();
  const convertDoc = useConvertFactDocument();
  const createDoc = useCreateFactDocument();
  const createEvent = useCreateFactDocumentEvent();
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientIce, setClientIce] = useState('');
  const [notes, setNotes] = useState('');
  const [taxRate, setTaxRate] = useState(20);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [status, setStatus] = useState('draft');
  const [timelineInvoiceFilter, setTimelineInvoiceFilter] = useState<'all' | 'paid' | 'unpaid' | 'partial'>('all');
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const [showTimeline, setShowTimeline] = useState(true);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signatureUploading, setSignatureUploading] = useState(false);
  const signatureInputRef = useRef<HTMLInputElement | null>(null);
  const hydratedDocumentIdRef = useRef<string | null>(null);
  const [pdfTemplate, setPdfTemplate] = useState<PdfTemplate>('modern');
  const [partialAmount, setPartialAmount] = useState('');
  const [autoDownloadDone, setAutoDownloadDone] = useState(false);
  const [exportShowHeader, setExportShowHeader] = useState(true);
  const [exportShowFooter, setExportShowFooter] = useState(true);
  const [exportShowSignature, setExportShowSignature] = useState(true);
  const companySignatureUrl = (company as { signature_url?: string | null } | null)?.signature_url || null;
  const inferredClientIce = useMemo(() => {
    const client = (data?.document?.client_name || '').trim().toLowerCase();
    if (!client) return '';
    const match = docs.find(
      (d) =>
        d.id !== data?.document?.id &&
        (d.client_name || '').trim().toLowerCase() === client &&
        extractClientIceFromNotes(d.notes)
    );
    return match ? extractClientIceFromNotes(match.notes) : '';
  }, [docs, data?.document?.id, data?.document?.client_name]);

  useEffect(() => {
    hydratedDocumentIdRef.current = null;
  }, [documentId]);

  useEffect(() => {
    if (!data?.document) return;
    if (hydratedDocumentIdRef.current === data.document.id) return;
    hydratedDocumentIdRef.current = data.document.id;
    setClientName(data.document.client_name || '');
    setClientEmail(data.document.client_email || '');
    setClientPhone(data.document.client_phone || '');
    setClientAddress(data.document.client_address || '');
    setClientIce(extractClientIceFromNotes(data.document.notes) || inferredClientIce);
    setNotes(stripIceMarker(data.document.notes || ''));
    setTaxRate(Number(data.document.tax_rate || 20));
    setDiscountAmount(Number(data.document.discount_amount || 0));
    setStatus(data.document.status || 'draft');
    setExportShowHeader(Boolean(data.document.show_header));
    setExportShowFooter(Boolean(data.document.show_footer));
    setPdfTemplate(
      PDF_TEMPLATES.includes(data.document.template_type as PdfTemplate)
        ? (data.document.template_type as PdfTemplate)
        : 'modern'
    );
    setItems(
      data.items.length > 0
        ? data.items.map((item) => ({
            id: item.id,
            description: item.description || '',
            quantity: Number(item.quantity || 0),
            unit: item.unit || 'u',
            unit_price: Number(item.unit_price || 0),
            discount_rate: Number(item.discount_rate || 0),
            tax_rate: Number(item.tax_rate || 20),
          }))
        : [{ description: '', quantity: 1, unit: 'u', unit_price: 0, discount_rate: 0, tax_rate: 20 }]
    );
  }, [data?.document, data?.items, inferredClientIce, documentId]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((acc, item) => acc + Number(item.quantity || 0) * Number(item.unit_price || 0) * (1 - Number(item.discount_rate || 0) / 100), 0);
    const tax = subtotal * (Number(taxRate || 0) / 100);
    const total = subtotal + tax - Number(discountAmount || 0);
    return { subtotal, tax, total };
  }, [items, taxRate, discountAmount]);

  const currentDocType = data?.document?.doc_type ?? 'facture';
  const isInvoice = currentDocType === 'facture';
  const isCurrentCreditNote =
    currentDocType === 'facture' && hasCreditNoteMarker(data?.document?.notes);
  const currentDocLabel = isCurrentCreditNote ? 'Avoir' : docTypeLabels[currentDocType];
  const workflowSteps = isInvoice ? paymentWorkflow : nonInvoiceWorkflow[currentDocType as Exclude<FactDocumentType, 'facture'>];

  const clientInvoices = useMemo(() => {
    const client = (data?.document?.client_name || '').trim().toLowerCase();
    if (!client) return [];
    const all = docs
      .filter((d) => d.doc_type === currentDocType && (d.client_name || '').trim().toLowerCase() === client)
      .sort((a, b) => new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime());
    if (!isInvoice || timelineInvoiceFilter === 'all') return all;
    return all.filter((d) => d.status === timelineInvoiceFilter);
  }, [docs, data?.document?.client_name, currentDocType, isInvoice, timelineInvoiceFilter]);

  const paymentHistoryRows = useMemo(() => {
    if (!data?.document) return [];
    const total = Number(data.document.total_amount || 0);
    let paidAcc = 0;
    return (data.events || [])
      .filter((event) => event.event_type === 'payment_recorded')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((event) => {
        const payload = event.event_payload as { amount?: number | string } | null;
        const amount = Number(payload?.amount || 0);
        paidAcc += Number.isNaN(amount) ? 0 : amount;
        const remaining = Math.max(0, total - paidAcc);
        return {
          id: event.id,
          label: event.event_label,
          date: event.created_at,
          amount: Number.isNaN(amount) ? 0 : amount,
          remaining,
        };
      });
  }, [data?.document, data?.events]);

  const paymentSummary = useMemo(() => {
    const total = Number(data?.document?.total_amount || 0);
    if (status === 'paid') {
      return { paid: total, remaining: 0, total };
    }
    const paid = paymentHistoryRows.reduce((acc, row) => acc + row.amount, 0);
    return {
      paid,
      remaining: Math.max(0, total - paid),
      total,
    };
  }, [paymentHistoryRows, data?.document?.total_amount, status]);

  const paymentStamp = useMemo(() => {
    if (status === 'paid' || paymentSummary.remaining <= 0.0001) {
      return { label: 'PAYE', className: 'bg-green-600/20 text-green-300 border-green-500/40' };
    }
    if (paymentSummary.paid > 0) {
      return { label: 'PARTIEL', className: 'bg-amber-500/20 text-amber-300 border-amber-400/40' };
    }
    return { label: 'NON PAYE', className: 'bg-red-600/20 text-red-300 border-red-500/40' };
  }, [paymentSummary, status]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const logo = company?.logo_url;
      if (!logo) {
        setLogoDataUrl(null);
        return;
      }
      try {
        let blob: Blob | null = null;

        if (!logo.startsWith('http')) {
          // 1) Most reliable for private storage: direct download via authenticated client.
          const downloadRes = await supabase.storage.from('tourism-assets').download(logo);
          if (!downloadRes.error && downloadRes.data) {
            blob = downloadRes.data;
          } else {
            // 2) Fallback: signed URL
            const signed = await supabase.storage.from('tourism-assets').createSignedUrl(logo, 60 * 10);
            if (!signed.error && signed.data?.signedUrl) {
              const response = await fetch(signed.data.signedUrl);
              if (response.ok) blob = await response.blob();
            }
            // 3) Fallback: public URL
            if (!blob) {
              const publicData = supabase.storage.from('tourism-assets').getPublicUrl(logo);
              if (publicData.data.publicUrl) {
                const response = await fetch(publicData.data.publicUrl);
                if (response.ok) blob = await response.blob();
              }
            }
          }
        } else {
          const response = await fetch(logo);
          if (response.ok) blob = await response.blob();
        }

        if (!blob) throw new Error('Unable to load logo blob');

        // Convert to PNG data URL for maximum jsPDF compatibility (even if source is webp/svg/jpeg)
        const objectUrl = URL.createObjectURL(blob);
        try {
          const pngDataUrl = await new Promise<string>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || img.width || 256;
              canvas.height = img.naturalHeight || img.height || 256;
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                reject(new Error('Canvas context unavailable'));
                return;
              }
              ctx.drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => reject(new Error('Image decode failed'));
            img.src = objectUrl;
          });
          if (!cancelled) setLogoDataUrl(pngDataUrl);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      } catch {
        if (!cancelled) setLogoDataUrl(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [company?.logo_url]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const signature = companySignatureUrl;
      if (!signature) {
        setSignatureDataUrl(null);
        return;
      }
      try {
        let blob: Blob | null = null;
        if (!signature.startsWith('http')) {
          const downloadRes = await supabase.storage.from('tourism-assets').download(signature);
          if (!downloadRes.error && downloadRes.data) {
            blob = downloadRes.data;
          } else {
            const signed = await supabase.storage.from('tourism-assets').createSignedUrl(signature, 60 * 10);
            if (!signed.error && signed.data?.signedUrl) {
              const response = await fetch(signed.data.signedUrl);
              if (response.ok) blob = await response.blob();
            }
          }
        } else {
          const response = await fetch(signature);
          if (response.ok) blob = await response.blob();
        }
        if (!blob) throw new Error('Unable to load signature image');
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        if (!cancelled) setSignatureDataUrl(dataUrl);
      } catch {
        if (!cancelled) setSignatureDataUrl(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [companySignatureUrl]);

  const handleUploadSignatureImage = async (file: File) => {
    if (!file) return;
    setSignatureUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const safeExt = ['png', 'jpg', 'jpeg', 'webp'].includes(ext) ? ext : 'png';
      const path = `facturation/signature-${Date.now()}.${safeExt}`;
      const uploaded = await supabase.storage.from('tourism-assets').upload(path, file, {
        upsert: true,
        contentType: file.type || `image/${safeExt}`,
      });
      if (uploaded.error) throw uploaded.error;

      await upsertCompanyProfile.mutateAsync({
        signature_url: path,
      });

      const localDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      setSignatureDataUrl(localDataUrl);
    } finally {
      setSignatureUploading(false);
    }
  };

  const updateItem = (idx: number, patch: Partial<EditableItem>) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  };

  const buildDocumentPayload = (nextStatus: string) => {
    if (!data?.document) return null;
    return {
      id: data.document.id,
      status: nextStatus,
      client_name: clientName,
      client_email: clientEmail || null,
      client_phone: clientPhone || null,
      client_address: clientAddress || null,
      notes: composeNotesWithIce(notes, clientIce) || null,
      tax_rate: taxRate,
      discount_amount: discountAmount,
    };
  };

  const handleSave = () => {
    const payload = buildDocumentPayload(status);
    if (!data?.document || !payload) return;
    updateDoc.mutate(
      payload,
      {
        onSuccess: () => {
          replaceItems.mutate({
            documentId: data.document.id,
            items: items.map((item, idx) => ({
              line_order: idx + 1,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unit_price: item.unit_price,
              discount_rate: item.discount_rate,
              tax_rate: item.tax_rate,
            })),
          });
        },
      }
    );
  };

  const handleStatusWorkflow = (nextStatus: string) => {
    if (nextStatus === 'partial') return;
    const payload = buildDocumentPayload(nextStatus);
    if (!payload) return;
    setStatus(nextStatus);
    updateDoc.mutate(payload);
  };

  const handleConfirmPartialPayment = () => {
    if (!data?.document) return;
    const amount = Number(partialAmount || 0);
    if (Number.isNaN(amount) || amount <= 0) return;
    createEvent.mutate(
      {
        document_id: data.document.id,
        event_type: 'payment_recorded',
        event_label: 'Règlement partiel',
        event_payload: {
          amount,
          source: 'workflow_partial',
        },
      },
      {
        onSuccess: () => {
          const payload = buildDocumentPayload('partial');
          if (!payload) return;
          setStatus('partial');
          updateDoc.mutate(payload);
          setPartialAmount('');
        },
      }
    );
  };

  const handleConvert = () => {
    if (!data?.document) return;
    const nextType = nextTypeMap[data.document.doc_type];
    if (!nextType) return;
    convertDoc.mutate(
      { source_document_id: data.document.id, target_doc_type: nextType },
      {
        onSuccess: (doc) => navigate(`/facturation/${doc.id}`),
      }
    );
  };

  const handleExportPdf = () => {
    const pdf = buildInvoicePdf(pdfTemplate, {
      includeHeader: exportShowHeader,
      includeFooter: exportShowFooter,
      includeSignature: exportShowSignature,
    });
    if (!pdf || !data?.document) return;
    pdf.save(`${data.document.doc_number}.pdf`);
  };

  const buildInvoicePdf = (
    template: PdfTemplate = pdfTemplate,
    options?: {
      includeHeader?: boolean;
      includeFooter?: boolean;
      includeSignature?: boolean;
      snapshot?: {
        client_name?: string | null;
        client_email?: string | null;
        client_phone?: string | null;
        client_address?: string | null;
        notes?: string | null;
        tax_rate?: number | null;
        discount_amount?: number | null;
        status?: string | null;
        items?: EditableItem[];
      };
    }
  ) => {
    if (!data?.document) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const includeHeader = options?.includeHeader ?? true;
    const includeFooter = options?.includeFooter ?? true;
    const includeSignature = options?.includeSignature ?? true;
    const sourceClientName = options?.snapshot?.client_name ?? clientName;
    const sourceClientEmail = options?.snapshot?.client_email ?? clientEmail;
    const sourceClientPhone = options?.snapshot?.client_phone ?? clientPhone;
    const sourceClientAddress = options?.snapshot?.client_address ?? clientAddress;
    const sourceClientIce = extractClientIceFromNotes(options?.snapshot?.notes ?? composeNotesWithIce(notes, clientIce));
    const sourcePlainNotes = stripIceMarker(options?.snapshot?.notes ?? notes);
    const sourceItems = options?.snapshot?.items ?? items;
    const sourceTaxRate = Number(options?.snapshot?.tax_rate ?? taxRate ?? 0);
    const sourceDiscountAmount = Number(options?.snapshot?.discount_amount ?? discountAmount ?? 0);
    const sourceStatus = options?.snapshot?.status || status;
    const sourceTotals = (() => {
      const subtotal = sourceItems.reduce(
        (acc, item) =>
          acc +
          Number(item.quantity || 0) *
            Number(item.unit_price || 0) *
            (1 - Number(item.discount_rate || 0) / 100),
        0
      );
      const tax = subtotal * (sourceTaxRate / 100);
      const total = subtotal + tax - sourceDiscountAmount;
      return { subtotal, tax, total };
    })();
    const sourceDocType = data.document.doc_type;
    const sourceIsCreditNote =
      sourceDocType === 'facture' && hasCreditNoteMarker(options?.snapshot?.notes ?? data.document.notes);
    const sourceDocLabel = sourceIsCreditNote ? 'Avoir' : (docTypeLabels[sourceDocType] || 'Facture');
    const sourceDocNumber = sourceIsCreditNote
      ? buildAvoirDisplayNumber(data.document.id, data.document.issue_date, docs)
      : data.document.doc_number;

    const companyName = company?.company_name || 'Société';
    const companyAddress = company?.address || '-';
    const companyEmail = company?.contact_email || '-';
    const companyPhone = company?.contact_phone || '-';
    const companyTax = company?.tax_info || '-';

    const palette = template === 'modern'
      ? {
          header: [122, 36, 63] as [number, number, number],
          headerAccent: [153, 61, 88] as [number, number, number],
          card: [255, 255, 255] as [number, number, number],
          cardAccent: [241, 241, 241] as [number, number, number],
          table: [238, 238, 238] as [number, number, number],
          text: [20, 20, 20] as [number, number, number],
        }
      : {
          header: [30, 64, 175] as [number, number, number],
          headerAccent: [37, 99, 235] as [number, number, number],
          card: [239, 246, 255] as [number, number, number],
          cardAccent: [219, 234, 254] as [number, number, number],
          table: [30, 64, 175] as [number, number, number],
          text: [15, 23, 42] as [number, number, number],
        };

    const pageW = 210;
    const pageH = 297;
    const marginX = 12;
    const contentW = 186;
    const headerLogoX = 12;
    const headerLogoY = 8;
    const headerLogoW = 28;
    const headerLogoH = 28;
    const isModern = template === 'modern';

    // Print-ready: minimal ink, high contrast, fixed margins
    doc.setFillColor(isModern ? 255 : 248, isModern ? 255 : 250, isModern ? 255 : 252);
    doc.rect(0, 0, pageW, pageH, 'F');
    if (includeHeader) {
      doc.setFillColor(palette.header[0], palette.header[1], palette.header[2]);
      doc.rect(0, 0, pageW, isModern ? 5 : 6, 'F');

      // Logo at extreme top-left
      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(isModern ? palette.header[0] : 255, isModern ? palette.header[1] : 255, isModern ? palette.header[2] : 255);
      doc.roundedRect(headerLogoX, headerLogoY, headerLogoW, headerLogoH, 2, 2, 'FD');
      if (logoDataUrl) {
        try {
          doc.addImage(logoDataUrl, 'PNG', headerLogoX + 1.2, headerLogoY + 1.2, headerLogoW - 2.4, headerLogoH - 2.4, undefined, 'FAST');
        } catch {
          doc.setTextColor(100, 116, 139);
          doc.setFontSize(8);
          doc.text('LOGO', headerLogoX + headerLogoW / 2, headerLogoY + headerLogoH / 2 + 1, { align: 'center' });
        }
      } else {
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(8);
        doc.text('LOGO', headerLogoX + headerLogoW / 2, headerLogoY + headerLogoH / 2 + 1, { align: 'center' });
      }

      // Company block directly below logo (left column)
      doc.setTextColor(palette.text[0], palette.text[1], palette.text[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isModern ? 12.5 : 13);
      doc.text(companyName, headerLogoX, 42);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(isModern ? 8.8 : 9);
      doc.text(`Email: ${companyEmail}`, headerLogoX, 47);
      doc.text(`Tél: ${companyPhone}`, headerLogoX, 52);
      const companyAddressLines = doc.splitTextToSize(`Adresse: ${companyAddress}`, 84);
      doc.text(companyAddressLines, headerLogoX, 57);

      // Separator between header and body
      doc.setDrawColor(203, 213, 225);
      doc.line(12, 67, 198, 67);
    }

    // FACTURE frame stays visible even when en-tete is hidden
    doc.setDrawColor(palette.header[0], palette.header[1], palette.header[2]);
    doc.setLineWidth(0.6);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(124, 10, 74, 44, 2, 2, 'FD');
    doc.setFillColor(palette.header[0], palette.header[1], palette.header[2]);
    doc.rect(124, 10, 74, isModern ? 8 : 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isModern ? 13 : 14);
    doc.text(sourceDocLabel.toUpperCase(), 161, isModern ? 15.5 : 16, { align: 'center' });
    doc.setTextColor(palette.text[0], palette.text[1], palette.text[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isModern ? 9.3 : 10);
    doc.text(`N°: ${sourceDocNumber}`, 127, isModern ? 25.5 : 27);
    doc.text(`Date: ${new Date(data.document.issue_date).toLocaleDateString('fr-FR')}`, 127, isModern ? 32 : 34);
    doc.text(`Statut: ${statusLabels[sourceStatus || data.document.status || ''] || sourceStatus || data.document.status || '-'}`, 127, isModern ? 38.5 : 41);
    if (data.document.due_date) {
      doc.text(`Due Date: ${new Date(data.document.due_date).toLocaleDateString('fr-FR')}`, 127, isModern ? 45 : 48);
    }

    // Subtle watermark logo in body background
    if (logoDataUrl) {
      try {
        const anyDoc = doc as unknown as {
          setGState?: (arg: unknown) => void;
          GState?: new (options: { opacity: number }) => unknown;
        };
        if (anyDoc.setGState && anyDoc.GState) {
          anyDoc.setGState(new anyDoc.GState({ opacity: 0.04 }));
          doc.addImage(logoDataUrl, 'PNG', 70, 130, 70, 70, undefined, 'FAST');
          anyDoc.setGState(new anyDoc.GState({ opacity: 1 }));
        }
      } catch {
        // ignore watermark failures silently
      }
    }

    // Body starts below header separator
    const clientCardY = includeHeader ? 72 : 60;
    doc.setFillColor(palette.card[0], palette.card[1], palette.card[2]);
    doc.roundedRect(marginX, clientCardY, contentW, 40, 2, 2, 'F');
    doc.setFillColor(palette.cardAccent[0], palette.cardAccent[1], palette.cardAccent[2]);
    doc.rect(marginX, clientCardY, contentW, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Informations client', marginX + 2, clientCardY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(`Nom: ${sourceClientName || '-'}`, marginX + 2, clientCardY + 12);
    doc.text(`Email: ${sourceClientEmail || '-'}`, marginX + 2, clientCardY + 17);
    doc.text(`Téléphone: ${sourceClientPhone || '-'}`, marginX + 2, clientCardY + 22);
    doc.text(`ICE: ${sourceClientIce || '-'}`, marginX + 2, clientCardY + 27);
    const clientAddressLines = doc.splitTextToSize(`Adresse: ${sourceClientAddress || '-'}`, 178);
    doc.text(clientAddressLines, marginX + 2, clientCardY + 34);

    autoTable(doc, {
      startY: clientCardY + 46,
      head: [['Description', 'Qté', 'Prix H.T', 'TVA', 'Total H.T']],
      body: sourceItems.map((item) => {
        const lineTotal = Number(item.quantity || 0) * Number(item.unit_price || 0) * (1 - Number(item.discount_rate || 0) / 100) * (1 + Number(item.tax_rate || 0) / 100);
        return [
          item.description || '-',
          Number(item.quantity || 0).toFixed(2),
          Number(item.unit_price || 0).toFixed(2),
          Number(item.tax_rate || 0).toFixed(2),
          lineTotal.toFixed(2),
        ];
      }),
      styles: { fontSize: 9.5, cellPadding: 2.8, lineColor: [203, 213, 225], lineWidth: 0.2, textColor: [15, 23, 42] },
      headStyles: template === 'modern' ? { fillColor: palette.table, textColor: [20, 20, 20] } : { fillColor: palette.table },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    let finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 120;
    if (sourcePlainNotes.trim()) {
      const notesY = finalY + 8;
      const notesLines = doc.splitTextToSize(sourcePlainNotes.trim(), 180);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.text('Notes:', 12, notesY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);
      doc.text(notesLines, 12, notesY + 5);
      finalY = notesY + 5 + notesLines.length * 4.2;
      doc.setTextColor(0, 0, 0);
    }
    const displayPaid = sourceStatus === 'paid' ? sourceTotals.total : paymentSummary.paid;
    const displayRemaining = sourceStatus === 'paid' ? 0 : Math.max(0, sourceTotals.total - displayPaid);
    const paymentStatus = sourceStatus === 'paid' || displayRemaining <= 0.0001 ? 'PAYE' : displayPaid > 0 ? 'PARTIEL' : 'NON PAYE';
    if (finalY > 215) {
      doc.addPage();
      finalY = 20;
    }

    // Colored cards for payment/details summary
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(12, finalY + 8, 106, 38, 2, 2, 'F');
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(120, finalY + 8, 78, 38, 2, 2, 'F');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Mode de règlement: ${paymentStatus}`, 14, finalY + 16);
    doc.text(`Payé: ${displayPaid.toFixed(2)} MAD`, 14, finalY + 22);
    doc.text(`Reste: ${displayRemaining.toFixed(2)} MAD`, 14, finalY + 28);
    const amountWords = numberToFrenchWords(sourceTotals.total);
    doc.text(`Arrêtée à la somme de: ${amountWords} dirhams`, 14, finalY + 34);

    doc.text(`Total H.T: ${sourceTotals.subtotal.toFixed(2)} MAD`, 123, finalY + 15);
    doc.text(`TVA 20%: ${sourceTotals.tax.toFixed(2)} MAD`, 123, finalY + 21);
    doc.text(`Remise: ${sourceDiscountAmount.toFixed(2)} MAD`, 123, finalY + 27);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL T.T.C: ${sourceTotals.total.toFixed(2)} MAD`, 123, finalY + 35);

    if (includeSignature) {
      const signatureBoxY = Math.min(Math.max(finalY + 52, 210), 232);
      const signatureBoxX = 138;
      const signatureBoxW = 60;
      const signatureBoxH = 22;

      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text('Cachet & Signature', 198, signatureBoxY - 2, { align: 'right' });
      doc.rect(signatureBoxX, signatureBoxY, signatureBoxW, signatureBoxH);
      if (signatureDataUrl) {
        try {
          const fmt = signatureDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
          doc.addImage(signatureDataUrl, fmt, signatureBoxX + 1, signatureBoxY + 1, signatureBoxW - 2, signatureBoxH - 2, undefined, 'FAST');
        } catch {
          // fallback silently
        }
      } else {
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text('Zone signature', signatureBoxX + signatureBoxW / 2, signatureBoxY + signatureBoxH / 2 + 1, { align: 'center' });
        doc.setTextColor(71, 85, 105);
      }
    }

    if (includeFooter) {
      // Footer: legal/tax info always at bottom with clear separation
      doc.setFillColor(248, 250, 252);
      doc.rect(0, pageH - 28, pageW, 28, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.line(12, 272, 198, 272);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const fiscalLine = `Informations fiscales: ${companyTax || '-'}`;
      const fiscalLines = doc.splitTextToSize(fiscalLine, 170).slice(0, 2);
      let footerY = 276;
      fiscalLines.forEach((line) => {
        doc.text(line, 105, footerY, { align: 'center' });
        footerY += 3.8;
      });
      const addressLine = `Adresse: ${companyAddress || '-'}`;
      const addressLines = doc.splitTextToSize(addressLine, 170).slice(0, 2);
      footerY += 1.2;
      addressLines.forEach((line) => {
        doc.text(line, 105, footerY, { align: 'center' });
        footerY += 3.8;
      });

      doc.setFontSize(7.2);
      const generatedAt = new Date().toLocaleString('fr-FR');
      doc.text(`Document généré par parcgps.com`, 12, 286.5);
      doc.text(`Logiciel 100% gratuit`, 12, 289.8);
      doc.text(`Contact@parcgps.com`, 12, 293.1);
      doc.text(`Date/Heure: ${generatedAt}`, 198, 291, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    }

    return doc;
  };

  const handlePreviewPdf = () => {
    const pdf = buildInvoicePdf(pdfTemplate, {
      includeHeader: exportShowHeader,
      includeFooter: exportShowFooter,
      includeSignature: exportShowSignature,
    });
    if (!pdf) return;
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl(url);
    setPdfPreviewOpen(true);
  };

  const handleDuplicate = () => {
    if (!data?.document) return;
    createDoc.mutate(
      {
        doc_type: data.document.doc_type,
        client_name: clientName,
        client_email: clientEmail || null,
        client_phone: clientPhone || null,
        client_address: clientAddress || null,
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: data.document.due_date || null,
        status: 'draft',
        language: data.document.language,
        direction: data.document.direction,
        template_type: data.document.template_type,
        show_header: data.document.show_header,
        show_footer: data.document.show_footer,
        notes: notes || null,
        tax_rate: taxRate,
        discount_amount: discountAmount,
      },
      {
        onSuccess: (newDoc) => {
          replaceItems.mutate(
            {
              documentId: newDoc.id,
              items: items.map((item, idx) => ({
                line_order: idx + 1,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit,
                unit_price: item.unit_price,
                discount_rate: item.discount_rate,
                tax_rate: item.tax_rate,
              })),
            },
            {
              onSuccess: () => navigate(`/facturation/${newDoc.id}`),
            }
          );
        },
      }
    );
  };

  const handlePrintPaymentHistoryPdf = () => {
    if (!data?.document) return;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('Historique des règlements', 12, 14);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(`Document: ${data.document.doc_number}`, 12, 21);
    pdf.text(`Client: ${data.document.client_name}`, 12, 27);
    autoTable(pdf, {
      startY: 33,
      head: [['Date', 'Libellé', 'Montant', 'Solde après']],
      body:
        paymentHistoryRows.length > 0
          ? paymentHistoryRows.map((row) => [
              new Date(row.date).toLocaleString('fr-FR'),
              row.label,
              `${row.amount.toFixed(2)} MAD`,
              `${row.remaining.toFixed(2)} MAD`,
            ])
          : [['-', 'Aucun règlement enregistré.', '-', '-']],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    const finalY = (pdf as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 120;
    pdf.setFontSize(10);
    pdf.text(`Total facture: ${paymentSummary.total.toFixed(2)} MAD`, 12, finalY + 8);
    pdf.text(`Total payé: ${paymentSummary.paid.toFixed(2)} MAD`, 12, finalY + 14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Reste: ${paymentSummary.remaining.toFixed(2)} MAD`, 12, finalY + 20);

    const stamp =
      paymentSummary.remaining <= 0.0001
        ? { text: 'PAYE', color: [22, 163, 74] as [number, number, number] }
        : paymentSummary.paid > 0
          ? { text: 'PARTIEL', color: [234, 179, 8] as [number, number, number] }
          : { text: 'NON PAYE', color: [220, 38, 38] as [number, number, number] };

    pdf.setTextColor(stamp.color[0], stamp.color[1], stamp.color[2]);
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text(stamp.text, 150, 24, { angle: 18 });
    pdf.setTextColor(0, 0, 0);

    pdf.save(`historique-reglements-${data.document.doc_number}.pdf`);
  };

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldAutoDownload = params.get('download') === '1';
    const shouldSendBlob = params.get('download_blob') === '1';
    if ((!shouldAutoDownload && !shouldSendBlob) || autoDownloadDone || !data?.document) return;
    if (companyLoading) return;
    if (company?.logo_url && !logoDataUrl) return;
    if (companySignatureUrl && !signatureDataUrl) return;
    const docTemplate = PDF_TEMPLATES.includes(data.document.template_type as PdfTemplate)
      ? (data.document.template_type as PdfTemplate)
      : 'modern';
    const snapshotItems: EditableItem[] = (data.items || []).map((item) => ({
      id: item.id,
      description: item.description || '',
      quantity: Number(item.quantity || 0),
      unit: item.unit || 'u',
      unit_price: Number(item.unit_price || 0),
      discount_rate: Number(item.discount_rate || 0),
      tax_rate: Number(item.tax_rate || 20),
    }));
    const pdf = buildInvoicePdf(docTemplate, {
      includeHeader: Boolean(data.document.show_header),
      includeFooter: Boolean(data.document.show_footer),
      includeSignature: exportShowSignature,
      snapshot: {
        client_name: data.document.client_name,
        client_email: data.document.client_email,
        client_phone: data.document.client_phone,
        client_address: data.document.client_address,
        notes: data.document.notes,
        tax_rate: Number(data.document.tax_rate || 20),
        discount_amount: Number(data.document.discount_amount || 0),
        status: data.document.status,
        items: snapshotItems,
      },
    });
    if (!pdf) return;
    if (shouldSendBlob) {
      void (async () => {
        try {
          const blob = pdf.output('blob');
          const buffer = await blob.arrayBuffer();
          window.parent.postMessage(
            {
              type: 'facturation:invoice_pdf_blob',
              invoiceId: data.document.id,
              buffer,
            },
            window.location.origin
          );
        } catch (error) {
          window.parent.postMessage(
            {
              type: 'facturation:invoice_pdf_blob_error',
              invoiceId: data.document.id,
              error: error instanceof Error ? error.message : 'Erreur génération PDF.',
            },
            window.location.origin
          );
        } finally {
          setAutoDownloadDone(true);
          navigate(location.pathname, { replace: true });
        }
      })();
      return;
    }

    pdf.save(`${data.document.doc_number}.pdf`);
    setAutoDownloadDone(true);
    navigate(location.pathname, { replace: true });
  }, [location.search, location.pathname, autoDownloadDone, data?.document, data?.items, companyLoading, company?.logo_url, logoDataUrl, signatureDataUrl, companySignatureUrl, exportShowSignature]);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
                    <h1 className="text-2xl font-bold">Détail {currentDocLabel}</h1>
            <p className="text-muted-foreground">Consultation détaillée du document de facturation</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowTimeline((prev) => !prev)}>
              {showTimeline ? 'Cacher Timeline' : 'Afficher Timeline'}
            </Button>
            <Button variant="outline" onClick={() => navigate('/facturation')}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Retour
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Card><CardContent className="py-10 text-sm text-muted-foreground">Chargement...</CardContent></Card>
        ) : !data?.document ? (
          <Card><CardContent className="py-10 text-sm text-muted-foreground">Document introuvable.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <Card className={showTimeline ? 'xl:col-span-8' : 'xl:col-span-12'}>
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle>{data.document.doc_number}</CardTitle>
                    <CardDescription>{currentDocLabel} · {new Date(data.document.issue_date).toLocaleDateString('fr-FR')}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap md:justify-end">
                    <Badge variant="outline">{statusLabels[data.document.status] || data.document.status}</Badge>
                    <Select value={pdfTemplate} onValueChange={(value: PdfTemplate) => setPdfTemplate(value)}>
                      <SelectTrigger className="w-[130px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="classic">Classic PDF</SelectItem>
                        <SelectItem value="modern">Modern PDF</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1 border rounded px-2 py-1">
                      <Label className="text-xs">en-tête</Label>
                      <Switch checked={exportShowHeader} onCheckedChange={setExportShowHeader} />
                    </div>
                    <div className="flex items-center gap-1 border rounded px-2 py-1">
                      <Label className="text-xs">pied</Label>
                      <Switch checked={exportShowFooter} onCheckedChange={setExportShowFooter} />
                    </div>
                    <div className="flex items-center gap-1 border rounded px-2 py-1">
                      <Label className="text-xs">cachet</Label>
                      <Switch checked={exportShowSignature} onCheckedChange={setExportShowSignature} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    ref={signatureInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      void handleUploadSignatureImage(file);
                      e.currentTarget.value = '';
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => signatureInputRef.current?.click()}
                    disabled={signatureUploading || upsertCompanyProfile.isPending}
                  >
                    {signatureUploading || upsertCompanyProfile.isPending ? 'Upload...' : 'Téléverser Cachet & Signature'}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={handlePreviewPdf}>
                    <Eye className="w-4 h-4 mr-1" />
                    Aperçu PDF
                  </Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={handleExportPdf}>
                    <FileDown className="w-4 h-4 mr-1" />
                    Télécharger PDF
                  </Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={handleConvert} disabled={!nextTypeMap[data.document.doc_type] || convertDoc.isPending}>
                    <ArrowRightLeft className="w-4 h-4 mr-1" />
                    Convertir
                  </Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={handleDuplicate} disabled={createDoc.isPending || replaceItems.isPending}>
                    <Copy className="w-4 h-4 mr-1" />
                    Dupliquer
                  </Button>
                  {isInvoice ? (
                    <Button size="sm" variant="outline" className="h-8" onClick={() => setPaymentHistoryOpen(true)}>
                      <History className="w-4 h-4 mr-1" />
                      Historique règlements
                    </Button>
                  ) : null}
                  <Button size="sm" className="h-8" onClick={handleSave} disabled={updateDoc.isPending || replaceItems.isPending}>
                    Enregistrer
                  </Button>
                </div>
                <div className="rounded-md border px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-xs text-muted-foreground">
                    Cachet & Signature (PDF): {exportShowSignature ? 'affiché' : 'masqué'}.
                  </div>
                  <div className="flex items-center gap-2">
                    {signatureDataUrl ? (
                      <img src={signatureDataUrl} alt="Signature preview" className="h-10 w-24 object-contain border rounded bg-white" />
                    ) : (
                      <span className="text-xs text-muted-foreground">Aucune image chargée</span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => signatureInputRef.current?.click()}
                      disabled={signatureUploading || upsertCompanyProfile.isPending}
                    >
                      Changer image
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Client</Label>
                    <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Téléphone</Label>
                    <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>ICE client</Label>
                    <Input value={clientIce} onChange={(e) => setClientIce(e.target.value)} placeholder="ICE..." />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>{isInvoice ? 'Workflow statut' : `Workflow ${currentDocLabel.toLowerCase()}`}</Label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {workflowSteps.map((step) => (
                        <Button
                          key={step.value}
                          size="sm"
                          variant={status === step.value ? 'default' : 'outline'}
                          onClick={() => (step.value === 'partial' ? handleConfirmPartialPayment() : handleStatusWorkflow(step.value))}
                          disabled={updateDoc.isPending || (step.value === 'partial' && (!partialAmount || createEvent.isPending))}
                        >
                          {step.label}
                        </Button>
                      ))}
                      {isInvoice && (
                        <div className="flex items-center gap-2 ml-4">
                          <Label className="whitespace-nowrap">Montant partiel:</Label>
                          <Input
                            type="number"
                            value={partialAmount}
                            onChange={(e) => setPartialAmount(e.target.value)}
                            onFocus={(e) => e.currentTarget.select()}
                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none w-[120px] h-8"
                            placeholder="Montant..."
                          />
                          <Button size="sm" className="h-8" onClick={handleConfirmPartialPayment} disabled={!partialAmount || createEvent.isPending}>
                            Valider
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Adresse</Label>
                    <Textarea value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} rows={2} />
                  </div>
                </div>
                <div className="border rounded-md overflow-hidden">
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50%] min-w-[240px]">Description</TableHead>
                        <TableHead className="w-[100px] text-right">Qté</TableHead>
                        <TableHead className="w-[120px] text-right">PU</TableHead>
                        <TableHead className="w-[90px] text-right">TVA</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucune ligne.</TableCell></TableRow>
                      ) : (
                        items.map((item, idx) => (
                          <TableRow key={item.id}>
                            <TableCell className="w-[50%] min-w-[240px]">
                              <Input value={item.description} onChange={(e) => updateItem(idx, { description: e.target.value })} />
                            </TableCell>
                            <TableCell className="w-[100px] text-right">
                              <Input
                                type="number"
                                value={item.quantity === 0 ? '' : item.quantity}
                                onChange={(e) => updateItem(idx, { quantity: Number(e.target.value || 0) })}
                                onWheel={(e) => e.currentTarget.blur()}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                    e.preventDefault();
                                  }
                                }}
                                onFocus={(e) => e.currentTarget.select()}
                                className="h-9 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="Qté"
                              />
                            </TableCell>
                            <TableCell className="w-[120px] text-right">
                              <Input
                                type="number"
                                value={item.unit_price === 0 ? '' : item.unit_price}
                                onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value || 0) })}
                                onWheel={(e) => e.currentTarget.blur()}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                    e.preventDefault();
                                  }
                                }}
                                onFocus={(e) => e.currentTarget.select()}
                                className="h-9 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="PU"
                              />
                            </TableCell>
                            <TableCell className="w-[90px] text-right">
                              <Input
                                type="number"
                                value={item.tax_rate === 0 ? '' : item.tax_rate}
                                onChange={(e) => updateItem(idx, { tax_rate: Number(e.target.value || 0) })}
                                onFocus={(e) => e.currentTarget.select()}
                                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="TVA"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center gap-2 justify-end">
                                <span>{(Number(item.quantity || 0) * Number(item.unit_price || 0) * (1 - Number(item.discount_rate || 0) / 100) * (1 + Number(item.tax_rate || 0) / 100)).toFixed(2)} MAD</span>
                                <Button size="icon" variant="ghost" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, { description: '', quantity: 1, unit: 'u', unit_price: 0, discount_rate: 0, tax_rate: taxRate }])}>
                    <Plus className="w-4 h-4 mr-1" />
                    Ajouter ligne
                  </Button>
                  <div className="flex items-center gap-2">
                    <Label>TVA globale</Label>
                    <Input
                      className="w-[100px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      type="number"
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value || 0))}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <Label>Remise</Label>
                    <Input
                      className="w-[120px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      type="number"
                      value={discountAmount === 0 ? '' : discountAmount}
                      onChange={(e) => setDiscountAmount(Number(e.target.value || 0))}
                      onFocus={(e) => e.currentTarget.select()}
                      placeholder="Remise"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                </div>
                <div className="ml-auto max-w-sm space-y-1 text-sm">
                  <div className="flex justify-between"><span>Sous-total</span><span>{totals.subtotal.toFixed(2)} MAD</span></div>
                  <div className="flex justify-between"><span>TVA</span><span>{totals.tax.toFixed(2)} MAD</span></div>
                  <div className="flex justify-between font-bold text-base border-t pt-2"><span>Total</span><span>{totals.total.toFixed(2)} MAD</span></div>
                </div>
              </CardContent>
            </Card>

            <Dialog open={pdfPreviewOpen} onOpenChange={setPdfPreviewOpen}>
              <DialogContent className="max-w-5xl">
                <DialogHeader>
                  <DialogTitle>{`Aperçu PDF - ${currentDocLabel}`}</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={handleExportPdf}>
                      <FileDown className="w-4 h-4 mr-1" />
                      Télécharger PDF
                    </Button>
                  </div>
                  {pdfPreviewUrl ? (
                    <iframe title={`Aperçu PDF ${currentDocLabel}`} src={pdfPreviewUrl} className="w-full h-[70vh] border rounded-md bg-white" />
                  ) : (
                    <div className="text-sm text-muted-foreground">Aperçu indisponible.</div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={paymentHistoryOpen} onOpenChange={setPaymentHistoryOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Historique des règlements</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="flex items-center justify-end">
                    <Button size="sm" variant="outline" onClick={handlePrintPaymentHistoryPdf}>
                      <FileDown className="w-4 h-4 mr-1" />
                      Imprimer historique
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="border rounded p-2"><span className="text-muted-foreground">Total facture:</span> {paymentSummary.total.toFixed(2)} MAD</div>
                    <div className="border rounded p-2"><span className="text-muted-foreground">Total payé:</span> {paymentSummary.paid.toFixed(2)} MAD</div>
                    <div className="border rounded p-2"><span className="text-muted-foreground">Reste:</span> {paymentSummary.remaining.toFixed(2)} MAD</div>
                  </div>
                  <div className="flex items-center justify-end">
                    <Badge variant="outline" className={paymentStamp.className}>{paymentStamp.label}</Badge>
                  </div>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Libellé</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                          <TableHead className="text-right">Solde après</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paymentHistoryRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Aucun règlement enregistré.</TableCell>
                          </TableRow>
                        ) : (
                          paymentHistoryRows.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell>{new Date(row.date).toLocaleString('fr-FR')}</TableCell>
                              <TableCell>{row.label}</TableCell>
                              <TableCell className="text-right">{row.amount.toFixed(2)} MAD</TableCell>
                              <TableCell className="text-right">{row.remaining.toFixed(2)} MAD</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {showTimeline ? (
              <Card className="xl:col-span-4">
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
                <CardDescription>
                  {isInvoice ? 'Historique + toutes les factures du client' : `Historique + tous les ${currentDocLabel.toLowerCase()}s du client`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {isInvoice ? 'Factures du client' : `${currentDocLabel}s du client`}
                </div>
                {isInvoice ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button size="sm" variant={timelineInvoiceFilter === 'all' ? 'default' : 'outline'} onClick={() => setTimelineInvoiceFilter('all')}>Toutes les factures</Button>
                    <Button size="sm" variant={timelineInvoiceFilter === 'paid' ? 'default' : 'outline'} onClick={() => setTimelineInvoiceFilter('paid')}>Payées</Button>
                    <Button size="sm" variant={timelineInvoiceFilter === 'unpaid' ? 'default' : 'outline'} onClick={() => setTimelineInvoiceFilter('unpaid')}>Non payé</Button>
                    <Button size="sm" variant={timelineInvoiceFilter === 'partial' ? 'default' : 'outline'} onClick={() => setTimelineInvoiceFilter('partial')}>Partiel</Button>
                  </div>
                ) : null}
                {clientInvoices.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    {isInvoice ? 'Aucune facture pour ce client.' : `Aucun ${currentDocLabel.toLowerCase()} pour ce client.`}
                  </div>
                ) : (
                  clientInvoices.map((inv) => (
                    <button
                      key={inv.id}
                      className="w-full text-left border rounded-md p-3 hover:bg-muted/30 transition-colors"
                      onClick={() => navigate(`/facturation/${inv.id}`)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">{inv.doc_number}</div>
                        <Badge variant="outline">{statusLabels[inv.status] || inv.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(inv.issue_date).toLocaleDateString('fr-FR')} · {Number(inv.total_amount || 0).toFixed(2)} MAD
                      </div>
                    </button>
                  ))
                )}
                <div className="h-px bg-border my-2" />
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Événements document</div>
                {data.events.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Aucun événement.</div>
                ) : (
                  data.events.map((event) => (
                    <div key={event.id} className="border rounded-md p-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <div className="text-sm font-medium">{event.event_label}</div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{new Date(event.created_at).toLocaleString('fr-FR')}</div>
                    </div>
                  ))
                )}
              </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
