import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { OilBarrel } from '@/components/oil/OilBarrel';
import {
  OilBarrelConfig,
  useOilBarrels,
  useOilPurchases,
  useOilConsumptions,
  useOilDrains,
  useCreateOilBarrel,
  useUpdateOilBarrel,
  useDeleteOilBarrel,
  useCreateOilPurchase,
  useCreateOilConsumption,
  useCreateOilDrain,
} from '@/hooks/useOil';
import { useDrivers } from '@/hooks/useDrivers';
import { useGPSwoxVehicles } from '@/hooks/useGPSwoxVehicles';
import { Droplets, Plus, Settings, Wrench, Truck, ShoppingCart, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function Oil() {
  const { data: barrels = [] } = useOilBarrels();
  const { data: purchases = [] } = useOilPurchases();
  const { data: consumptions = [] } = useOilConsumptions();
  const { data: drains = [] } = useOilDrains();
  const { data: drivers = [], isLoading: driversLoading } = useDrivers();
  const { data: gpswoxVehicles = [], isLoading: vehiclesLoading } = useGPSwoxVehicles();

  const createBarrel = useCreateOilBarrel();
  const updateBarrel = useUpdateOilBarrel();
  const deleteBarrel = useDeleteOilBarrel();
  const createPurchase = useCreateOilPurchase();
  const createConsumption = useCreateOilConsumption();
  const createDrain = useCreateOilDrain();

  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [consumptionDialogOpen, setConsumptionDialogOpen] = useState(false);
  const [drainDialogOpen, setDrainDialogOpen] = useState(false);
  const [barrelsDialogOpen, setBarrelsDialogOpen] = useState(false);
  const [editingBarrel, setEditingBarrel] = useState<OilBarrelConfig | null>(null);

  const [newBarrelName, setNewBarrelName] = useState('');
  const [newBarrelCapacity, setNewBarrelCapacity] = useState('220');

  const [purchaseDate, setPurchaseDate] = useState(() =>
    new Date().toISOString().split('T')[0]
  );
  const [purchaseCapacity, setPurchaseCapacity] = useState('220');
  const [purchaseBarrelsCount, setPurchaseBarrelsCount] = useState('1');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [purchaseMethod, setPurchaseMethod] = useState('cash');
  const [purchaseBarrelId, setPurchaseBarrelId] = useState('');

  const [consumptionDate, setConsumptionDate] = useState(() =>
    new Date().toISOString().split('T')[0]
  );
  const [consumptionLiters, setConsumptionLiters] = useState('');
  const [consumptionDriver, setConsumptionDriver] = useState('');
  const [consumptionVehicle, setConsumptionVehicle] = useState('');
  const [consumptionBarrelId, setConsumptionBarrelId] = useState('');

  const [drainDate, setDrainDate] = useState(() =>
    new Date().toISOString().split('T')[0]
  );
  const [drainLiters, setDrainLiters] = useState('');
  const [drainBarrelId, setDrainBarrelId] = useState('');

  const totalCapacity = useMemo(
    () =>
      barrels.reduce(
        (sum, b) => sum + (Number(b.capacity_liters) || 0),
        0
      ),
    [barrels]
  );

  const totalPurchasedLiters = useMemo(
    () =>
      purchases.reduce(
        (sum, p) => sum + (Number(p.total_liters) || 0),
        0
      ),
    [purchases]
  );

  const totalConsumedLiters = useMemo(
    () =>
      consumptions.reduce(
        (sum, c) => sum + (Number(c.liters) || 0),
        0
      ),
    [consumptions]
  );

  const totalDrainedLiters = useMemo(
    () =>
      drains.reduce(
        (sum, d) => sum + (Number(d.liters) || 0),
        0
      ),
    [drains]
  );

  const currentStockLiters = Math.max(
    0,
    totalPurchasedLiters - totalConsumedLiters - totalDrainedLiters
  );

  const fillPercentage = totalCapacity > 0 ? (currentStockLiters / totalCapacity) * 100 : 0;

  const totalSpent = useMemo(
    () =>
      purchases.reduce(
        (sum, p) => sum + (Number(p.total_amount) || 0),
        0
      ),
    [purchases]
  );

  const avgPricePerLiter =
    totalPurchasedLiters > 0 ? totalSpent / totalPurchasedLiters : 0;

  const perBarrelLevels = useMemo(
    () =>
      barrels.map((barrel) => {
        const capacity = Number(barrel.capacity_liters) || 0;
        if (capacity <= 0) {
          return {
            ...barrel,
            levelPercentage: 0,
            remainingLiters: 0,
            variantIndex: 0,
          };
        }

        const name = (barrel.name || '').toLowerCase();
        let variantIndex = 0;

        if (
          name.includes('lave glace') ||
          name.includes('lave-glace') ||
          name.includes('lave glace') ||
          name.includes('windshield') ||
          name.includes('washer')
        ) {
          variantIndex = 9;
        } else if (
          name.includes('adblue') ||
          name.includes('add blue') ||
          name.includes('a d blue')
        ) {
          variantIndex = 10;
        } else if (
          name.includes('pont') ||
          name.includes('bridge') ||
          name.includes('diff') ||
          name.includes('differentiel') ||
          name.includes('différentiel')
        ) {
          variantIndex = 7;
        } else if (
          name.includes('refroidissement') ||
          name.includes('coolant') ||
          name.includes('liquide de refroidissement')
        ) {
          variantIndex = 8;
        } else if (name.includes('frein') || name.includes('brake')) {
          variantIndex = 5;
        } else if (
          name.includes('direction') ||
          name.includes('da ') ||
          name.includes('d.a') ||
          name.includes('power steering')
        ) {
          variantIndex = 6;
        } else if (name.includes('hydraulique') || name.includes('hydraulic')) {
          variantIndex = 4;
        } else if (name.includes('moteur') || name.includes('engine')) {
          variantIndex = 2;
        } else if (name.includes('synthe')) {
          variantIndex = 1;
        } else if (
          name.includes('transmission') ||
          name.includes('boite') ||
          name.includes('boîte') ||
          name.includes('gear')
        ) {
          variantIndex = 3;
        }

        const purchasedForBarrel = purchases
          .filter((p: any) => p.barrel_id === barrel.id)
          .reduce(
            (sum, p) => sum + (Number((p as any).total_liters) || 0),
            0
          );

        const consumedForBarrel = consumptions
          .filter((c: any) => c.barrel_id === barrel.id)
          .reduce(
            (sum, c) => sum + (Number((c as any).liters) || 0),
            0
          );

        const drainedForBarrel = drains
          .filter((d: any) => d.barrel_id === barrel.id)
          .reduce(
            (sum, d) => sum + (Number((d as any).liters) || 0),
            0
          );

        const remainingLiters = Math.max(
          0,
          purchasedForBarrel - consumedForBarrel - drainedForBarrel
        );

        const levelPercentage =
          capacity > 0
            ? Math.max(
                0,
                Math.min(100, (remainingLiters / capacity) * 100)
              )
            : 0;

        return {
          ...barrel,
          levelPercentage,
          remainingLiters,
          variantIndex,
        };
      }),
    [barrels, purchases, consumptions, drains]
  );

  const handleAddBarrel = async () => {
    if (!newBarrelName.trim()) {
      const index = barrels.length + 1;
      setNewBarrelName(`Baril ${index}`);
    }
    const capacity = parseFloat(newBarrelCapacity);
    if (!capacity || capacity <= 0) return;
    const name = newBarrelName.trim() || `Baril ${barrels.length + 1}`;
    await createBarrel.mutateAsync({ name, capacity_liters: capacity });
    setNewBarrelName('');
    setNewBarrelCapacity('220');
  };

  const handleUpdateBarrel = async () => {
    if (!editingBarrel) return;
    const capacity = parseFloat(newBarrelCapacity);
    if (!capacity || capacity <= 0) return;
    const name = newBarrelName.trim() || editingBarrel.name;
    await updateBarrel.mutateAsync({
      id: editingBarrel.id,
      name,
      capacity_liters: capacity,
    });
    setEditingBarrel(null);
    setNewBarrelName('');
    setNewBarrelCapacity('220');
  };

  const handleEditBarrel = (barrel: OilBarrelConfig) => {
    setEditingBarrel(barrel);
    setNewBarrelName(barrel.name);
    setNewBarrelCapacity(String(barrel.capacity_liters || 0));
  };

  const handleDeleteBarrel = async (barrel: OilBarrelConfig) => {
    await deleteBarrel.mutateAsync(barrel.id);
  };

  const handleCreatePurchase = async () => {
    const capacity = parseFloat(purchaseCapacity);
    const count = parseInt(purchaseBarrelsCount, 10);
    const amount = parseFloat(purchaseAmount);
    if (!capacity || capacity <= 0 || !count || count <= 0 || !amount || amount <= 0) {
      return;
    }
    const selectedBarrel = barrels.find((b) => b.id === purchaseBarrelId);

    await createPurchase.mutateAsync({
      purchase_date: purchaseDate,
      barrel_capacity_liters: capacity,
      barrels_count: count,
      total_amount: amount,
      payment_method: purchaseMethod,
      notes: selectedBarrel
        ? `Baril: ${selectedBarrel.name} (${selectedBarrel.capacity_liters} L)`
        : undefined,
      barrel_id: selectedBarrel ? selectedBarrel.id : undefined,
    });
    setPurchaseDialogOpen(false);
    setPurchaseBarrelsCount('1');
    setPurchaseAmount('');
    setPurchaseBarrelId('');
  };

  const handleCreateConsumption = async () => {
    const liters = parseFloat(consumptionLiters);
    if (
      !liters ||
      liters <= 0 ||
      !consumptionDriver.trim() ||
      !consumptionVehicle.trim()
    ) {
      return;
    }
    const selectedBarrel = barrels.find((b) => b.id === consumptionBarrelId);

    await createConsumption.mutateAsync({
      consumption_date: consumptionDate,
      vehicle_plate: consumptionVehicle.trim(),
      driver_name: consumptionDriver.trim(),
      liters,
      notes: selectedBarrel
        ? `Baril: ${selectedBarrel.name} (${selectedBarrel.capacity_liters} L)`
        : undefined,
      barrel_id: selectedBarrel ? selectedBarrel.id : undefined,
    });
    setConsumptionDialogOpen(false);
    setConsumptionLiters('');
    setConsumptionDriver('');
    setConsumptionVehicle('');
    setConsumptionBarrelId('');
  };

  const handleCreateDrain = async () => {
    const liters = parseFloat(drainLiters);
    if (!liters || liters <= 0) return;
    const selectedBarrel = barrels.find((b) => b.id === drainBarrelId);
    await createDrain.mutateAsync({
      drain_date: drainDate,
      liters,
      notes: selectedBarrel
        ? `Baril: ${selectedBarrel.name} (${selectedBarrel.capacity_liters} L)`
        : undefined,
      barrel_id: selectedBarrel ? selectedBarrel.id : undefined,
    });
    setDrainDialogOpen(false);
    setDrainLiters('');
    setDrainBarrelId('');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Droplets className="h-8 w-8 text-primary" />
              Gestion de l’huile
            </h1>
            <p className="text-muted-foreground mt-1">
              Suivi intelligent du stock d’huile, des achats et des vidanges.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Configuration des barils
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Configuration des barils d’huile</DialogTitle>
                </DialogHeader>
                <div className="grid md:grid-cols-2 gap-6 py-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nom du baril</Label>
                      <Input
                        value={newBarrelName}
                        onChange={(e) => setNewBarrelName(e.target.value)}
                        placeholder="Baril 1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Capacité (L)</Label>
                      <Select
                        value={newBarrelCapacity}
                        onValueChange={setNewBarrelCapacity}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choisir la capacité" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="25">25 L</SelectItem>
                          <SelectItem value="60">60 L</SelectItem>
                          <SelectItem value="220">220 L</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      className="w-full gap-2"
                      onClick={editingBarrel ? handleUpdateBarrel : handleAddBarrel}
                    >
                      <Plus className="h-4 w-4" />
                      {editingBarrel ? 'Mettre à jour le baril' : 'Ajouter un baril'}
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Barils configurés
                    </p>
                    <div className="border rounded-md max-h-64 overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 z-10 bg-background">
                          <TableRow>
                            <TableHead>Nom</TableHead>
                            <TableHead className="text-right">Capacité</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <AnimatePresence initial={false}>
                            {barrels.map((barrel) => (
                              <motion.tr
                                key={barrel.id}
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 4 }}
                                transition={{ duration: 0.15 }}
                              >
                                <TableCell>{barrel.name}</TableCell>
                                <TableCell className="text-right">
                                  {barrel.capacity_liters} L
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleEditBarrel(barrel)}
                                  >
                                    <Settings className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => handleDeleteBarrel(barrel)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </TableCell>
                              </motion.tr>
                            ))}
                          </AnimatePresence>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Nouvel achat d’huile
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Enregistrer un achat d’huile</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={purchaseDate}
                        onChange={(e) => setPurchaseDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Capacité du baril</Label>
                      <Select
                        value={purchaseCapacity}
                        onValueChange={setPurchaseCapacity}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Capacité" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="25">25 L</SelectItem>
                          <SelectItem value="60">60 L</SelectItem>
                          <SelectItem value="220">220 L</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Barils configurés</Label>
                    <Select
                      value={purchaseBarrelId}
                      onValueChange={(value) => {
                        setPurchaseBarrelId(value);
                        const selected = barrels.find((b) => b.id === value);
                        if (selected) {
                          setPurchaseCapacity(String(selected.capacity_liters || ''));
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un baril (optionnel)" />
                      </SelectTrigger>
                      <SelectContent>
                        {barrels.map((barrel) => (
                          <SelectItem key={barrel.id} value={barrel.id}>
                            {barrel.name} ({barrel.capacity_liters} L)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nombre de barils</Label>
                      <Input
                        type="number"
                        min="1"
                        value={purchaseBarrelsCount}
                        onChange={(e) => setPurchaseBarrelsCount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Montant total</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={purchaseAmount}
                        onChange={(e) => setPurchaseAmount(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Méthode de paiement</Label>
                    <Select
                      value={purchaseMethod}
                      onValueChange={setPurchaseMethod}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Espèces</SelectItem>
                        <SelectItem value="check">Chèque</SelectItem>
                        <SelectItem value="transfer">Virement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Volume total estimé:{' '}
                    <span className="font-semibold">
                      {Number(purchaseCapacity) * Number(purchaseBarrelsCount || '0')} L
                    </span>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreatePurchase}>Enregistrer l’achat</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog
              open={consumptionDialogOpen}
              onOpenChange={setConsumptionDialogOpen}
            >
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Truck className="h-4 w-4" />
                  Consommation
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Enregistrer une consommation d’huile</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={consumptionDate}
                        onChange={(e) => setConsumptionDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Quantité (L)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={consumptionLiters}
                        onChange={(e) => setConsumptionLiters(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Chauffeur</Label>
                      <Select
                        value={consumptionDriver}
                        onValueChange={setConsumptionDriver}
                        disabled={driversLoading}
                      >
                        <SelectTrigger>
                          {driversLoading ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Chargement...</span>
                            </div>
                          ) : (
                            <SelectValue placeholder="Sélectionner un chauffeur" />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {drivers.map((driver) => (
                            <SelectItem key={driver.id} value={driver.name}>
                              {driver.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Camion / Immatriculation</Label>
                      <Select
                        value={consumptionVehicle}
                        onValueChange={setConsumptionVehicle}
                        disabled={vehiclesLoading}
                      >
                        <SelectTrigger>
                          {vehiclesLoading ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Chargement...</span>
                            </div>
                          ) : (
                            <SelectValue placeholder="Sélectionner un camion" />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {gpswoxVehicles.map((vehicle) => (
                            <SelectItem key={vehicle.id} value={vehicle.plate}>
                              {vehicle.plate} - {vehicle.brand} {vehicle.model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Barils configurés</Label>
                    <Select
                      value={consumptionBarrelId}
                      onValueChange={setConsumptionBarrelId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un baril (optionnel)" />
                      </SelectTrigger>
                      <SelectContent>
                        {barrels.map((barrel) => (
                          <SelectItem key={barrel.id} value={barrel.id}>
                            {barrel.name} ({barrel.capacity_liters} L)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreateConsumption}>
                    Enregistrer la consommation
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={drainDialogOpen} onOpenChange={setDrainDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Wrench className="h-4 w-4" />
                  Vidange
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Enregistrer une vidange</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={drainDate}
                        onChange={(e) => setDrainDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Quantité (L)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={drainLiters}
                        onChange={(e) => setDrainLiters(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Baril (optionnel)</Label>
                    <Select
                      value={drainBarrelId}
                      onValueChange={setDrainBarrelId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un baril" />
                      </SelectTrigger>
                      <SelectContent>
                        {barrels.map((barrel) => (
                          <SelectItem key={barrel.id} value={barrel.id}>
                            {barrel.name} ({barrel.capacity_liters} L)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreateDrain}>Enregistrer la vidange</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-6">
          <Card className="dashboard-panel flex flex-col items-center justify-center py-6">
            <CardHeader className="w-full flex items-start justify-between pb-4 space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-lg">
                  Niveau de stock d’huile
                </CardTitle>
                <CardDescription>
                  Visualisation du taux de remplissage des barils configurés.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBarrelsDialogOpen(true)}
              >
                Afficher
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <OilBarrel fillPercentage={fillPercentage} variant={0} />
              <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                <div>
                  <p className="font-medium text-foreground">Stock actuel</p>
                  <p>{currentStockLiters.toFixed(1)} L</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Capacité totale</p>
                  <p>{totalCapacity.toFixed(1)} L</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Acheté</p>
                  <p>{totalPurchasedLiters.toFixed(1)} L</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Consommé + vidange</p>
                  <p>{(totalConsumedLiters + totalDrainedLiters).toFixed(1)} L</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="dashboard-panel">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-primary" />
                    Coût total des achats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {formatCurrency(totalSpent)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sur toute la période enregistrée
                  </p>
                </CardContent>
              </Card>
              <Card className="dashboard-panel">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-primary" />
                    Prix moyen par litre
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {avgPricePerLiter > 0 ? formatCurrency(avgPricePerLiter) : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Calculé sur les achats saisis
                  </p>
                </CardContent>
              </Card>
              <Card className="dashboard-panel">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-primary" />
                    Nombre de barils
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{barrels.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Barils configurés dans le système
                  </p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="purchases" className="space-y-4">
              <TabsList>
                <TabsTrigger value="purchases">Achats</TabsTrigger>
                <TabsTrigger value="consumptions">Consommations</TabsTrigger>
                <TabsTrigger value="drains">Vidanges</TabsTrigger>
              </TabsList>
              <TabsContent value="purchases">
                <Card>
                  <CardHeader>
                    <CardTitle>Historique des achats d’huile</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Capacité</TableHead>
                          <TableHead>Nombre de barils</TableHead>
                          <TableHead>Volume total</TableHead>
                          <TableHead>Méthode</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <AnimatePresence initial={false}>
                          {purchases.map((purchase) => (
                            <motion.tr
                              key={purchase.id}
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 4 }}
                              transition={{ duration: 0.15 }}
                            >
                              <TableCell>
                                {format(
                                  new Date(purchase.purchase_date),
                                  'dd/MM/yyyy'
                                )}
                              </TableCell>
                              <TableCell>
                                {purchase.barrel_capacity_liters} L
                              </TableCell>
                              <TableCell>{purchase.barrels_count}</TableCell>
                              <TableCell>{purchase.total_liters} L</TableCell>
                              <TableCell className="capitalize">
                                {purchase.payment_method}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(purchase.total_amount)}
                              </TableCell>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                        {purchases.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                              Aucun achat enregistré pour le moment.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="consumptions">
                <Card>
                  <CardHeader>
                    <CardTitle>Consommations par véhicule</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Véhicule</TableHead>
                          <TableHead>Chauffeur</TableHead>
                          <TableHead className="text-right">Quantité (L)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <AnimatePresence initial={false}>
                          {consumptions.map((consumption) => (
                            <motion.tr
                              key={consumption.id}
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 4 }}
                              transition={{ duration: 0.15 }}
                            >
                              <TableCell>
                                {format(
                                  new Date(consumption.consumption_date),
                                  'dd/MM/yyyy'
                                )}
                              </TableCell>
                              <TableCell>{consumption.vehicle_plate}</TableCell>
                              <TableCell>{consumption.driver_name}</TableCell>
                              <TableCell className="text-right">
                                {consumption.liters.toFixed(1)} L
                              </TableCell>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                        {consumptions.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                              Aucune consommation enregistrée.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="drains">
                <Card>
                  <CardHeader>
                    <CardTitle>Historique des vidanges</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Quantité (L)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <AnimatePresence initial={false}>
                          {drains.map((drain) => (
                            <motion.tr
                              key={drain.id}
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 4 }}
                              transition={{ duration: 0.15 }}
                            >
                              <TableCell>
                                {format(new Date(drain.drain_date), 'dd/MM/yyyy')}
                              </TableCell>
                              <TableCell className="text-right">
                                {drain.liters.toFixed(1)} L
                              </TableCell>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                        {drains.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-sm text-muted-foreground py-6">
                              Aucune vidange enregistrée.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

        <Dialog open={barrelsDialogOpen} onOpenChange={setBarrelsDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Répartition du stock par baril</DialogTitle>
            </DialogHeader>
            <div className="mt-2 space-y-4 max-h-[420px] overflow-auto">
              {perBarrelLevels.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aucun baril configuré pour le moment.
                </p>
              )}
              {perBarrelLevels.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {perBarrelLevels.map((barrel) => (
                    <motion.div
                      key={barrel.id}
                      className="rounded-lg border bg-card px-3 py-4 flex flex-col items-center gap-3"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <OilBarrel
                        fillPercentage={barrel.levelPercentage}
                        variant={barrel.variantIndex}
                      />
                      <div className="text-center space-y-1">
                        <p className="font-medium text-foreground">
                          {barrel.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Capacité: {Number(barrel.capacity_liters).toFixed(1)} L
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Stock estimé:{' '}
                          <span className="font-semibold text-foreground">
                            {barrel.remainingLiters.toFixed(1)} L
                          </span>
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
    </DashboardLayout>
  );
}
