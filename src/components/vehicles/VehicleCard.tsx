import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  MoreHorizontal,
  Gauge,
  User,
  Fuel,
  Battery,
  Truck,
  Car,
  Bus,
  Navigation,
  TrendingUp,
  Activity,
  Milestone,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { GPSwoxVehicle } from '@/hooks/useGPSwoxVehicles';
import { VehicleReport } from '@/hooks/useGPSwoxReports';
import { useVehicleAddress } from '@/hooks/useVehicleAddress';
import {
  extractVehicleOdometer,
  extractVehicleDistanceToday,
  extractVehicleMaxSpeed,
} from '@/lib/gpswox-sensors';

interface VehicleCardProps {
  vehicle: GPSwoxVehicle;
  report?: VehicleReport | null;
  highestOverspeed?: number;
  compact?: boolean;
  onDetails?: (vehicle: GPSwoxVehicle) => void;
}

const BATTERY_MAINTENANCE_THRESHOLD_V = 9;

// Determine vehicle icon based on name/plate
function getVehicleIcon(name: string) {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('bus')) return Bus;
  if (lowerName.includes('camion') || lowerName.includes('truck') || lowerName.includes('remorque')) return Truck;
  if (lowerName.includes('fourgon') || lowerName.includes('van') || lowerName.includes('utilitaire')) return Truck;
  return Car;
}

// Clean vehicle title without "GPS Device"
function getCleanVehicleModel(brand?: string, model?: string, plate?: string) {
  const cleanBrand = brand && brand.toLowerCase() !== 'gps device' ? brand : '';
  const cleanModel = model && model.toLowerCase() !== 'gps device' && model !== plate ? model : '';
  const combined = [cleanBrand, cleanModel].filter(Boolean).join(' ');
  if (combined) return combined;
  return 'Flotte SFTM';
}

