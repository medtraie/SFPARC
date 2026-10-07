import { useState } from 'react';
import { usePassengerTrips, useDeletePassengerTrip, useUpdatePassengerTrip, usePassengerLines } from '@/hooks/usePassengerTransport';
import { useDrivers } from '@/hooks/useDrivers';
import { useGPSwoxVehicles } from '@/hooks/useGPSwoxVehicles';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Trash2, Calendar, Bus, Users } from 'lucide-react';
import { TripForm } from './TripForm';
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
  scheduled: 'secondary',
  boarding: 'default',
  departed: 'outline',
  arrived: 'outline',
  cancelled: 'destructive',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Planifié',
  boarding: 'Embarquement',
  departed: 'En route',
  arrived: 'Arrivé',
  cancelled: 'Annulé',
};

export function TripsList() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedLine, setSelectedLine] = useState<string>('all');
  
  const { data: trips = [], isLoading } = usePassengerTrips({ 
    date: selectedDate || undefined,
    lineId: selectedLine !== 'all' ? selectedLine : undefined 
  });
  const { data: lines = [] } = usePassengerLines();
  const { data: drivers = [] } = useDrivers();
  const { data: vehicles = [] } = useGPSwoxVehicles();
  const deleteTrip = useDeletePassengerTrip();
  const updateTrip = useUpdatePassengerTrip();

  const getDriverName = (driverId: string | null) => {
    if (!driverId) return '-';
    const driver = drivers.find((d) => d.id === driverId);
    return driver?.name || '-';
  };

  const getVehiclePlate = (vehicleId: string | null) => {
    if (!vehicleId) return '-';
    const vehicle = vehicles.find((v) => String(v.id) === vehicleId);
    return vehicle?.plate || '-';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Stats
  const todayTrips = trips.filter((t) => t.status === 'scheduled').length;
  const totalSeats = trips.reduce((sum, t) => sum + (t.available_seats || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Voyages planifiés</h2>
          <p className="text-sm text-muted-foreground">
            {trips.length} voyage(s) • {totalSeats} places disponibles
          </p>
        </div>
        <TripForm />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
        </div>
        <Select value={selectedLine} onValueChange={setSelectedLine}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Toutes les lignes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les lignes</SelectItem>
            {lines.map((line) => (
              <SelectItem key={line.id} value={line.id}>
                [{line.code}] {line.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Voyages du jour</p>
              <p className="text-2xl font-bold">{todayTrips}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-lg bg-info/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Places totales</p>
              <p className="text-2xl font-bold">{totalSeats}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
              <Bus className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lignes actives</p>
              <p className="text-2xl font-bold">{lines.filter((l) => l.status === 'active').length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {trips.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bus className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucun voyage planifié pour cette date</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ligne</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Horaires</TableHead>
                  <TableHead>Véhicule</TableHead>
                  <TableHead>Chauffeur</TableHead>
                  <TableHead className="text-center">Places</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell>
                      <div>
                        <Badge variant="outline" className="mb-1">{trip.line?.code}</Badge>
                        <p className="text-sm">{trip.line?.name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(trip.trip_date), 'dd MMM yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{trip.departure_time?.slice(0, 5)}</span>
                      {trip.arrival_time && (
                        <span className="text-muted-foreground"> → {trip.arrival_time.slice(0, 5)}</span>
                      )}
                    </TableCell>
                    <TableCell>{getVehiclePlate(trip.vehicle_id)}</TableCell>
                    <TableCell>{getDriverName(trip.driver_id)}</TableCell>
                    <TableCell className="text-center font-medium">{trip.available_seats}</TableCell>
                    <TableCell>
                      <Select 
                        value={trip.status} 
                        onValueChange={(status) => updateTrip.mutate({ id: trip.id, status })}
                      >
                        <SelectTrigger className="w-[130px] h-8">
                          <Badge variant={STATUS_COLORS[trip.status] || 'secondary'}>
                            {STATUS_LABELS[trip.status] || trip.status}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                              Cette action supprimera également tous les billets associés.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteTrip.mutate(trip.id)}
                              className="bg-destructive text-destructive-foreground"
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
