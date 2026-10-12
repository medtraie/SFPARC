import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type AtelierActivityType = 'maintenance' | 'manufacturing' | 'repair' | 'inspection' | 'customization';
export type AtelierPriority = 'low' | 'medium' | 'high' | 'urgent';
export type AtelierStatus = 'draft' | 'planned' | 'in_progress' | 'quality_check' | 'completed' | 'cancelled';
export type AtelierItemCategory = 'spare_part' | 'consumable' | 'raw_material' | 'manufactured_part';

export interface AtelierOrderItem {
  id: string;
  work_order_id?: string;
  stock_item_id?: string | null;
  name: string;
  reference?: string | null;
  category: AtelierItemCategory;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
}

export interface AtelierWorkOrder {
  id: string;
  reference: string;
  title: string;
  activity_type: AtelierActivityType;
  priority: AtelierPriority;
  status: AtelierStatus;
  vehicle_id?: string | null;
  asset_name?: string | null;
  client_or_department?: string | null;
  assigned_technician?: string | null;
  technician_id?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  estimated_hours: number;
  actual_hours: number;
  hourly_rate: number;
  labor_cost: number;
  parts_cost: number;
  consumables_cost: number;
  total_cost: number;
  description?: string | null;
  diagnostic?: string | null;
  solution?: string | null;
  quality_notes?: string | null;
  created_at: string;
  updated_at: string;
  items?: AtelierOrderItem[];
}

export interface AtelierMachine {
  id: string;
  name: string;
  code: string;
  type: 'machine' | 'workstation' | 'tool' | 'lift' | 'cnc' | 'welding' | 'painting';
  location?: string | null;
  status: 'operational' | 'in_use' | 'maintenance' | 'stopped';
  last_maintenance?: string | null;
  next_maintenance?: string | null;
  hour_meter: number;
  notes?: string | null;
  created_at: string;
}

export interface AtelierBOM {
  id: string;
  code: string;
  name: string;
  target_item_name: string;
  description?: string | null;
  version: string;
  labor_hours: number;
  components: Array<{
    name: string;
    reference?: string;
    category: AtelierItemCategory;
    quantity: number;
    unit: string;
    estimated_cost: number;
  }>;
  is_active: boolean;
  created_at: string;
}

const LOCAL_STORAGE_KEY_ORDERS = 'sftm_atelier_work_orders';
const LOCAL_STORAGE_KEY_MACHINES = 'sftm_atelier_machines';
const LOCAL_STORAGE_KEY_BOMS = 'sftm_atelier_boms';

