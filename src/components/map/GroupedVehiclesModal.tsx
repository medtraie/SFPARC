import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronRight, MapPin, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MapVehicle } from './GPSwoxMap';

interface GroupedVehiclesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: MapVehicle[];
  onSeparate: () => void;
  onSelectVehicle: (vehicleId: string) => void;
}

export const GroupedVehiclesModal: React.FC<GroupedVehiclesModalProps> = ({
  open,
  onOpenChange,
  vehicles,
  onSeparate,
  onSelectVehicle,
}) => {
  const movingVehicles = vehicles.filter((v) => {
    const isOnline = v.online === 'online' || v.online === 'ack';
    return isOnline && (v.lastPosition?.speed || 0) > 0;
  });

  const stoppedVehicles = vehicles.filter((v) => {
    const isOnline = v.online === 'online' || v.online === 'ack';
    return isOnline && (!v.lastPosition || (v.lastPosition?.speed || 0) === 0);
  });

  const offlineVehicles = vehicles.filter((v) => {
    return v.online === 'offline';
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#0B1020]/95 backdrop-blur-2xl border border-white/10 text-white rounded-3xl p-6 shadow-2xl">
        <DialogHeader className="space-y-1 pb-2 text-left">
          <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
            <span>Véhicules regroupés</span>
            <span className="text-emerald-400 font-extrabold font-mono">[{vehicles.length}]</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Double-cliquez sur le cercle pour séparer
          </DialogDescription>
        </DialogHeader>

        {/* Status Count Pills */}
        <div className="flex items-center gap-2 py-1 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{movingVehicles.length} Mouvement</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>{stoppedVehicles.length} Arrêt</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>{offlineVehicles.length} Hors ligne</span>
          </div>
        </div>

        {/* Primary Separate Button */}
        <Button
          onClick={() => {
            onSeparate();
            onOpenChange(false);
          }}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold h-12 rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 text-sm mt-1"
        >
          <MapPin className="w-4 h-4 fill-slate-950" />
          <span>Séparer les véhicules sur la carte</span>
        </Button>

        {/* Vehicle list */}
        <div className="space-y-2 mt-2 max-h-[320px] overflow-y-auto pr-1">
          {vehicles.map((v) => {
            const isOnline = v.online === 'online' || v.online === 'ack';
            const speed = v.lastPosition?.speed || 0;
            const isMoving = isOnline && speed > 0;

            const dotColor = !isOnline
              ? 'bg-rose-500'
              : isMoving
              ? 'bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
              : 'bg-amber-400';

            return (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  onSelectVehicle(v.id);
                  onOpenChange(false);
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-900/60 hover:bg-slate-800/80 border border-white/5 hover:border-white/20 transition-all group text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', dotColor)} />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                      {v.plate}
                    </div>
                    {(v.brand || v.model) && (
                      <div className="text-[11px] text-slate-400 truncate">
                        {v.brand} {v.model}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-white/5 text-xs font-mono font-bold text-slate-200">
                    <Gauge className="w-3.5 h-3.5 text-slate-400" />
                    <span>{Math.round(speed)} km/h</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
