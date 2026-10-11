import React, { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { Loader2, AlertTriangle } from 'lucide-react';
import { MarkerDensity } from './MapSettingsModal';
import { generateVehicleReportPdf } from '@/utils/vehiclePdfGenerator';

// Expose PDF generator globally for Leaflet HTML popups
if (typeof window !== 'undefined') {
  (window as any).__downloadVehiclePdf = (vehicleJson: string) => {
    try {
      const vehicle = JSON.parse(decodeURIComponent(vehicleJson));
      generateVehicleReportPdf(vehicle);
    } catch (e) {
      console.error('Failed to download vehicle PDF:', e);
    }
  };
}

export type MapLayerType =
  | 'osm'
  | 'google-streets'
  | 'google-hybrid'
  | 'google-satellite'
  | 'google-terrain';

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
    case 'google-terrain':
      return {
        url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}&hl=fr&gl=MA',
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
  markerDensity?: MarkerDensity;
  showGeofences?: boolean;
  showTraces?: boolean;
  showPoints?: boolean;
  zoomSignal?: { type: 'in' | 'out'; id: number };
}

// Store vehicle position history for traceurs
const vehiclePositionHistory = new Map<string, L.LatLng[]>();
const MAX_TRACEUR_POINTS = 100;
const vehicleIconCache = new Map<string, L.DivIcon>();

