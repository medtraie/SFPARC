import { Alert as AlertType } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import { AlertTriangle, FileWarning, Fuel, Gauge, MapPin, Wifi } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AlertItemProps {
  alert: AlertType;
}

const alertIcons = {
  maintenance: Gauge,
  document: FileWarning,
  fuel: Fuel,
  speed: AlertTriangle,
  geofence: MapPin,
  disconnect: Wifi,
};

const severityClasses = {
  low: 'bg-info/10 text-info border-info/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  high: 'bg-destructive/10 text-destructive border-destructive/20',
};

export function AlertItem({ alert }: AlertItemProps) {
  const { i18n } = useTranslation();
  const Icon = alertIcons[alert.type];

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-all hover:shadow-md',
        severityClasses[alert.severity],
        alert.acknowledged && 'opacity-60'
      )}
    >
      <div className="w-8 h-8 rounded-full bg-current/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{alert.message}</p>
        <p className="text-xs opacity-70 mt-0.5">
          {formatDistanceToNow(new Date(alert.timestamp), {
            addSuffix: true,
            locale: i18n.language === 'fr' ? fr : undefined,
          })}
        </p>
      </div>
      {!alert.acknowledged && (
        <div className="w-2 h-2 rounded-full bg-current animate-pulse-subtle" />
      )}
    </div>
  );
}
