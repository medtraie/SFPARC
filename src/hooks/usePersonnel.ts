import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useDrivers } from './useDrivers';

export type Personnel = Database['public']['Tables']['personnel']['Row'];
export type PersonnelInsert = Database['public']['Tables']['personnel']['Insert'];
export type PersonnelUpdate = Database['public']['Tables']['personnel']['Update'];

export type PersonnelDocument = Database['public']['Tables']['personnel_documents']['Row'];
export type PersonnelDocumentInsert = Database['public']['Tables']['personnel_documents']['Insert'];
export type PersonnelDocumentUpdate = Database['public']['Tables']['personnel_documents']['Update'];

export type DrivingLicense = Database['public']['Tables']['driving_licenses']['Row'];
export type DrivingLicenseInsert = Database['public']['Tables']['driving_licenses']['Insert'];
export type DrivingLicenseUpdate = Database['public']['Tables']['driving_licenses']['Update'];

export type MedicalVisit = Database['public']['Tables']['medical_visits']['Row'];
export type MedicalVisitInsert = Database['public']['Tables']['medical_visits']['Insert'];
export type MedicalVisitUpdate = Database['public']['Tables']['medical_visits']['Update'];

export type Infraction = Database['public']['Tables']['infractions']['Row'];
export type InfractionInsert = Database['public']['Tables']['infractions']['Insert'];
export type InfractionUpdate = Database['public']['Tables']['infractions']['Update'];

export interface PersonnelSelectOption {
  value: string;
  label: string;
}

function normalizeFullName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: 'Sans', lastName: 'nom' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '-' };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

// ─── Personnel Hooks ─────────────────────────────────────────────────────────

export function usePersonnel() {
  return useQuery({
    queryKey: ['personnel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personnel')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Personnel[];
    },
  });
}

export function usePersonnelMutation() {
  const queryClient = useQueryClient();
  
  const createPersonnel = useMutation({
    mutationFn: async (newPersonnel: PersonnelInsert) => {
      const { data, error } = await supabase
        .from('personnel')
        .insert(newPersonnel)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personnel'] });
    },
  });

  const updatePersonnel = useMutation({
    mutationFn: async ({ id, ...updates }: PersonnelUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('personnel')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personnel'] });
    },
  });

  const deletePersonnel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('personnel')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personnel'] });
    },
  });

  return { createPersonnel, updatePersonnel, deletePersonnel };
}

export function usePersonnelSelectOptions() {
  const queryClient = useQueryClient();
  const { data: personnel = [] } = usePersonnel();
  const { data: drivers = [] } = useDrivers();

  const options = useMemo(() => {
    const personnelOptions: PersonnelSelectOption[] = personnel.map((person) => ({
      value: person.id,
      label: `${person.first_name} ${person.last_name}`.trim(),
    }));

    const existingDriverKeys = new Set(
      personnel
        .filter((person) => person.role === 'driver')
        .map((person) => normalizeFullName(`${person.first_name} ${person.last_name}`))
    );

    const driverOptions: PersonnelSelectOption[] = drivers
      .filter((driver) => !existingDriverKeys.has(normalizeFullName(driver.name)))
      .map((driver) => ({
        value: `driver:${driver.id}`,
        label: driver.name,
      }));

    return [...personnelOptions, ...driverOptions];
  }, [drivers, personnel]);

  const resolvePersonnelId = useCallback(
    async (selectedValue: string) => {
      if (!selectedValue.startsWith('driver:')) {
        return selectedValue;
      }

      const driverId = selectedValue.replace('driver:', '');
      const matchedDriver = drivers.find((driver) => driver.id === driverId);
      if (!matchedDriver) {
        throw new Error('Driver not found');
      }

      const normalizedDriverName = normalizeFullName(matchedDriver.name);
      const existingPersonnel = personnel.find(
        (person) =>
          person.role === 'driver' &&
          normalizeFullName(`${person.first_name} ${person.last_name}`) === normalizedDriverName
      );

      if (existingPersonnel) {
        return existingPersonnel.id;
      }

      const { firstName, lastName } = splitFullName(matchedDriver.name);
      const status = matchedDriver.status === 'off_duty' ? 'inactive' : 'active';

      const { data, error } = await supabase
        .from('personnel')
        .insert({
          first_name: firstName,
          last_name: lastName,
          phone: matchedDriver.phone || null,
          role: 'driver',
          status,
        })
        .select('id')
        .single();

      if (error || !data) {
        throw error ?? new Error('Failed to create personnel record');
      }

      queryClient.invalidateQueries({ queryKey: ['personnel'] });
      return data.id;
    },
    [drivers, personnel, queryClient]
  );

  return { options, resolvePersonnelId };
}

// ─── Personnel Documents Hooks ───────────────────────────────────────────────

