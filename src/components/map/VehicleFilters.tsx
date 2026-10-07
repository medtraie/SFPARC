import React from 'react';
import { Search, Wifi, WifiOff, Navigation, Square, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type VehicleFilter = 'all' | 'online' | 'offline' | 'moving' | 'stopped';

interface VehicleFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeFilter: VehicleFilter;
  onFilterChange: (filter: VehicleFilter) => void;
  counts: {
    all: number;
    online: number;
    offline: number;
    moving: number;
    stopped: number;
  };
  isRTL?: boolean;
}

const filters: { key: VehicleFilter; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'all', label: 'Tous', icon: Square, color: 'text-foreground' },
  { key: 'online', label: 'En ligne', icon: Wifi, color: 'text-success' },
  { key: 'moving', label: 'En mouvement', icon: Navigation, color: 'text-primary' },
  { key: 'stopped', label: 'À l\'arrêt', icon: Square, color: 'text-destructive' },
];

export const VehicleFilters: React.FC<VehicleFiltersProps> = ({
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  counts,
  isRTL = false,
}) => {
  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <Search className={cn(
          "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground",
          isRTL ? "right-3" : "left-3"
        )} />
        <Input
          placeholder="Rechercher par IMEI ou plaque..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn("h-9", isRTL ? "pr-9 pl-8" : "pl-9 pr-8")}
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "absolute top-1/2 -translate-y-1/2 w-6 h-6",
              isRTL ? "left-2" : "right-2"
            )}
            onClick={() => onSearchChange('')}
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-1.5">
        {filters.map((filter) => {
          const Icon = filter.icon;
          const isActive = activeFilter === filter.key;
          const count = counts[filter.key];
          
          return (
            <Button
              key={filter.key}
              variant={isActive ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-7 text-xs gap-1.5 px-2",
                !isActive && filter.color
              )}
              onClick={() => onFilterChange(filter.key)}
            >
              <Icon className="w-3 h-3" />
              <span>{filter.label}</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                isActive ? "bg-primary-foreground/20" : "bg-muted"
              )}>
                {count}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};
