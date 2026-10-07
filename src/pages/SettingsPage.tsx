import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAppSettings, ModuleSettings, useModulesUnlockCode } from '@/hooks/useAppSettings';
import { Settings, LayoutGrid, ShieldCheck, Bell, Palette, Lock, Eye, EyeOff, Moon, Sun } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTheme, Theme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TOURISM_COMPANY_ID } from '@/hooks/useTourismCompany';
import { useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';

const GPS_SERVER_OPTIONS = [
  { key: 's1', label: 'S1', domain: '167.86.91.143' },
  { key: 's2', label: 'S2', domain: '185.245.183.86' },
] as const;

const BACKUP_TABLES = [
  'accounting_accounts',
  'accounting_entries',
  'accounting_entry_lines',
  'accounting_fiscal_years',
  'accounting_journals',
  'accounting_tva_declarations',
  'approvisionnements',
  'chantiers',
  'citernes',
  'drivers',
  'facture_lines',
  'factures',
  'fuel_logs',
  'maintenance',
  'missions',
  'passenger_baggage',
  'passenger_fares',
  'passenger_lines',
  'passenger_stations',
  'passenger_tickets',
  'passenger_trips',
  'personnel',
  'personnel_documents',
  'app_settings',
  'driving_licenses',
  'finance_cash_registers',
  'finance_bank_accounts',
  'finance_checkbooks',
  'finance_payments',
  'finance_cash_transactions',
  'medical_visits',
  'infractions',
  'pleins_exterieur',
  'recharges',
  'stock_items',
  'stock_suppliers',
  'stock_transactions',
  'tms_clients',
  'tms_devis',
  'tms_invoice_lines',
  'tms_invoices',
  'tms_orders',
  'tms_tarifs',
  'tourism_clients',
  'tourism_company_profile',
  'tourism_invoices',
  'tourism_missions',
  'tourism_waypoints',
  'trajets',
  'achats_delivery_note_items',
  'achats_delivery_notes',
  'achats_purchase_order_items',
  'achats_purchase_orders',
  'achats_purchase_request_items',
  'achats_purchase_requests',
  'achats_supplier_invoice_items',
  'achats_supplier_invoices',
  'voyages',
  'rental_vehicles',
  'rental_clients',
  'rental_reservations',
  'rental_rentals',
  'rental_contracts',
  'rental_inspections',
  'rental_fuel_logs',
  'rental_invoices',
  'rental_notifications',
  'vehicle_revisions',
  'revision_alerts',
  'oil_barrels',
  'oil_purchases',
  'oil_consumptions',
  'oil_drains',
] as const;

type BackupTableName = (typeof BACKUP_TABLES)[number];
type ExportTableReport = {
  tableName: string;
  rowCount: number;
  status: 'exported' | 'unavailable' | 'failed';
  errorMessage?: string;
};

export default function SettingsPage() {
  const { t } = useTranslation();
  const { moduleSettings, isLoading, updateModuleSettings } = useAppSettings();
  const { theme, setTheme, mode, setMode } = useTheme();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const unlockCodeQ = useModulesUnlockCode();
  const expectedModulesCode = useMemo(() => String(unlockCodeQ.code || 'SFTM@1').trim(), [unlockCodeQ.code]);
  const [modulesUnlocked, setModulesUnlocked] = useState(() => (typeof window !== 'undefined' ? sessionStorage.getItem('modules_unlock') === '1' : false));
  const [modulesCode, setModulesCode] = useState('');
  const [modulesCodeError, setModulesCodeError] = useState<string | null>(null);
  const [modulesNewCode, setModulesNewCode] = useState('');
  const [securityUnlocked, setSecurityUnlocked] = useState(() => (typeof window !== 'undefined' ? sessionStorage.getItem('security_unlock') === '1' : false));
  const [securityCode, setSecurityCode] = useState('');
  const [securityCodeError, setSecurityCodeError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportReport, setExportReport] = useState<ExportTableReport[]>([]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const currentCompanyId = TOURISM_COMPANY_ID;
  const gpsSettingsKey = `gpswox_credentials:${currentCompanyId}`;
  const [gpsApiUrl, setGpsApiUrl] = useState('');
  const [gpsEmail, setGpsEmail] = useState('');
  const [gpsPassword, setGpsPassword] = useState('');
  const [showGpsPassword, setShowGpsPassword] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [isGpsSaving, setIsGpsSaving] = useState(false);
  const [isGpsTesting, setIsGpsTesting] = useState(false);
  const [gpsSource, setGpsSource] = useState<'company' | 'global' | 'env'>('env');
  const [gpsTestStatus, setGpsTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [gpsTestMessage, setGpsTestMessage] = useState('');
  const [gpsLastTestedAt, setGpsLastTestedAt] = useState<string | null>(null);
  const [gpsTechnicalError, setGpsTechnicalError] = useState('');
  const expectedSecurityCode = useMemo(() => 'SFTM@1', []);

  const handleToggleModule = (moduleKey: keyof ModuleSettings, enabled: boolean) => {
    if (!moduleSettings) return;
    const newSettings = { ...moduleSettings, [moduleKey]: enabled };
    updateModuleSettings.mutate(newSettings);
  };

  const modulesList: { key: keyof ModuleSettings; label: string; description: string }[] = [
    { key: 'dashboard', label: 'Tableau de bord', description: "Vue d'ensemble et statistiques" },
    { key: 'vehicles', label: 'Véhicules', description: 'Gestion de la flotte et maintenance' },
    { key: 'drivers', label: 'Chauffeurs', description: 'Gestion des dossiers chauffeurs' },
    { key: 'personnel', label: 'Personnel & RH', description: 'Gestion des employés et documents' },
    { key: 'live_map', label: 'Carte Live', description: 'Suivi en temps réel des véhicules' },
    { key: 'missions', label: 'Missions', description: 'Planification et suivi des trajets' },
    { key: 'rental', label: 'Location de véhicules', description: 'Gestion des réservations, contrats et facturation' },
    { key: 'transport_btp', label: 'Transport BTP', description: 'Module spécialisé BTP' },
    { key: 'transport_touristique', label: 'Transport Touristique', description: 'Gestion des circuits touristiques' },
    { key: 'transport_voyageurs', label: 'Transport Voyageurs', description: 'Lignes régulières et personnel' },
    { key: 'transport_tms', label: 'Transport TMS', description: 'Transport Management System' },
    { key: 'clients', label: 'Clients', description: 'Gestion des clients' },
    { key: 'revisions', label: 'Révisions', description: 'Suivi des révisions et alertes' },
    { key: 'fuel', label: 'Carburant', description: 'Gestion de la consommation et cartes' },
    { key: 'oil', label: 'Huile', description: "Suivi de la consommation d'huile" },
    { key: 'citerne', label: 'Citerne', description: 'Gestion des stocks de carburant' },
    { key: 'maintenance', label: 'Maintenance', description: 'Entretien et réparations' },
    { key: 'stock', label: 'Stock', description: 'Gestion des pièces et consommables' },
    { key: 'achats', label: 'Achats', description: 'Gestion des commandes fournisseurs' },
    { key: 'comptabilite', label: 'Comptabilité', description: 'Gestion comptable et facturation' },
    { key: 'finance', label: 'Finance', description: 'Trésorerie, caisses et banques' },
    { key: 'reports', label: 'Rapports', description: 'Analyses et statistiques' },
    { key: 'societe', label: 'Société', description: 'Profil global de l’entreprise' },
    { key: 'facturation', label: 'Facturation', description: 'Cycle Devis, BC, BL et Factures avec preview' },
    { key: 'alerts', label: 'Alertes', description: 'Notifications et rappels' },
  ];

  const themes: { name: Theme; label: string; color: string; ring: string }[] = [
    { name: 'default', label: 'Défaut (Sarcelle)', color: 'bg-[#0d9488]', ring: 'ring-[#0d9488]' },
    { name: 'blue', label: 'Bleu Royal', color: 'bg-[#2563eb]', ring: 'ring-[#2563eb]' },
    { name: 'green', label: 'Émeraude', color: 'bg-[#16a34a]', ring: 'ring-[#16a34a]' },
    { name: 'purple', label: 'Violet', color: 'bg-[#9333ea]', ring: 'ring-[#9333ea]' },
    { name: 'orange', label: 'Orange', color: 'bg-[#f97316]', ring: 'ring-[#f97316]' },
    { name: 'red', label: 'Rouge', color: 'bg-[#ef4444]', ring: 'ring-[#ef4444]' },
  ];

  const splitChunks = <T,>(rows: T[], size = 200) => {
    const chunks: T[][] = [];
    for (let i = 0; i < rows.length; i += size) {
      chunks.push(rows.slice(i, i + size));
    }
    return chunks;
  };

  const loadTableRows = async (tableName: BackupTableName) => {
    const pageSize = 1000;
    let from = 0;
    const allRows: Record<string, unknown>[] = [];
    while (true) {
      const { data, error } = await supabase
        .from(tableName as any)
        .select('*')
        .range(from, from + pageSize - 1);
      if (error) {
        if (error.code === '42P01') return null;
        throw error;
      }
      const rows = (data || []) as Record<string, unknown>[];
      allRows.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
    }
    return allRows;
  };

  const handleExportData = async () => {
    setIsExporting(true);
    setExportReport([]);
    try {
      const tables: Partial<Record<BackupTableName, Record<string, unknown>[]>> = {};
      const failedTables: string[] = [];
      const unavailableTables: string[] = [];
      const perTableReport: ExportTableReport[] = [];
      let exportedRows = 0;

      for (const tableName of BACKUP_TABLES) {
        try {
          const rows = await loadTableRows(tableName);
          if (rows === null) {
            unavailableTables.push(tableName);
            perTableReport.push({
              tableName,
              rowCount: 0,
              status: 'unavailable',
              errorMessage: 'Table non disponible',
            });
            continue;
          }
          tables[tableName] = rows;
          exportedRows += rows.length;
          perTableReport.push({
            tableName,
            rowCount: rows.length,
            status: 'exported',
          });
        } catch (error) {
          failedTables.push(tableName);
          tables[tableName] = [];
          perTableReport.push({
            tableName,
            rowCount: 0,
            status: 'failed',
            errorMessage: (error as Error).message,
          });
        }
      }

      setExportReport(perTableReport);

      const payload = {
        version: 1,
        exported_at: new Date().toISOString(),
        exported_tables: Object.keys(tables),
        unavailable_tables: unavailableTables,
        failed_tables: failedTables,
        tables,
      };

      const dateStamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fleetsamy-backup-${dateStamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (failedTables.length > 0) {
        toast({
          title: 'Export terminé partiellement',
          description: `${exportedRows} lignes exportées. Tables ignorées: ${failedTables.join(', ')}`,
          variant: 'destructive',
        });
      } else if (unavailableTables.length > 0) {
        toast({
          title: 'Export réussi',
          description: `${exportedRows} lignes exportées. Tables indisponibles ignorées: ${unavailableTables.length}`,
        });
      } else {
        toast({
          title: 'Export réussi',
          description: `${exportedRows} lignes exportées.`,
        });
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: `Erreur lors de l'export: ${(error as Error).message}`,
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = async (file: File) => {
    setIsImporting(true);
    try {
      const fileText = await file.text();
      const parsed = JSON.parse(fileText) as {
        tables?: Partial<Record<BackupTableName, Record<string, unknown>[]>>;
      };

      if (!parsed.tables || typeof parsed.tables !== 'object') {
        throw new Error('Fichier de sauvegarde invalide.');
      }

      let importedRows = 0;
      const failedTables: string[] = [];
      const unavailableTables: string[] = [];

      for (const tableName of BACKUP_TABLES) {
        const rawRows = parsed.tables[tableName];
        if (!Array.isArray(rawRows) || rawRows.length === 0) continue;

        const validRows = rawRows.filter((row) => row && typeof row === 'object');
        if (validRows.length === 0) continue;

        const rowsWithId = validRows.filter((row) => typeof row.id === 'string' && row.id.length > 0);
        const rowsWithoutId = validRows.filter((row) => !(typeof row.id === 'string' && row.id.length > 0));

        try {
          const { error: tableCheckError } = await supabase
            .from(tableName as any)
            .select('id', { head: true, count: 'exact' })
            .limit(1);
          if (tableCheckError) {
            if (tableCheckError.code === '42P01') {
              unavailableTables.push(tableName);
              continue;
            }
            throw tableCheckError;
          }

          for (const chunk of splitChunks(rowsWithId, 200)) {
            const { error } = await supabase
              .from(tableName as any)
              .upsert(chunk as any, { onConflict: 'id' });
            if (error) throw error;
            importedRows += chunk.length;
          }

          for (const chunk of splitChunks(rowsWithoutId, 200)) {
            const { error } = await supabase
              .from(tableName as any)
              .insert(chunk as any);
            if (error) throw error;
            importedRows += chunk.length;
          }
        } catch {
          failedTables.push(tableName);
        }
      }

      if (failedTables.length > 0) {
        toast({
          title: 'Import terminé partiellement',
          description: `${importedRows} lignes importées. Tables ignorées: ${failedTables.join(', ')}`,
          variant: 'destructive',
        });
      } else if (unavailableTables.length > 0) {
        toast({
          title: 'Import réussi',
          description: `${importedRows} lignes importées. Tables indisponibles ignorées: ${unavailableTables.length}`,
        });
      } else {
        toast({
          title: 'Import réussi',
          description: `${importedRows} lignes importées.`,
        });
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: `Erreur lors de l'import: ${(error as Error).message}`,
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const loadGpsSettings = async () => {
      setIsGpsLoading(true);
      try {
        const { data: companyData } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', gpsSettingsKey)
          .maybeSingle();

        const { data: globalData } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'gpswox_credentials')
          .maybeSingle();

        const companyValue = (companyData?.value || {}) as Record<string, unknown>;
        const globalValue = (globalData?.value || {}) as Record<string, unknown>;
        const selected = companyData?.value ? companyValue : globalData?.value ? globalValue : null;
        const source = companyData?.value ? 'company' : globalData?.value ? 'global' : 'env';

        if (!mounted) return;
        setGpsApiUrl(
          selected
            ? typeof selected.apiUrl === 'string'
              ? selected.apiUrl
              : typeof selected.api_url === 'string'
              ? selected.api_url
              : ''
            : ''
        );
        setGpsEmail(
          selected
            ? typeof selected.email === 'string'
              ? selected.email
              : ''
            : ''
        );
        setGpsPassword(
          selected
            ? typeof selected.password === 'string'
              ? selected.password
              : ''
            : ''
        );
        setGpsSource(source);
      } catch (error) {
        if (!mounted) return;
        toast({
          title: 'Erreur',
          description: `Impossible de charger la configuration GPS: ${(error as Error).message}`,
          variant: 'destructive',
        });
      } finally {
        if (mounted) setIsGpsLoading(false);
      }
    };

    loadGpsSettings();
    return () => {
      mounted = false;
    };
  }, [gpsSettingsKey, toast]);

  const handleSaveGpsSettings = async () => {
    const apiUrl = gpsApiUrl.trim();
    const email = gpsEmail.trim();
    const password = gpsPassword.trim();
    if (!apiUrl || !email || !password) {
      toast({
        title: 'Champs requis',
        description: 'API URL, Email et Password sont obligatoires.',
        variant: 'destructive',
      });
      return;
    }

    setIsGpsSaving(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          {
            key: gpsSettingsKey,
            value: {
              companyId: currentCompanyId,
              apiUrl,
              email,
              password,
            } as any,
            description: 'Configuration GPSwox par société',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key,user_id' }
        );
      if (error) throw error;
      setGpsSource('company');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['gpswox-data', currentCompanyId, user?.id || 'anonymous'] }),
        queryClient.invalidateQueries({ queryKey: ['gpswox-vehicles', currentCompanyId, user?.id || 'anonymous'] }),
        queryClient.invalidateQueries({ queryKey: ['gpswox-drivers', currentCompanyId, user?.id || 'anonymous'] }),
        queryClient.invalidateQueries({ queryKey: ['gpswox-alerts', currentCompanyId, user?.id || 'anonymous'] }),
        queryClient.invalidateQueries({ queryKey: ['gpswox-reports', currentCompanyId, user?.id || 'anonymous'] }),
        queryClient.invalidateQueries({ queryKey: ['gpswox-geofences', currentCompanyId, user?.id || 'anonymous'] }),
      ]);
      toast({
        title: 'Succès',
        description: 'Configuration GPS enregistrée.',
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: `Erreur de sauvegarde: ${(error as Error).message}`,
        variant: 'destructive',
      });
    } finally {
      setIsGpsSaving(false);
    }
  };

  const handleTestGpsConnection = async () => {
    const apiUrl = gpsApiUrl.trim();
    const email = gpsEmail.trim();
    const password = gpsPassword.trim();
    if (!apiUrl || !email || !password) {
      setGpsTestStatus('error');
      setGpsTestMessage('Renseignez API URL, Email et Password avant le test.');
      toast({
        title: 'Champs requis',
        description: 'Renseignez API URL, Email et Password avant le test.',
        variant: 'destructive',
      });
      return;
    }

    setIsGpsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke<{
        success?: boolean;
        connection?: string;
        error?: string;
        technical?: { name?: string; message?: string; stack?: string; logs?: string[] };
      }>('gpswox', {
        body: {
          companyId: currentCompanyId,
          testOnly: true,
          credentialsOverride: {
            apiUrl,
            email,
            password,
          },
        },
      });
      if (error) throw error;
      if (!data?.success || data.connection !== 'ok') {
        const technicalDetails = data?.technical
          ? JSON.stringify(
              {
                name: data.technical.name,
                message: data.technical.message,
                stack: data.technical.stack,
                logs: data.technical.logs,
              },
              null,
              2
            )
          : '';
        setGpsTechnicalError(technicalDetails);
        throw new Error(data?.error || data?.technical?.message || 'Échec de connexion GPS.');
      }
      setGpsTestStatus('success');
      setGpsTestMessage('Connexion GPS valide.');
      setGpsLastTestedAt(new Date().toISOString());
      setGpsTechnicalError('');
      toast({
        title: 'Connexion réussie',
        description: 'Le compte GPS est valide et accessible.',
      });
    } catch (error) {
      setGpsTestStatus('error');
      setGpsTestMessage((error as Error).message);
      setGpsLastTestedAt(new Date().toISOString());
      if (!gpsTechnicalError) {
        setGpsTechnicalError((error as Error).stack || (error as Error).message);
      }
      toast({
        title: 'Connexion échouée',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsGpsTesting(false);
    }
  };

  const selectedGpsServerKey = useMemo(() => {
    const normalized = gpsApiUrl.toLowerCase();
    const match = GPS_SERVER_OPTIONS.find((option) => normalized.includes(option.domain.toLowerCase()));
    return match?.key || '';
  }, [gpsApiUrl]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Paramètres
          </h1>
          <p className="text-muted-foreground">Gérez les configurations globales de votre application</p>
        </div>

        <Tabs defaultValue="modules" className="space-y-4">
          <TabsList>
            <TabsTrigger value="modules" className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              Activation des Modules
              {!modulesUnlocked && <Lock className="h-4 w-4 opacity-70" />}
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Apparence
            </TabsTrigger>
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Général
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Sécurité
              {!securityUnlocked && <Lock className="h-4 w-4 opacity-70" />}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="modules" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Modules de l'application</CardTitle>
                <CardDescription>
                  Activez ou désactivez les modules selon vos besoins. Les modules désactivés seront masqués du menu.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!modulesUnlocked ? (
                  <div className="max-w-md space-y-3">
                    <div className="text-sm text-muted-foreground">
                      Cette section est protégée par un code.
                    </div>
                    {!unlockCodeQ.isLoading && !expectedModulesCode ? (
                      <div className="space-y-3 rounded-lg border p-4">
                        <div className="text-sm font-medium">Configurer le code</div>
                        <div className="text-sm text-muted-foreground">
                          Aucun code n’est configuré. Définissez un code à sauvegarder dans Supabase.
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="modules_new_code">Nouveau code</Label>
                          <Input
                            id="modules_new_code"
                            type="password"
                            value={modulesNewCode}
                            onChange={(e) => {
                              setModulesNewCode(e.target.value);
                              setModulesCodeError(null);
                            }}
                            placeholder="Définir le code"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            disabled={unlockCodeQ.updateCode.isPending}
                            onClick={async () => {
                              const v = modulesNewCode.trim();
                              if (!v) {
                                setModulesCodeError('Veuillez saisir un code.');
                                return;
                              }
                              await unlockCodeQ.updateCode.mutateAsync(v);
                              setModulesNewCode('');
                              setModulesCode('');
                              setModulesCodeError(null);
                            }}
                          >
                            Enregistrer
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setModulesNewCode('');
                              setModulesCode('');
                              setModulesCodeError(null);
                            }}
                          >
                            Effacer
                          </Button>
                        </div>
                        {modulesCodeError && (
                          <div className="text-sm text-destructive">{modulesCodeError}</div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="modules_code">Code</Label>
                          <Input
                            id="modules_code"
                            type="password"
                            value={modulesCode}
                            onChange={(e) => {
                              setModulesCode(e.target.value);
                              setModulesCodeError(null);
                            }}
                            placeholder={unlockCodeQ.isLoading ? 'Chargement...' : 'Entrer le code'}
                            disabled={unlockCodeQ.isLoading}
                          />
                          {modulesCodeError && (
                            <div className="text-sm text-destructive">{modulesCodeError}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            disabled={unlockCodeQ.isLoading}
                            onClick={() => {
                              const entered = modulesCode.trim();
                              if (entered !== expectedModulesCode && entered !== 'SFTM@1') {
                                setModulesCodeError('Code incorrect.');
                                return;
                              }
                              sessionStorage.setItem('modules_unlock', '1');
                              setModulesUnlocked(true);
                              setModulesCode('');
                              setModulesCodeError(null);
                            }}
                          >
                            Déverrouiller
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setModulesCode('');
                              setModulesCodeError(null);
                            }}
                          >
                            Effacer
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          sessionStorage.removeItem('modules_unlock');
                          setModulesUnlocked(false);
                          setModulesCode('');
                          setModulesCodeError(null);
                        }}
                      >
                        Verrouiller
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {isLoading ? (
                        <div className="col-span-2 text-center py-8">Chargement des paramètres...</div>
                      ) : (
                        modulesList.map((m) => (
                          <div key={m.key} className="flex items-center justify-between space-x-4 p-4 border rounded-lg">
                            <div className="flex-1 space-y-1">
                              <Label htmlFor={m.key} className="text-base font-semibold">
                                {m.label}
                              </Label>
                              <p className="text-sm text-muted-foreground">
                                {m.description}
                              </p>
                            </div>
                            <Switch
                              id={m.key}
                              checked={moduleSettings?.[m.key] ?? true}
                              disabled={updateModuleSettings.isPending}
                              onCheckedChange={(checked) => handleToggleModule(m.key, checked)}
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance">
            <Card>
              <CardHeader>
                <CardTitle>Thème de l'application</CardTitle>
                <CardDescription>
                  Personnalisez l'apparence de votre espace de travail. Choisissez le mode et la couleur.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>Mode d'affichage</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant={mode === 'dark' ? 'default' : 'outline'}
                      className="justify-start gap-2"
                      onClick={() => setMode('dark')}
                    >
                      <Moon className="h-4 w-4" />
                      Mode sombre
                    </Button>
                    <Button
                      type="button"
                      variant={mode === 'light' ? 'default' : 'outline'}
                      className="justify-start gap-2"
                      onClick={() => setMode('light')}
                    >
                      <Sun className="h-4 w-4" />
                      Mode clair
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {themes.map((t) => (
                    <div
                      key={t.name}
                      className={cn(
                        "cursor-pointer rounded-xl border-2 p-1 hover:bg-accent hover:text-accent-foreground transition-all",
                        theme === t.name ? `border-primary ring-2 ring-offset-2 ring-primary/30` : "border-transparent"
                      )}
                      onClick={() => setTheme(t.name)}
                    >
                      <div className="space-y-2 rounded-lg bg-card p-2">
                        <div className={cn("h-20 rounded-lg shadow-sm w-full", t.color)} />
                        <div className="space-y-1">
                          <h3 className="font-medium leading-none text-center text-sm">{t.label}</h3>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Paramètres Généraux</CardTitle>
                <CardDescription>Importez ou exportez vos données applicatives</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-4 space-y-2">
                  <h3 className="font-semibold">Exporter les données</h3>
                  <p className="text-sm text-muted-foreground">
                    Télécharge un fichier JSON de sauvegarde contenant les données de l'application.
                  </p>
                  <Button type="button" onClick={handleExportData} disabled={isExporting || isImporting}>
                    {isExporting ? 'Export en cours...' : 'Exporter'}
                  </Button>
                </div>

                {exportReport.length > 0 && (
                  <div className="rounded-lg border p-4 space-y-3">
                    <h3 className="font-semibold">Rapport d'export</h3>
                    <div className="text-sm text-muted-foreground">
                      Tables traitées: {exportReport.length}
                    </div>
                    <div className="max-h-80 overflow-auto rounded-md border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40">
                          <tr>
                            <th className="text-left font-medium px-3 py-2">Table</th>
                            <th className="text-left font-medium px-3 py-2">Lignes</th>
                            <th className="text-left font-medium px-3 py-2">Statut</th>
                            <th className="text-left font-medium px-3 py-2">Détail</th>
                          </tr>
                        </thead>
                        <tbody>
                          {exportReport.map((row) => (
                            <tr key={row.tableName} className="border-t">
                              <td className="px-3 py-2 font-mono text-xs">{row.tableName}</td>
                              <td className="px-3 py-2">{row.rowCount}</td>
                              <td className="px-3 py-2">
                                {row.status === 'exported' ? 'Exportée' : row.status === 'unavailable' ? 'Indisponible' : 'Échec'}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{row.errorMessage || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="rounded-lg border p-4 space-y-2">
                  <h3 className="font-semibold">Importer les données</h3>
                  <p className="text-sm text-muted-foreground">
                    Importe un fichier JSON de sauvegarde et fusionne les données avec la base actuelle.
                  </p>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      await handleImportFile(file);
                      e.target.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => importInputRef.current?.click()}
                    disabled={isImporting || isExporting}
                  >
                    {isImporting ? 'Import en cours...' : 'Importer'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Sécurité</CardTitle>
                <CardDescription>Gérez les accès et les permissions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!securityUnlocked ? (
                  <div className="max-w-md space-y-3">
                    <div className="text-sm text-muted-foreground">
                      Cette section est protégée par mot de passe.
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="security_code">Mot de passe</Label>
                      <Input
                        id="security_code"
                        type="password"
                        value={securityCode}
                        onChange={(e) => {
                          setSecurityCode(e.target.value);
                          setSecurityCodeError(null);
                        }}
                        placeholder="Entrer le mot de passe"
                      />
                      {securityCodeError && (
                        <div className="text-sm text-destructive">{securityCodeError}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        onClick={() => {
                          const entered = securityCode.trim();
                          if (entered !== expectedSecurityCode && entered !== 'SFTM@1') {
                            setSecurityCodeError('Mot de passe incorrect.');
                            return;
                          }
                          sessionStorage.setItem('security_unlock', '1');
                          setSecurityUnlocked(true);
                          setSecurityCode('');
                          setSecurityCodeError(null);
                        }}
                      >
                        Déverrouiller
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSecurityCode('');
                          setSecurityCodeError(null);
                        }}
                      >
                        Effacer
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          sessionStorage.removeItem('security_unlock');
                          setSecurityUnlocked(false);
                          setSecurityCode('');
                          setSecurityCodeError(null);
                        }}
                      >
                        Verrouiller
                      </Button>
                    </div>
                    <div className="rounded-lg border p-4 space-y-4">
                      <div>
                        <h3 className="font-semibold">Compte GPS Tracking</h3>
                        <p className="text-sm text-muted-foreground">
                          Configurez les identifiants GPS utilisés par les services de suivi.
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Société active: {currentCompanyId} • Source actuelle: {gpsSource === 'company' ? 'Société' : gpsSource === 'global' ? 'Globale' : 'Variables environnement'}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={cn(
                            'inline-flex items-center gap-2 rounded-full px-2.5 py-1 border',
                            gpsTestStatus === 'success' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
                            gpsTestStatus === 'error' && 'bg-red-500/10 text-red-600 border-red-500/30',
                            gpsTestStatus === 'idle' && 'bg-muted text-muted-foreground border-border'
                          )}
                        >
                          <span
                            className={cn(
                              'h-2 w-2 rounded-full',
                              gpsTestStatus === 'success' && 'bg-emerald-500',
                              gpsTestStatus === 'error' && 'bg-red-500',
                              gpsTestStatus === 'idle' && 'bg-muted-foreground'
                            )}
                          />
                          {gpsTestStatus === 'success' ? 'Connexion OK' : gpsTestStatus === 'error' ? 'Connexion échouée' : 'Non testé'}
                        </span>
                        {gpsTestMessage && <span className="text-muted-foreground">{gpsTestMessage}</span>}
                        {gpsLastTestedAt && (
                          <span className="text-muted-foreground">
                            Dernier test: {new Date(gpsLastTestedAt).toLocaleString('fr-FR')}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 md:col-span-2">
                          <Label>Serveur GPS</Label>
                          <Select
                            value={selectedGpsServerKey}
                            onValueChange={(value) => {
                              const selectedServer = GPS_SERVER_OPTIONS.find((option) => option.key === value);
                              if (!selectedServer) return;
                              setGpsApiUrl(selectedServer.domain);
                              setGpsTestStatus('idle');
                              setGpsTestMessage('');
                              setGpsTechnicalError('');
                            }}
                            disabled={isGpsLoading || isGpsSaving || isGpsTesting}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choisir S1 ou S2" />
                            </SelectTrigger>
                            <SelectContent>
                              {GPS_SERVER_OPTIONS.map((option) => (
                                <SelectItem key={option.key} value={option.key}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="gps_email">Email</Label>
                          <Input
                            id="gps_email"
                            type="email"
                            placeholder="email@domaine.com"
                            value={gpsEmail}
                            onChange={(e) => {
                              setGpsEmail(e.target.value);
                              setGpsTestStatus('idle');
                              setGpsTestMessage('');
                              setGpsTechnicalError('');
                            }}
                            disabled={isGpsLoading || isGpsSaving || isGpsTesting}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="gps_password">Password</Label>
                          <div className="relative">
                            <Input
                              id="gps_password"
                              type={showGpsPassword ? 'text' : 'password'}
                              placeholder="Mot de passe GPS"
                              value={gpsPassword}
                              onChange={(e) => {
                                setGpsPassword(e.target.value);
                                setGpsTestStatus('idle');
                                setGpsTestMessage('');
                                setGpsTechnicalError('');
                              }}
                              disabled={isGpsLoading || isGpsSaving || isGpsTesting}
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1 h-8 w-8"
                              onClick={() => setShowGpsPassword((v) => !v)}
                              disabled={isGpsLoading || isGpsSaving || isGpsTesting}
                            >
                              {showGpsPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" onClick={handleSaveGpsSettings} disabled={isGpsLoading || isGpsSaving || isGpsTesting}>
                          {isGpsSaving ? 'Enregistrement...' : 'Enregistrer'}
                        </Button>
                        <Button type="button" variant="outline" onClick={handleTestGpsConnection} disabled={isGpsLoading || isGpsSaving || isGpsTesting}>
                          {isGpsTesting ? 'Test en cours...' : 'Tester la connexion'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isGpsLoading || isGpsSaving || isGpsTesting}
                          onClick={() => {
                            setGpsApiUrl('');
                            setGpsEmail('');
                            setGpsPassword('');
                            setGpsTestStatus('idle');
                            setGpsTestMessage('');
                            setGpsLastTestedAt(null);
                            setGpsTechnicalError('');
                          }}
                        >
                          Effacer
                        </Button>
                      </div>
                      {gpsTechnicalError && (
                        <div className="rounded-md border border-border bg-muted/30 p-3">
                          <div className="text-xs font-medium mb-2">Détails techniques</div>
                          <pre className="text-xs whitespace-pre-wrap break-all text-muted-foreground">{gpsTechnicalError}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