export function usePersonnelDocuments(personnelId?: string) {
  return useQuery({
    queryKey: ['personnel_documents', personnelId],
    queryFn: async () => {
      let query = supabase
        .from('personnel_documents')
        .select('*, personnel:personnel(first_name, last_name)')
        .order('expiry_date', { ascending: true });
      
      if (personnelId) {
        query = query.eq('personnel_id', personnelId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as (PersonnelDocument & { personnel?: { first_name: string; last_name: string } })[];
    },
    enabled: !!personnelId || personnelId === undefined,
  });
}

export function usePersonnelDocumentMutation() {
  const queryClient = useQueryClient();

  const createDocument = useMutation({
    mutationFn: async (newDoc: PersonnelDocumentInsert) => {
      const { data, error } = await supabase
        .from('personnel_documents')
        .insert(newDoc)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['personnel_documents', variables.personnel_id] });
    },
  });

  const updateDocument = useMutation({
    mutationFn: async ({ id, ...updates }: PersonnelDocumentUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('personnel_documents')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['personnel_documents', data.personnel_id] });
      }
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('personnel_documents')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return id; // Return id to help with invalidation if needed, though we might need parent id
    },
    onSuccess: () => {
      // Invalidate all personnel documents queries since we don't know the parent id easily without fetching first
      queryClient.invalidateQueries({ queryKey: ['personnel_documents'] });
    },
  });

  return { createDocument, updateDocument, deleteDocument };
}

// ─── Driving Licenses Hooks ──────────────────────────────────────────────────

export function useDrivingLicenses(personnelId?: string) {
  return useQuery({
    queryKey: ['driving_licenses', personnelId],
    queryFn: async () => {
      let query = supabase
        .from('driving_licenses')
        .select('*, personnel:personnel(first_name, last_name)')
        .order('expiry_date', { ascending: true });

      if (personnelId) {
        query = query.eq('personnel_id', personnelId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (DrivingLicense & { personnel?: { first_name: string; last_name: string } })[];
    },
    enabled: !!personnelId || personnelId === undefined,
  });
}

export function useDrivingLicenseMutation() {
  const queryClient = useQueryClient();

  const createLicense = useMutation({
    mutationFn: async (newLicense: DrivingLicenseInsert) => {
      const { data, error } = await supabase
        .from('driving_licenses')
        .insert(newLicense)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['driving_licenses', variables.personnel_id] });
    },
  });

  const updateLicense = useMutation({
    mutationFn: async ({ id, ...updates }: DrivingLicenseUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('driving_licenses')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['driving_licenses', data.personnel_id] });
      }
    },
  });

  const deleteLicense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('driving_licenses')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driving_licenses'] });
    },
  });

  return { createLicense, updateLicense, deleteLicense };
}

// ─── Medical Visits Hooks ────────────────────────────────────────────────────

export function useMedicalVisits(personnelId?: string) {
  return useQuery({
    queryKey: ['medical_visits', personnelId],
    queryFn: async () => {
      let query = supabase
        .from('medical_visits')
        .select('*, personnel:personnel(first_name, last_name)')
        .order('visit_date', { ascending: false });

      if (personnelId) {
        query = query.eq('personnel_id', personnelId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (MedicalVisit & { personnel?: { first_name: string; last_name: string } })[];
    },
    enabled: !!personnelId || personnelId === undefined,
  });
}

export function useMedicalVisitMutation() {
  const queryClient = useQueryClient();

  const createVisit = useMutation({
    mutationFn: async (newVisit: MedicalVisitInsert) => {
      const { data, error } = await supabase
        .from('medical_visits')
        .insert(newVisit)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['medical_visits', variables.personnel_id] });
    },
  });

  const updateVisit = useMutation({
    mutationFn: async ({ id, ...updates }: MedicalVisitUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('medical_visits')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['medical_visits', data.personnel_id] });
      }
    },
  });

  const deleteVisit = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('medical_visits')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medical_visits'] });
    },
  });

  return { createVisit, updateVisit, deleteVisit };
}

// ─── Infractions Hooks ───────────────────────────────────────────────────────

export function useInfractions(personnelId?: string) {
  return useQuery({
    queryKey: ['infractions', personnelId],
    queryFn: async () => {
      let query = supabase
        .from('infractions')
        .select('*, personnel:personnel(first_name, last_name)')
        .order('infraction_date', { ascending: false });

      if (personnelId) {
        query = query.eq('personnel_id', personnelId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (Infraction & { personnel?: { first_name: string; last_name: string } })[];
    },
    enabled: !!personnelId || personnelId === undefined,
  });
}

export function useInfractionMutation() {
  const queryClient = useQueryClient();

  const createInfraction = useMutation({
    mutationFn: async (newInfraction: InfractionInsert) => {
      const { data, error } = await supabase
        .from('infractions')
        .insert(newInfraction)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['infractions', variables.personnel_id] });
    },
  });

  const updateInfraction = useMutation({
    mutationFn: async ({ id, ...updates }: InfractionUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('infractions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['infractions', data.personnel_id] });
      }
    },
  });

  const deleteInfraction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('infractions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['infractions'] });
    },
  });

  return { createInfraction, updateInfraction, deleteInfraction };
}
