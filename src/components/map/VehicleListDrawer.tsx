import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Share2,
  Bell,
  ChevronDown,
  CheckCircle2,
  Bookmark,
  Settings,
  X,
  Navigation2,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MapVehicle } from './GPSwoxMap';

interface VehicleListDrawerProps {
  open: boolean;
  onClose: () => void;
  vehicles: MapVehicle[];
  selectedVehicleId?: string;
  followingVehicleId?: string;
  onVehicleSelect: (id: string) => void;
  onFollowVehicle: (id: string) => void;
  fleetTitle?: string;
}

export const VehicleListDrawer: React.FC<VehicleListDrawerProps> = ({
  open,
  onClose,
  vehicles,
  selectedVehicleId,
  followingVehicleId,
  onVehicleSelect,
  onFollowVehicle,
  fleetTitle = 'SFTM',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'moving' | 'stopped' | 'offline'>('all');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const filteredVehicles = useMemo(() => {
    let list = vehicles;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (v) =>
          v.plate.toLowerCase().includes(q) ||
          v.brand.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q) ||
          (v.driver && v.driver.toLowerCase().includes(q))
      );
    }
    if (activeTab === 'moving') {
      list = list.filter((v) => {
        const isOnline = v.online === 'online' || v.online === 'ack';
        return isOnline && (v.lastPosition?.speed || 0) > 0;
      });
    } else if (activeTab === 'stopped') {
      list = list.filter((v) => {
        const isOnline = v.online === 'online' || v.online === 'ack';
        return isOnline && (!v.lastPosition || (v.lastPosition?.speed || 0) === 0);
      });
    } else if (activeTab === 'offline') {
      list = list.filter((v) => v.online === 'offline');
    }
    return list;
  }, [vehicles, searchQuery, activeTab]);

  const stats = useMemo(() => {
    const moving = vehicles.filter(
      (v) => (v.online === 'online' || v.online === 'ack') && (v.lastPosition?.speed || 0) > 0
    ).length;
    const stopped = vehicles.filter(
      (v) => (v.online === 'online' || v.online === 'ack') && (!v.lastPosition || (v.lastPosition?.speed || 0) === 0)
    ).length;
    const offline = vehicles.filter((v) => v.online === 'offline').length;
    return { moving, stopped, offline, total: vehicles.length };
  }, [vehicles]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop for closing when clicking outside */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px] transition-opacity duration-200"
      />

      {/* Centered Vehicle List Drawer */}
      <div className="fixed z-40 left-1/2 -translate-x-1/2 bottom-20 sm:bottom-24 w-[95vw] sm:w-[480px] max-h-[75vh] flex flex-col pointer-events-auto transition-all duration-300 ease-out animate-in slide-in-from-bottom-6 zoom-in-95">
        <div className="bg-[#0A101D]/90 backdrop-blur-2xl border border-white/15 rounded-3xl shadow-2xl flex flex-col h-full overflow-hidden text-white">
          {/* Top Handle for mobile */}
          <div className="flex justify-center pt-2 sm:hidden">
            <div className="w-12 h-1.5 bg-white/20 rounded-full" />
          </div>

          {/* Top Controls Bar */}
          <div className="p-3.5 pb-2 border-b border-white/5 space-y-3">
            <div className="flex items-center gap-2">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Quick Actions */}
              <button
                type="button"
                className="w-8 h-8 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
                title="Partager"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                className="relative w-8 h-8 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
                title="Notifications"
              >
                <Bell className="w-3.5 h-3.5" />
                <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1.5 right-1.5 ring-2 ring-[#0A101D]" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
                title="Fermer"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Fleet Header */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm tracking-wide text-white">{fleetTitle}</span>
                <span className="text-[11px] font-mono font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-white/10">
                  {stats.total}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-amber-400 flex items-center justify-center transition-colors"
                  title="Favoris"
                >
                  <Bookmark className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={cn(
                  'px-2.5 py-1 rounded-xl font-medium transition-all shrink-0',
                  activeTab === 'all'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                    : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 border border-white/5'
                )}
              >
                Tous ({stats.total})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('moving')}
                className={cn(
                  'px-2.5 py-1 rounded-xl font-medium transition-all shrink-0 flex items-center gap-1',
                  activeTab === 'moving'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                    : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 border border-white/5'
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Mouvement ({stats.moving})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('stopped')}
                className={cn(
                  'px-2.5 py-1 rounded-xl font-medium transition-all shrink-0 flex items-center gap-1',
                  activeTab === 'stopped'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                    : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 border border-white/5'
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Arrêt ({stats.stopped})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('offline')}
                className={cn(
                  'px-2.5 py-1 rounded-xl font-medium transition-all shrink-0 flex items-center gap-1',
                  activeTab === 'offline'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                    : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 border border-white/5'
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Hors ligne ({stats.offline})
              </button>
            </div>
          </div>

          {/* Vehicle List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[55vh] sm:max-h-[50vh]">
            {filteredVehicles.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                Aucun véhicule trouvé pour cette recherche.
              </div>
            ) : (
              filteredVehicles.map((vehicle) => {
                const isSelected = selectedVehicleId === vehicle.id;
                const isFollowing = followingVehicleId === vehicle.id;
                const isOnline = vehicle.online === 'online' || vehicle.online === 'ack';
                const speed = Math.round(vehicle.lastPosition?.speed || 0);
                const isMoving = isOnline && speed > 0;

                const timestampText = vehicle.lastPosition?.timestamp
                  ? new Date(vehicle.lastPosition.timestamp).toLocaleString('fr-FR', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : 'En attente';

                // Speedometer Gauge HUD calculation
                const radius = 17;
                const circumference = 2 * Math.PI * radius;
                const maxGaugeSpeed = 140;
                const progressRatio = Math.min(speed / maxGaugeSpeed, 1);
                const strokeDashoffset = circumference - progressRatio * circumference;

                const gaugeColor = !isOnline
                  ? '#64748b'
                  : isMoving
                  ? '#22c55e'
                  : '#f59e0b';

                return (
                  <div
                    key={vehicle.id}
                    onClick={() => onVehicleSelect(vehicle.id)}
                    className={cn(
                      'group relative p-3 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center justify-between',
                      isSelected
                        ? 'bg-[#15233D] border-emerald-500 shadow-lg shadow-emerald-950/50'
                        : 'bg-[#0E1626]/80 hover:bg-[#131E33] border-white/5 hover:border-white/15'
                    )}
                  >
                    {/* Left Column: Details */}
                    <div className="space-y-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white truncate tracking-wide">
                          {vehicle.plate}
                        </span>
                        {vehicle.brand && (
                          <span className="text-[11px] text-slate-400 font-medium truncate">
                            {vehicle.brand} {vehicle.model}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="font-mono text-[10px] text-slate-300">
                          {timestampText}
                        </span>
                      </div>

                      <div className="text-[11px]">
                        {isMoving ? (
                          <span className="text-emerald-400 font-medium flex items-center gap-1">
                            <Navigation2 className="w-3 h-3" />
                            Durée d'arrêt: En mouvement
                          </span>
                        ) : (
                          <span className="text-amber-400/90 font-medium">
                            Durée d'arrêt: 00h 55m 07s
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Speedometer HUD & Action Buttons */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      {/* Speedometer Gauge HUD */}
                      <div className="relative flex flex-col items-center justify-center w-12 h-12">
                        <svg className="w-12 h-12 -rotate-90 transform" viewBox="0 0 44 44">
                          <circle
                            cx="22"
                            cy="22"
                            r={radius}
                            stroke="#1e293b"
                            strokeWidth="3.5"
                            fill="transparent"
                          />
                          <circle
                            cx="22"
                            cy="22"
                            r={radius}
                            stroke={gaugeColor}
                            strokeWidth="3.5"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            fill="transparent"
                            className="transition-all duration-500 ease-out"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="font-extrabold text-[12px] font-mono leading-none text-white">
                            {speed}
                          </span>
                          <span className="text-[7px] text-slate-400 font-semibold uppercase leading-none mt-0.5">
                            km/h
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onFollowVehicle(vehicle.id);
                          }}
                          className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center border transition-all',
                            isFollowing
                              ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-bold'
                              : 'bg-slate-800/80 border-white/5 text-slate-400 hover:text-white hover:bg-slate-700'
                          )}
                          title={isFollowing ? 'Arrêter le suivi' : 'Suivre le véhicule'}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onVehicleSelect(vehicle.id);
                          }}
                          className="w-7 h-7 rounded-lg bg-slate-800/80 border border-white/5 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all"
                          title="Paramètres"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
};
