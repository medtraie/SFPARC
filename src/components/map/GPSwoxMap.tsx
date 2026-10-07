import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { Loader2, AlertTriangle } from 'lucide-react';

export type MapLayerType = 'osm' | 'google-streets' | 'google-hybrid' | 'google-satellite';

const getTileLayerConfig = (layerType: MapLayerType) => {
  switch (layerType) {
    case 'google-streets':
      return {
        url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=fr&gl=MA',
        attribution: '&copy; Google Maps',
        maxZoom: 20,
        subdomains: ['0', '1', '2', '3'],
      };
    case 'google-hybrid':
      return {
        url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=fr&gl=MA',
        attribution: '&copy; Google Maps',
        maxZoom: 20,
        subdomains: ['0', '1', '2', '3'],
      };
    case 'google-satellite':
      return {
        url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&hl=fr&gl=MA',
        attribution: '&copy; Google Maps',
        maxZoom: 20,
        subdomains: ['0', '1', '2', '3'],
      };
    case 'osm':
    default:
      return {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      };
  }
};

export interface MapVehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  status: 'active' | 'inactive' | 'maintenance';
  mileage: number;
  driver?: string | null;
  speed?: number;
  lastUpdate?: string;
  fuelQuantity?: number | null;
  // Additional data
  battery?: number | null;
  network?: number | null;
  distanceToday?: number | null;
  online?: string; // 'online', 'ack', 'offline'
  lastPosition?: {
    lat: number;
    lng: number;
    city: string;
    speed?: number;
    timestamp?: string;
  };
}

interface GPSwoxMapProps {
  vehicles: MapVehicle[];
  selectedVehicleId?: string;
  followingVehicleId?: string;
  onVehicleSelect?: (vehicleId: string) => void;
  isLoading?: boolean;
  error?: Error | null;
  enableClustering?: boolean;
  mapLayer?: MapLayerType;
  traceurVehicleIds?: Set<string>;
  resetViewSignal?: number;
}

// Store vehicle position history for traceurs
const vehiclePositionHistory = new Map<string, L.LatLng[]>();
const MAX_TRACEUR_POINTS = 100; // Maximum points to keep in trail
const vehicleIconCache = new Map<string, L.DivIcon>();

// Custom vehicle icon based on status and movement
// Mouvement = Vert, À l'arrêt = Rouge, Hors ligne = Noir
const createVehicleIcon = (_status: string, isMoving: boolean = false, isOnline: boolean = true) => {
  const iconKey = `${isOnline ? 'online' : 'offline'}-${isMoving ? 'moving' : 'stopped'}`;
  const cachedIcon = vehicleIconCache.get(iconKey);
  if (cachedIcon) return cachedIcon;

  let color: string;
  if (!isOnline) {
    color = '#1a1a1a';
  } else if (isMoving) {
    color = '#22c55e';
  } else {
    color = '#ef4444';
  }
  
  const svgIcon = `
    <svg width="32" height="44" viewBox="0 0 32 44" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 8.837 16 28 16 28s16-19.163 16-28C32 7.163 24.837 0 16 0z" 
            fill="${color}"/>
      <circle cx="16" cy="14" r="7" fill="white" opacity="0.95"/>
      <circle cx="16" cy="14" r="5" fill="${color}" opacity="0.25"/>
      ${isMoving ? `
        <circle cx="16" cy="14" r="12" fill="none" stroke="${color}" stroke-width="2" opacity="0.6">
          <animate attributeName="r" from="10" to="18" dur="1.2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" from="0.6" to="0" dur="1.2s" repeatCount="indefinite"/>
        </circle>
      ` : ''}
    </svg>
  `;

  const icon = L.divIcon({
    html: svgIcon,
    className: 'custom-vehicle-marker',
    iconSize: [32, 44],
    iconAnchor: [16, 44],
    popupAnchor: [0, -44],
  });
  vehicleIconCache.set(iconKey, icon);
  return icon;
};

