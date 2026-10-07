import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ModuleSettings {
  dashboard: boolean;
  vehicles: boolean;
  drivers: boolean;
  personnel: boolean;
  live_map: boolean;
  missions: boolean;
  rental: boolean;
  transport_btp: boolean;
  transport_touristique: boolean;
  transport_voyageurs: boolean;
  transport_tms: boolean;
  clients: boolean;
  revisions: boolean;
  fuel: boolean;
  citerne: boolean;
  oil: boolean;
  maintenance: boolean;
  stock: boolean;
  achats: boolean;
  comptabilite: boolean;
  finance: boolean;
  reports: boolean;
  alerts: boolean;
  societe: boolean;
  facturation: boolean;
}

const DEFAULT_SETTINGS: ModuleSettings = {
  dashboard: true,
  vehicles: true,
  drivers: true,
  personnel: true,
  live_map: true,
  missions: true,
  rental: true,
  transport_btp: true,
  transport_touristique: true,
  transport_voyageurs: true,
  transport_tms: true,
  clients: true,
  revisions: true,
  fuel: true,
  citerne: true,
  oil: true,
  maintenance: true,
  stock: true,
  achats: true,
  comptabilite: true,
  finance: true,
  reports: true,
  alerts: true,
  societe: true,
  facturation: true,
};

export function useAppSettings() {
  const queryClient = useQueryClient();

  const { data: moduleSettings, isLoading } = useQuery({
    queryKey: ['app_settings', 'module_activation'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'module_activation')
        .maybeSingle();

      if (error) {
        return DEFAULT_SETTINGS;
      }
      
      if (!data) return DEFAULT_SETTINGS;
      
      const stored = (data.value || {}) as Partial<ModuleSettings>;
      return { ...DEFAULT_SETTINGS, ...stored } as ModuleSettings;
    },
  });

  const updateModuleSettings = useMutation({
    mutationFn: async (newValue: ModuleSettings) => {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ 
          key: 'module_activation', 
          value: newValue as any, 
          updated_at: new Date().toISOString() 
        }, { onConflict: 'key,user_id' });

      if (error) throw error;
      return newValue;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app_settings'] });
      toast.success('Paramètres mis à jour avec succès');
    },
    onError: (error) => {
      toast.error('Erreur lors de la mise à jour: ' + error.message);
    },
  });

  return {
    moduleSettings,
    isLoading,
    updateModuleSettings,
  };
}

export function useModulesUnlockCode() {
  const queryClient = useQueryClient();

  const { data: code, isLoading } = useQuery({
    queryKey: ['app_settings', 'modules_unlock_code'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'modules_unlock_code')
        .maybeSingle();

      if (error) return null;
      if (!data) return null;
      return (data.value as any) as string;
    },
  });

  const updateCode = useMutation({
    mutationFn: async (nextCode: string | null) => {
      const value = nextCode && nextCode.trim() ? nextCode.trim() : null;
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          {
            key: 'modules_unlock_code',
            value: value as any,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key,user_id' }
        );
      if (error) throw error;
      return value;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app_settings'] });
      toast.success('Code mis à jour');
    },
    onError: (error) => {
      toast.error('Erreur lors de la mise à jour: ' + error.message);
    },
  });

  return {
    code,
    isLoading,
    updateCode,
  };
}
