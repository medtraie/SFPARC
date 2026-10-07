export type UnifiedClientModule = 'facturation' | 'touristique' | 'tms';

export type UnifiedClientRecord = {
  id: string;
  source_module: UnifiedClientModule;
  source_id: string;
  name: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  ice?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

const STORAGE_KEY = 'unified-clients-registry-v1';

const safeParse = (value: string | null): UnifiedClientRecord[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as UnifiedClientRecord[]) : [];
  } catch {
    return [];
  }
};

export const getUnifiedClientsRegistry = (): UnifiedClientRecord[] => {
  if (typeof window === 'undefined') return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
};

const setUnifiedClientsRegistry = (records: UnifiedClientRecord[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
};

export const upsertUnifiedClientRecord = (
  payload: Omit<UnifiedClientRecord, 'id' | 'created_at' | 'updated_at'>
) => {
  const now = new Date().toISOString();
  const records = getUnifiedClientsRegistry();
  const idx = records.findIndex(
    (item) => item.source_module === payload.source_module && item.source_id === payload.source_id
  );
  if (idx >= 0) {
    records[idx] = {
      ...records[idx],
      ...payload,
      updated_at: now,
    };
    setUnifiedClientsRegistry(records);
    return records[idx];
  }
  const created: UnifiedClientRecord = {
    id: `ucr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    created_at: now,
    updated_at: now,
    ...payload,
  };
  setUnifiedClientsRegistry([created, ...records]);
  return created;
};

export const removeUnifiedClientRecord = (sourceModule: UnifiedClientModule, sourceId: string) => {
  const records = getUnifiedClientsRegistry().filter(
    (item) => !(item.source_module === sourceModule && item.source_id === sourceId)
  );
  setUnifiedClientsRegistry(records);
};