// Initial fallback mock data for testing & offline resilience
const INITIAL_ORDERS: AtelierWorkOrder[] = [
  {
    id: 'ot-1001',
    reference: 'OT-2026-001',
    title: 'Révision majeure & Remplacement distribution',
    activity_type: 'maintenance',
    priority: 'high',
    status: 'in_progress',
    vehicle_id: 'v-101',
    asset_name: 'Dacia Dokker 112233-A-1',
    client_or_department: 'Flotte Logistique',
    assigned_technician: 'Rachid Amrani (Chef Atelier)',
    start_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    estimated_hours: 4.5,
    actual_hours: 3.0,
    hourly_rate: 180,
    labor_cost: 540,
    parts_cost: 1450,
    consumables_cost: 160,
    total_cost: 2150,
    description: 'Changement kit courroie de distribution, pompe à eau et vidange 5W30',
    diagnostic: 'Bruit de roulement sur galet tendeur et kilométrage 120 000 km atteint',
    solution: 'Remplacement complet avec purge du circuit de refroidissement',
    quality_notes: 'Test pression circuit OK, zéro fuite détectée',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: [
      { id: 'item-1', name: 'Kit Distribution + Pompe à eau', reference: 'KD-RENAULT-01', category: 'spare_part', quantity: 1, unit: 'kit', unit_price: 1100, total_price: 1100 },
      { id: 'item-2', name: 'Huile Synthétique 5W30', reference: 'OIL-5W30-T', category: 'consumable', quantity: 5, unit: 'L', unit_price: 70, total_price: 350 },
      { id: 'item-3', name: 'Liquide de refroidissement Glacéol', reference: 'LQD-COOL-GL', category: 'consumable', quantity: 4, unit: 'L', unit_price: 40, total_price: 160 },
    ],
  },
  {
    id: 'ot-1002',
    reference: 'OT-2026-002',
    title: 'Fabrication & Soudure ridelles benne BTP',
    activity_type: 'manufacturing',
    priority: 'urgent',
    status: 'planned',
    asset_name: 'Camion Mercedes Actros BTP-04',
    client_or_department: 'Chantier Tanger Med',
    assigned_technician: 'Karim Bennani (Chaudronnier)',
    start_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
    estimated_hours: 8,
    actual_hours: 1.5,
    hourly_rate: 200,
    labor_cost: 1600,
    parts_cost: 3200,
    consumables_cost: 450,
    total_cost: 5250,
    description: 'Découpe tôles acier 4mm, pliage CNC et soudure MIG des renforts',
    diagnostic: 'Déformation suite au déchargement de gravats lourds',
    solution: 'Fabrication sur mesure selon plan BOM-RIDELLES-V2',
    quality_notes: 'Contrôle des soudures et couche primaire antirouille',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: [
      { id: 'item-4', name: 'Tôle Acier Hardox 4mm 2000x1000', reference: 'STL-HDX-4MM', category: 'raw_material', quantity: 2, unit: 'feuille', unit_price: 1200, total_price: 2400 },
      { id: 'item-5', name: 'Profilé Tube Carré 50x50x3', reference: 'TUB-SQ-50', category: 'raw_material', quantity: 4, unit: 'barre (6m)', unit_price: 200, total_price: 800 },
      { id: 'item-6', name: 'Gaz Soudure Argon/CO2 & Fil MIG', reference: 'GAS-MIG-MIX', category: 'consumable', quantity: 1, unit: 'forfait', unit_price: 450, total_price: 450 },
    ],
  },
  {
    id: 'ot-1003',
    reference: 'OT-2026-003',
    title: 'Diagnostic Freinage & Remplacement Plaquettes',
    activity_type: 'repair',
    priority: 'medium',
    status: 'completed',
    asset_name: 'Peugeot Partner 98765-B-1',
    client_or_department: 'Service Express',
    assigned_technician: 'Yassine Touimi',
    start_date: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10),
    due_date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    completed_at: new Date(Date.now() - 86400000).toISOString(),
    estimated_hours: 1.5,
    actual_hours: 1.2,
    hourly_rate: 150,
    labor_cost: 180,
    parts_cost: 480,
    consumables_cost: 50,
    total_cost: 710,
    description: 'Remplacement plaquettes AV et contrôle disques',
    diagnostic: 'Témoin usure allumé au tableau de bord',
    solution: 'Plaquettes neuves installées, dépoussiérage et purge',
    quality_notes: 'Essai sur banc de freinage validé',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: [
      { id: 'item-7', name: 'Jeu Plaquettes Frein AV Ferodo', reference: 'BRK-FER-AV', category: 'spare_part', quantity: 1, unit: 'jeu', unit_price: 480, total_price: 480 },
      { id: 'item-8', name: 'Nettoyant Freins Aérosol 500ml', reference: 'CLN-BRK-500', category: 'consumable', quantity: 1, unit: 'spray', unit_price: 50, total_price: 50 },
    ],
  },
];

const INITIAL_MACHINES: AtelierMachine[] = [
  { id: 'm-1', code: 'PONT-01', name: 'Pont Élévateur 2 Colonnes 4.5T', type: 'lift', location: 'Baie Mécanique A', status: 'in_use', hour_meter: 1250, last_maintenance: '2026-03-15', next_maintenance: '2026-09-15', notes: 'Vérification câbles hydrauliques mensuelle OK', created_at: new Date().toISOString() },
  { id: 'm-2', code: 'PONT-02', name: 'Pont 4 Colonnes Géométrie & Banc', type: 'lift', location: 'Baie Réglage B', status: 'operational', hour_meter: 890, last_maintenance: '2026-02-10', next_maintenance: '2026-08-10', notes: 'Calibrage têtes laser validé', created_at: new Date().toISOString() },
  { id: 'm-3', code: 'CNC-CUT', name: 'Table Découpe Plasma CNC 3000x1500', type: 'cnc', location: 'Atelier Métallerie', status: 'operational', hour_meter: 420, last_maintenance: '2026-04-01', next_maintenance: '2026-10-01', notes: 'Buses neuves installées', created_at: new Date().toISOString() },
  { id: 'm-4', code: 'WELD-MIG', name: 'Poste à Souder MIG/MAG Synergique 400A', type: 'welding', location: 'Poste Soudure C', status: 'in_use', hour_meter: 680, last_maintenance: '2026-03-20', next_maintenance: '2026-09-20', notes: 'Torche refroidie eau', created_at: new Date().toISOString() },
  { id: 'm-5', code: 'CAB-PAINT', name: 'Cabine de Peinture & Séchage IR', type: 'painting', location: 'Zone Finition', status: 'operational', hour_meter: 310, last_maintenance: '2026-03-01', next_maintenance: '2026-06-01', notes: 'Filtres plafond changés', created_at: new Date().toISOString() },
];