export function VehicleCard({
  vehicle,
  report,
  highestOverspeed = 0,
  compact = false,
  onDetails,
}: VehicleCardProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);

  const speed = vehicle.lastPosition?.speed || 0;
  const fuel = vehicle.fuelQuantity;
  const battery = vehicle.battery;
  const batteryVolts = battery !== null ? Number(battery) : null;
  const batteryIsLow = batteryVolts !== null && batteryVolts < BATTERY_MAINTENANCE_THRESHOLD_V;
  const effectiveStatus =
    vehicle.status === 'maintenance' && !batteryIsLow ? 'active' : vehicle.status;
  const isMoving = speed > 0 && vehicle.online === 'online';

  // 1. Real Odometer (Kilométrage)
  const realOdometer = useMemo(() => {
    return extractVehicleOdometer(vehicle, report);
  }, [vehicle, report]);

  // 2. Real Daily Distance (Distance Jour)
  const realDistanceToday = useMemo(() => {
    return extractVehicleDistanceToday(vehicle, report);
  }, [vehicle, report]);

  // 3. Real Daily Max Speed (Highest recorded today)
  const [maxSpeed, setMaxSpeed] = useState<number>(() => {
    return extractVehicleMaxSpeed(vehicle, report, highestOverspeed);
  });

  useEffect(() => {
    const computed = extractVehicleMaxSpeed(vehicle, report, highestOverspeed);
    if (computed > maxSpeed) {
      setMaxSpeed(computed);
    }
  }, [speed, vehicle, report, highestOverspeed, maxSpeed]);

  // Reverse geocoded real address
  const { address, isLoading: isAddressLoading } = useVehicleAddress(
    vehicle.lastPosition?.lat,
    vehicle.lastPosition?.lng,
    vehicle.lastPosition?.address || vehicle.lastPosition?.city
  );

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const VehicleIcon = getVehicleIcon(`${vehicle.plate} ${vehicle.brand} ${vehicle.model}`);
  const modelText = getCleanVehicleModel(vehicle.brand, vehicle.model, vehicle.plate);

  // Digital speedometer HUD theme & color dynamics based on vehicle state
  const speedTheme = useMemo(() => {
    if (vehicle.online === 'offline') {
      return {
        bg: 'bg-[#0B1020]/90 border-slate-800/80',
        text: 'text-slate-400',
        glow: '',
        badgeBg: 'bg-slate-800/60 text-slate-400 border-slate-700/50',
        label: 'Hors ligne',
        barColor: 'bg-slate-700',
        accentRing: 'border-slate-800',
      };
    }
    if (speed === 0 || !isMoving) {
      return {
        bg: 'bg-[#0E1726]/90 border-slate-700/60 shadow-[inset_1px_1px_4px_rgba(0,0,0,0.6)]',
        text: 'text-slate-300',
        glow: '',
        badgeBg: 'bg-slate-800/70 text-slate-300 border-slate-700/60',
        label: "À l'arrêt",
        barColor: 'bg-slate-600',
        accentRing: 'border-slate-700',
      };
    }
    if (speed > 90) {
      return {
        bg: 'bg-rose-950/40 border-rose-500/50 shadow-[0_0_25px_rgba(244,63,94,0.35),inset_0_0_15px_rgba(244,63,94,0.15)] animate-pulse',
        text: 'text-rose-400',
        glow: 'shadow-[0_0_14px_rgba(244,63,94,0.6)]',
        badgeBg: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
        label: 'Excès de vitesse',
        barColor: 'bg-gradient-to-r from-amber-400 to-rose-500',
        accentRing: 'border-rose-500/50',
      };
    }
    if (speed > 60) {
      return {
        bg: 'bg-sky-950/35 border-sky-400/50 shadow-[0_0_20px_rgba(56,189,248,0.25),inset_0_0_12px_rgba(56,189,248,0.12)]',
        text: 'text-sky-300',
        glow: 'shadow-[0_0_12px_rgba(56,189,248,0.5)]',
        badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-400/40',
        label: 'Croisière rapide',
        barColor: 'bg-gradient-to-r from-cyan-400 to-sky-400',
        accentRing: 'border-sky-400/50',
      };
    }
    // Normal cruising (1 - 60 km/h)
    return {
      bg: 'bg-cyan-950/35 border-cyan-400/50 shadow-[0_0_20px_rgba(85,214,232,0.25),inset_0_0_12px_rgba(85,214,232,0.12)]',
      text: 'text-cyan-300',
      glow: 'shadow-[0_0_12px_rgba(85,214,232,0.5)]',
      badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
      label: 'En mouvement',
      barColor: 'bg-gradient-to-r from-emerald-400 to-cyan-400',
      accentRing: 'border-cyan-400/50',
    };
  }, [speed, isMoving, vehicle.online]);

  const speedPercentage = Math.min(Math.max((speed / 130) * 100, 0), 100);

  // ----------------------------------------------------
  // COMPACT MODE (LIST VIEW)
  // ----------------------------------------------------
  if (compact) {
    return (
      <div className="flex items-center gap-4 p-3.5 rounded-2xl border border-white/[0.08] bg-[#121A2B] hover:bg-[#162136] hover:border-cyan-500/30 transition-all duration-300 shadow-[6px_6px_14px_rgba(3,7,18,0.6)]">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-400/20 via-sky-500/15 to-blue-600/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shadow-[0_0_12px_rgba(85,214,232,0.2)]">
          <VehicleIcon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-extrabold text-sm text-white tracking-wide">{vehicle.plate}</p>
            <span className="text-[11px] text-slate-400 font-medium truncate">{modelText}</span>
          </div>
          <p className="text-xs text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
            <MapPin className="w-3 h-3 text-cyan-400 flex-shrink-0" />
            <span className="truncate">{address}</span>
          </p>
        </div>

        {/* Compact Digital Speed */}
        <div className={cn('px-2.5 py-1 rounded-xl border flex items-center gap-1.5', speedTheme.bg)}>
          <span className={cn('font-mono font-black text-sm', speedTheme.text)}>
            {Math.round(speed)}
          </span>
          <span className="text-[9px] font-bold text-slate-400 uppercase">km/h</span>
        </div>

        <div className="flex items-center gap-2">
          <span className={cn(
            'text-[10px] font-bold px-2.5 py-0.5 rounded-full border',
            vehicle.online === 'online' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
            vehicle.online === 'ack' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
            'bg-slate-800 text-slate-400 border-slate-700'
          )}>
            {vehicle.online === 'online' ? 'En ligne' : vehicle.online === 'ack' ? 'En attente' : 'Hors ligne'}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-cyan-400 hover:text-cyan-300 hover:bg-white/[0.05]"
            onClick={() => onDetails ? onDetails(vehicle) : navigate('/reports', { state: { vehicleId: String(vehicle.id), plate: vehicle.plate, tab: 'summary' } })}
          >
            Détails
          </Button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // FULL 2026 LUXURY NEUMORPHIC CARD (COMPACT ULTRA SLEEK)
  // ----------------------------------------------------
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#121A2B] p-2.5 shadow-[6px_6px_18px_rgba(3,7,18,0.7),-3px_-3px_10px_rgba(255,255,255,0.02)] hover:shadow-[10px_10px_24px_rgba(3,7,18,0.85),-4px_-4px_14px_rgba(85,214,232,0.08)] hover:border-cyan-500/30 transition-all duration-300 group flex flex-col justify-between">
      {/* Ambient Cyber Light Rim */}
      <div className="pointer-events-none absolute -top-12 -right-12 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all duration-500" />
      
      <div>
        {/* Top Header Row */}
        <div className="flex items-start justify-between gap-1.5 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            {/* 3D Neumorphic Icon Container */}
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-[#0E1626] to-[#080E1B] p-0.5 shadow-[inset_1px_1px_3px_rgba(255,255,255,0.08),3px_3px_8px_rgba(0,0,0,0.6)] flex items-center justify-center flex-shrink-0 border border-white/[0.06]">
              <div className="w-full h-full rounded-[10px] bg-gradient-to-br from-cyan-500/20 via-sky-500/10 to-transparent flex items-center justify-center text-cyan-300 group-hover:scale-105 transition-transform duration-300">
                <VehicleIcon className="w-4 h-4 drop-shadow-[0_0_6px_rgba(85,214,232,0.5)]" />
              </div>
              {/* Online Pulse Dot */}
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                {vehicle.online === 'online' && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span className={cn(
                  'relative inline-flex rounded-full h-2.5 w-2.5 border-2 border-[#121A2B]',
                  vehicle.online === 'online' ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' :
                  vehicle.online === 'ack' ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24]' :
                  'bg-slate-500'
                )} />
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-black text-white tracking-wide truncate font-mono">
                  {vehicle.plate}
                </h3>
              </div>
              {/* Clean Model / Category (NO 'GPS Device') */}
              <p className="text-[10px] font-semibold text-slate-400 truncate">
                {modelText}
              </p>
            </div>
          </div>

          {/* Right Status Badge & Menu */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-lg border tracking-wide uppercase',
              effectiveStatus === 'active'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : effectiveStatus === 'maintenance'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            )}>
              {effectiveStatus === 'active' ? 'Actif' : effectiveStatus === 'maintenance' ? 'Maintenance' : 'Inactif'}
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg bg-[#0E1626] border border-white/[0.06] text-slate-300 hover:text-cyan-400 hover:bg-white/[0.06]">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#0E1626] border-white/10 text-slate-200">
                <DropdownMenuItem
                  onClick={() => {
                    if (onDetails) {
                      onDetails(vehicle);
                      return;
                    }
                    navigate('/reports', {
                      state: { vehicleId: String(vehicle.id), plate: vehicle.plate, tab: 'summary' },
                    });
                  }}
                  className="focus:bg-cyan-500/20 focus:text-cyan-300 text-xs"
                >
                  Fiche Détaillée
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    navigate('/live-map', {
                      state: { vehicleId: String(vehicle.id) },
                    })
                  }
                  className="focus:bg-cyan-500/20 focus:text-cyan-300 text-xs"
                >
                  Voir sur la carte Live
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    navigate('/reports', {
                      state: { vehicleId: String(vehicle.id), plate: vehicle.plate, tab: 'vehicles' },
                    })
                  }
                  className="focus:bg-cyan-500/20 focus:text-cyan-300 text-xs"
                >
                  Historique des trajets
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* 2026 DIGITAL SPEEDOMETER HUD (DYNAMIC COMPACT)       */}
        {/* ---------------------------------------------------- */}
        <div className={cn(
          'relative overflow-hidden rounded-xl border px-2.5 py-1.5 mb-1.5 transition-all duration-300',
          speedTheme.bg
        )}>
          <div className="flex items-center justify-between">
            {/* Speed Readout */}
            <div className="flex items-baseline gap-1.5">
              <span className={cn('text-xl font-black font-mono tracking-tight', speedTheme.text)}>
                {Math.round(speed).toString().padStart(2, '0')}
              </span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                KM/H
              </span>
            </div>

            {/* State Pill Badge */}
            <div className="flex items-center gap-1">
              <span className={cn('text-[9px] font-extrabold px-2 py-0.5 rounded-full border', speedTheme.badgeBg)}>
                {speedTheme.label}
              </span>
            </div>
          </div>

          {/* Dynamic Speed Progression Bar */}
          <div className="mt-1">
            <div className="h-1 w-full bg-[#070B16] rounded-full overflow-hidden p-0.5 shadow-inner">
              <div
                className={cn('h-full rounded-full transition-all duration-500', speedTheme.barColor)}
                style={{ width: `${speedPercentage}%` }}
              />
            </div>
          </div>

          {/* Speed Sub-metrics: Vitesse Max */}
          <div className="mt-1 flex items-center justify-between text-[10px] font-semibold text-slate-400 pt-1 border-t border-white/[0.04]">
            <span className="flex items-center gap-1 text-slate-400">
              <Gauge className="w-3 h-3 text-cyan-400" />
              Compteur Digital
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <TrendingUp className="w-3 h-3 text-amber-400" />
              Vitesse Max : <strong className="text-white font-mono">{Math.round(maxSpeed)} km/h</strong>
            </span>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* FULL REAL ADDRESS (COLLAPSIBLE SLEEK DRAWER)         */}
        {/* ---------------------------------------------------- */}
        <div className="rounded-lg border border-white/[0.06] bg-[#0E1626]/80 px-2 py-1 mb-1.5 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setAddressOpen((o) => !o); }}
              className="flex items-center gap-1.5 flex-1 min-w-0 text-left py-0.5 hover:text-cyan-300 transition-colors"
              aria-expanded={addressOpen}
            >
              <MapPin className="w-3 h-3 text-cyan-400 flex-shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
                Adresse en temps réel
              </span>
              <ChevronDown className={cn('w-3 h-3 text-cyan-400 transition-transform duration-300 flex-shrink-0', addressOpen && 'rotate-180')} />
            </button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleCopyAddress}
                    className="text-[9px] text-slate-400 hover:text-cyan-300 flex items-center gap-0.5 transition-colors px-1"
                  >
                    {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                    <span>{copied ? 'Copié' : 'Copier'}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-[#0B1020] border-white/10 text-xs">
                  Copier l'adresse complète
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className={cn('grid transition-all duration-300 ease-in-out', addressOpen ? 'grid-rows-[1fr] mt-1 pt-1 border-t border-white/[0.04]' : 'grid-rows-[0fr]')}>
            <div className="overflow-hidden">
              <p className={cn(
                'text-[11px] font-medium text-slate-200 leading-snug break-words',
                isAddressLoading && 'animate-pulse text-slate-400'
              )}>
                {isAddressLoading ? 'Localisation en cours...' : address}
              </p>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* STATS ROW: KILOMÉTRAGE & DISTANCE DU JOUR            */}
        {/* ---------------------------------------------------- */}
        <div className="grid grid-cols-2 gap-1.5 mb-1.5">
          {/* Total Mileage (Odometer) */}
          <div className="rounded-lg border border-white/[0.06] bg-[#0E1626]/60 p-1.5 px-2">
            <div className="text-[9px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
              <Milestone className="w-2.5 h-2.5 text-sky-400" />
              Kilométrage
            </div>
            <p className="text-xs font-black text-white font-mono mt-0.5">
              {Math.round(realOdometer).toLocaleString()} <span className="text-[9px] font-sans text-slate-400">km</span>
            </p>
          </div>

          {/* Distance du jour (REQUIRED IN PROMPT) */}
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-1.5 px-2 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.4)]">
            <div className="text-[9px] font-bold uppercase text-cyan-300 tracking-wider flex items-center gap-1">
              <Activity className="w-2.5 h-2.5 text-cyan-400" />
              Distance Jour
            </div>
            <p className="text-xs font-black text-cyan-300 font-mono mt-0.5">
              {realDistanceToday > 0
                ? (realDistanceToday >= 10 ? Math.round(realDistanceToday).toLocaleString() : realDistanceToday.toFixed(1))
                : '0'}{' '}
              <span className="text-[9px] font-sans text-cyan-400/80">km</span>
            </p>
          </div>
        </div>

        {/* Assigned Driver (if any) */}
        {vehicle.driver && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#0E1626]/50 border border-white/[0.04] mb-1.5 text-[10px]">
            <div className="w-4 h-4 rounded-full bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center flex-shrink-0 text-cyan-400">
              <User className="w-2.5 h-2.5" />
            </div>
            <span className="text-slate-400 text-[10px]">Chauffeur :</span>
            <span className="font-bold text-white truncate">{vehicle.driver}</span>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* CYBER GAUGES: CARBURANT & BATTERIE (SIDE BY SIDE)    */}
        {/* ---------------------------------------------------- */}
        <div className="pt-1.5 border-t border-white/[0.06] grid grid-cols-2 gap-2 mb-1.5">
          {/* Fuel Gauge */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-semibold mb-0.5">
              <span className="text-slate-400 flex items-center gap-1">
                <Fuel className="w-2.5 h-2.5 text-cyan-400" />
                Carburant
              </span>
              <span className={cn('font-mono font-bold text-[10px]', fuel !== null && fuel < 20 ? 'text-rose-400' : 'text-slate-200')}>
                {fuel !== null ? `${fuel}%` : '—'}
              </span>
            </div>
            <div className="h-1 bg-[#070B16] rounded-full overflow-hidden shadow-inner">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  fuel !== null && fuel < 20
                    ? 'bg-gradient-to-r from-rose-500 to-amber-500 shadow-[0_0_6px_#f43f5e]'
                    : 'bg-gradient-to-r from-cyan-400 to-emerald-400 shadow-[0_0_6px_#55D6E8]'
                )}
                style={{ width: `${Math.min(fuel ?? 0, 100)}%` }}
              />
            </div>
          </div>

          {/* Battery Gauge */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-semibold mb-0.5">
              <span className="text-slate-400 flex items-center gap-1">
                <Battery className="w-2.5 h-2.5 text-purple-400" />
                Batterie
              </span>
              <span className={cn('font-mono font-bold text-[10px]', batteryIsLow ? 'text-rose-400' : 'text-slate-200')}>
                {batteryVolts !== null ? `${batteryVolts.toFixed(1)}V` : '—'}
              </span>
            </div>
            <div className="h-1 bg-[#070B16] rounded-full overflow-hidden shadow-inner">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  batteryIsLow
                    ? 'bg-gradient-to-r from-rose-500 to-red-600 shadow-[0_0_6px_#f43f5e]'
                    : 'bg-gradient-to-r from-purple-400 to-indigo-400 shadow-[0_0_6px_#a855f7]'
                )}
                style={{
                  width: `${batteryVolts !== null ? Math.max(0, Math.min(((batteryVolts - 9) / 5.5) * 100, 100)) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* CARD ACTION BUTTONS                                  */}
      {/* ---------------------------------------------------- */}
      <div className="mt-0.5 pt-1.5 border-t border-white/[0.06] flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-7 text-[11px] font-bold border-white/10 bg-[#0E1626] text-slate-200 hover:border-cyan-400/50 hover:text-cyan-400 hover:bg-white/[0.04] transition-all px-2"
          onClick={() =>
            navigate('/live-map', {
              state: { vehicleId: String(vehicle.id) },
            })
          }
        >
          <Navigation className="w-2.5 h-2.5 mr-1 text-cyan-400" />
          Carte
        </Button>
        <Button
          size="sm"
          className="flex-1 h-7 text-[11px] font-bold bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(85,214,232,0.3)] hover:shadow-[0_0_14px_rgba(85,214,232,0.5)] hover:scale-[1.01] active:scale-[0.99] transition-all px-2"
          onClick={() => {
            if (onDetails) {
              onDetails(vehicle);
              return;
            }
            navigate('/reports', {
              state: { vehicleId: String(vehicle.id), plate: vehicle.plate, tab: 'summary' },
            });
          }}
        >
          <ExternalLink className="w-2.5 h-2.5 mr-1" />
          Détails
        </Button>
      </div>
    </div>
  );
}
