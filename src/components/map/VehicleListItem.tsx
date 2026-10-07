import React from 'react';
import { MapPin, Navigation, Clock, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GPSwoxVehicle } from '@/hooks/useGPSwoxVehicles';

interface VehicleListItemProps {
  vehicle: GPSwoxVehicle;
  isSelected: boolean;
  isFollowing: boolean;
  onSelect: (vehicleId: string) => void;
  onFollow: (vehicleId: string) => void;
}

export const VehicleListItem: React.FC<VehicleListItemProps> = ({
  vehicle,
  isSelected,
  isFollowing,
  onSelect,
  onFollow,
}) => {
  const isMoving = vehicle.lastPosition && vehicle.lastPosition.speed > 0;
  const isOnline = vehicle.online === 'online' || vehicle.online === 'ack';

  const formatLastUpdate = (timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (diffMinutes < 1) return 'Maintenant';
    if (diffMinutes < 60) return `il y a ${diffMinutes}m`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `il y a ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `il y a ${diffDays}j`;
  };

  return (
    <div
      className={cn(
        'p-3 rounded-lg border transition-all cursor-pointer',
        isSelected 
          ? 'border-primary bg-primary/5' 
          : 'border-border hover:bg-muted/50',
        isFollowing && 'ring-2 ring-primary ring-offset-2'
      )}
      onClick={() => onSelect(vehicle.id)}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-foreground">{vehicle.plate}</span>
        <div className="flex items-center gap-2">
          {/* Follow Button */}
          <Button
            variant={isFollowing ? "default" : "ghost"}
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onFollow(vehicle.id);
            }}
            title={isFollowing ? 'Arrêter le suivi' : 'Suivre le véhicule'}
          >
            <Crosshair className={cn("w-3.5 h-3.5", isFollowing && "animate-pulse")} />
          </Button>
          
          {/* Status Badge */}
          <span className={cn(
            "flex items-center gap-1 text-xs",
            isOnline ? 'text-success' : 'text-muted-foreground'
          )}>
            <span className={cn(
              "w-1.5 h-1.5 rounded-full",
              isOnline ? 'bg-success animate-pulse' : 'bg-muted-foreground'
            )} />
            {isOnline ? 'En ligne' : 'Hors ligne'}
          </span>
        </div>
      </div>
      
      {/* Model */}
      <p className="text-xs text-muted-foreground mb-2">
        {vehicle.brand} {vehicle.model}
      </p>
      
      {vehicle.lastPosition && (
        <div className="space-y-1.5">
          {/* Location */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{vehicle.lastPosition.city}</span>
          </div>
          
          {/* Speed & Movement */}
          <div className="flex items-center gap-3 text-xs">
            <span className={cn(
              "flex items-center gap-1",
              isMoving ? 'text-primary' : 'text-warning'
            )}>
              <Navigation className={cn("w-3 h-3", isMoving && "animate-pulse")} />
              {vehicle.lastPosition.speed.toFixed(0)} km/h
            </span>
            
            {/* Stop Duration */}
            {vehicle.lastPosition.stopDuration && !isMoving && (
              <span className="text-muted-foreground">
                À l'arrêt {vehicle.lastPosition.stopDuration}
              </span>
            )}
          </div>
          
          {/* Last Update */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{formatLastUpdate(vehicle.lastPosition.timestamp)}</span>
          </div>
        </div>
      )}
      
      {/* Driver */}
      {vehicle.driver && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2 pt-2 border-t border-border">
          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-[9px] font-bold text-primary">
              {vehicle.driver.split(' ').map((n) => n[0]).join('')}
            </span>
          </div>
          <span className="truncate">{vehicle.driver}</span>
        </div>
      )}
    </div>
  );
};
