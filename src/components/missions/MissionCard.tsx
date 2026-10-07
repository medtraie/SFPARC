import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  MapPin, 
  Clock, 
  Truck, 
  User, 
  Package, 
  Weight,
  ArrowRight,
  MoreVertical,
  Eye,
  Edit,
  CheckCircle,
  XCircle,
  Trash2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useGPSwoxVehicles } from '@/hooks/useGPSwoxVehicles';
import { useDrivers } from '@/hooks/useDrivers';

interface MissionCardData {
  id: string;
  reference: string;
  client: string;
  origin: string;
  destination: string;
  status: 'planned' | 'in_progress' | 'delivered' | 'cancelled';
  vehicleId: string;
  driverId: string;
  departureDate: string;
  estimatedArrival: string;
  cargo: string;
  weight: number;
  fuelQuantity: number;
  pricePerLiter: number;
  fuelCost: number;
  discountRate: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  cashAmount: number;
  extraFees: number;
  totalCost: number;
}

interface MissionCardProps {
  mission: MissionCardData;
  onView?: (mission: MissionCardData) => void;
  onEdit?: (mission: MissionCardData) => void;
  onStatusChange?: (mission: MissionCardData, status: MissionCardData['status']) => void;
  onDelete?: (mission: MissionCardData) => void;
}

export function MissionCard({ mission, onView, onEdit, onStatusChange, onDelete }: MissionCardProps) {
  const { data: gpswoxVehicles = [] } = useGPSwoxVehicles();
  const { data: drivers = [] } = useDrivers();

  const vehicle = gpswoxVehicles.find(v => String(v.id) === mission.vehicleId);
  const driver = drivers.find(d => d.id === mission.driverId);

  const getStatusColor = (status: MissionCardData['status']) => {
    switch (status) {
      case 'planned': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'in_progress': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      case 'delivered': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getStatusLabel = (status: MissionCardData['status']) => {
    const labels: Record<string, string> = {
      planned: 'Planifiée',
      in_progress: 'En cours',
      delivered: 'Livrée',
      cancelled: 'Annulée',
    };
    return labels[status] || 'Inconnu';
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
      return '-';
    }
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '-';
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('fr-MA', { minimumFractionDigits: 0 }).format(amount) + ' MAD';

  return (
    <Card className="dashboard-panel">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-semibold text-primary">
                {mission.reference}
              </span>
              <Badge className={getStatusColor(mission.status)}>
                {getStatusLabel(mission.status)}
              </Badge>
            </div>
            <p className="font-medium text-foreground">{mission.client}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView?.(mission)}>
                <Eye className="h-4 w-4 mr-2" />
                Voir détails
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit?.(mission)}>
                <Edit className="h-4 w-4 mr-2" />
                Modifier
              </DropdownMenuItem>
              {(mission.status === 'in_progress' || mission.status === 'planned') && (
                <DropdownMenuItem onClick={() => onStatusChange?.(mission, 'delivered')}>
                  <CheckCircle className="h-4 w-4 mr-2 text-emerald-600" />
                  Marquer livrée
                </DropdownMenuItem>
              )}
              {mission.status !== 'cancelled' && mission.status !== 'delivered' && (
                <DropdownMenuItem onClick={() => onStatusChange?.(mission, 'cancelled')}>
                  <XCircle className="h-4 w-4 mr-2 text-red-600" />
                  Annuler
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete?.(mission)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2 text-sm mb-4 p-3 bg-muted/50 rounded-lg">
          <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="font-medium truncate">{mission.origin}</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <MapPin className="h-4 w-4 text-red-500 shrink-0" />
          <span className="font-medium truncate">{mission.destination}</span>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <div>
              <p className="text-xs text-muted-foreground">Départ</p>
              <p className="text-foreground font-medium">
                {formatDate(mission.departureDate)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <div>
              <p className="text-xs text-muted-foreground">Arrivée est.</p>
              <p className="text-foreground font-medium">
                {formatDate(mission.estimatedArrival)}
              </p>
            </div>
          </div>
        </div>

        <div className="h-px bg-border my-3" />

        {/* Assignment & Cargo */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            <span className="truncate">{vehicle ? `${vehicle.plate}` : 'Non assigné'}</span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <span className="truncate">{driver?.name || 'Non assigné'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="truncate text-muted-foreground">{mission.cargo}</span>
          </div>
          <div className="flex items-center gap-2">
            <Weight className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{mission.weight.toLocaleString('fr-FR')} kg</span>
          </div>
        </div>

        {mission.status === 'delivered' && (
          <>
            <div className="h-px bg-border my-3" />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Carburant</span>
                <span className="font-medium">{mission.fuelQuantity.toLocaleString('fr-FR')} L</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Prix/L</span>
                <span className="font-medium">{formatCurrency(mission.pricePerLiter)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Coût carburant</span>
                <span className="font-medium">{formatCurrency(mission.fuelCost)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Montant remis</span>
                <span className="font-medium">{formatCurrency(mission.cashAmount)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Frais supplémentaires</span>
                <span className="font-medium">{formatCurrency(mission.extraFees)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Remise</span>
                <span className="font-medium">{formatCurrency(mission.discountAmount)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">TVA</span>
                <span className="font-medium">{formatCurrency(mission.taxAmount)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Coût total</span>
                <span className="font-semibold text-primary">{formatCurrency(mission.totalCost)}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
