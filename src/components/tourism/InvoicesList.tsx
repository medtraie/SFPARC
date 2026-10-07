import { useState } from 'react';
import { useTourismInvoices, useUpdateTourismInvoice, useDeleteTourismInvoice, TourismInvoice } from '@/hooks/useTourism';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, Calendar, Trash2, User, DollarSign, 
  Send, CheckCircle, XCircle, FileDown, Eye 
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTourismCompanyProfile, TOURISM_COMPANY_ID, type TourismCompanyProfile } from '@/hooks/useTourismCompany';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function InvoicesList() {
  const { data: invoices, isLoading } = useTourismInvoices();
  const deleteInvoice = useDeleteTourismInvoice();
  const { data: companyProfile } = useTourismCompanyProfile();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<TourismInvoice | null>(null);

  const handleOpenDetails = (invoice: TourismInvoice) => {
    setSelectedInvoice(invoice);
    setDetailsOpen(true);
  };

  const handleDownloadPdf = async (invoice: TourismInvoice) => {
    const doc = new jsPDF();
    const formatCurrency = (value: number) => `${value.toFixed(2)} MAD`;
    const formatDate = (date: string | null | undefined) => {
      if (!date) return '-';
      return format(new Date(date), 'dd/MM/yyyy');
    };
    const safeSingleLine = (value: string | null | undefined, maxLen = 65) => {
      const normalized = (value || '').replace(/\s+/g, ' ').trim();
      if (!normalized) return '-';
      return normalized.length > maxLen ? `${normalized.slice(0, maxLen - 1)}…` : normalized;
    };

    const colors = {
      header: { r: 9, g: 30, b: 66 },
      accent: { r: 14, g: 116, b: 144 },
      border: { r: 226, g: 232, b: 240 },
      mutedText: { r: 71, g: 85, b: 105 },
      bodyText: { r: 17, g: 24, b: 39 },
      softBg: { r: 241, g: 245, b: 249 },
    };

    const ensureCompany = async (): Promise<TourismCompanyProfile | null> => {
      if (companyProfile) return companyProfile;
      const { data: singleton } = await supabase
        .from('tourism_company_profile')
        .select('*')
        .eq('id', TOURISM_COMPANY_ID)
        .maybeSingle();

      if (singleton) return singleton as TourismCompanyProfile;

      const { data } = await supabase
        .from('tourism_company_profile')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return data as TourismCompanyProfile | null;
    };

    const companyData = await ensureCompany();

    const dataUrlFromBlob = async (blob: Blob) => {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read image'));
        reader.readAsDataURL(blob);
      });
    };

    const logoX = 4;
    const logoY = 6;
    const logoW = 36;
    const logoH = 24;

    const addLogo = async () => {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(logoX, logoY, logoW, logoH, 2, 2, 'F');

      if (!companyData?.logo_url) {
        doc.setDrawColor(255, 255, 255);
        doc.roundedRect(logoX, logoY, logoW, logoH, 2, 2, 'S');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(colors.mutedText.r, colors.mutedText.g, colors.mutedText.b);
        doc.text('LOGO', logoX + logoW / 2, logoY + logoH / 2 + 2.2, { align: 'center' });
        return;
      }

      try {
        const extractStoragePath = (logo: string) => {
          if (!logo) return null;
          if (!logo.startsWith('http')) return logo.split('?')[0];

          const publicMarker = '/storage/v1/object/public/tourism-assets/';
          const signedMarker = '/storage/v1/object/sign/tourism-assets/';

          const publicIdx = logo.indexOf(publicMarker);
          if (publicIdx >= 0) return logo.slice(publicIdx + publicMarker.length).split('?')[0];

          const signedIdx = logo.indexOf(signedMarker);
          if (signedIdx >= 0) return logo.slice(signedIdx + signedMarker.length).split('?')[0];

          return null;
        };

        const blobFromStorage = async () => {
          const path = extractStoragePath(companyData.logo_url || '');
          if (!path) return null;
          const { data: fileBlob, error } = await supabase.storage.from('tourism-assets').download(path);
          if (error || !fileBlob) return null;
          return fileBlob;
        };

        const blob =
          (await blobFromStorage()) ??
          (await (async () => {
            const srcUrl = companyData.logo_url.includes('?')
              ? companyData.logo_url
              : `${companyData.logo_url}?t=${Date.now()}`;
            const response = await fetch(srcUrl, { cache: 'no-cache', headers: { Accept: 'image/*' } });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.blob();
          })());

        const dataUrl = await dataUrlFromBlob(blob);
        const formatMatch = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,/);
        const rawFormat = formatMatch ? formatMatch[1].toUpperCase() : 'PNG';
        const format = rawFormat === 'JPG' ? 'JPEG' : rawFormat;
        doc.addImage(dataUrl, format as any, logoX + 1, logoY + 1, logoW - 2, logoH - 2, undefined, 'FAST');
      } catch {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(colors.mutedText.r, colors.mutedText.g, colors.mutedText.b);
        doc.text('LOGO', logoX + logoW / 2, logoY + logoH / 2 + 2.2, { align: 'center' });
      }
    };

    doc.setFillColor(colors.header.r, colors.header.g, colors.header.b);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setFillColor(colors.accent.r, colors.accent.g, colors.accent.b);
    doc.rect(0, 40, 210, 2, 'F');

    await addLogo();

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    const headerTextX = logoX + logoW + 8;
    doc.text(companyData?.company_name || 'SFTM', headerTextX, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const contactLine = [
      companyData?.contact_email ? companyData.contact_email : null,
      companyData?.contact_phone ? companyData.contact_phone : null,
    ]
      .filter(Boolean)
      .join(' | ');
    if (contactLine) doc.text(safeSingleLine(contactLine, 70), headerTextX, 22);

    if (companyData?.address) {
      doc.text(safeSingleLine(companyData.address, 70), headerTextX, 29);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(`FAC ${invoice.invoice_number}`, 196, 15, { align: 'right' });

    const statusLabel = {
      draft: 'Brouillon',
      sent: 'Envoyée',
      paid: 'Payée',
      cancelled: 'Annulée'
    }[invoice.status] || invoice.status;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Statut: ${statusLabel}`, 196, 22, { align: 'right' });
    doc.text(`Date: ${formatDate(invoice.invoice_date)}`, 196, 29, { align: 'right' });
    if (invoice.due_date) doc.text(`Échéance: ${formatDate(invoice.due_date)}`, 196, 36, { align: 'right' });

    const boxY = 46;
    const boxH = 36;
    const boxW = 88;
    const boxGap = 6;
    const leftX = 14;
    const rightX = leftX + boxW + boxGap;

    doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(leftX, boxY, boxW, boxH, 3, 3, 'FD');
    doc.roundedRect(rightX, boxY, boxW, boxH, 3, 3, 'FD');

    doc.setFillColor(colors.softBg.r, colors.softBg.g, colors.softBg.b);
    doc.roundedRect(leftX, boxY, boxW, 9, 3, 3, 'F');
    doc.roundedRect(rightX, boxY, boxW, 9, 3, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(colors.bodyText.r, colors.bodyText.g, colors.bodyText.b);
    doc.text('Client', leftX + 4, boxY + 6.2);
    doc.text('Société', rightX + 4, boxY + 6.2);

    const clientName = invoice.client?.name || 'Client inconnu';
    doc.setFontSize(10.5);
    doc.text(safeSingleLine(clientName, 40), leftX + 4, boxY + 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const clientLines: string[] = [];
    if (invoice.client?.address) clientLines.push(invoice.client.address);
    const clientText = clientLines.join(' - ');
    if (clientText) {
      const lines = doc.splitTextToSize(clientText, boxW - 8);
      doc.text(lines.slice(0, 2), leftX + 4, boxY + 21);
    }

    const missionRef = invoice.mission?.reference_mission || invoice.mission?.reference || null;
    if (invoice.mission_id) {
      doc.setTextColor(colors.mutedText.r, colors.mutedText.g, colors.mutedText.b);
      doc.text(`Réf mission: ${safeSingleLine(missionRef || '-', 28)}`, leftX + 4, boxY + 33);
      doc.setTextColor(colors.bodyText.r, colors.bodyText.g, colors.bodyText.b);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(safeSingleLine(companyData?.company_name || 'SFTM', 40), rightX + 4, boxY + 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const companyLines: string[] = [];
    if (companyData?.address) companyLines.push(companyData.address);
    if (companyData?.contact_email) companyLines.push(companyData.contact_email);
    if (companyData?.contact_phone) companyLines.push(companyData.contact_phone);
    const companyTextLines = doc.splitTextToSize(companyLines.join(' - '), boxW - 8);
    doc.text(companyTextLines.slice(0, 2), rightX + 4, boxY + 21);
    if (companyData?.tax_info) {
      doc.setTextColor(colors.mutedText.r, colors.mutedText.g, colors.mutedText.b);
      doc.setFontSize(8.5);
      doc.text(doc.splitTextToSize(companyData.tax_info, boxW - 8).slice(0, 1), rightX + 4, boxY + 33);
      doc.setTextColor(colors.bodyText.r, colors.bodyText.g, colors.bodyText.b);
      doc.setFontSize(9);
    }

    const summaryY = boxY + boxH + 10;
    doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
    doc.setFillColor(colors.softBg.r, colors.softBg.g, colors.softBg.b);
    doc.roundedRect(14, summaryY, 182, 28, 3, 3, 'FD');
    doc.setFontSize(10);
    doc.setTextColor(colors.mutedText.r, colors.mutedText.g, colors.mutedText.b);

    doc.text('Type', 20, summaryY + 10);
    doc.text('Montant HT', 86, summaryY + 10);
    doc.text('TVA', 142, summaryY + 10);

    doc.setFontSize(12);
    doc.setTextColor(colors.bodyText.r, colors.bodyText.g, colors.bodyText.b);

    const billingTypeLabels: Record<string, string> = {
      flat: 'Forfait',
      hourly: 'Tarif horaire',
      per_km: 'Prix/km',
      custom: 'Personnalisé',
    };

    doc.text(billingTypeLabels[invoice.billing_type] || invoice.billing_type, 20, summaryY + 21);
    doc.text(formatCurrency(invoice.subtotal), 86, summaryY + 21);
    doc.text(`${invoice.tax_rate}%`, 142, summaryY + 21);

    let rows: any[] = [];
    if (invoice.billing_type === 'custom' && invoice.custom_lines) {
      rows = invoice.custom_lines.map(line => [
        line.description,
        line.quantity.toString(),
        formatCurrency(line.unit_price),
        formatCurrency(line.total)
      ]);
    } else if (invoice.billing_type === 'flat') {
      rows = [[
        'Forfait mission',
        '1',
        formatCurrency(invoice.flat_rate),
        formatCurrency(invoice.flat_rate)
      ]];
    } else if (invoice.billing_type === 'hourly') {
      rows = [[
        'Heures travaillées',
        invoice.hours_worked.toString(),
        formatCurrency(invoice.hourly_rate),
        formatCurrency(invoice.hours_worked * invoice.hourly_rate)
      ]];
    } else if (invoice.billing_type === 'per_km') {
      rows = [[
        'Kilométrage',
        invoice.kilometers.toString(),
        formatCurrency(invoice.per_km_rate),
        formatCurrency(invoice.kilometers * invoice.per_km_rate)
      ]];
    }

    const tableY = summaryY + 38;

    autoTable(doc, {
      startY: tableY + 16,
      head: [['Description', 'Qté', 'Prix Unitaire', 'Total']],
      body: rows.length ? rows : [['-', '-', '-', '-']],
      theme: 'grid',
      headStyles: { fillColor: [colors.header.r, colors.header.g, colors.header.b], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [colors.softBg.r, colors.softBg.g, colors.softBg.b] },
      styles: { fontSize: 10, cellPadding: 3, textColor: [colors.bodyText.r, colors.bodyText.g, colors.bodyText.b] },
      margin: { left: 14, right: 14 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
      },
    });

    const afterTableY = (doc as any).lastAutoTable.finalY + 10;
    const totalsX = 120;
    const totalsW = 76;
    const totalsH = 26;
    doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(totalsX, afterTableY, totalsW, totalsH, 3, 3, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(colors.mutedText.r, colors.mutedText.g, colors.mutedText.b);
    doc.text('Total HT', totalsX + 6, afterTableY + 8);
    doc.text('TVA', totalsX + 6, afterTableY + 14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.bodyText.r, colors.bodyText.g, colors.bodyText.b);
    doc.text('Total TTC', totalsX + 6, afterTableY + 21);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(colors.bodyText.r, colors.bodyText.g, colors.bodyText.b);
    doc.text(formatCurrency(invoice.subtotal), totalsX + totalsW - 6, afterTableY + 8, { align: 'right' });
    doc.text(formatCurrency(invoice.tax_amount), totalsX + totalsW - 6, afterTableY + 14, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(formatCurrency(invoice.total_amount), totalsX + totalsW - 6, afterTableY + 21, { align: 'right' });

    const notesY = afterTableY + totalsH + 10;
    if (invoice.notes) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(colors.bodyText.r, colors.bodyText.g, colors.bodyText.b);
      doc.text('Notes', 14, notesY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(colors.mutedText.r, colors.mutedText.g, colors.mutedText.b);
      const noteLines = doc.splitTextToSize(invoice.notes, 182);
      doc.text(noteLines, 14, notesY + 6);
      doc.setTextColor(colors.bodyText.r, colors.bodyText.g, colors.bodyText.b);
    }

    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
    doc.line(14, pageHeight - 26, 196, pageHeight - 26);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(colors.mutedText.r, colors.mutedText.g, colors.mutedText.b);
    const f1 = companyData?.company_name ? safeSingleLine(companyData.company_name, 80) : '';
    const footerContact = [
      companyData?.contact_email ? companyData.contact_email : null,
      companyData?.contact_phone ? companyData.contact_phone : null,
    ]
      .filter(Boolean)
      .join(' | ');
    const f2 = safeSingleLine([companyData?.address || null, footerContact || null].filter(Boolean).join(' | '), 120);
    const f3 = companyData?.tax_info ? safeSingleLine(companyData.tax_info, 120) : 'Merci pour votre confiance';
    if (f1) doc.text(f1, 105, pageHeight - 18, { align: 'center' });
    if (f2 && f2 !== '-') doc.text(f2, 105, pageHeight - 13, { align: 'center' });
    doc.text(f3, 105, pageHeight - 8, { align: 'center' });

    doc.save(`Facture-${invoice.invoice_number}.pdf`);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (!invoices?.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Aucune facture</p>
        <p className="text-sm">Créez votre première facture touristique</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {invoices.map((invoice) => (
          <InvoiceCard 
            key={invoice.id} 
            invoice={invoice} 
            onDelete={() => deleteInvoice.mutate(invoice.id)}
            onDownload={() => void handleDownloadPdf(invoice)}
            onViewDetails={() => handleOpenDetails(invoice)}
          />
        ))}
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Détails de la facture {selectedInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Client</p>
                  <p className="font-medium">{selectedInvoice.client?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">{format(new Date(selectedInvoice.invoice_date), 'dd/MM/yyyy')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Statut</p>
                  <Badge variant="outline">{selectedInvoice.status}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total TTC</p>
                  <p className="font-bold text-lg">{selectedInvoice.total_amount.toFixed(2)} MAD</p>
                </div>
              </div>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">Lignes de facture</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Qté</TableHead>
                        <TableHead className="text-right">Prix Unitaire</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedInvoice.billing_type === 'custom' && selectedInvoice.custom_lines ? (
                        selectedInvoice.custom_lines.map((line, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{line.description}</TableCell>
                            <TableCell className="text-right">{line.quantity}</TableCell>
                            <TableCell className="text-right">{line.unit_price.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{line.total.toFixed(2)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell>
                            {selectedInvoice.billing_type === 'flat' ? 'Forfait mission' :
                             selectedInvoice.billing_type === 'hourly' ? 'Heures travaillées' :
                             selectedInvoice.billing_type === 'per_km' ? 'Kilométrage' : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {selectedInvoice.billing_type === 'flat' ? '1' :
                             selectedInvoice.billing_type === 'hourly' ? selectedInvoice.hours_worked :
                             selectedInvoice.billing_type === 'per_km' ? selectedInvoice.kilometers : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {selectedInvoice.billing_type === 'flat' ? selectedInvoice.flat_rate.toFixed(2) :
                             selectedInvoice.billing_type === 'hourly' ? selectedInvoice.hourly_rate.toFixed(2) :
                             selectedInvoice.billing_type === 'per_km' ? selectedInvoice.per_km_rate.toFixed(2) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {(selectedInvoice.subtotal).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="flex justify-end space-x-4 text-sm">
                <div className="space-y-1 text-right">
                  <p><span className="text-muted-foreground">Sous-total:</span> {selectedInvoice.subtotal.toFixed(2)} MAD</p>
                  <p><span className="text-muted-foreground">TVA ({selectedInvoice.tax_rate}%):</span> {selectedInvoice.tax_amount.toFixed(2)} MAD</p>
                  <p className="font-bold text-lg pt-2 border-t">Total: {selectedInvoice.total_amount.toFixed(2)} MAD</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface InvoiceCardProps {
  invoice: TourismInvoice;
  onDelete: () => void;
  onDownload: () => void;
  onViewDetails: () => void;
}

function InvoiceCard({ invoice, onDelete, onDownload, onViewDetails }: InvoiceCardProps) {
  const updateInvoice = useUpdateTourismInvoice();

  const statusConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    draft: { label: 'Brouillon', className: 'bg-gray-100 text-gray-800', icon: <FileText className="w-3 h-3" /> },
    sent: { label: 'Envoyée', className: 'bg-blue-100 text-blue-800', icon: <Send className="w-3 h-3" /> },
    paid: { label: 'Payée', className: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
    cancelled: { label: 'Annulée', className: 'bg-red-100 text-red-800', icon: <XCircle className="w-3 h-3" /> },
  };

  const billingTypeLabels: Record<string, string> = {
    flat: 'Forfait',
    hourly: 'Tarif horaire',
    per_km: 'Prix/km',
    custom: 'Devis personnalisé',
  };

  const status = statusConfig[invoice.status] || statusConfig.draft;

  const handleStatusChange = (newStatus: TourismInvoice['status']) => {
    updateInvoice.mutate({ id: invoice.id, status: newStatus });
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {invoice.invoice_number}
              </Badge>
              <Badge className={cn('text-xs flex items-center gap-1', status.className)}>
                {status.icon}
                {status.label}
              </Badge>
            </div>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              {invoice.total_amount.toFixed(2)} MAD
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{format(new Date(invoice.invoice_date), 'dd MMM yyyy', { locale: fr })}</span>
          </div>
          {invoice.client && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="w-4 h-4" />
              <span className="truncate">{invoice.client.name}</span>
            </div>
          )}
          <div className="text-muted-foreground">
            <span className="text-xs uppercase">Type:</span>{' '}
            <span>{billingTypeLabels[invoice.billing_type]}</span>
          </div>
          {invoice.mission && (
            <div className="text-muted-foreground text-xs">
              Mission: {invoice.mission.reference}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Sous-total: {invoice.subtotal.toFixed(2)} MAD</span>
          <span>TVA ({invoice.tax_rate}%): {invoice.tax_amount.toFixed(2)} MAD</span>
        </div>

        <div className="flex gap-2 pt-2">
            {invoice.status === 'draft' && (
              <Button size="sm" variant="outline" onClick={() => handleStatusChange('sent')}>
                <Send className="w-4 h-4 mr-1" />
                Envoyer
              </Button>
            )}
            {invoice.status === 'sent' && (
              <Button size="sm" variant="outline" onClick={() => handleStatusChange('paid')}>
                <CheckCircle className="w-4 h-4 mr-1" />
                Marquer payée
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onViewDetails}>
              <Eye className="w-4 h-4 mr-1" />
              Détails
            </Button>
            <Button size="sm" variant="ghost" onClick={onDownload}>
              <FileDown className="w-4 h-4 mr-1" />
              PDF
            </Button>
            {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleStatusChange('cancelled')}>
                Annuler
              </Button>
            )}
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer la facture ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible. La facture {invoice.invoice_number} sera définitivement supprimée.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    );
  }
