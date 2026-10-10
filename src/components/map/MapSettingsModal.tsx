import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Check, Shield, Navigation, MapPin, Sliders, Layers } from 'lucide-react';
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
  const densitySliderValue = markerDensity === 'compact' ? 0 : markerDensity === 'standard' ? 1 : 2;

  const handleSliderChange = (vals: number[]) => {
    const v = vals[0] ?? 1;
    if (v === 0) onMarkerDensityChange('compact');
    else if (v === 1) onMarkerDensityChange('standard');
    else onMarkerDensityChange('large');
  };

  const renderModes: {
    key: MapLayerType;
    label: string;
    sublabel: string;
    previewBg: string;
  }[] = [
    {
      key: 'google-streets',
      label: 'Normal',
      sublabel: 'Plan vectoriel standard',
      previewBg: 'from-blue-900/60 to-slate-900/90',
    },
    {
      key: 'google-satellite',
      label: 'Satellite',
      sublabel: 'Imagerie haute résolution',
      previewBg: 'from-emerald-950/60 to-slate-950/90',
    },
    {
      key: 'google-terrain',
      label: 'Relief',
      sublabel: 'Topographie et ombrage',
      previewBg: 'from-amber-950/60 to-slate-900/90',
    },
    {
      key: 'google-hybrid',
      label: 'Hybride',
      sublabel: 'Satellite avec routes',
      previewBg: 'from-cyan-950/60 to-slate-950/90',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#0B1020]/95 backdrop-blur-2xl border border-white/10 text-white rounded-3xl p-6 shadow-2xl">
        <DialogHeader className="space-y-1.5 pb-2 text-left">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white tracking-wide">
                Paramètres de la carte
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Moteur de rendu &amp; calques télématiques
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Section: Modes de rendu */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              Modes de rendu (4 Styles HD)
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {renderModes.map((mode) => {
                const isSelected = mapLayer === mode.key;
                return (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() => onMapLayerChange(mode.key)}
                    className={cn(
                      'relative p-3.5 rounded-2xl text-left border transition-all duration-200 flex flex-col justify-between h-20 overflow-hidden',
                      isSelected
                        ? 'border-emerald-500 bg-gradient-to-br from-emerald-950/40 to-slate-900/90 shadow-lg shadow-emerald-950/40'
                        : 'border-white/10 bg-slate-900/60 hover:border-white/20 hover:bg-slate-900/80'
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={cn('text-sm font-bold', isSelected ? 'text-white' : 'text-slate-200')}>
                        {mode.label}
                      </span>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-md">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 line-clamp-1">
                      {mode.sublabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Calques & Affichage */}
          <div className="space-y-2.5">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Calques &amp; Affichage
            </div>
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-1.5 divide-y divide-white/5">
              {/* Geofences */}
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                    <Shield className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-medium text-slate-200">
                    Afficher les géo-clôtures
                  </span>
                </div>
                <Switch
                  checked={showGeofences}
                  onCheckedChange={onToggleGeofences}
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>

              {/* Traces */}
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-medium text-slate-200">
                    Afficher les traces
                  </span>
                </div>
                <Switch
                  checked={showTraces}
                  onCheckedChange={onToggleTraces}
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>

              {/* Points */}
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-medium text-slate-200">
                    Afficher le point
                  </span>
                </div>
                <Switch
                  checked={showPoints}
                  onCheckedChange={onTogglePoints}
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section: Densité des marqueurs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" /> Densité des marqueurs
              </span>
              <span className="text-xs font-semibold text-emerald-400 capitalize">
                {markerDensity}
              </span>
            </div>
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl px-4 py-3 space-y-2">
              <Slider
                value={[densitySliderValue]}
                min={0}
                max={2}
                step={1}
                onValueChange={handleSliderChange}
                className="py-1"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                <span className={cn(markerDensity === 'compact' && 'text-emerald-400 font-bold')}>Compact</span>
                <span className={cn(markerDensity === 'standard' && 'text-emerald-400 font-bold')}>Standard</span>
                <span className={cn(markerDensity === 'large' && 'text-emerald-400 font-bold')}>Agrandie</span>
              </div>
            </div>
          </div>
        </div>

        <Button
          onClick={() => onOpenChange(false)}
          className="w-full mt-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold h-11 rounded-2xl shadow-lg shadow-emerald-500/20"
        >
          Enregistrer les paramètres
        </Button>
      </DialogContent>
    </Dialog>
  );
};
