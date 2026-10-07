import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Key } from 'lucide-react';

// Simplified vehicle interface for map display
export interface MapVehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  status: 'active' | 'inactive' | 'maintenance' | 'available' | 'rented';
  mileage: number;
  driver?: string | null;
  lastPosition?: {
    lat: number;
    lng: number;
    city: string;
  };
}

interface FleetMapProps {
  vehicles: MapVehicle[];
  selectedVehicleId?: string;
  onVehicleSelect?: (vehicleId: string) => void;
}

const FleetMap: React.FC<FleetMapProps> = ({ vehicles, selectedVehicleId, onVehicleSelect }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const [mapboxToken, setMapboxToken] = useState<string>(() => 
    localStorage.getItem('mapbox_token') || ''
  );
  const [isTokenSet, setIsTokenSet] = useState<boolean>(() => 
    !!localStorage.getItem('mapbox_token')
  );
  const [tokenInput, setTokenInput] = useState('');

  const handleSaveToken = () => {
    if (tokenInput.trim()) {
      localStorage.setItem('mapbox_token', tokenInput.trim());
      setMapboxToken(tokenInput.trim());
      setIsTokenSet(true);
    }
  };

  useEffect(() => {
    if (!mapContainer.current || !isTokenSet || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    // Center on Morocco
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-7.0926, 31.7917], // Morocco center
      zoom: 5.5,
      pitch: 0,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-right'
    );

    // Add vehicle markers once map loads
    map.current.on('load', () => {
      addVehicleMarkers();
    });

    return () => {
      // Clean up markers
      Object.values(markersRef.current).forEach(marker => marker.remove());
      markersRef.current = {};
      map.current?.remove();
    };
  }, [isTokenSet, mapboxToken]);

  const addVehicleMarkers = () => {
    if (!map.current) return;

    // Clean existing markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    vehicles.forEach((vehicle) => {
      if (!vehicle.lastPosition) return;

      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'vehicle-marker';
      el.innerHTML = `
        <div class="relative">
          <div class="w-10 h-10 rounded-full flex items-center justify-center shadow-lg cursor-pointer transition-transform hover:scale-110 ${
            vehicle.status === 'active' 
              ? 'bg-emerald-500' 
              : vehicle.status === 'available'
                ? 'bg-emerald-500'
                : vehicle.status === 'rented'
                  ? 'bg-red-500'
              : vehicle.status === 'maintenance' 
                ? 'bg-amber-500' 
                : 'bg-slate-500'
          }">
            <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
            </svg>
          </div>
          ${
            vehicle.status === 'active' || vehicle.status === 'available'
              ? '<div class="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-ping"></div>'
              : vehicle.status === 'rented'
                ? '<div class="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full animate-ping"></div>'
                : ''
          }
          <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium px-2 py-0.5 bg-slate-900 text-white rounded">
            ${vehicle.plate}
          </div>
        </div>
      `;

      el.addEventListener('click', () => {
        onVehicleSelect?.(vehicle.id);
        map.current?.flyTo({
          center: [vehicle.lastPosition!.lng, vehicle.lastPosition!.lat],
          zoom: 12,
          duration: 1000,
        });
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([vehicle.lastPosition.lng, vehicle.lastPosition.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(`
            <div class="p-3 min-w-[200px]">
              <div class="font-bold text-slate-900">${vehicle.plate}</div>
              <div class="text-sm text-slate-600">${vehicle.brand} ${vehicle.model}</div>
              <div class="mt-2 text-sm">
                <div class="flex items-center gap-2">
                  <span class="text-slate-500">📍</span>
                  <span>${vehicle.lastPosition.city}</span>
                </div>
                ${vehicle.driver ? `
                  <div class="flex items-center gap-2 mt-1">
                    <span class="text-slate-500">👤</span>
                    <span>${vehicle.driver}</span>
                  </div>
                ` : ''}
                <div class="flex items-center gap-2 mt-1">
                  <span class="text-slate-500">⛽</span>
                  <span>${vehicle.mileage.toLocaleString('fr-MA')} km</span>
                </div>
              </div>
            </div>
          `)
        )
        .addTo(map.current!);

      markersRef.current[vehicle.id] = marker;
    });
  };

  // Update markers when vehicles change
  useEffect(() => {
    if (map.current && isTokenSet) {
      addVehicleMarkers();
    }
  }, [vehicles]);

  // Fly to selected vehicle
  useEffect(() => {
    if (selectedVehicleId && map.current) {
      const vehicle = vehicles.find(v => v.id === selectedVehicleId);
      if (vehicle?.lastPosition) {
        map.current.flyTo({
          center: [vehicle.lastPosition.lng, vehicle.lastPosition.lat],
          zoom: 12,
          duration: 1000,
        });
        markersRef.current[selectedVehicleId]?.togglePopup();
      }
    }
  }, [selectedVehicleId, vehicles]);

  if (!isTokenSet) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-info/5 flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Key className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Configuration Mapbox
          </h3>
          <p className="text-muted-foreground mb-4">
            Entrez votre clé API publique Mapbox pour afficher la carte en temps réel.
            Obtenez-la sur <a href="https://mapbox.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">mapbox.com</a>
          </p>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="pk.xxx..."
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleSaveToken}>
              Activer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={mapContainer} className="absolute inset-0" />
  );
};

export default FleetMap;
