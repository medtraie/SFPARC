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

// Response can be either an array of groups or an object with items
interface DeviceGroup {
  id: number;
  title: string;
  items: Device[];
}

type DeviceResponse = DeviceGroup[] | {
  status: number;
  items?: Device[];
  message?: string;
};

interface Device {
  id: number;
  name: string;
  imei?: string;
  icon_type?: string;
  alarm?: number;
  online: string;
  time?: string;
  timestamp?: number;
  lat?: number;
  lng?: number;
  speed?: number;
  altitude?: number;
  course?: number;
  // Legacy format support
  device_data?: {
    lat: string;
    lng: string;
    altitude: string;
    speed: string;
    course: string;
    time: string;
    stop_duration?: string;
    move_status?: string;
  };
  fuel_quantity?: string;
  odometer?: number;
  // Additional device data
  power?: string;
  battery?: string;
  protocol?: string;
  // Distance data
  distance_today?: number;
  distance_week?: number;
  distance_month?: number;
  // Network/Signal
  gprs?: string;
  // Sensors
  sensors?: Array<{
    id: number;
    name: string;
    type: string;
    value: string;
    val?: string | number | boolean | null;
    tag_name?: string;
    scale_value?: number | null;
  }>;
  current_driver?: {
    id: number;
    name: string;
    email: string;
    phone: string;
  };
  current_driver_id?: number;
}

interface GPSwoxDriver {
  id: number | string;
  name: string;
  email?: string;
  phone?: string;
  device_id?: number | string;
  device_name?: string;
  rfid?: string;
  description?: string;
}

type DriversResponse = {
  status: number;
  items?: GPSwoxDriver[];
  message?: string;
} | GPSwoxDriver[];

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

