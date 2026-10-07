import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Types
export interface PassengerLine {
  id: string;
  name: string;
  code: string;
  departure_city: string;
  arrival_city: string;
  distance_km: number | null;
  estimated_duration_minutes: number | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PassengerStation {
  id: string;
  line_id: string;
  name: string;
  city: string;
  sequence_order: number;
  distance_from_start_km: number | null;
  gps_lat: number | null;
  gps_lng: number | null;
  created_at: string;
}

export interface PassengerFare {
  id: string;
  line_id: string;
  from_station_id: string;
  to_station_id: string;
  fare_amount: number;
  created_at: string;
  updated_at: string;
  from_station?: PassengerStation;
  to_station?: PassengerStation;
}

export interface PassengerTrip {
  id: string;
  line_id: string;
  trip_date: string;
  departure_time: string;
  arrival_time: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  status: string;
  available_seats: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  line?: PassengerLine;
}

export interface PassengerTicket {
  id: string;
  ticket_number: string;
  trip_id: string;
  from_station_id: string;
  to_station_id: string;
  fare_amount: number;
  issue_date: string;
  status: string;
  notes: string | null;
  created_at: string;
  trip?: PassengerTrip;
  from_station?: PassengerStation;
  to_station?: PassengerStation;
}

export interface PassengerBaggage {
  id: string;
  baggage_number: string;
  ticket_id: string | null;
  trip_id: string;
  weight_kg: number | null;
  fee_amount: number;
  description: string | null;
  status: string;
  created_at: string;
}

// Lines hooks
export function usePassengerLines() {
  return useQuery({
    queryKey: ['passenger-lines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('passenger_lines')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as PassengerLine[];
    },
  });
}

export function useCreatePassengerLine() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (line: Omit<PassengerLine, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('passenger_lines').insert(line).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passenger-lines'] });
      toast({ title: 'Succès', description: 'Ligne créée avec succès' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeletePassengerLine() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('passenger_lines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passenger-lines'] });
      toast({ title: 'Succès', description: 'Ligne supprimée' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

// Stations hooks
export function usePassengerStations(lineId?: string) {
  return useQuery({
    queryKey: ['passenger-stations', lineId],
    queryFn: async () => {
      let query = supabase.from('passenger_stations').select('*').order('sequence_order');
      if (lineId) query = query.eq('line_id', lineId);
      const { data, error } = await query;
      if (error) throw error;
      return data as PassengerStation[];
    },
    enabled: !!lineId || lineId === undefined,
  });
}

export function useCreatePassengerStation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (station: Omit<PassengerStation, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('passenger_stations').insert(station).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passenger-stations'] });
      toast({ title: 'Succès', description: 'Station ajoutée' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeletePassengerStation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('passenger_stations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passenger-stations'] });
      toast({ title: 'Succès', description: 'Station supprimée' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

// Fares hooks
export function usePassengerFares(lineId?: string) {
  return useQuery({
    queryKey: ['passenger-fares', lineId],
    queryFn: async () => {
      let query = supabase
        .from('passenger_fares')
        .select('*, from_station:passenger_stations!passenger_fares_from_station_id_fkey(*), to_station:passenger_stations!passenger_fares_to_station_id_fkey(*)');
      if (lineId) query = query.eq('line_id', lineId);
      const { data, error } = await query;
      if (error) throw error;
      return data as PassengerFare[];
    },
    enabled: !!lineId,
  });
}

export function useCreatePassengerFare() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (fare: Omit<PassengerFare, 'id' | 'created_at' | 'updated_at' | 'from_station' | 'to_station'>) => {
      const { data, error } = await supabase.from('passenger_fares').insert(fare).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passenger-fares'] });
      toast({ title: 'Succès', description: 'Tarif ajouté' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdatePassengerFare() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, fare_amount }: { id: string; fare_amount: number }) => {
      const { error } = await supabase.from('passenger_fares').update({ fare_amount }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passenger-fares'] });
      toast({ title: 'Succès', description: 'Tarif mis à jour' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

// Trips hooks
export function usePassengerTrips(filters?: { lineId?: string; date?: string }) {
  return useQuery({
    queryKey: ['passenger-trips', filters],
    queryFn: async () => {
      let query = supabase
        .from('passenger_trips')
        .select('*, line:passenger_lines(*)')
        .order('trip_date', { ascending: false })
        .order('departure_time');
      if (filters?.lineId) query = query.eq('line_id', filters.lineId);
      if (filters?.date) query = query.eq('trip_date', filters.date);
      const { data, error } = await query;
      if (error) throw error;
      return data as PassengerTrip[];
    },
  });
}

export function useCreatePassengerTrip() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (trip: Omit<PassengerTrip, 'id' | 'created_at' | 'updated_at' | 'line'>) => {
      const { data, error } = await supabase.from('passenger_trips').insert(trip).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passenger-trips'] });
      toast({ title: 'Succès', description: 'Voyage créé' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdatePassengerTrip() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PassengerTrip> & { id: string }) => {
      const { error } = await supabase.from('passenger_trips').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passenger-trips'] });
      toast({ title: 'Succès', description: 'Voyage mis à jour' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeletePassengerTrip() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('passenger_trips').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passenger-trips'] });
      toast({ title: 'Succès', description: 'Voyage supprimé' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

// Tickets hooks
export function usePassengerTickets(tripId?: string) {
  return useQuery({
    queryKey: ['passenger-tickets', tripId],
    queryFn: async () => {
      let query = supabase
        .from('passenger_tickets')
        .select('*, trip:passenger_trips(*, line:passenger_lines(*)), from_station:passenger_stations!passenger_tickets_from_station_id_fkey(*), to_station:passenger_stations!passenger_tickets_to_station_id_fkey(*)')
        .order('issue_date', { ascending: false });
      if (tripId) query = query.eq('trip_id', tripId);
      const { data, error } = await query;
      if (error) throw error;
      return data as PassengerTicket[];
    },
  });
}

export function useCreatePassengerTicket() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (ticket: Omit<PassengerTicket, 'id' | 'created_at' | 'trip' | 'from_station' | 'to_station'>) => {
      const { data, error } = await supabase.from('passenger_tickets').insert(ticket).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passenger-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['passenger-trips'] });
      toast({ title: 'Succès', description: 'Billet émis avec succès' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

export function useCancelPassengerTicket() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('passenger_tickets').update({ status: 'cancelled' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passenger-tickets'] });
      toast({ title: 'Succès', description: 'Billet annulé' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

// Baggage hooks
export function usePassengerBaggage(tripId?: string) {
  return useQuery({
    queryKey: ['passenger-baggage', tripId],
    queryFn: async () => {
      let query = supabase.from('passenger_baggage').select('*').order('created_at', { ascending: false });
      if (tripId) query = query.eq('trip_id', tripId);
      const { data, error } = await query;
      if (error) throw error;
      return data as PassengerBaggage[];
    },
  });
}

export function useCreatePassengerBaggage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (baggage: Omit<PassengerBaggage, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('passenger_baggage').insert(baggage).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passenger-baggage'] });
      toast({ title: 'Succès', description: 'Bagage enregistré' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });
}

// Generate unique ticket number
export function generateTicketNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TKT-${dateStr}-${random}`;
}

// Generate unique baggage number
export function generateBaggageNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `BAG-${dateStr}-${random}`;
}
