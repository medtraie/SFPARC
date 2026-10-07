import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Fuel, 
  Calendar, 
  MapPin, 
  Gauge,
  MoreVertical,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FuelLog, mockVehicles, mockDrivers } from '@/lib/mock-data';

interface FuelLogCardProps {
  log: FuelLog;
  onEdit?: (log: FuelLog) => void;
  onDelete?: (log: FuelLog) => void;
}

export function FuelLogCard({ log, onEdit, onDelete }: FuelLogCardProps) {
  const vehicle = mockVehicles.find(v => v.id === log.vehicleId);
  const driver = mockDrivers.find(d => d.id === log.driverId);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-MA', {
      style: 'decimal',
      minimumFractionDigits: 0,
    }).format(amount) + ' MAD';
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Fuel className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{vehicle?.plate}</p>
              <p className="text-sm text-muted-foreground">{vehicle?.brand} {vehicle?.model}</p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(log)}>
                <Edit className="h-4 w-4 mr-2" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete?.(log)} className="text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid grid-cols-2 gap-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{formatDate(log.date)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <span>{log.mileage.toLocaleString('fr-FR')} km</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{log.station}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-xs">Par:</span>
            <span className="truncate">{driver?.name}</span>
          </div>
        </div>

        <div className="h-px bg-border my-3" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-lg font-bold text-primary">{log.liters} L</p>
              <p className="text-xs text-muted-foreground">{log.pricePerLiter.toFixed(2)} MAD/L</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-foreground">{formatCurrency(log.totalCost)}</p>
            <Badge variant="secondary" className="text-xs">Total</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
