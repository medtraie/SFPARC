import React, { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { Loader2, AlertTriangle } from 'lucide-react';
import { MarkerDensity } from './MapSettingsModal';
import { generateVehicleReportPdf } from '@/utils/vehiclePdfGenerator';
import {
  VehicleVisualType,
  useVehicleTypesMap,
  getVehicleVisualType,
} from '@/hooks/useVehicleTypes';

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
        maxNativeZoom: 19,
        maxZoom: 20,
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
  topSpeedToday?: number | null;
  online?: string; // 'online', 'ack', 'offline'
  lastPosition?: {
    lat: number;
    lng: number;
    city: string;
    speed?: number;
    course?: number;
    altitude?: number;
    timestamp?: string;
    stopDuration?: string;
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
export type VehicleIconStatus = 'moving' | 'stopped' | 'offline' | 'maintenance';

// Great-circle bearing calculation between two GPS points (0-360 deg)
const computeBearing = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const phi1 = lat1 * (Math.PI / 180);
  const phi2 = lat2 * (Math.PI / 180);
  const y = Math.sin(dLng) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
};

// Geodesic distance calculation in meters
const computeDistanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Smooth marker glide animation helper
const animateMarkerTo = (
  marker: L.Marker,
  targetLat: number,
  targetLng: number,
  clusterGroup?: L.MarkerClusterGroup | null,
  durationMs = 900
) => {
  const startLatLng = marker.getLatLng();
  const deltaLat = targetLat - startLatLng.lat;
  const deltaLng = targetLng - startLatLng.lng;
  if (Math.abs(deltaLat) < 0.000001 && Math.abs(deltaLng) < 0.000001) return;

  if (Math.abs(deltaLat) > 0.02 || Math.abs(deltaLng) > 0.02) {
    marker.setLatLng([targetLat, targetLng]);
    if (clusterGroup && clusterGroup.hasLayer(marker)) {
      clusterGroup.refreshClusters(marker);
    }
    return;
  }

  const startTime = performance.now();
  const animate = (currentTime: number) => {
    // If map is currently executing a zoom animation, immediately complete to target LatLng
    const m = (marker as any)._map;
    if (m && m._animatingZoom) {
      marker.setLatLng([targetLat, targetLng]);
      if (clusterGroup && clusterGroup.hasLayer(marker)) {
        clusterGroup.refreshClusters(marker);
      }
      return;
    }

    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / durationMs, 1);
    const ease = 1 - Math.pow(1 - progress, 2);
    const curLat = startLatLng.lat + deltaLat * ease;
    const curLng = startLatLng.lng + deltaLng * ease;
    marker.setLatLng([curLat, curLng]);
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      if (clusterGroup && clusterGroup.hasLayer(marker)) {
        clusterGroup.refreshClusters(marker);
      }
    }
  };
  requestAnimationFrame(animate);
};

