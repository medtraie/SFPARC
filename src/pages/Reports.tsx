import { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useGPSwoxReports } from '@/hooks/useGPSwoxReports';
import { supabase } from "@/integrations/supabase/client";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  Truck,
  Gauge,
  MapPin,
  Fuel,
  Clock,
  Wifi,
  WifiOff,
  Search,
  RefreshCw,
  Activity,
  TrendingUp,
  AlertTriangle,
  Navigation,
  XCircle,
  ParkingCircle,
  BarChart3,
  Filter,
  ArrowDownUp,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';

const statusConfig = {
  moving: { label: 'En mouvement', icon: Navigation, color: 'text-success', bg: 'bg-success/10' },
  stopped: { label: 'Arrêté', icon: ParkingCircle, color: 'text-warning', bg: 'bg-warning/10' },
  offline: { label: 'Hors ligne', icon: WifiOff, color: 'text-destructive', bg: 'bg-destructive/10' },
};

const severityColors = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-destructive/80 text-destructive-foreground',
  medium: 'bg-warning text-warning-foreground',
};

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d;
}

function calculateDailyStats(items: any[]): Record<string, { distance: number; fuel: number }> {
  const stats: Record<string, { distance: number; fuel: number }> = {};
  
  if (!items || !Array.isArray(items) || items.length === 0) return stats;

  items.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  let prevItem: any = null;
  let prevFuel: number | null = null;

  for (const item of items) {
    let dateStr = '';
    if (item.time) {
      dateStr = item.time.split(' ')[0];
    } else if (item.raw_time) {
      dateStr = item.raw_time.split(' ')[0];
    } else if (item.timestamp) {
      dateStr = new Date(item.timestamp * 1000).toISOString().split('T')[0];
    }

    if (!dateStr) continue;

    if (!stats[dateStr]) {
      stats[dateStr] = { distance: 0, fuel: 0 };
    }

    let dist = 0;
    if (item.distance !== undefined && item.distance !== null) {
      dist = parseFloat(item.distance);
    } else if (prevItem && item.lat && item.lng && prevItem.lat && prevItem.lng) {
      dist = getDistanceFromLatLonInKm(prevItem.lat, prevItem.lng, item.lat, item.lng);
    }
    stats[dateStr].distance += dist;

    let currentFuel: number | null = null;
    if (item.sensors && Array.isArray(item.sensors)) {
      for (const sensor of item.sensors) {
        if ((sensor.type === 'fuel' || sensor.type === 'fuel_tank' || (sensor.name || '').toLowerCase().includes('fuel')) && sensor.val) {
          currentFuel = parseFloat(sensor.val);
          break;
        }
      }
    }

    if (prevFuel !== null && currentFuel !== null) {
      const diff = prevFuel - currentFuel;
      if (diff > 0) {
        stats[dateStr].fuel += diff;
      }
    }

    prevItem = item;
    if (currentFuel !== null) prevFuel = currentFuel;
  }

  return stats;
}

