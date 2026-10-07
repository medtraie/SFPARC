import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TOURISM_COMPANY_ID, useTourismCompanyProfile } from "@/hooks/useTourismCompany";
import { useAuth } from "@/hooks/useAuth";

export interface FleetSummary {
  total_vehicles: number;
  online: number;
  offline: number;
  idle: number;
  moving: number;
  total_speed: number;
  max_speed: number;
  max_speed_device: string;
  total_distance_today: number;
  total_distance_week: number;
  total_distance_month: number;
}

export interface VehicleReport {
  id: number;
  name: string;
  status: 'moving' | 'stopped' | 'offline';
  online: string;
  speed: number;
  lat: number | null;
  lng: number | null;
  altitude: number;
  course: number;
  last_update: string | null;
  timestamp: number | null;
  distance_today: number;
  distance_week: number;
  distance_month: number;
  odometer: number;
  battery: number | null;
  fuel: number | null;
  stop_duration_minutes: number;
  current_driver: any | null;
}

export interface OverspeedReport {
  device_id: number;
  device_name: string;
  speed: number;
  lat: number | null;
  lng: number | null;
  timestamp: string;
  severity: 'critical' | 'high' | 'medium';
}

export interface StoppedVehicle {
  device_id: number;
  device_name: string;
  stop_duration_minutes: number;
  stop_duration_formatted: string;
  lat: number | null;
  lng: number | null;
  last_update: string;
}

export interface FuelData {
  device_id: number;
  device_name: string;
  fuel_level: number;
  timestamp: string;
}

export interface GPSwoxReports {
  fleet_summary: FleetSummary;
  vehicles: VehicleReport[];
  overspeeds: OverspeedReport[];
  stopped_vehicles: StoppedVehicle[];
  offline_vehicles: { device_id: number; device_name: string; last_update: string; lat: number | null; lng: number | null }[];
  moving_vehicles: { device_id: number; device_name: string; speed: number; course: number; lat: number | null; lng: number | null; last_update: string }[];
  fuel_data: FuelData[];
}

interface GPSwoxReportsResponse {
  success: boolean;
  report_type: string;
  reports: GPSwoxReports;
  history: any | null;
  timestamp: string;
  error?: string;
}

async function fetchGPSwoxReports(companyId: string): Promise<GPSwoxReportsResponse> {
  const { data, error } = await supabase.functions.invoke<GPSwoxReportsResponse>("gpswox-reports", {
    body: { companyId }
  });

  if (error) {
    console.error("Error fetching GPSwox reports:", error);
    throw new Error(error.message || "Failed to fetch reports");
  }

  if (!data?.success) {
    throw new Error(data?.error || "Failed to fetch reports");
  }

  return data;
}

export function useGPSwoxReports(refetchInterval = 60000) {
  const { data: companyProfile } = useTourismCompanyProfile();
  const { user } = useAuth();
  const companyId = companyProfile?.id || TOURISM_COMPANY_ID;

  return useQuery({
    queryKey: ["gpswox-reports", companyId, user?.id || "anonymous"],
    queryFn: async () => await fetchGPSwoxReports(companyId),
    enabled: !!user,
    refetchInterval,
    staleTime: 30000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
