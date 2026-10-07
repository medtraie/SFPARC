import { useState, useMemo } from 'react';
import { useFactures, useDeleteFacture, useUpdateFacture, useVoyages, type Facture, type Voyage } from '@/hooks/useTransportBTP';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileDown, Eye, FileText, Trash2, Loader2, Send, CheckCircle, DollarSign } from 'lucide-react';
import { FactureForm } from './FactureForm';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTourismCompanyProfile } from '@/hooks/useTourismCompany';

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  sent: 'default',
  paid: 'outline',
  cancelled: 'destructive',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
  cancelled: 'Annulée',
};

export function FacturesList() {
  const { data: factures = [], isLoading } = useFactures();
  const { data: voyages = [] } = useVoyages();
  const { data: companyProfile } = useTourismCompanyProfile();
  const deleteFacture = useDeleteFacture();
  const updateFacture = useUpdateFacture();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null);

  // Calculate stats
  const totalPaid = factures
    .filter((f) => f.status === 'paid')
    .reduce((sum, f) => sum + Number(f.total_with_tax), 0);
  const totalPending = factures
    .filter((f) => f.status === 'sent' || f.status === 'draft')
    .reduce((sum, f) => sum + Number(f.total_with_tax), 0);

  const handleStatusChange = (id: string, newStatus: string) => {
    updateFacture.mutate({ id, status: newStatus });
  };

  const getFactureVoyages = (facture: Facture) => {
    const fromDate = new Date(facture.date_from);
    const toDate = new Date(facture.date_to);
    return voyages.filter((voyage) => {
      const voyageDate = new Date(voyage.voyage_date);
      const matchesChantier = !facture.chantier_id ||
        facture.chantier_id === 'none' ||
        voyage.trajet?.origin_chantier_id === facture.chantier_id ||
        voyage.trajet?.destination_chantier_id === facture.chantier_id;
      return voyageDate >= fromDate && voyageDate <= toDate && matchesChantier && voyage.status === 'completed';
    });
  };

  const selectedVoyages = useMemo(() => {
    if (!selectedFacture) return [];
    return getFactureVoyages(selectedFacture);
  }, [selectedFacture, voyages]);

  const handleOpenDetails = (facture: Facture) => {
    setSelectedFacture(facture);
    setDetailsOpen(true);
  };

  const handleDownloadPdf = (facture: Facture) => {
    const factureVoyages = getFactureVoyages(facture);
    const doc = new jsPDF();
    const formatCurrency = (value: number) => `${value.toFixed(2)} MAD`;
    const periodLabel = `${format(new Date(facture.date_from), 'dd/MM/yyyy')} - ${format(new Date(facture.date_to), 'dd/MM/yyyy')}`;

    doc.setFillColor(22, 78, 99);
    doc.rect(0, 0, 210, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(companyProfile?.company_name || 'SFTM', 14, 18);
    doc.setFontSize(11);
    doc.text('Facture', 14, 26);

    doc.setTextColor(17, 24, 39);
    doc.setFontSize(18);
    doc.text(`FAC ${facture.facture_number}`, 196, 20, { align: 'right' });
    doc.setFontSize(10);
    doc.text(`Statut: ${STATUS_LABELS[facture.status] || facture.status}`, 196, 26, { align: 'right' });
    doc.text(`Date: ${format(new Date(), 'dd/MM/yyyy')}`, 196, 31, { align: 'right' });

    doc.setFontSize(11);
    doc.text('Client', 14, 42);
    doc.setFontSize(12);
    doc.text(facture.client_name, 14, 48);
    doc.setFontSize(10);
    if (facture.client_address) {
      doc.text(facture.client_address, 14, 54);
    }
    if (facture.chantier) {
      doc.text(`Chantier: ${facture.chantier.name}`, 14, facture.client_address ? 60 : 54);
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
    doc.text('Voyages', 20, summaryY + 10);
    doc.text('Tonnage', 70, summaryY + 10);
    doc.text('Montant HT', 120, summaryY + 10);
    doc.text('TVA', 160, summaryY + 10);
    doc.setFontSize(12);
    doc.setTextColor(17, 24, 39);
    doc.text(String(facture.total_trips), 20, summaryY + 20);
    doc.text(`${Number(facture.total_tonnage).toFixed(2)} t`, 70, summaryY + 20);
    doc.text(formatCurrency(Number(facture.total_amount)), 120, summaryY + 20);
    doc.text(`${Number(facture.tax_rate).toFixed(2)}%`, 160, summaryY + 20);

    const totalY = summaryY + 36;
    doc.setFontSize(12);
    doc.text('Total TTC', 196, totalY, { align: 'right' });
    doc.setFontSize(16);
    doc.text(formatCurrency(Number(facture.total_with_tax)), 196, totalY + 8, { align: 'right' });

    const rows = factureVoyages.map((voyage) => {
      const pricePerTon = voyage.trajet?.price_per_ton || 0;
      const amount = Number(voyage.tonnage) * Number(pricePerTon);
      return [
        format(new Date(voyage.voyage_date), 'dd/MM/yyyy'),
        voyage.trajet?.name || '-',
        Number(voyage.tonnage).toFixed(2),
        Number(pricePerTon).toFixed(2),
        amount.toFixed(2),
      ];
    });

    autoTable(doc, {
      startY: totalY + 16,
      head: [['Date', 'Trajet', 'Tonnage', 'Prix/T', 'Montant']],
      body: rows.length ? rows : [['-', '-', '-', '-', '-']],
      theme: 'striped',
      headStyles: { fillColor: [22, 78, 99], textColor: 255 },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        2: { halign: 'right' },
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

    doc.save(`${facture.facture_number}.pdf`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Facturation & Reporting</h2>
          <p className="text-sm text-muted-foreground">
            {factures.length} facture(s) • {totalPaid.toFixed(2)} MAD encaissé
          </p>
        </div>
        <FactureForm />
      </div>

      {/* Stats Cards */}
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
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total factures</p>
              <p className="text-2xl font-bold">{factures.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {factures.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucune facture créée</p>
            <p className="text-sm text-muted-foreground">Créez votre première facture basée sur les voyages</p>
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
                  <TableHead className="text-right">Voyages</TableHead>
                  <TableHead className="text-right">Tonnage</TableHead>
                  <TableHead className="text-right">Montant TTC</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {factures.map((facture) => (
                  <TableRow key={facture.id}>
                    <TableCell className="font-medium">{facture.facture_number}</TableCell>
                    <TableCell>
                      <div>
                        <p>{facture.client_name}</p>
                        {facture.chantier && (
                          <p className="text-xs text-muted-foreground">{facture.chantier.name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(facture.date_from), 'dd/MM', { locale: fr })} -{' '}
                      {format(new Date(facture.date_to), 'dd/MM/yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell className="text-right">{facture.total_trips}</TableCell>
                    <TableCell className="text-right">{Number(facture.total_tonnage).toFixed(2)} t</TableCell>
                    <TableCell className="text-right font-semibold">
                      {Number(facture.total_with_tax).toFixed(2)} MAD
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-auto p-0">
                            <Badge variant={STATUS_COLORS[facture.status] || 'secondary'}>
                              {STATUS_LABELS[facture.status] || facture.status}
                            </Badge>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleStatusChange(facture.id, 'draft')}>
                            <FileText className="w-4 h-4 mr-2" /> Brouillon
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(facture.id, 'sent')}>
                            <Send className="w-4 h-4 mr-2" /> Envoyée
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(facture.id, 'paid')}>
                            <CheckCircle className="w-4 h-4 mr-2" /> Payée
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenDetails(facture)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDownloadPdf(facture)}
                        >
                          <FileDown className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer cette facture ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible. La facture "{facture.facture_number}" sera supprimée définitivement.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteFacture.mutate(facture.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Supprimer
                              </AlertDialogAction>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails facture</DialogTitle>
          </DialogHeader>
          {selectedFacture && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">N° Facture</p>
                  <p className="font-medium">{selectedFacture.facture_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Client</p>
                  <p className="font-medium">{selectedFacture.client_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Période</p>
                  <p className="font-medium">
                    {format(new Date(selectedFacture.date_from), 'dd/MM/yyyy')} - {format(new Date(selectedFacture.date_to), 'dd/MM/yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Chantier</p>
                  <p className="font-medium">{selectedFacture.chantier?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Voyages</p>
                  <p className="font-medium">{selectedFacture.total_trips}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tonnage</p>
                  <p className="font-medium">{Number(selectedFacture.total_tonnage).toFixed(2)} t</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Montant HT</p>
                  <p className="font-medium">{Number(selectedFacture.total_amount).toFixed(2)} MAD</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total TTC</p>
                  <p className="font-medium">{Number(selectedFacture.total_with_tax).toFixed(2)} MAD</p>
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Trajet</TableHead>
                      <TableHead className="text-right">Tonnage</TableHead>
                      <TableHead className="text-right">Prix/T</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedVoyages.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Aucun voyage pour cette période
                        </TableCell>
                      </TableRow>
                    ) : (
                      selectedVoyages.map((voyage) => {
                        const pricePerTon = voyage.trajet?.price_per_ton || 0;
                        const amount = Number(voyage.tonnage) * Number(pricePerTon);
                        return (
                          <TableRow key={voyage.id}>
                            <TableCell>{format(new Date(voyage.voyage_date), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>{voyage.trajet?.name || '-'}</TableCell>
                            <TableCell className="text-right">{Number(voyage.tonnage).toFixed(2)}</TableCell>
                            <TableCell className="text-right">{Number(pricePerTon).toFixed(2)}</TableCell>
                            <TableCell className="text-right">{amount.toFixed(2)}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
