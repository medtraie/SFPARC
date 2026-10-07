import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MissionCard } from '@/components/missions/MissionCard';
import { MissionForm } from '@/components/missions/MissionForm';
import { MissionCostPanel } from '@/components/missions/MissionCostPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Search,
  Truck,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  TrendingUp,
  Loader2,
  LayoutGrid,
  List,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { useMissions, useCreateMission, useUpdateMission, useDeleteMission, Mission as DBMission } from '@/hooks/useMissions';
import { toast } from '@/hooks/use-toast';
import { MissionKanban } from '@/components/missions/MissionKanban';
import { MissionCalendar } from '@/components/missions/MissionCalendar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useTourismCompanyProfile } from '@/hooks/useTourismCompany';

const statusFilters = [
  { value: 'all', label: 'Toutes', icon: FileText },
  { value: 'in_progress', label: 'En cours', icon: Truck },
  { value: 'pending', label: 'Planifiées', icon: Clock },
  { value: 'completed', label: 'Livrées', icon: CheckCircle },
  { value: 'cancelled', label: 'Annulées', icon: XCircle },
];

type MissionNotesPayload = {
  client: string;
  notes: string;
};

const parseMissionNotes = (raw: string | null): MissionNotesPayload => {
  if (!raw) {
    return { client: 'Client', notes: '' };
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const client = typeof parsed.client === 'string' ? parsed.client : 'Client';
      const notes = typeof parsed.notes === 'string' ? parsed.notes : '';
      return { client, notes };
    }
  } catch {
    return { client: raw, notes: '' };
  }
  return { client: 'Client', notes: '' };
};

const buildMissionNotes = (data: { client: string; notes?: string }) =>
  JSON.stringify({ client: data.client, notes: data.notes || '' });

// Map DB mission to card format
interface MissionCardData {
  id: string;
  reference: string;
  client: string;
  notes?: string;
  origin: string;
  destination: string;
  status: 'planned' | 'in_progress' | 'delivered' | 'cancelled';
  vehicleId: string;
  driverId: string;
  departureDate: string;
  estimatedArrival: string;
  cargo: string;
  weight: number;
  fuelQuantity: number;
  pricePerLiter: number;
  fuelCost: number;
  discountRate: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  cashAmount: number;
  extraFees: number;
  totalCost: number;
}

