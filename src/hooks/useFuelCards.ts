import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface FuelCardSnapshot {
  vehicle_id: string;
  card_id: string;
  month_start: string;
  initial_amount_mad: number;
  spent_amount_mad: number;
  remaining_amount_mad: number;
  consumed_liters_est: number;
  remaining_liters_est: number;
}

export interface FuelCardSetting {
  id: string;
  monthly_amount_mad: number;
  is_active: boolean;
  updated_by: string | null;
  updated_at: string;
}

export interface FuelCardVehicleControl {
  vehicle_id: string;
  is_enabled: boolean;
  updated_by: string | null;
  updated_at: string;
}

export interface FuelCardReportRow {
  vehicle_id: string;
  month_start: string;
  consumed_mad: number;
  consumed_liters: number;
  remaining_mad: number;
  remaining_liters_est: number;
}

export interface FuelCardVehicleAmount {
  vehicle_id: string;
  monthly_amount_mad: number;
  updated_by: string | null;
  updated_at: string;
}

const FUEL_CARD_SNAPSHOT_KEY = ['fuel-card-snapshot'];
const FUEL_CARD_SETTINGS_KEY = ['fuel-card-settings'];
const FUEL_CARD_CONTROLS_KEY = ['fuel-card-controls'];
const FUEL_CARD_REPORT_KEY = ['fuel-card-report'];
const FUEL_CARD_AMOUNT_KEY = ['fuel-card-vehicle-amount'];

async function fetchFuelCardSettings(): Promise<FuelCardSetting[]> {
  const { data, error } = await supabase
    .from('fuel_card_settings')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data || []) as FuelCardSetting[];
}

async function fetchFuelCardSnapshot(vehicleIds: string[]): Promise<FuelCardSnapshot[]> {
  if (vehicleIds.length === 0) return [];
  const { data, error } = await supabase.rpc('get_vehicle_card_snapshot', {
    p_vehicle_ids: vehicleIds,
  });

  if (error) throw error;
  return (data || []) as FuelCardSnapshot[];
}

async function updateMonthlyCardAmount(monthlyAmountMad: number): Promise<FuelCardSetting> {
  const { error: deactivateError } = await supabase
    .from('fuel_card_settings')
    .update({ is_active: false })
    .eq('is_active', true);

  if (deactivateError) throw deactivateError;

  const { data, error } = await supabase
    .from('fuel_card_settings')
    .insert({
      monthly_amount_mad: monthlyAmountMad,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data as FuelCardSetting;
}

async function fetchFuelCardVehicleControls(vehicleIds: string[]): Promise<FuelCardVehicleControl[]> {
  if (vehicleIds.length === 0) return [];
  const { data, error } = await supabase
    .from('fuel_card_vehicle_controls')
    .select('*')
    .in('vehicle_id', vehicleIds);

  if (error) throw error;
  return (data || []) as FuelCardVehicleControl[];
}

async function setVehicleCardEnabled(params: { vehicle_id: string; is_enabled: boolean; note?: string | null }) {
  const { data, error } = await supabase.rpc('set_fuel_card_vehicle_enabled', {
    p_vehicle_id: params.vehicle_id,
    p_is_enabled: params.is_enabled,
    p_note: params.note ?? null,
  });
  if (error) throw error;
  return data as FuelCardVehicleControl;
}

async function syncGPSwoxFuelToCard(params: {
  vehicle_id: string;
  fuel_level_l: number;
  event_at?: string;
  note?: string;
}) {
  const { error } = await supabase.rpc('sync_gpswox_fuel_to_card', {
    p_vehicle_id: params.vehicle_id,
    p_fuel_level_l: params.fuel_level_l,
    p_event_at: params.event_at ?? new Date().toISOString(),
    p_note: params.note ?? null,
  });
  if (error) throw error;
}

async function fetchFuelCardReport(days: number, vehicleIds?: string[]): Promise<FuelCardReportRow[]> {
  const { data, error } = await supabase.rpc('get_fuel_card_report', {
    p_days: days,
    p_vehicle_ids: vehicleIds && vehicleIds.length > 0 ? vehicleIds : null,
  });
  if (error) throw error;
  return (data || []) as FuelCardReportRow[];
}

async function fetchFuelCardVehicleAmounts(vehicleIds: string[]): Promise<FuelCardVehicleAmount[]> {
  if (vehicleIds.length === 0) return [];
  const { data, error } = await supabase
    .from('fuel_card_vehicle_amounts')
    .select('*')
    .in('vehicle_id', vehicleIds);
  if (error) throw error;
  return (data || []) as FuelCardVehicleAmount[];
}

async function setVehicleMonthlyCardAmount(params: { vehicle_id: string; monthly_amount_mad: number }) {
  const { data, error } = await supabase.rpc('set_vehicle_monthly_card_amount', {
    p_vehicle_id: params.vehicle_id,
    p_monthly_amount_mad: params.monthly_amount_mad,
  });
  if (error) throw error;
  return data as FuelCardVehicleAmount;
}

export function useFuelCardSettings() {
  return useQuery({
    queryKey: FUEL_CARD_SETTINGS_KEY,
    queryFn: fetchFuelCardSettings,
    staleTime: 30000,
  });
}

export function useFuelCardSnapshot(vehicleIds: string[]) {
  return useQuery({
    queryKey: [...FUEL_CARD_SNAPSHOT_KEY, vehicleIds.slice().sort().join(',')],
    queryFn: () => fetchFuelCardSnapshot(vehicleIds),
    staleTime: 15000,
    enabled: vehicleIds.length > 0,
  });
}

export function useFuelCardVehicleControls(vehicleIds: string[]) {
  return useQuery({
    queryKey: [...FUEL_CARD_CONTROLS_KEY, vehicleIds.slice().sort().join(',')],
    queryFn: () => fetchFuelCardVehicleControls(vehicleIds),
    staleTime: 15000,
    enabled: vehicleIds.length > 0,
  });
}

export function useFuelCardReport(days: number, vehicleIds: string[]) {
  return useQuery({
    queryKey: [...FUEL_CARD_REPORT_KEY, days, vehicleIds.slice().sort().join(',')],
    queryFn: () => fetchFuelCardReport(days, vehicleIds),
    staleTime: 15000,
    enabled: vehicleIds.length > 0,
  });
}

export function useFuelCardVehicleAmounts(vehicleIds: string[]) {
  return useQuery({
    queryKey: [...FUEL_CARD_AMOUNT_KEY, vehicleIds.slice().sort().join(',')],
    queryFn: () => fetchFuelCardVehicleAmounts(vehicleIds),
    staleTime: 15000,
    enabled: vehicleIds.length > 0,
  });
}

export function useUpdateFuelCardMonthlyAmount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMonthlyCardAmount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FUEL_CARD_SETTINGS_KEY });
      queryClient.invalidateQueries({ queryKey: FUEL_CARD_SNAPSHOT_KEY });
      toast({
        title: 'Succès',
        description: 'Montant mensuel des cartes mis à jour.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de mettre à jour le montant mensuel',
        variant: 'destructive',
      });
    },
  });
}

