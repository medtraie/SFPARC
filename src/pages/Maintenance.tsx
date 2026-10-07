import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { WorkOrderCard } from '@/components/maintenance/WorkOrderCard';
import { WorkOrderForm } from '@/components/maintenance/WorkOrderForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  Wrench,
  Clock,
  CheckCircle,
  DollarSign,
  ClipboardList,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import {
  useMaintenance,
  useCreateMaintenance,
  useUpdateMaintenance,
  useDeleteMaintenance,
  MaintenanceRecord,
} from '@/hooks/useMaintenance';
import { useGPSwoxVehicles } from '@/hooks/useGPSwoxVehicles';
import { consumeInternalStock } from '@/services/stockService';
import { toast } from 'sonner';

// Map DB maintenance to card format
interface WorkOrderCardData {
  id: string;
  reference: string;
  vehicleId: string;
  type: 'preventive' | 'corrective' | 'inspection';
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  description: string;
  assignedTo: string;
  createdDate: string;
  scheduledDate: string;
  diagnosis?: string;
  garage?: string;
  notes?: string;
  completedDate?: string;
  laborCost: number;
  partsCost: number;
  totalCost: number;
  parts: Array<{ name: string; quantity: number; unitPrice: number; stockItemId?: string | null }>;
}

function mapDBToCard(m: MaintenanceRecord): WorkOrderCardData {
  const statusMap: Record<string, 'pending' | 'in_progress' | 'completed' | 'cancelled'> = {
    scheduled: 'pending',
    in_progress: 'in_progress',
    completed: 'completed',
    cancelled: 'cancelled',
  };
  const parts = Array.isArray(m.parts) ? m.parts : [];
  const laborCost = Number(m.labor_cost) || 0;
  const partsCost = Number(m.parts_cost) || 0;
  const totalCost = Number(m.cost) || laborCost + partsCost;
  return {
    id: m.id,
    reference: `OT-${m.id.substring(0, 8).toUpperCase()}`,
    vehicleId: m.vehicle_id,
    type: m.work_order_type || 'corrective',
    priority: m.priority || 'medium',
    status: statusMap[m.status] || 'pending',
    description: m.maintenance_type,
    assignedTo: 'Technicien',
    createdDate: m.created_at,
    scheduledDate: m.maintenance_date,
    diagnosis: m.diagnosis || undefined,
    garage: m.garage || undefined,
    notes: m.notes || undefined,
    completedDate: m.completed_at || (m.status === 'completed' ? m.updated_at : undefined),
    laborCost,
    partsCost,
    totalCost,
    parts,
  };
}

