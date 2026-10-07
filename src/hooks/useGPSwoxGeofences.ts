import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TOURISM_COMPANY_ID, useTourismCompanyProfile } from "@/hooks/useTourismCompany";
import { useAuth } from "@/hooks/useAuth";

export interface GPSwoxGeofence {
  id: string;
  name: string;
  groupId: number;
  color: string;
  active: boolean;
}

interface GPSwoxGeofencesResponse {
  success: boolean;
  geofences: GPSwoxGeofence[];
  timestamp: string;
  error?: string;
}

async function fetchGPSwoxGeofences(companyId: string): Promise<GPSwoxGeofence[]> {
  const { data, error } = await supabase.functions.invoke<GPSwoxGeofencesResponse>("gpswox-geofences", {
    body: { companyId }
  });

  if (error) {
    console.error("Error fetching GPSwox geofences:", error);
    throw new Error(error.message || "Failed to fetch geofences");
  }

  if (!data?.success) {
    throw new Error(data?.error || "Failed to fetch geofences");
  }

  return data.geofences;
}

export function useGPSwoxGeofences() {
  const { data: companyProfile } = useTourismCompanyProfile();
  const { user } = useAuth();
  const companyId = companyProfile?.id || TOURISM_COMPANY_ID;

  return useQuery({
    queryKey: ["gpswox-geofences", companyId, user?.id || "anonymous"],
    queryFn: async () => await fetchGPSwoxGeofences(companyId),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes (geofences change rarely)
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
