import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Layers,
  Home,
  Navigation,
  MapPin,
  Settings,
  ChevronUp,
  X,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { cn } from '@/lib/utils';
import GPSwoxMap, { MapLayerType, MapVehicle } from '@/components/map/GPSwoxMap';
import { MapSettingsModal, MarkerDensity } from '@/components/map/MapSettingsModal';
import { GroupedVehiclesModal } from '@/components/map/GroupedVehiclesModal';
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
  const [traceurVehicleIds, setTraceurVehicleIds] = useState<Set<string>>(new Set());
  const [resetViewSignal, setResetViewSignal] = useState(0);
  const [zoomSignal, setZoomSignal] = useState<{ type: 'in' | 'out'; id: number } | undefined>();

  // Modals & Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isClusterModalOpen, setIsClusterModalOpen] = useState(false);
  const [clusterVehicles, setClusterVehicles] = useState<MapVehicle[]>([]);
  const [activeClusterLayer, setActiveClusterLayer] = useState<any>(null);

  // Map settings state (matching Image 3)
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

  const handleToggleAllTraceurs = useCallback(() => {
    setTraceurVehicleIds((prev) => {
      if (prev.size > 0) {
        return new Set();
      }
      return new Set(vehicles.map((v) => v.id));
    });
  }, [vehicles]);

  const handleResetMapView = useCallback(() => {
    setFollowingVehicleId(undefined);
    setSelectedVehicleId(undefined);
    setResetViewSignal((prev) => prev + 1);
  }, []);

  // Handle cluster click from map
  const handleClusterClick = useCallback((clusterItems: MapVehicle[], clusterLayer: any) => {
    setClusterVehicles(clusterItems);
    setActiveClusterLayer(clusterLayer);
    setIsClusterModalOpen(true);
  }, []);

  const handleSeparateCluster = useCallback(() => {
    if (activeClusterLayer && typeof activeClusterLayer.zoomToBounds === 'function') {
      activeClusterLayer.zoomToBounds({ padding: [30, 30] });
    }
  }, [activeClusterLayer]);

  // Current map layer display label
  const layerLabel = useMemo(() => {
    switch (mapLayer) {
      case 'google-streets':
        return 'Google Maps';
      case 'google-satellite':
        return 'Satellite';
      case 'google-terrain':
        return 'Relief';
      case 'google-hybrid':
        return 'Hybride';
      default:
        return 'Google Maps';
    }
  }, [mapLayer]);

  return (
    <DashboardLayout>
      <div className="relative h-[calc(100vh-5.5rem)] w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-[#090D16]" dir={isRTL ? 'rtl' : 'ltr'}>
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
          traceurVehicleIds={traceurVehicleIds}
          resetViewSignal={resetViewSignal}
          markerDensity={markerDensity}
          showGeofences={showGeofences}
          showTraces={showTraces}
          showPoints={showPoints}
          zoomSignal={zoomSignal}
          onClusterClick={handleClusterClick}
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

        {/* Right Floating Transparent Control Panel (Exact User Request) */}
        <div
          className={cn(
            'absolute top-4 z-20 flex flex-col items-end gap-2.5 pointer-events-auto select-none',
            isRTL ? 'left-4 items-start' : 'right-4 items-end'
          )}
        >
          {/* Zoom In & Zoom Out Pill */}
          <div className="bg-[#0B1020]/75 hover:bg-[#0B1020]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col items-center overflow-hidden transition-colors">
            <button
              type="button"
              onClick={() => setZoomSignal({ type: 'in', id: Date.now() })}
              className="w-10 h-9 flex items-center justify-center text-white hover:text-emerald-400 hover:bg-white/5 transition-all text-lg font-bold"
              title="Zoom avant"
            >
              +
            </button>
            <div className="w-6 border-b border-white/10" />
            <button
              type="button"
              onClick={() => setZoomSignal({ type: 'out', id: Date.now() })}
              className="w-10 h-9 flex items-center justify-center text-white hover:text-emerald-400 hover:bg-white/5 transition-all text-lg font-bold"
              title="Zoom arrière"
            >
              −
            </button>
          </div>

          {/* En direct • X en ligne Pill */}
          <div className="bg-[#0B1020]/75 backdrop-blur-xl border border-white/10 px-3.5 py-2 rounded-2xl shadow-2xl flex flex-col items-center text-center">
            <span className="text-xs font-bold text-white tracking-wide">En direct</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
              <span className="text-[11px] font-semibold text-emerald-400">
                • {filterCounts.online} en ligne
              </span>
            </div>
          </div>

          {/* Google Maps / Map Style Switcher Button */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="bg-[#0B1020]/75 hover:bg-[#0B1020]/90 backdrop-blur-xl border border-white/10 hover:border-emerald-500/50 px-3.5 py-2.5 rounded-2xl shadow-2xl text-white text-xs font-semibold flex items-center gap-2 transition-all group"
          >
            <Layers className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span>{layerLabel}</span>
          </button>

          {/* Grouper Button */}
          <button
            type="button"
            onClick={() => setEnableClustering((prev) => !prev)}
            className={cn(
              'backdrop-blur-xl border px-3.5 py-2.5 rounded-2xl shadow-2xl text-xs font-semibold flex items-center gap-2 transition-all',
              enableClustering
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-400 shadow-emerald-950/50'
                : 'bg-[#0B1020]/75 hover:bg-[#0B1020]/90 border-white/10 text-white hover:border-white/20'
            )}
          >
            <Layers className="w-4 h-4" />
            <span>Grouper</span>
          </button>

          {/* Traceurs Button */}
          <button
            type="button"
            onClick={handleToggleAllTraceurs}
            className={cn(
              'backdrop-blur-xl border px-3.5 py-2.5 rounded-2xl shadow-2xl text-xs font-semibold flex items-center gap-2 transition-all',
              traceurVehicleIds.size > 0
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-400 shadow-emerald-950/50'
                : 'bg-[#0B1020]/75 hover:bg-[#0B1020]/90 border-white/10 text-white hover:border-white/20'
            )}
          >
            <Navigation className="w-4 h-4" />
            <span>Traceurs</span>
          </button>

          {/* Vue globale Button */}
          <button
            type="button"
            onClick={handleResetMapView}
            className="bg-[#0B1020]/75 hover:bg-[#0B1020]/90 backdrop-blur-xl border border-white/10 hover:border-emerald-500/50 px-3.5 py-2.5 rounded-2xl shadow-2xl text-white text-xs font-semibold flex items-center gap-2 transition-all"
          >
            <Home className="w-4 h-4 text-emerald-400" />
            <span>Vue globale</span>
          </button>

          {/* Settings Gear Button */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="bg-[#0B1020]/75 hover:bg-[#0B1020]/90 backdrop-blur-xl border border-white/10 hover:border-emerald-500/50 p-2.5 rounded-2xl shadow-2xl text-slate-300 hover:text-white transition-all"
            title="Paramètres de la carte"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom-Center Floating Button: Parc / Traceur (Exact User Request) */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          <button
            type="button"
            onClick={() => setIsDrawerOpen((prev) => !prev)}
            className="group relative flex items-center gap-3 px-5 py-3 rounded-full bg-[#0B1020]/85 hover:bg-[#0E1628] backdrop-blur-2xl border border-white/15 hover:border-emerald-500/60 text-white shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95"
          >
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <MapPin className="w-4 h-4 fill-emerald-400/30" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide text-white">Parc</span>
              <span className="bg-emerald-500 text-slate-950 text-xs font-extrabold px-2 py-0.5 rounded-full font-mono">
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

        {/* Bottom Sheet Drawer for Vehicle List (Image 2) */}
        <VehicleListDrawer
          open={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          vehicles={mapVehiclesList}
          selectedVehicleId={selectedVehicleId}
          followingVehicleId={followingVehicleId}
          onVehicleSelect={handleVehicleSelect}
          onFollowVehicle={handleFollowVehicle}
          fleetTitle="SFTM"
        />

        {/* Grouped Vehicles Modal (Image 4) */}
        <GroupedVehiclesModal
          open={isClusterModalOpen}
          onOpenChange={setIsClusterModalOpen}
          vehicles={clusterVehicles}
          onSeparate={handleSeparateCluster}
          onSelectVehicle={handleVehicleSelect}
        />

        {/* Map Settings Modal (Image 3) */}
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