// Utility function for fetch with retry and timeout
async function fetchWithRetry(
  url: string, 
  options: RequestInit = {}, 
  maxRetries = 3, 
  timeoutMs = 15000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`Fetch attempt ${attempt}/${maxRetries} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff: 1s, 2s, 4s)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
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
  console.log("Password length:", password?.length || 0);
  
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

async function getDevices(apiUrl: string, apiHash: string): Promise<Device[]> {
  console.log("Fetching devices from GPSwox API...");
  const devicesUrl = `${apiUrl}/get_devices?user_api_hash=${apiHash}`;
  console.log("Devices URL:", devicesUrl);

  const response = await fetchWithRetry(devicesUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  const responseText = await response.text();
  console.log("Devices raw response:", responseText.substring(0, 500));
  
  let data: DeviceResponse;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    console.error("Failed to parse devices response as JSON");
    throw new Error("Invalid response format from devices API");
  }
  
  // Handle array format (groups with items)
  if (Array.isArray(data)) {
    const allDevices: Device[] = [];
    for (const group of data) {
      if (group.items && Array.isArray(group.items)) {
        allDevices.push(...group.items);
      }
    }
    console.log("Extracted devices from groups:", allDevices.length);
    return allDevices;
  }
  
  // Handle object format with status
  console.log("Devices response status:", data.status, "- Count:", data.items?.length || 0);

  if (data.status !== 1) {
    throw new Error(data.message || "Failed to fetch devices");
  }

  return data.items || [];
}

// Global debug log to collect info during execution
let globalDebugLog: string[] = [];

async function getDrivers(apiUrl: string, apiHash: string): Promise<GPSwoxDriver[]> {
  globalDebugLog.push("Fetching drivers from GPSwox API...");
  
  // Try multiple possible endpoints for drivers
  const endpoints = [
    `${apiUrl}/get_drivers?user_api_hash=${apiHash}`,
    `${apiUrl}/drivers?user_api_hash=${apiHash}`,
    `${apiUrl}/driver/list?user_api_hash=${apiHash}`,
    `${apiUrl}/get_user_drivers?user_api_hash=${apiHash}`,
    // Try without /api if the base URL already included it or was different
    (apiUrl.endsWith('/api') ? apiUrl.slice(0, -4) : apiUrl) + `/get_drivers?user_api_hash=${apiHash}`,
  ];

  for (const driversUrl of endpoints) {
    globalDebugLog.push(`Trying drivers URL: ${driversUrl}`);
    
    try {
      const response = await fetchWithRetry(driversUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }, 1, 5000); // Only 1 retry with 5s timeout for each endpoint

      const responseText = await response.text();
      globalDebugLog.push(`Response start: ${responseText.substring(0, 150)}`);
      
      // Skip if we get a 404 response
      if (responseText.includes('"statusCode":404') || responseText.includes('not be found') || response.status === 404) {
        globalDebugLog.push("Endpoint not found (404)");
        continue;
      }
      
      let data: DriversResponse;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        globalDebugLog.push("Failed to parse JSON");
        continue;
      }
      
      // Handle array format
      if (Array.isArray(data)) {
        globalDebugLog.push(`Got array with ${data.length} items`);
        if (data.length > 0) return data;
        continue;
      }
      
      // Handle object format with status
      if (data.status === 1) {
        // Case 1: items is the array directly
        if (Array.isArray(data.items) && data.items.length > 0) {
          globalDebugLog.push(`Got object with status 1 and ${data.items.length} items`);
          return data.items;
        }
        
        // Case 2: Nested structure (common in get_user_drivers)
        // { items: { drivers: { data: [...] } } }
        if (data.items && (data.items as any).drivers && Array.isArray((data.items as any).drivers.data)) {
          const driversList = (data.items as any).drivers.data;
          globalDebugLog.push(`Got nested structure items.drivers.data with ${driversList.length} items`);
          if (driversList.length > 0) return driversList;
        }

        // Case 3: Another nested variation
        // { drivers: { data: [...] } }
        if ((data as any).drivers && Array.isArray((data as any).drivers.data)) {
          const driversList = (data as any).drivers.data;
          globalDebugLog.push(`Got nested structure drivers.data with ${driversList.length} items`);
          if (driversList.length > 0) return driversList;
        }
        
        globalDebugLog.push(`Got object with status 1 but undefined or empty items structure`);
        continue;
      } else {
        globalDebugLog.push(`Got object with status ${data.status} and message: ${data.message}`);
      }
      
    } catch (error) {
      globalDebugLog.push(`Endpoint failed: ${error}`);
      continue;
    }
  }
  
  globalDebugLog.push("No drivers endpoint found or all returned empty");
  return [];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    globalDebugLog = [];
    let requestBody: Record<string, unknown> = {};
    let companyId: string | null = null;
    try {
      requestBody = await req.json();
      if (requestBody && typeof requestBody.companyId === 'string' && requestBody.companyId.trim()) {
        companyId = requestBody.companyId.trim();
      }
    } catch {
      companyId = null;
      requestBody = {};
    }

    const testOnly = requestBody?.testOnly === true;
    const credentialsOverride =
      requestBody && typeof requestBody.credentialsOverride === 'object' && requestBody.credentialsOverride !== null
        ? (requestBody.credentialsOverride as Record<string, unknown>)
        : null;

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase environment is not configured");
    }
    const userId = await getRequestUserId(req, supabaseUrl, serviceRoleKey);
    const credentials = await loadGpsCredentials(userId, companyId);
    let apiUrl = credentialsOverride && typeof credentialsOverride.apiUrl === 'string'
      ? normalizeApiUrl(credentialsOverride.apiUrl)
      : credentials.apiUrl;
    const email =
      credentialsOverride && typeof credentialsOverride.email === 'string'
        ? credentialsOverride.email
        : credentials.email;
    const password =
      credentialsOverride && typeof credentialsOverride.password === 'string'
        ? credentialsOverride.password
        : credentials.password;

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

    if (testOnly) {
      return new Response(
        JSON.stringify({
          success: true,
          testOnly: true,
          connection: 'ok',
          credentialsSource: credentialsOverride ? 'override' : credentials.source,
          companyId,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Fetch devices and drivers in parallel
    // We catch getDrivers error to ensure we at least return devices if drivers fail
    let driverFetchError = null;
    const [devices, drivers] = await Promise.all([
      getDevices(apiUrl, apiHash),
      getDrivers(apiUrl, apiHash).catch(e => {
        console.error("Failed to fetch drivers (non-fatal):", e);
        driverFetchError = e.message;
        return [] as GPSwoxDriver[];
      }),
    ]);

    console.log(`Fetched ${devices.length} devices and ${drivers.length} drivers`);

    const effectiveDrivers = [...drivers];
    const driversFromDevicesCount = 0;
    
    if (effectiveDrivers.length === 0) {
      console.log("Drivers list empty, attempting to extract from devices...");
      const driverMap = new Map<string, GPSwoxDriver>();
      
      for (const device of devices) {
        const driverInfo = device.current_driver || (device as any).driver_data;
        
        if (driverInfo && (driverInfo.id || driverInfo.name)) {
          const rawName = typeof driverInfo.name === 'string' ? driverInfo.name.trim() : '';
          const dId = driverInfo.id ? String(driverInfo.id) : `name:${rawName.toLowerCase()}`;
          if (!driverMap.has(dId)) {
            driverMap.set(dId, {
              id: driverInfo.id ?? dId,
              name: rawName || 'Unknown',
              email: driverInfo.email || '',
              phone: typeof driverInfo.phone === 'string' ? driverInfo.phone.trim() : (driverInfo.phone || ''),
              device_id: device.id,
              device_name: device.name
            });
          }
        }
      }
      
      if (driverMap.size > 0) {
        console.log(`Extracted ${driverMap.size} drivers from devices`);
        effectiveDrivers.push(...driverMap.values());
      }
    }

    // Create a map of device_id to driver for quick lookup
    // Use string keys to handle both number and string IDs safely
    const driverByDeviceId = new Map<string, GPSwoxDriver>();
    const driverById = new Map<string, GPSwoxDriver>();
    
    for (const driver of effectiveDrivers) {
      driverById.set(String(driver.id), driver);
      if (driver.device_id) {
        driverByDeviceId.set(String(driver.device_id), driver);
      }
    }

    // Transform to our vehicle format
    const vehicles = devices.map((device) => {
      // Handle both new format (direct lat/lng) and legacy format (device_data object)
      const hasDirectPosition = device.lat !== undefined && device.lng !== undefined;
      const hasLegacyPosition = device.device_data !== undefined;
      
      const position = hasDirectPosition ? {
        lat: device.lat || 0,
        lng: device.lng || 0,
        city: `${device.lat}, ${device.lng}`,
        speed: device.speed || 0,
        altitude: device.altitude || 0,
        course: device.course || 0,
        timestamp: device.time,
      } : hasLegacyPosition ? {
        lat: parseFloat(device.device_data!.lat) || 0,
        lng: parseFloat(device.device_data!.lng) || 0,
        city: `${device.device_data!.lat}, ${device.device_data!.lng}`,
        speed: parseFloat(device.device_data!.speed) || 0,
        altitude: parseFloat(device.device_data!.altitude) || 0,
        course: parseFloat(device.device_data!.course) || 0,
        timestamp: device.device_data!.time,
        moveStatus: device.device_data!.move_status,
        stopDuration: device.device_data!.stop_duration,
      } : null;

      // Determine status based on online field
      const status = device.online === "online" ? "active" : 
                     device.online === "offline" ? "inactive" : "maintenance";

      // Extract data from sensors array
      let batteryLevel: number | null = null;
      let networkLevel: number | null = null;
      let odometerFromSensor: number | null = null;
      let fuelFromSensor: number | null = null;
      
      if (device.sensors && Array.isArray(device.sensors)) {
        for (const sensor of device.sensors) {
          // Use 'val' field (numeric) from sensor, not 'value' (formatted string)
          const sensorVal = sensor.val;
          const sensorType = sensor.type?.toLowerCase() || '';
          const sensorName = sensor.name?.toLowerCase() || '';
          
          // Skip if val is null, undefined, or boolean
          if (sensorVal === null || sensorVal === undefined || typeof sensorVal === 'boolean') {
            continue;
          }
          
          const numericVal = typeof sensorVal === 'string' ? parseFloat(sensorVal) : sensorVal;
          
          // Battery sensor
          if (sensorType === 'battery') {
            batteryLevel = numericVal;
          }
          // Network/GSM sensor
          if (sensorType === 'gsm') {
            networkLevel = numericVal;
          }
          // Odometer sensor
          if (sensorType === 'odometer') {
            odometerFromSensor = numericVal;
          }
          // Fuel sensor - check multiple types and names
          if (sensorType === 'fuel' || sensorType === 'fuel_tank' || sensorType === 'fuel_tank_calibration' ||
              sensorName.includes('fuel') || sensorName.includes('carburant') || 
              sensorName.includes('tank') || sensorName.includes('réservoir')) {
            fuelFromSensor = numericVal;
          }
        }
      }
      
      // Use fuel from sensor if direct fuel_quantity is not available
      const finalFuelQuantity = device.fuel_quantity ? parseFloat(device.fuel_quantity) : fuelFromSensor;
      
      // Use odometer from sensor if direct odometer is not available
      const finalOdometer = device.odometer || odometerFromSensor || 0;
      
      // Find driver for this device - check multiple sources
      let driverDetails = device.current_driver || (device as any).driver_data || null;
      
      // If no current_driver, check by device_id mapping
      if (!driverDetails) {
        const mappedDriver = driverByDeviceId.get(String(device.id));
        if (mappedDriver) {
          driverDetails = {
            id: mappedDriver.id,
            name: mappedDriver.name,
            email: mappedDriver.email || '',
            phone: mappedDriver.phone || '',
          };
        }
      }
      
      // If still no driver and we have current_driver_id, look it up
      if (!driverDetails && device.current_driver_id) {
        const driver = driverById.get(String(device.current_driver_id));
        if (driver) {
          driverDetails = {
            id: driver.id,
            name: driver.name,
            email: driver.email || '',
            phone: driver.phone || '',
          };
        }
      }
      
      return {
        id: String(device.id),
        plate: device.name,
        imei: device.imei || "",
        brand: "GPS Device",
        model: device.name,
        status,
        lastPosition: position,
        mileage: finalOdometer,
        fuelQuantity: finalFuelQuantity,
        driver: driverDetails?.name || null,
        driverDetails,
        iconType: device.icon_type,
        online: device.online,
        // Additional data - prioritize sensor data
        battery: batteryLevel,
        network: networkLevel,
        protocol: device.protocol || null,
        distanceToday: device.distance_today || null,
        distanceWeek: device.distance_week || null,
        distanceMonth: device.distance_month || null,
        sensors: device.sensors || null,
      };
    });

    console.log(`Successfully transformed ${vehicles.length} vehicles`);

    // Return both vehicles and drivers list
    return new Response(
      JSON.stringify({ 
        success: true, 
        vehicles,
        drivers: effectiveDrivers.map(d => ({
          id: d.id,
          name: d.name,
          email: d.email || '',
          phone: d.phone || '',
          deviceId: d.device_id || null,
          deviceName: d.device_name || null,
          rfid: d.rfid || null,
          description: d.description || null,
        })),
        debug: {
          driverFetchError,
          credentialsSource: credentials.source,
          companyId,
          driversSource: drivers.length > 0 ? 'api' : 'devices_fallback',
          extractedCount: effectiveDrivers.length,
          logs: globalDebugLog,
          firstVehicleSample: devices.length > 0 ? {
            id: devices[0].id,
            current_driver: devices[0].current_driver,
            current_driver_id: devices[0].current_driver_id,
            driver_data: (devices[0] as any).driver_data // Check if this field exists
          } : null
        },
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error("GPSwox API error:", error);

    apiHashCache.clear();

    const errorMessage = error instanceof Error ? error.message : "Failed to fetch vehicle data";
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const errorStack = error instanceof Error ? (error.stack || '') : '';

    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false,
        technical: {
          name: errorName,
          message: errorMessage,
          stack: errorStack.slice(0, 3000),
          logs: globalDebugLog.slice(-40),
        },
      }),
      { 
        status: 200, // Return 200 to allow client to read the error message
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