export default function Maintenance() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderCardData | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<WorkOrderCardData | null>(null);
  const [activeTab, setActiveTab] = useState('orders');

  const { data: maintenanceRecords = [], isLoading, refetch } = useMaintenance();
  const { data: vehicles = [] } = useGPSwoxVehicles();
  const createMaintenance = useCreateMaintenance();
  const updateMaintenance = useUpdateMaintenance();
  const deleteMaintenance = useDeleteMaintenance();

  const workOrders = useMemo(() => maintenanceRecords.map(mapDBToCard), [maintenanceRecords]);
  const vehicleById = useMemo(
    () => new Map(vehicles.map((vehicle) => [String(vehicle.id), vehicle])),
    [vehicles],
  );
  const today = new Date().toISOString().split('T')[0];

  // Stats
  const stats = {
    pending: workOrders.filter(wo => wo.status === 'pending').length,
    inProgress: workOrders.filter(wo => wo.status === 'in_progress').length,
    completed: workOrders.filter(wo => wo.status === 'completed').length,
    overdue: workOrders.filter(wo => wo.status !== 'completed' && wo.status !== 'cancelled' && wo.scheduledDate < today).length,
    totalCost: workOrders.reduce((acc, wo) => acc + wo.totalCost, 0),
  };

  const filteredWorkOrders = workOrders.filter((wo) => {
    const vehicle = vehicles.find(v => String(v.id) === wo.vehicleId);
    const matchesSearch =
      wo.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wo.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle?.plate.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || wo.status === statusFilter;
    const matchesType = typeFilter === 'all' || wo.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const handleDelete = (wo: WorkOrderCardData) => {
    setOrderToDelete(wo);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (orderToDelete) {
      deleteMaintenance.mutate(orderToDelete.id, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setOrderToDelete(null);
          refetch();
        },
      });
    }
  };

  const handleEdit = (wo: WorkOrderCardData) => {
    setSelectedWorkOrder(wo);
    setFormOpen(true);
  };

  const handleComplete = (wo: WorkOrderCardData) => {
    updateMaintenance.mutate({
      id: wo.id,
      status: 'completed',
      completed_at: new Date().toISOString(),
    }, {
      onSuccess: () => refetch(),
    });
  };

  const handleStart = (wo: WorkOrderCardData) => {
    updateMaintenance.mutate({
      id: wo.id,
      status: 'in_progress',
      completed_at: null,
    }, {
      onSuccess: () => refetch(),
    });
  };

  const handleFormSubmit = async (data: any) => {
    try {
      const laborCost = data.laborCost || 0;
      const parts = data.parts || [];

      const stockParts = parts.filter((p: any) => p.stockItemId);
      const manualParts = parts.filter((p: any) => !p.stockItemId);

      let internalStockCost = 0;

      const vehicle = vehicles.find(v => String(v.id) === data.vehicleId);
      const vehicleLabel = vehicle?.plate || data.vehicleId;

      for (const part of stockParts) {
        const quantity = Number(part.quantity) || 0;
        if (!part.stockItemId || quantity <= 0) continue;
        const { cost } = await consumeInternalStock(
          part.stockItemId,
          quantity,
          `Maintenance véhicule ${vehicleLabel} - ${data.description}`,
        );
        internalStockCost += cost;
      }

      const manualPartsCost = manualParts.reduce(
        (acc: number, p: any) => acc + (Number(p.quantity) || 0) * (Number(p.unitPrice) || 0),
        0,
      );

      const totalCost = laborCost + internalStockCost + manualPartsCost;

      if (selectedWorkOrder) {
        await updateMaintenance.mutateAsync({
          id: selectedWorkOrder.id,
          maintenance_type: data.description,
          work_order_type: data.type,
          priority: data.priority,
          maintenance_date: data.scheduledDate,
          vehicle_id: data.vehicleId,
          diagnosis: data.diagnosis || null,
          garage: data.garage || null,
          labor_cost: laborCost,
          parts_cost: internalStockCost + manualPartsCost,
          parts,
          cost: totalCost,
          notes: data.notes || null,
          completed_at: selectedWorkOrder.status === 'completed' ? selectedWorkOrder.completedDate || new Date().toISOString() : null,
        });
      } else {
        await createMaintenance.mutateAsync({
          maintenance_type: data.description,
          work_order_type: data.type,
          priority: data.priority,
          maintenance_date: data.scheduledDate,
          vehicle_id: data.vehicleId,
          diagnosis: data.diagnosis || null,
          garage: data.garage || null,
          labor_cost: laborCost,
          parts_cost: internalStockCost + manualPartsCost,
          parts,
          cost: totalCost,
          notes: data.notes || null,
          status: 'scheduled',
          completed_at: null,
        });
      }
      refetch();
      setSelectedWorkOrder(undefined);
    } catch (error: any) {
      console.error('Error while saving maintenance with stock consumption', error);
      toast.error(error?.message || 'Erreur lors de l’enregistrement de la maintenance');
      throw error;
    }
  };

  const openNewForm = () => {
    setSelectedWorkOrder(undefined);
    setFormOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-MA').format(amount) + ' MAD';
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('nav.maintenance')}</h1>
            <p className="text-muted-foreground">Gestion de la maintenance préventive et corrective</p>
          </div>
          <Button onClick={openNewForm} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvel ordre de travail
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="dashboard-panel">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">En attente</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="dashboard-panel">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Wrench className="h-5 w-5 text-amber-600" />
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
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                  <p className="text-xs text-muted-foreground">Terminés</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="dashboard-panel">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{(stats.totalCost/1000).toFixed(1)}k</p>
                  <p className="text-xs text-muted-foreground">MAD Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="dashboard-panel">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.overdue}</p>
                  <p className="text-xs text-muted-foreground">En retard</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="orders" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Ordres de travail
            </TabsTrigger>
          </TabsList>

          {/* Work Orders Tab */}
          <TabsContent value="orders" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="completed">Terminés</SelectItem>
                  <SelectItem value="cancelled">Annulés</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tous les types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="preventive">Préventif</SelectItem>
                  <SelectItem value="corrective">Correctif</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredWorkOrders.length === 0 ? (
              <Card className="dashboard-panel">
                <CardContent className="py-12 text-center">
                  <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium text-foreground mb-1">Aucun ordre de travail</h3>
                  <p className="text-sm text-muted-foreground">Créez votre premier ordre de travail</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredWorkOrders.map((wo) => {
                  const vehicle = vehicleById.get(wo.vehicleId);
                  return (
                  <WorkOrderCard
                    key={wo.id}
                    workOrder={wo}
                    vehiclePlate={vehicle?.plate}
                    vehicleSubtitle={`${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim()}
                    overdue={wo.status !== 'completed' && wo.status !== 'cancelled' && wo.scheduledDate < today}
                    onEdit={handleEdit}
                    onStart={handleStart}
                    onComplete={handleComplete}
                    onDelete={handleDelete}
                  />
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Work Order Form Dialog */}
        <WorkOrderForm
          open={formOpen}
          onOpenChange={setFormOpen}
          workOrder={selectedWorkOrder}
          onSubmit={handleFormSubmit}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. Cela supprimera définitivement l'ordre de travail {orderToDelete?.reference}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