const formatTimestamp = (timestamp?: string) => {
  if (!timestamp) return 'Non disponible';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffMins < 1440) return `Il y a ${Math.floor(diffMins / 60)}h`;
  
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const GPSwoxMap: React.FC<GPSwoxMapProps> = ({ 
  vehicles, 
  selectedVehicleId, 
  followingVehicleId,
  onVehicleSelect,
  isLoading,
  error,
  enableClustering = true,
  mapLayer = 'osm',
  traceurVehicleIds = new Set(),
  resetViewSignal = 0,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const markerStateRef = useRef<Map<string, { iconKey: string; popupKey: string }>>(new Map());
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const hasFittedBounds = useRef(false);
  const followIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const traceursRef = useRef<Map<string, L.Polyline>>(new Map());
  const lastSelectedFlyToRef = useRef<string | undefined>(undefined);
  const tileFallbackAppliedRef = useRef(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const tileLayersCacheRef = useRef<Map<string, L.TileLayer>>(new Map());
  const activeBaseLayerKeyRef = useRef<string | null>(null);

  const createTileLayer = useCallback((layerKey: string) => {
    const targetLayer = layerKey === 'fallback-osm' ? 'osm' : (layerKey as MapLayerType);
    const config = getTileLayerConfig(targetLayer);
    const layer = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
      ...(config.subdomains ? { subdomains: config.subdomains } : {}),
      updateWhenIdle: true,
      keepBuffer: 3,
    });
    layer.on('tileerror', () => {
      if (targetLayer === 'osm' || tileFallbackAppliedRef.current || !mapRef.current) return;
      tileFallbackAppliedRef.current = true;
      const fallbackKey = 'fallback-osm';
      let fallbackLayer = tileLayersCacheRef.current.get(fallbackKey);
      if (!fallbackLayer) {
        fallbackLayer = createTileLayer(fallbackKey);
        tileLayersCacheRef.current.set(fallbackKey, fallbackLayer);
      }
      if (tileLayerRef.current && mapRef.current.hasLayer(tileLayerRef.current)) {
        mapRef.current.removeLayer(tileLayerRef.current);
      }
      fallbackLayer.addTo(mapRef.current);
      tileLayerRef.current = fallbackLayer;
      activeBaseLayerKeyRef.current = fallbackKey;
    });
    return layer;
  }, []);

  // Initialize map - only once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      center: [31.7917, -7.0926], // Morocco center
      zoom: 6,
      zoomControl: true,
      fadeAnimation: false,
    });
    setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 120);
    resizeObserverRef.current = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    resizeObserverRef.current.observe(mapContainerRef.current);

    const initialKey = mapLayer;
    const initialTileLayer = createTileLayer(initialKey);
    tileLayersCacheRef.current.set(initialKey, initialTileLayer);
    initialTileLayer.addTo(mapRef.current);
    tileLayerRef.current = initialTileLayer;
    activeBaseLayerKeyRef.current = initialKey;

    // Initialize cluster group
    clusterGroupRef.current = L.markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 50,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        let size = 'small';
        let diameter = 40;
        
        if (count > 10) {
          size = 'medium';
          diameter = 50;
        }
        if (count > 50) {
          size = 'large';
          diameter = 60;
        }

        return L.divIcon({
          html: `<div class="cluster-icon cluster-${size}">${count}</div>`,
          className: 'custom-cluster-marker',
          iconSize: [diameter, diameter],
        });
      },
    });

    if (enableClustering) {
      mapRef.current.addLayer(clusterGroupRef.current);
    }

    return () => {
      if (followIntervalRef.current) {
        clearInterval(followIntervalRef.current);
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      tileLayersCacheRef.current.clear();
      activeBaseLayerKeyRef.current = null;
    };
  }, [createTileLayer, mapLayer]);

  // Handle layer change - preserve zoom and center
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    tileFallbackAppliedRef.current = false;
    if (activeBaseLayerKeyRef.current === mapLayer) return;

    let nextTileLayer = tileLayersCacheRef.current.get(mapLayer);
    if (!nextTileLayer) {
      nextTileLayer = createTileLayer(mapLayer);
      tileLayersCacheRef.current.set(mapLayer, nextTileLayer);
    }

    if (tileLayerRef.current && map.hasLayer(tileLayerRef.current)) {
      map.removeLayer(tileLayerRef.current);
    }
    nextTileLayer.addTo(map);
    tileLayerRef.current = nextTileLayer;
    activeBaseLayerKeyRef.current = mapLayer;

    map.invalidateSize({ pan: false, animate: false });
  }, [createTileLayer, mapLayer]);

  // Toggle clustering
  useEffect(() => {
    if (!mapRef.current || !clusterGroupRef.current) return;

    if (enableClustering) {
      if (!mapRef.current.hasLayer(clusterGroupRef.current)) {
        mapRef.current.addLayer(clusterGroupRef.current);
        // Move all markers to cluster group
        markersRef.current.forEach((marker) => {
          if (mapRef.current?.hasLayer(marker)) {
            mapRef.current.removeLayer(marker);
          }
          clusterGroupRef.current?.addLayer(marker);
        });
      }
    } else {
      if (mapRef.current.hasLayer(clusterGroupRef.current)) {
        // Move all markers out of cluster group
        markersRef.current.forEach((marker) => {
          clusterGroupRef.current?.removeLayer(marker);
          marker.addTo(mapRef.current!);
        });
        mapRef.current.removeLayer(clusterGroupRef.current);
      }
    }
  }, [enableClustering]);

  // Update markers when vehicles change
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const currentMarkers = markersRef.current;
    const vehicleIds = new Set(vehicles.map(v => v.id));

    // Remove markers for vehicles that no longer exist
    currentMarkers.forEach((marker, id) => {
      if (!vehicleIds.has(id)) {
        if (enableClustering && clusterGroupRef.current) {
          clusterGroupRef.current.removeLayer(marker);
        } else {
          marker.remove();
        }
        currentMarkers.delete(id);
        markerStateRef.current.delete(id);
      }
    });

    // Add or update markers
    vehicles.forEach((vehicle) => {
      if (!vehicle.lastPosition) return;

      const { lat, lng } = vehicle.lastPosition;
      const isMoving = (vehicle.lastPosition.speed || 0) > 0;
      let marker = currentMarkers.get(vehicle.id);
      const isOnline = vehicle.online === 'online' || vehicle.online === 'ack';
      const iconKey = `${isOnline ? 'online' : 'offline'}-${isMoving ? 'moving' : 'stopped'}`;
      
      if (marker) {
        const currentLatLng = marker.getLatLng();
        if (Math.abs(currentLatLng.lat - lat) > 0.000001 || Math.abs(currentLatLng.lng - lng) > 0.000001) {
          marker.setLatLng([lat, lng]);
        }
        const prevState = markerStateRef.current.get(vehicle.id);
        if (!prevState || prevState.iconKey !== iconKey) {
          marker.setIcon(createVehicleIcon(vehicle.status, isMoving, isOnline));
        }
      } else {
        marker = L.marker([lat, lng], {
          icon: createVehicleIcon(vehicle.status, isMoving, isOnline),
        });

        marker.on('click', () => {
          onVehicleSelect?.(vehicle.id);
        });

        if (enableClustering && clusterGroupRef.current) {
          clusterGroupRef.current.addLayer(marker);
        } else {
          marker.addTo(map);
        }
        currentMarkers.set(vehicle.id, marker);
      }

      const address = vehicle.lastPosition?.city
        ? `${vehicle.lastPosition.city} (${lat.toFixed(5)}, ${lng.toFixed(5)})`
        : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

      const statusColor = vehicle.status === 'active' ? '#10b981' : 
                         vehicle.status === 'maintenance' ? '#f59e0b' : '#6b7280';
      const statusText = vehicle.status === 'active' ? 'Actif' : 
                        vehicle.status === 'maintenance' ? 'Maintenance' : 'Inactif';
      
      const speed = vehicle.lastPosition?.speed || 0;
      
      const popupKey = `${address}|${statusText}|${speed}|${vehicle.fuelQuantity ?? ''}|${vehicle.battery ?? ''}|${vehicle.network ?? ''}|${vehicle.distanceToday ?? ''}|${vehicle.driver ?? ''}|${vehicle.mileage}`;
      const prevState = markerStateRef.current.get(vehicle.id);
      const popupExists = !!marker.getPopup();
      const shouldUpdatePopup = !popupExists || !prevState || prevState.popupKey !== popupKey || marker.isPopupOpen() || selectedVehicleId === vehicle.id;
      if (shouldUpdatePopup) {
        const popupContent = `
          <div style="padding: 12px; min-width: 240px; font-family: system-ui, -apple-system, sans-serif;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <div style="font-weight: 600; font-size: 16px; color: #1e293b;">${vehicle.plate}</div>
              <div style="display: flex; align-items: center; gap: 4px; padding: 2px 8px; background: ${statusColor}20; border-radius: 12px;">
                <span style="width: 6px; height: 6px; border-radius: 50%; background: ${statusColor};"></span>
                <span style="font-size: 11px; color: ${statusColor}; font-weight: 500;">${statusText}</span>
              </div>
            </div>
            <div style="font-size: 12px; color: #64748b; margin-bottom: 12px;">${vehicle.brand} ${vehicle.model}</div>
            
            <div style="display: grid; gap: 8px; font-size: 13px;">
              <div style="display: flex; align-items: flex-start; gap: 10px; padding: 8px 10px; background: #f1f5f9; border-radius: 8px;">
                <span style="font-size: 16px;">📍</span>
                <div style="flex: 1;">
                  <div style="font-size: 11px; color: #94a3b8; margin-bottom: 2px;">Adresse</div>
                  <div style="color: #334155; line-height: 1.3;">${address}</div>
                </div>
              </div>
              
              <div style="display: flex; gap: 8px;">
                <div style="flex: 1; display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: ${isMoving ? '#ecfdf5' : '#fef3c7'}; border-radius: 8px;">
                  <span style="font-size: 16px;">${isMoving ? '🚗' : '🅿️'}</span>
                  <div>
                    <div style="font-size: 11px; color: ${isMoving ? '#059669' : '#d97706'};">Vitesse</div>
                    <div style="font-weight: 600; color: ${isMoving ? '#047857' : '#b45309'};">
                      ${isMoving ? `${speed.toFixed(0)} km/h` : 'À l\'arrêt'}
                    </div>
                  </div>
                </div>
                
                <div style="flex: 1; display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #f1f5f9; border-radius: 8px;">
                  <span style="font-size: 16px;">🕐</span>
                  <div>
                    <div style="font-size: 11px; color: #94a3b8;">Mise à jour</div>
                    <div style="color: #334155; font-weight: 500;">${formatTimestamp(vehicle.lastPosition?.timestamp)}</div>
                  </div>
                </div>
              </div>
              
              ${vehicle.driver ? `
              <div style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: #f1f5f9; border-radius: 8px;">
                <span style="font-size: 16px;">👤</span>
                <div>
                  <div style="font-size: 11px; color: #94a3b8;">Conducteur</div>
                  <div style="color: #334155;">${vehicle.driver}</div>
                </div>
              </div>
              ` : ''}
              
              <div style="display: flex; gap: 8px;">
                <div style="flex: 1; display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #f1f5f9; border-radius: 8px;">
                  <span style="font-size: 16px;">🛣️</span>
                  <div>
                    <div style="font-size: 11px; color: #94a3b8;">Odomètre</div>
                    <div style="color: #334155; font-weight: 500;">${vehicle.mileage.toLocaleString('fr-FR')} km</div>
                  </div>
                </div>
                
                ${vehicle.distanceToday !== null && vehicle.distanceToday !== undefined ? `
                <div style="flex: 1; display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #f1f5f9; border-radius: 8px;">
                  <span style="font-size: 16px;">📏</span>
                  <div>
                    <div style="font-size: 11px; color: #94a3b8;">Distance Jour</div>
                    <div style="color: #334155; font-weight: 500;">${vehicle.distanceToday.toLocaleString('fr-FR')} km</div>
                  </div>
                </div>
                ` : ''}
              </div>
              
              <div style="display: flex; gap: 8px;">
                ${vehicle.fuelQuantity !== null && vehicle.fuelQuantity !== undefined ? `
                <div style="flex: 1; display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: ${vehicle.fuelQuantity < 20 ? '#fef2f2' : vehicle.fuelQuantity < 40 ? '#fefce8' : '#f0fdf4'}; border-radius: 8px;">
                  <span style="font-size: 16px;">⛽</span>
                  <div>
                    <div style="font-size: 11px; color: ${vehicle.fuelQuantity < 20 ? '#dc2626' : vehicle.fuelQuantity < 40 ? '#ca8a04' : '#16a34a'};">Carburant</div>
                    <div style="color: ${vehicle.fuelQuantity < 20 ? '#dc2626' : vehicle.fuelQuantity < 40 ? '#ca8a04' : '#16a34a'}; font-weight: 600;">${vehicle.fuelQuantity.toFixed(0)}L</div>
                  </div>
                </div>
                ` : ''}
                
                ${vehicle.battery !== null && vehicle.battery !== undefined ? `
                <div style="flex: 1; display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: ${vehicle.battery < 20 ? '#fef2f2' : vehicle.battery < 50 ? '#fefce8' : '#f0fdf4'}; border-radius: 8px;">
                  <span style="font-size: 16px;">🔋</span>
                  <div>
                    <div style="font-size: 11px; color: ${vehicle.battery < 20 ? '#dc2626' : vehicle.battery < 50 ? '#ca8a04' : '#16a34a'};">Batterie</div>
                    <div style="color: ${vehicle.battery < 20 ? '#dc2626' : vehicle.battery < 50 ? '#ca8a04' : '#16a34a'}; font-weight: 600;">${vehicle.battery.toFixed(0)}%</div>
                  </div>
                </div>
                ` : ''}
              </div>
              
              ${vehicle.network !== null && vehicle.network !== undefined ? `
              <div style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: ${vehicle.network < 30 ? '#fef2f2' : vehicle.network < 60 ? '#fefce8' : '#f0fdf4'}; border-radius: 8px;">
                <span style="font-size: 16px;">📶</span>
                <div>
                  <div style="font-size: 11px; color: ${vehicle.network < 30 ? '#dc2626' : vehicle.network < 60 ? '#ca8a04' : '#16a34a'};">Réseau</div>
                  <div style="color: ${vehicle.network < 30 ? '#dc2626' : vehicle.network < 60 ? '#ca8a04' : '#16a34a'}; font-weight: 600;">${vehicle.network.toFixed(0)}%</div>
                </div>
              </div>
              ` : ''}
            </div>
          </div>
        `;
        if (!popupExists) {
          marker.bindPopup(popupContent, { maxWidth: 300, className: 'custom-popup' });
        } else {
          marker.setPopupContent(popupContent);
        }
      }
      markerStateRef.current.set(vehicle.id, { iconKey, popupKey });
    });

    // Fit bounds to all vehicles on first load
    if (!hasFittedBounds.current && vehicles.length > 0) {
      const vehiclesWithPosition = vehicles.filter(v => v.lastPosition);
      if (vehiclesWithPosition.length > 0) {
        const bounds = L.latLngBounds(
          vehiclesWithPosition.map(v => [v.lastPosition!.lat, v.lastPosition!.lng])
        );
        map.fitBounds(bounds, { padding: [50, 50] });
        hasFittedBounds.current = true;
      }
    }
  }, [vehicles, onVehicleSelect, enableClustering, selectedVehicleId]);

  // Handle vehicle selection (fly to)
  useEffect(() => {
    if (!selectedVehicleId) {
      lastSelectedFlyToRef.current = undefined;
      return;
    }
    if (!mapRef.current || followingVehicleId) return;
    if (lastSelectedFlyToRef.current === selectedVehicleId) return;

    const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
    if (selectedVehicle?.lastPosition) {
      lastSelectedFlyToRef.current = selectedVehicleId;
      mapRef.current.flyTo(
        [selectedVehicle.lastPosition.lat, selectedVehicle.lastPosition.lng],
        15,
        { duration: 1.5 }
      );

      // Open popup for selected vehicle
      const marker = markersRef.current.get(selectedVehicleId);
      if (marker) {
        setTimeout(() => marker.openPopup(), 500);
      }
    }
  }, [selectedVehicleId, vehicles, followingVehicleId]);

  useEffect(() => {
    if (!mapRef.current || resetViewSignal === 0) return;
    const vehiclesWithPosition = vehicles.filter((vehicle) => vehicle.lastPosition);
    if (vehiclesWithPosition.length === 0) return;
    const bounds = L.latLngBounds(
      vehiclesWithPosition.map((vehicle) => [vehicle.lastPosition!.lat, vehicle.lastPosition!.lng]),
    );
    mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    hasFittedBounds.current = true;
  }, [resetViewSignal, vehicles]);

  // Handle follow mode
  useEffect(() => {
    if (followIntervalRef.current) {
      clearInterval(followIntervalRef.current);
      followIntervalRef.current = null;
    }

    if (!mapRef.current || !followingVehicleId) return;

    const updateFollowPosition = () => {
      const followedVehicle = vehicles.find(v => v.id === followingVehicleId);
      if (followedVehicle?.lastPosition && mapRef.current) {
        mapRef.current.setView(
          [followedVehicle.lastPosition.lat, followedVehicle.lastPosition.lng],
          mapRef.current.getZoom(),
          { animate: true }
        );
      }
    };

    // Initial position
    updateFollowPosition();

    // Keep following
    followIntervalRef.current = setInterval(updateFollowPosition, 2000);

    return () => {
      if (followIntervalRef.current) {
        clearInterval(followIntervalRef.current);
      }
    };
  }, [followingVehicleId, vehicles]);

  // Handle traceurs (live vehicle trails)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Update position history and polylines for enabled traceurs
    vehicles.forEach((vehicle) => {
      if (!vehicle.lastPosition) return;

      const isTraceurEnabled = traceurVehicleIds.has(vehicle.id);
      const newLatLng = L.latLng(vehicle.lastPosition.lat, vehicle.lastPosition.lng);

      if (isTraceurEnabled) {
        // Add to position history
        if (!vehiclePositionHistory.has(vehicle.id)) {
          vehiclePositionHistory.set(vehicle.id, []);
        }
        const history = vehiclePositionHistory.get(vehicle.id)!;
        
        // Only add if position changed
        const lastPos = history[history.length - 1];
        if (!lastPos || lastPos.distanceTo(newLatLng) > 5) { // 5 meters threshold
          history.push(newLatLng);
          if (history.length > MAX_TRACEUR_POINTS) {
            history.shift();
          }
        }

        // Create or update polyline
        if (!traceursRef.current.has(vehicle.id)) {
          const polyline = L.polyline(history, {
            color: '#3b82f6',
            weight: 4,
            opacity: 0.8,
            lineJoin: 'round',
            lineCap: 'round',
          }).addTo(map);
          traceursRef.current.set(vehicle.id, polyline);
        } else {
          traceursRef.current.get(vehicle.id)!.setLatLngs(history);
        }
      } else {
        // Remove traceur if disabled
        if (traceursRef.current.has(vehicle.id)) {
          map.removeLayer(traceursRef.current.get(vehicle.id)!);
          traceursRef.current.delete(vehicle.id);
        }
        vehiclePositionHistory.delete(vehicle.id);
      }
    });

    // Cleanup traceurs for vehicles that no longer exist
    traceursRef.current.forEach((polyline, id) => {
      if (!vehicles.find(v => v.id === id)) {
        map.removeLayer(polyline);
        traceursRef.current.delete(id);
        vehiclePositionHistory.delete(id);
      }
    });
  }, [vehicles, traceurVehicleIds]);

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Chargement des véhicules...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
        <div className="flex flex-col items-center gap-3 text-center p-6">
          <AlertTriangle className="w-10 h-10 text-destructive" />
          <p className="text-destructive font-medium">Erreur de connexion GPSwox</p>
          <p className="text-sm text-muted-foreground max-w-md">
            {error.message || "Impossible de charger les véhicules"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .custom-vehicle-marker {
          background: transparent;
          border: none;
        }
        .custom-cluster-marker {
          background: transparent;
        }
        .cluster-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          color: white;
          border-radius: 50%;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .cluster-small {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          font-size: 12px;
        }
        .cluster-medium {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          font-size: 14px;
        }
        .cluster-large {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          font-size: 16px;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          padding: 0;
        }
        .leaflet-popup-content {
          margin: 0;
        }
        .leaflet-popup-tip {
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .custom-popup .leaflet-popup-content-wrapper {
          padding: 0;
        }
        .vehicle-moving {
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .leaflet-container {
          width: 100%;
          height: 100%;
          z-index: 1;
        }
      `}</style>
      <div ref={mapContainerRef} className="absolute inset-0 z-0" style={{ width: '100%', height: '100%' }} />
    </>
  );
};

export default GPSwoxMap;
