import { GPSwoxVehicle } from '@/hooks/useGPSwoxVehicles';
import { VehicleReport } from '@/hooks/useGPSwoxReports';

/**
 * Extracts a numeric value from any GPSwox sensor structure
 * Handles: val, value ("124,530 km", "124 530", etc.), data, string or number.
 */
export function parseSensorNumber(s: any): number | null {
  if (!s) return null;

  // 1. Direct numeric 'val'
  if (typeof s.val === 'number' && !isNaN(s.val)) {
    return s.val;
  }

  // 2. String 'val'
  if (typeof s.val === 'string' && s.val.trim().length > 0) {
    const raw = s.val.trim();
    let clean = raw.replace(/\s/g, '');
    if (clean.includes(',') && clean.includes('.')) {
      clean = clean.replace(/,/g, '');
    } else if (/,\d{3}($|\D)/.test(clean)) {
      clean = clean.replace(/,/g, '');
    } else {
      clean = clean.replace(/,/g, '.');
    }
    const match = clean.match(/-?\d+(\.\d+)?/);
    if (match) {
      const n = parseFloat(match[0]);
      if (!isNaN(n)) return n;
    }
  }

  // 3. String or number 'value' (often formatted in GPSwox like "145,230.5 km" or "145 230 km")
  if (s.value !== null && s.value !== undefined) {
    if (typeof s.value === 'number' && !isNaN(s.value)) return s.value;
    const strVal = String(s.value).trim();
    if (strVal.length > 0) {
      let clean = strVal.replace(/\s/g, '');
      if (clean.includes(',') && clean.includes('.')) {
        clean = clean.replace(/,/g, '');
      } else if (/,\d{3}($|\D)/.test(clean)) {
        clean = clean.replace(/,/g, '');
      } else {
        clean = clean.replace(/,/g, '.');
      }
      const match = clean.match(/-?\d+(\.\d+)?/);
      if (match) {
        const n = parseFloat(match[0]);
        if (!isNaN(n)) return n;
      }
    }
  }

  // 4. 'data' field fallback
  if (s.data !== null && s.data !== undefined) {
    if (typeof s.data === 'number' && !isNaN(s.data)) return s.data;
    const clean = String(s.data).replace(/\s/g, '').replace(/,/g, '').trim();
    const match = clean.match(/-?\d+(\.\d+)?/);
    if (match) {
      const n = parseFloat(match[0]);
      if (!isNaN(n)) return n;
    }
  }

  return null;
}

/**
 * Extracts real Odometer (Kilométrage) for a vehicle.
 * Checks vehicle.mileage, matching report.odometer, device attributes, and vehicle.sensors.
 */
export function extractVehicleOdometer(
  vehicle: GPSwoxVehicle,
  report?: VehicleReport | null
): number {
  // 1. Direct mileage if already valid > 0
  if (typeof vehicle.mileage === 'number' && vehicle.mileage > 0) {
    return vehicle.mileage;
  }

  // 2. Report odometer if available
  if (report && typeof report.odometer === 'number' && report.odometer > 0) {
    return report.odometer;
  }

  // 3. Check extra device properties
  const anyVeh = vehicle as any;
  if (typeof anyVeh.odometer === 'number' && anyVeh.odometer > 0) {
    return anyVeh.odometer;
  }
  if (typeof anyVeh.total_distance === 'number' && anyVeh.total_distance > 0) {
    return anyVeh.total_distance;
  }
  if (anyVeh.device_data) {
    if (typeof anyVeh.device_data.odometer === 'number' && anyVeh.device_data.odometer > 0) {
      return anyVeh.device_data.odometer;
    }
    if (typeof anyVeh.device_data.total_distance === 'number' && anyVeh.device_data.total_distance > 0) {
      return anyVeh.device_data.total_distance;
    }
  }

  // 4. Search in sensors array
  if (vehicle.sensors && Array.isArray(vehicle.sensors)) {
    for (const sensor of vehicle.sensors) {
      const type = (sensor.type || '').toLowerCase();
      const name = (sensor.name || '').toLowerCase();

      // Check if sensor is an odometer / km sensor
      const isOdometer =
        type === 'odometer' ||
        type === 'distance' ||
        name.includes('odomet') ||
        name.includes('kilom') ||
        name.includes('compteur') ||
        name.includes('total distance') ||
        name.includes('total_distance') ||
        name.includes('km total') ||
        name.includes('total km') ||
        name.includes('mileage') ||
        name.includes('odo') ||
        (name.trim() === 'km' && !name.includes('jour'));

      if (isOdometer) {
        const val = parseSensorNumber(sensor);
        if (val !== null && val > 0) {
          return val;
        }
      }
    }
  }

  // Fallback to vehicle.mileage or 0
  return vehicle.mileage || 0;
}

