import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TOURISM_COMPANY_ID, useTourismCompanyProfile } from "@/hooks/useTourismCompany";
import { useAuth } from "@/hooks/useAuth";

export interface GPSwoxVehicle {
  id: string;
  plate: string;
  imei: string;
  brand: string;
  model: string;
  status: "active" | "inactive" | "maintenance";
  lastPosition: {
    lat: number;
    lng: number;
    city: string;
    speed: number;
    altitude: number;
    course: number;
    timestamp: string;
    moveStatus?: string;
    stopDuration?: string;
  } | null;
  mileage: number;
  fuelQuantity: number | null;
  driver: string | null;
  driverDetails: {
    id: number;
    name: string;
    email: string;
    phone: string;
  } | null;
  iconId: number;
  online: string;
  // Additional data from GPSwox
  battery: number | null;
  network: number | null;
  protocol: string | null;
  distanceToday: number | null;
  distanceWeek: number | null;
  distanceMonth: number | null;
  sensors: Array<{
    id: number;
    name: string;
    type: string;
    value: string;
  }> | null;
}

export interface GPSwoxDriver {
  id: number | string;
  name: string;
  email: string;
  phone: string;
  deviceId: number | string | null;
  deviceName: string | null;
  rfid: string | null;
  description: string | null;
}

interface GPSwoxResponse {
  success: boolean;
  vehicles: GPSwoxVehicle[];
  drivers: GPSwoxDriver[];
  timestamp: string;
  error?: string;
}

async function fetchGPSwoxData(companyId: string): Promise<GPSwoxResponse> {
  const { data, error } = await supabase.functions.invoke<GPSwoxResponse>("gpswox", {
    body: { companyId },
  });

  if (error) {
    console.error("Error fetching GPSwox data:", error);
    throw new Error(error.message || "Failed to fetch data");
  }

  if (!data?.success) {
    throw new Error(data?.error || "Failed to fetch data");
  }

  return data;
}

export function useGPSwoxVehicles(refetchInterval = 30000) {
  const { data: companyProfile } = useTourismCompanyProfile();
  const { user } = useAuth();
  const companyId = companyProfile?.id || TOURISM_COMPANY_ID;

  return useQuery({
    queryKey: ["gpswox-vehicles", companyId, user?.id || "anonymous"],
    queryFn: async () => {
      const data = await fetchGPSwoxData(companyId);
      return data.vehicles;
    },
    enabled: !!user,
    refetchInterval, // Auto-refresh every 30 seconds by default
    staleTime: 10000, // Consider data stale after 10 seconds
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

export function useGPSwoxDrivers(refetchInterval = 30000) {
  const { data: companyProfile } = useTourismCompanyProfile();
  const { user } = useAuth();
  const companyId = companyProfile?.id || TOURISM_COMPANY_ID;

  return useQuery({
    queryKey: ["gpswox-drivers", companyId, user?.id || "anonymous"],
    queryFn: async () => {
      const data = await fetchGPSwoxData(companyId);
      return data.drivers;
    },
    enabled: !!user,
    refetchInterval,
    staleTime: 10000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

export function useGPSwoxData(refetchInterval = 30000) {
  const { data: companyProfile } = useTourismCompanyProfile();
  const { user } = useAuth();
  const companyId = companyProfile?.id || TOURISM_COMPANY_ID;

  return useQuery({
    queryKey: ["gpswox-data", companyId, user?.id || "anonymous"],
    queryFn: async () => await fetchGPSwoxData(companyId),
    enabled: !!user,
    refetchInterval,
    staleTime: 10000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
