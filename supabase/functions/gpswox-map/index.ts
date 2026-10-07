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
  
  const response = await fetch(loginUrl, {
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

    // Construct the embedded map URL
    // GPSwox/TrackPremier provides a map endpoint that can be embedded
    // The base URL should be the main domain (without /api)
    const baseUrl = apiUrl.replace('/api', '');
    
    // Common GPSwox map URLs:
    // 1. Direct map with hash: /map?user_api_hash=XXX
    // 2. Embedded map: /embed/map?user_api_hash=XXX
    // 3. Public share: /share/map?hash=XXX
    
    const mapUrl = `${baseUrl}/map?user_api_hash=${apiHash}`;
    
    console.log("Generated map URL for embedding");

    return new Response(
      JSON.stringify({ 
        success: true, 
        mapUrl,
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error("GPSwox Map API error:", error);
    
    // Clear cache on error to force re-login
    cachedApiHash = null;
    cacheExpiry = 0;

    const errorMessage = error instanceof Error ? error.message : "Failed to get map URL";

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