/**
 * Extracts Daily Distance (Distance Jour) for a vehicle.
 * Checks vehicle.distanceToday, report.distance_today, device properties, and vehicle.sensors.
 */
export function extractVehicleDistanceToday(
  vehicle: GPSwoxVehicle,
  report?: VehicleReport | null
): number {
  // 1. Direct distanceToday if available and > 0
  if (typeof vehicle.distanceToday === 'number' && vehicle.distanceToday > 0) {
    return vehicle.distanceToday;
  }

  // 2. Check report distance_today
  if (report && typeof report.distance_today === 'number' && report.distance_today > 0) {
    return report.distance_today;
  }

  // 3. Check extra device properties
  const anyVeh = vehicle as any;
  if (typeof anyVeh.distance_today === 'number' && anyVeh.distance_today > 0) {
    return anyVeh.distance_today;
  }
  if (typeof anyVeh.today_distance === 'number' && anyVeh.today_distance > 0) {
    return anyVeh.today_distance;
  }
  if (anyVeh.device_data) {
    if (typeof anyVeh.device_data.distance_today === 'number' && anyVeh.device_data.distance_today > 0) {
      return anyVeh.device_data.distance_today;
    }
    if (typeof anyVeh.device_data.today_distance === 'number' && anyVeh.device_data.today_distance > 0) {
      return anyVeh.device_data.today_distance;
    }
  }

  // 4. Search in sensors array for daily / today / trip sensors
  if (vehicle.sensors && Array.isArray(vehicle.sensors)) {
    for (const sensor of vehicle.sensors) {
      const type = (sensor.type || '').toLowerCase();
      const name = (sensor.name || '').toLowerCase();

      const isDailyDistance =
        type === 'distance_today' ||
        type === 'today_distance' ||
        type === 'trip' ||
        type === 'daily' ||
        name.includes('jour') ||
        name.includes('today') ||
        name.includes('trip') ||
        name.includes('quotidien') ||
        name.includes('trajet') ||
        name.includes('parcours') ||
        name.includes('daily');

      if (isDailyDistance) {
        const val = parseSensorNumber(sensor);
        if (val !== null && val >= 0) {
          return val;
        }
      }
    }
  }

  return vehicle.distanceToday || 0;
}

/**
 * Gets the date key for daily tracking (YYYY-MM-DD)
 */
function getTodayDateKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Extracts and tracks the Max Speed (Vitesse Max) achieved today.
 * Combines current speed, overspeed records from reports, and persisted daily peak speed.
 */
export function extractVehicleMaxSpeed(
  vehicle: GPSwoxVehicle,
  report?: VehicleReport | null,
  highestOverspeedToday: number = 0
): number {
  highestOverspeedToday = Math.max(highestOverspeedToday, vehicle.topSpeedToday || 0);
  const currentSpeed = vehicle.lastPosition?.speed || 0;
  const todayKey = getTodayDateKey();
  const storageKey = `sftm_vmax_${todayKey}_${vehicle.id}`;

  let storedMax = 0;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) storedMax = parseFloat(raw) || 0;
  } catch {
    // ignore
  }

  // Sensor max speed search
  let sensorMax = 0;
  if (vehicle.sensors && Array.isArray(vehicle.sensors)) {
    for (const sensor of vehicle.sensors) {
      const type = (sensor.type || '').toLowerCase();
      const name = (sensor.name || '').toLowerCase();
      if (
        type === 'max_speed' ||
        type === 'top_speed' ||
        name.includes('vitesse max') ||
        name.includes('max speed') ||
        name.includes('top speed')
      ) {
        const val = parseSensorNumber(sensor);
        if (val !== null && val > sensorMax) {
          sensorMax = val;
        }
      }
    }
  }

  // Determine today's overall max
  const overallMax = Math.max(
    currentSpeed,
    storedMax,
    highestOverspeedToday,
    sensorMax,
    report?.speed || 0
  );

  // Persist if new high score today
  if (overallMax > storedMax) {
    try {
      localStorage.setItem(storageKey, String(overallMax));
    } catch {
      // ignore
    }
  }

  return overallMax;
}
