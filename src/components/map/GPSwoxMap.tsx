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
export type VehicleIconStatus = 'moving' | 'stopped' | 'offline' | 'maintenance';

const vehicleIconCache = new Map<string, L.DivIcon>();

const createVehicleIcon = (
  statusKey: VehicleIconStatus,
  isMoving: boolean = false,
  _isOnline: boolean = true,
  density: MarkerDensity = 'standard'
) => {
  const iconKey = `${density}-${statusKey}`;
  const cachedIcon = vehicleIconCache.get(iconKey);
  if (cachedIcon) return cachedIcon;

  // Proportional 2D scale (100x50 SVG ratio 2:1)
  const dims =
    density === 'compact'
      ? { width: 50, height: 26, anchorX: 25, anchorY: 23 }
      : density === 'large'
      ? { width: 76, height: 39, anchorX: 38, anchorY: 35 }
      : { width: 62, height: 32, anchorX: 31, anchorY: 29 };

  // Theme palettes based on statusKey
  let cabGradStops = `
    <stop offset="0%" stop-color="#34d399"/>
    <stop offset="60%" stop-color="#10b981"/>
    <stop offset="100%" stop-color="#047857"/>
  `;
  let strokeColor = '#065f46';
  let glowColor = '#10b981';
  let glowOpacity = '0.45';
  let headlightColor = '#ffffff';

  if (statusKey === 'offline') {
    cabGradStops = `
      <stop offset="0%" stop-color="#64748b"/>
      <stop offset="60%" stop-color="#475569"/>
      <stop offset="100%" stop-color="#1e293b"/>
    `;
    strokeColor = '#0f172a';
    glowColor = '#000000';
    glowOpacity = '0.4';
    headlightColor = '#64748b';
  } else if (statusKey === 'maintenance') {
    cabGradStops = `
      <stop offset="0%" stop-color="#fb923c"/>
      <stop offset="60%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#c2410c"/>
    `;
    strokeColor = '#7c2d12';
    glowColor = '#f97316';
    glowOpacity = '0.4';
    headlightColor = '#fed7aa';
  } else if (statusKey === 'stopped') {
    cabGradStops = `
      <stop offset="0%" stop-color="#fcd34d"/>
      <stop offset="60%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#b45309"/>
    `;
    strokeColor = '#78350f';
    glowColor = '#f59e0b';
    glowOpacity = '0.35';
    headlightColor = '#fef08a';
  }

  const svgHtml = `
    <div class="truck-marker-inner" style="width: ${dims.width}px; height: ${dims.height}px;">
      <svg width="100%" height="100%" viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg" style="overflow: visible; display: block;">
        <defs>
          <linearGradient id="cabGrad-${iconKey}" x1="0%" y1="0%" x2="100%" y2="100%">
            ${cabGradStops}
          </linearGradient>
          <linearGradient id="chromeGrad-${iconKey}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#e2e8f0"/>
            <stop offset="50%" stop-color="#94a3b8"/>
            <stop offset="100%" stop-color="#64748b"/>
          </linearGradient>
          <linearGradient id="deckGrad-${iconKey}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#94a3b8"/>
            <stop offset="100%" stop-color="#475569"/>
          </linearGradient>
          <filter id="truckGlow-${iconKey}" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="${glowColor}" flood-opacity="${glowOpacity}"/>
            <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000000" flood-opacity="0.4"/>
          </filter>
        </defs>

        <!-- Ground Shadow -->
        <ellipse cx="50" cy="46" rx="46" ry="3" fill="rgba(0,0,0,0.38)"/>

        ${
          statusKey === 'moving'
            ? `
          <!-- Active Radar Ground Pulse beneath moving truck -->
          <ellipse cx="20" cy="46" rx="8" ry="2.5" fill="none" stroke="#10b981" stroke-width="1.5" opacity="0.8">
            <animate attributeName="rx" from="6" to="22" dur="1.4s" repeatCount="indefinite"/>
            <animate attributeName="opacity" from="0.9" to="0" dur="1.4s" repeatCount="indefinite"/>
          </ellipse>
        `
            : ''
        }

        <g filter="url(#truckGlow-${iconKey})">
          <!-- Under-Chassis Structural Beam -->
          <rect x="32" y="27" width="65" height="5" fill="#1e293b" rx="1"/>

          <!-- Side Protection Safety Rails -->
          <rect x="35" y="32" width="26" height="1.8" fill="url(#chromeGrad-${iconKey})" rx="0.5"/>
          <rect x="35" y="35.5" width="26" height="1.8" fill="url(#chromeGrad-${iconKey})" rx="0.5"/>
          <!-- Vertical posts for rails -->
          <line x1="38" y1="30" x2="38" y2="38" stroke="#64748b" stroke-width="1.5"/>
          <line x1="58" y1="30" x2="58" y2="38" stroke="#64748b" stroke-width="1.5"/>

          <!-- Metallic Fuel Tank -->
          <rect x="40" y="31" width="15" height="7.5" rx="3.5" fill="url(#chromeGrad-${iconKey})" stroke="#475569" stroke-width="0.8"/>
          <line x1="44" y1="31" x2="44" y2="38.5" stroke="#334155" stroke-width="0.7"/>
          <line x1="51" y1="31" x2="51" y2="38.5" stroke="#334155" stroke-width="0.7"/>

          <!-- Flatbed Trailer Platform -->
          <!-- Main Deck -->
          <path d="M 32 23 L 98 23 L 98 27 L 32 27 Z" fill="url(#deckGrad-${iconKey})" stroke="#334155" stroke-width="0.6"/>
          <!-- Flatbed Upper Steel Surface Edge -->
          <line x1="32" y1="23.5" x2="98" y2="23.5" stroke="#f1f5f9" stroke-width="0.8" opacity="0.8"/>
          <!-- Rear End Upright / Tailboard -->
          <path d="M 97 23 L 99 23 L 99 37 L 97 37 Z" fill="#334155"/>
          <!-- Rear Taillights -->
          <rect x="98" y="30" width="1.2" height="4" fill="${statusKey === 'offline' ? '#991b1b' : '#ef4444'}" rx="0.5"/>

          <!-- Triple Rear Axle Mudguards/Fenders -->
          <path d="M 61 36 Q 63 30 68 30 L 89 30 Q 94 30 96 36 Z" fill="#1e293b" stroke="#334155" stroke-width="0.8"/>

          <!-- Side Reflectors -->
          <circle cx="36" cy="25" r="0.9" fill="#f59e0b"/>
          <circle cx="55" cy="25" r="0.9" fill="#f59e0b"/>
          <circle cx="75" cy="25" r="0.9" fill="#f59e0b"/>
          <circle cx="94" cy="25" r="0.9" fill="#f59e0b"/>

          <!-- CABIN (Main Tractor Unit modeled after user's reference) -->
          <!-- Cab Main Body with Status Gradient -->
          <path d="
            M 3 34
            L 3 22
            Q 3.5 19 6 15
            L 9 10
            Q 11 6 15 6
            L 31 6
            Q 33 6 33 9
            L 33 36
            L 28 36
            Q 27 30 20 30
            Q 13 30 12 36
            L 3 36
            Z
          " fill="url(#cabGrad-${iconKey})" stroke="${strokeColor}" stroke-width="0.8"/>

          <!-- Aerodynamic High-Roof Wind Deflector / Sun Visor Accent -->
          <path d="M 9 10 Q 11 6 15 6 L 31 6 Q 32.5 6 32.5 8.5 L 14 8.5 Q 11 8.5 9 10 Z" fill="#ffffff" opacity="0.32"/>

          <!-- Windshield & Front Glass -->
          <path d="M 6 16 L 9.5 9.5 L 14 9.5 L 12 17.5 L 5 17.5 Z" fill="#0f172a" stroke="#1e293b" stroke-width="0.5"/>
          <!-- Glass Highlight Reflection -->
          <path d="M 7.5 15.5 L 10 10.5 L 11.5 10.5 L 9 15.5 Z" fill="#38bdf8" opacity="0.5"/>

          <!-- Side Door Window -->
          <path d="M 13.5 9.5 L 29 9.5 Q 30 9.5 30 11 L 30 17.5 L 13.5 17.5 Z" fill="#0f172a" stroke="#1e293b" stroke-width="0.5"/>
          <!-- Window Reflection -->
          <line x1="16" y1="11" x2="22" y2="16.5" stroke="#38bdf8" stroke-width="1" opacity="0.4"/>

          <!-- Rear-view Side Mirror -->
          <rect x="3.5" y="13" width="1.8" height="6.5" rx="0.8" fill="#0f172a" stroke="#334155" stroke-width="0.5"/>
          <line x1="5.3" y1="15" x2="7.5" y2="15.5" stroke="#0f172a" stroke-width="0.8"/>

          <!-- Front Bumper & Lower Grille -->
          <path d="M 2 34 L 12 34 L 12 39.5 L 2 39.5 Z" fill="#1e293b" rx="1"/>
          <!-- Horizontal Grille Lines -->
          <line x1="3.5" y1="24" x2="10.5" y2="24" stroke="#0f172a" stroke-width="1"/>
          <line x1="3.5" y1="27" x2="11" y2="27" stroke="#0f172a" stroke-width="1"/>
          <line x1="3.5" y1="30" x2="11.5" y2="30" stroke="#0f172a" stroke-width="1"/>

          <!-- Modern LED Headlights -->
          <path d="M 2 34.5 L 4.5 34.5 L 4.5 37 L 2 36.5 Z" fill="${headlightColor}"/>
          ${
            statusKey === 'moving'
              ? '<polygon points="2,34.5 -4,32 -4,39 2,37" fill="#34d399" opacity="0.6"/>'
              : ''
          }

          <!-- Front Mudguard Fender Trim -->
          <path d="M 11.5 36 Q 13 29 20 29 Q 27 29 28.5 36" fill="none" stroke="#0f172a" stroke-width="1.8"/>

          <!-- WHEELS (Front Steer + Triple Rear Axles) -->
          <!-- Wheel 1: Front -->
          <g>
            <circle cx="20" cy="39" r="6" fill="#0f172a" stroke="#334155" stroke-width="0.8"/>
            <circle cx="20" cy="39" r="3.8" fill="url(#chromeGrad-${iconKey})"/>
            <circle cx="20" cy="39" r="1.5" fill="#0f172a"/>
          </g>

          <!-- Wheel 2: Rear Axle 1 -->
          <g>
            <circle cx="67" cy="39" r="6" fill="#0f172a" stroke="#334155" stroke-width="0.8"/>
            <circle cx="67" cy="39" r="3.8" fill="url(#chromeGrad-${iconKey})"/>
            <circle cx="67" cy="39" r="1.5" fill="#0f172a"/>
          </g>

          <!-- Wheel 3: Rear Axle 2 -->
          <g>
            <circle cx="78.5" cy="39" r="6" fill="#0f172a" stroke="#334155" stroke-width="0.8"/>
            <circle cx="78.5" cy="39" r="3.8" fill="url(#chromeGrad-${iconKey})"/>
            <circle cx="78.5" cy="39" r="1.5" fill="#0f172a"/>
          </g>

          <!-- Wheel 4: Rear Axle 3 -->
          <g>
            <circle cx="90" cy="39" r="6" fill="#0f172a" stroke="#334155" stroke-width="0.8"/>
            <circle cx="90" cy="39" r="3.8" fill="url(#chromeGrad-${iconKey})"/>
            <circle cx="90" cy="39" r="1.5" fill="#0f172a"/>
          </g>
        </g>
      </svg>
    </div>
  `;

  const icon = L.divIcon({
    html: svgHtml,
    className: 'custom-vehicle-marker',
    iconSize: [dims.width, dims.height],
    iconAnchor: [dims.anchorX, dims.anchorY],
    popupAnchor: [0, -dims.height],
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
  }, [createTileLayer]);

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
      let statusKey: VehicleIconStatus = 'stopped';
      if (!isOnline) {
        statusKey = 'offline';
      } else if (vehicle.status === 'maintenance') {
        statusKey = 'maintenance';
      } else if (isMoving) {
        statusKey = 'moving';
      } else {
        statusKey = 'stopped';
      }
      const iconKey = `${markerDensity}-${statusKey}`;

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
          marker.setIcon(createVehicleIcon(statusKey, isMoving, isOnline, markerDensity));
        }
      } else {
        marker = L.marker([lat, lng], {
          icon: createVehicleIcon(statusKey, isMoving, isOnline, markerDensity),
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
          <div style="padding: 12px 14px; min-width: 270px; max-width: 310px; background: linear-gradient(145deg, rgba(144, 144, 147, 0.78) 0%, rgba(120, 120, 125, 0.72) 50%, rgba(95, 95, 100, 0.85) 100%); backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 18px; box-shadow: 0 16px 36px -8px rgba(0, 0, 0, 0.5), 0 0 25px rgba(144, 144, 147, 0.2); font-family: system-ui, -apple-system, sans-serif; color: #ffffff; box-sizing: border-box;">
            
            <!-- Header: Plate & Status Badge with Speed -->
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 6px; margin-bottom: 2px;">
              <div>
                <div style="font-weight: 800; font-size: 15px; color: #ffffff; letter-spacing: -0.01em; line-height: 1.2;">
                  ${vehicle.plate}
                </div>
                <div style="font-size: 10px; color: #e2e8f0; font-weight: 500; margin-top: 1px;">
                  ${vehicle.brand ? `${vehicle.brand} ${vehicle.model}` : `GPS Device ${vehicle.plate}`}
                </div>
              </div>
              
              <!-- Status + Speed Combined Badge -->
              <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 3px;">
                <div style="display: flex; align-items: center; gap: 4px; padding: 2px 7px; background: ${badgeBg}; border: 1px solid ${badgeBorder}; border-radius: 10px; white-space: nowrap;">
                  <span style="width: 6px; height: 6px; border-radius: 50%; background: ${badgeDot}; box-shadow: 0 0 6px ${badgeDot};"></span>
                  <span style="font-size: 10px; color: ${badgeColor}; font-weight: 700;">${statusLabel}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 3px; padding: 1.5px 6px; background: ${isMoving ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.18)'}; border: 1px solid ${isMoving ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.35)'}; border-radius: 8px;">
                  <span style="font-size: 9px;">${isMoving ? '🚗' : '🅿️'}</span>
                  <span style="font-size: 11px; font-weight: 800; color: ${isMoving ? '#a7f3d0' : '#fef08a'}; font-variant-numeric: tabular-nums;">${isMoving ? speed.toFixed(0) + ' km/h' : "0 km/h"}</span>
                </div>
              </div>
            </div>

            <!-- Real-time Address Card -->
            <div style="margin-top: 7px; padding: 6px 9px; background: rgba(0, 0, 0, 0.18); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 11px;">
              <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
                <span style="font-size: 11px;">📍</span>
                <span style="font-size: 8.5px; font-weight: 800; color: #6ee7b7; letter-spacing: 0.08em; text-transform: uppercase;">
                  ADRESSE EN TEMPS RÉEL
                </span>
              </div>
              <div style="font-size: 10px; color: #f8fafc; line-height: 1.35; word-break: break-word;">
                ${address}
              </div>
            </div>

            <!-- 4 Key Telematics Metrics (2x2 Grid) - Compact -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 7px;">
              
              <!-- Tile 1: V.Max -->
              <div style="padding: 6px 8px; background: rgba(0, 0, 0, 0.18); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 11px;">
                <div style="display: flex; align-items: center; gap: 3px; margin-bottom: 1px;">
                  <span style="font-size: 10px;">🏎️</span>
                  <span style="font-size: 8.5px; font-weight: 800; color: #6ee7b7; letter-spacing: 0.05em; text-transform: uppercase;">V.MAX</span>
                </div>
                <div style="font-weight: 800; font-size: 11.5px; color: #a7f3d0;">
                  ${vehicle.topSpeedToday !== null && vehicle.topSpeedToday !== undefined ? vehicle.topSpeedToday.toFixed(0) + ' km/h' : speed.toFixed(0) + ' km/h'}
                </div>
              </div>

              <!-- Tile 2: Distance Jour -->
              <div style="padding: 6px 8px; background: rgba(0, 0, 0, 0.18); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 11px;">
                <div style="display: flex; align-items: center; gap: 3px; margin-bottom: 1px;">
                  <span style="font-size: 10px;">📏</span>
                  <span style="font-size: 8.5px; font-weight: 800; color: #cbd5e1; letter-spacing: 0.05em; text-transform: uppercase;">DISTANCE JOUR</span>
                </div>
                <div style="font-weight: 700; font-size: 11px; color: #ffffff;">
                  ${vehicle.distanceToday !== null && vehicle.distanceToday !== undefined ? vehicle.distanceToday.toLocaleString('fr-FR') + ' km' : '0 km'}
                </div>
              </div>

              <!-- Tile 3: Odomètre -->
              <div style="padding: 6px 8px; background: rgba(0, 0, 0, 0.18); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 11px;">
                <div style="display: flex; align-items: center; gap: 3px; margin-bottom: 1px;">
                  <span style="font-size: 10px;">🛣️</span>
                  <span style="font-size: 8.5px; font-weight: 800; color: #cbd5e1; letter-spacing: 0.05em; text-transform: uppercase;">ODOMÈTRE</span>
                </div>
                <div style="font-weight: 700; font-size: 11px; color: #ffffff;">
                  ${vehicle.mileage.toLocaleString('fr-FR')} km
                </div>
              </div>

              <!-- Tile 4: Durée d'arrêt -->
              <div style="padding: 6px 8px; background: ${!isMoving ? 'rgba(245, 158, 11, 0.15)' : 'rgba(0, 0, 0, 0.18)'}; border: 1px solid ${!isMoving ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255, 255, 255, 0.12)'}; border-radius: 11px;">
                <div style="display: flex; align-items: center; gap: 3px; margin-bottom: 1px;">
                  <span style="font-size: 10px;">⏱️</span>
                  <span style="font-size: 8.5px; font-weight: 800; color: ${!isMoving ? '#fde047' : '#cbd5e1'}; letter-spacing: 0.05em; text-transform: uppercase;">DURÉE D'ARRÊT</span>
                </div>
                <div style="font-weight: 700; font-size: 11px; color: ${!isMoving ? '#fef08a' : '#ffffff'};">
                  ${vehicle.lastPosition?.stopDuration ? vehicle.lastPosition.stopDuration : (isMoving ? 'En route' : '--')}
                </div>
              </div>

            </div>

            <!-- Telematics Indicators Bar -->
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 5px; margin-top: 7px; padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.15);">
              
              <div style="display: flex; align-items: center; gap: 3px; font-size: 10px; color: #cbd5e1;">
                <span style="font-size: 11px;">⛽</span>
                <span style="font-weight: 700; color: ${fuelColor};">${fuelVal !== null ? fuelVal.toFixed(0) + 'L' : '--'}</span>
              </div>

              <div style="display: flex; align-items: center; gap: 3px; font-size: 10px; color: #cbd5e1;">
                <span style="font-size: 11px;">🔋</span>
                <span style="font-weight: 700; color: ${batteryColor};">${batteryVal !== null ? batteryVal.toFixed(0) + '%' : '--'}</span>
              </div>

              <div style="display: flex; align-items: center; gap: 3px; font-size: 10px; color: #cbd5e1;">
                <span style="font-size: 11px;">📶</span>
                <span style="font-weight: 700; color: ${networkColor};">${networkVal !== null ? networkVal.toFixed(0) + '%' : '--'}</span>
              </div>

              ${vehicle.driver ? `
                <div style="display: flex; align-items: center; gap: 3px; font-size: 10px; color: #94a3b8; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  <span>👤</span>
                  <span style="color: #e2e8f0; font-weight: 600;">${vehicle.driver}</span>
                </div>
              ` : ''}

            </div>

            <!-- PDF Download Action Button (Compact) -->
            <div style="margin-top: 7px; padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.12);">
              <button
                type="button"
                onclick="window.__downloadVehiclePdf && window.__downloadVehiclePdf('${encodeURIComponent(JSON.stringify(vehicle))}')"
                style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 4.5px 10px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.85) 0%, rgba(5, 150, 105, 0.95) 100%); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 9px; color: #ffffff; font-size: 10px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3); transition: all 0.2s ease;"
                onmouseover="this.style.opacity='0.9'; this.style.transform='scale(1.01)';"
                onmouseout="this.style.opacity='1'; this.style.transform='scale(1)';"
              >
                <span style="font-size: 11px;">📄</span>
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

        .custom-vehicle-marker {
          background: transparent !important;
          border: none !important;
        }
        .custom-vehicle-marker .truck-marker-inner {
          transform-origin: 50% 90%;
          cursor: pointer;
          transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.22s ease;
          filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.3));
        }
        .custom-vehicle-marker:hover .truck-marker-inner {
          transform: scale(1.18) translateY(-3px);
          filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.45));
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
