import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LoginResponse {
  status: number;
  user_api_hash?: string;
  message?: string;
}

// Cache for API hash to avoid repeated logins
const apiHashCache = new Map<string, { hash: string; expiresAt: number }>();

type GpsCredentials = {
  apiUrl: string;
  email: string;
  password: string;
  source: 'company' | 'global' | 'env';
};

function normalizeApiUrl(rawApiUrl: string) {
  let apiUrl = rawApiUrl.trim();
  if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
    apiUrl = 'http://' + apiUrl;
  }
  apiUrl = apiUrl.replace(/\/$/, '');
  if (!apiUrl.endsWith('/api')) {
    apiUrl = apiUrl + '/api';
  }
  return apiUrl;
}

async function getRequestUserId(req: Request, supabaseUrl: string, serviceRoleKey: string): Promise<string> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    throw new Error("Unauthorized");
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) {
    throw new Error("Unauthorized");
  }
  return data.user.id;
}

async function loadGpsCredentials(userId: string, companyId?: string | null): Promise<GpsCredentials> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (supabaseUrl && serviceRoleKey) {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const keysToTry = [companyId ? `gpswox_credentials:${companyId}` : null, 'gpswox_credentials'].filter(Boolean) as string[];
    for (const key of keysToTry) {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', key)
        .eq('user_id', userId)
        .maybeSingle();
      const value = (data?.value || {}) as Record<string, unknown>;
      const apiUrlFromDb = typeof value.apiUrl === 'string' ? value.apiUrl : typeof value.api_url === 'string' ? value.api_url : '';
      const emailFromDb = typeof value.email === 'string' ? value.email : '';
      const passwordFromDb = typeof value.password === 'string' ? value.password : '';
      if (apiUrlFromDb && emailFromDb && passwordFromDb) {
        return {
          apiUrl: normalizeApiUrl(apiUrlFromDb),
          email: emailFromDb,
          password: passwordFromDb,
          source: key.startsWith('gpswox_credentials:') ? 'company' : 'global',
        };
      }
    }
  }

  throw new Error("GPSwox credentials not configured for this user");
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
  timeoutMs = 20000
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt - 1), 5000)));
      }
    }
  }
  throw lastError || new Error("All fetch attempts failed");
}

