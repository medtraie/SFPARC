import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

export type RentalVehicle = Database['public']['Tables']['rental_vehicles']['Row'];
export type RentalVehicleInsert = Database['public']['Tables']['rental_vehicles']['Insert'];
export type RentalVehicleUpdate = Database['public']['Tables']['rental_vehicles']['Update'];

export type RentalClient = Database['public']['Tables']['rental_clients']['Row'];
export type RentalClientInsert = Database['public']['Tables']['rental_clients']['Insert'];
export type RentalClientUpdate = Database['public']['Tables']['rental_clients']['Update'];

export type RentalReservation = Database['public']['Tables']['rental_reservations']['Row'];
export type RentalReservationInsert = Database['public']['Tables']['rental_reservations']['Insert'];
export type RentalReservationUpdate = Database['public']['Tables']['rental_reservations']['Update'];

export type RentalRental = Database['public']['Tables']['rental_rentals']['Row'];
export type RentalRentalInsert = Database['public']['Tables']['rental_rentals']['Insert'];
export type RentalRentalUpdate = Database['public']['Tables']['rental_rentals']['Update'];

export type RentalContract = Database['public']['Tables']['rental_contracts']['Row'];
export type RentalContractInsert = Database['public']['Tables']['rental_contracts']['Insert'];
export type RentalContractUpdate = Database['public']['Tables']['rental_contracts']['Update'];

export type RentalInvoice = Database['public']['Tables']['rental_invoices']['Row'];
export type RentalInvoiceInsert = Database['public']['Tables']['rental_invoices']['Insert'];
export type RentalInvoiceUpdate = Database['public']['Tables']['rental_invoices']['Update'];

export type RentalInspection = Database['public']['Tables']['rental_inspections']['Row'];
export type RentalInspectionInsert = Database['public']['Tables']['rental_inspections']['Insert'];
export type RentalInspectionUpdate = Database['public']['Tables']['rental_inspections']['Update'];

export type RentalFuelLog = Database['public']['Tables']['rental_fuel_logs']['Row'];
export type RentalFuelLogInsert = Database['public']['Tables']['rental_fuel_logs']['Insert'];
export type RentalFuelLogUpdate = Database['public']['Tables']['rental_fuel_logs']['Update'];

const DEMO_FLAG_KEY = 'rental_demo';
const DEMO_DATA_KEY = 'rental_demo_data_v1';

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function isRentalDemoEnabled() {
  if (!isBrowser()) return false;
  return localStorage.getItem(DEMO_FLAG_KEY) === '1';
}

function isMissingTableError(e: any) {
  const msg = String(e?.message || '');
  return e?.code === 'PGRST205' || /schema cache/i.test(msg) || /could not find the table/i.test(msg);
}

type DemoData = {
  vehicles: any[];
  clients: any[];
  reservations: any[];
  rentals: any[];
  invoices: any[];
  fuelLogs: any[];
  inspections: any[];
  contracts: any[];
};

function nowIso() {
  return new Date().toISOString();
}

function dateOnlyIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 86400000);
}

function addMonths(d: Date, months: number) {
  const copy = new Date(d.getTime());
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function ensureId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}

