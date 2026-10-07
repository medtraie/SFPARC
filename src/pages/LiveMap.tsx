import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Truck, Loader2, Layers, Home } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import GPSwoxMap, { MapLayerType } from '@/components/map/GPSwoxMap';
import { MapLayerControl } from '@/components/map/MapLayerControl';
import { VehicleFilters, VehicleFilter } from '@/components/map/VehicleFilters';
import { RefreshControls } from '@/components/map/RefreshControls';
import { VehicleListItem } from '@/components/map/VehicleListItem';
import { TraceursControl } from '@/components/map/TraceursControl';
import { useGPSwoxVehicles, GPSwoxVehicle } from '@/hooks/useGPSwoxVehicles';
import { useLocation } from 'react-router-dom';

export default function LiveMap() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>();
  const [followingVehicleId, setFollowingVehicleId] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<VehicleFilter>('all');
  const [isPaused, setIsPaused] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(10000);
  const [enableClustering, setEnableClustering] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>();
  const [mapLayer, setMapLayer] = useState<MapLayerType>('google-streets');
  const [traceurVehicleIds, setTraceurVehicleIds] = useState<Set<string>>(new Set());
  const [resetViewSignal, setResetViewSignal] = useState(0);
  const location = useLocation();

  const { data: vehicles = [], isLoading, error, refetch, isFetching } = useGPSwoxVehicles(
    isPaused ? 0 : refreshInterval
  );

  useEffect(() => {
    const state = location.state as { vehicleId?: string } | null;
    if (state?.vehicleId) {
      const id = String(state.vehicleId);
      setSelectedVehicleId(id);
      setFollowingVehicleId(id);
      const found = vehicles.find((v) => String(v.id) === id);
      if (found?.plate) {
        setSearchQuery(found.plate);
      }
    }
  }, [location.state, vehicles]);

  // Update last update time when data changes
  useMemo(() => {
    if (vehicles.length > 0 && !isFetching) {
      setLastUpdateTime(new Date());
    }
  }, [vehicles, isFetching]);

  // Filter and search logic
  const filteredVehicles = useMemo(() => {
    let result = vehicles;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(v => 
        v.plate.toLowerCase().includes(query) ||
        v.imei.toLowerCase().includes(query) ||
        v.driver?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    switch (activeFilter) {
      case 'online':
        result = result.filter(v => v.online === 'online' || v.online === 'ack');
        break;
      case 'offline':
        result = result.filter(v => v.online === 'offline');
        break;
      case 'moving':
        result = result.filter(v => v.lastPosition && v.lastPosition.speed > 0);
        break;
      case 'stopped':
        result = result.filter(v => !v.lastPosition || v.lastPosition.speed === 0);
        break;
    }

    return result;
  }, [vehicles, searchQuery, activeFilter]);

  // Count for filters
  const filterCounts = useMemo(() => ({
    all: vehicles.length,
    online: vehicles.filter(v => v.online === 'online' || v.online === 'ack').length,
    offline: vehicles.filter(v => v.online === 'offline').length,
    moving: vehicles.filter(v => v.lastPosition && v.lastPosition.speed > 0).length,
    stopped: vehicles.filter(v => !v.lastPosition || v.lastPosition.speed === 0).length,
  }), [vehicles]);

  // Vehicles with position for map display
  const vehiclesWithPosition = useMemo(() => 
    filteredVehicles.filter(v => v.lastPosition),
  [filteredVehicles]);

  const handleVehicleClick = useCallback((vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
  }, []);

  const handleFollowVehicle = useCallback((vehicleId: string) => {
    setFollowingVehicleId(prev => prev === vehicleId ? undefined : vehicleId);
  }, []);

  const handleManualRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleToggleTraceur = useCallback((vehicleId: string) => {
    setTraceurVehicleIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(vehicleId)) {
        newSet.delete(vehicleId);
      } else {
        newSet.add(vehicleId);
      }
      return newSet;
    });
  }, []);

  const handleClearAllTraceurs = useCallback(() => {
    setTraceurVehicleIds(new Set());
  }, []);

  const handleResetMapView = useCallback(() => {
    setFollowingVehicleId(undefined);
    setSelectedVehicleId(undefined);
    setResetViewSignal((prev) => prev + 1);
  }, []);

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-7rem)] flex gap-4" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Map Area */}
        <div className="flex-1 bg-card rounded-xl border border-border overflow-hidden relative">
        <GPSwoxMap 
            vehicles={vehiclesWithPosition.map(v => ({
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
              lastPosition: v.lastPosition ? {
                lat: v.lastPosition.lat,
                lng: v.lastPosition.lng,
                city: v.lastPosition.city,
                speed: v.lastPosition.speed,
                timestamp: v.lastPosition.timestamp,
              } : undefined,
            }))}
            selectedVehicleId={selectedVehicleId}
            followingVehicleId={followingVehicleId}
            onVehicleSelect={handleVehicleClick}
            isLoading={isLoading}
            error={error}
            enableClustering={enableClustering}
            mapLayer={mapLayer}
            traceurVehicleIds={traceurVehicleIds}
            resetViewSignal={resetViewSignal}
          />

          {/* Top Controls */}
          <div className={cn(
            'absolute top-4 flex items-center gap-3 z-10',
            isRTL ? 'right-4' : 'left-4'
          )}>
            {/* Live indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-card/90 backdrop-blur rounded-full shadow-lg">
              {isFetching && !isLoading ? (
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
              ) : isPaused ? (
                <span className="w-2 h-2 rounded-full bg-warning" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              )}
              <span className="text-sm font-medium text-foreground">
                {isPaused ? 'En pause' : 'En direct'}
              </span>
              <span className="text-xs text-muted-foreground">
                • {filterCounts.online} en ligne
              </span>
            </div>

            {/* Map Layer Selector */}
            <MapLayerControl
              currentLayer={mapLayer}
              onLayerChange={setMapLayer}
            />

            {/* Clustering Toggle */}
            <Button
              variant={enableClustering ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1.5 bg-card/90 backdrop-blur shadow-lg"
              onClick={() => setEnableClustering(!enableClustering)}
            >
              <Layers className="w-4 h-4" />
              <span className="text-xs">Grouper</span>
            </Button>

            {/* Traceurs Control */}
            <TraceursControl
              enabledVehicleIds={traceurVehicleIds}
              vehicles={vehicles.map(v => ({ id: v.id, plate: v.plate }))}
              onToggleTraceur={handleToggleTraceur}
              onClearAll={handleClearAllTraceurs}
              isRTL={isRTL}
            />

            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 bg-card/90 backdrop-blur shadow-lg"
              onClick={handleResetMapView}
            >
              <Home className="w-4 h-4" />
              <span className="text-xs">Vue globale</span>
            </Button>
          </div>

          {/* Following indicator */}
          {followingVehicleId && (
            <div className={cn(
              'absolute top-16 px-3 py-2 bg-primary text-primary-foreground rounded-lg shadow-lg z-10 flex items-center gap-2',
              isRTL ? 'right-4' : 'left-4'
            )}>
              <span className="w-2 h-2 rounded-full bg-primary-foreground animate-pulse" />
              <span className="text-sm font-medium">
                Suivi en cours : {vehicles.find(v => v.id === followingVehicleId)?.plate}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs hover:bg-primary-foreground/20"
                onClick={() => setFollowingVehicleId(undefined)}
              >
                Arrêter
              </Button>
            </div>
          )}

          {/* Legend */}
          <div className={cn(
            'absolute bottom-4 flex items-center gap-4 px-4 py-2 bg-card/90 backdrop-blur rounded-full shadow-lg z-10',
            isRTL ? 'right-4' : 'left-4'
          )}>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' }} />
              <span className="text-muted-foreground">Mouvement</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }} />
              <span className="text-destructive">À l'arrêt</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f97316' }} />
              <span className="text-muted-foreground">En ligne</span>
            </div>
            </div>
        </div>

        {/* Sidebar - Vehicle List */}
        <div className={cn(
          'w-80 bg-card rounded-xl border border-border flex flex-col',
          isRTL && 'order-first'
        )}>
          {/* Header */}
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Véhicules
              </h3>
            </div>
            
            {/* Refresh Controls */}
            <RefreshControls
              isPaused={isPaused}
              onTogglePause={() => setIsPaused(!isPaused)}
              refreshInterval={refreshInterval}
              onIntervalChange={setRefreshInterval}
              onManualRefresh={handleManualRefresh}
              isFetching={isFetching}
              lastUpdate={lastUpdateTime}
            />
          </div>

          {/* Filters */}
          <div className="p-4 border-b border-border">
            <VehicleFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              counts={filterCounts}
              isRTL={isRTL}
            />
          </div>

          {/* Vehicle List */}
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredVehicles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Truck className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucun véhicule</p>
                {searchQuery && (
                  <p className="text-sm mt-1">Essayez une autre recherche</p>
                )}
              </div>
            ) : (
              filteredVehicles.map((vehicle) => (
                <VehicleListItem
                  key={vehicle.id}
                  vehicle={vehicle}
                  isSelected={selectedVehicleId === vehicle.id}
                  isFollowing={followingVehicleId === vehicle.id}
                  onSelect={handleVehicleClick}
                  onFollow={handleFollowVehicle}
                />
              ))
            )}
          </div>

          {/* Footer Stats */}
          <div className="p-3 border-t border-border bg-muted/30">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Affichés : {filteredVehicles.length}</span>
              <span>Total : {vehicles.length}</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
