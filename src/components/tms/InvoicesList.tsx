import { useState, useMemo } from 'react';
import { useTMSInvoices, useDeleteTMSInvoice, useUpdateTMSInvoice, useTMSOrders, type TMSInvoice, type TMSOrder } from '@/hooks/useTMS';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Loader2, FileText, CheckCircle, DollarSign, TrendingUp, Eye, FileDown, Send } from 'lucide-react';
import { InvoiceForm } from './InvoiceForm';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTourismCompanyProfile } from '@/hooks/useTourismCompany';

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary', sent: 'default', paid: 'outline', cancelled: 'destructive',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon', sent: 'Envoyée', paid: 'Payée', cancelled: 'Annulée',
};

export function InvoicesList() {
  const { data: invoices = [], isLoading } = useTMSInvoices();
  const { data: orders = [] } = useTMSOrders();
  const { data: companyProfile } = useTourismCompanyProfile();
  const deleteInvoice = useDeleteTMSInvoice();
  const updateInvoice = useUpdateTMSInvoice();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<TMSInvoice | null>(null);

  const getInvoiceOrders = (invoice: TMSInvoice) => {
    return orders.filter((order) => {
      if (invoice.client_id && order.client_id !== invoice.client_id) return false;
      if (order.pickup_date < invoice.date_from) return false;
      if (order.pickup_date > invoice.date_to) return false;
      return order.status === 'delivered';
    });
  };

  const selectedOrders = useMemo(() => {
    if (!selectedInvoice) return [];
    return getInvoiceOrders(selectedInvoice);
  }, [selectedInvoice, orders]);

  const handleOpenDetails = (invoice: TMSInvoice) => {
    setSelectedInvoice(invoice);
    setDetailsOpen(true);
  };

  const handleDownloadPdf = (invoice: TMSInvoice) => {
    const invoiceOrders = getInvoiceOrders(invoice);
    const doc = new jsPDF();
    const formatCurrency = (value: number) => `${value.toFixed(2)} MAD`;
    const periodLabel = `${format(new Date(invoice.date_from), 'dd/MM/yyyy')} - ${format(new Date(invoice.date_to), 'dd/MM/yyyy')}`;

    doc.setFillColor(22, 78, 99);
    doc.rect(0, 0, 210, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(companyProfile?.company_name || 'SFTM', 14, 18);
    doc.setFontSize(11);
    doc.text('Facture Transport', 14, 26);

    doc.setTextColor(17, 24, 39);
    doc.setFontSize(18);
    doc.text(`${invoice.invoice_number}`, 196, 20, { align: 'right' });
    doc.setFontSize(10);
    doc.text(`Statut: ${STATUS_LABELS[invoice.status] || invoice.status}`, 196, 26, { align: 'right' });
    doc.text(`Date: ${format(new Date(), 'dd/MM/yyyy')}`, 196, 31, { align: 'right' });

    doc.setFontSize(11);
    doc.text('Client', 14, 42);
    doc.setFontSize(12);
    doc.text(invoice.client?.name || 'Tous les clients', 14, 48);
    doc.setFontSize(10);
    if (invoice.client?.address) {
      doc.text(invoice.client.address, 14, 54);
    }
    if (invoice.client?.city) {
      doc.text(invoice.client.city, 14, invoice.client.address ? 60 : 54);
    }

    doc.setFontSize(11);
    doc.text('Période', 196, 42, { align: 'right' });
    doc.setFontSize(12);
    doc.text(periodLabel, 196, 48, { align: 'right' });

    const summaryY = 70;
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, summaryY, 182, 26, 3, 3, 'FD');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text('Ordres', 20, summaryY + 10);
    doc.text('Distance', 60, summaryY + 10);
    doc.text('Poids', 100, summaryY + 10);
    doc.text('Montant HT', 140, summaryY + 10);
    doc.setFontSize(12);
    doc.setTextColor(17, 24, 39);
    doc.text(String(invoice.total_orders), 20, summaryY + 20);
    doc.text(`${Number(invoice.total_distance_km).toFixed(0)} km`, 60, summaryY + 20);
    doc.text(`${Number(invoice.total_weight_tons).toFixed(2)} t`, 100, summaryY + 20);
    doc.text(formatCurrency(Number(invoice.amount_ht)), 140, summaryY + 20);

    const totalY = summaryY + 36;
    doc.setFontSize(12);
    doc.text('Total TTC', 196, totalY, { align: 'right' });
    doc.setFontSize(16);
    doc.text(formatCurrency(Number(invoice.amount_ttc)), 196, totalY + 8, { align: 'right' });

    const rows = invoiceOrders.map((order) => {
      return [
        format(new Date(order.pickup_date), 'dd/MM/yyyy'),
        order.order_number,
        `${order.pickup_address} -> ${order.delivery_address}`,
        Number(order.weight_tons).toFixed(2),
        Number(order.amount_ht).toFixed(2),
      ];
    });

    autoTable(doc, {
      startY: totalY + 16,
      head: [['Date', 'N° Ordre', 'Trajet', 'Poids (t)', 'Montant HT']],
      body: rows.length ? rows : [['-', '-', '-', '-', '-']],
      theme: 'striped',
      headStyles: { fillColor: [22, 78, 99], textColor: 255 },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' },
      },
    });

    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 18, 196, pageHeight - 18);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    const contactLine = [companyProfile?.contact_email, companyProfile?.contact_phone].filter(Boolean).join(' | ');
    const footerLine = [companyProfile?.address, companyProfile?.tax_info].filter(Boolean).join(' | ');
    doc.text(contactLine || 'Merci pour votre confiance', 14, pageHeight - 10);
    if (footerLine) {
      doc.text(footerLine, 14, pageHeight - 5);
    }

    doc.save(`${invoice.invoice_number}.pdf`);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  const totalPaid = invoices.filter(f => f.status === 'paid').reduce((s, f) => s + Number(f.amount_ttc), 0);
  const totalPending = invoices.filter(f => f.status === 'sent' || f.status === 'draft').reduce((s, f) => s + Number(f.amount_ttc), 0);
  const totalProfit = invoices.filter(f => f.status === 'paid').reduce((s, f) => s + Number(f.profit), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Facturation & Rentabilité</h2>
          <p className="text-sm text-muted-foreground">{invoices.length} facture(s)</p>
        </div>
        <InvoiceForm />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total encaissé</p>
              <p className="text-2xl font-bold">{totalPaid.toFixed(0)} MAD</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">En attente</p>
              <p className="text-2xl font-bold">{totalPending.toFixed(0)} MAD</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Marge totale</p>
              <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{totalProfit.toFixed(0)} MAD</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucune facture créée</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Facture</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead className="text-right">Ordres</TableHead>
                  <TableHead className="text-right">Montant TTC</TableHead>
                  <TableHead className="text-right">Coûts</TableHead>
                  <TableHead className="text-right">Marge</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                    <TableCell>{inv.client?.name || 'Tous'}</TableCell>
                    <TableCell>
                      {format(new Date(inv.date_from), 'dd/MM', { locale: fr })} - {format(new Date(inv.date_to), 'dd/MM/yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell className="text-right">{inv.total_orders}</TableCell>
                    <TableCell className="text-right font-semibold">{Number(inv.amount_ttc).toFixed(2)} MAD</TableCell>
                    <TableCell className="text-right text-destructive">{Number(inv.total_cost).toFixed(2)} MAD</TableCell>
                    <TableCell className={`text-right font-semibold ${Number(inv.profit) >= 0 ? 'text-success' : 'text-destructive'}`}>{Number(inv.profit).toFixed(2)} MAD</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-auto p-0">
                            <Badge variant={STATUS_COLORS[inv.status] || 'secondary'}>{STATUS_LABELS[inv.status] || inv.status}</Badge>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {['draft', 'sent', 'paid'].map(s => (
                            <DropdownMenuItem key={s} onClick={() => updateInvoice.mutate({ id: inv.id, status: s })}>{STATUS_LABELS[s]}</DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDetails(inv)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownloadPdf(inv)}>
                          <FileDown className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer cette facture ?</AlertDialogTitle>
                              <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteInvoice.mutate(inv.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails de la facture</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm border p-4 rounded-lg bg-muted/20">
                <div>
                  <p className="text-muted-foreground">N° Facture</p>
                  <p className="font-medium">{selectedInvoice.invoice_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Client</p>
                  <p className="font-medium">{selectedInvoice.client?.name || 'Tous les clients'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Période</p>
                  <p className="font-medium">
                    {format(new Date(selectedInvoice.date_from), 'dd/MM/yyyy')} - {format(new Date(selectedInvoice.date_to), 'dd/MM/yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ordres</p>
                  <p className="font-medium">{selectedInvoice.total_orders}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Poids Total</p>
                  <p className="font-medium">{Number(selectedInvoice.total_weight_tons).toFixed(2)} t</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Montant HT</p>
                  <p className="font-medium">{Number(selectedInvoice.amount_ht).toFixed(2)} MAD</p>
                </div>
                <div>
                  <p className="text-muted-foreground">TVA ({(selectedInvoice.tax_rate || 20).toFixed(0)}%)</p>
                  <p className="font-medium">{Number(selectedInvoice.tax_amount).toFixed(2)} MAD</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total TTC</p>
                  <p className="font-medium text-lg text-primary">{Number(selectedInvoice.amount_ttc).toFixed(2)} MAD</p>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Liste des ordres inclus</h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>N° Ordre</TableHead>
                        <TableHead>Trajet</TableHead>
                        <TableHead className="text-right">Poids (t)</TableHead>
                        <TableHead className="text-right">Montant HT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            Aucun ordre trouvé pour cette période et ce client.
                          </TableCell>
                        </TableRow>
                      ) : (
                        selectedOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell>{format(new Date(order.pickup_date), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>{order.order_number}</TableCell>
                            <TableCell className="max-w-[200px] truncate" title={`${order.pickup_address} -> ${order.delivery_address}`}>
                              {order.pickup_address} <span className="text-muted-foreground">→</span> {order.delivery_address}
                            </TableCell>
                            <TableCell className="text-right">{Number(order.weight_tons).toFixed(2)}</TableCell>
                            <TableCell className="text-right font-medium">{Number(order.amount_ht).toFixed(2)} MAD</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDetailsOpen(false)}>Fermer</Button>
                <Button onClick={() => handleDownloadPdf(selectedInvoice)}>
                  <FileDown className="w-4 h-4 mr-2" /> Télécharger PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
