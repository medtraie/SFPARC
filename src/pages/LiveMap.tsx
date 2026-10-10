import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Layers,
  LayoutGrid,
  MapPin,
  Settings,
  ChevronUp,
  X,
  Radio,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { cn } from '@/lib/utils';
import GPSwoxMap, { MapLayerType, MapVehicle } from '@/components/map/GPSwoxMap';
import { MapSettingsModal, MarkerDensity } from '@/components/map/MapSettingsModal';
import { VehicleListDrawer } from '@/components/map/VehicleListDrawer';
import { useGPSwoxVehicles } from '@/hooks/useGPSwoxVehicles';
import { useLocation } from 'react-router-dom';

export default function LiveMap() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>();
  const [followingVehicleId, setFollowingVehicleId] = useState<string | undefined>();
  const [enableClustering, setEnableClustering] = useState(true);
  const [mapLayer, setMapLayer] = useState<MapLayerType>('google-streets');
  const [zoomSignal, setZoomSignal] = useState<{ type: 'in' | 'out'; id: number } | undefined>();

  // Modals & Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Map settings state
  const [showGeofences, setShowGeofences] = useState(false);
  const [showTraces, setShowTraces] = useState(true);
  const [showPoints, setShowPoints] = useState(true);
  const [markerDensity, setMarkerDensity] = useState<MarkerDensity>('standard');

  const location = useLocation();

  const { data: vehicles = [], isLoading, error } = useGPSwoxVehicles(10000);

  useEffect(() => {
    const state = location.state as { vehicleId?: string } | null;
    if (state?.vehicleId) {
      const id = String(state.vehicleId);
      setSelectedVehicleId(id);
      setFollowingVehicleId(id);
    }
  }, [location.state]);

  // Counts for live badge
  const filterCounts = useMemo(
    () => ({
      all: vehicles.length,
      online: vehicles.filter((v) => v.online === 'online' || v.online === 'ack').length,
      offline: vehicles.filter((v) => v.online === 'offline').length,
      moving: vehicles.filter((v) => v.lastPosition && v.lastPosition.speed > 0).length,
      stopped: vehicles.filter((v) => !v.lastPosition || v.lastPosition.speed === 0).length,
    }),
    [vehicles]
  );

  // Formatted map vehicles for GPSwoxMap
  const mapVehiclesList = useMemo<MapVehicle[]>(
    () =>
      vehicles.map((v) => ({
        id: v.id,
        plate: v.plate,
        brand: v.brand,
        model: v.model,
        status: v.status,
        mileage: v.mileage,
        driver: v.driver,
        fuelQuantity: v.fuelQuantity,
        battery: v.battery,
        network: v.network,
        distanceToday: v.distanceToday,
        online: v.online,
        lastPosition: v.lastPosition
          ? {
              lat: v.lastPosition.lat,
              lng: v.lastPosition.lng,
              city: v.lastPosition.city,
              speed: v.lastPosition.speed,
              timestamp: v.lastPosition.timestamp,
            }
          : undefined,
      })),
    [vehicles]
  );

  const handleVehicleSelect = useCallback((vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
  }, []);

  const handleFollowVehicle = useCallback((vehicleId: string) => {
    setFollowingVehicleId((prev) => (prev === vehicleId ? undefined : vehicleId));
  }, []);

  // Current map layer display label
  const layerLabel = useMemo(() => {
    switch (mapLayer) {
      case 'google-streets':
        return 'Normal';
      case 'google-satellite':
        return 'Satellite';
      case 'google-terrain':
        return 'Relief';
      case 'google-hybrid':
        return 'Hybride';
      default:
        return 'Normal';
    }
  }, [mapLayer]);

  return (
    <DashboardLayout hideSidebar={isDrawerOpen}>
      <div
        className="relative h-[calc(100vh-5.5rem)] w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-[#090D16]"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Full Bleed GPS Map */}
        <GPSwoxMap
          vehicles={mapVehiclesList}
          selectedVehicleId={selectedVehicleId}
          followingVehicleId={followingVehicleId}
          onVehicleSelect={handleVehicleSelect}
          isLoading={isLoading}
          error={error}
          enableClustering={enableClustering}
          mapLayer={mapLayer}
          markerDensity={markerDensity}
          showGeofences={showGeofences}
          showTraces={showTraces}
          showPoints={showPoints}
          zoomSignal={zoomSignal}
        />

        {/* Top-Left: Active Follow Pill */}
        {followingVehicleId && (
          <div
            className={cn(
              'absolute top-4 z-20 flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-emerald-950/80 backdrop-blur-xl border border-emerald-500/50 shadow-xl text-white pointer-events-auto animate-in fade-in',
              isRTL ? 'right-4' : 'left-4'
            )}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="text-xs font-bold tracking-wide">
              Suivi : {vehicles.find((v) => v.id === followingVehicleId)?.plate || followingVehicleId}
            </span>
            <button
              type="button"
              onClick={() => setFollowingVehicleId(undefined)}
              className="ml-1 p-1 rounded-lg hover:bg-emerald-800/50 text-slate-300 hover:text-white transition-colors"
              title="Arrêter le suivi"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Right Vertical Center Floating Control Panel (Modern Transparent Icons Only) */}
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2.5 pointer-events-auto select-none',
            isRTL ? 'left-4' : 'right-4'
          )}
        >
          {/* Zoom In & Zoom Out Capsule */}
          <div className="bg-slate-950/40 hover:bg-slate-900/60 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl flex flex-col items-center overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setZoomSignal({ type: 'in', id: Date.now() })}
              className="w-10 h-10 flex items-center justify-center text-white hover:text-emerald-400 hover:bg-white/10 transition-colors text-lg font-bold"
              title="Zoom avant (+)"
            >
              +
            </button>
            <div className="w-6 border-b border-white/15" />
            <button
              type="button"
              onClick={() => setZoomSignal({ type: 'out', id: Date.now() })}
              className="w-10 h-10 flex items-center justify-center text-white hover:text-emerald-400 hover:bg-white/10 transition-colors text-lg font-bold"
              title="Zoom arrière (−)"
            >
              −
            </button>
          </div>

          {/* Live Status Icon Button */}
          <div
            className="w-10 h-10 rounded-2xl bg-slate-950/40 backdrop-blur-xl border border-white/15 shadow-2xl flex items-center justify-center relative group cursor-default"
            title={`En direct • ${filterCounts.online} en ligne`}
          >
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-emerald-400 absolute top-2 right-2 ring-2 ring-slate-950/80 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
          </div>

          {/* Map Layer Switcher Icon */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="w-10 h-10 rounded-2xl bg-slate-950/40 hover:bg-slate-900/60 backdrop-blur-xl border border-white/15 hover:border-emerald-500/50 shadow-2xl text-white hover:text-emerald-400 flex items-center justify-center transition-all group hover:scale-105 active:scale-95"
            title={`Styles de carte (${layerLabel})`}
          >
            <Layers className="w-5 h-5 transition-transform group-hover:scale-110" />
          </button>

          {/* Grouper Toggle Icon */}
          <button
            type="button"
            onClick={() => setEnableClustering((prev) => !prev)}
            className={cn(
              'w-10 h-10 rounded-2xl backdrop-blur-xl border shadow-2xl flex items-center justify-center transition-all group hover:scale-105 active:scale-95',
              enableClustering
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                : 'bg-slate-950/40 hover:bg-slate-900/60 border-white/15 text-white hover:border-white/30'
            )}
            title={enableClustering ? 'Désactiver le regroupement' : 'Grouper les véhicules'}
          >
            <LayoutGrid className="w-5 h-5 transition-transform group-hover:scale-110" />
          </button>

          {/* Settings Gear Icon */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="w-10 h-10 rounded-2xl bg-slate-950/40 hover:bg-slate-900/60 backdrop-blur-xl border border-white/15 hover:border-emerald-500/50 shadow-2xl text-slate-300 hover:text-white flex items-center justify-center transition-all group hover:scale-105 active:scale-95"
            title="Paramètres de la carte"
          >
            <Settings className="w-5 h-5 transition-transform group-hover:rotate-45" />
          </button>
        </div>

        {/* Bottom-Center Transparent Floating Button: Parc */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          <button
            type="button"
            onClick={() => setIsDrawerOpen((prev) => !prev)}
            className={cn(
              'group relative flex items-center gap-3 px-5 py-3 rounded-full backdrop-blur-2xl border transition-all duration-300 hover:scale-105 active:scale-95 shadow-2xl',
              isDrawerOpen
                ? 'bg-emerald-950/60 border-emerald-500/80 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                : 'bg-slate-950/40 hover:bg-slate-900/60 border-white/20 hover:border-emerald-500/50 text-white'
            )}
          >
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <MapPin className="w-4 h-4 fill-emerald-400/30" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide text-white">Parc</span>
              <span className="bg-emerald-500/90 text-slate-950 text-xs font-extrabold px-2 py-0.5 rounded-full font-mono">
                {vehicles.length}
              </span>
            </div>
            <ChevronUp
              className={cn(
                'w-4 h-4 text-slate-400 transition-transform duration-300',
                isDrawerOpen && 'rotate-180'
              )}
            />
          </button>
        </div>

        {/* Docked Vehicle List Drawer (Replaces Navigation Sidebar) */}
        <VehicleListDrawer
          open={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          vehicles={mapVehiclesList}
          selectedVehicleId={selectedVehicleId}
          followingVehicleId={followingVehicleId}
          onVehicleSelect={handleVehicleSelect}
          onFollowVehicle={handleFollowVehicle}
          fleetTitle="SFTM"
          isRTL={isRTL}
        />

        {/* Compact Map Settings Modal */}
        <MapSettingsModal
          open={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          mapLayer={mapLayer}
          onMapLayerChange={setMapLayer}
          showGeofences={showGeofences}
          onToggleGeofences={setShowGeofences}
          showTraces={showTraces}
          onToggleTraces={setShowTraces}
          showPoints={showPoints}
          onTogglePoints={setShowPoints}
          markerDensity={markerDensity}
          onMarkerDensityChange={setMarkerDensity}
        />
      </div>
    </DashboardLayout>
  );
}
