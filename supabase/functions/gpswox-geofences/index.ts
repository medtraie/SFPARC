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

interface Geofence {
  id: number;
  name: string;
  group_id: number;
  polygon_color: string;
  active: boolean;
  coordinates?: string;
}

interface GeofenceGroup {
  id: number;
  title: string;
  items: Geofence[];
}

type GeofencesResponse = GeofenceGroup[] | {
  status?: number;
  items?: {
    geofences?: Geofence[];
  } | Geofence[];
  message?: string;
};

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

async function getGeofences(apiUrl: string, apiHash: string): Promise<Geofence[]> {
  console.log("Fetching geofences from GPSwox API...");
  const geofencesUrl = `${apiUrl}/get_geofences?user_api_hash=${apiHash}`;
  console.log("Geofences URL:", geofencesUrl);

  const response = await fetchWithRetry(geofencesUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  const responseText = await response.text();
  console.log("Geofences raw response:", responseText.substring(0, 500));
  
  let data: GeofencesResponse;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    console.error("Failed to parse geofences response as JSON");
    throw new Error("Invalid response format from geofences API");
  }
  
  // Handle array format (groups with items)
  if (Array.isArray(data)) {
    const allGeofences: Geofence[] = [];
    for (const group of data) {
      if (group.items && Array.isArray(group.items)) {
        allGeofences.push(...group.items);
      }
    }
    console.log("Extracted geofences from groups:", allGeofences.length);
    return allGeofences;
  }
  
  // Handle object format with nested items.geofences
  if (data.items && 'geofences' in data.items && Array.isArray(data.items.geofences)) {
    console.log("Extracted geofences from items.geofences:", data.items.geofences.length);
    return data.items.geofences;
  }
  
  // Handle object format with items as array
  if (data.items && Array.isArray(data.items)) {
    console.log("Geofences from items array:", data.items.length);
    return data.items;
  }
  
  // Handle object format with status
  console.log("Geofences response status:", data.status, "- trying to extract geofences");

  // Return empty array if we got here (unexpected format)
  console.log("Unexpected response format, returning empty array");
  return [];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Get or refresh API hash
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

    // Fetch geofences
    const geofences = await getGeofences(apiUrl, apiHash);

    // Transform to simplified format
    const formattedGeofences = geofences.map((geo) => ({
      id: String(geo.id),
      name: geo.name,
      groupId: geo.group_id,
      color: geo.polygon_color,
      active: geo.active,
    }));

    console.log(`Successfully fetched ${formattedGeofences.length} geofences`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        geofences: formattedGeofences,
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error("GPSwox Geofences API error:", error);
    
    // Clear cache on error to force re-login
    cachedApiHash = null;
    cacheExpiry = 0;

    const errorMessage = error instanceof Error ? error.message : "Failed to fetch geofences";

    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false,
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
