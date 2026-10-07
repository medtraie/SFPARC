import { useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { RentalReservation, useRentalReservations, useRentalReservationMutations } from '@/hooks/useRental';
import { RentalReservationForm } from '@/components/rental/RentalReservationForm';

function statusBadge(status: string) {
  if (status === 'pending') return <Badge className="bg-amber-600 hover:bg-amber-600">En attente</Badge>;
  if (status === 'confirmed') return <Badge className="bg-sky-600 hover:bg-sky-600">Confirmée</Badge>;
  if (status === 'cancelled') return <Badge variant="destructive">Annulée</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export function RentalReservationsList() {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RentalReservation | null>(null);
  const reservationsQ = useRentalReservations();
  const { remove } = useRentalReservationMutations();

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const rows = reservationsQ.data || [];
    if (!s) return rows;
    return rows.filter((r) => {
      const hay = `${r.reservation_number} ${r.client?.full_name || ''} ${r.vehicle?.registration || ''} ${r.status}`.toLowerCase();
      return hay.includes(s);
    });
  }, [reservationsQ.data, search]);

  const onAdd = () => {
    setEditing(null);
    setOpen(true);
  };

  const onEdit = (r: RentalReservation) => {
    setEditing(r);
    setOpen(true);
  };

  return (
    <Card className="dashboard-panel">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Réservations</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={onAdd} className="gap-2">
              <Plus className="w-4 h-4" />
              Nouvelle réservation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Modifier réservation' : 'Nouvelle réservation'}</DialogTitle>
            </DialogHeader>
            <RentalReservationForm
              reservation={editing}
              onDone={() => {
                setOpen(false);
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
                <TableHead className="text-right">Prix</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservationsQ.isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Aucune réservation
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.reservation_number}</TableCell>
                    <TableCell>{r.client?.full_name || '-'}</TableCell>
                    <TableCell>{r.vehicle?.registration || '-'}</TableCell>
                    <TableCell>{format(new Date(r.start_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{format(new Date(r.end_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-right">{Number(r.total_price || 0).toLocaleString('fr-MA')} MAD</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="icon" onClick={() => onEdit(r)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => remove.mutate(r.id)}
                          disabled={remove.isPending}
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

