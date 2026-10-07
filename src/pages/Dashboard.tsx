import { useTranslation } from 'react-i18next';
import { useMemo, useState } from 'react';
import {
  Truck,
  Package,
  AlertTriangle,
  Fuel,
  Wrench,
  ArrowRight,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { KPICard } from '@/components/dashboard/KPICard';
import { AlertItem } from '@/components/dashboard/AlertItem';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useGPSwoxVehicles } from '@/hooks/useGPSwoxVehicles';
import { useGPSwoxAlerts } from '@/hooks/useGPSwoxAlerts';
import { useMissions } from '@/hooks/useMissions';
import { useFuelLogs } from '@/hooks/useFuelLogs';
import { useComputedRevisions } from '@/hooks/useRevisions';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { t } = useTranslation();
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);
  const { data: vehicles = [] } = useGPSwoxVehicles(60000);
  const { data: alertsResponse } = useGPSwoxAlerts(60000);
  const { data: missions = [] } = useMissions();
  const { data: fuelLogs = [] } = useFuelLogs();
  const { revisions = [] } = useComputedRevisions();
  const now = new Date();
  const rangeStart = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (rangeDays - 1));
    return start;
  }, [rangeDays]);

  const toDate = (value: string) => (value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00`));
  const isInRange = (value?: string | null) => {
    if (!value) return false;
    const date = toDate(value);
    if (Number.isNaN(date.getTime())) return false;
    return date >= rangeStart && date <= now;
  };

  const filteredAlerts = useMemo(
    () => (alertsResponse?.alerts || []).filter((alert) => isInRange(alert.timestamp)),
    [alertsResponse?.alerts, rangeStart, now]
  );
  const filteredMissions = useMemo(
    () => missions.filter((mission) => isInRange(mission.mission_date)),
    [missions, rangeStart, now]
  );
  const filteredFuelLogs = useMemo(
    () => fuelLogs.filter((log) => isInRange(log.log_date)),
    [fuelLogs, rangeStart, now]
  );
  const filteredRevisions = useMemo(
    () => revisions.filter((revision) => isInRange(revision.updated_at)),
    [revisions, rangeStart, now]
  );

  const totalVehicles = vehicles.length;
  const activeVehicles = useMemo(
    () =>
      vehicles.filter(
        (vehicle) =>
          vehicle.online === 'online' ||
          vehicle.status === 'active' ||
          (vehicle.status as string) === 'moving'
      ).length,
    [vehicles]
  );

  const ongoingMissions = useMemo(
    () => filteredMissions.filter((mission) => mission.status === 'in_progress').length,
    [filteredMissions]
  );

  const recentMissions = useMemo(
    () =>
      [...filteredMissions]
        .sort((a, b) => toDate(b.mission_date).getTime() - toDate(a.mission_date).getTime())
        .slice(0, 4),
    [filteredMissions]
  );

  const pendingAlerts = filteredAlerts.length;
  const dashboardAlerts = useMemo(
    () =>
      filteredAlerts.slice(0, 4).map((alert) => ({
        id: alert.id,
        type:
          alert.type === 'speed'
            ? ('speed' as const)
            : alert.type === 'maintenance'
            ? ('maintenance' as const)
            : ('fuel' as const),
        severity: alert.severity,
        message: alert.message,
        timestamp: alert.timestamp,
        vehicleId: alert.device_name || alert.id,
        acknowledged: Boolean(alert.acknowledged),
      })),
    [filteredAlerts]
  );

  const periodFuelCost = useMemo(
    () => filteredFuelLogs.reduce((sum, log) => sum + Number(log.total_cost || 0), 0),
    [filteredFuelLogs]
  );

  const upcomingMaintenance = useMemo(
    () => filteredRevisions.filter((revision) => revision.status === 'due' || revision.status === 'overdue').length,
    [filteredRevisions]
  );

  const fleetAvailability = totalVehicles > 0 ? (activeVehicles / totalVehicles) * 100 : 0;

  const fuelConsumptionByMonth = useMemo(() => {
    const points = rangeDays === 7 ? 7 : rangeDays === 30 ? 10 : 12;
    const segmentSize = Math.ceil(rangeDays / points);
    const segments = Array.from({ length: points }, (_, index) => {
      const segmentStart = new Date(rangeStart);
      segmentStart.setDate(rangeStart.getDate() + index * segmentSize);
      const segmentEnd = new Date(segmentStart);
      segmentEnd.setDate(segmentStart.getDate() + segmentSize - 1);
      const key = `${segmentStart.toISOString().slice(0, 10)}_${segmentEnd.toISOString().slice(0, 10)}`;
      return {
        key,
        month:
          rangeDays === 90
            ? segmentStart.toLocaleDateString('fr-FR', { month: 'short' })
            : segmentStart.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        start: segmentStart,
        end: segmentEnd,
        consumption: 0,
        cost: 0,
      };
    });
    filteredFuelLogs.forEach((log) => {
      const date = new Date(log.log_date);
      const target = segments.find((segment) => date >= segment.start && date <= segment.end);
      if (target) {
        target.consumption += Number(log.liters || 0);
        target.cost += Number(log.total_cost || 0);
      }
    });
    return segments.map((item) => ({
      month: item.month,
      consumption: Number(item.consumption.toFixed(2)),
      cost: Number(item.cost.toFixed(2)),
    }));
  }, [filteredFuelLogs, rangeDays, rangeStart]);

  const fleetAvailabilityByDay = useMemo(() => {
    const points = rangeDays === 90 ? 30 : rangeDays;
    const days = Array.from({ length: points }, (_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (points - 1 - index));
      const key = date.toISOString().slice(0, 10);
      const missionsCount = filteredMissions.filter(
        (mission) => mission.mission_date === key && mission.status !== 'cancelled'
      ).length;
      return {
        day: date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        available: Math.max(activeVehicles - missionsCount, 0),
      };
    });
    return days;
  }, [filteredMissions, now, activeVehicles, rangeDays]);

  const vehiclePlateById = useMemo(() => {
    const map = new Map<string, string>();
    vehicles.forEach((vehicle) => map.set(String(vehicle.id), vehicle.plate));
    return map;
  }, [vehicles]);

  const costByVehicle = useMemo(() => {
    const costs = new Map<string, { plate: string; fuel: number; maintenance: number; other: number }>();

    filteredFuelLogs.forEach((log) => {
      const plate = vehiclePlateById.get(String(log.vehicle_id)) || String(log.vehicle_id);
      const current = costs.get(plate) || { plate, fuel: 0, maintenance: 0, other: 0 };
      current.fuel += Number(log.total_cost || 0);
      costs.set(plate, current);
    });

    filteredRevisions.forEach((revision) => {
      if (!revision.cost) return;
      const plate = revision.vehicle_plate;
      const current = costs.get(plate) || { plate, fuel: 0, maintenance: 0, other: 0 };
      current.maintenance += Number(revision.cost || 0);
      costs.set(plate, current);
    });

    return Array.from(costs.values())
      .sort((a, b) => b.fuel + b.maintenance + b.other - (a.fuel + a.maintenance + a.other))
      .slice(0, 6);
  }, [filteredFuelLogs, filteredRevisions, vehiclePlateById]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-400">Vue d'ensemble</span> de votre flotte
            </h1>
            <p className="text-xs font-medium text-slate-400 mt-1">{t('dashboard.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Neumorphic Date Filter Pills */}
            <div className="flex items-center rounded-xl border border-white/[0.08] p-1 bg-[#0E1626] shadow-[inset_2px_2px_6px_rgba(0,0,0,0.6)]">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setRangeDays(days as 7 | 30 | 90)}
                  className={cn(
                    'h-7 px-3 rounded-lg text-xs font-bold transition-all',
                    rangeDays === days
                      ? 'bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(85,214,232,0.4)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  )}
                >
                  {days}j
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="h-9 px-3.5 border-white/10 bg-[#0E1626] text-slate-200 hover:border-cyan-400/40 hover:text-cyan-400">
              {t('common.export')}
            </Button>
            <Button size="sm" className="h-9 px-4 bg-gradient-to-r from-cyan-400 via-sky-400 to-cyan-500 text-slate-950 font-bold shadow-[0_0_15px_rgba(85,214,232,0.35)] hover:shadow-[0_0_22px_rgba(85,214,232,0.55)]">
              {t('vehicles.addVehicle')}
            </Button>
          </div>
        </div>

        {/* 5 KPI Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard
            title={t('dashboard.activeVehicles')}
            value={`${activeVehicles}/${totalVehicles}`}
            icon={Truck}
            subtitle={`${fleetAvailability.toFixed(0)}% disponible`}
            variant="default"
          />
          <KPICard
            title={t('dashboard.ongoingMissions')}
            value={ongoingMissions}
            icon={Package}
            subtitle={t('dashboard.today')}
            variant="success"
          />
          <KPICard
            title={t('dashboard.pendingAlerts')}
            value={pendingAlerts}
            icon={AlertTriangle}
            variant="warning"
          />
          <KPICard
            title={t('dashboard.monthlyFuelCost')}
            value={`${(periodFuelCost / 1000).toFixed(1)}K`}
            subtitle={`MAD • ${rangeDays} jours`}
            icon={Fuel}
            variant="accent"
          />
          <KPICard
            title={t('dashboard.upcomingMaintenance')}
            value={upcomingMaintenance}
            icon={Wrench}
            subtitle="Cette semaine"
            variant="destructive"
          />
        </div>

        {/* Middle Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Area Chart */}
          <div className="lg:col-span-2 dashboard-panel p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <h3 className="font-bold text-white text-base tracking-wide">{t('dashboard.fuelConsumption')}</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">{rangeDays} derniers jours</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_#55D6E8]" />
                  <span className="text-slate-300">Consommation (L)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_8px_#7C4DFF]" />
                  <span className="text-slate-300">Coût (MAD)</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={270}>
              <AreaChart data={fuelConsumptionByMonth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorConsumption" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#55D6E8" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#55D6E8" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C4DFF" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#7C4DFF" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(11, 16, 32, 0.95)',
                    borderColor: 'rgba(85, 214, 232, 0.3)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                    color: '#e2e8f0',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="consumption"
                  stroke="#55D6E8"
                  strokeWidth={3}
                  fill="url(#colorConsumption)"
                  activeDot={{ r: 6, fill: '#55D6E8', stroke: '#070B16', strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="cost"
                  stroke="#7C4DFF"
                  strokeWidth={2.5}
                  fill="url(#colorCost)"
                  activeDot={{ r: 5, fill: '#7C4DFF', stroke: '#070B16', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Availability Bar Chart */}
          <div className="dashboard-panel p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-white text-base tracking-wide">{t('dashboard.fleetAvailability')}</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">{rangeDays} derniers jours</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={270}>
              <BarChart data={fleetAvailabilityByDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(11, 16, 32, 0.95)',
                    borderColor: 'rgba(85, 217, 197, 0.3)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                    color: '#e2e8f0',
                  }}
                />
                <Bar dataKey="available" fill="#55D9C5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lower Widgets Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Alertes Récentes */}
          <div className="dashboard-panel p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white text-base tracking-wide">{t('dashboard.recentAlerts')}</h3>
                <Link to="/alerts">
                  <Button variant="ghost" size="sm" className="h-7 text-xs font-semibold text-cyan-400 hover:text-cyan-300">
                    {t('dashboard.viewAll')}
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
              <div className="space-y-3">
                {dashboardAlerts.map((alert) => (
                  <AlertItem key={alert.id} alert={alert} />
                ))}
                {dashboardAlerts.length === 0 && (
                  <div className="py-8 text-center text-xs text-slate-500 font-medium">Aucune alerte récente</div>
                )}
              </div>
            </div>
          </div>

          {/* Coûts par véhicule */}
          <div className="dashboard-panel p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="font-bold text-white text-base tracking-wide">{t('dashboard.costByVehicle')}</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">{rangeDays} derniers jours</p>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-400">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  <span>Carburant</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <span>Maintenance</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span>Autres</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={costByVehicle} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis type="number" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis dataKey="plate" type="category" stroke="rgba(255,255,255,0.7)" fontSize={11} width={85} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(11, 16, 32, 0.95)',
                    borderColor: 'rgba(85, 214, 232, 0.3)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                  }}
                  formatter={(value: number) => [`${value.toLocaleString()} MAD`]}
                />
                <Bar dataKey="fuel" stackId="a" fill="#55D6E8" />
                <Bar dataKey="maintenance" stackId="a" fill="#7C4DFF" />
                <Bar dataKey="other" stackId="a" fill="#FF9F43" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Missions récentes */}
          <div className="dashboard-panel p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white text-base tracking-wide">{t('dashboard.recentMissions')}</h3>
                <Link to="/missions">
                  <Button variant="ghost" size="sm" className="h-7 text-xs font-semibold text-cyan-400 hover:text-cyan-300">
                    {t('dashboard.viewAll')}
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
              <div className="space-y-3">
                {recentMissions.map((mission) => (
                  <div
                    key={mission.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] bg-[#0E1626]/80 hover:border-cyan-500/30 transition-all"
                  >
                    <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center flex-shrink-0">
                      <Package className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs text-white truncate">
                        {(mission as any).reference || `Mission #${mission.id.slice(0, 8)}`}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {mission.departure_zone} → {mission.arrival_zone}
                      </p>
                    </div>
                    <span
                      className={`status-badge text-[10px] ${
                        mission.status === 'completed'
                          ? 'status-active'
                          : mission.status === 'in_progress'
                          ? 'status-warning'
                          : 'status-inactive'
                      }`}
                    >
                      {mission.status === 'completed'
                        ? 'Livrée'
                        : mission.status === 'in_progress'
                        ? 'En cours'
                        : 'Planifiée'}
                    </span>
                  </div>
                ))}
                {recentMissions.length === 0 && (
                  <div className="py-8 text-center text-xs text-slate-500 font-medium">Aucune mission récente</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