export default function Reports() {
  const { data, isLoading, error, refetch, isFetching } = useGPSwoxReports(60000);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('summary');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vehicleSort, setVehicleSort] = useState('distance_today');
  const [overspeedSeverityFilter, setOverspeedSeverityFilter] = useState('all');
  const [stopDurationFilter, setStopDurationFilter] = useState('all');
  const [fuelLevelFilter, setFuelLevelFilter] = useState('all');
  const location = useLocation();

  useEffect(() => {
    const state = location.state as { tab?: string; plate?: string } | null;
    if (!state) return;
    if (state.tab && ['summary', 'vehicles', 'overspeeds', 'stops', 'fuel', 'exports'].includes(state.tab)) {
      setActiveTab(state.tab);
    }
    if (state.plate) {
      setSearch(state.plate);
    }
  }, [location.state]);
  
  // Daily Report State
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportDailyReport = async (type: 'distance' | 'fuel') => {
    if (!data?.reports?.vehicles) return;
    
    setIsExporting(true);
    try {
      const formattedDateFrom = `${dateFrom} 00:00:00`;
      const formattedDateTo = `${dateTo} 23:59:59`;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const allStats: Record<string, Record<string, { distance: number; fuel: number }>> = {};
      const vehicles = data.reports.vehicles;
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (supabaseKey) {
        headers['apikey'] = supabaseKey;
        headers['Authorization'] = `Bearer ${supabaseKey}`;
      }

      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/gpswox-reports`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            type: 'daily_stats',
            date_from: formattedDateFrom,
            date_to: formattedDateTo,
          }),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const dailyStatsData = await response.json();
        if (dailyStatsData?.success === false) {
          throw new Error(dailyStatsData.error || 'Failed to fetch daily stats');
        }
        const dailyStats = dailyStatsData?.daily_stats;
        if (dailyStats && Object.keys(dailyStats).length > 0) {
          Object.assign(allStats, dailyStats);
        }
      } catch (e) {
        console.error("Error fetching daily stats", e);
      }

      if (Object.keys(allStats).length === 0) {
        for (const vehicle of vehicles) {
          try {
            const response = await fetch(`${supabaseUrl}/functions/v1/gpswox-reports`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                type: 'history',
                device_id: vehicle.id,
                date_from: formattedDateFrom,
                date_to: formattedDateTo,
              }),
            });
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            const historyData = await response.json();
            if (historyData?.success === false) {
              throw new Error(historyData.error || 'Failed to fetch history');
            }

            const historyItems = historyData?.history || historyData?.items || historyData?.data || (Array.isArray(historyData) ? historyData : null);

            if (historyItems && Array.isArray(historyItems)) {
              const vehicleStats = calculateDailyStats(historyItems);
              Object.entries(vehicleStats).forEach(([date, val]) => {
                if (!allStats[date]) allStats[date] = {};
                allStats[date][vehicle.id] = val;
              });
            }
          } catch (e) {
            console.error(`Error fetching history for vehicle ${vehicle.id}`, e);
          }
        }
      }

      const dates = Object.keys(allStats).sort();
      
      if (dates.length === 0) {
        alert("Aucune donnée disponible pour cette période (Vérifiez la connexion API ou la période).");
        setIsExporting(false);
        return;
      }

      // Get all unique device IDs from the stats
      const deviceIds = new Set<string>();
      Object.values(allStats).forEach((dayStats: any) => {
        Object.keys(dayStats).forEach(id => deviceIds.add(id));
      });

      // Map device IDs to names using current data if available
      const deviceMap = new Map<string, string>();
      if (data?.reports?.vehicles) {
        data.reports.vehicles.forEach(v => deviceMap.set(String(v.id), v.name));
      }

      const title = type === 'distance' ? 'Rapport Journalier: Distances (km)' : 'Rapport Journalier: Carburant (L)';
      
      const head = [['Véhicule', ...dates.map(d => format(new Date(d), 'dd/MM'))]];
      const deviceIdList = Array.from(deviceIds);

      for (const id of deviceIdList) {
        const doc = new jsPDF();
        const name = deviceMap.get(id) || `Device ${id}`;

        doc.setFontSize(18);
        doc.text(title, 14, 22);
        doc.setFontSize(11);
        doc.text(`Véhicule: ${name}`, 14, 30);
        doc.text(`Période: ${dateFrom} au ${dateTo}`, 14, 36);

        const row = [name];
        dates.forEach(date => {
          const val = allStats[date]?.[id];
          if (type === 'distance') {
            row.push(val ? Math.round(val.distance).toString() : '0');
          } else {
            row.push(val ? Math.round(val.fuel).toString() : '0');
          }
        });

        autoTable(doc, {
          head: head,
          body: [row],
          startY: 42,
          theme: 'grid',
          headStyles: { fillColor: [41, 128, 185] },
        });

        const safeName = name.replace(/[\\/:*?"<>|]/g, '-');
        doc.save(`rapport_${type}_${safeName}_${dateFrom}_${dateTo}.pdf`);
      }

    } catch (err) {
      console.error("Export error:", err);
      alert(`Erreur lors de l'exportation du rapport: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const reports = data?.reports;

  const filteredVehicles = useMemo(() => {
    if (!reports?.vehicles) return [];
    return reports.vehicles.filter(v => {
      const matchesSearch = !search || v.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [reports?.vehicles, search, statusFilter]);

  const sortedVehicles = useMemo(() => {
    const list = [...filteredVehicles];
    list.sort((a, b) => {
      switch (vehicleSort) {
        case 'speed':
          return (b.speed || 0) - (a.speed || 0);
        case 'distance_month':
          return (b.distance_month || 0) - (a.distance_month || 0);
        case 'fuel':
          return (b.fuel || 0) - (a.fuel || 0);
        default:
          return (b.distance_today || 0) - (a.distance_today || 0);
      }
    });
    return list;
  }, [filteredVehicles, vehicleSort]);

  const filteredOverspeeds = useMemo(() => {
    const overspeeds = reports?.overspeeds || [];
    if (overspeedSeverityFilter === 'all') return overspeeds;
    return overspeeds.filter(os => os.severity === overspeedSeverityFilter);
  }, [reports?.overspeeds, overspeedSeverityFilter]);

  const filteredStops = useMemo(() => {
    const stops = reports?.stopped_vehicles || [];
    if (stopDurationFilter === 'all') return stops;
    const threshold = stopDurationFilter === '120' ? 120 : stopDurationFilter === '60' ? 60 : 30;
    return stops.filter(sv => (sv.stop_duration_minutes || 0) >= threshold);
  }, [reports?.stopped_vehicles, stopDurationFilter]);

  const filteredFuel = useMemo(() => {
    const fuel = reports?.fuel_data || [];
    if (fuelLevelFilter === 'all') return fuel;
    if (fuelLevelFilter === 'low') return fuel.filter(fd => fd.fuel_level < 20);
    if (fuelLevelFilter === 'medium') return fuel.filter(fd => fd.fuel_level >= 20 && fd.fuel_level < 50);
    return fuel.filter(fd => fd.fuel_level >= 50);
  }, [reports?.fuel_data, fuelLevelFilter]);

  const topDistanceVehicles = useMemo(() => {
    if (!reports?.vehicles) return [];
    return [...reports.vehicles]
      .sort((a, b) => (b.distance_today || 0) - (a.distance_today || 0))
      .slice(0, 5);
  }, [reports?.vehicles]);

  const lowFuelVehicles = useMemo(() => {
    if (!reports?.fuel_data) return [];
    return reports.fuel_data
      .filter(fd => fd.fuel_level < 20)
      .slice(0, 5);
  }, [reports?.fuel_data]);

  const applyDateRange = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);
    setDateTo(to.toISOString().split('T')[0]);
    setDateFrom(from.toISOString().split('T')[0]);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-7 h-7 text-primary" />
              Rapports de Flotte
            </h1>
            <p className="text-muted-foreground text-sm">
              Rapports opérationnels, alertes et performances en temps réel
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
              Actualiser
            </Button>
          </div>
        </div>
        {reports && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {reports.overspeeds.length} survitesses
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Clock className="w-3.5 h-3.5" />
              {reports.stopped_vehicles.length} arrêts prolongés
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <WifiOff className="w-3.5 h-3.5" />
              {reports.offline_vehicles.length} hors ligne
            </Badge>
          </div>
        )}

        {/* KPI Cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : reports && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="hover:shadow-md transition-shadow animate-in fade-in zoom-in-95 duration-300">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-xl font-bold">{reports.fleet_summary.total_vehicles}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow animate-in fade-in zoom-in-95 duration-300">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                    <Navigation className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">En mouvement</p>
                    <p className="text-xl font-bold text-success">{reports.fleet_summary.moving}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow animate-in fade-in zoom-in-95 duration-300">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                    <ParkingCircle className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">À l'arrêt</p>
                    <p className="text-xl font-bold text-warning">{reports.fleet_summary.idle}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow animate-in fade-in zoom-in-95 duration-300">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <WifiOff className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Hors ligne</p>
                    <p className="text-xl font-bold text-destructive">{reports.fleet_summary.offline}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow animate-in fade-in zoom-in-95 duration-300">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                    <Gauge className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vit. Max</p>
                    <p className="text-xl font-bold">{reports.fleet_summary.max_speed}<span className="text-xs font-normal ml-0.5">km/h</span></p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow animate-in fade-in zoom-in-95 duration-300">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-info" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Dist. Aujourd'hui</p>
                    <p className="text-xl font-bold">{Math.round(reports.fleet_summary.total_distance_today)}<span className="text-xs font-normal ml-0.5">km</span></p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Error */}
        {error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3">
              <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Erreur de chargement</p>
                <p className="text-xs text-muted-foreground">{(error as Error).message}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto">
                Réessayer
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="summary" className="gap-1.5">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Résumé</span>
            </TabsTrigger>
            <TabsTrigger value="vehicles" className="gap-1.5">
              <Truck className="w-4 h-4" />
              <span className="hidden sm:inline">Véhicules</span>
            </TabsTrigger>
            <TabsTrigger value="overspeeds" className="gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              <span className="hidden sm:inline">Survitesse</span>
            </TabsTrigger>
            <TabsTrigger value="stops" className="gap-1.5">
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Arrêts</span>
            </TabsTrigger>
            <TabsTrigger value="fuel" className="gap-1.5">
              <Fuel className="w-4 h-4" />
              <span className="hidden sm:inline">Carburant</span>
            </TabsTrigger>
            <TabsTrigger value="exports" className="gap-1.5">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Exports PDF</span>
            </TabsTrigger>
          </TabsList>

          {/* Exports Tab */}
          <TabsContent value="exports" className="animate-in fade-in duration-300">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Exports PDF
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => applyDateRange(7)}>
                    7 jours
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => applyDateRange(15)}>
                    15 jours
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => applyDateRange(30)}>
                    30 jours
                  </Button>
                </div>
                <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date de début</label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date de fin</label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleExportDailyReport('distance')} 
                      disabled={isExporting}
                    >
                      {isExporting ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                      Export Km
                    </Button>
                    <Button 
                      onClick={() => handleExportDailyReport('fuel')} 
                      disabled={isExporting}
                      variant="outline"
                    >
                      {isExporting ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Fuel className="w-4 h-4 mr-2" />}
                      Export Gasoil
                    </Button>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  Sélectionnez une période pour générer un rapport journalier par véhicule.
                  Pour de meilleures performances, limitez la période à 15 jours.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Summary Tab */}
          <TabsContent value="summary" className="animate-in fade-in duration-300">
            {reports && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Distance Stats */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      Distances parcourues
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Aujourd'hui</span>
                      <span className="font-semibold">{Math.round(reports.fleet_summary.total_distance_today)} km</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Cette semaine</span>
                      <span className="font-semibold">{Math.round(reports.fleet_summary.total_distance_week)} km</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Ce mois</span>
                      <span className="font-semibold">{Math.round(reports.fleet_summary.total_distance_month)} km</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Overspeed Summary */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                      Excès de vitesse
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {reports.overspeeds.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Aucun excès de vitesse détecté</p>
                    ) : (
                      <div className="space-y-3">
                        {reports.overspeeds.slice(0, 5).map((os, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Gauge className="w-4 h-4 text-destructive" />
                              <span className="text-sm font-medium">{os.device_name}</span>
                            </div>
                            <Badge className={severityColors[os.severity]}>
                              {os.speed} km/h
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Stopped Vehicles */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ParkingCircle className="w-4 h-4 text-warning" />
                      Véhicules arrêtés (+30 min)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {reports.stopped_vehicles.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Aucun véhicule en arrêt prolongé</p>
                    ) : (
                      <div className="space-y-3">
                        {reports.stopped_vehicles.slice(0, 5).map((sv, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-sm font-medium">{sv.device_name}</span>
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">{sv.stop_duration_formatted}</span>
                              {sv.lat && sv.lng && (
                                <a
                                  href={`https://www.google.com/maps?q=${sv.lat},${sv.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  <MapPin className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Offline Vehicles */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <WifiOff className="w-4 h-4 text-destructive" />
                      Véhicules hors ligne
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {reports.offline_vehicles.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Tous les véhicules sont connectés</p>
                    ) : (
                      <div className="space-y-3">
                        {reports.offline_vehicles.slice(0, 5).map((ov, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-sm font-medium">{ov.device_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {ov.last_update ? (() => {
                                try { return formatDistanceToNow(new Date(ov.last_update), { addSuffix: true, locale: fr }); }
                                catch { return ov.last_update; }
                              })() : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-info" />
                      Plus grandes distances aujourd'hui
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {topDistanceVehicles.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée disponible</p>
                    ) : (
                      <div className="space-y-3">
                        {topDistanceVehicles.map((v) => (
                          <div key={v.id} className="flex items-center justify-between">
                            <span className="text-sm font-medium">{v.name}</span>
                            <span className="text-sm text-muted-foreground">{Math.round(v.distance_today)} km</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Fuel className="w-4 h-4 text-destructive" />
                      Carburant faible
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {lowFuelVehicles.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Aucune alerte carburant</p>
                    ) : (
                      <div className="space-y-3">
                        {lowFuelVehicles.map((fd, i) => (
                          <div key={`${fd.device_name}-${i}`} className="flex items-center justify-between">
                            <span className="text-sm font-medium">{fd.device_name}</span>
                            <Badge className="bg-destructive text-destructive-foreground">
                              {fd.fuel_level}L
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Vehicles Tab */}
          <TabsContent value="vehicles" className="animate-in fade-in duration-300">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <CardTitle className="text-base">Rapport détaillé des véhicules</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-8 text-sm"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-8 w-40">
                        <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Statut" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les statuts</SelectItem>
                        <SelectItem value="moving">En mouvement</SelectItem>
                        <SelectItem value="stopped">À l'arrêt</SelectItem>
                        <SelectItem value="offline">Hors ligne</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={vehicleSort} onValueChange={setVehicleSort}>
                      <SelectTrigger className="h-8 w-44">
                        <ArrowDownUp className="w-4 h-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Trier par" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="distance_today">Distance jour</SelectItem>
                        <SelectItem value="distance_month">Distance mois</SelectItem>
                        <SelectItem value="speed">Vitesse</SelectItem>
                        <SelectItem value="fuel">Carburant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-6 space-y-3">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : sortedVehicles.length === 0 ? (
                  <div className="p-12 text-center">
                    <Truck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">Aucun véhicule trouvé</p>
                    <p className="text-sm text-muted-foreground/70">Essayez d'ajuster la recherche ou les filtres</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Véhicule</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Vitesse</TableHead>
                        <TableHead>Dist. Jour</TableHead>
                        <TableHead>Dist. Mois</TableHead>
                        <TableHead>Batterie</TableHead>
                        <TableHead>Carburant</TableHead>
                        <TableHead>Dernière MAJ</TableHead>
                        <TableHead>Position</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedVehicles.map((v) => {
                        const sc = statusConfig[v.status] || statusConfig.stopped;
                        const Icon = sc.icon;
                        return (
                          <TableRow key={v.id}>
                            <TableCell className="font-medium">{v.name}</TableCell>
                            <TableCell>
                              <div className={cn('flex items-center gap-1.5', sc.color)}>
                                <div className={cn('w-6 h-6 rounded-full flex items-center justify-center', sc.bg)}>
                                  <Icon className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-xs">{sc.label}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={cn('text-sm font-medium', v.speed > 100 && 'text-destructive')}>
                                {v.speed} km/h
                              </span>
                            </TableCell>
                            <TableCell className="text-sm">{Math.round(v.distance_today)} km</TableCell>
                            <TableCell className="text-sm">{Math.round(v.distance_month)} km</TableCell>
                            <TableCell>
                              {v.battery !== null ? (
                                <span className={cn('text-sm', v.battery < 20 ? 'text-destructive' : v.battery < 50 ? 'text-warning' : 'text-success')}>
                                  {v.battery}%
                                </span>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>
                              {v.fuel !== null ? (
                                <span className="text-sm">{v.fuel}L</span>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground">
                                {v.last_update ? (() => {
                                  try { return formatDistanceToNow(new Date(v.last_update), { addSuffix: true, locale: fr }); }
                                  catch { return v.last_update; }
                                })() : '—'}
                              </span>
                            </TableCell>
                            <TableCell>
                              {v.lat && v.lng ? (
                                <a
                                  href={`https://www.google.com/maps?q=${v.lat},${v.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  <MapPin className="w-4 h-4" />
                                </a>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Overspeeds Tab */}
          <TabsContent value="overspeeds" className="animate-in fade-in duration-300">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    Excès de vitesse ({filteredOverspeeds.length})
                  </CardTitle>
                  <Select value={overspeedSeverityFilter} onValueChange={setOverspeedSeverityFilter}>
                    <SelectTrigger className="h-8 w-48">
                      <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Sévérité" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les sévérités</SelectItem>
                      <SelectItem value="critical">Critique</SelectItem>
                      <SelectItem value="high">Élevé</SelectItem>
                      <SelectItem value="medium">Moyen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredOverspeeds.length === 0 ? (
                  <div className="p-12 text-center">
                    <Activity className="w-12 h-12 text-success mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">Aucun excès de vitesse</p>
                    <p className="text-sm text-muted-foreground/70">Tous les véhicules respectent les limites</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sévérité</TableHead>
                        <TableHead>Véhicule</TableHead>
                        <TableHead>Vitesse</TableHead>
                        <TableHead>Date / Heure</TableHead>
                        <TableHead>Position</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOverspeeds.map((os, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Badge className={severityColors[os.severity]}>
                              {os.severity === 'critical' ? 'Critique' : os.severity === 'high' ? 'Élevé' : 'Moyen'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{os.device_name}</TableCell>
                          <TableCell>
                            <span className="text-destructive font-bold">{os.speed} km/h</span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {os.timestamp ? (() => {
                              try { return format(new Date(os.timestamp), 'dd/MM/yyyy HH:mm', { locale: fr }); }
                              catch { return os.timestamp; }
                            })() : '—'}
                          </TableCell>
                          <TableCell>
                            {os.lat && os.lng ? (
                              <a
                                href={`https://www.google.com/maps?q=${os.lat},${os.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                <MapPin className="w-3 h-3" /> Voir
                              </a>
                            ) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stops Tab */}
          <TabsContent value="stops" className="animate-in fade-in duration-300">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-warning" />
                    Arrêts prolongés ({filteredStops.length})
                  </CardTitle>
                  <Select value={stopDurationFilter} onValueChange={setStopDurationFilter}>
                    <SelectTrigger className="h-8 w-44">
                      <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Durée" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes durées</SelectItem>
                      <SelectItem value="30">+ 30 min</SelectItem>
                      <SelectItem value="60">+ 60 min</SelectItem>
                      <SelectItem value="120">+ 120 min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredStops.length === 0 ? (
                  <div className="p-12 text-center">
                    <Navigation className="w-12 h-12 text-success mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">Aucun arrêt prolongé</p>
                    <p className="text-sm text-muted-foreground/70">Tous les véhicules sont en mouvement ou hors ligne</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Véhicule</TableHead>
                        <TableHead>Durée d'arrêt</TableHead>
                        <TableHead>Dernière MAJ</TableHead>
                        <TableHead>Position</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStops.map((sv, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{sv.device_name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-warning" />
                              <span className={cn(
                                'font-medium',
                                sv.stop_duration_minutes > 120 ? 'text-destructive' : 'text-warning'
                              )}>
                                {sv.stop_duration_formatted}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {sv.last_update ? (() => {
                              try { return format(new Date(sv.last_update), 'dd/MM/yyyy HH:mm', { locale: fr }); }
                              catch { return sv.last_update; }
                            })() : '—'}
                          </TableCell>
                          <TableCell>
                            {sv.lat && sv.lng ? (
                              <a
                                href={`https://www.google.com/maps?q=${sv.lat},${sv.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                <MapPin className="w-3 h-3" /> Voir
                              </a>
                            ) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fuel Tab */}
          <TabsContent value="fuel" className="animate-in fade-in duration-300">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Fuel className="w-4 h-4 text-info" />
                    Niveaux de carburant ({filteredFuel.length})
                  </CardTitle>
                  <Select value={fuelLevelFilter} onValueChange={setFuelLevelFilter}>
                    <SelectTrigger className="h-8 w-48">
                      <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Niveau" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les niveaux</SelectItem>
                      <SelectItem value="low">Bas (&lt; 20L)</SelectItem>
                      <SelectItem value="medium">Moyen (20-50L)</SelectItem>
                      <SelectItem value="high">Élevé (&gt; 50L)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredFuel.length === 0 ? (
                  <div className="p-12 text-center">
                    <Fuel className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">Aucune donnée de carburant</p>
                    <p className="text-sm text-muted-foreground/70">
                      Les capteurs de carburant ne sont pas configurés sur les véhicules
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Véhicule</TableHead>
                        <TableHead>Niveau de carburant</TableHead>
                        <TableHead>Dernière MAJ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFuel.map((fd, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{fd.device_name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={cn(
                                    'h-full rounded-full',
                                    fd.fuel_level < 20 ? 'bg-destructive' : fd.fuel_level < 50 ? 'bg-warning' : 'bg-success'
                                  )}
                                  style={{ width: `${Math.min(fd.fuel_level, 100)}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium">{fd.fuel_level}L</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {fd.timestamp ? (() => {
                              try { return formatDistanceToNow(new Date(fd.timestamp), { addSuffix: true, locale: fr }); }
                              catch { return fd.timestamp; }
                            })() : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        {data?.timestamp && (
          <p className="text-xs text-muted-foreground text-center">
            Dernière mise à jour:{' '}
            {format(new Date(data.timestamp), 'dd/MM/yyyy à HH:mm:ss', { locale: fr })}
            {' · '}Actualisation automatique toutes les 60 secondes
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