const createVehicleIcon = (
  _status: string,
  isMoving: boolean = false,
  isOnline: boolean = true,
  density: MarkerDensity = 'standard'
) => {
  const iconKey = `${density}-${isOnline ? 'online' : 'offline'}-${isMoving ? 'moving' : 'stopped'}`;
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

  const dims =
    density === 'compact'
      ? { width: 26, height: 36, anchorX: 13, anchorY: 36 }
      : density === 'large'
      ? { width: 38, height: 52, anchorX: 19, anchorY: 52 }
      : { width: 32, height: 44, anchorX: 16, anchorY: 44 };

  const svgIcon = `
    <svg width="${dims.width}" height="${dims.height}" viewBox="0 0 32 44" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow-${iconKey}" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.4"/>
        </filter>
      </defs>
      <path d="M16 0C7.163 0 0 7.163 0 16c0 8.837 16 28 16 28s16-19.163 16-28C32 7.163 24.837 0 16 0z" 
            fill="${color}" filter="url(#shadow-${iconKey})"/>
      <circle cx="16" cy="14" r="7" fill="white" opacity="0.95"/>
      <circle cx="16" cy="14" r="5" fill="${color}" opacity="0.3"/>
      ${
        isMoving
          ? `
        <circle cx="16" cy="14" r="12" fill="none" stroke="${color}" stroke-width="2" opacity="0.6">
          <animate attributeName="r" from="10" to="18" dur="1.2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" from="0.6" to="0" dur="1.2s" repeatCount="indefinite"/>
        </circle>
      `
          : ''
      }
    </svg>
  `;

  const icon = L.divIcon({
    html: svgIcon,
    className: 'custom-vehicle-marker',
    iconSize: [dims.width, dims.height],
    iconAnchor: [dims.anchorX, dims.anchorY],
    popupAnchor: [0, -dims.anchorY],
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

  if (diffMins < 1) return "À l'instant";
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
  mapLayer = 'google-streets',
  traceurVehicleIds = new Set(),
  resetViewSignal = 0,
  markerDensity = 'standard',
  showGeofences = false,
  showTraces = true,
  showPoints = true,
  zoomSignal,
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

  // Handle external zoom controls
  useEffect(() => {
    if (!mapRef.current || !zoomSignal) return;
    if (zoomSignal.type === 'in') {
      mapRef.current.zoomIn();
    } else if (zoomSignal.type === 'out') {
      mapRef.current.zoomOut();
    }
  }, [zoomSignal]);

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

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      center: [31.7917, -7.0926], // Morocco center
      zoom: 6,
      zoomControl: false,
      fadeAnimation: false,
    });

    const triggerInvalidate = () => {
      mapRef.current?.invalidateSize();
    };

    setTimeout(triggerInvalidate, 50);
    setTimeout(triggerInvalidate, 200);
    setTimeout(triggerInvalidate, 500);

    resizeObserverRef.current = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    resizeObserverRef.current.observe(mapContainerRef.current);

    const initialKey = mapLayer || 'google-streets';
    const initialTileLayer = createTileLayer(initialKey);
    tileLayersCacheRef.current.set(initialKey, initialTileLayer);
    initialTileLayer.addTo(mapRef.current);
    tileLayerRef.current = initialTileLayer;
    activeBaseLayerKeyRef.current = initialKey;

    // Initialize cluster group with animated multi-ring discs
    clusterGroupRef.current = L.markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true, // Click directly zooms and distributes vehicles on the map
      maxClusterRadius: 80, // Ensures all initial vehicles group into one animated disc
      iconCreateFunction: (cluster) => {
        const childMarkers = cluster.getAllChildMarkers();
        const count = childMarkers.length;

        let moving = 0;
        let stopped = 0;
        let offline = 0;

        childMarkers.forEach((m: any) => {
          const v = m.vehicleData as MapVehicle | undefined;
          if (!v || v.online === 'offline') {
            offline++;
          } else if ((v.lastPosition?.speed || 0) > 0) {
            moving++;
          } else {
            stopped++;
          }
        });

        const diameter = count > 50 ? 58 : count > 10 ? 52 : 46;
        const radius = diameter / 2 - 3.5;
        const circumference = 2 * Math.PI * radius;

        const movingPct = count > 0 ? moving / count : 0;
        const stoppedPct = count > 0 ? stopped / count : 0;

        const strokeMoving = circumference * movingPct;
        const strokeStopped = circumference * stoppedPct;

        return L.divIcon({
          html: `
            <div class="animated-cluster-disc" style="width: ${diameter}px; height: ${diameter}px;" title="Cliquez pour distribuer les véhicules">
              <div class="cluster-pulse-ring"></div>
              <svg class="cluster-svg-ring" width="${diameter}" height="${diameter}" viewBox="0 0 ${diameter} ${diameter}">
                <circle cx="${diameter / 2}" cy="${diameter / 2}" r="${radius}" 
                  stroke="rgba(255,255,255,0.25)" stroke-width="4" fill="none" />
                <circle cx="${diameter / 2}" cy="${diameter / 2}" r="${radius}" 
                  stroke="#22c55e" stroke-width="4" 
                  stroke-dasharray="${strokeMoving} ${circumference}" 
                  stroke-linecap="round" fill="none" 
                  transform="rotate(-90 ${diameter / 2} ${diameter / 2})" />
                ${
                  stoppedPct > 0
                    ? `
                  <circle cx="${diameter / 2}" cy="${diameter / 2}" r="${radius}" 
                    stroke="#f59e0b" stroke-width="4" 
                    stroke-dasharray="${strokeStopped} ${circumference}" 
                    stroke-linecap="round" fill="none" 
                    transform="rotate(${movingPct * 360 - 90} ${diameter / 2} ${diameter / 2})" />
                `
                    : ''
                }
              </svg>
              <div class="cluster-inner-core">
                <span class="cluster-count-text">${count}</span>
              </div>
            </div>
          `,
          className: 'custom-cluster-marker',
          iconSize: [diameter, diameter],
          iconAnchor: [diameter / 2, diameter / 2],
        });
      },
    });

    // When clicking cluster, distribute/separate vehicles on the map directly
    clusterGroupRef.current.on('clusterclick', (a: any) => {
      a.layer.zoomToBounds({ padding: [40, 40] });
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

  // Handle layer change
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
        markersRef.current.forEach((marker) => {
          if (mapRef.current?.hasLayer(marker)) {
            mapRef.current.removeLayer(marker);
          }
          clusterGroupRef.current?.addLayer(marker);
        });
      }
    } else {
      if (mapRef.current.hasLayer(clusterGroupRef.current)) {
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
    const vehicleIds = new Set(vehicles.map((v) => v.id));

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
      const iconKey = `${markerDensity}-${isOnline ? 'online' : 'offline'}-${isMoving ? 'moving' : 'stopped'}`;

      if (marker) {
        (marker as any).vehicleData = vehicle;
        const currentLatLng = marker.getLatLng();
        if (
          Math.abs(currentLatLng.lat - lat) > 0.000001 ||
          Math.abs(currentLatLng.lng - lng) > 0.000001
        ) {
          marker.setLatLng([lat, lng]);
        }
        const prevState = markerStateRef.current.get(vehicle.id);
        if (!prevState || prevState.iconKey !== iconKey) {
          marker.setIcon(createVehicleIcon(vehicle.status, isMoving, isOnline, markerDensity));
        }
      } else {
        marker = L.marker([lat, lng], {
          icon: createVehicleIcon(vehicle.status, isMoving, isOnline, markerDensity),
        });
        (marker as any).vehicleData = vehicle;

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

      // Visibility based on showPoints
      if (!showPoints) {
        marker.setOpacity(0);
      } else {
        marker.setOpacity(1);
      }

      const address = vehicle.lastPosition?.city
        ? `${vehicle.lastPosition.city} (${lat.toFixed(5)}, ${lng.toFixed(5)})`
        : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

      const statusColor =
        vehicle.status === 'active'
          ? '#10b981'
          : vehicle.status === 'maintenance'
          ? '#f59e0b'
          : '#6b7280';
      const statusText =
        vehicle.status === 'active'
          ? 'Actif'
          : vehicle.status === 'maintenance'
          ? 'Maintenance'
          : 'Inactif';

      const speed = vehicle.lastPosition?.speed || 0;

      // Status pill colors and label
      let statusLabel = 'Inactif';
      let badgeBg = 'rgba(100, 116, 139, 0.15)';
      let badgeBorder = 'rgba(100, 116, 139, 0.3)';
      let badgeColor = '#94a3b8';
      let badgeDot = '#64748b';

      if (!isOnline) {
        statusLabel = 'Hors ligne';
        badgeBg = 'rgba(239, 68, 68, 0.15)';
        badgeBorder = 'rgba(239, 68, 68, 0.35)';
        badgeColor = '#f87171';
        badgeDot = '#ef4444';
      } else if (vehicle.status === 'maintenance') {
        statusLabel = 'Maintenance';
        badgeBg = 'rgba(245, 158, 11, 0.15)';
        badgeBorder = 'rgba(245, 158, 11, 0.35)';
        badgeColor = '#fbbf24';
        badgeDot = '#f59e0b';
      } else if (isMoving) {
        statusLabel = 'En mouvement';
        badgeBg = 'rgba(16, 185, 129, 0.15)';
        badgeBorder = 'rgba(16, 185, 129, 0.35)';
        badgeColor = '#34d399';
        badgeDot = '#10b981';
      } else {
        statusLabel = "À l'arrêt";
        badgeBg = 'rgba(245, 158, 11, 0.15)';
        badgeBorder = 'rgba(245, 158, 11, 0.35)';
        badgeColor = '#fbbf24';
        badgeDot = '#f59e0b';
      }

      const fuelVal = vehicle.fuelQuantity ?? null;
      const fuelColor = fuelVal !== null ? (fuelVal < 20 ? '#ef4444' : fuelVal < 40 ? '#f59e0b' : '#34d399') : '#94a3b8';

      const batteryVal = vehicle.battery ?? null;
      const batteryColor = batteryVal !== null ? (batteryVal < 20 ? '#ef4444' : batteryVal < 50 ? '#f59e0b' : '#34d399') : '#94a3b8';

      const networkVal = vehicle.network ?? null;
      const networkColor = networkVal !== null ? (networkVal < 30 ? '#ef4444' : networkVal < 60 ? '#f59e0b' : '#34d399') : '#94a3b8';

      const popupKey = `${address}|${statusLabel}|${speed}|${vehicle.fuelQuantity ?? ''}|${vehicle.battery ?? ''}|${vehicle.network ?? ''}|${vehicle.distanceToday ?? ''}|${vehicle.driver ?? ''}|${vehicle.mileage}|${vehicle.topSpeedToday ?? ''}|${vehicle.lastPosition?.stopDuration ?? ''}`;
      const prevState = markerStateRef.current.get(vehicle.id);
      const popupExists = !!marker.getPopup();
      const shouldUpdatePopup =
        !popupExists ||
        !prevState ||
        prevState.popupKey !== popupKey ||
        marker.isPopupOpen() ||
        selectedVehicleId === vehicle.id;

      if (shouldUpdatePopup) {
        const popupContent = `
          <div style="padding: 16px; min-width: 300px; max-width: 350px; background: linear-gradient(145deg, rgba(144, 144, 147, 0.75) 0%, rgba(120, 120, 125, 0.70) 50%, rgba(95, 95, 100, 0.82) 100%); backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 22px; box-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.5), 0 0 30px rgba(144, 144, 147, 0.2), inset 0 1px 0 rgba(255,255,255,0.2); font-family: system-ui, -apple-system, sans-serif; color: #ffffff; box-sizing: border-box;">
            
            <!-- Header: Plate & Status Badge with Speed -->
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
              <div>
                <div style="font-weight: 800; font-size: 17px; color: #ffffff; letter-spacing: -0.01em; line-height: 1.2;">
                  ${vehicle.plate}
                </div>
                <div style="font-size: 11px; color: #e2e8f0; font-weight: 500; margin-top: 2px;">
                  ${vehicle.brand ? `${vehicle.brand} ${vehicle.model}` : `GPS Device ${vehicle.plate}`}
                </div>
              </div>
              
              <!-- Status + Speed Combined Badge -->
              <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                <div style="display: flex; align-items: center; gap: 5px; padding: 3px 9px; background: ${badgeBg}; border: 1px solid ${badgeBorder}; border-radius: 12px; white-space: nowrap;">
                  <span style="width: 7px; height: 7px; border-radius: 50%; background: ${badgeDot}; box-shadow: 0 0 8px ${badgeDot};"></span>
                  <span style="font-size: 11px; color: ${badgeColor}; font-weight: 700;">${statusLabel}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px; padding: 2px 8px; background: ${isMoving ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.18)'}; border: 1px solid ${isMoving ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.35)'}; border-radius: 10px;">
                  <span style="font-size: 10px;">${isMoving ? '🚗' : '🅿️'}</span>
                  <span style="font-size: 12px; font-weight: 800; color: ${isMoving ? '#a7f3d0' : '#fef08a'}; font-variant-numeric: tabular-nums;">${isMoving ? speed.toFixed(0) + ' km/h' : "0 km/h"}</span>
                </div>
              </div>
            </div>

            <!-- Real-time Address Card -->
            <div style="margin-top: 10px; padding: 9px 11px; background: rgba(0, 0, 0, 0.18); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px;">
              <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 4px;">
                <span style="font-size: 13px;">📍</span>
                <span style="font-size: 9px; font-weight: 800; color: #6ee7b7; letter-spacing: 0.08em; text-transform: uppercase;">
                  ADRESSE EN TEMPS RÉEL
                </span>
              </div>
              <div style="font-size: 11px; color: #f8fafc; line-height: 1.4; word-break: break-word;">
                ${address}
              </div>
            </div>

            <!-- 4 Key Telematics Metrics (2x2 Grid) - Redesigned -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px;">
              
              <!-- Tile 1: V.Max (replaces Vitesse) -->
              <div style="padding: 8px 10px; background: rgba(0, 0, 0, 0.18); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px;">
                <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
                  <span style="font-size: 11px;">🏎️</span>
                  <span style="font-size: 9px; font-weight: 800; color: #6ee7b7; letter-spacing: 0.05em; text-transform: uppercase;">V.MAX</span>
                </div>
                <div style="font-weight: 800; font-size: 13px; color: #a7f3d0;">
                  ${vehicle.topSpeedToday !== null && vehicle.topSpeedToday !== undefined ? vehicle.topSpeedToday.toFixed(0) + ' km/h' : speed.toFixed(0) + ' km/h'}
                </div>
              </div>

              <!-- Tile 2: Distance Jour (replaces Mise à jour) -->
              <div style="padding: 8px 10px; background: rgba(0, 0, 0, 0.18); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px;">
                <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
                  <span style="font-size: 11px;">📏</span>
                  <span style="font-size: 9px; font-weight: 800; color: #cbd5e1; letter-spacing: 0.05em; text-transform: uppercase;">DISTANCE JOUR</span>
                </div>
                <div style="font-weight: 700; font-size: 12px; color: #ffffff;">
                  ${vehicle.distanceToday !== null && vehicle.distanceToday !== undefined ? vehicle.distanceToday.toLocaleString('fr-FR') + ' km' : '0 km'}
                </div>
              </div>

              <!-- Tile 3: Odomètre (unchanged) -->
              <div style="padding: 8px 10px; background: rgba(0, 0, 0, 0.18); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px;">
                <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
                  <span style="font-size: 11px;">🛣️</span>
                  <span style="font-size: 9px; font-weight: 800; color: #cbd5e1; letter-spacing: 0.05em; text-transform: uppercase;">ODOMÈTRE</span>
                </div>
                <div style="font-weight: 700; font-size: 12px; color: #ffffff;">
                  ${vehicle.mileage.toLocaleString('fr-FR')} km
                </div>
              </div>

              <!-- Tile 4: Durée d'arrêt (replaces Distance Jour) -->
              <div style="padding: 8px 10px; background: ${!isMoving ? 'rgba(245, 158, 11, 0.15)' : 'rgba(0, 0, 0, 0.18)'}; border: 1px solid ${!isMoving ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255, 255, 255, 0.12)'}; border-radius: 14px;">
                <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
                  <span style="font-size: 11px;">⏱️</span>
                  <span style="font-size: 9px; font-weight: 800; color: ${!isMoving ? '#fde047' : '#cbd5e1'}; letter-spacing: 0.05em; text-transform: uppercase;">DURÉE D'ARRÊT</span>
                </div>
                <div style="font-weight: 700; font-size: 12px; color: ${!isMoving ? '#fef08a' : '#ffffff'};">
                  ${vehicle.lastPosition?.stopDuration ? vehicle.lastPosition.stopDuration : (isMoving ? 'En route' : '--')}
                </div>
              </div>

            </div>

            <!-- Telematics Indicators Bar -->
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.15);">
              
              <div style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: #cbd5e1;">
                <span style="font-size: 12px;">⛽</span>
                <span style="font-weight: 700; color: ${fuelColor};">${fuelVal !== null ? fuelVal.toFixed(0) + 'L' : '--'}</span>
              </div>

              <div style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: #cbd5e1;">
                <span style="font-size: 12px;">🔋</span>
                <span style="font-weight: 700; color: ${batteryColor};">${batteryVal !== null ? batteryVal.toFixed(0) + '%' : '--'}</span>
              </div>

              <div style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: #cbd5e1;">
                <span style="font-size: 12px;">📶</span>
                <span style="font-weight: 700; color: ${networkColor};">${networkVal !== null ? networkVal.toFixed(0) + '%' : '--'}</span>
              </div>

              ${vehicle.driver ? `
                <div style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: #94a3b8; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  <span>👤</span>
                  <span style="color: #e2e8f0; font-weight: 600;">${vehicle.driver}</span>
                </div>
              ` : ''}

            </div>

            <!-- PDF Download Action Button -->
            <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.12);">
              <button
                type="button"
                onclick="window.__downloadVehiclePdf && window.__downloadVehiclePdf('${encodeURIComponent(JSON.stringify(vehicle))}')"
                style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 7px; padding: 7px 12px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.85) 0%, rgba(5, 150, 105, 0.95) 100%); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 12px; color: #ffffff; font-size: 11px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35); transition: all 0.2s ease;"
                onmouseover="this.style.opacity='0.9'; this.style.transform='scale(1.02)';"
                onmouseout="this.style.opacity='1'; this.style.transform='scale(1)';"
              >
                <span style="font-size: 13px;">📄</span>
                <span>Télécharger Rapport PDF</span>
              </button>
            </div>

          </div>
        `;
        if (!popupExists) {
          marker.bindPopup(popupContent, { maxWidth: 350, className: 'custom-popup' });
        } else {
          marker.setPopupContent(popupContent);
        }
      }
      markerStateRef.current.set(vehicle.id, { iconKey, popupKey });
    });

    // Fit bounds on first load
    if (!hasFittedBounds.current && vehicles.length > 0) {
      const vehiclesWithPosition = vehicles.filter((v) => v.lastPosition);
      if (vehiclesWithPosition.length > 0) {
        const bounds = L.latLngBounds(
          vehiclesWithPosition.map((v) => [v.lastPosition!.lat, v.lastPosition!.lng])
        );
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
        hasFittedBounds.current = true;
      }
    }
  }, [vehicles, onVehicleSelect, enableClustering, selectedVehicleId, markerDensity, showPoints]);

  // Handle vehicle selection (fly to)
  useEffect(() => {
    if (!selectedVehicleId) {
      lastSelectedFlyToRef.current = undefined;
      return;
    }
    if (!mapRef.current || followingVehicleId) return;
    if (lastSelectedFlyToRef.current === selectedVehicleId) return;

    const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
    if (selectedVehicle?.lastPosition) {
      lastSelectedFlyToRef.current = selectedVehicleId;
      mapRef.current.flyTo(
        [selectedVehicle.lastPosition.lat, selectedVehicle.lastPosition.lng],
        16,
        { duration: 1.2 }
      );

      const marker = markersRef.current.get(selectedVehicleId);
      if (marker) {
        setTimeout(() => marker.openPopup(), 400);
      }
    }
  }, [selectedVehicleId, vehicles, followingVehicleId]);

  // Handle reset view signal
  useEffect(() => {
    if (!mapRef.current || resetViewSignal === 0) return;
    const vehiclesWithPosition = vehicles.filter((vehicle) => vehicle.lastPosition);
    if (vehiclesWithPosition.length === 0) return;
    const bounds = L.latLngBounds(
      vehiclesWithPosition.map((vehicle) => [vehicle.lastPosition!.lat, vehicle.lastPosition!.lng])
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
      const followedVehicle = vehicles.find((v) => v.id === followingVehicleId);
      if (followedVehicle?.lastPosition && mapRef.current) {
        mapRef.current.setView(
          [followedVehicle.lastPosition.lat, followedVehicle.lastPosition.lng],
          mapRef.current.getZoom(),
          { animate: true }
        );
      }
    };

    updateFollowPosition();
    followIntervalRef.current = setInterval(updateFollowPosition, 2000);

    return () => {
      if (followIntervalRef.current) {
        clearInterval(followIntervalRef.current);
      }
    };
  }, [followingVehicleId, vehicles]);

  // Handle traceurs
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    vehicles.forEach((vehicle) => {
      if (!vehicle.lastPosition) return;

      const isTraceurEnabled = traceurVehicleIds.has(vehicle.id) && showTraces;
      const newLatLng = L.latLng(vehicle.lastPosition.lat, vehicle.lastPosition.lng);

      if (isTraceurEnabled) {
        if (!vehiclePositionHistory.has(vehicle.id)) {
          vehiclePositionHistory.set(vehicle.id, []);
        }
        const history = vehiclePositionHistory.get(vehicle.id)!;

        const lastPos = history[history.length - 1];
        if (!lastPos || lastPos.distanceTo(newLatLng) > 5) {
          history.push(newLatLng);
          if (history.length > MAX_TRACEUR_POINTS) {
            history.shift();
          }
        }

        if (!traceursRef.current.has(vehicle.id)) {
          const polyline = L.polyline(history, {
            color: '#10b981',
            weight: 4,
            opacity: 0.85,
            lineJoin: 'round',
            lineCap: 'round',
          }).addTo(map);
          traceursRef.current.set(vehicle.id, polyline);
        } else {
          traceursRef.current.get(vehicle.id)!.setLatLngs(history);
        }
      } else {
        if (traceursRef.current.has(vehicle.id)) {
          map.removeLayer(traceursRef.current.get(vehicle.id)!);
          traceursRef.current.delete(vehicle.id);
        }
        vehiclePositionHistory.delete(vehicle.id);
      }
    });

    traceursRef.current.forEach((polyline, id) => {
      if (!vehicles.find((v) => v.id === id)) {
        map.removeLayer(polyline);
        traceursRef.current.delete(id);
        vehiclePositionHistory.delete(id);
      }
    });
  }, [vehicles, traceurVehicleIds, showTraces]);

  return (
    <>
      <style>{`
        .custom-vehicle-marker {
          background: transparent;
          border: none;
        }
        .custom-cluster-marker {
          background: transparent;
          border: none;
        }
        
        /* Animated Cluster Disc */
        .animated-cluster-disc {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .cluster-pulse-ring {
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          border: 2px solid rgba(34, 197, 94, 0.8);
          animation: clusterPulseAnimation 2s cubic-bezier(0.24, 0, 0.38, 1) infinite;
          pointer-events: none;
        }
        @keyframes clusterPulseAnimation {
          0% { transform: scale(0.92); opacity: 0.95; }
          70% { transform: scale(1.4); opacity: 0; }
          100% { transform: scale(1.45); opacity: 0; }
        }
        .cluster-svg-ring {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .cluster-inner-core {
          position: absolute;
          inset: 5px;
          border-radius: 50%;
          background: linear-gradient(135deg, #15803d, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.35);
        }
        .cluster-count-text {
          color: white;
          font-weight: 800;
          font-size: 14px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          text-shadow: 0 1px 2px rgba(0,0,0,0.6);
        }

        .leaflet-popup-content-wrapper {
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          padding: 0;
          overflow: hidden;
        }
        .leaflet-popup-content {
          margin: 0;
        }
        .leaflet-popup-tip {
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        .custom-popup .leaflet-popup-content-wrapper {
          padding: 0;
        }
        .leaflet-container {
          width: 100%;
          height: 100%;
          background: #e5e7eb;
          z-index: 1;
        }
      `}</style>

      {/* Map DOM container ALWAYS preserved */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0 z-0 bg-[#e5e7eb]"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Non-destructive overlay for loading */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/30 backdrop-blur-sm z-30 pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-slate-200 text-xs font-semibold">Chargement des véhicules...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 z-30">
          <div className="flex flex-col items-center gap-2 text-center p-5 bg-slate-900 border border-rose-500/30 rounded-2xl">
            <AlertTriangle className="w-8 h-8 text-rose-500" />
            <p className="text-rose-400 font-bold text-sm">Erreur de connexion GPSwox</p>
            <p className="text-xs text-slate-400 max-w-xs">
              {error.message || 'Impossible de charger les véhicules'}
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default GPSwoxMap;
