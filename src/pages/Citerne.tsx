import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import {
  Fuel,
  Droplets,
  TrendingUp,
  AlertTriangle,
  Plus,
  Truck,
  User,
  Loader2,
  Search,
  Trash2,
  FileText,
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import {
  useCiterne,
  useRecharges,
  usePleinsExterieur,
  useApprovisionnements,
  useCreateRecharge,
  useCreatePleinExterieur,
  useCreateApprovisionnement,
  useConsumptionAnalysis,
  useDeleteRecharge,
  useDeletePleinExterieur,
  useDeleteApprovisionnement,
} from '@/hooks/useCiterne';
import { useGPSwoxVehicles } from '@/hooks/useGPSwoxVehicles';
import { useDrivers } from '@/hooks/useDrivers';
import { toast } from '@/hooks/use-toast';

// ─── Animated Tank Gauge ─────────────────────────────────────────
function CiterneGauge({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.min((current / total) * 100, 100) : 0;
  const fillColor = pct > 80 ? '#22c55e' : pct >= 20 ? '#f59e0b' : '#ef4444';
  const borderColor = pct > 80 ? 'border-emerald-400' : pct >= 20 ? 'border-amber-400' : 'border-red-400';
  const glowColor = pct > 80 ? 'shadow-emerald-400/20' : pct >= 20 ? 'shadow-amber-400/20' : 'shadow-red-400/20';

  return (
    <Card className={`col-span-1 md:col-span-2 lg:col-span-1 overflow-hidden relative border-2 ${borderColor} shadow-xl ${glowColor}`}>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/5 pointer-events-none" />
      <CardContent className="p-6 flex flex-col items-center relative z-10 h-full justify-between">
        {/* Header */}
        <div className="flex items-center justify-between w-full mb-2">
          <div className="flex flex-col">
            <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
              <Fuel className="h-5 w-5" style={{ color: fillColor }} />
              Niveau Réservoir
            </h3>
            <span className="text-xs text-muted-foreground">Capacité: {total.toLocaleString()} L</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-3xl font-bold text-foreground" style={{ color: fillColor }}>{pct.toFixed(0)}%</span>
            <span className="text-xs font-medium text-muted-foreground">{current.toLocaleString()} L</span>
          </div>
        </div>

        {/* Tank Visualization */}
        <div className="relative w-full max-w-[200px] h-64 my-4 group cursor-pointer transition-transform hover:scale-105 duration-300">
          {/* Tank cap */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-slate-700 rounded-t-lg z-0 shadow-lg" />
          
          {/* Tank body */}
          <div className="absolute inset-0 rounded-2xl border-4 border-slate-200 bg-slate-50 overflow-hidden shadow-inner dark:bg-slate-900 dark:border-slate-700">
            {/* Glass reflection effect */}
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-white/20 to-transparent z-20 pointer-events-none" />
            
            {/* Level markers */}
            {[75, 50, 25].map(level => (
              <div
                key={level}
                className="absolute left-0 right-0 flex items-center z-20 opacity-50 group-hover:opacity-100 transition-opacity"
                style={{ bottom: `${level}%` }}
              >
                <div className="w-full border-t border-dashed border-slate-400/50" />
                <span className="absolute right-2 text-[10px] font-bold text-slate-500 bg-white/80 px-1 rounded shadow-sm">
                  {level}%
                </span>
              </div>
            ))}

            {/* Liquid */}
            <div
              className="absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-out z-10"
              style={{
                height: `${pct}%`,
                background: `linear-gradient(to top, ${fillColor}, ${fillColor}dd)`,
                boxShadow: `0 0 20px ${fillColor}66`
              }}
            >
              {/* Bubbles animation could go here */}
              <div className="absolute top-0 left-0 right-0 h-4 bg-white/30 animate-pulse" />
              
              {/* Wave SVG */}
              <div className="absolute -top-3 left-0 right-0 h-6 overflow-hidden">
                <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-[200%] h-full absolute animate-[wave_4s_linear_infinite]" style={{ fill: fillColor, opacity: 0.8 }}>
                    <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Status Alert */}
        <div className="w-full mt-2">
            {pct < 20 ? (
            <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse border border-red-200 dark:border-red-800">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-semibold">Niveau Critique!</span>
            </div>
            ) : pct < 40 ? (
            <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-semibold">Niveau Bas</span>
            </div>
            ) : (
            <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <span className="font-semibold">Niveau Optimal</span>
            </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Stat Card Component ─────────────────────────────────────────
function StatCard({ title, value, subtext, icon: Icon, trend, colorClass }: any) {
    return (
        <Card className="overflow-hidden relative">
            <div className={`absolute top-0 right-0 p-3 opacity-10 ${colorClass}`}>
                <Icon className="w-16 h-16" />
            </div>
            <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10`}>
                        <Icon className={`w-5 h-5 ${colorClass.replace('bg-', 'text-')}`} />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">{title}</span>
                </div>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl font-bold">{value}</h3>
                </div>
                {trend && (
                    <div className={`flex items-center text-xs mt-2 ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {trend > 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                        <span className="font-medium">{Math.abs(trend)}%</span>
                        <span className="text-muted-foreground ml-1">vs mois dernier</span>
                    </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">{subtext}</p>
            </CardContent>
        </Card>
    )
}

// ─── Main Page ───────────────────────────────────────────────────
export default function Citerne() {
  const { data: citerne, isLoading: citerneLoading } = useCiterne();
  const { data: recharges = [] } = useRecharges();
  const { data: pleins = [] } = usePleinsExterieur();
  const { data: approvs = [] } = useApprovisionnements();
  const { data: vehicles = [] } = useGPSwoxVehicles();
  const { data: drivers = [] } = useDrivers();
  const consumptionAnalyses = useConsumptionAnalysis();

  const createRecharge = useCreateRecharge();
  const createPlein = useCreatePleinExterieur();
  const createApprov = useCreateApprovisionnement();
  
  const deleteRecharge = useDeleteRecharge();
  const deletePlein = useDeletePleinExterieur();
  const deleteApprov = useDeleteApprovisionnement();

  const [rechargeDialogOpen, setRechargeDialogOpen] = useState(false);
  const [pleinDialogOpen, setPleinDialogOpen] = useState(false);
  const [approvDialogOpen, setApprovDialogOpen] = useState(false);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [rechargeForm, setRechargeForm] = useState({ vehicle_id: '', driver_id: '', quantite: '', kilometrage: '' });
  const [pleinForm, setPleinForm] = useState({ vehicle_id: '', driver_id: '', quantite: '', cout: '', station: '', kilometrage: '' });
  const [approvForm, setApprovForm] = useState({ quantite: '', cout: '', fournisseur: '' });

  const getVehiclePlate = (id: string) => vehicles.find(v => String(v.id) === id)?.plate || id;
  const getDriverName = (id: string | null) => {
    if (!id) return 'Non assigné';
    return drivers.find(d => d.id === id)?.name || 'Inconnu';
  };

  // ─── Handlers ────────────────────────────────────────────
  const handleRechargeSubmit = () => {
    if (!citerne || !rechargeForm.vehicle_id || !rechargeForm.quantite || !rechargeForm.kilometrage) return;
    createRecharge.mutate({
      citerne_id: citerne.id,
      vehicle_id: rechargeForm.vehicle_id,
      driver_id: rechargeForm.driver_id || null,
      quantite: Number(rechargeForm.quantite),
      kilometrage: Number(rechargeForm.kilometrage),
      date: new Date().toISOString().split('T')[0],
      notes: null,
    }, {
      onSuccess: () => {
        setRechargeDialogOpen(false);
        setRechargeForm({ vehicle_id: '', driver_id: '', quantite: '', kilometrage: '' });
      },
    });
  };

  const handlePleinSubmit = () => {
    if (!pleinForm.vehicle_id || !pleinForm.quantite) return;
    createPlein.mutate({
      vehicle_id: pleinForm.vehicle_id,
      driver_id: pleinForm.driver_id || null,
      date: new Date().toISOString().split('T')[0],
      quantite: Number(pleinForm.quantite),
      cout: Number(pleinForm.cout) || 0,
      station: pleinForm.station || null,
      kilometrage: Number(pleinForm.kilometrage) || 0,
      notes: null,
    }, {
      onSuccess: () => {
        setPleinDialogOpen(false);
        setPleinForm({ vehicle_id: '', driver_id: '', quantite: '', cout: '', station: '', kilometrage: '' });
      },
    });
  };

  const handleApprovSubmit = () => {
    if (!citerne || !approvForm.quantite) return;
    createApprov.mutate({
      citerne_id: citerne.id,
      quantite: Number(approvForm.quantite),
      cout: Number(approvForm.cout) || 0,
      fournisseur: approvForm.fournisseur || null,
      date: new Date().toISOString().split('T')[0],
      notes: null,
    }, {
      onSuccess: () => {
        setApprovDialogOpen(false);
        setApprovForm({ quantite: '', cout: '', fournisseur: '' });
      },
    });
  };

  // ─── Data Processing ─────────────────────────────────────
  const totalRechargesLiters = recharges.reduce((s, r) => s + Number(r.quantite), 0);
  const totalPleinsLiters = pleins.reduce((s, p) => s + Number(p.quantite), 0);
  const totalPleinsCost = pleins.reduce((s, p) => s + Number(p.cout), 0);
  const totalApprovLiters = approvs.reduce((s, a) => s + Number(a.quantite), 0);

  // Filtered data
  const filteredRecharges = recharges.filter(r => 
    getVehiclePlate(r.vehicle_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
    getDriverName(r.driver_id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPleins = pleins.filter(p => 
    getVehiclePlate(p.vehicle_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
    getDriverName(p.driver_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.station && p.station.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredApprovs = approvs.filter(a => 
    (a.fournisseur && a.fournisseur.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Alerts
  const highConsumptionVehicles = consumptionAnalyses.filter(a => a.level === 'red');

  if (citerneLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <Fuel className="h-8 w-8 text-primary" />
              Gestion Carburant
            </h1>
            <p className="text-muted-foreground mt-1">
              Vue d'ensemble de la citerne, des consommations et des coûts.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button onClick={() => setApprovDialogOpen(true)} variant="outline" className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              Approvisionner
            </Button>
            <Button onClick={() => setRechargeDialogOpen(true)} className="gap-2 shadow-sm bg-primary hover:bg-primary/90">
              <Fuel className="h-4 w-4" />
              Plein Interne
            </Button>
            <Button onClick={() => setPleinDialogOpen(true)} variant="secondary" className="gap-2 shadow-sm">
              <Truck className="h-4 w-4" />
              Plein Extérieur
            </Button>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Tank Gauge */}
          <div className="lg:col-span-3">
             <CiterneGauge current={Number(citerne?.quantite_actuelle || 0)} total={Number(citerne?.capacite_totale || 10000)} />
          </div>

          {/* Right Column: Stats & Charts */}
          <div className="lg:col-span-9 space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard 
                title="Consommation Interne" 
                value={`${totalRechargesLiters.toLocaleString()} L`} 
                subtext="Total puisé de la citerne" 
                icon={Droplets} 
                colorClass="bg-blue-500 text-blue-500"
              />
              <StatCard 
                title="Consommation Externe" 
                value={`${totalPleinsLiters.toLocaleString()} L`} 
                subtext="Total pris en station" 
                icon={Truck} 
                colorClass="bg-amber-500 text-amber-500"
              />
              <StatCard 
                title="Coût Externe" 
                value={`${totalPleinsCost.toLocaleString()} MAD`} 
                subtext="Dépenses en carburant" 
                icon={TrendingUp} 
                colorClass="bg-emerald-500 text-emerald-500"
              />
            </div>

            {/* Alerts Section */}
            {highConsumptionVehicles.length > 0 && (
              <Card className="border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900">
                <CardHeader className="pb-2">
                  <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2 text-lg">
                    <AlertTriangle className="h-5 w-5" />
                    Alertes de Surconsommation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {highConsumptionVehicles.map((vehicle) => (
                      <Badge key={vehicle.vehicleId} variant="destructive" className="px-3 py-1 text-sm font-medium">
                        {getVehiclePlate(vehicle.vehicleId)} ({vehicle.consumptionPerKm.toFixed(2)} L/km)
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Main Tabs Area */}
            <Card className="border shadow-sm">
                <CardHeader className="px-6 py-4 border-b">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <CardTitle>Données Détaillées</CardTitle>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Rechercher..."
                                className="pl-9 h-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Tabs defaultValue="recharges" className="w-full">
                        <div className="px-6 py-2 bg-muted/30 border-b">
                            <TabsList className="bg-transparent p-0 gap-4">
                                <TabsTrigger value="recharges" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md px-4">Pleins Internes</TabsTrigger>
                                <TabsTrigger value="pleins" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md px-4">Pleins Extérieurs</TabsTrigger>
                                <TabsTrigger value="approv" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md px-4">Approvisionnements</TabsTrigger>
                                <TabsTrigger value="analyse" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md px-4">Analyse</TabsTrigger>
                            </TabsList>
                        </div>

                        <ScrollArea className="h-[500px]">
                            <TabsContent value="recharges" className="m-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Véhicule</TableHead>
                                            <TableHead>Chauffeur</TableHead>
                                            <TableHead>Quantité</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRecharges.map((r) => (
                                            <TableRow key={r.id} className="hover:bg-muted/50">
                                                <TableCell>{new Date(r.date).toLocaleDateString('fr-FR')}</TableCell>
                                                <TableCell className="font-medium">{getVehiclePlate(r.vehicle_id)}</TableCell>
                                                <TableCell>{getDriverName(r.driver_id)}</TableCell>
                                                <TableCell className="font-bold">{Number(r.quantite).toLocaleString()} L</TableCell>
                                                <TableCell>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Êtes-vous sûr de vouloir supprimer ce plein interne ? Cette action est irréversible.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                                                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteRecharge.mutate(r.id)}>
                                                                    Supprimer
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {filteredRecharges.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun résultat trouvé</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TabsContent>

                            <TabsContent value="pleins" className="m-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Véhicule</TableHead>
                                            <TableHead>Station</TableHead>
                                            <TableHead>Quantité</TableHead>
                                            <TableHead>Coût</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredPleins.map((p) => (
                                            <TableRow key={p.id} className="hover:bg-muted/50">
                                                <TableCell>{new Date(p.date).toLocaleDateString('fr-FR')}</TableCell>
                                                <TableCell className="font-medium">{getVehiclePlate(p.vehicle_id)}</TableCell>
                                                <TableCell>{p.station || '-'}</TableCell>
                                                <TableCell className="font-bold">{Number(p.quantite).toLocaleString()} L</TableCell>
                                                <TableCell>{Number(p.cout).toLocaleString()} MAD</TableCell>
                                                <TableCell>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Êtes-vous sûr de vouloir supprimer ce plein extérieur ?
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                                                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deletePlein.mutate(p.id)}>
                                                                    Supprimer
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {filteredPleins.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun résultat trouvé</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TabsContent>

                            <TabsContent value="approv" className="m-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Fournisseur</TableHead>
                                            <TableHead>Quantité</TableHead>
                                            <TableHead>Coût</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredApprovs.map((a) => (
                                            <TableRow key={a.id} className="hover:bg-muted/50">
                                                <TableCell>{new Date(a.date).toLocaleDateString('fr-FR')}</TableCell>
                                                <TableCell>{a.fournisseur || '-'}</TableCell>
                                                <TableCell className="font-bold text-emerald-600">{Number(a.quantite).toLocaleString()} L</TableCell>
                                                <TableCell>{Number(a.cout).toLocaleString()} MAD</TableCell>
                                                <TableCell>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Êtes-vous sûr de vouloir supprimer cet approvisionnement ?
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                                                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteApprov.mutate(a.id)}>
                                                                    Supprimer
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {filteredApprovs.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun résultat trouvé</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TabsContent>

                            <TabsContent value="analyse" className="p-6">
                                <div className="h-[400px] w-full mb-8">
                                    <h3 className="text-lg font-semibold mb-4">Consommation Moyenne par Véhicule (L/100km)</h3>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={consumptionAnalyses.map(a => ({ name: getVehiclePlate(a.vehicleId), value: a.consumptionPerKm * 100, level: a.level }))}>
                                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Tooltip 
                                                formatter={(value: number) => [`${value.toFixed(1)} L/100km`, 'Consommation']}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                            />
                                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                                {consumptionAnalyses.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.level === 'red' ? '#ef4444' : entry.level === 'green' ? '#22c55e' : '#3b82f6'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {consumptionAnalyses.map(analysis => (
                                        <Card key={analysis.vehicleId} className={`border-l-4 ${analysis.level === 'red' ? 'border-l-red-500' : analysis.level === 'green' ? 'border-l-green-500' : 'border-l-blue-500'}`}>
                                            <CardContent className="p-4">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h4 className="font-bold text-lg">{getVehiclePlate(analysis.vehicleId)}</h4>
                                                        <p className="text-xs text-muted-foreground">{getDriverName(analysis.driverId)}</p>
                                                    </div>
                                                    <Badge variant={analysis.level === 'red' ? 'destructive' : 'outline'}>
                                                        {(analysis.consumptionPerKm * 100).toFixed(1)} L/100km
                                                    </Badge>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-sm mt-4">
                                                    <div>
                                                        <p className="text-muted-foreground text-xs">Distance</p>
                                                        <p className="font-medium">{analysis.totalKm.toLocaleString()} km</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground text-xs">Carburant</p>
                                                        <p className="font-medium">{analysis.totalLiters.toLocaleString()} L</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </TabsContent>
                        </ScrollArea>
                    </Tabs>
                </CardContent>
            </Card>
          </div>
        </div>

        {/* Dialogs - Kept simple but functional */}
        <Dialog open={rechargeDialogOpen} onOpenChange={setRechargeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau Plein Interne</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Véhicule</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={rechargeForm.vehicle_id}
                  onChange={(e) => setRechargeForm({ ...rechargeForm, vehicle_id: e.target.value })}
                >
                  <option value="">Sélectionner un véhicule</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.plate} - {v.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Chauffeur</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={rechargeForm.driver_id}
                  onChange={(e) => setRechargeForm({ ...rechargeForm, driver_id: e.target.value })}
                >
                  <option value="">Sélectionner un chauffeur</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Quantité (L)</Label>
                <Input 
                  type="number" 
                  value={rechargeForm.quantite} 
                  onChange={(e) => setRechargeForm({ ...rechargeForm, quantite: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Kilométrage Actuel</Label>
                <Input 
                  type="number" 
                  value={rechargeForm.kilometrage} 
                  onChange={(e) => setRechargeForm({ ...rechargeForm, kilometrage: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRechargeDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleRechargeSubmit}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={pleinDialogOpen} onOpenChange={setPleinDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau Plein Extérieur</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Véhicule</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={pleinForm.vehicle_id}
                  onChange={(e) => setPleinForm({ ...pleinForm, vehicle_id: e.target.value })}
                >
                  <option value="">Sélectionner un véhicule</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.plate}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Quantité (L)</Label>
                <Input 
                  type="number" 
                  value={pleinForm.quantite} 
                  onChange={(e) => setPleinForm({ ...pleinForm, quantite: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Coût (MAD)</Label>
                <Input 
                  type="number" 
                  value={pleinForm.cout} 
                  onChange={(e) => setPleinForm({ ...pleinForm, cout: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Station</Label>
                <Input 
                  value={pleinForm.station} 
                  onChange={(e) => setPleinForm({ ...pleinForm, station: e.target.value })}
                  placeholder="Ex: Total, Shell..."
                />
              </div>
              <div className="grid gap-2">
                <Label>Kilométrage</Label>
                <Input 
                  type="number" 
                  value={pleinForm.kilometrage} 
                  onChange={(e) => setPleinForm({ ...pleinForm, kilometrage: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPleinDialogOpen(false)}>Annuler</Button>
              <Button onClick={handlePleinSubmit}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={approvDialogOpen} onOpenChange={setApprovDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvel Approvisionnement Citerne</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Quantité (L)</Label>
                <Input 
                  type="number" 
                  value={approvForm.quantite} 
                  onChange={(e) => setApprovForm({ ...approvForm, quantite: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Coût Total (MAD)</Label>
                <Input 
                  type="number" 
                  value={approvForm.cout} 
                  onChange={(e) => setApprovForm({ ...approvForm, cout: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Fournisseur</Label>
                <Input 
                  value={approvForm.fournisseur} 
                  onChange={(e) => setApprovForm({ ...approvForm, fournisseur: e.target.value })}
                  placeholder="Ex: Afriquia, Shell..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApprovDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleApprovSubmit}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