function mapDBToCard(m: DBMission): MissionCardData {
  const statusMap: Record<string, 'planned' | 'in_progress' | 'delivered' | 'cancelled'> = {
    pending: 'planned',
    in_progress: 'in_progress',
    completed: 'delivered',
    cancelled: 'cancelled',
  };
  const { client, notes } = parseMissionNotes(m.notes);
  const cashAmount = m.cash_amount ?? 0;
  const extraFees = m.extra_fees ?? 0;
  const pricePerLiter = m.price_per_liter ?? 0;
  const fuelCost = m.fuel_cost ?? (m.fuel_quantity ?? 0) * pricePerLiter;
  const discountRate = m.discount_rate ?? 0;
  const taxRate = m.tax_rate ?? 0;
  const baseCost = cashAmount + extraFees + fuelCost;
  const discountAmount = m.discount_amount ?? baseCost * (discountRate / 100);
  const afterDiscount = Math.max(baseCost - discountAmount, 0);
  const taxAmount = m.tax_amount ?? afterDiscount * (taxRate / 100);
  const totalCost = m.total_cost ?? afterDiscount + taxAmount;
  const safeDate = m.mission_date ? new Date(m.mission_date).toISOString() : new Date().toISOString();
  return {
    id: m.id,
    reference: `MIS-${m.id.substring(0, 8).toUpperCase()}`,
    client,
    notes,
    origin: m.departure_zone || 'Non défini',
    destination: m.arrival_zone || 'Non défini',
    status: statusMap[m.status] || 'planned',
    vehicleId: m.vehicle_id || '',
    driverId: m.driver_id || '',
    departureDate: safeDate,
    estimatedArrival: safeDate,
    cargo: 'Marchandise',
    weight: 1000,
    fuelQuantity: m.fuel_quantity ?? 0,
    pricePerLiter,
    fuelCost,
    discountRate,
    discountAmount,
    taxRate,
    taxAmount,
    cashAmount,
    extraFees,
    totalCost,
  };
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-MA', { minimumFractionDigits: 0 }).format(amount) + ' MAD';

export default function Missions() {
  const { t } = useTranslation();
  const { data: companyProfile } = useTourismCompanyProfile();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedMission, setSelectedMission] = useState<MissionCardData | undefined>();

  const { data: missions = [], isLoading, refetch } = useMissions();
  const createMission = useCreateMission();
  const updateMission = useUpdateMission();
  const deleteMission = useDeleteMission();

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    missions
      .filter((m) => m.status === 'pending' && m.mission_date < today)
      .forEach((m) => {
        updateMission.mutate({ id: m.id, status: 'completed' });
      });
  }, [missions, updateMission]);

  const mappedMissions = missions.map(mapDBToCard);

  const filteredMissions = mappedMissions.filter((mission) => {
    const matchesSearch =
      mission.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mission.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mission.origin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mission.destination.toLowerCase().includes(searchQuery.toLowerCase());
    
    const dbStatusMap: Record<string, string> = {
      planned: 'pending',
      in_progress: 'in_progress',
      delivered: 'completed',
      cancelled: 'cancelled',
    };
    const dbStatus = Object.entries(dbStatusMap).find(([card]) => card === mission.status)?.[1] || mission.status;
    const matchesStatus = statusFilter === 'all' || dbStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: mappedMissions.length,
    inProgress: mappedMissions.filter(m => m.status === 'in_progress').length,
    planned: mappedMissions.filter(m => m.status === 'planned').length,
    delivered: mappedMissions.filter(m => m.status === 'delivered').length,
    totalWeight: mappedMissions.filter(m => m.status !== 'cancelled').reduce((acc, m) => acc + m.weight, 0),
    deliveredCost: missions.filter(m => m.status === 'completed').reduce((acc, m) => acc + (m.total_cost || 0), 0),
  };

  const handleView = (mission: MissionCardData) => {
    setSelectedMission(mission);
    setFormOpen(true);
  };

  const handleEdit = (mission: MissionCardData) => {
    setSelectedMission(mission);
    setFormOpen(true);
  };

  const handleStatusChange = (mission: MissionCardData, newStatus: 'delivered' | 'cancelled') => {
    const dbStatusMap: Record<string, 'pending' | 'in_progress' | 'completed' | 'cancelled'> = {
      delivered: 'completed',
      cancelled: 'cancelled',
    };
    updateMission.mutate({
      id: mission.id,
      status: dbStatusMap[newStatus],
    });
  };

  const handleFormSubmit = (data: any) => {
    const fuelCost = Number(data.fuelCost) || (Number(data.fuelQuantity) || 0) * (Number(data.pricePerLiter) || 0);
    const baseCost = (Number(data.cashAmount) || 0) + (Number(data.extraFees) || 0) + fuelCost;
    const discountAmount = Number(data.discountAmount) || baseCost * ((Number(data.discountRate) || 0) / 100);
    const afterDiscount = Math.max(baseCost - discountAmount, 0);
    const taxAmount = Number(data.taxAmount) || afterDiscount * ((Number(data.taxRate) || 0) / 100);
    const totalCost = Number(data.totalCost) || afterDiscount + taxAmount;
    if (selectedMission) {
      updateMission.mutate({
        id: selectedMission.id,
        departure_zone: data.origin,
        arrival_zone: data.destination,
        mission_date: data.departureDate,
        vehicle_id: data.vehicleId,
        driver_id: data.driverId || null,
        notes: buildMissionNotes({ client: data.client, notes: data.notes }),
        fuel_quantity: Number(data.fuelQuantity) || 0,
        price_per_liter: Number(data.pricePerLiter) || 0,
        fuel_cost: fuelCost,
        cash_amount: Number(data.cashAmount) || 0,
        extra_fees: Number(data.extraFees) || 0,
        discount_rate: Number(data.discountRate) || 0,
        discount_amount: discountAmount,
        tax_rate: Number(data.taxRate) || 0,
        tax_amount: taxAmount,
        total_cost: totalCost,
      }, {
        onSuccess: () => refetch(),
      });
    } else {
      createMission.mutate({
        departure_zone: data.origin,
        arrival_zone: data.destination,
        mission_date: data.departureDate,
        vehicle_id: data.vehicleId,
        driver_id: data.driverId || null,
        notes: buildMissionNotes({ client: data.client, notes: data.notes }),
        status: 'pending',
        fuel_quantity: Number(data.fuelQuantity) || 0,
        price_per_liter: Number(data.pricePerLiter) || 0,
        fuel_cost: fuelCost,
        cash_amount: Number(data.cashAmount) || 0,
        extra_fees: Number(data.extraFees) || 0,
        discount_rate: Number(data.discountRate) || 0,
        discount_amount: discountAmount,
        tax_rate: Number(data.taxRate) || 0,
        tax_amount: taxAmount,
        total_cost: totalCost,
      }, {
        onSuccess: () => refetch(),
      });
    }
    setSelectedMission(undefined);
  };

  const handleDelete = (mission: MissionCardData) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette mission ?')) {
      deleteMission.mutate(mission.id, {
        onSuccess: () => refetch(),
      });
    }
  };

  const openNewMissionForm = () => {
    setSelectedMission(undefined);
    setFormOpen(true);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <ErrorBoundary>
        <div className="space-y-6">
          {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('nav.missions')}</h1>
            <p className="text-muted-foreground">Gestion des missions de transport</p>
            <p className="text-sm text-muted-foreground">
              Société: {companyProfile?.company_name || 'Non renseignée'}
            </p>
          </div>
          <Button onClick={openNewMissionForm} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvelle mission
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="dashboard-panel">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="dashboard-panel">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Truck className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.inProgress}</p>
                  <p className="text-xs text-muted-foreground">En cours</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="dashboard-panel">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.planned}</p>
                  <p className="text-xs text-muted-foreground">Planifiées</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="dashboard-panel">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.delivered}</p>
                  <p className="text-xs text-muted-foreground">Livrées</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="dashboard-panel">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <TrendingUp className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{(stats.totalWeight / 1000).toFixed(1)}t</p>
                  <p className="text-xs text-muted-foreground">Tonnage</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="dashboard-panel">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {(stats.deliveredCost / 1000).toFixed(1)}k
                  </p>
                  <p className="text-xs text-muted-foreground">Coût missions livrées (MAD)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={viewMode} onValueChange={setViewMode} className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <TabsList>
              <TabsTrigger value="list" className="gap-2">
                <List className="h-4 w-4" />
                Liste
              </TabsTrigger>
              <TabsTrigger value="kanban" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                Kanban
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                Calendrier
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                Analytique
              </TabsTrigger>
            </TabsList>

            {viewMode === 'list' && (
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                  <TabsList>
                    <TabsTrigger value="all">Toutes</TabsTrigger>
                    <TabsTrigger value="pending">Planifiées</TabsTrigger>
                    <TabsTrigger value="in_progress">En cours</TabsTrigger>
                    <TabsTrigger value="completed">Livrées</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}
          </div>

          <TabsContent value="list" className="space-y-4">
            {filteredMissions.length === 0 ? (
              <Card className="dashboard-panel">
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium text-foreground mb-1">Aucune mission trouvée</h3>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery || statusFilter !== 'all'
                      ? 'Essayez de modifier vos critères de recherche'
                      : 'Créez votre première mission de transport'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredMissions.map((mission) => (
                  <MissionCard
                    key={mission.id}
                    mission={mission}
                    onView={handleView}
                    onEdit={handleEdit}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="kanban">
            <MissionKanban
              missions={filteredMissions} // Can apply filters to kanban too if desired, or use mappedMissions for full view
              onView={handleView}
              onEdit={handleEdit}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          </TabsContent>

          <TabsContent value="calendar">
            <MissionCalendar
              missions={mappedMissions}
              onView={handleView}
              onEdit={handleEdit}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          </TabsContent>

          <TabsContent value="analytics">
            <MissionCostPanel missions={missions} />
          </TabsContent>
        </Tabs>

        {/* Mission Form Dialog */}
        <MissionForm
          open={formOpen}
          onOpenChange={setFormOpen}
          mission={selectedMission}
          onSubmit={handleFormSubmit}
        />
      </div>
      </ErrorBoundary>
    </DashboardLayout>
  );
}
