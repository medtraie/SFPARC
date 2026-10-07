import { useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RentalVehicle, useRentalVehicles, useRentalVehicleMutations } from '@/hooks/useRental';
import { RentalVehicleForm } from '@/components/rental/RentalVehicleForm';

function statusLabel(status: string) {
  if (status === 'available') return <Badge className="bg-emerald-600 hover:bg-emerald-600">Disponible</Badge>;
  if (status === 'rented') return <Badge className="bg-red-600 hover:bg-red-600">Loué</Badge>;
  if (status === 'maintenance') return <Badge className="bg-amber-600 hover:bg-amber-600">Maintenance</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export function RentalVehiclesList() {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RentalVehicle | null>(null);
  const vehiclesQ = useRentalVehicles();
  const { remove } = useRentalVehicleMutations();

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const rows = vehiclesQ.data || [];
    if (!s) return rows;
    return rows.filter((v) => {
      const hay = `${v.registration} ${v.brand} ${v.model} ${v.vehicle_type} ${v.status}`.toLowerCase();
      return hay.includes(s);
    });
  }, [vehiclesQ.data, search]);

  const onAdd = () => {
    setEditing(null);
    setOpen(true);
  };

  const onEdit = (v: RentalVehicle) => {
    setEditing(v);
    setOpen(true);
  };

  return (
    <Card className="dashboard-panel">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Gestion des Véhicules de Location</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={onAdd} className="gap-2">
              <Plus className="w-4 h-4" />
              Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Modifier véhicule' : 'Nouveau véhicule'}</DialogTitle>
            </DialogHeader>
            <RentalVehicleForm
              vehicle={editing}
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
            placeholder="Rechercher (immatriculation, marque, modèle...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Immatriculation</TableHead>
                <TableHead>Marque</TableHead>
                <TableHead>Modèle</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Prix/jour</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehiclesQ.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Aucun véhicule
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.registration}</TableCell>
                    <TableCell>{v.brand}</TableCell>
                    <TableCell>{v.model}</TableCell>
                    <TableCell className="capitalize">{v.vehicle_type}</TableCell>
                    <TableCell>{Number(v.price_per_day || 0).toLocaleString('fr-MA')} MAD</TableCell>
                    <TableCell>{statusLabel(v.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="icon" onClick={() => onEdit(v)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => remove.mutate(v.id)}
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

