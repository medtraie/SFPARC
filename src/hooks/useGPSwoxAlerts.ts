import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TOURISM_COMPANY_ID, useTourismCompanyProfile } from "@/hooks/useTourismCompany";
import { useAuth } from "@/hooks/useAuth";

export interface GPSwoxAlert {
  id: string;
  type: 'speed' | 'geofence' | 'disconnect' | 'fuel' | 'maintenance';
  severity: 'high' | 'medium' | 'low';
  device_id: number | string;
  device_name: string;
  message: string;
  message_ar?: string;
  timestamp: string;
  lat: number | null;
  lng: number | null;
  speed?: number | null;
  acknowledged: boolean;
  raw?: any;
}

interface GPSwoxAlertsResponse {
  success: boolean;
  alerts: GPSwoxAlert[];
  source: string;
  total: number;
  timestamp: string;
  error?: string;
}

async function fetchGPSwoxAlerts(companyId: string): Promise<GPSwoxAlertsResponse> {
  const { data, error } = await supabase.functions.invoke<GPSwoxAlertsResponse>("gpswox-alerts", {
    body: { companyId },
  });

  if (error) {
    console.error("Error fetching GPSwox alerts:", error);
    throw new Error(error.message || "Failed to fetch alerts");
  }

  if (!data?.success) {
    throw new Error(data?.error || "Failed to fetch alerts");
  }

  return data;
}

export function useGPSwoxAlerts(refetchInterval = 60000) {
  const { data: companyProfile } = useTourismCompanyProfile();
  const { user } = useAuth();
  const companyId = companyProfile?.id || TOURISM_COMPANY_ID;

  return useQuery({
    queryKey: ["gpswox-alerts", companyId, user?.id || "anonymous"],
    queryFn: async () => await fetchGPSwoxAlerts(companyId),
    enabled: !!user,
    refetchInterval,
    staleTime: 30000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
