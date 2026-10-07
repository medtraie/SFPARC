import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileDown, Plus, Search, Pencil, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RentalContract, useRentalContracts, useRentalContractMutations, useRentalRentals } from '@/hooks/useRental';
import { RentalContractForm } from '@/components/rental/RentalContractForm';

function toSafeDate(s?: string | null) {
  if (!s) return '';
  try {
    return format(new Date(s), 'yyyy-MM-dd');
  } catch {
    return String(s).slice(0, 10);
  }
}

function safeJsonObject(v: any) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  return {};
}

export function RentalContractsList() {
  const contractsQ = useRentalContracts();
  const rentalsQ = useRentalRentals();
  const { remove } = useRentalContractMutations();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RentalContract | null>(null);

  const rows = useMemo(() => {
    const rentalsById = new Map((rentalsQ.data || []).map((r) => [r.id, r]));
    const base = (contractsQ.data || []).map((c) => {
      const rental = rentalsById.get(c.rental_id) || null;
      const json = safeJsonObject(c.contract_json);
      const lessee = safeJsonObject(json.lessee);
      const vehicle = safeJsonObject(json.vehicle);
      return {
        contract: c,
        rental,
        clientName: String(rental?.client?.full_name || lessee.name || ''),
        vehicleReg: String(rental?.vehicle?.registration || vehicle.registration || ''),
        rentalNumber: String(rental?.rental_number || (json.rental as any)?.rental_number || ''),
      };
    });

    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((r) => {
      const c = r.contract;
      return (
        String(c.contract_number || '').toLowerCase().includes(q) ||
        r.rentalNumber.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q) ||
        r.vehicleReg.toLowerCase().includes(q)
      );
    });
  }, [contractsQ.data, rentalsQ.data, search]);

  const downloadPdf = (row: ReturnType<typeof rows>[number]) => {
    const c = row.contract;
    const rental = row.rental as any;
    const json = safeJsonObject(c.contract_json);
    const lessor = safeJsonObject(json.lessor);
    const lessee = safeJsonObject(json.lessee);
    const vehicle = safeJsonObject(json.vehicle);
    const extra = safeJsonObject(json.extra);
    const photos = safeJsonObject(json.photos);

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    doc.setFontSize(14);
    doc.text('Contrat de location', 40, 50);
    doc.setFontSize(10);
    doc.text(`N°: ${c.contract_number}`, 40, 70);
    doc.text(`Date: ${toSafeDate(c.created_at)}`, 40, 84);

    autoTable(doc, {
      startY: 110,
      head: [['Champ', 'Valeur']],
      body: [
        ['Loueur', `${lessor.name || ''} ${lessor.phone ? `(${lessor.phone})` : ''}`.trim()],
        ['Locataire', `${lessee.name || row.clientName || ''} ${lessee.phone ? `(${lessee.phone})` : ''}`.trim()],
        ['Véhicule', `${vehicle.registration || row.vehicleReg || ''} ${vehicle.brand || ''} ${vehicle.model || ''}`.trim()],
        ['Location', `${row.rentalNumber || ''}`],
        ['Début', toSafeDate(rental?.start_datetime || (json.rental as any)?.start_datetime)],
        ['Fin', toSafeDate(rental?.end_datetime || (json.rental as any)?.end_datetime)],
        ['Total', `${Number(rental?.total_price || (json.rental as any)?.total_price || 0).toFixed(2)} MAD`],
        ['Caution', extra.deposit_amount != null ? `${Number(extra.deposit_amount).toFixed(2)} MAD` : ''],
        ['Km départ', extra.start_mileage != null ? String(extra.start_mileage) : ''],
        ['Carburant départ', extra.fuel_level_start != null ? `${extra.fuel_level_start}%` : ''],
        ['Signé', c.signed_at ? `Oui (${toSafeDate(c.signed_at)})` : 'Non'],
      ],
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [17, 24, 39] },
    });

    const photoLinks: string[] = [];
    const dep = Array.isArray(photos.departure) ? photos.departure : [];
    const ret = Array.isArray(photos.return) ? photos.return : [];
    for (const u of [...dep, ...ret]) {
      if (typeof u === 'string') photoLinks.push(u);
    }

    if (photoLinks.length) {
      const startY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 16 : 480;
      doc.setFontSize(10);
      doc.text('Photos (liens):', 40, startY);
      const max = Math.min(10, photoLinks.length);
      for (let i = 0; i < max; i++) {
        doc.setFontSize(8);
        doc.text(photoLinks[i], 40, startY + 14 + i * 12);
      }
    }

    doc.save(`${c.contract_number}.pdf`);
  };

  return (
    <Card className="dashboard-panel">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between space-y-0">
        <CardTitle>Contrats</CardTitle>
        <Dialog
          open={dialogOpen}
          onOpenChange={(o) => {
            setDialogOpen(o);
            if (!o) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nouveau contrat
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Modifier contrat' : 'Nouveau contrat'}</DialogTitle>
            </DialogHeader>
            <RentalContractForm
              contract={editing}
              onDone={() => {
                setDialogOpen(false);
                setEditing(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher (contrat, location, client, véhicule...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Véhicule</TableHead>
                <TableHead>Signé</TableHead>
                <TableHead className="w-[200px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contractsQ.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Aucun contrat
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.contract.id}>
                    <TableCell className="font-medium">{r.contract.contract_number}</TableCell>
                    <TableCell>{r.rentalNumber || '-'}</TableCell>
                    <TableCell>{r.clientName || '-'}</TableCell>
                    <TableCell>{r.vehicleReg || '-'}</TableCell>
                    <TableCell>
                      {r.contract.signed_at ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">Signé</Badge>
                      ) : (
                        <Badge variant="outline">Brouillon</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button type="button" size="icon" variant="outline" onClick={() => downloadPdf(r)}>
                          <FileDown className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => {
                            setEditing(r.contract);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          disabled={remove.isPending}
                          onClick={async () => {
                            await remove.mutateAsync(r.contract.id);
                          }}
                        >
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
      </CardContent>
    </Card>
  );
}

