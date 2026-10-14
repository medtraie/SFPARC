import { useState, useEffect, useCallback } from 'react';

export type VehicleVisualType = 'truck_box' | 'car' | 'truck_flatbed';

export interface VehicleTypeMeta {
  id: VehicleVisualType;
  labelFr: string;
  labelAr: string;
  categoryFr: string;
  categoryAr: string;
  descriptionFr: string;
  descriptionAr: string;
}

export const VEHICLE_VISUAL_TYPES: Record<VehicleVisualType, VehicleTypeMeta> = {
  truck_box: {
    id: 'truck_box',
    labelFr: 'Camion Fourgon',
    labelAr: 'شاحنة مغلقة (Fourgon)',
    categoryFr: 'Poids Lourd / Fret',
    categoryAr: 'نقل البضائع والمبردات',
    descriptionFr: 'Caisse fermée avec déflecteur aérodynamique et double essieu',
    descriptionAr: 'صندوق شحن مغلق مع جناح انسيابي ومحاور مزدوجة',
  },
  car: {
    id: 'car',
    labelFr: 'Voiture Légère',
    labelAr: 'سيارة خفيفة (Tourisme)',
    categoryFr: 'Véhicule Léger / Berline / SUV',
    categoryAr: 'سيارة سياحية / عائلية / SUV',
    descriptionFr: 'Berline / SUV vue de dessus avec pare-brise profilé et feux LED',
    descriptionAr: 'سيارة ركاب 2D انسيابية مع مصابيح LED ونوافذ بانورامية',
  },
  truck_flatbed: {
    id: 'truck_flatbed',
    labelFr: 'Camion Plateau',
    labelAr: 'شاحنة مقطورة (Plateau)',
    categoryFr: 'Poids Lourd / Châssis Nu',
    categoryAr: 'شاحنة نقل ثقيل ومسطحة',
    descriptionFr: 'Plateau ouvert avec traverses métalliques et réservoir chrome',
    descriptionAr: 'شاحنة مسطحة مفتوحة لنقل المواد الثقيلة وهيكل فولاذي',
  },
};

const STORAGE_KEY = 'sftm_vehicle_custom_types_v1';
const EVENT_NAME = 'sftm_vehicle_types_changed';

/**
 * Intelligent default detection from vehicle brand, model, or plate
 */
export function detectDefaultVehicleType(vehicleInfo?: {
  plate?: string;
  brand?: string;
  model?: string;
}): VehicleVisualType {
  if (!vehicleInfo) return 'truck_box';

  const combined = `${vehicleInfo.plate || ''} ${vehicleInfo.brand || ''} ${vehicleInfo.model || ''}`.toLowerCase();

  // Check for passenger cars / light vehicles
  if (
    combined.includes('clio') ||
    combined.includes('duster') ||
    combined.includes('megane') ||
    combined.includes('golf') ||
    combined.includes('peugeot 20') ||
    combined.includes('peugeot 30') ||
    combined.includes('sandero') ||
    combined.includes('logan') ||
    combined.includes('c-elysee') ||
    combined.includes('passat') ||
    combined.includes('corolla') ||
    combined.includes('yaris') ||
    combined.includes('accent') ||
    combined.includes('tucson') ||
    combined.includes('sportage') ||
    combined.includes('berline') ||
    combined.includes('voiture') ||
    combined.includes('car') ||
    combined.includes('suv')
  ) {
    return 'car';
  }

  // Check for flatbed / heavy tractor trailer
  if (
    combined.includes('plateau') ||
    combined.includes('semi') ||
    combined.includes('remorque') ||
    combined.includes('benne') ||
    combined.includes('citerne') ||
    combined.includes('actros') ||
    combined.includes('volvo fh') ||
    combined.includes('scania')
  ) {
    return 'truck_flatbed';
  }

  // Default to Box Truck (standard commercial fleet)
  return 'truck_box';
}

/**
 * Reads all stored custom vehicle types from localStorage
 */
export function getAllVehicleCustomTypes(): Record<string, VehicleVisualType> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Failed to read vehicle types from storage', e);
    return {};
  }
}

/**
 * Resolves the visual type for a single vehicle (stored > detected default)
 */
export function getVehicleVisualType(
  vehicleId: string | number,
  vehicleInfo?: { plate?: string; brand?: string; model?: string }
): VehicleVisualType {
  const customMap = getAllVehicleCustomTypes();
  const idKey = String(vehicleId);
  const plateKey = vehicleInfo?.plate ? vehicleInfo.plate.trim().toLowerCase() : '';

  if (customMap[idKey]) return customMap[idKey];
  if (plateKey && customMap[plateKey]) return customMap[plateKey];

  return detectDefaultVehicleType(vehicleInfo);
}

/**
 * Saves a vehicle's selected visual type and dispatches real-time update
 */
export function saveVehicleVisualType(
  vehicleId: string | number,
  type: VehicleVisualType,
  plate?: string
): void {
  if (typeof window === 'undefined') return;
  try {
    const customMap = getAllVehicleCustomTypes();
    const idKey = String(vehicleId);
    customMap[idKey] = type;
    if (plate) {
      customMap[plate.trim().toLowerCase()] = type;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customMap));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { vehicleId: idKey, type } }));
  } catch (e) {
    console.error('Failed to save vehicle type', e);
  }
}

/**
 * React hook to listen for vehicle types and update reactively
 */
export function useVehicleTypesMap(): Record<string, VehicleVisualType> {
  const [typesMap, setTypesMap] = useState<Record<string, VehicleVisualType>>(() =>
    getAllVehicleCustomTypes()
  );

  useEffect(() => {
    const handler = () => {
      setTypesMap(getAllVehicleCustomTypes());
    };

    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  return typesMap;
}

/**
 * React hook for a single vehicle's visual type
 */
export function useVehicleVisualType(
  vehicleId: string | number,
  vehicleInfo?: { plate?: string; brand?: string; model?: string }
): {
  type: VehicleVisualType;
  setType: (newType: VehicleVisualType) => void;
  meta: VehicleTypeMeta;
} {
  const typesMap = useVehicleTypesMap();
  const idKey = String(vehicleId);
  const plateKey = vehicleInfo?.plate ? vehicleInfo.plate.trim().toLowerCase() : '';

  const currentType: VehicleVisualType =
    typesMap[idKey] || (plateKey ? typesMap[plateKey] : null) || detectDefaultVehicleType(vehicleInfo);

  const setType = useCallback(
    (newType: VehicleVisualType) => {
      saveVehicleVisualType(vehicleId, newType, vehicleInfo?.plate);
    },
    [vehicleId, vehicleInfo?.plate]
  );

  return {
    type: currentType,
    setType,
    meta: VEHICLE_VISUAL_TYPES[currentType],
  };
}
