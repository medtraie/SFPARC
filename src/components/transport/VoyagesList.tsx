import { useVoyages, useDeleteVoyage } from '@/hooks/useTransportBTP';
import { useDrivers } from '@/hooks/useDrivers';
import { useGPSwoxVehicles } from '@/hooks/useGPSwoxVehicles';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TruckIcon, Trash2, Loader2, Calendar, Weight, FileText } from 'lucide-react';
import { VoyageForm } from './VoyageForm';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
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

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  in_progress: 'default',
  completed: 'outline',
  cancelled: 'destructive',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

const MATERIAL_LABELS: Record<string, string> = {
  sable: 'Sable',
  gravier: 'Gravier',
  beton: 'Béton',
  ciment: 'Ciment',
  terre: 'Terre',
  pierres: 'Pierres',
  autre: 'Autre',
};

export function VoyagesList() {
  const { data: voyages = [], isLoading } = useVoyages();
  const { data: drivers = [] } = useDrivers();
  const { data: vehicles = [] } = useGPSwoxVehicles();
  const deleteVoyage = useDeleteVoyage();

  const getDriverName = (driverId: string | null) => {
    if (!driverId) return '-';
    const driver = drivers.find((d) => d.id === driverId);
    return driver?.name || '-';
  };

  const getVehicleName = (vehicleId: string) => {
    const vehicle = vehicles.find((v) => v.id.toString() === vehicleId);
    return vehicle ? `${vehicle.plate}` : vehicleId;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Calculate stats
  const totalTonnage = voyages.reduce((sum, v) => sum + Number(v.tonnage), 0);
  const todayVoyages = voyages.filter(
    (v) => v.voyage_date === new Date().toISOString().split('T')[0]
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Voyages & Tonnage</h2>
          <p className="text-sm text-muted-foreground">
            {voyages.length} voyage(s) enregistré(s) • {totalTonnage.toFixed(2)} tonnes au total
          </p>
        </div>
        <VoyageForm />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="dashboard-panel">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Aujourd&apos;hui</p>
              <p className="text-2xl font-bold">{todayVoyages} voyages</p>
            </div>
          </CardContent>
        </Card>
        <Card className="dashboard-panel">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-lg bg-info/10 flex items-center justify-center">
              <Weight className="w-6 h-6 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tonnage total</p>
              <p className="text-2xl font-bold">{totalTonnage.toFixed(0)} t</p>
            </div>
          </CardContent>
        </Card>
        <Card className="dashboard-panel">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
              <TruckIcon className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total voyages</p>
              <p className="text-2xl font-bold">{voyages.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {voyages.length === 0 ? (
        <Card className="dashboard-panel">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TruckIcon className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucun voyage enregistré</p>
            <p className="text-sm text-muted-foreground">Enregistrez vos premiers voyages et tonnages</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="dashboard-panel">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Véhicule</TableHead>
                  <TableHead>Chauffeur</TableHead>
                  <TableHead>Trajet</TableHead>
                  <TableHead>Matériau</TableHead>
                  <TableHead className="text-right">Tonnage</TableHead>
                  <TableHead>N° Bon</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {voyages.map((voyage) => (
                  <TableRow key={voyage.id}>
                    <TableCell>
                      {format(new Date(voyage.voyage_date), 'dd MMM yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {getVehicleName(voyage.vehicle_id)}
                    </TableCell>
                    <TableCell>{getDriverName(voyage.driver_id)}</TableCell>
                    <TableCell>{voyage.trajet?.name || '-'}</TableCell>
                    <TableCell>
                      {voyage.material_type ? MATERIAL_LABELS[voyage.material_type] || voyage.material_type : '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {Number(voyage.tonnage).toFixed(2)} t
                    </TableCell>
                    <TableCell>
                      {voyage.bon_number ? (
                        <div className="flex items-center gap-1">
                          <FileText className="w-3 h-3 text-muted-foreground" />
                          {voyage.bon_number}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_COLORS[voyage.status] || 'secondary'}>
                        {STATUS_LABELS[voyage.status] || voyage.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer ce voyage ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action est irréversible. Ce voyage sera supprimé définitivement.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteVoyage.mutate(voyage.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
