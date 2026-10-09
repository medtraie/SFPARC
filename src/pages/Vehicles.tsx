import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Grid, List, Download, RefreshCw, Loader2, ArrowDownUp, Fuel, Battery, Activity } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { VehicleCard } from '@/components/vehicles/VehicleCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useGPSwoxVehicles } from '@/hooks/useGPSwoxVehicles';
import { useGPSwoxReports, VehicleReport } from '@/hooks/useGPSwoxReports';
import {
  extractVehicleOdometer,
  extractVehicleDistanceToday,
  extractVehicleMaxSpeed,
} from '@/lib/gpswox-sensors';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function Vehicles() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [onlineFilter, setOnlineFilter] = useState<string>('all');
  const [fuelFilter, setFuelFilter] = useState<string>('all');
  const [batteryFilter, setBatteryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('mileage');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailsVehicleId, setDetailsVehicleId] = useState<string | null>(null);

  const { data: vehicles = [], isLoading, isError, error, refetch, isFetching } = useGPSwoxVehicles(30000);
  const { data: reportsData } = useGPSwoxReports(30000);
  const BATTERY_MAINTENANCE_THRESHOLD_V = 9;

  // Map reports data to vehicles for odometer, daily distance and overspeeds
  const vehicleReportMap = useMemo(() => {
    const map = new Map<string, VehicleReport>();
    if (reportsData?.reports?.vehicles && Array.isArray(reportsData.reports.vehicles)) {
      for (const r of reportsData.reports.vehicles) {
        map.set(String(r.id), r);
        if (r.name) map.set(r.name.toLowerCase().trim(), r);
      }
    }
    return map;
  }, [reportsData]);

  const vehicleOverspeedMap = useMemo(() => {
    const map = new Map<string, number>();
    if (reportsData?.reports?.overspeeds && Array.isArray(reportsData.reports.overspeeds)) {
      for (const ov of reportsData.reports.overspeeds) {
        const idKey = String(ov.device_id);
        const nameKey = ov.device_name?.toLowerCase().trim();
        const currentIdMax = map.get(idKey) || 0;
        if (ov.speed > currentIdMax) map.set(idKey, ov.speed);
        if (nameKey) {
          const currentNameMax = map.get(nameKey) || 0;
          if (ov.speed > currentNameMax) map.set(nameKey, ov.speed);
        }
      }
    }
    return map;
  }, [reportsData]);

  const vehiclesWithDisplayStatus = useMemo(
    () =>
      vehicles.map((vehicle) => {
        const battery = vehicle.battery !== null ? Number(vehicle.battery) : null;
        const shouldBeMaintenance = vehicle.status === 'maintenance' && battery !== null && battery < BATTERY_MAINTENANCE_THRESHOLD_V;
        const report = vehicleReportMap.get(String(vehicle.id)) || vehicleReportMap.get(vehicle.plate.toLowerCase().trim());
        const highestOverspeed = Math.max(
          vehicleOverspeedMap.get(String(vehicle.id)) || 0,
          vehicleOverspeedMap.get(vehicle.plate.toLowerCase().trim()) || 0
        );

        const realOdometer = extractVehicleOdometer(vehicle, report);
        const realDistanceToday = extractVehicleDistanceToday(vehicle, report);
        const realMaxSpeed = extractVehicleMaxSpeed(vehicle, report, highestOverspeed);

        return {
          ...vehicle,
          mileage: realOdometer,
          distanceToday: realDistanceToday,
          maxSpeedToday: realMaxSpeed,
          report,
          highestOverspeed,
          status: shouldBeMaintenance ? 'maintenance' as const : vehicle.status === 'maintenance' ? 'active' as const : vehicle.status,
        };
      }),
    [vehicles, vehicleReportMap, vehicleOverspeedMap]
  );

  const filteredVehicles = useMemo(() => {
    return vehiclesWithDisplayStatus.filter((vehicle) => {
      const matchesStatus = statusFilter === 'all' || vehicle.status === statusFilter;
      const matchesOnline = onlineFilter === 'all' || 
        (onlineFilter === 'online' && vehicle.online === 'online') ||
        (onlineFilter === 'offline' && vehicle.online === 'offline') ||
        (onlineFilter === 'ack' && vehicle.online === 'ack');
      const matchesFuel = fuelFilter === 'all' || 
        (fuelFilter === 'low' && vehicle.fuelQuantity !== null && vehicle.fuelQuantity < 20) ||
        (fuelFilter === 'ok' && (vehicle.fuelQuantity === null || vehicle.fuelQuantity >= 20));
      const matchesBattery = batteryFilter === 'all' ||
        (batteryFilter === 'low' && vehicle.battery !== null && Number(vehicle.battery) < BATTERY_MAINTENANCE_THRESHOLD_V) ||
        (batteryFilter === 'ok' && (vehicle.battery === null || Number(vehicle.battery) >= BATTERY_MAINTENANCE_THRESHOLD_V));
      const matchesSearch =
        searchQuery === '' ||
        vehicle.plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vehicle.imei.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (vehicle.driver && vehicle.driver.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesStatus && matchesOnline && matchesFuel && matchesBattery && matchesSearch;
    });
  }, [vehiclesWithDisplayStatus, statusFilter, onlineFilter, fuelFilter, batteryFilter, searchQuery]);

  const sortedVehicles = useMemo(() => {
    const list = [...filteredVehicles];
    list.sort((a, b) => {
      switch (sortBy) {
        case 'speed':
          return (b.lastPosition?.speed || 0) - (a.lastPosition?.speed || 0);
        case 'distanceToday':
          return (b.distanceToday || 0) - (a.distanceToday || 0);
        case 'updated':
          return (b.lastPosition?.timestamp ? new Date(b.lastPosition.timestamp).getTime() : 0) -
            (a.lastPosition?.timestamp ? new Date(a.lastPosition.timestamp).getTime() : 0);
        default:
          return (b.mileage || 0) - (a.mileage || 0);
      }
    });
    return list;
  }, [filteredVehicles, sortBy]);

  const detailsVehicle = useMemo(
    () => sortedVehicles.find((vehicle) => String(vehicle.id) === detailsVehicleId) || null,
    [detailsVehicleId, sortedVehicles]
  );

  // Stats
  const totalVehicles = vehiclesWithDisplayStatus.length;
  const onlineCount = vehiclesWithDisplayStatus.filter(v => v.online === 'online').length;
  const offlineCount = vehiclesWithDisplayStatus.filter(v => v.online === 'offline').length;
  const activeCount = vehiclesWithDisplayStatus.filter(v => v.status === 'active').length;
  const movingCount = vehiclesWithDisplayStatus.filter(v => (v.lastPosition?.speed || 0) > 0).length;
  const lowFuelCount = vehiclesWithDisplayStatus.filter(v => v.fuelQuantity !== null && v.fuelQuantity < 20).length;
  const lowBatteryCount = vehiclesWithDisplayStatus.filter(v => v.battery !== null && Number(v.battery) < BATTERY_MAINTENANCE_THRESHOLD_V).length;

  const handleExport = () => {
    const headers = ['Plate', 'IMEI', 'Status', 'Online', 'Driver', 'Mileage', 'DistanceToday', 'Speed', 'City', 'LastUpdate'];
    const rows = sortedVehicles.map((vehicle) => [
      vehicle.plate,
      vehicle.imei,
      vehicle.status,
      vehicle.online,
      vehicle.driver || '',
      vehicle.mileage,
      vehicle.distanceToday ?? '',
      vehicle.lastPosition?.speed ?? '',
      vehicle.lastPosition?.city ?? '',
      vehicle.lastPosition?.timestamp ?? '',
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vehicles-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-400">Véhicules</span>
            </h1>
            <p className="text-xs font-medium text-slate-400 mt-1">
              {isLoading ? 'Chargement...' : `${totalVehicles} véhicules au total • ${onlineCount} connectés en direct`}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button 
              variant="outline" 
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 px-3.5 border-white/10 bg-[#0E1626] text-slate-200 hover:border-cyan-400/40 hover:text-cyan-400 hover:bg-white/[0.04]"
            >
              {isFetching ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin text-cyan-400" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2 text-cyan-400" />
              )}
              Actualiser
            </Button>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={sortedVehicles.length === 0}
              className="h-9 px-3.5 border-white/10 bg-[#0E1626] text-slate-200 hover:border-cyan-400/40 hover:text-cyan-400 hover:bg-white/[0.04]"
            >
              <Download className="w-4 h-4 mr-2 text-cyan-400" />
              Exporter CSV
            </Button>
          </div>
        </div>

        {/* 2026 Luxury Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
          <div className="rounded-2xl border border-white/[0.08] bg-[#121A2B] p-4 shadow-[6px_6px_16px_rgba(3,7,18,0.7),-3px_-3px_10px_rgba(255,255,255,0.02)] border-l-4 border-l-cyan-400">
            <div className="text-2xl font-black text-white font-mono tracking-tight">{totalVehicles}</div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Total véhicules</div>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#121A2B] p-4 shadow-[6px_6px_16px_rgba(3,7,18,0.7),-3px_-3px_10px_rgba(255,255,255,0.02)] border-l-4 border-l-emerald-400">
            <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight">{onlineCount}</div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">En ligne</div>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#121A2B] p-4 shadow-[6px_6px_16px_rgba(3,7,18,0.7),-3px_-3px_10px_rgba(255,255,255,0.02)] border-l-4 border-l-slate-600">
            <div className="text-2xl font-black text-slate-400 font-mono tracking-tight">{offlineCount}</div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Hors ligne</div>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#121A2B] p-4 shadow-[6px_6px_16px_rgba(3,7,18,0.7),-3px_-3px_10px_rgba(255,255,255,0.02)] border-l-4 border-l-sky-400">
            <div className="text-2xl font-black text-sky-400 font-mono tracking-tight">{activeCount}</div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Actifs</div>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#121A2B] p-4 shadow-[6px_6px_16px_rgba(3,7,18,0.7),-3px_-3px_10px_rgba(255,255,255,0.02)] border-l-4 border-l-cyan-300">
            <div className="text-2xl font-black text-cyan-300 font-mono tracking-tight">{movingCount}</div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">En mouvement</div>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#121A2B] p-4 shadow-[6px_6px_16px_rgba(3,7,18,0.7),-3px_-3px_10px_rgba(255,255,255,0.02)] border-l-4 border-l-rose-500">
            <div className="text-2xl font-black text-rose-400 font-mono tracking-tight">{lowFuelCount}</div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Carburant bas</div>
          </div>
        </div>

        {/* Quick Filter Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-cyan-500/15 text-cyan-300 border border-cyan-400/30 gap-1.5 py-1 px-3 rounded-xl font-bold text-xs">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            {movingCount} en mouvement
          </Badge>
          <Badge className="bg-amber-500/15 text-amber-300 border border-amber-400/30 gap-1.5 py-1 px-3 rounded-xl font-bold text-xs">
            <Fuel className="w-3.5 h-3.5 text-amber-400" />
            {lowFuelCount} carburant bas (&lt;20%)
          </Badge>
          <Badge className="bg-purple-500/15 text-purple-300 border border-purple-400/30 gap-1.5 py-1 px-3 rounded-xl font-bold text-xs">
            <Battery className="w-3.5 h-3.5 text-purple-400" />
            {lowBatteryCount} batterie basse (&lt;9V)
          </Badge>
        </div>

        {/* Filters Bar */}
        <div className="dashboard-panel p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="flex-1 min-w-[240px]">
              <div className="relative">
                <Search
                  className={cn(
                    'absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground',
                    isRTL ? 'right-3' : 'left-3'
                  )}
                />
                <Input
                  type="search"
                  placeholder="Rechercher par plaque, IMEI ou chauffeur..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn('bg-muted/50 border-0', isRTL ? 'pr-10' : 'pl-10')}
                />
              </div>
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="inactive">Inactif</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>

            {/* Online Filter */}
            <Select value={onlineFilter} onValueChange={setOnlineFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Connexion" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes connexions</SelectItem>
                <SelectItem value="online">🟢 En ligne</SelectItem>
                <SelectItem value="offline">⚫ Hors ligne</SelectItem>
                <SelectItem value="ack">🟡 En attente</SelectItem>
              </SelectContent>
            </Select>

            {/* View Toggle */}
            <Select value={fuelFilter} onValueChange={setFuelFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Carburant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous niveaux</SelectItem>
                <SelectItem value="low">Bas (&lt; 20%)</SelectItem>
                <SelectItem value="ok">OK (≥ 20%)</SelectItem>
              </SelectContent>
            </Select>

            <Select value={batteryFilter} onValueChange={setBatteryFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Batterie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes batteries</SelectItem>
                <SelectItem value="low">Basse (&lt; 9V)</SelectItem>
                <SelectItem value="ok">OK (≥ 9V)</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <ArrowDownUp className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mileage">Kilométrage</SelectItem>
                <SelectItem value="distanceToday">Distance jour</SelectItem>
                <SelectItem value="speed">Vitesse</SelectItem>
                <SelectItem value="updated">Dernière MAJ</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              className="h-8"
              onClick={() => {
                setStatusFilter('all');
                setOnlineFilter('all');
                setFuelFilter('all');
                setBatteryFilter('all');
                setSearchQuery('');
                setSortBy('mileage');
              }}
            >
              Réinitialiser
            </Button>
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {sortedVehicles.length} véhicule{sortedVehicles.length > 1 ? 's' : ''} trouvé
            {sortedVehicles.length > 1 ? 's' : ''}
          </p>
          {isFetching && !isLoading && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Actualisation...
            </span>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Chargement des véhicules...</p>
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <span className="text-2xl">❌</span>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              Erreur de chargement
            </h3>
            <p className="text-muted-foreground max-w-sm mb-4">
              {error?.message || 'Impossible de charger les véhicules depuis GPSwox'}
            </p>
            <Button onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Réessayer
            </Button>
          </div>
        )}

        {/* Vehicles Grid/List */}
        {!isLoading && !isError && (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-300">
                {sortedVehicles.map((vehicle) => (
                  <VehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    report={(vehicle as any).report}
                    highestOverspeed={(vehicle as any).highestOverspeed}
                    onDetails={(v) => setDetailsVehicleId(String(v.id))}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2 animate-in fade-in duration-300">
                {sortedVehicles.map((vehicle) => (
                  <VehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    report={(vehicle as any).report}
                    highestOverspeed={(vehicle as any).highestOverspeed}
                    compact
                    onDetails={(v) => setDetailsVehicleId(String(v.id))}
                  />
                ))}
              </div>
            )}

            {/* Empty State */}
            {sortedVehicles.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  Aucun véhicule trouvé
                </h3>
                <p className="text-muted-foreground max-w-sm">
                  Essayez de modifier vos filtres de recherche.
                </p>
              </div>
            )}
          </>
        )}
      </div>
      <Dialog open={!!detailsVehicle} onOpenChange={(open) => !open && setDetailsVehicleId(null)}>
        <DialogContent className="sm:max-w-[760px] bg-[#121A2B] border-white/10 text-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-white flex items-center gap-2">
              <span className="text-cyan-400 font-mono">{detailsVehicle?.plate || ''}</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-400/30">
                Fiche Véhicule
              </span>
            </DialogTitle>
          </DialogHeader>
          {detailsVehicle && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mt-2">
              <div className="rounded-xl border border-white/[0.08] bg-[#0E1626] p-3 shadow-inner">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Plaque d'immatriculation</p>
                <p className="font-mono font-extrabold text-base text-white mt-0.5">{detailsVehicle.plate}</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#0E1626] p-3 shadow-inner">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Modèle / Flotte</p>
                <p className="font-semibold text-slate-200 mt-0.5">
                  {detailsVehicle.model && detailsVehicle.model.toLowerCase() !== 'gps device' && detailsVehicle.model !== detailsVehicle.plate
                    ? detailsVehicle.model
                    : 'Véhicule de Flotte SFTM'}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#0E1626] p-3 shadow-inner">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Statut Opérationnel</p>
                <p className="font-bold text-emerald-400 mt-0.5 capitalize">{detailsVehicle.status}</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#0E1626] p-3 shadow-inner">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Connexion GPS</p>
                <p className="font-bold text-cyan-400 mt-0.5">{detailsVehicle.online === 'online' ? '🟢 En ligne' : detailsVehicle.online === 'ack' ? '🟡 En attente' : '⚫ Hors ligne'}</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#0E1626] p-3 shadow-inner">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Chauffeur Assigné</p>
                <p className="font-semibold text-slate-200 mt-0.5">{detailsVehicle.driver || detailsVehicle.driverDetails?.name || 'Non assigné'}</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#0E1626] p-3 shadow-inner">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Balise IMEI</p>
                <p className="font-mono text-slate-300 mt-0.5">{detailsVehicle.imei}</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#0E1626] p-3 shadow-inner">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Kilométrage (Odomètre)</p>
                <p className="font-mono font-bold text-slate-100 mt-0.5">{Math.round(detailsVehicle.mileage || 0).toLocaleString()} km</p>
              </div>
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3 shadow-inner">
                <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">Distance Aujourd'hui</p>
                <p className="font-mono font-black text-cyan-300 text-base mt-0.5">
                  {(detailsVehicle.distanceToday || 0) > 0
                    ? ((detailsVehicle.distanceToday || 0) >= 10
                        ? Math.round(detailsVehicle.distanceToday || 0).toLocaleString()
                        : (detailsVehicle.distanceToday || 0).toFixed(1))
                    : '0'}{' '}
                  km
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 shadow-inner">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Vitesse Max Aujourd'hui</p>
                <p className="font-mono font-black text-amber-300 text-base mt-0.5">
                  {Math.round((detailsVehicle as any).maxSpeedToday || 0)} km/h
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#0E1626] p-3 shadow-inner">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Niveau de Carburant</p>
                <p className="font-mono font-bold text-slate-200 mt-0.5">{detailsVehicle.fuelQuantity !== null ? `${detailsVehicle.fuelQuantity}%` : '—'}</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#0E1626] p-3 shadow-inner md:col-span-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tension Batterie</p>
                <p className="font-mono font-bold text-slate-200 mt-0.5">{detailsVehicle.battery !== null ? `${Number(detailsVehicle.battery).toFixed(2)} V` : '—'}</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#0E1626] p-3 shadow-inner md:col-span-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Dernière Position GPS</p>
                <p className="font-semibold text-slate-200 mt-0.5">
                  {detailsVehicle.lastPosition
                    ? `${detailsVehicle.lastPosition.address || detailsVehicle.lastPosition.city || ''} (${detailsVehicle.lastPosition.lat.toFixed(5)}, ${detailsVehicle.lastPosition.lng.toFixed(5)})`
                    : 'Position indisponible'}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#0E1626] p-3 shadow-inner md:col-span-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Dernier Signal Reçu</p>
                <p className="font-mono text-slate-300 mt-0.5">
                  {detailsVehicle.lastPosition?.timestamp
                    ? new Date(detailsVehicle.lastPosition.timestamp).toLocaleString('fr-FR')
                    : '—'}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
