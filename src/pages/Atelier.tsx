import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAtelier, AtelierActivityType, AtelierPriority, AtelierStatus } from '@/hooks/useAtelier';
import { useGPSwoxVehicles } from '@/hooks/useGPSwoxVehicles';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Wrench,
  Hammer,
  Cog,
  Cpu,
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  Boxes,
  Truck,
  User,
  ShieldCheck,
  Activity,
  PackagePlus,
  Trash2,
  Eye,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

export default function Atelier() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const {
    workOrders,
    machines,
    boms,
    metrics,
    createWorkOrder,
    updateWorkOrderStatus,
    createMachine,
    createBOM,
  } = useAtelier();

  const { data: vehicles = [] } = useGPSwoxVehicles();

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');

  // Modals state
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isNewMachineOpen, setIsNewMachineOpen] = useState(false);
  const [isNewBOMOpen, setIsNewBOMOpen] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any>(null);

  // Form State for New Work Order
  const [orderForm, setOrderForm] = useState({
    title: '',
    activity_type: 'maintenance' as AtelierActivityType,
    priority: 'medium' as AtelierPriority,
    status: 'planned' as AtelierStatus,
    vehicle_id: '',
    asset_name: '',
    client_or_department: '',
    assigned_technician: '',
    start_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    estimated_hours: 3,
    hourly_rate: 160,
    description: '',
    diagnostic: '',
    solution: '',
  });

  // Items / Parts inside Order Form
  const [formItems, setFormItems] = useState<Array<{
    name: string;
    reference: string;
    category: any;
    quantity: number;
    unit: string;
    unit_price: number;
  }>>([]);

  const [newItem, setNewItem] = useState({
    name: '',
    reference: '',
    category: 'spare_part',
    quantity: 1,
    unit: 'unité',
    unit_price: 100,
  });

  const handleAddItem = () => {
    if (!newItem.name.trim()) {
      toast.error('Veuillez entrer le nom de la pièce ou du consommable');
      return;
    }
    setFormItems((prev) => [
      ...prev,
      {
        ...newItem,
        quantity: Number(newItem.quantity) || 1,
        unit_price: Number(newItem.unit_price) || 0,
      },
    ]);
    setNewItem({
      name: '',
      reference: '',
      category: 'spare_part',
      quantity: 1,
      unit: 'unité',
      unit_price: 100,
    });
  };

  const handleRemoveItem = (index: number) => {
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForm.title.trim()) {
      toast.error('Veuillez saisir le titre de l intervention');
      return;
    }

    let finalAssetName = orderForm.asset_name;
    if (orderForm.vehicle_id) {
      const v = vehicles.find((veh) => veh.id === orderForm.vehicle_id);
      if (v) {
        finalAssetName = `${v.plate} - ${v.brand || ''} ${v.model || ''}`;
      }
    }

    const formattedItems = formItems.map((it) => ({
      id: `it-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: it.name,
      reference: it.reference,
      category: it.category,
      quantity: it.quantity,
      unit: it.unit,
      unit_price: it.unit_price,
      total_price: it.quantity * it.unit_price,
    }));

    await createWorkOrder(
      {
        ...orderForm,
        asset_name: finalAssetName || 'Équipement Atelier',
        estimated_hours: Number(orderForm.estimated_hours) || 2,
        hourly_rate: Number(orderForm.hourly_rate) || 160,
      },
      formattedItems
    );

    setIsNewOrderOpen(false);
    // Reset form
    setOrderForm({
      title: '',
      activity_type: 'maintenance',
      priority: 'medium',
      status: 'planned',
      vehicle_id: '',
      asset_name: '',
      client_or_department: '',
      assigned_technician: '',
      start_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
      estimated_hours: 3,
      hourly_rate: 160,
      description: '',
      diagnostic: '',
      solution: '',
    });
    setFormItems([]);
  };

  // Form State for Machine
  const [machineForm, setMachineForm] = useState({
    code: '',
    name: '',
    type: 'machine' as any,
    location: '',
    status: 'operational' as any,
    hour_meter: 0,
    notes: '',
  });

  const handleCreateMachineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machineForm.name.trim() || !machineForm.code.trim()) {
      toast.error('Veuillez remplir le code et le nom de l équipement');
      return;
    }
    await createMachine({
      ...machineForm,
      hour_meter: Number(machineForm.hour_meter) || 0,
    });
    setIsNewMachineOpen(false);
    setMachineForm({
      code: '',
      name: '',
      type: 'machine',
      location: '',
      status: 'operational',
      hour_meter: 0,
      notes: '',
    });
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return workOrders.filter((order) => {
      const matchSearch =
        searchQuery === '' ||
        order.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.asset_name && order.asset_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (order.assigned_technician && order.assigned_technician.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchActivity = selectedActivity === 'all' || order.activity_type === selectedActivity;
      const matchStatus = selectedStatus === 'all' || order.status === selectedStatus;
      const matchPriority = selectedPriority === 'all' || order.priority === selectedPriority;

      return matchSearch && matchActivity && matchStatus && matchPriority;
    });
  }, [workOrders, searchQuery, selectedActivity, selectedStatus, selectedPriority]);

  const getActivityBadge = (type: AtelierActivityType) => {
    switch (type) {
      case 'manufacturing':
        return <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40">Fabrication</Badge>;
      case 'maintenance':
        return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40">Maintenance</Badge>;
      case 'repair':
        return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">Réparation</Badge>;
      case 'inspection':
        return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">Inspection</Badge>;
      default:
        return <Badge className="bg-slate-500/20 text-slate-300 border-slate-500/40">Autre</Badge>;
    }
  };

  const getStatusBadge = (status: AtelierStatus) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40">Terminé</Badge>;
      case 'in_progress':
        return <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse">En Cours</Badge>;
      case 'planned':
        return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">Planifié</Badge>;
      case 'quality_check':
        return <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40">Contrôle Qualité</Badge>;
      default:
        return <Badge className="bg-slate-500/20 text-slate-300 border-slate-500/40">Brouillon</Badge>;
    }
  };

  const getPriorityBadge = (priority: AtelierPriority) => {
    switch (priority) {
      case 'urgent':
        return <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/50">Urgent</Badge>;
      case 'high':
        return <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/40">Élevée</Badge>;
      case 'medium':
        return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40">Moyenne</Badge>;
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/40">Basse</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header Banner with High-End Futuristic Atelier Aesthetics */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0B132B] via-[#1C2541] to-[#0B132B] border border-cyan-500/20 p-6 md:p-8 shadow-2xl">
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                  <Wrench className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-wide flex items-center gap-2">
                    Gestion Atelier & Fabrication
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                      Smart Industry 4.0
                    </span>
                  </h1>
                  <p className="text-sm text-slate-300 mt-1">
                    Supervision complète des interventions, fabrications sur mesure, consommations de pièces et parc machines
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => setIsNewBOMOpen(true)}
                variant="outline"
                className="bg-purple-950/40 border-purple-500/40 text-purple-200 hover:bg-purple-900/60 rounded-xl"
              >
                <Layers className="w-4 h-4 mr-2 text-purple-400" />
                Nomenclature (BOM)
              </Button>
              <Button
                onClick={() => setIsNewMachineOpen(true)}
                variant="outline"
                className="bg-slate-900/80 border-white/10 text-slate-200 hover:bg-white/10 rounded-xl"
              >
                <Cpu className="w-4 h-4 mr-2 text-cyan-400" />
                Ajouter Équipement
              </Button>
              <Button
                onClick={() => setIsNewOrderOpen(true)}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl shadow-lg shadow-cyan-500/25"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nouvel Ordre de Travail (OT)
              </Button>
            </div>
          </div>

          {/* 4 Executive Metric Tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>OT ACTIFS</span>
                <Clock className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-black text-white mt-1">{metrics.activeOrders}</div>
              <div className="text-[11px] text-cyan-400/80 mt-1">Sur {metrics.totalOrders} ordres au total</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>URGENCES EN COURS</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-black text-rose-400 mt-1">{metrics.urgentOrders}</div>
              <div className="text-[11px] text-slate-400 mt-1">Priorité élevée ou critique</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>PARC MACHINES</span>
                <Cpu className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-white mt-1">
                {metrics.machinesInUse} <span className="text-sm font-normal text-slate-400">/ {metrics.totalMachines} en charge</span>
              </div>
              <div className="text-[11px] text-emerald-400 mt-1">{metrics.machinesMaintenance} sous révision</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>VALEUR DÉPENSES ATELIER</span>
                <DollarSign className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-400 mt-1">
                {metrics.totalCosts.toLocaleString('fr-MA')} <span className="text-xs">MAD</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">{metrics.totalLaborHours.toFixed(1)} heures M.O. cumulées</div>
            </div>
          </div>
        </div>

        {/* Workspace Tabs: Ordres de Travail, Machines & Postes, Nomenclatures BOM */}
        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList className="bg-[#0E1626] border border-white/[0.08] p-1 rounded-2xl">
            <TabsTrigger value="orders" className="rounded-xl data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
              <Hammer className="w-4 h-4 mr-2" />
              Ordres de Travail (OT)
            </TabsTrigger>
            <TabsTrigger value="machines" className="rounded-xl data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
              <Cpu className="w-4 h-4 mr-2" />
              Parc Machines & Postes
            </TabsTrigger>
            <TabsTrigger value="boms" className="rounded-xl data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
              <Layers className="w-4 h-4 mr-2" />
              Nomenclatures Fabrication (BOM)
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: WORK ORDERS */}
          <TabsContent value="orders" className="space-y-6">
            {/* Search & Filters */}
            <Card className="bg-[#0E1626]/80 border-white/[0.08] rounded-2xl p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="relative lg:col-span-2">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Rechercher par référence, titre, véhicule ou technicien..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-[#070B16] border-white/10 rounded-xl text-xs text-white"
                  />
                </div>

                <Select value={selectedActivity} onValueChange={setSelectedActivity}>
                  <SelectTrigger className="bg-[#070B16] border-white/10 rounded-xl text-xs text-slate-200">
                    <SelectValue placeholder="Activité" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0E1626] border-white/10 text-white">
                    <SelectItem value="all">Toutes activités</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="manufacturing">Fabrication</SelectItem>
                    <SelectItem value="repair">Réparation</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="bg-[#070B16] border-white/10 rounded-xl text-xs text-slate-200">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0E1626] border-white/10 text-white">
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="planned">Planifié</SelectItem>
                    <SelectItem value="in_progress">En cours</SelectItem>
                    <SelectItem value="quality_check">Contrôle Qualité</SelectItem>
                    <SelectItem value="completed">Terminé</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                  <SelectTrigger className="bg-[#070B16] border-white/10 rounded-xl text-xs text-slate-200">
                    <SelectValue placeholder="Priorité" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0E1626] border-white/10 text-white">
                    <SelectItem value="all">Toutes priorités</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">Élevée</SelectItem>
                    <SelectItem value="medium">Moyenne</SelectItem>
                    <SelectItem value="low">Basse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {/* Orders Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredOrders.length === 0 ? (
                <div className="col-span-full py-16 text-center text-slate-400 bg-[#0E1626]/40 rounded-3xl border border-white/[0.05]">
                  <Wrench className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                  <p className="text-base font-semibold text-slate-300">Aucun ordre de travail correspondant</p>
                  <p className="text-xs text-slate-500 mt-1">Créez un nouvel ordre ou modifiez les critères de recherche.</p>
                </div>
              ) : (
                filteredOrders.map((order) => (
                  <Card
                    key={order.id}
                    className="bg-[#0E1626]/90 border-white/[0.08] hover:border-cyan-500/40 transition-all duration-300 rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between group"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="p-5 border-b border-white/[0.06] bg-white/[0.02]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-xs font-bold text-cyan-400 tracking-wider">
                            {order.reference}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {getActivityBadge(order.activity_type)}
                            {getPriorityBadge(order.priority)}
                          </div>
                        </div>
                        <h3 className="font-bold text-base text-white line-clamp-1 group-hover:text-cyan-300 transition-colors">
                          {order.title}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate">{order.asset_name || 'Équipement Atelier'}</span>
                        </p>
                      </div>

                      {/* Card Body */}
                      <div className="p-5 space-y-3.5 text-xs text-slate-300">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" /> Responsable:
                          </span>
                          <span className="font-medium text-slate-200 truncate max-w-[170px]">
                            {order.assigned_technician || 'Non assigné'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" /> Échéance:
                          </span>
                          <span className="font-mono text-slate-200">
                            {order.due_date || 'N/A'}
                          </span>
                        </div>

                        <div className="p-3 rounded-2xl bg-black/20 border border-white/[0.05] grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Main d'œuvre</span>
                            <span className="font-semibold text-slate-200">
                              {order.actual_hours || order.estimated_hours}h ({order.labor_cost} MAD)
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Pièces & Matériaux</span>
                            <span className="font-semibold text-slate-200">
                              {((order.parts_cost || 0) + (order.consumables_cost || 0)).toLocaleString('fr-MA')} MAD
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-slate-400">Coût Total Calculé:</span>
                          <span className="font-bold text-sm text-emerald-400 font-mono">
                            {order.total_cost.toLocaleString('fr-MA')} MAD
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer & Quick Status Controls */}
                    <div className="p-4 border-t border-white/[0.06] bg-black/20 flex items-center justify-between">
                      <div>{getStatusBadge(order.status)}</div>
                      <div className="flex items-center gap-2">
                        {order.status !== 'completed' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              updateWorkOrderStatus(
                                order.id,
                                order.status === 'planned' ? 'in_progress' : 'completed',
                                order.estimated_hours
                              )
                            }
                            className="h-8 px-2.5 text-xs text-cyan-300 hover:bg-cyan-500/20 rounded-xl"
                            title="Avancer le statut"
                          >
                            <Play className="w-3.5 h-3.5 mr-1" />
                            {order.status === 'planned' ? 'Démarrer' : 'Terminer'}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedOrderDetails(order)}
                          className="h-8 px-3 text-xs bg-white/[0.04] border-white/10 hover:bg-white/10 rounded-xl text-slate-200"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Détails
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* TAB 2: MACHINES & POSTES */}
          <TabsContent value="machines" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {machines.map((mach) => (
                <Card key={mach.id} className="bg-[#0E1626]/90 border-white/[0.08] rounded-3xl p-5 shadow-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-lg">
                        {mach.code}
                      </span>
                      <h3 className="font-bold text-base text-white mt-2">{mach.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Emplacement : {mach.location || 'Atelier Général'}</p>
                    </div>
                    <Badge
                      className={
                        mach.status === 'operational'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : mach.status === 'in_use'
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30 animate-pulse'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }
                    >
                      {mach.status}
                    </Badge>
                  </div>

                  <div className="mt-4 p-3 rounded-2xl bg-black/20 border border-white/[0.05] space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Compteur Horaire:</span>
                      <span className="font-mono font-bold text-slate-200">{mach.hour_meter} heures</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Dernière Maintenance:</span>
                      <span className="text-slate-200">{mach.last_maintenance || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Prochaine Échéance:</span>
                      <span className="text-amber-400 font-semibold">{mach.next_maintenance || 'N/A'}</span>
                    </div>
                  </div>

                  {mach.notes && <p className="text-xs text-slate-400 italic mt-3">{mach.notes}</p>}
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* TAB 3: NOMENCLATURES (BOM) */}
          <TabsContent value="boms" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {boms.map((bom) => (
                <Card key={bom.id} className="bg-[#0E1626]/90 border-white/[0.08] rounded-3xl p-6 shadow-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 rounded-lg">
                          {bom.code}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">v{bom.version}</span>
                      </div>
                      <h3 className="font-bold text-lg text-white mt-2">{bom.name}</h3>
                      <p className="text-xs text-emerald-400 font-semibold">Produit cible : {bom.target_item_name}</p>
                    </div>
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                      M.O. : {bom.labor_hours}h
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-400 mt-2">{bom.description}</p>

                  <div className="mt-4 border-t border-white/[0.06] pt-3">
                    <span className="text-xs font-bold text-slate-300 block mb-2">Composants requis (Nomenclature) :</span>
                    <div className="space-y-1.5">
                      {bom.components.map((comp, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-black/20 text-xs">
                          <span className="text-slate-300 font-medium">
                            {comp.name} {comp.reference && <span className="text-slate-500 font-mono">({comp.reference})</span>}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-cyan-400">
                              {comp.quantity} {comp.unit}
                            </span>
                            <span className="font-mono text-slate-400">{comp.estimated_cost} MAD</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* DIALOG: CREATE NEW WORK ORDER (OT) */}
        <Dialog open={isNewOrderOpen} onOpenChange={setIsNewOrderOpen}>
          <DialogContent className="max-w-2xl bg-[#0E1626] border-white/10 text-white rounded-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Wrench className="w-5 h-5 text-cyan-400" />
                Créer un Ordre de Travail (OT)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Planification des travaux, interventions de maintenance, fabrications et consommations de pièces.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateOrderSubmit} className="space-y-4 text-xs mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Titre de l'intervention *</Label>
                  <Input
                    required
                    placeholder="Ex: Révision générale 100K km / Fabrication ridelle"
                    value={orderForm.title}
                    onChange={(e) => setOrderForm({ ...orderForm, title: e.target.value })}
                    className="bg-[#070B16] border-white/10 text-white rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Type d'activité</Label>
                  <Select
                    value={orderForm.activity_type}
                    onValueChange={(val: any) => setOrderForm({ ...orderForm, activity_type: val })}
                  >
                    <SelectTrigger className="bg-[#070B16] border-white/10 text-white rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0E1626] border-white/10 text-white">
                      <SelectItem value="maintenance">Maintenance Préventive/Corrective</SelectItem>
                      <SelectItem value="manufacturing">Fabrication & Usinage</SelectItem>
                      <SelectItem value="repair">Réparation & Dépannage</SelectItem>
                      <SelectItem value="inspection">Inspection & Diagnostic</SelectItem>
                      <SelectItem value="customization">Aménagement / Adaptation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Priorité</Label>
                  <Select
                    value={orderForm.priority}
                    onValueChange={(val: any) => setOrderForm({ ...orderForm, priority: val })}
                  >
                    <SelectTrigger className="bg-[#070B16] border-white/10 text-white rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0E1626] border-white/10 text-white">
                      <SelectItem value="low">Basse</SelectItem>
                      <SelectItem value="medium">Moyenne</SelectItem>
                      <SelectItem value="high">Élevée</SelectItem>
                      <SelectItem value="urgent">Urgent / Bloquant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Véhicule de la flotte (si applicable)</Label>
                  <Select
                    value={orderForm.vehicle_id}
                    onValueChange={(val) => setOrderForm({ ...orderForm, vehicle_id: val })}
                  >
                    <SelectTrigger className="bg-[#070B16] border-white/10 text-white rounded-xl">
                      <SelectValue placeholder="Sélectionner véhicule..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0E1626] border-white/10 text-white">
                      <SelectItem value="">Aucun (Équipement externe)</SelectItem>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.plate} ({v.brand} {v.model})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Nom équipement / machine / pièce</Label>
                  <Input
                    placeholder="Ex: Pont BTP Actros / Pompe injection"
                    value={orderForm.asset_name}
                    onChange={(e) => setOrderForm({ ...orderForm, asset_name: e.target.value })}
                    className="bg-[#070B16] border-white/10 text-white rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Technicien assigné</Label>
                  <Input
                    placeholder="Nom du mécanicien / chaudronnier"
                    value={orderForm.assigned_technician}
                    onChange={(e) => setOrderForm({ ...orderForm, assigned_technician: e.target.value })}
                    className="bg-[#070B16] border-white/10 text-white rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Date d'échéance</Label>
                  <Input
                    type="date"
                    value={orderForm.due_date}
                    onChange={(e) => setOrderForm({ ...orderForm, due_date: e.target.value })}
                    className="bg-[#070B16] border-white/10 text-white rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Heures estimées M.O.</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={orderForm.estimated_hours}
                    onChange={(e) => setOrderForm({ ...orderForm, estimated_hours: Number(e.target.value) })}
                    className="bg-[#070B16] border-white/10 text-white rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Taux horaire M.O. (MAD)</Label>
                  <Input
                    type="number"
                    value={orderForm.hourly_rate}
                    onChange={(e) => setOrderForm({ ...orderForm, hourly_rate: Number(e.target.value) })}
                    className="bg-[#070B16] border-white/10 text-white rounded-xl"
                  />
                </div>
              </div>

              {/* PARTS & CONSUMABLES SECTION */}
              <div className="p-3.5 rounded-2xl bg-black/30 border border-white/[0.08] space-y-3">
                <span className="font-bold text-cyan-400 block flex items-center gap-1.5">
                  <Boxes className="w-4 h-4" /> Pièces de rechange & Consommables consommés
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <Input
                    placeholder="Nom pièce/matériau"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    className="bg-[#070B16] border-white/10 text-xs sm:col-span-2 rounded-xl"
                  />
                  <Input
                    type="number"
                    placeholder="Qté"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
                    className="bg-[#070B16] border-white/10 text-xs rounded-xl"
                  />
                  <div className="flex gap-1.5">
                    <Input
                      type="number"
                      placeholder="Prix U"
                      value={newItem.unit_price}
                      onChange={(e) => setNewItem({ ...newItem, unit_price: Number(e.target.value) })}
                      className="bg-[#070B16] border-white/10 text-xs rounded-xl"
                    />
                    <Button type="button" onClick={handleAddItem} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-2.5 rounded-xl">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {formItems.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {formItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.04] text-xs">
                        <span>
                          {item.name} ({item.quantity} x {item.unit_price} MAD)
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-emerald-400">{item.quantity * item.unit_price} MAD</span>
                          <button type="button" onClick={() => handleRemoveItem(idx)} className="text-rose-400 hover:text-rose-300">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Description des travaux / Diagnostic</Label>
                <Textarea
                  placeholder="Détails du problème, constat et opérations techniques à effectuer..."
                  value={orderForm.description}
                  onChange={(e) => setOrderForm({ ...orderForm, description: e.target.value })}
                  className="bg-[#070B16] border-white/10 text-white rounded-xl"
                  rows={2}
                />
              </div>

              <DialogFooter className="mt-4">
                <Button type="button" variant="ghost" onClick={() => setIsNewOrderOpen(false)} className="rounded-xl">
                  Annuler
                </Button>
                <Button type="submit" className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl">
                  Enregistrer l'ordre de travail
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* DIALOG: ORDER DETAILS */}
        {selectedOrderDetails && (
          <Dialog open={!!selectedOrderDetails} onOpenChange={() => setSelectedOrderDetails(null)}>
            <DialogContent className="max-w-xl bg-[#0E1626] border-white/10 text-white rounded-3xl">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-cyan-400">{selectedOrderDetails.reference}</span>
                  {getStatusBadge(selectedOrderDetails.status)}
                </div>
                <DialogTitle className="text-lg font-bold text-white mt-1">{selectedOrderDetails.title}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 text-xs mt-2 text-slate-300">
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-black/30 border border-white/[0.05]">
                  <div>
                    <span className="text-slate-400 block">Équipement:</span>
                    <span className="font-semibold text-white">{selectedOrderDetails.asset_name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Technicien:</span>
                    <span className="font-semibold text-white">{selectedOrderDetails.assigned_technician || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Heures M.O.:</span>
                    <span className="font-semibold text-white">{selectedOrderDetails.actual_hours || selectedOrderDetails.estimated_hours}h</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Coût Global:</span>
                    <span className="font-bold text-emerald-400 font-mono text-sm">{selectedOrderDetails.total_cost} MAD</span>
                  </div>
                </div>

                {selectedOrderDetails.description && (
                  <div>
                    <span className="font-bold text-slate-300 block mb-1">Description & Opérations :</span>
                    <p className="p-3 rounded-xl bg-black/20 text-slate-300">{selectedOrderDetails.description}</p>
                  </div>
                )}

                {selectedOrderDetails.items && selectedOrderDetails.items.length > 0 && (
                  <div>
                    <span className="font-bold text-slate-300 block mb-1">Pièces & Matériaux consommés :</span>
                    <div className="space-y-1">
                      {selectedOrderDetails.items.map((it: any, idx: number) => (
                        <div key={idx} className="flex justify-between p-2 rounded-xl bg-black/20">
                          <span>{it.name} (x{it.quantity})</span>
                          <span className="font-mono text-emerald-400">{it.total_price || it.quantity * it.unit_price} MAD</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* DIALOG: CREATE MACHINE */}
        <Dialog open={isNewMachineOpen} onOpenChange={setIsNewMachineOpen}>
          <DialogContent className="max-w-md bg-[#0E1626] border-white/10 text-white rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Cpu className="w-5 h-5 text-cyan-400" />
                Ajouter un Équipement / Machine
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreateMachineSubmit} className="space-y-3.5 text-xs mt-2">
              <div className="space-y-1">
                <Label>Code Identifiant *</Label>
                <Input
                  required
                  placeholder="Ex: PONT-03 / CNC-MILL"
                  value={machineForm.code}
                  onChange={(e) => setMachineForm({ ...machineForm, code: e.target.value })}
                  className="bg-[#070B16] border-white/10 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label>Nom de la machine / poste *</Label>
                <Input
                  required
                  placeholder="Ex: Pont élévateur 5T / Banc de géométrie"
                  value={machineForm.name}
                  onChange={(e) => setMachineForm({ ...machineForm, name: e.target.value })}
                  className="bg-[#070B16] border-white/10 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select
                    value={machineForm.type}
                    onValueChange={(val) => setMachineForm({ ...machineForm, type: val })}
                  >
                    <SelectTrigger className="bg-[#070B16] border-white/10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0E1626] border-white/10 text-white">
                      <SelectItem value="machine">Machine outil</SelectItem>
                      <SelectItem value="lift">Pont élévateur</SelectItem>
                      <SelectItem value="cnc">Machine CNC</SelectItem>
                      <SelectItem value="welding">Poste soudure</SelectItem>
                      <SelectItem value="painting">Cabine peinture</SelectItem>
                      <SelectItem value="workstation">Établi / Poste</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Compteur (Heures)</Label>
                  <Input
                    type="number"
                    value={machineForm.hour_meter}
                    onChange={(e) => setMachineForm({ ...machineForm, hour_meter: Number(e.target.value) })}
                    className="bg-[#070B16] border-white/10 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Emplacement dans l'atelier</Label>
                <Input
                  placeholder="Ex: Baie A / Zone Chaudronnerie"
                  value={machineForm.location}
                  onChange={(e) => setMachineForm({ ...machineForm, location: e.target.value })}
                  className="bg-[#070B16] border-white/10 rounded-xl"
                />
              </div>

              <DialogFooter className="mt-4">
                <Button type="button" variant="ghost" onClick={() => setIsNewMachineOpen(false)} className="rounded-xl">
                  Annuler
                </Button>
                <Button type="submit" className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl">
                  Ajouter
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