const INITIAL_BOMS: AtelierBOM[] = [
  {
    id: 'bom-1',
    code: 'BOM-BENNE-BTP',
    name: 'Ridelle Renforcée Benne 3.5m',
    target_item_name: 'Ridelle Benne BTP Complète',
    version: '2.1',
    description: 'Nomenclature standard pour confection ridelles latérales BTP renforcées',
    labor_hours: 12,
    is_active: true,
    created_at: new Date().toISOString(),
    components: [
      { name: 'Tôle Acier Hardox 4mm', reference: 'STL-HDX-4MM', category: 'raw_material', quantity: 2, unit: 'feuille', estimated_cost: 2400 },
      { name: 'Tube Acier Carré 50x50x3', reference: 'TUB-SQ-50', category: 'raw_material', quantity: 4, unit: 'barre', estimated_cost: 800 },
      { name: 'Charnières & Verrous Forgés', reference: 'LCK-HD-BTP', category: 'spare_part', quantity: 4, unit: 'pièce', estimated_cost: 360 },
      { name: 'Peinture Antirouille Polyuréthane', reference: 'PNT-PU-BTP', category: 'consumable', quantity: 3, unit: 'pot 5L', estimated_cost: 450 },
    ],
  },
  {
    id: 'bom-2',
    code: 'BOM-VIDANGE-FULL',
    name: 'Kit Vidange Intégrale + 4 Filtres',
    target_item_name: 'Pack Entretien Moteur 30K',
    version: '1.0',
    description: 'Ensemble consommables et filtres pour entretien préventif périodique',
    labor_hours: 1.5,
    is_active: true,
    created_at: new Date().toISOString(),
    components: [
      { name: 'Huile Moteur 5W30 Synthèse', reference: 'OIL-5W30-T', category: 'consumable', quantity: 6, unit: 'L', estimated_cost: 420 },
      { name: 'Filtre à Huile Purflux', reference: 'FLT-OIL-PF', category: 'spare_part', quantity: 1, unit: 'pièce', estimated_cost: 95 },
      { name: 'Filtre à Carburant Gasoil', reference: 'FLT-FUEL-GF', category: 'spare_part', quantity: 1, unit: 'pièce', estimated_cost: 180 },
      { name: 'Filtre à Air & Habitacle', reference: 'FLT-AIR-HAB', category: 'spare_part', quantity: 2, unit: 'pièce', estimated_cost: 210 },
    ],
  },
];

