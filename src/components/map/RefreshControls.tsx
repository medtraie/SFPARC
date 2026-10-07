import React from 'react';
import { Play, Pause, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface RefreshControlsProps {
  isPaused: boolean;
  onTogglePause: () => void;
  refreshInterval: number;
  onIntervalChange: (interval: number) => void;
  onManualRefresh: () => void;
  isFetching: boolean;
  lastUpdate?: Date;
}

export const RefreshControls: React.FC<RefreshControlsProps> = ({
  isPaused,
  onTogglePause,
  refreshInterval,
  onIntervalChange,
  onManualRefresh,
  isFetching,
  lastUpdate,
}) => {
  const formatLastUpdate = (date?: Date) => {
    if (!date) return '';
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSeconds < 60) return `il y a ${diffSeconds}s`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    return `il y a ${diffMinutes}m`;
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Pause/Play Button */}
      <Button
        variant={isPaused ? "default" : "outline"}
        size="sm"
        className="h-8 gap-1.5"
        onClick={onTogglePause}
      >
        {isPaused ? (
          <>
            <Play className="w-3.5 h-3.5" />
            <span className="text-xs">Reprendre</span>
          </>
        ) : (
          <>
            <Pause className="w-3.5 h-3.5" />
            <span className="text-xs">Pause</span>
          </>
        )}
      </Button>

      {/* Interval Selector */}
      <Select
        value={refreshInterval.toString()}
        onValueChange={(value) => onIntervalChange(parseInt(value))}
        disabled={isPaused}
      >
        <SelectTrigger className="h-8 w-[90px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="5000">5 secondes</SelectItem>
          <SelectItem value="10000">10 secondes</SelectItem>
          <SelectItem value="30000">30 secondes</SelectItem>
          <SelectItem value="60000">1 minute</SelectItem>
        </SelectContent>
      </Select>

      {/* Manual Refresh */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onManualRefresh}
        disabled={isFetching}
      >
        <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
      </Button>

      {/* Last Update */}
      {lastUpdate && (
        <span className="text-xs text-muted-foreground">
          {formatLastUpdate(lastUpdate)}
        </span>
      )}
    </div>
  );
};