async function getApiHash(apiUrl: string, email: string, password: string): Promise<string> {
  const cacheKey = `${apiUrl}|${email}|${password}`;
  const cached = apiHashCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    console.log("Using cached API hash");
    return cached.hash;
  }

  // Log email for debugging (masked)
  const maskedEmail = email ? `${email.substring(0, 3)}***@${email.split('@')[1] || '???'}` : 'EMPTY';
  console.log("Logging in to GPSwox API with email:", maskedEmail);
  
  const loginUrl = `${apiUrl}/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  
  const response = await fetchWithRetry(loginUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  const responseText = await response.text();
  let data: LoginResponse;
  try {
    data = JSON.parse(responseText) as LoginResponse;
  } catch {
    throw new Error(`Login parse error (HTTP ${response.status}): ${responseText.slice(0, 400)}`);
  }
  console.log("Login response status:", data.status);

  if (data.status !== 1 || !data.user_api_hash) {
    throw new Error(
      `Login failed (HTTP ${response.status}, API status ${data.status}): ${data.message || responseText.slice(0, 400)}`
    );
  }

  apiHashCache.set(cacheKey, {
    hash: data.user_api_hash,
    expiresAt: Date.now() + (60 * 60 * 1000),
  });

  return data.user_api_hash;
}

// Fetch devices data for building reports from live data
async function getDevices(apiUrl: string, apiHash: string): Promise<any[]> {
  const devicesUrl = `${apiUrl}/get_devices?user_api_hash=${apiHash}`;
  const response = await fetchWithRetry(devicesUrl, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }

  if (Array.isArray(data)) {
    const allDevices: any[] = [];
    for (const group of data) {
      if (group.items && Array.isArray(group.items)) {
        allDevices.push(...group.items);
      }
    }
    return allDevices;
  }

  return data.items || [];
}

function normalizeDateValue(value: string, isEnd: boolean): string {
  if (!value) return '';
  if (value.includes(' ')) return value;
  return `${value} ${isEnd ? '23:59:59' : '00:00:00'}`;
}

function extractHistoryPayload(data: any): any[] | null {
  if (!data) return null;
  if (Array.isArray(data)) return data;

  if (data.items) {
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.items.items)) return data.items.items;
    if (Array.isArray(data.items.data)) return data.items.data;
    if (Array.isArray(data.items.history)) return data.items.history;
  }

  if (data.data) {
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.data.items)) return data.data.items;
    if (Array.isArray(data.data.history)) return data.data.history;
  }

  if (data.history) {
    if (Array.isArray(data.history)) return data.history;
    if (Array.isArray(data.history.items)) return data.history.items;
    if (Array.isArray(data.history.data)) return data.history.data;
  }

  if (data.result) {
    if (Array.isArray(data.result)) return data.result;
    if (Array.isArray(data.result.items)) return data.result.items;
  }

  return null;
}

// Try fetching history/reports from GPSwox API
async function getDeviceHistory(apiUrl: string, apiHash: string, deviceId: number, dateFrom: string, dateTo: string): Promise<any> {
  const fromCandidates = Array.from(new Set([dateFrom, dateFrom.split(' ')[0]]));
  const toCandidates = Array.from(new Set([dateTo, dateTo.split(' ')[0]]));
  const endpoints: string[] = [];

  for (const fromVal of fromCandidates) {
    for (const toVal of toCandidates) {
      endpoints.push(
        `${apiUrl}/get_history?user_api_hash=${apiHash}&device_id=${deviceId}&from_date=${encodeURIComponent(fromVal)}&to_date=${encodeURIComponent(toVal)}`,
        `${apiUrl}/get_history?user_api_hash=${apiHash}&device_id=${deviceId}&from=${encodeURIComponent(fromVal)}&to=${encodeURIComponent(toVal)}`,
        `${apiUrl}/history?user_api_hash=${apiHash}&device_id=${deviceId}&from=${encodeURIComponent(fromVal)}&to=${encodeURIComponent(toVal)}`,
        `${apiUrl}/history?user_api_hash=${apiHash}&device_id=${deviceId}&from_date=${encodeURIComponent(fromVal)}&to_date=${encodeURIComponent(toVal)}`,
        `${apiUrl}/get_history/${deviceId}?user_api_hash=${apiHash}&from_date=${encodeURIComponent(fromVal)}&to_date=${encodeURIComponent(toVal)}`,
      );
    }
  }

  for (const url of endpoints) {
    try {
      const response = await fetchWithRetry(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      }, 1, 15000);

      const text = await response.text();
      if (text.includes('"statusCode":404') || text.includes('not be found')) continue;
      
      const data = JSON.parse(text);
      const extracted = extractHistoryPayload(data);
      if (extracted) {
        return extracted;
      }
    } catch {
      continue;
    }
  }
  return null;
}

// Helper to calculate distance between two points
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

// Calculate daily stats from history items
function calculateDailyStats(items: any[]): Record<string, { distance: number; fuel: number }> {
  const stats: Record<string, { distance: number; fuel: number }> = {};
  
  if (!items || !Array.isArray(items) || items.length === 0) return stats;

  // Sort by time just in case
  items.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  let prevItem: any = null;
  let prevFuel: number | null = null;

  for (const item of items) {
    // Extract date (YYYY-MM-DD)
    let dateStr = '';
    if (item.time) {
      dateStr = item.time.split(' ')[0];
    } else if (item.raw_time) {
      dateStr = item.raw_time.split(' ')[0];
    } else if (item.timestamp) {
      dateStr = new Date(item.timestamp * 1000).toISOString().split('T')[0];
    }

    if (!dateStr) continue;

    if (!stats[dateStr]) {
      stats[dateStr] = { distance: 0, fuel: 0 };
    }

    // Distance calculation
    let dist = 0;
    if (item.distance !== undefined && item.distance !== null) {
      dist = parseFloat(item.distance);
    } else if (prevItem && item.lat && item.lng && prevItem.lat && prevItem.lng) {
      dist = getDistanceFromLatLonInKm(prevItem.lat, prevItem.lng, item.lat, item.lng);
    }
    stats[dateStr].distance += dist;

    // Fuel calculation
    let currentFuel: number | null = null;
    if (item.sensors && Array.isArray(item.sensors)) {
      for (const sensor of item.sensors) {
        if ((sensor.type === 'fuel' || sensor.type === 'fuel_tank' || (sensor.name || '').toLowerCase().includes('fuel')) && sensor.val) {
          currentFuel = parseFloat(sensor.val);
          break;
        }
      }
    }

    if (prevFuel !== null && currentFuel !== null) {
      // Only count consumption (decrease in fuel)
      // Ignore small fluctuations or refills (increase)
      const diff = prevFuel - currentFuel;
      if (diff > 0) {
        stats[dateStr].fuel += diff;
      }
    }

    prevItem = item;
    if (currentFuel !== null) prevFuel = currentFuel;
  }

  return stats;
}

// Build comprehensive reports from device data
function buildReportsFromDevices(devices: any[]): any {
  const now = new Date();
  const reports: any = {
    fleet_summary: {
      total_vehicles: devices.length,
      online: 0,
      offline: 0,
      idle: 0,
      moving: 0,
      total_speed: 0,
      max_speed: 0,
      max_speed_device: '',
      total_distance_today: 0,
      total_distance_week: 0,
      total_distance_month: 0,
    },
    vehicles: [],
    overspeeds: [],
    stopped_vehicles: [],
    offline_vehicles: [],
    moving_vehicles: [],
    fuel_data: [],
  };

  for (const device of devices) {
    const isOnline = device.online === 'online';
    const isAck = device.online === 'ack';
    const isOffline = device.online === 'offline';
    const speed = device.speed || 0;
    const isMoving = speed > 2;

    if (isOnline) reports.fleet_summary.online++;
    else if (isOffline) reports.fleet_summary.offline++;
    
    if (isAck || (!isMoving && !isOffline)) reports.fleet_summary.idle++;
    if (isMoving) reports.fleet_summary.moving++;

    reports.fleet_summary.total_speed += speed;
    if (speed > reports.fleet_summary.max_speed) {
      reports.fleet_summary.max_speed = speed;
      reports.fleet_summary.max_speed_device = device.name;
    }

    reports.fleet_summary.total_distance_today += device.distance_today || 0;
    reports.fleet_summary.total_distance_week += device.distance_week || 0;
    reports.fleet_summary.total_distance_month += device.distance_month || 0;

    // Extract sensor data
    let battery: number | null = null;
    let fuel: number | null = null;
    if (device.sensors && Array.isArray(device.sensors)) {
      for (const sensor of device.sensors) {
        const val = sensor.val;
        if (val === null || val === undefined || typeof val === 'boolean') continue;
        const numVal = typeof val === 'string' ? parseFloat(val) : val;
        if (sensor.type === 'battery') battery = numVal;
        if (sensor.type === 'fuel' || sensor.type === 'fuel_tank' || sensor.type === 'fuel_tank_calibration' ||
            (sensor.name || '').toLowerCase().includes('fuel') || (sensor.name || '').toLowerCase().includes('carburant')) {
          fuel = numVal;
        }
      }
    }

    // Calculate stop duration
    let stopDurationMinutes = 0;
    if ((isAck || !isMoving) && device.timestamp) {
      const deviceTime = new Date(device.timestamp * 1000);
      stopDurationMinutes = Math.round((now.getTime() - deviceTime.getTime()) / (1000 * 60));
    }

    const vehicleReport = {
      id: device.id,
      name: device.name,
      status: isMoving ? 'moving' : isOffline ? 'offline' : 'stopped',
      online: device.online,
      speed,
      lat: device.lat || null,
      lng: device.lng || null,
      altitude: device.altitude || 0,
      course: device.course || 0,
      last_update: device.time || null,
      timestamp: device.timestamp || null,
      distance_today: device.distance_today || 0,
      distance_week: device.distance_week || 0,
      distance_month: device.distance_month || 0,
      odometer: device.odometer || 0,
      battery,
      fuel,
      stop_duration_minutes: stopDurationMinutes,
      current_driver: device.current_driver || null,
    };

    reports.vehicles.push(vehicleReport);

    // Overspeed report
    if (speed > 80) {
      reports.overspeeds.push({
        device_id: device.id,
        device_name: device.name,
        speed,
        lat: device.lat,
        lng: device.lng,
        timestamp: device.time,
        severity: speed > 120 ? 'critical' : speed > 100 ? 'high' : 'medium',
      });
    }

    // Stopped vehicles
    if (stopDurationMinutes > 30 && !isOffline) {
      reports.stopped_vehicles.push({
        device_id: device.id,
        device_name: device.name,
        stop_duration_minutes: stopDurationMinutes,
        stop_duration_formatted: stopDurationMinutes >= 60 
          ? `${Math.floor(stopDurationMinutes / 60)}h ${stopDurationMinutes % 60}min`
          : `${stopDurationMinutes}min`,
        lat: device.lat,
        lng: device.lng,
        last_update: device.time,
      });
    }

    // Offline vehicles
    if (isOffline) {
      reports.offline_vehicles.push({
        device_id: device.id,
        device_name: device.name,
        last_update: device.time,
        lat: device.lat,
        lng: device.lng,
      });
    }

    // Moving vehicles
    if (isMoving) {
      reports.moving_vehicles.push({
        device_id: device.id,
        device_name: device.name,
        speed,
        course: device.course || 0,
        lat: device.lat,
        lng: device.lng,
        last_update: device.time,
      });
    }

    // Fuel data
    if (fuel !== null) {
      reports.fuel_data.push({
        device_id: device.id,
        device_name: device.name,
        fuel_level: fuel,
        timestamp: device.time,
      });
    }
  }

  // Sort overspeeds by speed desc
  reports.overspeeds.sort((a: any, b: any) => b.speed - a.speed);
  // Sort stopped by duration desc
  reports.stopped_vehicles.sort((a: any, b: any) => b.stop_duration_minutes - a.stop_duration_minutes);

  return reports;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let requestBody: Record<string, unknown> = {};
    let companyId: string | null = null;
    
    // Parse request params
    let reportType = 'summary';
    let deviceId: number | null = null;
    let dateFrom = '';
    let dateTo = '';

    // Try parsing from URL first
    try {
      const url = new URL(req.url);
      if (url.searchParams.has('type')) reportType = url.searchParams.get('type') || 'summary';
      if (url.searchParams.has('device_id')) deviceId = parseInt(url.searchParams.get('device_id')!);
      if (url.searchParams.has('date_from')) dateFrom = url.searchParams.get('date_from') || '';
      if (url.searchParams.has('date_to')) dateTo = url.searchParams.get('date_to') || '';
      if (url.searchParams.has('companyId')) companyId = url.searchParams.get('companyId');
    } catch {}

    // If not found in URL and it's a POST, try parsing body
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.type) reportType = body.type;
        if (body.device_id) deviceId = body.device_id;
        if (body.date_from) dateFrom = body.date_from;
        if (body.date_to) dateTo = body.date_to;
        if (body.companyId) companyId = body.companyId;
      } catch (e) {
        // Body might be empty or not JSON, ignore
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase environment is not configured");
    }
    const userId = await getRequestUserId(req, supabaseUrl, serviceRoleKey);
    const credentials = await loadGpsCredentials(userId, companyId);
    let apiUrl = credentials.apiUrl;
    const email = credentials.email;
    const password = credentials.password;

    console.log("Using API URL:", apiUrl, "source:", credentials.source, "companyId:", companyId || "default");

    let apiHash: string;
    try {
      apiHash = await getApiHash(apiUrl, email, password);
    } catch (e) {
      if (apiUrl.startsWith('http://')) {
        const httpsUrl = apiUrl.replace('http://', 'https://');
        console.log("Retrying login over HTTPS");
        apiHash = await getApiHash(httpsUrl, email, password);
        apiUrl = httpsUrl;
      } else if (apiUrl.startsWith('https://')) {
        const httpUrl = apiUrl.replace('https://', 'http://');
        console.log("Retrying login over HTTP");
        apiHash = await getApiHash(httpUrl, email, password);
        apiUrl = httpUrl;
      } else {
        throw e;
      }
    }

    dateFrom = normalizeDateValue(dateFrom, false);
    dateTo = normalizeDateValue(dateTo, true);

    // Always get current device data
    const devices = await getDevices(apiUrl, apiHash);
    console.log(`Fetched ${devices.length} devices for reports`);

    const reports = buildReportsFromDevices(devices);

    // If requesting history for a specific device
    let history = null;
    let dailyStats: Record<string, Record<string, { distance: number; fuel: number }>> = {};

    if (reportType === 'history' && deviceId && dateFrom && dateTo) {
      history = await getDeviceHistory(apiUrl, apiHash, deviceId, dateFrom, dateTo);
    } else if (reportType === 'daily_stats' && dateFrom && dateTo) {
      // Limit concurrency to avoid overloading API
      const BATCH_SIZE = 5;
      const deviceIds = devices.map(d => d.id);
      
      for (let i = 0; i < deviceIds.length; i += BATCH_SIZE) {
        const batch = deviceIds.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (id) => {
          try {
            const hist = await getDeviceHistory(apiUrl, apiHash, id, dateFrom, dateTo);
            if (hist) {
              const stats = calculateDailyStats(hist);
              // Merge into main stats object: { date: { deviceId: stats } }
              Object.entries(stats).forEach(([date, val]) => {
                if (!dailyStats[date]) dailyStats[date] = {};
                dailyStats[date][id] = val;
              });
            }
          } catch (e) {
            console.error(`Error fetching history for device ${id}:`, e);
          }
        });
        await Promise.all(promises);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        report_type: reportType,
        reports,
        history,
        daily_stats: dailyStats,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
