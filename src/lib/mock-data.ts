// Mock data for SFTM
// All monetary values in MAD (Moroccan Dirham)

export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  type: 'truck' | 'van' | 'car';
  fuelType: 'diesel' | 'gasoline' | 'electric';
  status: 'active' | 'inactive' | 'maintenance';
  mileage: number;
  driver?: string;
  lastPosition?: {
    lat: number;
    lng: number;
    city: string;
    timestamp: string;
  };
  documents: {
    insurance: { expiry: string; valid: boolean };
    technicalVisit: { expiry: string; valid: boolean };
    vignette: { expiry: string; valid: boolean };
  };
  monthlyFuelCost: number;
  lastMaintenanceDate: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  license: string;
  licenseExpiry: string;
  status: 'available' | 'on_mission' | 'off_duty';
  vehicleId?: string;
  score: number;
}

export interface Mission {
  id: string;
  reference: string;
  client: string;
  origin: string;
  destination: string;
  status: 'draft' | 'planned' | 'in_progress' | 'delivered' | 'cancelled';
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
  notes?: string;
}

export interface Alert {
  id: string;
  type: 'maintenance' | 'document' | 'fuel' | 'speed' | 'geofence' | 'disconnect';
  severity: 'low' | 'medium' | 'high';
  vehicleId: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface FuelLog {
  id: string;
  vehicleId: string;
  driverId: string;
  date: string;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  station: string;
  mileage: number;
}

export interface MaintenancePlan {
  id: string;
  vehicleId: string;
  type: 'oil_change' | 'tires' | 'brakes' | 'filters' | 'general_inspection' | 'other';
  name: string;
  intervalKm?: number;
  intervalDays?: number;
  lastDoneDate: string;
  lastDoneMileage: number;
  nextDueDate: string;
  nextDueMileage: number;
  status: 'ok' | 'due_soon' | 'overdue';
}

export interface WorkOrder {
  id: string;
  reference: string;
  vehicleId: string;
  type: 'preventive' | 'corrective' | 'inspection';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  description: string;
  diagnosis?: string;
  garage?: string;
  scheduledDate: string;
  completedDate?: string;
  laborCost: number;
  partsCost: number;
  totalCost: number;
  parts: { name: string; quantity: number; unitPrice: number }[];
  notes?: string;
}

// Mock Vehicles
export const mockVehicles: Vehicle[] = [
  {
    id: 'v1',
    plate: '12345-A-1',
    brand: 'Mercedes-Benz',
    model: 'Actros 1845',
    type: 'truck',
    fuelType: 'diesel',
    status: 'active',
    mileage: 245780,
    driver: 'Mohamed Alami',
    lastPosition: {
      lat: 33.5731,
      lng: -7.5898,
      city: 'Casablanca',
      timestamp: '2024-01-15T10:30:00',
    },
    documents: {
      insurance: { expiry: '2024-06-15', valid: true },
      technicalVisit: { expiry: '2024-03-20', valid: true },
      vignette: { expiry: '2024-12-31', valid: true },
    },
    monthlyFuelCost: 18500,
    lastMaintenanceDate: '2024-01-05',
  },
  {
    id: 'v2',
    plate: '23456-B-2',
    brand: 'Volvo',
    model: 'FH16 750',
    type: 'truck',
    fuelType: 'diesel',
    status: 'active',
    mileage: 312450,
    driver: 'Ahmed Benjelloun',
    lastPosition: {
      lat: 34.0209,
      lng: -6.8416,
      city: 'Rabat',
      timestamp: '2024-01-15T10:25:00',
    },
    documents: {
      insurance: { expiry: '2024-08-10', valid: true },
      technicalVisit: { expiry: '2024-02-15', valid: false },
      vignette: { expiry: '2024-12-31', valid: true },
    },
    monthlyFuelCost: 22300,
    lastMaintenanceDate: '2023-12-20',
  },
  {
    id: 'v3',
    plate: '34567-C-3',
    brand: 'Renault',
    model: 'Master',
    type: 'van',
    fuelType: 'diesel',
    status: 'maintenance',
    mileage: 89500,
    lastPosition: {
      lat: 33.9716,
      lng: -6.8498,
      city: 'Témara',
      timestamp: '2024-01-14T18:00:00',
    },
    documents: {
      insurance: { expiry: '2024-07-22', valid: true },
      technicalVisit: { expiry: '2024-09-05', valid: true },
      vignette: { expiry: '2024-12-31', valid: true },
    },
    monthlyFuelCost: 8200,
    lastMaintenanceDate: '2024-01-14',
  },
  {
    id: 'v4',
    plate: '45678-D-4',
    brand: 'Iveco',
    model: 'Stralis 480',
    type: 'truck',
    fuelType: 'diesel',
    status: 'active',
    mileage: 187650,
    driver: 'Youssef Tazi',
    lastPosition: {
      lat: 31.6295,
      lng: -7.9811,
      city: 'Marrakech',
      timestamp: '2024-01-15T10:28:00',
    },
    documents: {
      insurance: { expiry: '2024-05-30', valid: true },
      technicalVisit: { expiry: '2024-04-12', valid: true },
      vignette: { expiry: '2024-12-31', valid: true },
    },
    monthlyFuelCost: 15800,
    lastMaintenanceDate: '2024-01-02',
  },
  {
    id: 'v5',
    plate: '56789-E-5',
    brand: 'Ford',
    model: 'Transit',
    type: 'van',
    fuelType: 'diesel',
    status: 'active',
    mileage: 56320,
    driver: 'Karim Ouazzani',
    lastPosition: {
      lat: 35.7595,
      lng: -5.8340,
      city: 'Tanger',
      timestamp: '2024-01-15T10:20:00',
    },
    documents: {
      insurance: { expiry: '2024-09-18', valid: true },
      technicalVisit: { expiry: '2024-11-25', valid: true },
      vignette: { expiry: '2024-12-31', valid: true },
    },
    monthlyFuelCost: 6500,
    lastMaintenanceDate: '2023-12-15',
  },
  {
    id: 'v6',
    plate: '67890-F-6',
    brand: 'Dacia',
    model: 'Dokker',
    type: 'car',
    fuelType: 'gasoline',
    status: 'inactive',
    mileage: 34200,
    documents: {
      insurance: { expiry: '2024-04-05', valid: true },
      technicalVisit: { expiry: '2024-06-10', valid: true },
      vignette: { expiry: '2024-12-31', valid: true },
    },
    monthlyFuelCost: 0,
    lastMaintenanceDate: '2023-11-20',
  },
];

// Mock Drivers
export const mockDrivers: Driver[] = [
  { id: 'd1', name: 'Mohamed Alami', phone: '+212 661-234567', license: 'C', licenseExpiry: '2025-06-15', status: 'on_mission', vehicleId: 'v1', score: 92 },
  { id: 'd2', name: 'Ahmed Benjelloun', phone: '+212 662-345678', license: 'C', licenseExpiry: '2024-12-20', status: 'on_mission', vehicleId: 'v2', score: 88 },
  { id: 'd3', name: 'Youssef Tazi', phone: '+212 663-456789', license: 'C', licenseExpiry: '2025-03-10', status: 'on_mission', vehicleId: 'v4', score: 95 },
  { id: 'd4', name: 'Karim Ouazzani', phone: '+212 664-567890', license: 'B', licenseExpiry: '2024-08-25', status: 'on_mission', vehicleId: 'v5', score: 85 },
  { id: 'd5', name: 'Hassan Filali', phone: '+212 665-678901', license: 'C', licenseExpiry: '2025-01-30', status: 'available', score: 90 },
  { id: 'd6', name: 'Omar Idrissi', phone: '+212 666-789012', license: 'B', licenseExpiry: '2024-11-15', status: 'off_duty', score: 78 },
];

// Mock Missions
export const mockMissions: Mission[] = [
  { id: 'm1', reference: 'MIS-2024-001', client: 'Marjane Distribution', origin: 'Casablanca', destination: 'Rabat', status: 'in_progress', vehicleId: 'v1', driverId: 'd1', departureDate: '2024-01-15T08:00:00', estimatedArrival: '2024-01-15T11:00:00', cargo: 'Produits alimentaires', weight: 12500, fuelQuantity: 0, pricePerLiter: 12.5, fuelCost: 0, discountRate: 0, discountAmount: 0, taxRate: 20, taxAmount: 0, cashAmount: 0, extraFees: 0, totalCost: 0 },
  { id: 'm2', reference: 'MIS-2024-002', client: 'Label\'Vie', origin: 'Rabat', destination: 'Fès', status: 'in_progress', vehicleId: 'v2', driverId: 'd2', departureDate: '2024-01-15T07:30:00', estimatedArrival: '2024-01-15T12:30:00', cargo: 'Électroménager', weight: 8200, fuelQuantity: 0, pricePerLiter: 12.5, fuelCost: 0, discountRate: 0, discountAmount: 0, taxRate: 20, taxAmount: 0, cashAmount: 0, extraFees: 0, totalCost: 0 },
  { id: 'm3', reference: 'MIS-2024-003', client: 'Bricoma', origin: 'Marrakech', destination: 'Agadir', status: 'planned', vehicleId: 'v4', driverId: 'd3', departureDate: '2024-01-16T06:00:00', estimatedArrival: '2024-01-16T10:00:00', cargo: 'Matériaux construction', weight: 18000, fuelQuantity: 0, pricePerLiter: 12.5, fuelCost: 0, discountRate: 0, discountAmount: 0, taxRate: 20, taxAmount: 0, cashAmount: 0, extraFees: 0, totalCost: 0 },
  { id: 'm4', reference: 'MIS-2024-004', client: 'Kitea', origin: 'Tanger', destination: 'Tétouan', status: 'in_progress', vehicleId: 'v5', driverId: 'd4', departureDate: '2024-01-15T09:00:00', estimatedArrival: '2024-01-15T10:30:00', cargo: 'Meubles', weight: 3500, fuelQuantity: 0, pricePerLiter: 12.5, fuelCost: 0, discountRate: 0, discountAmount: 0, taxRate: 20, taxAmount: 0, cashAmount: 0, extraFees: 0, totalCost: 0 },
  { id: 'm5', reference: 'MIS-2024-005', client: 'Aswak Assalam', origin: 'Casablanca', destination: 'El Jadida', status: 'delivered', vehicleId: 'v1', driverId: 'd1', departureDate: '2024-01-14T14:00:00', estimatedArrival: '2024-01-14T16:30:00', cargo: 'Produits frais', weight: 9800, fuelQuantity: 320, pricePerLiter: 12.5, fuelCost: 4000, discountRate: 5, discountAmount: 400, taxRate: 20, taxAmount: 780, cashAmount: 4000, extraFees: 300, totalCost: 5180 },
];

// Mock Alerts
export const mockAlerts: Alert[] = [
  { id: 'a1', type: 'document', severity: 'high', vehicleId: 'v2', message: 'Visite technique expire dans 30 jours', timestamp: '2024-01-15T08:00:00', acknowledged: false },
  { id: 'a2', type: 'maintenance', severity: 'medium', vehicleId: 'v1', message: 'Vidange prévue dans 500 km', timestamp: '2024-01-15T07:30:00', acknowledged: false },
  { id: 'a3', type: 'fuel', severity: 'medium', vehicleId: 'v4', message: 'Consommation anormale détectée', timestamp: '2024-01-14T22:00:00', acknowledged: true },
  { id: 'a4', type: 'speed', severity: 'low', vehicleId: 'v5', message: 'Excès de vitesse: 95 km/h en zone 80', timestamp: '2024-01-15T09:15:00', acknowledged: false },
  { id: 'a5', type: 'geofence', severity: 'medium', vehicleId: 'v2', message: 'Sortie de l\'itinéraire prévu', timestamp: '2024-01-15T10:00:00', acknowledged: false },
];

// Mock Fuel Logs
export const mockFuelLogs: FuelLog[] = [
  { id: 'f1', vehicleId: 'v1', driverId: 'd1', date: '2024-01-14', liters: 320, pricePerLiter: 12.50, totalCost: 4000, station: 'Afriquia Casa Nord', mileage: 245500 },
  { id: 'f2', vehicleId: 'v2', driverId: 'd2', date: '2024-01-13', liters: 400, pricePerLiter: 12.45, totalCost: 4980, station: 'Shell Rabat Agdal', mileage: 312100 },
  { id: 'f3', vehicleId: 'v4', driverId: 'd3', date: '2024-01-14', liters: 280, pricePerLiter: 12.55, totalCost: 3514, station: 'Total Marrakech', mileage: 187400 },
  { id: 'f4', vehicleId: 'v5', driverId: 'd4', date: '2024-01-15', liters: 85, pricePerLiter: 12.60, totalCost: 1071, station: 'Afriquia Tanger Med', mileage: 56280 },
];

// Mock Maintenance Plans
export const mockMaintenancePlans: MaintenancePlan[] = [
  { id: 'mp1', vehicleId: 'v1', type: 'oil_change', name: 'Vidange huile moteur', intervalKm: 15000, lastDoneDate: '2024-01-05', lastDoneMileage: 240000, nextDueDate: '2024-04-05', nextDueMileage: 255000, status: 'due_soon' },
  { id: 'mp2', vehicleId: 'v1', type: 'filters', name: 'Remplacement filtres', intervalKm: 30000, lastDoneDate: '2023-10-15', lastDoneMileage: 225000, nextDueDate: '2024-04-15', nextDueMileage: 255000, status: 'ok' },
  { id: 'mp3', vehicleId: 'v2', type: 'brakes', name: 'Contrôle freins', intervalKm: 50000, lastDoneDate: '2023-08-20', lastDoneMileage: 280000, nextDueDate: '2024-02-20', nextDueMileage: 330000, status: 'overdue' },
  { id: 'mp4', vehicleId: 'v2', type: 'tires', name: 'Rotation pneus', intervalKm: 20000, lastDoneDate: '2023-12-01', lastDoneMileage: 305000, nextDueDate: '2024-03-01', nextDueMileage: 325000, status: 'ok' },
  { id: 'mp5', vehicleId: 'v3', type: 'general_inspection', name: 'Révision générale', intervalDays: 180, lastDoneDate: '2023-09-14', lastDoneMileage: 82000, nextDueDate: '2024-03-14', nextDueMileage: 97000, status: 'ok' },
  { id: 'mp6', vehicleId: 'v4', type: 'oil_change', name: 'Vidange huile moteur', intervalKm: 15000, lastDoneDate: '2024-01-02', lastDoneMileage: 185000, nextDueDate: '2024-04-02', nextDueMileage: 200000, status: 'ok' },
];

// Mock Work Orders
export const mockWorkOrders: WorkOrder[] = [
  {
    id: 'wo1',
    reference: 'OT-2024-001',
    vehicleId: 'v3',
    type: 'corrective',
    status: 'in_progress',
    priority: 'high',
    description: 'Remplacement embrayage usé',
    diagnosis: 'Embrayage patine, usure anormale détectée',
    garage: 'Garage Central Rabat',
    scheduledDate: '2024-01-14',
    laborCost: 1500,
    partsCost: 4200,
    totalCost: 5700,
    parts: [
      { name: 'Kit embrayage complet', quantity: 1, unitPrice: 3800 },
      { name: 'Butée embrayage', quantity: 1, unitPrice: 400 },
    ],
  },
  {
    id: 'wo2',
    reference: 'OT-2024-002',
    vehicleId: 'v1',
    type: 'preventive',
    status: 'pending',
    priority: 'medium',
    description: 'Vidange huile + filtres',
    garage: 'Mercedes Service Casa',
    scheduledDate: '2024-01-20',
    laborCost: 500,
    partsCost: 1800,
    totalCost: 2300,
    parts: [
      { name: 'Huile moteur 15W40 (20L)', quantity: 1, unitPrice: 1200 },
      { name: 'Filtre à huile', quantity: 1, unitPrice: 350 },
      { name: 'Filtre à air', quantity: 1, unitPrice: 250 },
    ],
  },
  {
    id: 'wo3',
    reference: 'OT-2024-003',
    vehicleId: 'v2',
    type: 'corrective',
    status: 'completed',
    priority: 'high',
    description: 'Réparation système de freinage',
    diagnosis: 'Plaquettes usées, disques à remplacer',
    garage: 'Volvo Trucks Rabat',
    scheduledDate: '2024-01-10',
    completedDate: '2024-01-12',
    laborCost: 2000,
    partsCost: 6500,
    totalCost: 8500,
    parts: [
      { name: 'Disques de frein avant', quantity: 2, unitPrice: 2200 },
      { name: 'Plaquettes de frein', quantity: 2, unitPrice: 1050 },
    ],
    notes: 'Travaux effectués avec succès. Véhicule testé sur 50km.',
  },
  {
    id: 'wo4',
    reference: 'OT-2024-004',
    vehicleId: 'v5',
    type: 'inspection',
    status: 'pending',
    priority: 'low',
    description: 'Contrôle technique annuel',
    garage: 'Centre VT Tanger',
    scheduledDate: '2024-01-25',
    laborCost: 300,
    partsCost: 0,
    totalCost: 300,
    parts: [],
  },
];

// Dashboard KPIs
export const dashboardKPIs = {
  activeVehicles: 4,
  totalVehicles: 6,
  ongoingMissions: 3,
  pendingAlerts: 4,
  monthlyFuelCost: 71300,
  upcomingMaintenance: 2,
  fleetAvailability: 66.7,
  avgFuelConsumption: 32.5,
};

// Fuel consumption by month (for charts)
export const fuelConsumptionByMonth = [
  { month: 'Août', consumption: 4250, cost: 51875 },
  { month: 'Sep', consumption: 4100, cost: 50225 },
  { month: 'Oct', consumption: 4450, cost: 54512 },
  { month: 'Nov', consumption: 4680, cost: 57330 },
  { month: 'Déc', consumption: 5120, cost: 62720 },
  { month: 'Jan', consumption: 5830, cost: 71300 },
];

// Cost by vehicle (for charts)
export const costByVehicle = [
  { plate: '12345-A-1', fuel: 18500, maintenance: 3200, other: 1500 },
  { plate: '23456-B-2', fuel: 22300, maintenance: 4500, other: 2100 },
  { plate: '34567-C-3', fuel: 8200, maintenance: 8500, other: 800 },
  { plate: '45678-D-4', fuel: 15800, maintenance: 2800, other: 1200 },
  { plate: '56789-E-5', fuel: 6500, maintenance: 1200, other: 600 },
];

// Fleet availability by day
export const fleetAvailabilityByDay = [
  { day: 'Lun', available: 5, total: 6 },
  { day: 'Mar', available: 4, total: 6 },
  { day: 'Mer', available: 5, total: 6 },
  { day: 'Jeu', available: 4, total: 6 },
  { day: 'Ven', available: 4, total: 6 },
  { day: 'Sam', available: 3, total: 6 },
  { day: 'Dim', available: 2, total: 6 },
];

// Maintenance costs by month
export const maintenanceCostsByMonth = [
  { month: 'Août', preventive: 4500, corrective: 8200 },
  { month: 'Sep', preventive: 3200, corrective: 2100 },
  { month: 'Oct', preventive: 5100, corrective: 0 },
  { month: 'Nov', preventive: 2800, corrective: 12500 },
  { month: 'Déc', preventive: 4200, corrective: 3800 },
  { month: 'Jan', preventive: 2300, corrective: 14200 },
];