export function useSetVehicleCardEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setVehicleCardEnabled,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FUEL_CARD_CONTROLS_KEY });
      queryClient.invalidateQueries({ queryKey: FUEL_CARD_SNAPSHOT_KEY });
      queryClient.invalidateQueries({ queryKey: FUEL_CARD_REPORT_KEY });
      toast({
        title: 'Succès',
        description: 'Statut de la carte mis à jour.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de modifier le statut de la carte',
        variant: 'destructive',
      });
    },
  });
}

export function useSetVehicleMonthlyCardAmount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setVehicleMonthlyCardAmount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FUEL_CARD_AMOUNT_KEY });
      queryClient.invalidateQueries({ queryKey: FUEL_CARD_SNAPSHOT_KEY });
      queryClient.invalidateQueries({ queryKey: FUEL_CARD_REPORT_KEY });
      toast({
        title: 'Succès',
        description: 'Montant carte du véhicule mis à jour.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de modifier le montant carte du véhicule',
        variant: 'destructive',
      });
    },
  });
}

export function useAutoSyncFuelCardsFromGPSwox(
  vehicles: Array<{ id: string; fuelQuantity?: number | null; lastPosition?: { timestamp?: string } | null }>
) {
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      for (const vehicle of vehicles) {
        if (cancelled) break;
        const fuelLevel = vehicle.fuelQuantity;
        if (fuelLevel === null || fuelLevel === undefined || Number.isNaN(Number(fuelLevel))) continue;
        const eventAt = vehicle.lastPosition?.timestamp || new Date().toISOString();
        const key = `${vehicle.id}|${eventAt}|${Number(fuelLevel).toFixed(3)}`;
        if (seenRef.current.has(key)) continue;
        seenRef.current.add(key);
        await syncGPSwoxFuelToCard({
          vehicle_id: String(vehicle.id),
          fuel_level_l: Number(fuelLevel),
          event_at: eventAt,
          note: 'Synchronisation GPSwox',
        }).catch(() => {
          seenRef.current.delete(key);
        });
      }
    };
    sync();
    return () => {
      cancelled = true;
    };
  }, [vehicles]);
}