const createVehicleIcon = (
  statusKey: VehicleIconStatus,
  isMoving: boolean = false,
  _isOnline: boolean = true,
  density: MarkerDensity = 'standard',
  heading: number = 0,
  vehicleType: VehicleVisualType = 'truck_box'
) => {
  const roundedHeading = Math.round(((heading % 360) + 360) % 360);
  const headingBucket = Math.round(roundedHeading / 5) * 5;
  const iconKey = `${vehicleType}-${density}-${statusKey}-${isMoving ? 'm' : 's'}-${headingBucket}`;
  const cachedIcon = vehicleIconCache.get(iconKey);
  if (cachedIcon) return cachedIcon;

  // Scaled dimensions depending on vehicle type & density
  let dims = { width: 22, height: 46, anchorX: 11, anchorY: 23 };
  if (vehicleType === 'car') {
    dims =
      density === 'compact'
        ? { width: 16, height: 34, anchorX: 8, anchorY: 17 }
        : density === 'large'
        ? { width: 23, height: 48, anchorX: 11.5, anchorY: 24 }
        : { width: 19, height: 40, anchorX: 9.5, anchorY: 20 };
  } else if (vehicleType === 'truck_flatbed') {
    dims =
      density === 'compact'
        ? { width: 18, height: 36, anchorX: 9, anchorY: 18 }
        : density === 'large'
        ? { width: 26, height: 52, anchorX: 13, anchorY: 26 }
        : { width: 22, height: 44, anchorX: 11, anchorY: 22 };
  } else {
    // truck_box
    dims =
      density === 'compact'
        ? { width: 18, height: 38, anchorX: 9, anchorY: 19 }
        : density === 'large'
        ? { width: 26, height: 55, anchorX: 13, anchorY: 27 }
        : { width: 22, height: 46, anchorX: 11, anchorY: 23 };
  }

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
  let arrowColor = '#34d399';
  let taillightColor = '#ef4444';

  if (statusKey === 'offline') {
    cabGradStops = `
      <stop offset="0%" stop-color="#64748b"/>
      <stop offset="60%" stop-color="#475569"/>
      <stop offset="100%" stop-color="#1e293b"/>
    `;
    strokeColor = '#0f172a';
    glowColor = '#000000';
    glowOpacity = '0.3';
    headlightColor = '#64748b';
    arrowColor = '#64748b';
    taillightColor = '#7f1d1d';
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
    arrowColor = '#f97316';
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
    arrowColor = '#f59e0b';
  }

  let vehicleInnerSvg = '';

  if (vehicleType === 'car') {
    // -----------------------------------------------------------------
    // 2D PASSENGER CAR / BERLINE / SUV (VUE DE DESSUS - IMAGE 2)
    // -----------------------------------------------------------------
    vehicleInnerSvg = `
      <svg width="100%" height="100%" viewBox="0 0 36 76" xmlns="http://www.w3.org/2000/svg" style="overflow: visible; display: block;">
        <defs>
          <linearGradient id="carBodyGrad-${iconKey}" x1="0%" y1="0%" x2="0%" y2="100%">
            ${cabGradStops}
          </linearGradient>
          <linearGradient id="carRoofGrad-${iconKey}" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.25"/>
            <stop offset="50%" stop-color="#ffffff" stop-opacity="0.05"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0.2"/>
          </linearGradient>
          <linearGradient id="beamGrad-${iconKey}" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="rgba(16, 185, 129, 0.45)"/>
            <stop offset="100%" stop-color="rgba(16, 185, 129, 0)"/>
          </linearGradient>
          <filter id="truckGlow-${iconKey}" x="-25%" y="-20%" width="150%" height="140%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="${glowColor}" flood-opacity="${glowOpacity}"/>
            <feDropShadow dx="0" dy="1.5" stdDeviation="1" flood-color="#000000" flood-opacity="0.35"/>
          </filter>
        </defs>

        <!-- Ground Shadow -->
        <ellipse cx="18" cy="38" rx="14" ry="34" fill="rgba(0,0,0,0.35)"/>

        ${
          statusKey === 'moving'
            ? `
          <!-- Headlight Light Beam projecting forward onto road -->
          <polygon points="7,6 -3,-20 39,-20 29,6" fill="url(#beamGrad-${iconKey})"/>
          <ellipse cx="18" cy="7" rx="8" ry="3" fill="none" stroke="#10b981" stroke-width="1.2" opacity="0.8">
            <animate attributeName="ry" from="2" to="8" dur="1.2s" repeatCount="indefinite"/>
            <animate attributeName="rx" from="5" to="14" dur="1.2s" repeatCount="indefinite"/>
            <animate attributeName="opacity" from="0.9" to="0" dur="1.2s" repeatCount="indefinite"/>
          </ellipse>
        `
            : ''
        }

        <g filter="url(#truckGlow-${iconKey})">
          <!-- 4 Wheels tucked into body contours -->
          <rect x="2.5" y="14" width="4" height="9" rx="1.5" fill="#0f172a"/>
          <rect x="29.5" y="14" width="4" height="9" rx="1.5" fill="#0f172a"/>
          <rect x="2.5" y="49" width="4" height="9" rx="1.5" fill="#0f172a"/>
          <rect x="29.5" y="49" width="4" height="9" rx="1.5" fill="#0f172a"/>

          <!-- Car Aerodynamic Body Contour matching Image 2 -->
          <path d="M 11 6 Q 18 4.8 25 6 Q 31 7 31.5 14 L 32 24 Q 32.5 30 32 38 L 32.5 50 Q 33 58 31 66 Q 28 72 18 72 Q 8 72 5 66 Q 3 58 3.5 50 L 4 38 Q 3.5 30 4 24 L 4.5 14 Q 5 7 11 6 Z" fill="url(#carBodyGrad-${iconKey})" stroke="${strokeColor}" stroke-width="0.8"/>

          <!-- Hood Sculpt Lines & Front Grille -->
          <path d="M 10 9 Q 18 11.5 26 9" fill="none" stroke="#ffffff" stroke-width="0.6" opacity="0.4"/>
          <path d="M 11 11 L 12.5 21" stroke="#000000" stroke-width="0.5" opacity="0.25"/>
          <path d="M 25 11 L 23.5 21" stroke="#000000" stroke-width="0.5" opacity="0.25"/>
          <rect x="15.5" y="6" width="5" height="1.5" rx="0.5" fill="#0f172a" opacity="0.6"/>

          <!-- Front Windshield -->
          <path d="M 8 22 Q 18 19.5 28 22 L 25.8 33 Q 18 31.2 10.2 33 Z" fill="#0f172a" stroke="#1e293b" stroke-width="0.5"/>
          <path d="M 10 22.5 L 16 21 L 14 32 L 9.5 32 Z" fill="#38bdf8" opacity="0.4"/>
          <!-- Windshield Wipers -->
          <line x1="12" y1="23" x2="17" y2="22" stroke="#475569" stroke-width="0.6"/>
          <line x1="19" y1="23" x2="24" y2="22" stroke="#475569" stroke-width="0.6"/>

          <!-- Side Windows & Roof Pillars -->
          <path d="M 6.8 34.5 L 9.8 34.2 L 10.5 51.5 L 7.2 50.5 Q 6.4 42 6.8 34.5 Z" fill="#0f172a"/>
          <line x1="6.8" y1="42.5" x2="10.2" y2="42.5" stroke="#334155" stroke-width="0.8"/>
          <path d="M 29.2 34.5 L 26.2 34.2 L 25.5 51.5 L 28.8 50.5 Q 29.6 42 29.2 34.5 Z" fill="#0f172a"/>
          <line x1="29.2" y1="42.5" x2="25.8" y2="42.5" stroke="#334155" stroke-width="0.8"/>

          <!-- Roof Surface with Subtle Sheen -->
          <path d="M 9.8 34 L 26.2 34 L 25.5 51.5 L 10.5 51.5 Z" fill="url(#carBodyGrad-${iconKey})" stroke="${strokeColor}" stroke-width="0.5"/>
          <path d="M 9.8 34 L 26.2 34 L 25.5 51.5 L 10.5 51.5 Z" fill="url(#carRoofGrad-${iconKey})"/>

          <!-- Sunroof / Glass Roof Panel -->
          <rect x="12" y="35.5" width="12" height="12.5" rx="1.5" fill="#0b1322" stroke="#334155" stroke-width="0.6"/>
          <!-- Shark-Fin Antenna -->
          <path d="M 18 49.5 L 18.8 52.5 L 17.2 52.5 Z" fill="#0f172a"/>

          <!-- Rear Window -->
          <path d="M 10.2 52.5 Q 18 51.2 25.8 52.5 L 24.5 61.5 Q 18 63 11.5 61.5 Z" fill="#0f172a" stroke="#1e293b" stroke-width="0.5"/>
          <line x1="18" y1="58" x2="21.5" y2="55.5" stroke="#475569" stroke-width="0.5"/>

          <!-- Rear Trunk / Spoiler Lip -->
          <path d="M 11 63 Q 18 64.2 25 63 L 24.5 65.5 Q 18 66.5 11.5 65.5 Z" fill="#ffffff" opacity="0.35"/>

          <!-- Wrap-Around Taillights matching Image 2 -->
          <path d="M 5 61.5 Q 4.5 67 9.5 67.5 L 9.5 65.5 Q 6.5 65 6.5 61.5 Z" fill="${taillightColor}"/>
          <path d="M 31 61.5 Q 31.5 67 26.5 67.5 L 26.5 65.5 Q 29.5 65 29.5 61.5 Z" fill="${taillightColor}"/>
          <rect x="15" y="62" width="6" height="1" rx="0.4" fill="${taillightColor}"/>

          <!-- Aerodynamic Side Mirrors -->
          <line x1="7" y1="27" x2="2.5" y2="29" stroke="#334155" stroke-width="1.2"/>
          <rect x="1.5" y="27.5" width="2" height="4" rx="0.8" fill="#0f172a"/>
          <line x1="29" y1="27" x2="33.5" y2="29" stroke="#334155" stroke-width="1.2"/>
          <rect x="32.5" y="27.5" width="2" height="4" rx="0.8" fill="#0f172a"/>

          <!-- Front LED Headlights -->
          <polygon points="7,7 12,6.5 11,9.5 6.5,9" fill="${headlightColor}"/>
          <polygon points="29,7 24,6.5 25,9.5 29.5,9" fill="${headlightColor}"/>

          <!-- Forward Direction Indicator Arrow -->
          <path d="M 18 0.5 L 21 4 L 19.5 4 L 19.5 6 L 16.5 6 L 16.5 4 L 15 4 Z" fill="${arrowColor}"/>
        </g>
      </svg>
    `;
  } else if (vehicleType === 'truck_flatbed') {
    // -----------------------------------------------------------------
    // 2D FLATBED TRUCK / CHÂSSIS PLATEAU (CAMION PLATEAU)
    // -----------------------------------------------------------------
    vehicleInnerSvg = `
      <svg width="100%" height="100%" viewBox="0 0 40 80" xmlns="http://www.w3.org/2000/svg" style="overflow: visible; display: block;">
        <defs>
          <linearGradient id="cabGrad-${iconKey}" x1="0%" y1="0%" x2="0%" y2="100%">
            ${cabGradStops}
          </linearGradient>
          <linearGradient id="chromeGrad-${iconKey}" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#e2e8f0"/>
            <stop offset="50%" stop-color="#94a3b8"/>
            <stop offset="100%" stop-color="#64748b"/>
          </linearGradient>
          <linearGradient id="deckGrad-${iconKey}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#64748b"/>
            <stop offset="100%" stop-color="#334155"/>
          </linearGradient>
          <linearGradient id="beamGrad-${iconKey}" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="rgba(16, 185, 129, 0.45)"/>
            <stop offset="100%" stop-color="rgba(16, 185, 129, 0)"/>
          </linearGradient>
          <filter id="truckGlow-${iconKey}" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="${glowColor}" flood-opacity="${glowOpacity}"/>
            <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000000" flood-opacity="0.35"/>
          </filter>
        </defs>

        <!-- Ground Shadow -->
        <ellipse cx="20" cy="40" rx="14" ry="36" fill="rgba(0,0,0,0.35)"/>

        ${
          statusKey === 'moving'
            ? `
          <!-- Headlight Light Beam projecting forward onto road -->
          <polygon points="9,6 -2,-18 42,-18 31,6" fill="url(#beamGrad-${iconKey})"/>
          <ellipse cx="20" cy="8" rx="8" ry="3" fill="none" stroke="#10b981" stroke-width="1.2" opacity="0.8">
            <animate attributeName="ry" from="2" to="8" dur="1.2s" repeatCount="indefinite"/>
            <animate attributeName="rx" from="6" to="16" dur="1.2s" repeatCount="indefinite"/>
            <animate attributeName="opacity" from="0.9" to="0" dur="1.2s" repeatCount="indefinite"/>
          </ellipse>
        `
            : ''
        }

        <g filter="url(#truckGlow-${iconKey})">
          <!-- Wheels (8 total: Front Steer + 3 Rear Axles) -->
          <rect x="2.5" y="14" width="4.5" height="11" rx="2" fill="#0f172a"/>
          <rect x="33" y="14" width="4.5" height="11" rx="2" fill="#0f172a"/>
          <rect x="2.5" y="46" width="4.5" height="9.5" rx="2" fill="#0f172a"/>
          <rect x="33" y="46" width="4.5" height="9.5" rx="2" fill="#0f172a"/>
          <rect x="2.5" y="56" width="4.5" height="9.5" rx="2" fill="#0f172a"/>
          <rect x="33" y="56" width="4.5" height="9.5" rx="2" fill="#0f172a"/>
          <rect x="2.5" y="66" width="4.5" height="9.5" rx="2" fill="#0f172a"/>
          <rect x="33" y="66" width="4.5" height="9.5" rx="2" fill="#0f172a"/>

          <!-- Fuel Tank & Side Equipment Box -->
          <rect x="5" y="29" width="4.5" height="13" rx="1.5" fill="url(#chromeGrad-${iconKey})"/>
          <rect x="30.5" y="29" width="4.5" height="13" rx="1.5" fill="#334155"/>

          <!-- Flatbed Platform (Deck / Chassis) -->
          <rect x="13" y="26" width="14" height="50" fill="#1e293b"/>
          <rect x="7" y="28" width="26" height="48" rx="2.5" fill="url(#deckGrad-${iconKey})" stroke="#1e293b" stroke-width="0.8"/>
          <rect x="8.5" y="29.5" width="23" height="45" rx="1.5" fill="none" stroke="#64748b" stroke-width="0.7"/>
          <line x1="10" y1="36" x2="30" y2="36" stroke="#1e293b" stroke-width="0.7"/>
          <line x1="10" y1="44" x2="30" y2="44" stroke="#1e293b" stroke-width="0.7"/>
          <line x1="10" y1="52" x2="30" y2="52" stroke="#1e293b" stroke-width="0.7"/>
          <line x1="10" y1="60" x2="30" y2="60" stroke="#1e293b" stroke-width="0.7"/>
          <line x1="10" y1="68" x2="30" y2="68" stroke="#1e293b" stroke-width="0.7"/>

          <!-- Rear Bumper & LED Taillights -->
          <rect x="7" y="76" width="26" height="2.5" fill="#0f172a" rx="0.5"/>
          <rect x="8" y="76" width="4.5" height="2" fill="${taillightColor}" rx="0.5"/>
          <rect x="27.5" y="76" width="4.5" height="2" fill="${taillightColor}" rx="0.5"/>

          <!-- CABIN (Main Tractor Unit) -->
          <path d="M 7 28 L 7 14 Q 7 8 13 6.5 L 27 6.5 Q 33 8 33 14 L 33 28 Z" fill="url(#cabGrad-${iconKey})" stroke="${strokeColor}" stroke-width="0.8"/>
          <path d="M 9.5 9 Q 20 7.8 30.5 9 L 30 10.5 Q 20 9.2 10 10.5 Z" fill="#ffffff" opacity="0.35"/>
          <path d="M 9.5 15.5 Q 9.5 11 13 10 L 27 10 Q 30.5 11 30.5 15.5 L 29 17.5 L 11 17.5 Z" fill="#0f172a" stroke="#1e293b" stroke-width="0.5"/>
          <path d="M 12 11 L 18 11 L 16 16.5 L 11 16.5 Z" fill="#38bdf8" opacity="0.45"/>
          <rect x="14" y="20" width="12" height="5" rx="1.5" fill="#0f172a" opacity="0.25"/>

          <!-- Side Mirrors -->
          <line x1="7" y1="16" x2="3" y2="14" stroke="#334155" stroke-width="1.2"/>
          <rect x="1.5" y="12" width="2.5" height="4.5" rx="1" fill="#0f172a"/>
          <line x1="33" y1="16" x2="37" y2="14" stroke="#334155" stroke-width="1.2"/>
          <rect x="36" y="12" width="2.5" height="4.5" rx="1" fill="#0f172a"/>

          <!-- Front LED Headlights -->
          <rect x="9" y="5.5" width="4" height="2" rx="0.8" fill="${headlightColor}"/>
          <rect x="27" y="5.5" width="4" height="2" rx="0.8" fill="${headlightColor}"/>

          <!-- Forward Directional Arrow Indicator -->
          <path d="M 20 0.5 L 23 4 L 21.5 4 L 21.5 6 L 18.5 6 L 18.5 4 L 17 4 Z" fill="${arrowColor}"/>
        </g>
      </svg>
    `;
  } else {
    // -----------------------------------------------------------------
    // 2D BOX TRUCK / CAMION FOURGON DE FRET (VUE DE DESSUS - IMAGE 1)
    // -----------------------------------------------------------------
    vehicleInnerSvg = `
      <svg width="100%" height="100%" viewBox="0 0 40 84" xmlns="http://www.w3.org/2000/svg" style="overflow: visible; display: block;">
        <defs>
          <linearGradient id="cabGrad-${iconKey}" x1="0%" y1="0%" x2="0%" y2="100%">
            ${cabGradStops}
          </linearGradient>
          <linearGradient id="boxGrad-${iconKey}" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#cbd5e1"/>
            <stop offset="25%" stop-color="#f8fafc"/>
            <stop offset="75%" stop-color="#f1f5f9"/>
            <stop offset="100%" stop-color="#94a3b8"/>
          </linearGradient>
          <linearGradient id="beamGrad-${iconKey}" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="rgba(16, 185, 129, 0.45)"/>
            <stop offset="100%" stop-color="rgba(16, 185, 129, 0)"/>
          </linearGradient>
          <filter id="truckGlow-${iconKey}" x="-25%" y="-20%" width="150%" height="140%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.8" flood-color="${glowColor}" flood-opacity="${glowOpacity}"/>
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-color="#000000" flood-opacity="0.38"/>
          </filter>
        </defs>

        <!-- Ground Shadow -->
        <ellipse cx="20" cy="42" rx="15" ry="38" fill="rgba(0,0,0,0.38)"/>

        ${
          statusKey === 'moving'
            ? `
          <!-- Headlight Light Beam projecting forward onto road -->
          <polygon points="9,6 -2,-20 42,-20 31,6" fill="url(#beamGrad-${iconKey})"/>
          <ellipse cx="20" cy="8" rx="8" ry="3" fill="none" stroke="#10b981" stroke-width="1.2" opacity="0.8">
            <animate attributeName="ry" from="2" to="8" dur="1.2s" repeatCount="indefinite"/>
            <animate attributeName="rx" from="6" to="16" dur="1.2s" repeatCount="indefinite"/>
            <animate attributeName="opacity" from="0.9" to="0" dur="1.2s" repeatCount="indefinite"/>
          </ellipse>
        `
            : ''
        }

        <g filter="url(#truckGlow-${iconKey})">
          <!-- Steer Wheels (Front) -->
          <rect x="2.5" y="14" width="4.5" height="11" rx="2" fill="#0f172a"/>
          <rect x="33" y="14" width="4.5" height="11" rx="2" fill="#0f172a"/>

          <!-- Rear Dual Tandem Wheels (Axle 1 & Axle 2) -->
          <rect x="2" y="52" width="4.5" height="10" rx="2" fill="#0f172a"/>
          <rect x="33.5" y="52" width="4.5" height="10" rx="2" fill="#0f172a"/>
          <rect x="2" y="64" width="4.5" height="10" rx="2" fill="#0f172a"/>
          <rect x="33.5" y="64" width="4.5" height="10" rx="2" fill="#0f172a"/>

          <!-- Side Underrun Protection Guards (Barres anti-encastrement) -->
          <rect x="3" y="32" width="3.5" height="16" rx="1" fill="#334155"/>
          <line x1="3" y1="36" x2="6.5" y2="36" stroke="#94a3b8" stroke-width="1"/>
          <line x1="3" y1="42" x2="6.5" y2="42" stroke="#94a3b8" stroke-width="1"/>
          <rect x="33.5" y="32" width="3.5" height="16" rx="1" fill="#334155"/>
          <line x1="33.5" y1="36" x2="37" y2="36" stroke="#94a3b8" stroke-width="1"/>
          <line x1="33.5" y1="42" x2="37" y2="42" stroke="#94a3b8" stroke-width="1"/>

          <!-- CLOSED FREIGHT CARGO BOX (Caisse Fourgon) -->
          <rect x="6" y="27" width="28" height="52" rx="2" fill="url(#boxGrad-${iconKey})" stroke="#334155" stroke-width="0.8"/>
          <!-- Box Front Corner Joint -->
          <path d="M 6 29 Q 12 26 20 26 Q 28 26 34 29 Z" fill="#475569" opacity="0.3"/>
          <!-- Roof Stiffening Ribs (Rainures de rigidité) -->
          <line x1="12" y1="31" x2="12" y2="74" stroke="#94a3b8" stroke-width="0.75" opacity="0.7"/>
          <line x1="20" y1="31" x2="20" y2="74" stroke="#94a3b8" stroke-width="0.75" opacity="0.7"/>
          <line x1="28" y1="31" x2="28" y2="74" stroke="#94a3b8" stroke-width="0.75" opacity="0.7"/>
          <!-- Corner Aluminum Profiles (Profilés d'angles) -->
          <rect x="6" y="27" width="2" height="52" fill="#64748b" opacity="0.4"/>
          <rect x="32" y="27" width="2" height="52" fill="#64748b" opacity="0.4"/>

          <!-- Rear Double Doors Outline & Locking Bars -->
          <rect x="7" y="78" width="26" height="2" fill="#1e293b"/>
          <line x1="20" y1="74" x2="20" y2="79" stroke="#0f172a" stroke-width="0.9"/>
          <line x1="15" y1="73" x2="15" y2="79" stroke="#334155" stroke-width="0.8"/>
          <rect x="14.2" y="75" width="1.6" height="2" fill="#0f172a"/>
          <line x1="25" y1="73" x2="25" y2="79" stroke="#334155" stroke-width="0.8"/>
          <rect x="24.2" y="75" width="1.6" height="2" fill="#0f172a"/>

          <!-- Rear Bumper & LED Taillights -->
          <rect x="6" y="79" width="28" height="2.5" fill="#0f172a" rx="0.5"/>
          <rect x="7" y="79" width="5" height="2" fill="${taillightColor}" rx="0.5"/>
          <rect x="28" y="79" width="5" height="2" fill="${taillightColor}" rx="0.5"/>

          <!-- CABIN (Main Tractor Unit) -->
          <path d="M 7 28 L 7 14 Q 7 8 13 6.5 L 27 6.5 Q 33 8 33 14 L 33 28 Z" fill="url(#cabGrad-${iconKey})" stroke="${strokeColor}" stroke-width="0.8"/>
          <!-- Aerodynamic Roof Spoiler / Casquette matching Image 1 -->
          <path d="M 9 12 Q 20 8.5 31 12 L 30 14 Q 20 11 10 14 Z" fill="#ffffff" opacity="0.4"/>
          <!-- Windshield Glass -->
          <path d="M 9.5 15.5 Q 9.5 11 13 10 L 27 10 Q 30.5 11 30.5 15.5 L 29 17.5 L 11 17.5 Z" fill="#0f172a" stroke="#1e293b" stroke-width="0.5"/>
          <path d="M 12 11 L 18 11 L 16 16.5 L 11 16.5 Z" fill="#38bdf8" opacity="0.45"/>

          <!-- Side Mirrors extending outwards -->
          <line x1="7" y1="16" x2="2.5" y2="14" stroke="#334155" stroke-width="1.2"/>
          <rect x="1.5" y="12" width="2.5" height="4.5" rx="1" fill="#0f172a"/>
          <line x1="33" y1="16" x2="37.5" y2="14" stroke="#334155" stroke-width="1.2"/>
          <rect x="36" y="12" width="2.5" height="4.5" rx="1" fill="#0f172a"/>

          <!-- Front LED Headlights -->
          <rect x="9" y="5.5" width="4" height="2" rx="0.8" fill="${headlightColor}"/>
          <rect x="27" y="5.5" width="4" height="2" rx="0.8" fill="${headlightColor}"/>

          <!-- Forward Directional Arrow Indicator -->
          <path d="M 20 0.5 L 23 4 L 21.5 4 L 21.5 6 L 18.5 6 L 18.5 4 L 17 4 Z" fill="${arrowColor}"/>
        </g>
      </svg>
    `;
  }

  const svgHtml = `
    <div class="custom-vehicle-marker" style="width: ${dims.width}px; height: ${dims.height}px;">
      <div class="truck-rotator" style="width: 100%; height: 100%; transform: rotate(${roundedHeading}deg); transform-origin: center center; transition: transform 0.35s cubic-bezier(0.2, 0, 0.2, 1);">
        ${vehicleInnerSvg}
      </div>
    </div>
  `;

  const icon = L.divIcon({
    html: svgHtml,
    className: 'custom-vehicle-marker-container',
    iconSize: [dims.width, dims.height],
    iconAnchor: [dims.anchorX, dims.anchorY],
    popupAnchor: [0, -dims.anchorY - 4],
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
  const vehicleTypesMap = useVehicleTypesMap();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const markerStateRef = useRef<Map<string, { iconKey: string; popupKey: string }>>(new Map());
  const vehicleHeadingsRef = useRef<Map<string, number>>(new Map());
  const vehiclePositionsRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const hasFittedBounds = useRef(false);
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
    const map = mapRef.current;
    if (zoomSignal.type === 'in') {
      const curZoom = map.getZoom();
      const maxZ = map.getMaxZoom() || 20;
      if (curZoom < maxZ) {
        if (followingVehicleId) {
          const followedVehicle = vehicles.find((v) => v.id === followingVehicleId);
          if (followedVehicle?.lastPosition) {
            map.setView(
              [followedVehicle.lastPosition.lat, followedVehicle.lastPosition.lng],
              Math.min(curZoom + 1, maxZ),
              { animate: true }
            );
            return;
          }
        }
        map.zoomIn();
      }
    } else if (zoomSignal.type === 'out') {
      const curZoom = map.getZoom();
      const minZ = map.getMinZoom() || 3;
      if (curZoom > minZ) {
        if (followingVehicleId) {
          const followedVehicle = vehicles.find((v) => v.id === followingVehicleId);
          if (followedVehicle?.lastPosition) {
            map.setView(
              [followedVehicle.lastPosition.lat, followedVehicle.lastPosition.lng],
              Math.max(curZoom - 1, minZ),
              { animate: true }
            );
            return;
          }
        }
        map.zoomOut();
      }
    }
  }, [zoomSignal, followingVehicleId, vehicles]);

  const createTileLayer = useCallback((layerKey: string) => {
    const targetLayer = layerKey === 'fallback-osm' ? 'osm' : (layerKey as MapLayerType);
    const config = getTileLayerConfig(targetLayer);
    const layer = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
      maxNativeZoom: (config as any).maxNativeZoom || config.maxZoom,
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
      minZoom: 3,
      maxZoom: 20,
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
      disableClusteringAtZoom: 16, // At street level (zoom >= 16), automatically separate all vehicles onto streets
      maxZoom: 20,
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
        markersRef.current.forEach((marker, id) => {
          if (followingVehicleId === id) {
            if (clusterGroupRef.current?.hasLayer(marker)) {
              clusterGroupRef.current.removeLayer(marker);
            }
            if (!mapRef.current?.hasLayer(marker)) {
              marker.addTo(mapRef.current!);
            }
            return;
          }
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
  }, [enableClustering, followingVehicleId]);

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
      let marker = currentMarkers.get(vehicle.id);
      const rawSpeed = vehicle.lastPosition.speed || 0;
      const isOnline = vehicle.online === 'online' || vehicle.online === 'ack';
      // Stationary GPS jitter is typically 0-2.5 km/h
      const isMoving = isOnline && rawSpeed >= 3;
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

      // Determine heading/bearing
      let heading = vehicle.lastPosition.course ?? 0;
      const prevHeading = vehicleHeadingsRef.current.get(vehicle.id);
      const prevPos = vehiclePositionsRef.current.get(vehicle.id);
      if (prevPos) {
        const dist = computeDistanceMeters(prevPos.lat, prevPos.lng, lat, lng);
        if (dist >= 2.5) {
          // Real GPS displacement: compute authoritative road vector heading
          heading = computeBearing(prevPos.lat, prevPos.lng, lat, lng);
        } else if (heading === 0 && prevHeading !== undefined) {
          heading = prevHeading;
        }
      } else if (heading === 0 && prevHeading !== undefined) {
        heading = prevHeading;
      }
      vehicleHeadingsRef.current.set(vehicle.id, heading);
      vehiclePositionsRef.current.set(vehicle.id, { lat, lng });

      const vType =
        vehicleTypesMap[vehicle.id] ||
        (vehicle.plate ? vehicleTypesMap[vehicle.plate.toLowerCase().trim()] : null) ||
        getVehicleVisualType(vehicle.id, vehicle);

      const roundedHeading = Math.round(((heading % 360) + 360) % 360);
      const headingBucket = Math.round(roundedHeading / 5) * 5;
      const iconKey = `${vType}-${markerDensity}-${statusKey}-${isMoving ? 'm' : 's'}-${headingBucket}`;

      if (marker) {
        (marker as any).vehicleData = vehicle;
        const currentLatLng = marker.getLatLng();
        if (
          Math.abs(currentLatLng.lat - lat) > 0.000001 ||
          Math.abs(currentLatLng.lng - lng) > 0.000001
        ) {
          animateMarkerTo(marker, lat, lng, clusterGroupRef.current, 900);
        }

        // Smoothly rotate the rotator element if already in DOM
        const iconElement = marker.getElement();
        if (iconElement) {
          const rotator = iconElement.querySelector('.truck-rotator') as HTMLElement;
          if (rotator) {
            rotator.style.transform = `rotate(${roundedHeading}deg)`;
          }
        }

        const prevState = markerStateRef.current.get(vehicle.id);
        if (!prevState || prevState.iconKey !== iconKey) {
          marker.setIcon(createVehicleIcon(statusKey, isMoving, isOnline, markerDensity, heading, vType));
        }
      } else {
        marker = L.marker([lat, lng], {
          icon: createVehicleIcon(statusKey, isMoving, isOnline, markerDensity, heading, vType),
        });
        (marker as any).vehicleData = vehicle;

        marker.on('click', () => {
          onVehicleSelect?.(vehicle.id);
        });

        currentMarkers.set(vehicle.id, marker);
      }

      // Layer placement: if following this vehicle, NEVER cluster it!
      if (followingVehicleId === vehicle.id) {
        if (clusterGroupRef.current) {
          try {
            clusterGroupRef.current.removeLayer(marker);
          } catch (_) {}
        }
        if (!map.hasLayer(marker)) {
          marker.addTo(map);
        }
        marker.setZIndexOffset(10000);
      } else if (enableClustering && clusterGroupRef.current) {
        if (map.hasLayer(marker)) {
          map.removeLayer(marker);
        }
        if (!clusterGroupRef.current.hasLayer(marker)) {
          clusterGroupRef.current.addLayer(marker);
        }
        marker.setZIndexOffset(0);
      } else {
        if (clusterGroupRef.current?.hasLayer(marker)) {
          clusterGroupRef.current.removeLayer(marker);
        }
        if (!map.hasLayer(marker)) {
          marker.addTo(map);
        }
        marker.setZIndexOffset(0);
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
  }, [vehicles, onVehicleSelect, enableClustering, selectedVehicleId, followingVehicleId, markerDensity, showPoints, vehicleTypesMap]);

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
    if (!mapRef.current || !followingVehicleId) return;

    const map = mapRef.current;
    const followedVehicle = vehicles.find((v) => v.id === followingVehicleId);
    if (!followedVehicle?.lastPosition) return;

    const { lat, lng } = followedVehicle.lastPosition;

    // Center camera on followed vehicle at street level (zoom 17)
    if (map.getZoom() < 17) {
      map.flyTo([lat, lng], 17, { duration: 1.0 });
    } else {
      map.panTo([lat, lng], { animate: true, duration: 0.6 });
    }

    const targetMarker = markersRef.current.get(followingVehicleId);
    if (targetMarker) {
      targetMarker.setZIndexOffset(10000);
    }
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

        .custom-vehicle-marker-container {
          background: transparent !important;
          border: none !important;
          transition: filter 0.2s ease;
        }
        .custom-vehicle-marker-container:hover {
          filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.55));
          z-index: 9999 !important;
        }
        .custom-vehicle-marker-container .truck-rotator {
          transform-origin: center center;
          cursor: pointer;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35));
          transition: transform 0.35s cubic-bezier(0.2, 0, 0.2, 1);
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
