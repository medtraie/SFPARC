import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Gauge, 
  Calendar, 
  CheckCircle,
  AlertTriangle,
  Clock,
  Wrench,
  RotateCcw
} from 'lucide-react';
import { MaintenancePlan, mockVehicles } from '@/lib/mock-data';

interface MaintenancePlanCardProps {
  plan: MaintenancePlan;
  onCreateWorkOrder?: (plan: MaintenancePlan) => void;
}

export function MaintenancePlanCard({ plan, onCreateWorkOrder }: MaintenancePlanCardProps) {
  const vehicle = mockVehicles.find(v => v.id === plan.vehicleId);

  const getStatusBadge = (status: MaintenancePlan['status']) => {
    switch (status) {
      case 'ok':
        return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 gap-1"><CheckCircle className="h-3 w-3" />OK</Badge>;
      case 'due_soon':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 gap-1"><Clock className="h-3 w-3" />Bientôt</Badge>;
      case 'overdue':
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />En retard</Badge>;
    }
  };

  const getTypeIcon = (type: MaintenancePlan['type']) => {
    switch (type) {
      case 'oil_change': return '🛢️';
      case 'tires': return '🛞';
      case 'brakes': return '🛑';
      case 'filters': return '🔧';
      case 'general_inspection': return '🔍';
      default: return '⚙️';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const getDaysUntilDue = () => {
    const today = new Date();
    const dueDate = new Date(plan.nextDueDate);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntilDue = getDaysUntilDue();

  return (
    <Card className={`hover:shadow-md transition-shadow ${plan.status === 'overdue' ? 'border-red-300 dark:border-red-800' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{getTypeIcon(plan.type)}</div>
            <div>
              <p className="font-medium text-foreground">{plan.name}</p>
              <p className="text-sm text-muted-foreground">
                {vehicle?.plate} - {vehicle?.brand}
              </p>
            </div>
          </div>
          {getStatusBadge(plan.status)}
        </div>

        <div className="h-px bg-border my-3" />

        {/* Interval */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <RotateCcw className="h-4 w-4" />
              <span className="text-xs">Intervalle</span>
            </div>
            <p className="font-semibold text-sm">
              {plan.intervalKm ? `${plan.intervalKm.toLocaleString('fr-FR')} km` : `${plan.intervalDays} jours`}
            </p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Gauge className="h-4 w-4" />
              <span className="text-xs">Dernier</span>
            </div>
            <p className="font-semibold text-sm">
              {plan.lastDoneMileage.toLocaleString('fr-FR')} km
            </p>
          </div>
        </div>

        {/* Next Due */}
        <div className={`p-3 rounded-lg mb-3 ${
          plan.status === 'overdue' 
            ? 'bg-red-50 dark:bg-red-950/30' 
            : plan.status === 'due_soon'
            ? 'bg-amber-50 dark:bg-amber-950/30'
            : 'bg-emerald-50 dark:bg-emerald-950/30'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="text-sm font-medium">Prochaine échéance</span>
            </div>
            <span className={`text-sm font-bold ${
              plan.status === 'overdue' 
                ? 'text-red-600' 
                : plan.status === 'due_soon'
                ? 'text-amber-600'
                : 'text-emerald-600'
            }`}>
              {daysUntilDue > 0 
                ? `Dans ${daysUntilDue} jours` 
                : daysUntilDue === 0 
                ? 'Aujourd\'hui'
                : `${Math.abs(daysUntilDue)} jours de retard`}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
            <span>{formatDate(plan.nextDueDate)}</span>
            <span>{plan.nextDueMileage.toLocaleString('fr-FR')} km</span>
          </div>
        </div>

        {/* Action */}
        {(plan.status === 'due_soon' || plan.status === 'overdue') && (
          <Button 
            onClick={() => onCreateWorkOrder?.(plan)} 
            className="w-full gap-2"
            variant={plan.status === 'overdue' ? 'destructive' : 'default'}
          >
            <Wrench className="h-4 w-4" />
            Créer ordre de travail
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
