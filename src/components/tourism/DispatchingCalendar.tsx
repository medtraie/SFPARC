import { useTourismMissions, useUpdateTourismMission, TourismMission } from '@/hooks/useTourism';
import { useDrivers } from '@/hooks/useDrivers';
import { useGPSwoxVehicles } from '@/hooks/useGPSwoxVehicles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Truck, User, CheckCircle2, Clock, Plane, Mountain, Route, Car } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function DispatchingCalendar() {
  const { data: missions, isLoading: missionsLoading } = useTourismMissions();
  const { data: drivers } = useDrivers();
  const { data: vehicles } = useGPSwoxVehicles();
  const updateMission = useUpdateTourismMission();
  const [selectedDate, setSelectedDate] = useState(new Date());

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const pendingMissions = missions?.filter(m => m.status === 'planned' || m.status === 'dispatched') || [];
  const getMissionsForDate = (date: Date) => 
    missions?.filter(m => isSameDay(new Date(m.start_date), date)) || [];

  const handleDispatch = (missionId: string, vehicleId: string, driverId: string) => {
    updateMission.mutate({
      id: missionId,
      vehicle_id: vehicleId,
      driver_id: driverId,
      status: 'dispatched',
    });
  };

  const typeIcon: Record<string, React.ReactNode> = {
    transfer: <Plane className="w-3 h-3" />,
    excursion: <Mountain className="w-3 h-3" />,
    circuit: <Route className="w-3 h-3" />,
    rental: <Car className="w-3 h-3" />,
  };

  if (missionsLoading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="space-y-6">
      {/* Week View */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Planning de la semaine
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(addDays(selectedDate, -7))}
              >
                Semaine précédente
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(new Date())}
              >
                Aujourd'hui
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(addDays(selectedDate, 7))}
              >
                Semaine suivante
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const dayMissions = getMissionsForDate(day);
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'border rounded-lg p-2 min-h-[120px]',
                    isToday && 'border-primary bg-primary/5'
                  )}
                >
                  <div className="text-sm font-medium mb-2">
                    <div className={cn('text-center', isToday && 'text-primary')}>
                      {format(day, 'EEE', { locale: fr })}
                    </div>
                    <div className={cn('text-center text-lg', isToday && 'text-primary font-bold')}>
                      {format(day, 'd')}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {dayMissions.slice(0, 3).map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          'text-xs p-1 rounded truncate',
                          m.status === 'dispatched' && 'bg-purple-100 text-purple-800',
                          m.status === 'planned' && 'bg-blue-100 text-blue-800',
                          m.status === 'in_progress' && 'bg-yellow-100 text-yellow-800',
                          m.status === 'completed' && 'bg-green-100 text-green-800'
                        )}
                      >
                        <div className="flex items-center gap-1">
                          {typeIcon[m.mission_type]}
                          <span className="truncate">{m.title}</span>
                        </div>
                      </div>
                    ))}
                    {dayMissions.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{dayMissions.length - 3} autres
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Pending Dispatch */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Missions à dispatcher ({pendingMissions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingMissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Toutes les missions sont dispatchées</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingMissions.map((mission) => (
                <DispatchRow
                  key={mission.id}
                  mission={mission}
                  drivers={drivers || []}
                  vehicles={vehicles || []}
                  onDispatch={handleDispatch}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface DispatchRowProps {
  mission: TourismMission;
  drivers: Array<{ id: string; name: string; status: string; phone: string; license_type: string; license_expiry: string; vehicle_id: string | null; created_at: string; updated_at: string }>;
  vehicles: Array<{ id: string; plate: string; brand: string; model: string }>;
  onDispatch: (missionId: string, vehicleId: string, driverId: string) => void;
}

function DispatchRow({ mission, drivers, vehicles, onDispatch }: DispatchRowProps) {
  const [selectedVehicle, setSelectedVehicle] = useState(mission.vehicle_id || '');
  const [selectedDriver, setSelectedDriver] = useState(mission.driver_id || '');

  const canDispatch = selectedVehicle && selectedDriver && mission.status === 'planned';

  return (
    <div className="flex items-center gap-4 p-3 border rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {mission.reference}
          </Badge>
          <span className="font-medium truncate">{mission.title}</span>
        </div>
        <div className="text-sm text-muted-foreground">
          {format(new Date(mission.start_date), 'dd MMM yyyy', { locale: fr })}
          {mission.start_time && ` à ${mission.start_time.substring(0, 5)}`}
          {' • '}
          {mission.passengers_count} passager(s)
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
          <SelectTrigger className="w-[160px]">
            <Truck className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Véhicule" />
          </SelectTrigger>
          <SelectContent>
            {vehicles.map((v) => (
              <SelectItem key={v.id} value={v.plate}>
                {v.plate}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedDriver} onValueChange={setSelectedDriver}>
          <SelectTrigger className="w-[160px]">
            <User className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Chauffeur" />
          </SelectTrigger>
          <SelectContent>
            {drivers.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          disabled={!canDispatch}
          onClick={() => onDispatch(mission.id, selectedVehicle, selectedDriver)}
        >
          <CheckCircle2 className="w-4 h-4 mr-1" />
          Dispatcher
        </Button>
      </div>
    </div>
  );
}
