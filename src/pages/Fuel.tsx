import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  Fuel as FuelIcon,
  TrendingUp,
  DollarSign,
  BarChart3,
  Loader2,
  RefreshCw,
  Settings,
  AlertTriangle,
  Car,
  Gauge,
  Droplets,
  CreditCard,
  FileDown,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { useGPSwoxVehicles } from '@/hooks/useGPSwoxVehicles';
import { useFuelPriceAuditLogs, useFuelPriceHistory, useSetActiveFuelPrice } from '@/hooks/useFuelPriceConfig';
import {
  useAutoSyncFuelCardsFromGPSwox,
  useFuelCardReport,
  useFuelCardSettings,
  useFuelCardSnapshot,
  useFuelCardVehicleAmounts,
  useFuelCardVehicleControls,
  useSetVehicleCardEnabled,
  useSetVehicleMonthlyCardAmount,
  useUpdateFuelCardMonthlyAmount,
} from '@/hooks/useFuelCards';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

export default function Fuel() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reportDays, setReportDays] = useState<'7' | '15' | '30'>('30');
  const [tempPrice, setTempPrice] = useState('12.5');
  const [tempMonthlyCardAmount, setTempMonthlyCardAmount] = useState('2000');
  const [vehicleCardAmountDrafts, setVehicleCardAmountDrafts] = useState<Record<string, string>>({});
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [cardDetailsOpen, setCardDetailsOpen] = useState(false);

  const { data: vehicles = [], isLoading, refetch, isFetching } = useGPSwoxVehicles();
  const { data: priceHistory = [], isLoading: priceHistoryLoading } = useFuelPriceHistory();
  const setActiveFuelPrice = useSetActiveFuelPrice();
  const { data: auditLogs = [] } = useFuelPriceAuditLogs(priceDialogOpen);
  const { data: cardSettings = [] } = useFuelCardSettings();
  const updateCardMonthlyAmount = useUpdateFuelCardMonthlyAmount();
  const activePrice = useMemo(
    () => priceHistory.find((entry) => entry.is_active) || priceHistory[0],
    [priceHistory]
  );
  const pricePerLiter = activePrice?.price_per_liter ?? 12.5;
  const activeCardSetting = cardSettings.find((setting) => setting.is_active) || cardSettings[0];
  const monthlyCardAmountMad = activeCardSetting?.monthly_amount_mad ?? 2000;

  useEffect(() => {
    if (!priceDialogOpen) return;
    setTempPrice(String(pricePerLiter));
    setTempMonthlyCardAmount(String(monthlyCardAmountMad));
  }, [priceDialogOpen, pricePerLiter, monthlyCardAmountMad]);

  // Filter vehicles with fuel data or sensors
  const vehiclesWithFuel = useMemo(() => vehicles.filter(v => 
    (v.fuelQuantity !== null && v.fuelQuantity !== undefined) || 
    (v.sensors && v.sensors.some(s => s.type === 'fuel'))
  ), [vehicles]);
  const vehicleIdsForCards = useMemo(
    () => vehiclesWithFuel.map((vehicle) => String(vehicle.id)),
    [vehiclesWithFuel]
  );
  const { data: cardSnapshot = [] } = useFuelCardSnapshot(vehicleIdsForCards);
  const { data: cardControls = [] } = useFuelCardVehicleControls(vehicleIdsForCards);
  const { data: vehicleCardAmounts = [] } = useFuelCardVehicleAmounts(vehicleIdsForCards);
  const setVehicleCardEnabled = useSetVehicleCardEnabled();
  const setVehicleMonthlyCardAmount = useSetVehicleMonthlyCardAmount();
  const { data: cardReportRows = [] } = useFuelCardReport(Number(reportDays), vehicleIdsForCards);
  const cardByVehicleId = useMemo(
    () => new Map(cardSnapshot.map((card) => [card.vehicle_id, card])),
    [cardSnapshot]
  );
  const cardControlByVehicleId = useMemo(
    () => new Map(cardControls.map((control) => [control.vehicle_id, control])),
    [cardControls]
  );
  const vehicleCardAmountById = useMemo(
    () => new Map(vehicleCardAmounts.map((row) => [row.vehicle_id, row])),
    [vehicleCardAmounts]
  );
  useAutoSyncFuelCardsFromGPSwox(
    vehiclesWithFuel.map((vehicle) => ({
      id: String(vehicle.id),
      fuelQuantity: vehicle.fuelQuantity,
      lastPosition: vehicle.lastPosition ? { timestamp: vehicle.lastPosition.timestamp } : null,
    }))
  );

  const filteredVehicles = useMemo(() => vehiclesWithFuel.filter((vehicle) => {
    const matchesSearch = vehicle.plate.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (vehicle.driverDetails?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVehicle = vehicleFilter === 'all' || String(vehicle.id) === vehicleFilter;
    const card = cardByVehicleId.get(String(vehicle.id));
    const cardLevelPercent = card && card.initial_amount_mad > 0
      ? (card.remaining_amount_mad / card.initial_amount_mad) * 100
      : 100;
    const matchesStatus = statusFilter === 'all' || 
                          (statusFilter === 'low' && cardLevelPercent < 20) ||
                          (statusFilter === 'normal' && cardLevelPercent >= 20);
    return matchesSearch && matchesVehicle && matchesStatus;
  }), [vehiclesWithFuel, searchQuery, vehicleFilter, statusFilter, cardByVehicleId]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalFuel = vehiclesWithFuel.reduce((acc, v) => acc + (v.fuelQuantity || 0), 0);
    const estimatedCost = totalFuel * pricePerLiter;
    const avgFuelLevel = vehiclesWithFuel.length > 0 
      ? totalFuel / vehiclesWithFuel.length 
      : 0;
    const totalDistance = vehiclesWithFuel.reduce((acc, v) => acc + (v.distanceMonth || 0), 0);
    const totalCardBudget = cardSnapshot.reduce((acc, card) => acc + Number(card.initial_amount_mad || 0), 0);
    const totalCardSpent = cardSnapshot.reduce((acc, card) => acc + Number(card.spent_amount_mad || 0), 0);
    const totalCardRemaining = cardSnapshot.reduce((acc, card) => acc + Number(card.remaining_amount_mad || 0), 0);
    const lowCardCount = cardSnapshot.filter((card) => {
      const initial = Number(card.initial_amount_mad || 0);
      if (initial <= 0) return false;
      return (Number(card.remaining_amount_mad || 0) / initial) * 100 < 20;
    }).length;
    
    return {
      totalFuel,
      estimatedCost,
      avgFuelLevel,
      totalDistance,
      totalCardBudget,
      totalCardSpent,
      totalCardRemaining,
      lowCardCount
    };
  }, [vehiclesWithFuel, pricePerLiter, cardSnapshot]);

  // Chart Data
  const consumptionData = useMemo(() => filteredVehicles
    .slice(0, 10)
    .sort((a, b) => (b.fuelQuantity || 0) - (a.fuelQuantity || 0))
    .map(vehicle => ({
      name: vehicle.plate,
      fuel: vehicle.fuelQuantity || 0,
      cost: (vehicle.fuelQuantity || 0) * pricePerLiter,
    })), [filteredVehicles, pricePerLiter]);

  // Mock Trend Data (in a real app, this would come from historical API)
  const trendData = [
    { name: 'Lun', value: stats.totalFuel * 0.9 },
    { name: 'Mar', value: stats.totalFuel * 0.95 },
    { name: 'Mer', value: stats.totalFuel * 0.88 },
    { name: 'Jeu', value: stats.totalFuel * 1.02 },
    { name: 'Ven', value: stats.totalFuel * 0.97 },
    { name: 'Sam', value: stats.totalFuel * 1.05 },
    { name: 'Dim', value: stats.totalFuel },
  ];

  const handlePriceSave = () => {
    const price = parseFloat(tempPrice);
    if (isNaN(price) || price <= 0) return;
    setActiveFuelPrice.mutate(
      {
        price_per_liter: price,
        source: 'manual_update',
        note: 'Mise à jour depuis Configuration du Carburant',
      },
      {
        onSuccess: () => {
          setPriceDialogOpen(false);
        },
      }
    );
  };

  const handleApplyHistoricalPrice = (entry: { id: string; price_per_liter: number }) => {
    setActiveFuelPrice.mutate({
      price_per_liter: entry.price_per_liter,
      source: 'history_apply',
      applied_from_id: entry.id,
      note: 'Réappliqué depuis historique',
    });
  };

  const handleMonthlyCardAmountSave = () => {
    const amount = parseFloat(tempMonthlyCardAmount);
    if (isNaN(amount) || amount <= 0) return;
    updateCardMonthlyAmount.mutate(amount);
  };

  const handleResetMonthlyCardDefault = () => {
    setTempMonthlyCardAmount('2000');
    updateCardMonthlyAmount.mutate(2000);
  };

  const handleToggleVehicleCard = (vehicleId: string, enabled: boolean) => {
    setVehicleCardEnabled.mutate({
      vehicle_id: vehicleId,
      is_enabled: enabled,
      note: enabled ? 'Carte activée' : 'Carte désactivée',
    });
  };

  const handleVehicleCardAmountDraftChange = (vehicleId: string, value: string) => {
    setVehicleCardAmountDrafts((prev) => ({ ...prev, [vehicleId]: value }));
  };

  const handleSaveVehicleCardAmount = (vehicleId: string) => {
    const raw = vehicleCardAmountDrafts[vehicleId];
    const amount = parseFloat(raw || '');
    if (isNaN(amount) || amount <= 0) return;
    setVehicleMonthlyCardAmount.mutate({
      vehicle_id: vehicleId,
      monthly_amount_mad: amount,
    });
  };

  const handleResetVehicleCardAmountToDefault = (vehicleId: string) => {
    handleVehicleCardAmountDraftChange(vehicleId, String(monthlyCardAmountMad));
    setVehicleMonthlyCardAmount.mutate({
      vehicle_id: vehicleId,
      monthly_amount_mad: monthlyCardAmountMad,
    });
  };

  const handleExportCardReport = () => {
    const rows = cardReportRows.map((row) => {
      const vehicle = vehicles.find((v) => String(v.id) === row.vehicle_id);
      return {
        vehicle: vehicle?.plate || row.vehicle_id,
        consumedMAD: Number(row.consumed_mad || 0).toFixed(2),
        consumedLiters: Number(row.consumed_liters || 0).toFixed(2),
        remainingMAD: Number(row.remaining_mad || 0).toFixed(2),
        remainingLiters: Number(row.remaining_liters_est || 0).toFixed(2),
        monthStart: row.month_start,
      };
    });

    const headers = ['Véhicule', 'Consommé MAD', 'Consommé L', 'Restant MAD', 'Restant L', 'Mois'];
    const csvLines = [headers.join(',')].concat(
      rows.map((row) =>
        [
          row.vehicle,
          row.consumedMAD,
          row.consumedLiters,
          row.remainingMAD,
          row.remainingLiters,
          row.monthStart,
        ]
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(',')
      )
    );
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fuel-card-report-${reportDays}j-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-MA', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">Chargement des données carburant...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <FuelIcon className="h-8 w-8 text-primary" />
              {t('nav.fuel')}
            </h1>
            <p className="text-muted-foreground mt-1">
              Suivi de la consommation et des niveaux de carburant en temps réel via GPS
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="gap-2 transition-all hover:bg-primary/5"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setCardDetailsOpen(true)}>
              <CreditCard className="h-4 w-4" />
              Détails Carte
            </Button>
            <Dialog open={priceDialogOpen} onOpenChange={setPriceDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 shadow-md hover:shadow-lg transition-all">
                  <Settings className="h-4 w-4" />
                  Configuration Prix
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[760px]">
                <DialogHeader>
                  <DialogTitle>Configuration du Carburant</DialogTitle>
                  <DialogDescription>
                    Définissez le prix du jour et le montant de la carte carburant (par défaut 2000 DH), puis consultez l&apos;historique.
                  </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="update" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="update">Prix du jour</TabsTrigger>
                    <TabsTrigger value="history">Historique</TabsTrigger>
                  </TabsList>
                  <TabsContent value="update" className="space-y-4 pt-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="price" className="text-right">
                        Prix / Litre
                      </Label>
                      <div className="col-span-3 relative">
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          min="0"
                          value={tempPrice}
                          onChange={(e) => setTempPrice(e.target.value)}
                          className="pl-8"
                        />
                        <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">Dh</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="monthly-card" className="text-right">
                        Carte Mensuelle
                      </Label>
                      <div className="col-span-3 flex items-center gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="monthly-card"
                            type="number"
                            step="0.01"
                            min="0"
                            value={tempMonthlyCardAmount}
                            onChange={(e) => setTempMonthlyCardAmount(e.target.value)}
                            className="pl-8"
                          />
                          <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">Dh</span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleMonthlyCardAmountSave}
                          disabled={updateCardMonthlyAmount.isPending}
                        >
                          Appliquer
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handleResetMonthlyCardDefault}
                          disabled={updateCardMonthlyAmount.isPending}
                        >
                          2000 DH
                        </Button>
                      </div>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-md text-sm text-muted-foreground space-y-1">
                      <div>
                        Actuellement: <span className="font-bold text-foreground">{pricePerLiter.toFixed(2)} MAD/L</span>
                      </div>
                      <div>
                        Budget mensuel carte: <span className="font-bold text-foreground">{formatCurrency(monthlyCardAmountMad)}</span>
                      </div>
                      <div>
                        Date d&apos;application: <span className="font-medium text-foreground">{activePrice ? new Date(activePrice.created_at).toLocaleString('fr-FR') : '-'}</span>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handlePriceSave} disabled={setActiveFuelPrice.isPending}>
                        Enregistrer les modifications
                      </Button>
                    </DialogFooter>
                  </TabsContent>
                  <TabsContent value="history" className="pt-4">
                    <div className="max-h-80 overflow-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Prix / Litre</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {priceHistory.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground">
                                Aucun historique.
                              </TableCell>
                            </TableRow>
                          ) : (
                            priceHistory.map((entry) => (
                              <TableRow key={entry.id}>
                                <TableCell>
                                  <div className="text-sm">{new Date(entry.created_at).toLocaleDateString('fr-FR')}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(entry.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </TableCell>
                                <TableCell className="font-semibold">{Number(entry.price_per_liter).toFixed(2)} MAD</TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {entry.source === 'history_apply' ? 'Réappliqué' : 'Mise à jour'}
                                </TableCell>
                                <TableCell className="text-right">
                                  {entry.is_active ? (
                                    <Badge variant="secondary">Actif</Badge>
                                  ) : (
                                    <Button variant="outline" size="sm" onClick={() => handleApplyHistoricalPrice(entry)}>
                                      Appliquer à la flotte
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="mt-4 rounded-md border p-3 space-y-2">
                      <div className="text-sm font-medium">Audit Trail</div>
                      {priceHistoryLoading ? (
                        <div className="text-xs text-muted-foreground">Chargement...</div>
                      ) : auditLogs.length === 0 ? (
                        <div className="text-xs text-muted-foreground">Aucune action auditée.</div>
                      ) : (
                        <div className="space-y-1 max-h-28 overflow-auto">
                          {auditLogs.slice(0, 8).map((log) => (
                            <div key={log.id} className="text-xs text-muted-foreground">
                              {new Date(log.created_at).toLocaleString('fr-FR')} — {log.action_type}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="dashboard-panel border-l-4 border-l-blue-500">
            <div className="absolute right-0 top-0 h-24 w-24 bg-gradient-to-br from-blue-500/10 to-transparent rounded-bl-full -mr-4 -mt-4" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Droplets className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                {stats.totalFuel > 0 && (
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                    En direct
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-bold tracking-tight">{stats.totalFuel.toLocaleString()} L</h3>
                <p className="text-sm text-muted-foreground">Volume Total Flotte</p>
              </div>
            </CardContent>
          </Card>

          <Card className="dashboard-panel border-l-4 border-l-emerald-500">
            <div className="absolute right-0 top-0 h-24 w-24 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-bl-full -mr-4 -mt-4" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                  <DollarSign className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <Badge variant="outline" className="border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
                  Estimé
                </Badge>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-bold tracking-tight">{formatCurrency(stats.estimatedCost)}</h3>
                <p className="text-sm text-muted-foreground">Valeur Carburant</p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Base: {pricePerLiter.toFixed(2)} MAD/L ({activePrice ? new Date(activePrice.created_at).toLocaleDateString('fr-FR') : '-'})
              </p>
            </CardContent>
          </Card>

          <Card className="dashboard-panel border-l-4 border-l-amber-500">
            <div className="absolute right-0 top-0 h-24 w-24 bg-gradient-to-br from-amber-500/10 to-transparent rounded-bl-full -mr-4 -mt-4" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <Gauge className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex items-center text-xs font-medium text-amber-600 dark:text-amber-400">
                  Moyenne
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-bold tracking-tight">{formatCurrency(stats.totalCardRemaining)}</h3>
                <p className="text-sm text-muted-foreground">Solde Cartes (Flotte)</p>
              </div>
              <Progress
                value={stats.totalCardBudget > 0 ? Math.min((stats.totalCardRemaining / stats.totalCardBudget) * 100, 100) : 0}
                className="h-1.5 mt-3 bg-amber-100 dark:bg-amber-900/20"
                indicatorClassName="bg-amber-500"
              />
            </CardContent>
          </Card>

          <Card className="dashboard-panel border-l-4 border-l-red-500">
            <div className="absolute right-0 top-0 h-24 w-24 bg-gradient-to-br from-red-500/10 to-transparent rounded-bl-full -mr-4 -mt-4" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                {stats.lowCardCount > 0 && (
                  <Badge variant="destructive" className="animate-pulse">
                    Action Requise
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-bold tracking-tight">{stats.lowCardCount}</h3>
                <p className="text-sm text-muted-foreground">Cartes Critiques (&lt;20%)</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="col-span-1 lg:col-span-2 dashboard-panel p-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Niveau Carburant par Véhicule
              </CardTitle>
              <CardDescription>
                Comparaison des volumes actuels pour les 10 premiers véhicules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={consumptionData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12 }} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => `${value}L`}
                    />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        borderColor: 'hsl(var(--border))',
                        borderRadius: 'var(--radius)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)' 
                      }}
                      formatter={(value: number) => [`${value} L`, 'Carburant']}
                    />
                    <Bar dataKey="fuel" radius={[4, 4, 0, 0]}>
                      {consumptionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fuel < 20 ? '#ef4444' : '#3b82f6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="dashboard-panel p-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Tendance (7 jours)
              </CardTitle>
              <CardDescription>
                Evolution du volume total
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} hide />
                    <Tooltip 
                       contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        borderColor: 'hsl(var(--border))',
                        borderRadius: 'var(--radius)' 
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorValue)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Table */}
        <Card className="dashboard-panel p-4">
          <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <CardTitle>Détail par Véhicule</CardTitle>
              <CardDescription>Liste complète des véhicules avec données carburant</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher (Matricule, Chauffeur)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-full sm:w-[250px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="normal">Carte Normal</SelectItem>
                  <SelectItem value="low">Carte Critique (&lt;20%)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={reportDays} onValueChange={(value: '7' | '15' | '30') => setReportDays(value)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Rapport" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 jours</SelectItem>
                  <SelectItem value="15">15 jours</SelectItem>
                  <SelectItem value="30">30 jours</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-2" onClick={handleExportCardReport}>
                <FileDown className="h-4 w-4" />
                Rapport
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Véhicule</TableHead>
                    <TableHead>Chauffeur</TableHead>
                    <TableHead className="w-[240px]">Niveau Carte</TableHead>
                    <TableHead className="text-right">Volume (L)</TableHead>
                    <TableHead className="text-right">Prix / Litre</TableHead>
                    <TableHead className="text-right">Valeur Est.</TableHead>
                    <TableHead className="text-right">Distance (Mois)</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVehicles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center">
                        Aucun véhicule trouvé avec des données de carburant.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVehicles.map((vehicle) => {
                      const fuel = vehicle.fuelQuantity || 0;
                      const card = cardByVehicleId.get(String(vehicle.id));
                      const control = cardControlByVehicleId.get(String(vehicle.id));
                      const cardEnabled = control?.is_enabled ?? true;
                      const cardInitial = Number(card?.initial_amount_mad || monthlyCardAmountMad);
                      const cardRemaining = Number(card?.remaining_amount_mad || monthlyCardAmountMad);
                      const cardSpent = Number(card?.spent_amount_mad || 0);
                      const cardPct = cardInitial > 0 ? Math.min(Math.max((cardRemaining / cardInitial) * 100, 0), 100) : 0;
                      const cardIsLow = cardPct < 20;
                      
                      return (
                        <TableRow key={vehicle.id} className="group hover:bg-muted/50 transition-colors">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-primary/10 rounded-md">
                                <Car className="h-4 w-4 text-primary" />
                              </div>
                              {vehicle.plate}
                              {!cardEnabled && <Badge variant="outline">Carte OFF</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>{vehicle.driverDetails?.name || '-'}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{formatCurrency(cardRemaining)} / {formatCurrency(cardInitial)}</span>
                                <span>{cardPct.toFixed(0)}%</span>
                              </div>
                              <Progress 
                                value={cardPct}
                                className="h-2" 
                                indicatorClassName={cardIsLow ? "bg-red-500 animate-pulse" : cardPct < 40 ? "bg-amber-500" : "bg-green-500"} 
                              />
                              <div className="text-[11px] text-muted-foreground">
                                Consommé: {formatCurrency(cardSpent)} • Est: {(cardSpent / Math.max(pricePerLiter, 0.001)).toFixed(1)} L
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold">{fuel.toFixed(1)} L</TableCell>
                          <TableCell className="text-right">{pricePerLiter.toFixed(2)} MAD</TableCell>
                          <TableCell className="text-right">{formatCurrency(fuel * pricePerLiter)}</TableCell>
                          <TableCell className="text-right">{vehicle.distanceMonth?.toLocaleString()} km</TableCell>
                          <TableCell className="text-center">
                            {cardIsLow ? (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Carte Faible
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className={cardEnabled ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : ""}>
                                {cardEnabled ? 'Carte OK' : 'Carte OFF'}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 text-xs text-muted-foreground text-center">
              Affichage de {filteredVehicles.length} véhicules sur {vehiclesWithFuel.length} équipés de capteurs
            </div>
          </CardContent>
        </Card>

        <Dialog open={cardDetailsOpen} onOpenChange={setCardDetailsOpen}>
          <DialogContent className="sm:max-w-[980px]">
            <DialogHeader>
              <DialogTitle>Gestion Carte Carburant</DialogTitle>
              <DialogDescription>
                Activez/Désactivez la carte par véhicule et suivez consommation/restant sur {reportDays} jours.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Véhicule</TableHead>
                    <TableHead className="text-right">Montant Carte</TableHead>
                    <TableHead className="text-right">Consommé (MAD)</TableHead>
                    <TableHead className="text-right">Consommé (L)</TableHead>
                    <TableHead className="text-right">Restant (MAD)</TableHead>
                    <TableHead className="text-right">Restant (L est.)</TableHead>
                    <TableHead className="text-center">Carte</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cardReportRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Aucun détail disponible.
                      </TableCell>
                    </TableRow>
                  ) : (
                    cardReportRows.map((row) => {
                      const vehicle = vehicles.find((v) => String(v.id) === row.vehicle_id);
                      const control = cardControlByVehicleId.get(row.vehicle_id);
                      const enabled = control?.is_enabled ?? true;
                      const vehicleAmount = vehicleCardAmountById.get(row.vehicle_id);
                      const effectiveAmount = Number(vehicleAmount?.monthly_amount_mad || monthlyCardAmountMad);
                      const draftValue = vehicleCardAmountDrafts[row.vehicle_id] ?? String(effectiveAmount);
                      return (
                        <TableRow key={`${row.vehicle_id}-${row.month_start}`}>
                          <TableCell className="font-medium">{vehicle?.plate || row.vehicle_id}</TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-2">
                              <Input
                                value={draftValue}
                                onChange={(e) => handleVehicleCardAmountDraftChange(row.vehicle_id, e.target.value)}
                                className="h-8 w-24 text-right"
                                type="number"
                                step="0.01"
                                min="0"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSaveVehicleCardAmount(row.vehicle_id)}
                                disabled={setVehicleMonthlyCardAmount.isPending}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleResetVehicleCardAmountToDefault(row.vehicle_id)}
                                disabled={setVehicleMonthlyCardAmount.isPending}
                              >
                                2000
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(row.consumed_mad || 0))}</TableCell>
                          <TableCell className="text-right">{Number(row.consumed_liters || 0).toFixed(2)} L</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(row.remaining_mad || 0))}</TableCell>
                          <TableCell className="text-right">{Number(row.remaining_liters_est || 0).toFixed(2)} L</TableCell>
                          <TableCell className="text-center">
                            <div className="inline-flex items-center gap-2">
                              <Switch
                                checked={enabled}
                                onCheckedChange={(checked) => handleToggleVehicleCard(row.vehicle_id, checked)}
                              />
                              <span className="text-xs text-muted-foreground">{enabled ? 'ON' : 'OFF'}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
