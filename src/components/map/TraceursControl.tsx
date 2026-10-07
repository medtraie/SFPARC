import React from 'react';
import { Route, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface TraceursControlProps {
  enabledVehicleIds: Set<string>;
  vehicles: Array<{ id: string; plate: string }>;
  onToggleTraceur: (vehicleId: string) => void;
  onClearAll: () => void;
  isRTL?: boolean;
}

export const TraceursControl: React.FC<TraceursControlProps> = ({
  enabledVehicleIds,
  vehicles,
  onToggleTraceur,
  onClearAll,
  isRTL = false,
}) => {
  const activeCount = enabledVehicleIds.size;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 bg-card/90 backdrop-blur shadow-lg relative",
            activeCount > 0 && "border-primary"
          )}
        >
          <Route className={cn("w-4 h-4", activeCount > 0 && "text-primary")} />
          <span className="text-xs">Traceurs</span>
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-medium">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-64 p-3" 
        align={isRTL ? "end" : "start"}
        side="bottom"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Traceurs en direct</h4>
            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={onClearAll}
              >
                <X className="w-3 h-3 mr-1" />
                Effacer tout
              </Button>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground">
            Activez le traceur pour voir le chemin parcouru par le véhicule en temps réel.
          </p>
          
          <div className="max-h-48 overflow-auto space-y-2">
            {vehicles.map((vehicle) => (
              <div 
                key={vehicle.id}
                className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50"
              >
                <Label 
                  htmlFor={`traceur-${vehicle.id}`}
                  className="text-sm cursor-pointer flex-1"
                >
                  {vehicle.plate}
                </Label>
                <Switch
                  id={`traceur-${vehicle.id}`}
                  checked={enabledVehicleIds.has(vehicle.id)}
                  onCheckedChange={() => onToggleTraceur(vehicle.id)}
                />
              </div>
            ))}
          </div>
          
          {vehicles.length === 0 && (
            <p className="text-xs text-center text-muted-foreground py-2">
              Aucun véhicule disponible
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
