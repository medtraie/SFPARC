import React from 'react';
import { Map, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type MapLayerType = 'osm' | 'google-streets' | 'google-hybrid' | 'google-satellite';

interface MapLayerControlProps {
  currentLayer: MapLayerType;
  onLayerChange: (layer: MapLayerType) => void;
  className?: string;
}

const layerOptions: { value: MapLayerType; label: string; icon: string }[] = [
  { value: 'osm', label: 'OpenStreetMap', icon: '🗺️' },
  { value: 'google-streets', label: 'Google Maps', icon: '📍' },
  { value: 'google-hybrid', label: 'Google Hybrid', icon: '🌍' },
  { value: 'google-satellite', label: 'Google Satellite', icon: '🛰️' },
];

export const MapLayerControl: React.FC<MapLayerControlProps> = ({
  currentLayer,
  onLayerChange,
  className,
}) => {
  const currentOption = layerOptions.find(o => o.value === currentLayer);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 gap-1.5 bg-card/90 backdrop-blur shadow-lg border-border',
            className
          )}
        >
          <Layers className="w-4 h-4" />
          <span className="text-xs hidden sm:inline">{currentOption?.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {layerOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onLayerChange(option.value)}
            className={cn(
              'flex items-center gap-2 cursor-pointer',
              currentLayer === option.value && 'bg-accent'
            )}
          >
            <span>{option.icon}</span>
            <span>{option.label}</span>
            {currentLayer === option.value && (
              <span className="ml-auto text-primary">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
