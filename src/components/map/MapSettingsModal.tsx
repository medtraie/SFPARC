import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Check, Shield, Navigation, MapPin, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MapLayerType } from './GPSwoxMap';

export type MarkerDensity = 'compact' | 'standard' | 'large';

interface MapSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapLayer: MapLayerType;
  onMapLayerChange: (layer: MapLayerType) => void;
  showGeofences: boolean;
  onToggleGeofences: (val: boolean) => void;
  showTraces: boolean;
  onToggleTraces: (val: boolean) => void;
  showPoints: boolean;
  onTogglePoints: (val: boolean) => void;
  markerDensity: MarkerDensity;
  onMarkerDensityChange: (density: MarkerDensity) => void;
}

export const MapSettingsModal: React.FC<MapSettingsModalProps> = ({
  open,
  onOpenChange,
  mapLayer,
  onMapLayerChange,
  showGeofences,
  onToggleGeofences,
  showTraces,
  onToggleTraces,
  showPoints,
  onTogglePoints,
  markerDensity,
  onMarkerDensityChange,
}) => {
  const renderModes: {
    key: MapLayerType;
    label: string;
  }[] = [
    { key: 'google-streets', label: 'Normal' },
    { key: 'google-satellite', label: 'Satellite' },
    { key: 'google-terrain', label: 'Relief' },
    { key: 'google-hybrid', label: 'Hybride' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[320px] bg-[#0B1020]/95 backdrop-blur-2xl border border-white/10 text-white rounded-2xl p-4 shadow-2xl">
        <DialogHeader className="space-y-0.5 pb-1 text-left">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-xs font-bold text-white tracking-wide">
                Paramètres de la carte
              </DialogTitle>
              <p className="text-[10px] text-slate-400">Styles &amp; Calques</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-1 text-xs">
          {/* Section: Modes de rendu */}
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Modes de rendu
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {renderModes.map((mode) => {
                const isSelected = mapLayer === mode.key;
                return (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() => onMapLayerChange(mode.key)}
                    className={cn(
                      'px-2.5 py-1.5 rounded-xl text-left border transition-all flex items-center justify-between h-9',
                      isSelected
                        ? 'border-emerald-500 bg-emerald-950/40 text-white font-bold'
                        : 'border-white/10 bg-slate-900/60 hover:bg-slate-900/80 text-slate-300'
                    )}
                  >
                    <span className="text-xs">{mode.label}</span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Calques */}
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Calques &amp; Affichage
            </div>
            <div className="bg-slate-900/60 border border-white/10 rounded-xl p-1 divide-y divide-white/5">
              <div className="flex items-center justify-between px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[11px] text-slate-200">Géo-clôtures</span>
                </div>
                <Switch
                  checked={showGeofences}
                  onCheckedChange={onToggleGeofences}
                  className="scale-75 origin-right data-[state=checked]:bg-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <Navigation className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] text-slate-200">Traces</span>
                </div>
                <Switch
                  checked={showTraces}
                  onCheckedChange={onToggleTraces}
                  className="scale-75 origin-right data-[state=checked]:bg-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-[11px] text-slate-200">Points</span>
                </div>
                <Switch
                  checked={showPoints}
                  onCheckedChange={onTogglePoints}
                  className="scale-75 origin-right data-[state=checked]:bg-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section: Densité des marqueurs */}
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Densité des marqueurs
            </div>
            <div className="grid grid-cols-3 gap-1 bg-slate-900/60 p-1 rounded-xl border border-white/10">
              {(['compact', 'standard', 'large'] as const).map((density) => (
                <button
                  key={density}
                  type="button"
                  onClick={() => onMarkerDensityChange(density)}
                  className={cn(
                    'py-1 rounded-lg text-[10px] font-medium capitalize transition-all',
                    markerDensity === density
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-white'
                  )}
                >
                  {density === 'compact' ? 'Compact' : density === 'standard' ? 'Standard' : 'Agrandie'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button
          onClick={() => onOpenChange(false)}
          className="w-full mt-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold h-8 rounded-xl text-xs"
        >
          Fermer
        </Button>
      </DialogContent>
    </Dialog>
  );
};
