import { useMemo, useState } from 'react';
import { CheckCircle2, Plus, Search, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  RentalReservation,
  useCreateRentalFromReservation,
  useRentalRentals,
  useRentalReservations,
  useCompleteRental,
  useDeleteRental,
} from '@/hooks/useRental';

function statusBadge(status: string) {
  if (status === 'active') return <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>;
  if (status === 'completed') return <Badge variant="secondary">Clôturée</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export function RentalRentalsList() {
  const [search, setSearch] = useState('');
  const rentalsQ = useRentalRentals();
  const reservationsQ = useRentalReservations();
  const createFromReservation = useCreateRentalFromReservation();
  const completeRental = useCompleteRental();
  const deleteRental = useDeleteRental();

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const rows = rentalsQ.data || [];
    if (!s) return rows;
    return rows.filter((r) => {
      const hay = `${r.rental_number} ${r.client?.full_name || ''} ${r.vehicle?.registration || ''} ${r.status}`.toLowerCase();
      return hay.includes(s);
    });
  }, [rentalsQ.data, search]);

  const availableReservations = useMemo(() => {
    const list = (reservationsQ.data || []).filter((r) => r.status === 'confirmed');
    const already = new Set((rentalsQ.data || []).map((x) => x.reservation_id).filter(Boolean) as string[]);
    return list.filter((r) => !already.has(r.id));
  }, [reservationsQ.data, rentalsQ.data]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [reservationId, setReservationId] = useState<string>('');

  const selectedReservation = useMemo<RentalReservation | null>(() => {
    return availableReservations.find((r) => r.id === reservationId) || null;
  }, [availableReservations, reservationId]);

  const canCreate = Boolean(selectedReservation && !createFromReservation.isPending);

  return (
    <Card className="dashboard-panel">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Locations (Contrats)</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Créer location
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Créer une location depuis une réservation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Réservation confirmée</div>
                <Select value={reservationId} onValueChange={setReservationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableReservations.length === 0 ? (
                      <SelectItem value="none" disabled>
                        Aucune réservation confirmée
                      </SelectItem>
                    ) : (
                      availableReservations.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.reservation_number} — {r.client?.full_name || '-'} — {r.vehicle?.registration || '-'}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedReservation && (
                <div className="border rounded-lg p-3 text-sm space-y-1 bg-muted/20">
                  <div>
                    <span className="text-muted-foreground">Client:</span> {selectedReservation.client?.full_name || '-'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Véhicule:</span> {selectedReservation.vehicle?.registration || '-'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Période:</span>{' '}
                    {format(new Date(selectedReservation.start_date), 'dd/MM/yyyy')} →{' '}
                    {format(new Date(selectedReservation.end_date), 'dd/MM/yyyy')}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total:</span>{' '}
                    {Number(selectedReservation.total_price || 0).toLocaleString('fr-MA')} MAD
                  </div>
                </div>
              )}

              <Button
                className="w-full"
                disabled={!canCreate}
                onClick={async () => {
                  if (!selectedReservation) return;
                  await createFromReservation.mutateAsync(selectedReservation.id);
                  setDialogOpen(false);
                  setReservationId('');
                }}
              >
                Créer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher (numéro, client, véhicule...)"
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
                <TableHead>Client</TableHead>
                <TableHead>Véhicule</TableHead>
                <TableHead>Début</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-[160px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rentalsQ.isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Aucune location
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.rental_number}</TableCell>
                    <TableCell>{r.client?.full_name || '-'}</TableCell>
                    <TableCell>{r.vehicle?.registration || '-'}</TableCell>
                    <TableCell>{format(new Date(r.start_datetime), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{r.end_datetime ? format(new Date(r.end_datetime), 'dd/MM/yyyy') : '-'}</TableCell>
                    <TableCell className="text-right">{Number(r.total_price || 0).toLocaleString('fr-MA')} MAD</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={completeRental.isPending || r.status !== 'active'}
                          onClick={() => completeRental.mutate(r.id)}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={deleteRental.isPending}
                          onClick={() => deleteRental.mutate(r.id)}
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