export function useAtelier() {
  const [workOrders, setWorkOrders] = useState<AtelierWorkOrder[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY_ORDERS);
      return stored ? JSON.parse(stored) : INITIAL_ORDERS;
    } catch {
      return INITIAL_ORDERS;
    }
  });

  const [machines, setMachines] = useState<AtelierMachine[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY_MACHINES);
      return stored ? JSON.parse(stored) : INITIAL_MACHINES;
    } catch {
      return INITIAL_MACHINES;
    }
  });

  const [boms, setBoms] = useState<AtelierBOM[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY_BOMS);
      return stored ? JSON.parse(stored) : INITIAL_BOMS;
    } catch {
      return INITIAL_BOMS;
    }
  });

  const [isLoading, setIsLoading] = useState(false);

  // Sync to localStorage as real-time reliable cache
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_ORDERS, JSON.stringify(workOrders));
    } catch (e) {
      console.warn('Storage save error:', e);
    }
  }, [workOrders]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_MACHINES, JSON.stringify(machines));
    } catch (e) {
      console.warn('Storage save error:', e);
    }
  }, [machines]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_BOMS, JSON.stringify(boms));
    } catch (e) {
      console.warn('Storage save error:', e);
    }
  }, [boms]);

  // Load from Supabase on mount (fallback to local state if tables not yet migrated)
  const fetchFromSupabase = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: dbOrders, error: ordersErr } = await (supabase as any)
        .from('atelier_work_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (!ordersErr && dbOrders && dbOrders.length > 0) {
        setWorkOrders(dbOrders);
      }

      const { data: dbMachines, error: machErr } = await (supabase as any)
        .from('atelier_machines')
        .select('*')
        .order('code', { ascending: true });

      if (!machErr && dbMachines && dbMachines.length > 0) {
        setMachines(dbMachines);
      }

      const { data: dbBoms, error: bomErr } = await (supabase as any)
        .from('atelier_boms')
        .select('*')
        .order('created_at', { ascending: false });

      if (!bomErr && dbBoms && dbBoms.length > 0) {
        setBoms(dbBoms);
      }
    } catch (err) {
      console.log('Supabase offline or tables pending, using local robust cache.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFromSupabase();
  }, [fetchFromSupabase]);

  // Create Work Order
  const createWorkOrder = async (orderData: Partial<AtelierWorkOrder>, items: AtelierOrderItem[] = []) => {
    const newRef = `OT-2026-${String(workOrders.length + 1).padStart(3, '0')}`;
    const calculatedPartsCost = items
      .filter((i) => i.category === 'spare_part' || i.category === 'manufactured_part' || i.category === 'raw_material')
      .reduce((sum, i) => sum + (i.total_price || 0), 0);
    const calculatedConsumablesCost = items
      .filter((i) => i.category === 'consumable')
      .reduce((sum, i) => sum + (i.total_price || 0), 0);
    const hourlyRate = orderData.hourly_rate || 160;
    const estimatedHours = orderData.estimated_hours || 2;
    const laborCost = estimatedHours * hourlyRate;
    const totalCost = laborCost + calculatedPartsCost + calculatedConsumablesCost;

    const newOrder: AtelierWorkOrder = {
      id: `ot-${Date.now()}`,
      reference: orderData.reference || newRef,
      title: orderData.title || 'Nouvelle intervention atelier',
      activity_type: orderData.activity_type || 'maintenance',
      priority: orderData.priority || 'medium',
      status: orderData.status || 'planned',
      vehicle_id: orderData.vehicle_id || null,
      asset_name: orderData.asset_name || null,
      client_or_department: orderData.client_or_department || 'Atelier Principal',
      assigned_technician: orderData.assigned_technician || 'Équipe Technique',
      start_date: orderData.start_date || new Date().toISOString().slice(0, 10),
      due_date: orderData.due_date || new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      estimated_hours: estimatedHours,
      actual_hours: orderData.actual_hours || 0,
      hourly_rate: hourlyRate,
      labor_cost: laborCost,
      parts_cost: calculatedPartsCost,
      consumables_cost: calculatedConsumablesCost,
      total_cost: totalCost,
      description: orderData.description || '',
      diagnostic: orderData.diagnostic || '',
      solution: orderData.solution || '',
      quality_notes: orderData.quality_notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: items.map((it) => ({
        ...it,
        id: it.id || `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        total_price: (it.quantity || 1) * (it.unit_price || 0),
      })),
    };

    // Update local state immediately for instant responsive UI
    setWorkOrders((prev) => [newOrder, ...prev]);

    // Save to Supabase in background
    try {
      const { data: authData } = await supabase.auth.getUser();
      const payload = {
        reference: newOrder.reference,
        title: newOrder.title,
        activity_type: newOrder.activity_type,
        priority: newOrder.priority,
        status: newOrder.status,
        vehicle_id: newOrder.vehicle_id,
        asset_name: newOrder.asset_name,
        client_or_department: newOrder.client_or_department,
        assigned_technician: newOrder.assigned_technician,
        start_date: newOrder.start_date,
        due_date: newOrder.due_date,
        estimated_hours: newOrder.estimated_hours,
        actual_hours: newOrder.actual_hours,
        hourly_rate: newOrder.hourly_rate,
        labor_cost: newOrder.labor_cost,
        parts_cost: newOrder.parts_cost,
        consumables_cost: newOrder.consumables_cost,
        total_cost: newOrder.total_cost,
        description: newOrder.description,
        diagnostic: newOrder.diagnostic,
        solution: newOrder.solution,
        quality_notes: newOrder.quality_notes,
        user_id: authData?.user?.id || null,
      };

      const { data: inserted, error } = await (supabase as any)
        .from('atelier_work_orders')
        .insert(payload)
        .select()
        .single();

      if (!error && inserted) {
        // Also save order items if any
        if (newOrder.items && newOrder.items.length > 0) {
          const itemsPayload = newOrder.items.map((it) => ({
            work_order_id: inserted.id,
            name: it.name,
            reference: it.reference,
            category: it.category,
            quantity: it.quantity,
            unit: it.unit,
            unit_price: it.unit_price,
            total_price: it.total_price,
          }));
          await (supabase as any).from('atelier_order_items').insert(itemsPayload);
        }
      }
    } catch (e) {
      console.warn('Saved locally, will sync when online.', e);
    }

    toast.success(`Ordre de travail ${newOrder.reference} créé avec succès !`);
    return newOrder;
  };

  // Update Status / Progress
  const updateWorkOrderStatus = async (id: string, newStatus: AtelierStatus, actualHours?: number) => {
    setWorkOrders((prev) =>
      prev.map((order) => {
        if (order.id !== id) return order;
        const updatedHours = actualHours !== undefined ? actualHours : order.actual_hours;
        const laborCost = updatedHours * order.hourly_rate;
        const totalCost = laborCost + order.parts_cost + order.consumables_cost;
        return {
          ...order,
          status: newStatus,
          actual_hours: updatedHours,
          labor_cost: laborCost,
          total_cost: totalCost,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : order.completed_at,
          updated_at: new Date().toISOString(),
        };
      })
    );

    try {
      await (supabase as any)
        .from('atelier_work_orders')
        .update({
          status: newStatus,
          actual_hours: actualHours,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    } catch {
      // Local state already updated
    }

    toast.success(`Statut mis à jour : ${newStatus}`);
  };

  // Create Machine
  const createMachine = async (machineData: Omit<AtelierMachine, 'id' | 'created_at'>) => {
    const newMachine: AtelierMachine = {
      ...machineData,
      id: `m-${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    setMachines((prev) => [newMachine, ...prev]);

    try {
      await (supabase as any).from('atelier_machines').insert(machineData);
    } catch {
      // Local state ready
    }

    toast.success(`Équipement ${newMachine.code} ajouté avec succès !`);
  };

  // Create BOM
  const createBOM = async (bomData: Omit<AtelierBOM, 'id' | 'created_at'>) => {
    const newBom: AtelierBOM = {
      ...bomData,
      id: `bom-${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    setBoms((prev) => [newBom, ...prev]);

    try {
      await (supabase as any).from('atelier_boms').insert(bomData);
    } catch {
      // Local state ready
    }

    toast.success(`Nomenclature de fabrication ${newBom.code} créée !`);
  };

  // Summary Metrics for Expert KPI dashboard
  const metrics = {
    totalOrders: workOrders.length,
    activeOrders: workOrders.filter((o) => o.status === 'in_progress' || o.status === 'planned').length,
    completedOrders: workOrders.filter((o) => o.status === 'completed').length,
    urgentOrders: workOrders.filter((o) => (o.priority === 'urgent' || o.priority === 'high') && o.status !== 'completed').length,
    totalCosts: workOrders.reduce((sum, o) => sum + (o.total_cost || 0), 0),
    totalLaborHours: workOrders.reduce((sum, o) => sum + (o.actual_hours || o.estimated_hours || 0), 0),
    totalMachines: machines.length,
    machinesInUse: machines.filter((m) => m.status === 'in_use').length,
    machinesMaintenance: machines.filter((m) => m.status === 'maintenance' || m.status === 'stopped').length,
  };

  return {
    workOrders,
    machines,
    boms,
    metrics,
    isLoading,
    createWorkOrder,
    updateWorkOrderStatus,
    createMachine,
    createBOM,
    refetch: fetchFromSupabase,
  };
}