function buildDemoData(): DemoData {
  const now = new Date();
  const createdAt = nowIso();

  const v1 = ensureId('demo-veh');
  const v2 = ensureId('demo-veh');
  const v3 = ensureId('demo-veh');

  const c1 = ensureId('demo-cli');
  const c2 = ensureId('demo-cli');
  const c3 = ensureId('demo-cli');

  const res1 = ensureId('demo-res');
  const res2 = ensureId('demo-res');

  const loc1 = ensureId('demo-loc');
  const loc2 = ensureId('demo-loc');

  const ctr1 = ensureId('demo-ctr');

  const inv1 = ensureId('demo-fac');
  const inv2 = ensureId('demo-fac');

  const fuel1 = ensureId('demo-fuel');
  const fuel2 = ensureId('demo-fuel');

  const insp1 = ensureId('demo-insp');
  const insp2 = ensureId('demo-insp');

  const vehicles = [
    {
      id: v1,
      photo_url: null,
      brand: 'Dacia',
      model: 'Duster',
      year: 2022,
      registration: 'DEMO-001',
      vehicle_type: 'suv',
      fuel_capacity: 50,
      current_mileage: 48210,
      price_per_day: 350,
      price_per_week: 2200,
      price_per_month: 8000,
      status: 'available',
      gps_imei: null,
      fuel_consumption: 7.2,
      insurance_company: 'Assurance Démo',
      insurance_expiry: dateOnlyIso(addMonths(now, 6)),
      notes: 'Véhicule démo',
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: v2,
      photo_url: null,
      brand: 'Renault',
      model: 'Clio',
      year: 2021,
      registration: 'DEMO-002',
      vehicle_type: 'car',
      fuel_capacity: 45,
      current_mileage: 61500,
      price_per_day: 280,
      price_per_week: 1750,
      price_per_month: 6500,
      status: 'maintenance',
      gps_imei: null,
      fuel_consumption: 6.1,
      insurance_company: 'Assurance Démo',
      insurance_expiry: dateOnlyIso(addMonths(now, 3)),
      notes: 'Véhicule démo (maintenance)',
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: v3,
      photo_url: null,
      brand: 'Hyundai',
      model: 'i10',
      year: 2020,
      registration: 'DEMO-003',
      vehicle_type: 'car',
      fuel_capacity: 40,
      current_mileage: 70220,
      price_per_day: 240,
      price_per_week: 1500,
      price_per_month: 5600,
      status: 'rented',
      gps_imei: null,
      fuel_consumption: 5.6,
      insurance_company: 'Assurance Démo',
      insurance_expiry: dateOnlyIso(addMonths(now, 9)),
      notes: 'Véhicule démo',
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];

  const clients = [
    {
      id: c1,
      full_name: 'Client Démo 1',
      phone: '+212 600 000 001',
      email: 'demo.client1@example.com',
      address: 'Casablanca',
      driver_license_number: 'DL-DEMO-001',
      driver_license_expiry: dateOnlyIso(addMonths(now, 18)),
      driver_license_photo_url: null,
      id_document_url: null,
      security_deposit_amount: 2000,
      score: 10,
      notes: 'Client démo',
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: c2,
      full_name: 'Client Démo 2',
      phone: '+212 600 000 002',
      email: 'demo.client2@example.com',
      address: 'Rabat',
      driver_license_number: 'DL-DEMO-002',
      driver_license_expiry: dateOnlyIso(addMonths(now, 10)),
      driver_license_photo_url: null,
      id_document_url: null,
      security_deposit_amount: 1500,
      score: 6,
      notes: 'Client démo',
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: c3,
      full_name: 'Client Démo 3',
      phone: '+212 600 000 003',
      email: 'demo.client3@example.com',
      address: 'Marrakech',
      driver_license_number: 'DL-DEMO-003',
      driver_license_expiry: dateOnlyIso(addMonths(now, 6)),
      driver_license_photo_url: null,
      id_document_url: null,
      security_deposit_amount: 1000,
      score: 2,
      notes: 'Client démo',
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];

  const reservations = [
    {
      id: res1,
      reservation_number: 'DEMO-RES-001',
      client_id: c1,
      vehicle_id: v1,
      start_date: dateOnlyIso(addDays(now, 1)),
      end_date: dateOnlyIso(addDays(now, 3)),
      price_per_day: 350,
      total_price: 1050,
      security_deposit: 2000,
      options: { gps: true, child_seat: false },
      status: 'pending',
      notes: 'Réservation démo',
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: res2,
      reservation_number: 'DEMO-RES-002',
      client_id: c2,
      vehicle_id: v3,
      start_date: dateOnlyIso(now),
      end_date: dateOnlyIso(addDays(now, 2)),
      price_per_day: 240,
      total_price: 720,
      security_deposit: 1500,
      options: { gps: false, delivery: true },
      status: 'confirmed',
      notes: 'Réservation démo (confirmée)',
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];

  const rentals = [
    {
      id: loc1,
      rental_number: 'DEMO-LOC-001',
      reservation_id: res2,
      client_id: c2,
      vehicle_id: v3,
      start_datetime: new Date(`${dateOnlyIso(now)}T10:00:00.000Z`).toISOString(),
      end_datetime: new Date(`${dateOnlyIso(addDays(now, 2))}T10:00:00.000Z`).toISOString(),
      actual_return_datetime: null,
      start_mileage: 70100,
      end_mileage: null,
      fuel_level_start: 80,
      fuel_level_end: null,
      total_price: 720,
      extra_charges: 0,
      late_penalty: 0,
      missing_fuel_charge: 0,
      status: 'active',
      notes: 'Location démo (active)',
      created_at: addMonths(now, 0).toISOString(),
      updated_at: createdAt,
    },
    {
      id: loc2,
      rental_number: 'DEMO-LOC-002',
      reservation_id: null,
      client_id: c1,
      vehicle_id: v1,
      start_datetime: addDays(now, -10).toISOString(),
      end_datetime: addDays(now, -7).toISOString(),
      actual_return_datetime: addDays(now, -7).toISOString(),
      start_mileage: 47800,
      end_mileage: 48310,
      fuel_level_start: 70,
      fuel_level_end: 35,
      total_price: 1400,
      extra_charges: 0,
      late_penalty: 0,
      missing_fuel_charge: 0,
      status: 'completed',
      notes: 'Location démo (terminée)',
      created_at: addMonths(now, -1).toISOString(),
      updated_at: createdAt,
    },
  ];

  const revenueHistory = Array.from({ length: 6 }).map((_, i) => {
    const d = addMonths(now, -i);
    return {
      id: ensureId('demo-loc-hist'),
      rental_number: `DEMO-LOC-H${String(i + 1).padStart(3, '0')}`,
      reservation_id: null,
      client_id: i % 2 === 0 ? c1 : c2,
      vehicle_id: i % 2 === 0 ? v1 : v3,
      start_datetime: addDays(d, -5).toISOString(),
      end_datetime: addDays(d, -2).toISOString(),
      actual_return_datetime: addDays(d, -2).toISOString(),
      start_mileage: 40000 + i * 900,
      end_mileage: 40250 + i * 900,
      fuel_level_start: 70,
      fuel_level_end: 50,
      total_price: 600 + i * 120,
      extra_charges: 0,
      late_penalty: 0,
      missing_fuel_charge: 0,
      status: 'completed',
      notes: 'Historique démo',
      created_at: d.toISOString(),
      updated_at: d.toISOString(),
    };
  });

  const invoices = [
    {
      id: inv1,
      invoice_number: 'DEMO-FAC-001',
      rental_id: loc1,
      issue_date: dateOnlyIso(now),
      due_date: dateOnlyIso(addDays(now, 7)),
      amount_total: 720,
      status: 'draft',
      email_sent: false,
      invoice_json: { demo: true },
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: inv2,
      invoice_number: 'DEMO-FAC-002',
      rental_id: loc2,
      issue_date: dateOnlyIso(addDays(now, -7)),
      due_date: dateOnlyIso(addDays(now, -3)),
      amount_total: 1400,
      status: 'paid',
      email_sent: true,
      invoice_json: { demo: true },
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];

  const fuelLogs = [
    {
      id: fuel1,
      vehicle_id: v1,
      rental_id: null,
      log_date: dateOnlyIso(addDays(now, -2)),
      liters: 32,
      fuel_price_total: 480,
      mileage: 120,
      created_at: createdAt,
    },
    {
      id: fuel2,
      vehicle_id: v3,
      rental_id: loc1,
      log_date: dateOnlyIso(now),
      liters: 25,
      fuel_price_total: 370,
      mileage: 95,
      created_at: createdAt,
    },
  ];

  const inspections = [
    {
      id: insp1,
      rental_id: loc1,
      vehicle_id: v3,
      inspection_type: 'pre',
      checklist: { carrosserie: 'ok', pneus: 'ok', vitres: 'ok', interieur: 'ok' },
      fuel_level: 80,
      mileage: 70100,
      photos: [],
      notes: 'Inspection démo (avant)',
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: insp2,
      rental_id: null,
      vehicle_id: v1,
      inspection_type: 'post',
      checklist: { carrosserie: 'ok', pneus: 'ok', vitres: 'rayure mineure' },
      fuel_level: 35,
      mileage: 48310,
      photos: [],
      notes: 'Inspection démo (après)',
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];

  return {
    vehicles,
    clients,
    reservations,
    rentals: [...rentals, ...revenueHistory],
    invoices,
    fuelLogs,
    inspections,
    contracts: [
      {
        id: ctr1,
        rental_id: loc1,
        contract_number: 'DEMO-CTR-001',
        contract_json: {
          lessor: { name: 'Agence Démo', phone: '+212 600 000 999' },
          lessee: { name: 'Client Démo 2', phone: '+212 600 000 002', email: 'demo.client2@example.com' },
          vehicle: { registration: 'DEMO-003', brand: 'Hyundai', model: 'i10', year: 2020 },
          rental: { rental_number: 'DEMO-LOC-001' },
          photos: { departure: [], return: [] },
          terms: 'Contrat de démonstration',
        },
        signature_data_url: null,
        signed_at: null,
        created_at: createdAt,
        updated_at: createdAt,
      },
    ],
  };
}

export function ensureRentalDemoData() {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(DEMO_DATA_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as DemoData;
    } catch {}
  }
  const data = buildDemoData();
  localStorage.setItem(DEMO_DATA_KEY, JSON.stringify(data));
  localStorage.setItem(DEMO_FLAG_KEY, '1');
  return data;
}

function readDemoData(): DemoData {
  if (!isBrowser()) return buildDemoData();
  const raw = localStorage.getItem(DEMO_DATA_KEY);
  if (!raw) return ensureRentalDemoData() || buildDemoData();
  try {
    const parsed = JSON.parse(raw);
    return parsed as DemoData;
  } catch {
    return ensureRentalDemoData() || buildDemoData();
  }
}

function writeDemoData(next: DemoData) {
  if (!isBrowser()) return;
  localStorage.setItem(DEMO_DATA_KEY, JSON.stringify(next));
}

function enrichReservations(d: DemoData) {
  const clientById = new Map(d.clients.map((c: any) => [c.id, c]));
  const vehicleById = new Map(d.vehicles.map((v: any) => [v.id, v]));
  return d.reservations.map((r: any) => ({ ...r, client: clientById.get(r.client_id) || null, vehicle: vehicleById.get(r.vehicle_id) || null }));
}

function enrichRentals(d: DemoData) {
  const clientById = new Map(d.clients.map((c: any) => [c.id, c]));
  const vehicleById = new Map(d.vehicles.map((v: any) => [v.id, v]));
  const reservationById = new Map(d.reservations.map((r: any) => [r.id, r]));
  return d.rentals.map((r: any) => ({
    ...r,
    client: clientById.get(r.client_id) || null,
    vehicle: vehicleById.get(r.vehicle_id) || null,
    reservation: r.reservation_id ? reservationById.get(r.reservation_id) || null : null,
  }));
}

function enrichInvoices(d: DemoData) {
  const rentals = enrichRentals(d);
  const rentalById = new Map(rentals.map((r: any) => [r.id, r]));
  return d.invoices.map((i: any) => ({ ...i, rental: rentalById.get(i.rental_id) || null }));
}

function enrichFuelLogs(d: DemoData) {
  const vehicleById = new Map(d.vehicles.map((v: any) => [v.id, v]));
  const rentalById = new Map(d.rentals.map((r: any) => [r.id, r]));
  return d.fuelLogs.map((f: any) => ({
    ...f,
    vehicle: vehicleById.get(f.vehicle_id) || null,
    rental: f.rental_id ? rentalById.get(f.rental_id) || null : null,
  }));
}

function enrichInspections(d: DemoData) {
  const vehicleById = new Map(d.vehicles.map((v: any) => [v.id, v]));
  const rentalById = new Map(enrichRentals(d).map((r: any) => [r.id, r]));
  return d.inspections.map((i: any) => ({
    ...i,
    vehicle: vehicleById.get(i.vehicle_id) || null,
    rental: i.rental_id ? rentalById.get(i.rental_id) || null : null,
  }));
}

function generateNumber(prefix: string) {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `${prefix}-${yyyy}${mm}${dd}-${rand}`;
}

function parseDateOnly(date: string) {
  const [y, m, d] = date.split('-').map((v) => Number(v));
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0));
}

export function computeTotalPrice(params: {
  startDate: string;
  endDate: string;
  pricePerDay: number;
  pricePerWeek: number;
  pricePerMonth: number;
}) {
  const start = parseDateOnly(params.startDate);
  const end = parseDateOnly(params.endDate);
  const diffMs = end.getTime() - start.getTime();
  const days = Math.max(1, Math.floor(diffMs / 86400000) + 1);

  const day = Math.max(0, params.pricePerDay || 0);
  const week = Math.max(0, params.pricePerWeek || 0);
  const month = Math.max(0, params.pricePerMonth || 0);

  const monthlyRate = month > 0 ? month : day * 30;
  const weeklyRate = week > 0 ? week : day * 7;

  let remaining = days;
  let total = 0;

  if (monthlyRate > 0) {
    const months = Math.floor(remaining / 30);
    total += months * monthlyRate;
    remaining -= months * 30;
  }

  if (weeklyRate > 0) {
    const weeks = Math.floor(remaining / 7);
    total += weeks * weeklyRate;
    remaining -= weeks * 7;
  }

  total += remaining * day;
  return { days, total: Number(total.toFixed(2)) };
}

export function useRentalVehicles() {
  return useQuery({
    queryKey: ['rental_vehicles'],
    queryFn: async () => {
      const demoEnabled = isRentalDemoEnabled();
      const demoData = demoEnabled ? ensureRentalDemoData() : null;
      const demoRows = demoData ? (demoData.vehicles as RentalVehicle[]) : [];

      const { data, error } = await supabase.from('rental_vehicles').select('*').order('created_at', { ascending: false });
      if (error) {
        if (demoEnabled || isMissingTableError(error)) return (ensureRentalDemoData()?.vehicles || []) as RentalVehicle[];
        throw error;
      }

      const real = (data || []) as RentalVehicle[];
      return real;
    },
  });
}

export function useRentalVehicleMutations() {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async (payload: RentalVehicleInsert) => {
      try {
        const { data, error } = await supabase.from('rental_vehicles').insert(payload).select().single();
        if (error) throw error;
        return data as RentalVehicle;
      } catch (e: any) {
        if (!isRentalDemoEnabled() && !isMissingTableError(e)) throw e;
        const d = ensureRentalDemoData() || buildDemoData();
        const created = {
          ...payload,
          id: ensureId('demo-veh'),
          created_at: nowIso(),
          updated_at: nowIso(),
        } as any;
        const next = { ...d, vehicles: [created, ...d.vehicles] };
        writeDemoData(next);
        return created as RentalVehicle;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental_vehicles'] });
      toast.success('Véhicule ajouté');
    },
    onError: (e) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: RentalVehicleUpdate & { id: string }) => {
      try {
        const { data, error } = await supabase.from('rental_vehicles').update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data as RentalVehicle;
      } catch (e: any) {
        if (!isRentalDemoEnabled() && !isMissingTableError(e)) throw e;
        const d = ensureRentalDemoData() || buildDemoData();
        const nextVehicles = d.vehicles.map((v: any) => (v.id === id ? { ...v, ...updates, updated_at: nowIso() } : v));
        const updated = nextVehicles.find((v: any) => v.id === id);
        const next = { ...d, vehicles: nextVehicles };
        writeDemoData(next);
        return updated as RentalVehicle;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental_vehicles'] });
      toast.success('Véhicule mis à jour');
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      try {
        const { error } = await supabase.from('rental_vehicles').delete().eq('id', id);
        if (error) throw error;
        return id;
      } catch (e: any) {
        if (!isRentalDemoEnabled() && !isMissingTableError(e)) throw e;
        const d = ensureRentalDemoData() || buildDemoData();
        const next = { ...d, vehicles: d.vehicles.filter((v: any) => v.id !== id) };
        writeDemoData(next);
        return id;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental_vehicles'] });
      toast.success('Véhicule supprimé');
    },
    onError: (e) => toast.error(e.message),
  });

  return { create, update, remove };
}

export function useRentalClients() {
  return useQuery({
    queryKey: ['rental_clients'],
    queryFn: async () => {
      const demoEnabled = isRentalDemoEnabled();
      const demoData = demoEnabled ? ensureRentalDemoData() : null;
      const demoRows = demoData ? (demoData.clients as RentalClient[]) : [];

      const { data, error } = await supabase.from('rental_clients').select('*').order('created_at', { ascending: false });
      if (error) {
        if (demoEnabled || isMissingTableError(error)) return (ensureRentalDemoData()?.clients || []) as RentalClient[];
        throw error;
      }

      const real = (data || []) as RentalClient[];
      return real;
    },
  });
}

export function useRentalClientMutations() {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async (payload: RentalClientInsert) => {
      try {
        const { data, error } = await supabase.from('rental_clients').insert(payload).select().single();
        if (error) throw error;
        return data as RentalClient;
      } catch (e: any) {
        if (!isRentalDemoEnabled() && !isMissingTableError(e)) throw e;
        const d = ensureRentalDemoData() || buildDemoData();
        const created = { ...payload, id: ensureId('demo-cli'), created_at: nowIso(), updated_at: nowIso() } as any;
        const next = { ...d, clients: [created, ...d.clients] };
        writeDemoData(next);
        return created as RentalClient;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental_clients'] });
      toast.success('Client ajouté');
    },
    onError: (e) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: RentalClientUpdate & { id: string }) => {
      try {
        const { data, error } = await supabase.from('rental_clients').update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data as RentalClient;
      } catch (e: any) {
        if (!isRentalDemoEnabled() && !isMissingTableError(e)) throw e;
        const d = ensureRentalDemoData() || buildDemoData();
        const nextClients = d.clients.map((c: any) => (c.id === id ? { ...c, ...updates, updated_at: nowIso() } : c));
        const updated = nextClients.find((c: any) => c.id === id);
        const next = { ...d, clients: nextClients };
        writeDemoData(next);
        return updated as RentalClient;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental_clients'] });
      toast.success('Client mis à jour');
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      try {
        const { error } = await supabase.from('rental_clients').delete().eq('id', id);
        if (error) throw error;
        return id;
      } catch (e: any) {
        if (!isRentalDemoEnabled() && !isMissingTableError(e)) throw e;
        const d = ensureRentalDemoData() || buildDemoData();
        const next = { ...d, clients: d.clients.filter((c: any) => c.id !== id) };
        writeDemoData(next);
        return id;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental_clients'] });
      toast.success('Client supprimé');
    },
    onError: (e) => toast.error(e.message),
  });

  return { create, update, remove };
}

export function useRentalReservations() {
  return useQuery({
    queryKey: ['rental_reservations'],
    queryFn: async () => {
      const demoEnabled = isRentalDemoEnabled();
      const demoData = demoEnabled ? ensureRentalDemoData() : null;
      const demoRows = demoData ? (enrichReservations(demoData) as any[]) : [];

      const { data, error } = await supabase
        .from('rental_reservations')
        .select('*, client:rental_clients(*), vehicle:rental_vehicles(*)')
        .order('start_date', { ascending: false });
      if (error) {
        if (demoEnabled || isMissingTableError(error)) return (enrichReservations(ensureRentalDemoData() || buildDemoData()) as any) as any[];
        throw error;
      }

      const real = (data || []) as any[];
      return real;
    },
  });
}

export function useRentalReservationMutations() {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async (payload: Omit<RentalReservationInsert, 'reservation_number'> & { reservation_number?: string }) => {
      const reservationNumber = payload.reservation_number || generateNumber('RES');
      const insertPayload = { ...payload, reservation_number: reservationNumber } as RentalReservationInsert;
      try {
        const { data, error } = await supabase.from('rental_reservations').insert(insertPayload).select().single();
        if (error) throw error;
        return data as RentalReservation;
      } catch (e: any) {
        if (!isRentalDemoEnabled() && !isMissingTableError(e)) throw e;
        const d = ensureRentalDemoData() || buildDemoData();
        const created = { ...insertPayload, id: ensureId('demo-res'), created_at: nowIso(), updated_at: nowIso() } as any;
        const next = { ...d, reservations: [created, ...d.reservations] };
        writeDemoData(next);
        return created as RentalReservation;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental_reservations'] });
      toast.success('Réservation créée');
    },
    onError: (e) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: RentalReservationUpdate & { id: string }) => {
      try {
        const { data, error } = await supabase.from('rental_reservations').update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data as RentalReservation;
      } catch (e: any) {
        if (!isRentalDemoEnabled() && !isMissingTableError(e)) throw e;
        const d = ensureRentalDemoData() || buildDemoData();
        const nextReservations = d.reservations.map((r: any) => (r.id === id ? { ...r, ...updates, updated_at: nowIso() } : r));
        const updated = nextReservations.find((r: any) => r.id === id);
        const next = { ...d, reservations: nextReservations };
        writeDemoData(next);
        return updated as RentalReservation;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental_reservations'] });
      toast.success('Réservation mise à jour');
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      try {
        const { error } = await supabase.from('rental_reservations').delete().eq('id', id);
        if (error) throw error;
        return id;
      } catch (e: any) {
        if (!isRentalDemoEnabled() && !isMissingTableError(e)) throw e;
        const d = ensureRentalDemoData() || buildDemoData();
        const next = { ...d, reservations: d.reservations.filter((r: any) => r.id !== id) };
        writeDemoData(next);
        return id;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental_reservations'] });
      toast.success('Réservation supprimée');
    },
    onError: (e) => toast.error(e.message),
  });

  const confirmToRental = useMutation({
    mutationFn: async (reservationId: string) => {
      try {
        const { data: reservation, error: rErr } = await supabase
          .from('rental_reservations')
          .select('*')
          .eq('id', reservationId)
          .single();
        if (rErr) throw rErr;

        const rentalNumber = generateNumber('LOC');
        const rentalPayload: RentalRentalInsert = {
          rental_number: rentalNumber,
          reservation_id: reservation.id,
          client_id: reservation.client_id,
          vehicle_id: reservation.vehicle_id,
          start_datetime: new Date(reservation.start_date).toISOString(),
          end_datetime: new Date(reservation.end_date).toISOString(),
          total_price: reservation.total_price,
          status: 'active',
        };

        const { data: createdRental, error: cErr } = await supabase.from('rental_rentals').insert(rentalPayload).select().single();
        if (cErr) throw cErr;

        const { error: uErr } = await supabase.from('rental_reservations').update({ status: 'confirmed' }).eq('id', reservationId);
        if (uErr) throw uErr;

        const { error: vErr } = await supabase.from('rental_vehicles').update({ status: 'rented' }).eq('id', reservation.vehicle_id);
        if (vErr) throw vErr;

        return createdRental as RentalRental;
      } catch (e: any) {
        if (!isRentalDemoEnabled() && !isMissingTableError(e)) throw e;
        const d = ensureRentalDemoData() || buildDemoData();
        const reservation = d.reservations.find((r: any) => r.id === reservationId);
        if (!reservation) throw new Error('Réservation introuvable');
        const rental: any = {
          id: ensureId('demo-loc'),
          rental_number: generateNumber('LOC'),
          reservation_id: reservation.id,
          client_id: reservation.client_id,
          vehicle_id: reservation.vehicle_id,
          start_datetime: new Date(reservation.start_date).toISOString(),
          end_datetime: new Date(reservation.end_date).toISOString(),
          actual_return_datetime: null,
          start_mileage: null,
          end_mileage: null,
          fuel_level_start: null,
          fuel_level_end: null,
          total_price: reservation.total_price,
          extra_charges: 0,
          late_penalty: 0,
          missing_fuel_charge: 0,
          status: 'active',
          notes: reservation.notes || null,
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        const nextReservations = d.reservations.map((r: any) => (r.id === reservationId ? { ...r, status: 'confirmed', updated_at: nowIso() } : r));
        const nextVehicles = d.vehicles.map((v: any) => (v.id === reservation.vehicle_id ? { ...v, status: 'rented', updated_at: nowIso() } : v));
        const next = { ...d, reservations: nextReservations, vehicles: nextVehicles, rentals: [rental, ...d.rentals] };
        writeDemoData(next);
        return rental as RentalRental;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental_reservations'] });
      queryClient.invalidateQueries({ queryKey: ['rental_rentals'] });
      queryClient.invalidateQueries({ queryKey: ['rental_vehicles'] });
      toast.success('Réservation confirmée');
    },
    onError: (e) => toast.error(e.message),
  });

  return { create, update, remove, confirmToRental };
}

export function useRentalRentals() {
  return useQuery({
    queryKey: ['rental_rentals'],
    queryFn: async () => {
      const demoEnabled = isRentalDemoEnabled();
      const demoData = demoEnabled ? ensureRentalDemoData() : null;
      const demoRows = demoData ? (enrichRentals(demoData) as any[]) : [];

      const { data, error } = await supabase
        .from('rental_rentals')
        .select('*, client:rental_clients(*), vehicle:rental_vehicles(*), reservation:rental_reservations(*)')
        .order('created_at', { ascending: false });
      if (error) {
        if (demoEnabled || isMissingTableError(error)) return (enrichRentals(ensureRentalDemoData() || buildDemoData()) as any) as any[];
        throw error;
      }

      const real = (data || []) as any[];
      return real;
    },
  });
}

export function useRentalRentalMutations() {
  const queryClient = useQueryClient();

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: RentalRentalUpdate & { id: string }) => {
      try {
        const { data, error } = await supabase.from('rental_rentals').update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data as RentalRental;
      } catch (e: any) {
        if (!isRentalDemoEnabled() && !isMissingTableError(e)) throw e;
        const d = ensureRentalDemoData() || buildDemoData();
        const nextRentals = d.rentals.map((r: any) => (r.id === id ? { ...r, ...updates, updated_at: nowIso() } : r));
        const updated = nextRentals.find((r: any) => r.id === id);
        const next = { ...d, rentals: nextRentals };
        writeDemoData(next);
        return updated as RentalRental;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental_rentals'] });
      toast.success('Location mise à jour');
    },
    onError: (e) => toast.error(e.message),
  });

  const complete = useMutation({
    mutationFn: async (rentalId: string) => {
      try {
        const { data: rental, error: rErr } = await supabase.from('rental_rentals').select('*').eq('id', rentalId).single();
        if (rErr) throw rErr;

        const { data: updated, error: uErr } = await supabase
          .from('rental_rentals')
          .update({ status: 'completed', actual_return_datetime: new Date().toISOString() })
          .eq('id', rentalId)
          .select()
          .single();
        if (uErr) throw uErr;

        const { error: vErr } = await supabase.from('rental_vehicles').update({ status: 'available' }).eq('id', rental.vehicle_id);
        if (vErr) throw vErr;

        return updated as RentalRental;
      } catch (e: any) {
        if (!isRentalDemoEnabled() && !isMissingTableError(e)) throw e;
        const d = ensureRentalDemoData() || buildDemoData();
        const rental = d.rentals.find((r: any) => r.id === rentalId);
        if (!rental) throw new Error('Location introuvable');
        const updated = { ...rental, status: 'completed', actual_return_datetime: nowIso(), updated_at: nowIso() };
        const nextRentals = d.rentals.map((r: any) => (r.id === rentalId ? updated : r));
        const nextVehicles = d.vehicles.map((v: any) => (v.id === rental.vehicle_id ? { ...v, status: 'available', updated_at: nowIso() } : v));
        const next = { ...d, rentals: nextRentals, vehicles: nextVehicles };
        writeDemoData(next);
        return updated as RentalRental;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental_rentals'] });
      queryClient.invalidateQueries({ queryKey: ['rental_vehicles'] });
      toast.success('Location clôturée');
    },
    onError: (e) => toast.error(e.message),
  });

  return { update, complete };
}

export function useCreateRentalFromReservation() {
  const { confirmToRental } = useRentalReservationMutations();
  return confirmToRental;
}

export function useCompleteRental() {
  const { complete } = useRentalRentalMutations();
  return complete;
}

export function useDeleteRental() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rentalId: string) => {
      try {
        const { data: rental, error: rErr } = await supabase.from('rental_rentals').select('*').eq('id', rentalId).single();
        if (rErr) throw rErr;

        const { error: dErr } = await supabase.from('rental_rentals').delete().eq('id', rentalId);
        if (dErr) throw dErr;

        if (rental.status === 'active') {
          const { error: vErr } = await supabase.from('rental_vehicles').update({ status: 'available' }).eq('id', rental.vehicle_id);
          if (vErr) throw vErr;
        }

        return rentalId;
      } catch (e: any) {
        if (!isRentalDemoEnabled() && !isMissingTableError(e)) throw e;
        const d = ensureRentalDemoData() || buildDemoData();
        const rental = d.rentals.find((r: any) => r.id === rentalId);
        const nextRentals = d.rentals.filter((r: any) => r.id !== rentalId);
        const nextVehicles =
          rental && rental.status === 'active'
            ? d.vehicles.map((v: any) => (v.id === rental.vehicle_id ? { ...v, status: 'available', updated_at: nowIso() } : v))
            : d.vehicles;
        const next = { ...d, rentals: nextRentals, vehicles: nextVehicles };
        writeDemoData(next);
        return rentalId;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental_rentals'] });
      queryClient.invalidateQueries({ queryKey: ['rental_vehicles'] });
      toast.success('Location supprimée');
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useRentalContracts(rentalId?: string) {
  return useQuery({
    queryKey: ['rental_contracts', rentalId],
    queryFn: async () => {
      const demoEnabled = isRentalDemoEnabled();
      const demoData = demoEnabled ? ensureRentalDemoData() : null;
      const demoRows = demoData ? (demoData.contracts as RentalContract[]) : [];

      const q = supabase.from('rental_contracts').select('*').order('created_at', { ascending: false });
      const { data, error } = rentalId ? await q.eq('rental_id', rentalId) : await q;
      if (error) {
        if (demoEnabled || isMissingTableError(error)) return demoRows;
        throw error;
      }

      const real = (data || []) as RentalContract[];
      return real;
    },
  });
}

export function useRentalContractMutations() {
  const queryClient = useQueryClient();

  const upsert = useMutation({
    mutationFn: async (payload: RentalContractInsert | (RentalContractUpdate & { id: string })) => {
      if ('id' in payload) {
        const { id, ...updates } = payload;
        try {
          const { data, error } = await supabase.from('rental_contracts').update(updates).eq('id', id).select().single();
          if (error) throw error;
          return data as RentalContract;
        } catch (e: any) {
          if (!isRentalDemoEnabled() && !isMissingTableError(e)) throw e;
          const d = ensureRentalDemoData() || buildDemoData();
          const nextContracts = d.contracts.map((c: any) => (c.id === id ? { ...c, ...updates, updated_at: nowIso() } : c));
          const updated = nextContracts.find((c: any) => c.id === id);
          const next = { ...d, contracts: nextContracts };
          writeDemoData(next);
          return updated as RentalContract;
        }
      }

      const contractNumber = payload.contract_number || generateNumber('CTR');
      const insertPayload = { ...payload, contract_number: contractNumber } as RentalContractInsert;
      try {
        const { data, error } = await supabase.from('rental_contracts').insert(insertPayload).select().single();
        if (error) throw error;
        return data as RentalContract;
      } catch (e: any) {
        if (!isRentalDemoEnabled() && !isMissingTableError(e)) throw e;
        const d = ensureRentalDemoData() || buildDemoData();
        const created: any = { ...insertPayload, id: ensureId('demo-ctr'), created_at: nowIso(), updated_at: nowIso() };
        const next = { ...d, contracts: [created, ...d.contracts] };
        writeDemoData(next);
        return created as RentalContract;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental_contracts'] });
      toast.success('Contrat enregistré');
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      try {
        const { error } = await supabase.from('rental_contracts').delete().eq('id', id);
        if (error) throw error;
        return id;
      } catch (e: any) {
        if (!isRentalDemoEnabled() && !isMissingTableError(e)) throw e;
        const d = ensureRentalDemoData() || buildDemoData();
        const next = { ...d, contracts: d.contracts.filter((c: any) => c.id !== id) };
        writeDemoData(next);
        return id;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental_contracts'] });
      toast.success('Contrat supprimé');
    },
    onError: (e) => toast.error(e.message),
  });

  return { upsert, remove };
}

export function useRentalInvoices() {
  return useQuery({
    queryKey: ['rental_invoices'],
    queryFn: async () => {
      const demoEnabled = isRentalDemoEnabled();
      const demoData = demoEnabled ? ensureRentalDemoData() : null;
      const demoRows = demoData ? (enrichInvoices(demoData) as any[]) : [];

      const { data, error } = await supabase
        .from('rental_invoices')
        .select('*, rental:rental_rentals(*, client:rental_clients(*), vehicle:rental_vehicles(*))')
        .order('issue_date', { ascending: false });
      if (error) {
        if (demoEnabled || isMissingTableError(error)) return (enrichInvoices(ensureRentalDemoData() || buildDemoData()) as any) as any[];
        throw error;
      }

      const real = (data || []) as any[];
      return real;
    },
  });
}

export function useRentalInvoiceMutations() {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async (payload: Omit<RentalInvoiceInsert, 'invoice_number'> & { invoice_number?: string }) => {
      const invoiceNumber = payload.invoice_number || generateNumber('FAC');
      const insertPayload = { ...payload, invoice_number: invoiceNumber } as RentalInvoiceInsert;
      try {
        const { data, error } = await supabase.from('rental_invoices').insert(insertPayload).select().single();
        if (error) throw error;
        return data as RentalInvoice;
      } catch (e: any) {
        if (!isRentalDemoEnabled() && !isMissingTableError(e)) throw e;
        const d = ensureRentalDemoData() || buildDemoData();
        const created: any = { ...insertPayload, id: ensureId('demo-fac'), created_at: nowIso(), updated_at: nowIso() };
        const next = { ...d, invoices: [created, ...d.invoices] };
        writeDemoData(next);
        return created as RentalInvoice;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental_invoices'] });
      toast.success('Facture créée');
    },
    onError: (e) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: RentalInvoiceUpdate & { id: string }) => {
      try {
        const { data, error } = await supabase.from('rental_invoices').update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data as RentalInvoice;
      } catch (e: any) {
        if (!isRentalDemoEnabled() && !isMissingTableError(e)) throw e;
        const d = ensureRentalDemoData() || buildDemoData();
        const nextInvoices = d.invoices.map((i: any) => (i.id === id ? { ...i, ...updates, updated_at: nowIso() } : i));
        const updated = nextInvoices.find((i: any) => i.id === id);
        const next = { ...d, invoices: nextInvoices };
        writeDemoData(next);
        return updated as RentalInvoice;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental_invoices'] });
      toast.success('Facture mise à jour');
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      try {
        const { error } = await supabase.from('rental_invoices').delete().eq('id', id);
        if (error) throw error;
        return id;
      } catch (e: any) {
        if (!isRentalDemoEnabled() && !isMissingTableError(e)) throw e;
        const d = ensureRentalDemoData() || buildDemoData();
        const next = { ...d, invoices: d.invoices.filter((i: any) => i.id !== id) };
        writeDemoData(next);
        return id;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental_invoices'] });
      toast.success('Facture supprimée');
    },
    onError: (e) => toast.error(e.message),
  });

  return { create, update, remove };
}

export function useRentalFuelLogs(vehicleId?: string) {
  return useQuery({
    queryKey: ['rental_fuel_logs', vehicleId],
    queryFn: async () => {
      const demoEnabled = isRentalDemoEnabled();
      const demoData = demoEnabled ? ensureRentalDemoData() : null;
      const demoRows = demoData ? (enrichFuelLogs(demoData) as any[]) : [];

      const q = supabase
        .from('rental_fuel_logs')
        .select('*, vehicle:rental_vehicles(*), rental:rental_rentals(*)')
        .order('log_date', { ascending: false });
      const { data, error } = vehicleId ? await q.eq('vehicle_id', vehicleId) : await q;
      if (error) {
        if (demoEnabled || isMissingTableError(error)) {
          const base = enrichFuelLogs(ensureRentalDemoData() || buildDemoData()) as any[];
          return vehicleId ? base.filter((r) => r.vehicle_id === vehicleId) : base;
        }
        throw error;
      }

      const real = (data || []) as any[];
      return real;
    },
  });
}

export function useRentalFuelLogMutations() {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async (payload: RentalFuelLogInsert) => {
      try {
        const { data, error } = await supabase.from('rental_fuel_logs').insert(payload).select().single();
        if (error) throw error;
        return data as RentalFuelLog;
      } catch (e: any) {
        if (!isRentalDemoEnabled() && !isMissingTableError(e)) throw e;
        const d = ensureRentalDemoData() || buildDemoData();
        const created: any = { ...payload, id: ensureId('demo-fuel'), created_at: nowIso() };
        const next = { ...d, fuelLogs: [created, ...d.fuelLogs] };
        writeDemoData(next);
        return created as RentalFuelLog;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental_fuel_logs'] });
      toast.success('Carburant enregistré');
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      try {
        const { error } = await supabase.from('rental_fuel_logs').delete().eq('id', id);
        if (error) throw error;
        return id;
      } catch (e: any) {
        if (!isRentalDemoEnabled() && !isMissingTableError(e)) throw e;
        const d = ensureRentalDemoData() || buildDemoData();
        const next = { ...d, fuelLogs: d.fuelLogs.filter((f: any) => f.id !== id) };
        writeDemoData(next);
        return id;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental_fuel_logs'] });
      toast.success('Ligne supprimée');
    },
    onError: (e) => toast.error(e.message),
  });

  return { create, remove };
}

export function useRentalInspections(rentalId?: string) {
  return useQuery({
    queryKey: ['rental_inspections', rentalId],
    queryFn: async () => {
      const demoEnabled = isRentalDemoEnabled();
      const demoData = demoEnabled ? ensureRentalDemoData() : null;
      const demoRows = demoData ? (enrichInspections(demoData) as any[]) : [];

      const q = supabase
        .from('rental_inspections')
        .select('*, rental:rental_rentals(*, client:rental_clients(*)), vehicle:rental_vehicles(*)')
        .order('created_at', { ascending: false });
      const { data, error } = rentalId ? await q.eq('rental_id', rentalId) : await q;
      if (error) {
        if (demoEnabled || isMissingTableError(error)) {
          const base = enrichInspections(ensureRentalDemoData() || buildDemoData()) as any[];
          return rentalId ? base.filter((i) => i.rental_id === rentalId) : base;
        }
        throw error;
      }

      const real = (data || []) as any[];
      return real;
    },
  });
}

export function useRentalInspectionMutations() {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async (payload: RentalInspectionInsert) => {
      try {
        const { data, error } = await supabase.from('rental_inspections').insert(payload).select().single();
        if (error) throw error;
        return data as RentalInspection;
      } catch (e: any) {
        if (!isRentalDemoEnabled() && !isMissingTableError(e)) throw e;
        const d = ensureRentalDemoData() || buildDemoData();
        const created: any = { ...payload, id: ensureId('demo-insp'), created_at: nowIso(), updated_at: nowIso() };
        const next = { ...d, inspections: [created, ...d.inspections] };
        writeDemoData(next);
        return created as RentalInspection;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental_inspections'] });
      toast.success('Inspection enregistrée');
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      try {
        const { error } = await supabase.from('rental_inspections').delete().eq('id', id);
        if (error) throw error;
        return id;
      } catch (e: any) {
        if (!isRentalDemoEnabled() && !isMissingTableError(e)) throw e;
        const d = ensureRentalDemoData() || buildDemoData();
        const next = { ...d, inspections: d.inspections.filter((i: any) => i.id !== id) };
        writeDemoData(next);
        return id;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental_inspections'] });
      toast.success('Inspection supprimée');
    },
    onError: (e) => toast.error(e.message),
  });

  return { create, remove };
}


export function useVehicleAvailability(params?: {
  vehicleId: string;
  startDate: string;
  endDate: string;
  ignoreReservationId?: string;
}) {
  const enabled = !!params?.vehicleId && !!params?.startDate && !!params?.endDate;
  return useQuery({
    queryKey: ['rental_availability', params?.vehicleId, params?.startDate, params?.endDate, params?.ignoreReservationId],
    queryFn: async () => {
      if (!params) return { available: true, conflicts: 0 };

      const start = params.startDate;
      const end = params.endDate;

      if (isRentalDemoEnabled()) {
        const d = ensureRentalDemoData() || buildDemoData();
        const reservations = d.reservations.filter((r: any) => {
          if (r.vehicle_id !== params.vehicleId) return false;
          if (!['pending', 'confirmed'].includes(r.status)) return false;
          if (params.ignoreReservationId && r.id === params.ignoreReservationId) return false;
          return !(r.end_date < start || r.start_date > end);
        });
        const rentals = d.rentals.filter((r: any) => {
          if (r.vehicle_id !== params.vehicleId) return false;
          if (r.status !== 'active') return false;
          const rs = new Date(r.start_datetime).toISOString();
          const re = r.end_datetime ? new Date(r.end_datetime).toISOString() : nowIso();
          return !(re < new Date(start).toISOString() || rs > new Date(end).toISOString());
        });
        const conflicts = reservations.length + rentals.length;
        return { available: conflicts === 0, conflicts };
      }

      try {
        let reservationQuery = supabase
          .from('rental_reservations')
          .select('id, start_date, end_date, status')
          .eq('vehicle_id', params.vehicleId)
          .in('status', ['pending', 'confirmed'])
          .or(`and(start_date.lte.${end},end_date.gte.${start})`);

        if (params.ignoreReservationId) {
          reservationQuery = reservationQuery.neq('id', params.ignoreReservationId);
        }

        const { data: reservations, error: rErr } = await reservationQuery;
        if (rErr) throw rErr;

        const { data: rentals, error: lErr } = await supabase
          .from('rental_rentals')
          .select('id, start_datetime, end_datetime, status')
          .eq('vehicle_id', params.vehicleId)
          .in('status', ['active'])
          .or(`and(start_datetime.lte.${new Date(end).toISOString()},end_datetime.gte.${new Date(start).toISOString()})`);
        if (lErr) throw lErr;

        const conflicts = (reservations?.length || 0) + (rentals?.length || 0);
        return { available: conflicts === 0, conflicts };
      } catch (e: any) {
        if (isMissingTableError(e)) {
          const d = ensureRentalDemoData() || buildDemoData();
          const reservations = d.reservations.filter((r: any) => {
            if (r.vehicle_id !== params.vehicleId) return false;
            if (!['pending', 'confirmed'].includes(r.status)) return false;
            if (params.ignoreReservationId && r.id === params.ignoreReservationId) return false;
            return !(r.end_date < start || r.start_date > end);
          });
          const rentals = d.rentals.filter((r: any) => r.vehicle_id === params.vehicleId && r.status === 'active');
          const conflicts = reservations.length + rentals.length;
          return { available: conflicts === 0, conflicts };
        }
        throw e;
      }
    },
    enabled,
  });
}

export function useRentalDashboardStats() {
  const vehiclesQ = useRentalVehicles();
  const reservationsQ = useRentalReservations();
  const rentalsQ = useRentalRentals();

  const stats = useMemo(() => {
    const vehicles = vehiclesQ.data || [];
    const reservations = reservationsQ.data || [];
    const rentals = rentalsQ.data || [];

    const available = vehicles.filter((v) => v.status === 'available').length;
    const rented = vehicles.filter((v) => v.status === 'rented').length;
    const maintenance = vehicles.filter((v) => v.status === 'maintenance').length;

    const pendingReservations = reservations.filter((r) => r.status === 'pending').length;

    const today = new Date().toISOString().slice(0, 10);
    const monthPrefix = today.slice(0, 7);

    const revenueDay = rentals
      .filter((r) => r.created_at.slice(0, 10) === today && r.status !== 'cancelled')
      .reduce((acc, r) => acc + (r.total_price || 0), 0);

    const revenueMonth = rentals
      .filter((r) => r.created_at.slice(0, 7) === monthPrefix && r.status !== 'cancelled')
      .reduce((acc, r) => acc + (r.total_price || 0), 0);

    return {
      available,
      rented,
      maintenance,
      pendingReservations,
      revenueDay,
      revenueMonth,
    };
  }, [vehiclesQ.data, reservationsQ.data, rentalsQ.data]);

  return {
    isLoading: vehiclesQ.isLoading || reservationsQ.isLoading || rentalsQ.isLoading,
    error: vehiclesQ.error || reservationsQ.error || rentalsQ.error,
    stats,
  };
}
