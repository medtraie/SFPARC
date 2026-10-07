import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileDown, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RentalInvoice, useRentalInvoiceMutations, useRentalInvoices, useRentalRentals } from '@/hooks/useRental';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
  cancelled: 'Annulée',
};

function statusBadge(status: string) {
  if (status === 'draft') return <Badge variant="secondary">Brouillon</Badge>;
  if (status === 'sent') return <Badge className="bg-sky-600 hover:bg-sky-600">Envoyée</Badge>;
  if (status === 'paid') return <Badge className="bg-emerald-600 hover:bg-emerald-600">Payée</Badge>;
  if (status === 'cancelled') return <Badge variant="destructive">Annulée</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function formatCurrency(v: number) {
  return `${Number(v || 0).toFixed(2)} MAD`;
}

function computeInvoiceTotal(rental: any) {
  const base = Number(rental.total_price || 0);
  const extras = Number(rental.extra_charges || 0);
  const late = Number(rental.late_penalty || 0);
  const fuel = Number(rental.missing_fuel_charge || 0);
  return Number((base + extras + late + fuel).toFixed(2));
}

export function RentalInvoicesList() {
  const invoicesQ = useRentalInvoices();
  const rentalsQ = useRentalRentals();
  const { create, update, remove } = useRentalInvoiceMutations();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rentalId, setRentalId] = useState('');

  const invoices = invoicesQ.data || [];
  const rentals = rentalsQ.data || [];

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return invoices;
    return invoices.filter((inv) => {
      const rental = inv.rental as any;
      const clientName = rental?.client?.full_name || '';
      const plate = rental?.vehicle?.registration || '';
      const hay = `${inv.invoice_number} ${inv.status} ${clientName} ${plate}`.toLowerCase();
      return hay.includes(s);
    });
  }, [invoices, search]);

  const rentalsWithoutInvoice = useMemo(() => {
    const has = new Set(invoices.map((i) => i.rental_id));
    return rentals.filter((r) => !has.has(r.id));
  }, [invoices, rentals]);

  const selectedRental = useMemo(() => rentalsWithoutInvoice.find((r) => r.id === rentalId) || null, [rentalsWithoutInvoice, rentalId]);

  const downloadPdf = (invoice: RentalInvoice & { rental: any }) => {
    const rental = invoice.rental;
    const client = rental?.client;
    const vehicle = rental?.vehicle;

    const doc = new jsPDF();
    doc.setFillColor(22, 78, 99);
    doc.rect(0, 0, 210, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('SFTM', 14, 18);
    doc.setFontSize(11);
    doc.text('Facture Location Véhicule', 14, 26);

    doc.setTextColor(17, 24, 39);
    doc.setFontSize(18);
    doc.text(`${invoice.invoice_number}`, 196, 20, { align: 'right' });
    doc.setFontSize(10);
    doc.text(`Statut: ${STATUS_LABELS[invoice.status] || invoice.status}`, 196, 26, { align: 'right' });
    doc.text(`Date: ${format(new Date(invoice.issue_date), 'dd/MM/yyyy')}`, 196, 31, { align: 'right' });

    doc.setFontSize(11);
    doc.text('Client', 14, 42);
    doc.setFontSize(12);
    doc.text(client?.full_name || '-', 14, 48);
    doc.setFontSize(10);
    if (client?.phone) doc.text(client.phone, 14, 54);
    if (client?.email) doc.text(client.email, 14, client?.phone ? 60 : 54);

    doc.setFontSize(11);
    doc.text('Véhicule', 196, 42, { align: 'right' });
    doc.setFontSize(12);
    doc.text(vehicle?.registration || '-', 196, 48, { align: 'right' });
    doc.setFontSize(10);
    doc.text(`${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim() || '-', 196, 54, { align: 'right' });

    const start = rental?.start_datetime ? format(new Date(rental.start_datetime), 'dd/MM/yyyy') : '-';
    const end = rental?.end_datetime ? format(new Date(rental.end_datetime), 'dd/MM/yyyy') : '-';
    doc.setFontSize(11);
    doc.text('Période', 14, 68);
    doc.setFontSize(12);
    doc.text(`${start} → ${end}`, 14, 74);

    const rows: Array<[string, string, string, string]> = [];
    rows.push(['Location', '1', formatCurrency(Number(rental.total_price || 0)), formatCurrency(Number(rental.total_price || 0))]);
    if (Number(rental.extra_charges || 0) > 0) rows.push(['Frais supplémentaires', '1', formatCurrency(Number(rental.extra_charges || 0)), formatCurrency(Number(rental.extra_charges || 0))]);
    if (Number(rental.late_penalty || 0) > 0) rows.push(['Pénalité retard', '1', formatCurrency(Number(rental.late_penalty || 0)), formatCurrency(Number(rental.late_penalty || 0))]);
    if (Number(rental.missing_fuel_charge || 0) > 0) rows.push(['Carburant manquant', '1', formatCurrency(Number(rental.missing_fuel_charge || 0)), formatCurrency(Number(rental.missing_fuel_charge || 0))]);

    autoTable(doc, {
      head: [['Désignation', 'Qté', 'PU', 'Total']],
      body: rows,
      startY: 82,
      theme: 'grid',
      headStyles: { fillColor: [22, 78, 99], textColor: 255 },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 120;
    doc.setFontSize(12);
    doc.text('Total', 160, finalY + 10, { align: 'right' });
    doc.setFontSize(14);
    doc.text(formatCurrency(Number(invoice.amount_total || 0)), 196, finalY + 10, { align: 'right' });

    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 18, 196, pageHeight - 18);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Merci pour votre confiance', 14, pageHeight - 10);

    doc.save(`${invoice.invoice_number}.pdf`);
  };

  const createInvoice = async () => {
    if (!selectedRental) return;
    const total = computeInvoiceTotal(selectedRental);
    await create.mutateAsync({
      rental_id: selectedRental.id,
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      amount_total: total,
      status: 'draft',
      invoice_json: {
        rental_number: selectedRental.rental_number,
        client: selectedRental.client,
        vehicle: selectedRental.vehicle,
        totals: {
          base: Number(selectedRental.total_price || 0),
          extra_charges: Number(selectedRental.extra_charges || 0),
          late_penalty: Number(selectedRental.late_penalty || 0),
          missing_fuel_charge: Number(selectedRental.missing_fuel_charge || 0),
          total,
        },
      },
    } as any);
    setDialogOpen(false);
    setRentalId('');
  };

  return (
    <Card className="dashboard-panel">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Facturation</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Créer facture
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Créer une facture depuis une location</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Location</div>
                <Select value={rentalId} onValueChange={setRentalId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    {rentalsWithoutInvoice.length === 0 ? (
                      <SelectItem value="none" disabled>
                        Aucune location disponible
                      </SelectItem>
                    ) : (
                      rentalsWithoutInvoice.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.rental_number} — {r.client?.full_name || '-'} — {r.vehicle?.registration || '-'}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedRental && (
                <div className="border rounded-lg p-3 text-sm space-y-1 bg-muted/20">
                  <div>
                    <span className="text-muted-foreground">Total:</span> {formatCurrency(computeInvoiceTotal(selectedRental))}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Location: {formatCurrency(Number(selectedRental.total_price || 0))} | Extras: {formatCurrency(Number(selectedRental.extra_charges || 0))}
                  </div>
                </div>
              )}

              <Button className="w-full" disabled={!selectedRental || create.isPending} onClick={createInvoice}>
                Créer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input placeholder="Rechercher (numéro, client, véhicule...)" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Facture</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Véhicule</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoicesQ.isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Aucune facture
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((inv) => {
                  const rental = (inv as any).rental;
                  const client = rental?.client;
                  const vehicle = rental?.vehicle;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                      <TableCell>{rental?.rental_number || '-'}</TableCell>
                      <TableCell>{client?.full_name || '-'}</TableCell>
                      <TableCell>{vehicle?.registration || '-'}</TableCell>
                      <TableCell>{format(new Date(inv.issue_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(inv.amount_total || 0))}</TableCell>
                      <TableCell>{statusBadge(inv.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="icon" onClick={() => downloadPdf(inv as any)}>
                            <FileDown className="w-4 h-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => update.mutate({ id: inv.id, status: 'sent' } as any)}>Marquer envoyée</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => update.mutate({ id: inv.id, status: 'paid' } as any)}>Marquer payée</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => update.mutate({ id: inv.id, status: 'cancelled' } as any)}>Annuler</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => remove.mutate(inv.id)}>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

