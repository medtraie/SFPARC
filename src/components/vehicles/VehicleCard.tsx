import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { MapPin, MoreHorizontal, Gauge, User, Fuel, Battery, Truck, Car, Bus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GPSwoxVehicle } from '@/hooks/useGPSwoxVehicles';

interface VehicleCardProps {
  vehicle: GPSwoxVehicle;
  compact?: boolean;
  onDetails?: (vehicle: GPSwoxVehicle) => void;
}

const statusClasses = {
  active: 'status-badge status-active',
  inactive: 'status-badge status-inactive',
  maintenance: 'status-badge status-warning',
};

const statusLabels = {
  active: 'Actif',
  inactive: 'Inactif',
  maintenance: 'Maintenance',
};

const BATTERY_MAINTENANCE_THRESHOLD_V = 9;

// Determine vehicle icon based on name/plate
function getVehicleIcon(name: string) {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('bus')) return Bus;
  if (lowerName.includes('camion') || lowerName.includes('truck')) return Truck;
  if (lowerName.includes('fourgon') || lowerName.includes('van')) return Truck;
  return Car;
}

// Format time ago
function formatTimeAgo(timestamp: string | undefined): string {
  if (!timestamp) return 'Inconnu';
  
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins}m`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `Il y a ${diffDays}j`;
}

export function VehicleCard({ vehicle, compact = false, onDetails }: VehicleCardProps) {
  const navigate = useNavigate();
  const speed = vehicle.lastPosition?.speed || 0;
  const fuel = vehicle.fuelQuantity;
  const battery = vehicle.battery;
  const batteryVolts = battery !== null ? Number(battery) : null;
  const batteryIsLow = batteryVolts !== null && batteryVolts < BATTERY_MAINTENANCE_THRESHOLD_V;
  const effectiveStatus =
    vehicle.status === 'maintenance' && !batteryIsLow ? 'active' : vehicle.status;
  const isMoving = speed > 0;

  if (compact) {
    const VehicleIcon = getVehicleIcon(`${vehicle.plate} ${vehicle.brand} ${vehicle.model}`);
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary via-info to-success flex items-center justify-center text-white">
          <VehicleIcon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{vehicle.plate}</p>
          <p className="text-xs text-muted-foreground truncate">
            {vehicle.brand} {vehicle.model}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={statusClasses[effectiveStatus]}>
            {statusLabels[effectiveStatus]}
          </span>
          <span className={cn(
            'text-[10px] font-medium px-2 py-1 rounded-full',
            vehicle.online === 'online' ? 'bg-success/10 text-success' : 
            vehicle.online === 'ack' ? 'bg-warning/10 text-warning' :
            'bg-muted text-muted-foreground'
          )}>
            {vehicle.online === 'online' ? 'Online' : vehicle.online === 'ack' ? 'Ack' : 'Offline'}
          </span>
        </div>
      </div>
    );
  }

  const VehicleIcon = getVehicleIcon(`${vehicle.plate} ${vehicle.brand} ${vehicle.model}`);
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:shadow-lg hover:shadow-primary/5 transition-all animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary via-info to-success flex items-center justify-center text-white">
            <VehicleIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{vehicle.plate}</h3>
            <p className="text-sm text-muted-foreground">
              {vehicle.brand} {vehicle.model}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={statusClasses[effectiveStatus]}>
            <span className={cn(
              'w-1.5 h-1.5 rounded-full',
              effectiveStatus === 'active' && 'bg-success',
              effectiveStatus === 'inactive' && 'bg-muted-foreground',
              effectiveStatus === 'maintenance' && 'bg-warning'
            )} />
            {statusLabels[effectiveStatus]}
          </span>
          <span className={cn(
            'text-xs font-medium px-2 py-1 rounded-full',
            vehicle.online === 'online' ? 'bg-success/10 text-success' : 
            vehicle.online === 'ack' ? 'bg-warning/10 text-warning' :
            'bg-muted text-muted-foreground'
          )}>
            {vehicle.online === 'online' ? '🟢 En ligne' : 
             vehicle.online === 'ack' ? '🟡 En attente' : 
             '⚫ Hors ligne'}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                if (onDetails) {
                  onDetails(vehicle);
                  return;
                }
                navigate('/reports', {
                  state: { vehicleId: String(vehicle.id), plate: vehicle.plate, tab: 'summary' },
                });
              }}
            >
              Détails
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                navigate('/live-map', {
                  state: { vehicleId: String(vehicle.id) },
                })
              }
            >
              Voir sur la carte
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                navigate('/reports', {
                  state: { vehicleId: String(vehicle.id), plate: vehicle.plate, tab: 'vehicles' },
                })
              }
            >
              Historique
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {vehicle.mileage.toLocaleString()} km
          </span>
          {vehicle.distanceToday !== null && (
            <span className="text-sm text-muted-foreground">
              {vehicle.distanceToday.toLocaleString()} km aujourd'hui
            </span>
          )}
        </div>

        {vehicle.lastPosition && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Gauge className="w-4 h-4" />
            <span>{speed} km/h</span>
            {isMoving && (
              <span className="text-xs text-success">En mouvement</span>
            )}
          </div>
        )}

        {vehicle.driver && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-3 h-3 text-primary" />
            </div>
            <span>{vehicle.driver}</span>
          </div>
        )}

        {vehicle.lastPosition && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span className="truncate">{vehicle.lastPosition.city}</span>
            {effectiveStatus === 'active' && (
              <span className="flex items-center gap-1 text-xs text-success ml-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                Live
              </span>
            )}
          </div>
        )}

        {vehicle.lastPosition?.timestamp && (
          <div className="text-xs text-muted-foreground pt-1">
            Dernière MAJ: {formatTimeAgo(vehicle.lastPosition.timestamp)}
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-border">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Fuel className="w-3.5 h-3.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span>Carburant</span>
                <span className={cn(fuel !== null && fuel < 20 && 'text-destructive')}>
                  {fuel !== null ? `${fuel}%` : '—'}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full',
                    fuel !== null && fuel < 20 ? 'bg-destructive' : 'bg-success'
                  )}
                  style={{ width: `${Math.min(fuel ?? 0, 100)}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Battery className="w-3.5 h-3.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span>Batterie</span>
                <span className={cn(batteryIsLow && 'text-destructive')}>
                  {batteryVolts !== null ? `${batteryVolts.toFixed(2)} V` : '—'}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full',
                    batteryIsLow ? 'bg-destructive' : 'bg-success'
                  )}
                  style={{ width: `${batteryVolts !== null ? Math.max(0, Math.min(((batteryVolts - 9) / 5.5) * 100, 100)) : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
