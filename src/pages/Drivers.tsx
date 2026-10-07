import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Search, Filter, LayoutGrid, List, UserCheck, UserX, Clock, Loader2, Car, Wifi, WifiOff, Plus, Bug, SquarePen, Trash2, History, FileDown, AlertTriangle } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDrivers, Driver } from '@/hooks/useDrivers';
import { useGPSwoxData, GPSwoxDriver } from '@/hooks/useGPSwoxVehicles';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DriverForm } from '@/components/drivers/DriverForm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useDeleteDriver, useUpdateDriver } from '@/hooks/useDrivers';
import { useMissions } from '@/hooks/useMissions';
import { useVoyages } from '@/hooks/useTransportBTP';
import { useTourismMissions } from '@/hooks/useTourism';
import { useInfractions } from '@/hooks/usePersonnel';
import { useTourismCompanyProfile } from '@/hooks/useTourismCompany';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MappedDriver {
  id: string;
  name: string;
  phone: string;
  licenseType: string;
  licenseExpiry: string;
  vehicleId: string | null;
  vehiclePlate: string | null;
  status: 'available' | 'on_mission' | 'off_duty';
  isOnline: boolean;
  source: 'local' | 'gpswox';
}

type DriverStatus = 'available' | 'on_mission' | 'off_duty';

interface DriverHistoryEntry {
  at: string;
  status: DriverStatus;
  vehicleId: string | null;
  vehiclePlate: string | null;
  source: 'snapshot' | 'rest_scheduled' | 'rest_finished';
  note?: string;
  restStart?: string;
  restEnd?: string;
}

interface DriverTimelineRow {
  at: string;
  type: 'status' | 'mission' | 'voyage' | 'tourism';
  label: string;
  status?: DriverStatus;
  vehicle: string;
  source: string;
}

interface DriverInfractionRow {
  id: string;
  infractionDate: string;
  infractionType: string;
  location: string | null;
  amount: number;
  pointsDeducted: number | null;
  status: string | null;
}

function toDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(value: string) {
  return new Date(value).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

const dataUrlFromBlob = async (blob: Blob) =>
  await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(blob);
  });

function extractStoragePath(logo: string) {
  if (!logo) return null;
  if (!logo.startsWith('http')) return logo.split('?')[0];

  const publicMarker = '/storage/v1/object/public/tourism-assets/';
  const signedMarker = '/storage/v1/object/sign/tourism-assets/';

  const publicIdx = logo.indexOf(publicMarker);
  if (publicIdx >= 0) return logo.slice(publicIdx + publicMarker.length).split('?')[0];

  const signedIdx = logo.indexOf(signedMarker);
  if (signedIdx >= 0) return logo.slice(signedIdx + signedMarker.length).split('?')[0];

  return null;
}

function getDriverHistoryKey(driverId: string) {
  return `driver_status_history_${driverId}`;
}

function readDriverHistory(driverId: string): DriverHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(getDriverHistoryKey(driverId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as DriverHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDriverHistory(driverId: string, entries: DriverHistoryEntry[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getDriverHistoryKey(driverId), JSON.stringify(entries.slice(-500)));
}

function appendDriverHistoryEntry(driver: MappedDriver, entry: DriverHistoryEntry) {
  const entries = readDriverHistory(driver.id);
  const last = entries[entries.length - 1];
  if (
    entry.source === 'snapshot' &&
    last &&
    last.source === 'snapshot' &&
    last.status === entry.status &&
    last.vehicleId === entry.vehicleId &&
    last.vehiclePlate === entry.vehiclePlate
  ) {
    return;
  }
  entries.push(entry);
  writeDriverHistory(driver.id, entries);
}

export default function Drivers() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<Driver | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [hideGPSwox, setHideGPSwox] = useState(false);
  const [historyDialogDriver, setHistoryDialogDriver] = useState<MappedDriver | null>(null);
  const [historyWindowDays, setHistoryWindowDays] = useState<number>(30);

  const { data: drivers = [], isLoading: isLoadingDrivers } = useDrivers();
  const { data: gpswoxData, isLoading: isLoadingGPSwox, error: gpswoxError } = useGPSwoxData();
  const { data: missions = [] } = useMissions();
  const { data: voyages = [] } = useVoyages();
  const { data: tourismMissions = [] } = useTourismMissions();
  const { data: infractions = [] } = useInfractions();
  const { data: companyProfile } = useTourismCompanyProfile();
  const updateDriver = useUpdateDriver();
  const deleteDriver = useDeleteDriver();
  const [restDialogDriver, setRestDialogDriver] = useState<MappedDriver | null>(null);
  const [restStart, setRestStart] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [restDays, setRestDays] = useState<number>(1);
  
  const vehicles = gpswoxData?.vehicles || [];
  const gpswoxDrivers = gpswoxData?.drivers || [];
  const debug = gpswoxData?.debug;

  console.log('GPSwox Data Debug:', { 
    vehiclesCount: vehicles.length, 
    driversCount: gpswoxDrivers.length, 
    error: gpswoxError,
    drivers: gpswoxDrivers 
  });

  const isLoading = isLoadingDrivers || isLoadingGPSwox;
  const localDriversById = useMemo(() => {
    const map = new Map<string, Driver>();
    drivers.forEach((driver) => map.set(driver.id, driver));
    return map;
  }, [drivers]);

  // Map drivers with vehicle status from GPSwox
  const mappedDrivers = useMemo(() => {
    // Create a map of vehicle plate to vehicle for quick lookup
    const vehicleByPlate = new Map<string, typeof vehicles[0]>();
    const vehicleById = new Map<string, typeof vehicles[0]>();
    vehicles.forEach(v => {
      vehicleByPlate.set(v.plate.toLowerCase(), v);
      vehicleById.set(v.id, v);
    });

    const localDrivers: MappedDriver[] = drivers.map((driver: Driver): MappedDriver => {
      // Try to find the vehicle assigned to this driver
      let vehicle = driver.vehicle_id ? vehicleById.get(driver.vehicle_id) : null;
      
      // Also try to find by matching vehicle plate
      if (!vehicle && driver.vehicle_id) {
        vehicle = vehicleByPlate.get(driver.vehicle_id.toLowerCase());
      }
      
      // Determine status based on vehicle state
      let status: 'available' | 'on_mission' | 'off_duty' = (driver.status as 'available' | 'on_mission' | 'off_duty') || 'off_duty';
      let isOnline = false;
      
      if (vehicle) {
        isOnline = vehicle.online === 'online' || vehicle.online === 'ack';
        const isMoving = vehicle.lastPosition?.speed && vehicle.lastPosition.speed > 0;
        
        if (!isOnline) {
          status = 'off_duty';
        } else if (isMoving) {
          status = 'on_mission';
        } else {
          status = 'available';
        }
      }
      
      return {
        id: driver.id,
        name: driver.name,
        phone: driver.phone || '',
        licenseType: driver.license_type,
        licenseExpiry: driver.license_expiry,
        vehicleId: driver.vehicle_id,
        vehiclePlate: vehicle?.plate || null,
        status,
        isOnline,
        source: 'local',
      };
    });

    // Map GPSwox drivers that are not in local DB (by name)
    const localDriverNames = new Set(localDrivers.map(d => d.name.toLowerCase()));
    
    const remoteDrivers: MappedDriver[] = gpswoxDrivers
      .filter(d => !localDriverNames.has(d.name.toLowerCase()))
      .map((driver: GPSwoxDriver) => {
        // Find vehicle for this driver
        let vehicle = driver.deviceId ? vehicleById.get(String(driver.deviceId)) : null;
        if (!vehicle && driver.deviceName) {
          vehicle = vehicleByPlate.get(driver.deviceName.toLowerCase());
        }

        let status: 'available' | 'on_mission' | 'off_duty' = 'off_duty';
        let isOnline = false;

        if (vehicle) {
          isOnline = vehicle.online === 'online' || vehicle.online === 'ack';
          const isMoving = vehicle.lastPosition?.speed && vehicle.lastPosition.speed > 0;
          
          if (!isOnline) {
            status = 'off_duty';
          } else if (isMoving) {
            status = 'on_mission';
          } else {
            status = 'available';
          }
        }

        return {
          id: `gpswox-${driver.id}`,
          name: driver.name,
          phone: driver.phone || '',
          licenseType: 'GPSwox',
          licenseExpiry: '',
          vehicleId: driver.deviceId ? String(driver.deviceId) : null,
          vehiclePlate: driver.deviceName || vehicle?.plate || null,
          status,
          isOnline,
          source: 'gpswox',
        };
      });

    return [...localDrivers, ...remoteDrivers];
  }, [drivers, vehicles, gpswoxDrivers]);

  useEffect(() => {
    mappedDrivers.forEach(d => {
      const key = `driver_rest_${d.id}`;
      const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      if (!raw) return;
      const data = JSON.parse(raw);
      const end = new Date(data.end);
      const now = new Date();
      if (now >= end && d.source === 'local' && d.status === 'off_duty') {
        updateDriver.mutate({ id: d.id, status: 'available' });
        appendDriverHistoryEntry(d, {
          at: now.toISOString(),
          status: 'available',
          vehicleId: d.vehicleId,
          vehiclePlate: d.vehiclePlate,
          source: 'rest_finished',
          note: 'Retour automatique après repos',
        });
        localStorage.removeItem(key);
      }
    });
  }, [mappedDrivers, updateDriver]);

  useEffect(() => {
    mappedDrivers.forEach((driver) => {
      appendDriverHistoryEntry(driver, {
        at: new Date().toISOString(),
        status: driver.status,
        vehicleId: driver.vehicleId,
        vehiclePlate: driver.vehiclePlate,
        source: 'snapshot',
      });
    });
  }, [mappedDrivers]);

  const handleSaveRest = () => {
    if (!restDialogDriver) return;
    const start = new Date(restStart);
    const end = new Date(restStart);
    end.setDate(start.getDate() + Number(restDays));
    const key = `driver_rest_${restDialogDriver.id}`;
    localStorage.setItem(key, JSON.stringify({ start: start.toISOString(), end: end.toISOString(), days: Number(restDays) }));
    appendDriverHistoryEntry(restDialogDriver, {
      at: new Date().toISOString(),
      status: 'off_duty',
      vehicleId: restDialogDriver.vehicleId,
      vehiclePlate: restDialogDriver.vehiclePlate,
      source: 'rest_scheduled',
      note: `Repos planifié (${Number(restDays)} jour${Number(restDays) > 1 ? 's' : ''})`,
      restStart: start.toISOString(),
      restEnd: end.toISOString(),
    });
    if (restDialogDriver.source === 'local') {
      updateDriver.mutate({ id: restDialogDriver.id, status: 'off_duty' });
    }
    setRestDialogDriver(null);
  };

  const vehiclesById = useMemo(() => {
    const map = new Map<string, string>();
    vehicles.forEach((vehicle) => {
      map.set(String(vehicle.id), vehicle.plate);
    });
    return map;
  }, [vehicles]);

  const getVehicleLabel = (vehicleId: string | null, fallback?: string | null) => {
    if (!vehicleId) return fallback || '-';
    return vehiclesById.get(String(vehicleId)) || fallback || String(vehicleId);
  };

  const historyTimeline = useMemo<DriverTimelineRow[]>(() => {
    if (!historyDialogDriver) return [];
    const historyRows = readDriverHistory(historyDialogDriver.id).map((entry) => ({
      at: entry.at,
      type: 'status' as const,
      label:
        entry.note ||
        (entry.status === 'available'
          ? 'Disponible'
          : entry.status === 'on_mission'
            ? 'En mission'
            : 'Repos'),
      status: entry.status,
      vehicle: getVehicleLabel(entry.vehicleId, entry.vehiclePlate),
      source: entry.source === 'snapshot' ? 'Statut' : 'Événement',
    }));

    const missionRows =
      historyDialogDriver.source === 'local'
        ? missions
            .filter((mission) => mission.driver_id === historyDialogDriver.id)
            .map((mission) => ({
              at: `${mission.mission_date}T08:00:00`,
              type: 'mission' as const,
              label: `Mission ${mission.departure_zone} <-> ${mission.arrival_zone}`,
              status: mission.status === 'in_progress' ? 'on_mission' : 'available',
              vehicle: getVehicleLabel(mission.vehicle_id),
              source: 'Mission',
            }))
        : [];

    const voyageRows =
      historyDialogDriver.source === 'local'
        ? voyages
            .filter((voyage) => voyage.driver_id === historyDialogDriver.id)
            .map((voyage) => ({
              at: `${voyage.voyage_date}T${voyage.departure_time || '08:00:00'}`,
              type: 'voyage' as const,
              label: `Voyage ${voyage.trajet?.name || voyage.material_type || ''}`.trim(),
              status: 'on_mission' as const,
              vehicle: getVehicleLabel(voyage.vehicle_id),
              source: 'BTP',
            }))
        : [];

    const tourismRows =
      historyDialogDriver.source === 'local'
        ? tourismMissions
            .filter((mission) => mission.driver_id === historyDialogDriver.id)
            .map((mission) => ({
              at: `${mission.start_date}T${mission.start_time || '08:00:00'}`,
              type: 'tourism' as const,
              label: `Tourisme ${mission.reference} | ${mission.title}`,
              status: mission.status === 'in_progress' ? 'on_mission' : 'available',
              vehicle: getVehicleLabel(mission.vehicle_id),
              source: 'Tourisme',
            }))
        : [];

    return [...historyRows, ...missionRows, ...voyageRows, ...tourismRows].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
    );
  }, [getVehicleLabel, historyDialogDriver, missions, tourismMissions, voyages]);

  const driverInfractions = useMemo<DriverInfractionRow[]>(() => {
    if (!historyDialogDriver) return [];
    const driverName = normalizeName(historyDialogDriver.name);
    return infractions
      .filter((infraction) => {
        const personnelName = infraction.personnel
          ? normalizeName(`${infraction.personnel.first_name} ${infraction.personnel.last_name}`)
          : '';
        return (
          personnelName === driverName ||
          personnelName.includes(driverName) ||
          driverName.includes(personnelName)
        );
      })
      .map((infraction) => ({
        id: infraction.id,
        infractionDate: infraction.infraction_date,
        infractionType: infraction.infraction_type,
        location: infraction.location,
        amount: Number(infraction.amount || 0),
        pointsDeducted: infraction.points_deducted,
        status: infraction.status,
      }))
      .sort((a, b) => new Date(b.infractionDate).getTime() - new Date(a.infractionDate).getTime());
  }, [historyDialogDriver, infractions]);

  const historyStats = useMemo(() => {
    if (!historyDialogDriver) {
      return { reposDays: 0, missionDays: 0, disponibleDays: 0, vehiclesUsed: [] as string[] };
    }
    const now = new Date();
    const rangeStart = new Date();
    rangeStart.setDate(now.getDate() - (historyWindowDays - 1));
    rangeStart.setHours(0, 0, 0, 0);

    const inRangeRows = historyTimeline.filter((row) => new Date(row.at).getTime() >= rangeStart.getTime());
    const missionDays = new Set(
      inRangeRows
        .filter((row) => row.type === 'mission' || row.type === 'voyage' || row.type === 'tourism')
        .map((row) => toDayKey(new Date(row.at)))
    );

    const restEntries = readDriverHistory(historyDialogDriver.id).filter(
      (entry) => entry.source === 'rest_scheduled' && entry.restStart && entry.restEnd
    );
    const restDays = new Set<string>();
    restEntries.forEach((entry) => {
      const start = new Date(entry.restStart as string);
      const end = new Date(entry.restEnd as string);
      const cursor = new Date(start);
      cursor.setHours(0, 0, 0, 0);
      while (cursor <= end) {
        if (cursor >= rangeStart && cursor <= now) {
          restDays.add(toDayKey(cursor));
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    });

    const vehiclesUsed = Array.from(
      new Set(inRangeRows.map((row) => row.vehicle).filter((vehicle) => vehicle && vehicle !== '-'))
    );
    const missionDaysCount = missionDays.size;
    const reposDaysCount = restDays.size;
    const disponibleDays = Math.max(0, historyWindowDays - reposDaysCount - missionDaysCount);

    return {
      reposDays: reposDaysCount,
      missionDays: missionDaysCount,
      disponibleDays,
      vehiclesUsed,
    };
  }, [historyDialogDriver, historyTimeline, historyWindowDays]);

  const infractionStats = useMemo(() => {
    const now = new Date();
    const rangeStart = new Date();
    rangeStart.setDate(now.getDate() - (historyWindowDays - 1));
    rangeStart.setHours(0, 0, 0, 0);

    const inRange = driverInfractions.filter(
      (item) => new Date(item.infractionDate).getTime() >= rangeStart.getTime()
    );
    const unpaidCount = inRange.filter((item) => (item.status || 'unpaid') === 'unpaid').length;
    const totalAmount = inRange.reduce((sum, item) => sum + item.amount, 0);
    const totalPoints = inRange.reduce((sum, item) => sum + (item.pointsDeducted || 0), 0);

    return {
      totalInRange: inRange.length,
      unpaidInRange: unpaidCount,
      amountInRange: totalAmount,
      pointsInRange: totalPoints,
    };
  }, [driverInfractions, historyWindowDays]);

  const handleDownloadHistoryPdf = async () => {
    if (!historyDialogDriver) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const generatedAt = formatDateTime(new Date().toISOString());
    const companyName = companyProfile?.company_name || 'SFTM';
    const currencyCandidate = typeof (companyProfile as any)?.currency === 'string' ? String((companyProfile as any).currency).toUpperCase() : 'MAD';
    const currencyCode = /^[A-Z]{3}$/.test(currencyCandidate) ? currencyCandidate : 'MAD';
    const contactLine = [companyProfile?.contact_email, companyProfile?.contact_phone].filter(Boolean).join(' | ');
    const footerLine = [companyProfile?.address, companyProfile?.tax_info].filter(Boolean).join(' | ');
    const statusLabelByKey: Record<string, string> = {
      unpaid: 'Non payé',
      paid: 'Payé',
      contested: 'Contesté',
    };
    const formatMoney = (amount: number) =>
      new Intl.NumberFormat('fr-MA', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount || 0);
    const sanitizePdfText = (value: string) =>
      (value || '')
        .replace(/[•●▪◆◦]/g, ' | ')
        .replace(/[→➜➡]/g, ' -> ')
        .replace(/[↔⟷]/g, ' <-> ')
        .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const addMovementTag = (text: string, type: DriverTimelineRow['type']) =>
      type === 'mission' || type === 'voyage' || type === 'tourism' ? `TXN ${text}` : text;
    const drawGradientHeader = () => {
      const y = 0;
      const height = 38;
      const steps = 72;
      const from: [number, number, number] = [4, 16, 47];
      const to: [number, number, number] = [3, 105, 161];
      for (let i = 0; i < steps; i += 1) {
        const ratio = i / (steps - 1);
        const r = Math.round(from[0] + (to[0] - from[0]) * ratio);
        const g = Math.round(from[1] + (to[1] - from[1]) * ratio);
        const b = Math.round(from[2] + (to[2] - from[2]) * ratio);
        doc.setFillColor(r, g, b);
        doc.rect((i * pageWidth) / steps, y, pageWidth / steps + 0.6, height, 'F');
      }
    };

    const loadCompanyLogoDataUrl = async () => {
      if (!companyProfile?.logo_url) return null;
      try {
        const path = extractStoragePath(companyProfile.logo_url);
        if (path) {
          const { data: fileBlob, error } = await supabase.storage.from('tourism-assets').download(path);
          if (!error && fileBlob) {
            return await dataUrlFromBlob(fileBlob);
          }
        }
        const srcUrl = companyProfile.logo_url.includes('?')
          ? companyProfile.logo_url
          : `${companyProfile.logo_url}?t=${Date.now()}`;
        const response = await fetch(srcUrl, { cache: 'no-cache', headers: { Accept: 'image/*' } });
        if (!response.ok) return null;
        return await dataUrlFromBlob(await response.blob());
      } catch {
        return null;
      }
    };

    const logoDataUrl = await loadCompanyLogoDataUrl();

    drawGradientHeader();
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(14, 7, 24, 22, 2, 2, 'F');
    if (logoDataUrl) {
      const formatMatch = logoDataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,/);
      const rawFormat = formatMatch ? formatMatch[1].toUpperCase() : 'PNG';
      const format = rawFormat === 'JPG' ? 'JPEG' : rawFormat;
      doc.addImage(logoDataUrl, format as any, 15, 8, 22, 20, undefined, 'FAST');
    } else {
      const initials = companyName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('');
      doc.setTextColor(6, 18, 40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(initials || 'PG', 26, 20, { align: 'center' });
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Historique Chauffeur', 44, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(sanitizePdfText(companyName), 44, 23);
    doc.setFontSize(10);
    doc.text(`DRV ${sanitizePdfText(historyDialogDriver.name)}`, 44, 30);
    doc.setFontSize(9.5);
    doc.text(`Fenêtre: ${historyWindowDays} jours`, pageWidth - 14, 16, { align: 'right' });
    doc.text(`Généré: ${generatedAt}`, pageWidth - 14, 23, { align: 'right' });
    doc.text(`Véhicule: ${sanitizePdfText(historyDialogDriver.vehiclePlate || 'N/A')}`, pageWidth - 14, 30, { align: 'right' });

    const cardWidth = (pageWidth - 28 - 8) / 3;
    const cardHeight = 16;
    const cards = [
      { title: 'Repos', value: `${historyStats.reposDays} j`, subtitle: 'Jours', color: [124, 58, 237] as [number, number, number] },
      { title: 'Disponible', value: `${historyStats.disponibleDays} j`, subtitle: 'Jours', color: [5, 150, 105] as [number, number, number] },
      { title: 'Activité', value: `${historyStats.missionDays} j`, subtitle: 'Jours', color: [3, 105, 161] as [number, number, number] },
      { title: 'Infractions', value: `${infractionStats.totalInRange}`, subtitle: `${infractionStats.unpaidInRange} non payées`, color: [180, 83, 9] as [number, number, number] },
      { title: 'Montant', value: formatMoney(infractionStats.amountInRange), subtitle: currencyCode, color: [30, 64, 175] as [number, number, number] },
      { title: 'Points', value: `${infractionStats.pointsInRange}`, subtitle: 'Déduits', color: [153, 27, 27] as [number, number, number] },
    ];

    cards.forEach((card, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = 14 + col * (cardWidth + 4);
      const y = 42 + row * (cardHeight + 4);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'FD');
      doc.setFillColor(card.color[0], card.color[1], card.color[2]);
      doc.roundedRect(x, y, 2.8, cardHeight, 1, 1, 'F');
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(card.title, x + 6, y + 5);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(card.value, x + 6, y + 10.5);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(card.subtitle, x + 6, y + 14);
    });

    let cursorY = 42 + 2 * (cardHeight + 4) + 5;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Chronologie activité', 14, cursorY);

    autoTable(doc, {
      startY: cursorY + 2,
      head: [['Date & heure', 'Événement', 'Véhicule', 'Source']],
      body: historyTimeline.slice(0, 200).map((row) => [
        formatDateTime(row.at),
        sanitizePdfText(addMovementTag(row.label, row.type)),
        sanitizePdfText(row.vehicle || 'N/A'),
        sanitizePdfText(row.source),
      ]),
      theme: 'grid',
      margin: { left: 14, right: 14, bottom: 22 },
      headStyles: { fillColor: [6, 18, 40], textColor: 255, fontStyle: 'bold' },
      styles: { font: 'helvetica', fontSize: 8.7, cellPadding: 2.4, textColor: [15, 23, 42], overflow: 'linebreak' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 31 },
        1: { cellWidth: 93 },
        2: { cellWidth: 32 },
        3: { cellWidth: 26 },
      },
    });

    const timelineFinalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || cursorY + 2;
    const infractionTableStartY = timelineFinalY + 10;
    if (infractionTableStartY > pageHeight - 70) {
      doc.addPage();
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Historique des infractions', 14, 20);
    } else {
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Historique des infractions', 14, infractionTableStartY - 2);
    }

    autoTable(doc, {
      startY: infractionTableStartY > pageHeight - 70 ? 22 : infractionTableStartY,
      head: [['Date', 'Type', 'Lieu', 'Montant', 'Points', 'Statut']],
      body:
        driverInfractions.length > 0
          ? driverInfractions.slice(0, 200).map((infraction) => [
              formatDateOnly(infraction.infractionDate),
              sanitizePdfText(infraction.infractionType),
              sanitizePdfText(infraction.location || '-'),
              formatMoney(infraction.amount),
              infraction.pointsDeducted ?? '-',
              sanitizePdfText(statusLabelByKey[infraction.status || 'unpaid'] || infraction.status || 'Non payé'),
            ])
          : [['-', 'Aucune infraction sur la période', '-', '-', '-', '-']],
      theme: 'grid',
      margin: { left: 14, right: 14, bottom: 22 },
      headStyles: { fillColor: [120, 53, 15], textColor: 255, fontStyle: 'bold' },
      styles: { font: 'helvetica', fontSize: 8.6, cellPadding: 2.3, textColor: [15, 23, 42], overflow: 'linebreak' },
      alternateRowStyles: { fillColor: [255, 247, 237] },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 50 },
        2: { cellWidth: 44 },
        3: { cellWidth: 22, halign: 'right' },
        4: { cellWidth: 16, halign: 'center' },
        5: { cellWidth: 28 },
      },
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i += 1) {
      doc.setPage(i);
      const currentHeight = doc.internal.pageSize.getHeight();
      doc.setTextColor(241, 245, 249);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(34);
      doc.text(sanitizePdfText(companyName).toUpperCase(), pageWidth / 2, currentHeight / 2, { align: 'center' });
      doc.setDrawColor(226, 232, 240);
      doc.line(14, currentHeight - 17, pageWidth - 14, currentHeight - 17);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.2);
      if (contactLine) doc.text(contactLine, 14, currentHeight - 11);
      if (footerLine) doc.text(footerLine, 14, currentHeight - 6);
      doc.text(`Page ${i}/${totalPages}`, pageWidth - 14, currentHeight - 6, { align: 'right' });
    }

    doc.save(`historique-chauffeur-${historyDialogDriver.name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
  };

  const handleOpenEditDriver = (driver: MappedDriver) => {
    if (driver.source !== 'local') return;
    const localDriver = localDriversById.get(driver.id);
    if (!localDriver) return;
    setEditingDriver(localDriver);
    setIsEditDialogOpen(true);
  };

  const handleOpenDeleteDriver = (driver: MappedDriver) => {
    if (driver.source !== 'local') return;
    const localDriver = localDriversById.get(driver.id);
    if (!localDriver) return;
    setDeletingDriver(localDriver);
  };

  const handleConfirmDeleteDriver = async () => {
    if (!deletingDriver) return;
    await deleteDriver.mutateAsync(deletingDriver.id);
    setDeletingDriver(null);
  };
  // Filter drivers
  const filteredDrivers = mappedDrivers.filter((driver) => {
    const matchesSearch = 
      driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.phone.includes(searchQuery) ||
      (driver.vehiclePlate?.toLowerCase().includes(searchQuery.toLowerCase()) || false);
    const matchesStatus = statusFilter === 'all' || driver.status === statusFilter;
    const matchesSource = !hideGPSwox || driver.source !== 'gpswox';
    return matchesSearch && matchesStatus && matchesSource;
  });

  // Status counts
  const statusCounts = {
    all: mappedDrivers.length,
    available: mappedDrivers.filter(d => d.status === 'available').length,
    on_mission: mappedDrivers.filter(d => d.status === 'on_mission').length,
    off_duty: mappedDrivers.filter(d => d.status === 'off_duty').length,
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
        {gpswoxError && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg flex items-center gap-2">
            <UserX className="w-5 h-5" />
            <p className="font-medium">
              Erreur GPSwox: {gpswoxError instanceof Error ? gpswoxError.message : 'Erreur inconnue'}
            </p>
          </div>
        )}

        {/* Debug Toggle */}
        <div className="flex justify-end">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowDebug(!showDebug)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <Bug className="w-3 h-3 mr-1" />
            {showDebug ? 'Masquer Debug' : 'Afficher Debug'}
          </Button>
        </div>

        {/* Debug Panel */}
        {showDebug && debug && (
          <Card className="dashboard-panel bg-slate-950 text-slate-50 border-slate-800">
            <CardContent className="p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-blue-400 mb-2">Logs Serveur GPSwox</h3>
                <div className="bg-slate-900 p-2 rounded text-xs font-mono max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {debug.logs ? debug.logs.join('\n') : 'Aucun log disponible'}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-green-400 mb-2">Source Données</h3>
                  <pre className="bg-slate-900 p-2 rounded text-xs font-mono overflow-x-auto">
                    {JSON.stringify({
                      source: debug.driversSource,
                      extracted: debug.extractedCount,
                      fetchError: debug.driverFetchError
                    }, null, 2)}
                  </pre>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-yellow-400 mb-2">Exemple Véhicule (Brut)</h3>
                  <pre className="bg-slate-900 p-2 rounded text-xs font-mono overflow-x-auto max-h-40">
                    {debug.firstVehicleSample ? JSON.stringify(debug.firstVehicleSample, null, 2) : 'Aucun véhicule trouvé'}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-7 h-7 text-primary" />
              {t('nav.drivers')}
            </h1>
            <p className="text-muted-foreground mt-1">
              Gestion des conducteurs avec statut en temps réel
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="flex items-center gap-2 px-3 py-1.5">
              <Car className="w-4 h-4" />
              {vehicles.length} véhicules • {mappedDrivers.length} conducteurs
            </Badge>
            {gpswoxDrivers.length > 0 && (
              <Badge variant="secondary" className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-800 border-blue-200">
                <Wifi className="w-3 h-3" />
                GPSwox: {gpswoxDrivers.length}
              </Badge>
            )}
            <Button 
              variant={hideGPSwox ? 'secondary' : 'outline'} 
              size="sm" 
              onClick={() => setHideGPSwox(!hideGPSwox)}
              className="px-3"
            >
              {hideGPSwox ? 'Afficher GPSwox' : 'Masquer GPSwox'}
            </Button>
            <Button className="flex items-center gap-2" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              Ajouter un conducteur
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => setStatusFilter('all')}
            className={cn(
              'dashboard-panel p-4 rounded-xl border transition-all text-left',
              statusFilter === 'all' 
                ? 'border-primary bg-primary/5' 
                : 'border-border bg-card hover:border-primary/30'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{statusCounts.all}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </button>
          
          <button
            onClick={() => setStatusFilter('available')}
            className={cn(
              'dashboard-panel p-4 rounded-xl border transition-all text-left',
              statusFilter === 'available' 
                ? 'border-success bg-success/5' 
                : 'border-border bg-card hover:border-success/30'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{statusCounts.available}</p>
                <p className="text-sm text-muted-foreground">Disponibles</p>
              </div>
            </div>
          </button>
          
          <button
            onClick={() => setStatusFilter('on_mission')}
            className={cn(
              'dashboard-panel p-4 rounded-xl border transition-all text-left',
              statusFilter === 'on_mission' 
                ? 'border-info bg-info/5' 
                : 'border-border bg-card hover:border-info/30'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{statusCounts.on_mission}</p>
                <p className="text-sm text-muted-foreground">En mission</p>
              </div>
            </div>
          </button>
          
          <button
            onClick={() => setStatusFilter('off_duty')}
            className={cn(
              'dashboard-panel p-4 rounded-xl border transition-all text-left',
              statusFilter === 'off_duty' 
                ? 'border-muted bg-muted/30' 
                : 'border-border bg-card hover:border-muted-foreground/30'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <UserX className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{statusCounts.off_duty}</p>
                <p className="text-sm text-muted-foreground">Repos</p>
              </div>
            </div>
          </button>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between dashboard-panel p-4 rounded-xl border border-border">
          <div className="flex flex-1 gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:max-w-xs">
              <Search className={cn('absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground', isRTL ? 'right-3' : 'left-3')} />
              <Input
                placeholder="Rechercher un chauffeur..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn('w-full', isRTL ? 'pr-10' : 'pl-10')}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="available">Disponible</SelectItem>
                <SelectItem value="on_mission">En mission</SelectItem>
                <SelectItem value="off_duty">Repos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-normal">
            {filteredDrivers.length} conducteur{filteredDrivers.length > 1 ? 's' : ''}
          </Badge>
          {statusFilter !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => setStatusFilter('all')} className="h-6 px-2 text-xs">
              Effacer le filtre
            </Button>
          )}
        </div>

        {/* Drivers Grid/List */}
        {filteredDrivers.length > 0 ? (
          <div className={cn(
            viewMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' 
              : 'space-y-3'
          )}>
            {filteredDrivers.map((driver) => (
              <DriverCardComponent
                key={driver.id}
                driver={driver}
                viewMode={viewMode}
                onOpenRepos={() => setRestDialogDriver(driver)}
                onOpenHistory={() => {
                  setHistoryDialogDriver(driver);
                  setHistoryWindowDays(30);
                }}
                onEdit={() => handleOpenEditDriver(driver)}
                onDelete={() => handleOpenDeleteDriver(driver)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 dashboard-panel rounded-xl border border-border">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-medium text-foreground mb-1">Aucun conducteur trouvé</h3>
            <p className="text-muted-foreground mb-4">
              {mappedDrivers.length === 0 
                ? "Ajoutez des conducteurs pour commencer"
                : "Essayez de modifier vos critères de recherche"
              }
            </p>
            {mappedDrivers.length === 0 && (
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un conducteur
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Add Driver Dialog */}
      <DriverForm 
        open={isAddDialogOpen} 
        onOpenChange={setIsAddDialogOpen}
      />
      <DriverForm
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setEditingDriver(null);
        }}
        editDriver={editingDriver}
      />
      <Dialog open={!!deletingDriver} onOpenChange={(open) => !open && setDeletingDriver(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Supprimer le chauffeur</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Voulez-vous vraiment supprimer{' '}
            <span className="font-semibold text-foreground">{deletingDriver?.name}</span> ?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingDriver(null)} disabled={deleteDriver.isPending}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeleteDriver} disabled={deleteDriver.isPending}>
              {deleteDriver.isPending ? 'Suppression...' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!restDialogDriver} onOpenChange={(v) => !v && setRestDialogDriver(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Mettre en repos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Date de début</span>
                <Input type="date" value={restStart} onChange={(e) => setRestStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Jours de repos</span>
                <Input type="number" min={1} value={restDays} onChange={(e) => setRestDays(Number(e.target.value))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestDialogDriver(null)}>Annuler</Button>
            <Button onClick={handleSaveRest}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!historyDialogDriver} onOpenChange={(open) => !open && setHistoryDialogDriver(null)}>
        <DialogContent className="sm:max-w-[980px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Historique • {historyDialogDriver?.name}
            </DialogTitle>
            <DialogDescription>
              Historique intelligent des repos, disponibilités et véhicules utilisés avec date et heure.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant={historyWindowDays === 7 ? 'default' : 'outline'} onClick={() => setHistoryWindowDays(7)}>
                7 jours
              </Button>
              <Button size="sm" variant={historyWindowDays === 30 ? 'default' : 'outline'} onClick={() => setHistoryWindowDays(30)}>
                30 jours
              </Button>
              <Button size="sm" variant={historyWindowDays === 90 ? 'default' : 'outline'} onClick={() => setHistoryWindowDays(90)}>
                90 jours
              </Button>
              <Button size="sm" className="ml-auto" onClick={handleDownloadHistoryPdf}>
                <FileDown className="w-3.5 h-3.5 mr-2" />
                Télécharger PDF
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Jours repos</p>
                  <p className="text-2xl font-semibold">{historyStats.reposDays}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Jours disponible</p>
                  <p className="text-2xl font-semibold">{historyStats.disponibleDays}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Jours activité</p>
                  <p className="text-2xl font-semibold">{historyStats.missionDays}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Véhicules utilisés</p>
                  <p className="text-2xl font-semibold">{historyStats.vehiclesUsed.length}</p>
                </CardContent>
              </Card>
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Infractions</p>
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-2xl font-semibold text-amber-300">{infractionStats.totalInRange}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {infractionStats.unpaidInRange} non payée{infractionStats.unpaidInRange > 1 ? 's' : ''}
                  </p>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="grid grid-cols-4 gap-2 px-4 py-2 border-b bg-muted/30 text-xs font-semibold text-muted-foreground">
                  <span>Date & heure</span>
                  <span>Événement</span>
                  <span>Véhicule</span>
                  <span>Source</span>
                </div>
                <div className="max-h-[360px] overflow-y-auto">
                  {historyTimeline.length > 0 ? (
                    historyTimeline.slice(0, 200).map((row, index) => (
                      <div key={`${row.at}-${index}`} className="grid grid-cols-4 gap-2 px-4 py-2 border-b text-sm">
                        <span className="text-muted-foreground">{formatDateTime(row.at)}</span>
                        <span>{row.label}</span>
                        <span>{row.vehicle}</span>
                        <span className="text-muted-foreground">{row.source}</span>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-sm text-muted-foreground text-center">
                      Aucun historique disponible pour cette période.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="border-amber-500/25">
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-amber-500/10">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <p className="text-sm font-semibold text-amber-200">Historique des infractions</p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Montant {infractionStats.amountInRange.toFixed(2)} • Points {infractionStats.pointsInRange}
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-2 px-4 py-2 border-b bg-muted/30 text-xs font-semibold text-muted-foreground">
                  <span>Date</span>
                  <span>Type</span>
                  <span>Lieu</span>
                  <span className="text-right">Montant</span>
                  <span className="text-center">Points</span>
                  <span>Statut</span>
                </div>
                <div className="max-h-[260px] overflow-y-auto">
                  {driverInfractions.length > 0 ? (
                    driverInfractions.slice(0, 120).map((infraction) => (
                      <div key={infraction.id} className="grid grid-cols-6 gap-2 px-4 py-2 border-b text-sm">
                        <span className="text-muted-foreground">{formatDateOnly(infraction.infractionDate)}</span>
                        <span className="truncate" title={infraction.infractionType}>{infraction.infractionType}</span>
                        <span className="truncate" title={infraction.location || '-'}>{infraction.location || '-'}</span>
                        <span className="text-right">{infraction.amount.toFixed(2)}</span>
                        <span className="text-center">{infraction.pointsDeducted ?? '-'}</span>
                        <span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs',
                              (infraction.status || 'unpaid') === 'paid'
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                                : (infraction.status || 'unpaid') === 'contested'
                                  ? 'border-violet-500/40 bg-violet-500/10 text-violet-300'
                                  : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                            )}
                          >
                            {(infraction.status || 'unpaid') === 'paid'
                              ? 'Payé'
                              : (infraction.status || 'unpaid') === 'contested'
                                ? 'Contesté'
                                : 'Non payé'}
                          </Badge>
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-sm text-muted-foreground text-center">
                      Aucune infraction liée à ce chauffeur.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// Driver Card Component
function DriverCardComponent({ driver, viewMode, onOpenRepos, onOpenHistory, onEdit, onDelete }: { driver: MappedDriver; viewMode: 'grid' | 'list'; onOpenRepos: () => void; onOpenHistory: () => void; onEdit: () => void; onDelete: () => void }) {
  const statusConfig = {
    available: { label: 'Disponible', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30', ring: 'ring-emerald-400/30', glow: 'from-emerald-500/10' },
    on_mission: { label: 'En mission', color: 'bg-sky-500/20 text-sky-300 border-sky-400/30', ring: 'ring-sky-400/30', glow: 'from-sky-500/10' },
    off_duty: { label: 'Repos', color: 'bg-violet-500/20 text-violet-300 border-violet-400/30', ring: 'ring-violet-400/30', glow: 'from-violet-500/10' },
  };

  const config = statusConfig[driver.status];
  const initials = driver.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const restKey = `driver_rest_${driver.id}`;
  const restRaw = typeof window !== 'undefined' ? localStorage.getItem(restKey) : null;
  const restData = restRaw ? JSON.parse(restRaw) : null;
  const daysLeft = restData ? Math.max(0, Math.ceil((new Date(restData.end).getTime() - Date.now()) / 86400000)) : null;
  const signalLabel = driver.isOnline ? 'En ligne' : 'Hors ligne';
  const signalClass = driver.isOnline ? 'text-emerald-300' : 'text-zinc-400';
  const baseActionClass = 'h-8 rounded-md border border-border/60 bg-background/70 hover:bg-background text-xs px-2';
  const shouldShowActions = driver.source === 'local';
  const statusDetail = daysLeft !== null ? `• reste ${daysLeft}j` : '';

  if (viewMode === 'list') {
    return (
      <Card className={cn('group overflow-hidden border-border/70 bg-gradient-to-br from-slate-900/95 to-slate-950/95 transition-all duration-300 hover:scale-[1.01] hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10')}>
        <CardContent className="relative p-4">
          <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-r to-transparent opacity-70', config.glow)} />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className={cn('relative rounded-xl p-[1px] ring-1', config.ring)}>
                <Avatar className="h-11 w-11 border border-white/10">
                  <AvatarFallback className="bg-slate-800 text-cyan-200 font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className={cn('absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-slate-800', driver.isOnline ? 'bg-emerald-500' : 'bg-zinc-500')}>
                  {driver.isOnline ? <Wifi className="h-2.5 w-2.5 text-slate-950" /> : <WifiOff className="h-2.5 w-2.5 text-slate-950" />}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-50">{driver.name}</h3>
                  <Badge className={cn('border', config.color)}>{config.label} {statusDetail}</Badge>
                  {driver.source === 'gpswox' && <Badge variant="outline" className="border-blue-400/30 bg-blue-500/10 text-blue-200">GPSwox</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className="border-slate-700 bg-slate-900/80 text-slate-300">
                    {driver.phone || 'Téléphone non défini'}
                  </Badge>
                  <Badge variant="outline" className="border-slate-700 bg-slate-900/80 text-slate-300">
                    Permis {driver.licenseType}
                  </Badge>
                  <Badge variant="outline" className="border-slate-700 bg-slate-900/80 text-slate-300">
                    {driver.vehiclePlate || 'Aucun véhicule'}
                  </Badge>
                  <span className={cn('text-xs font-medium', signalClass)}>{signalLabel}</span>
                </div>
              </div>
            </div>
            {shouldShowActions && (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" className={cn(baseActionClass, 'text-sky-300 border-sky-400/30 bg-sky-500/10 hover:bg-sky-500/20')} onClick={onOpenHistory}>
                  <History className="w-3.5 h-3.5 mr-1" />
                  Historique
                </Button>
                <Button size="sm" className={cn(baseActionClass, 'text-violet-300 border-violet-400/30 bg-violet-500/10 hover:bg-violet-500/20')} onClick={onOpenRepos}>
                  <Clock className="w-3.5 h-3.5 mr-1" />
                  Repos
                </Button>
                <Button size="sm" className={cn(baseActionClass, 'text-amber-200 border-amber-400/30 bg-amber-500/10 hover:bg-amber-500/20')} onClick={onEdit}>
                  <SquarePen className="w-3.5 h-3.5 mr-1" />
                  Modifier
                </Button>
                <Button size="sm" className={cn(baseActionClass, 'text-rose-300 border-rose-400/30 bg-rose-500/10 hover:bg-rose-500/20')} onClick={onDelete}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Supprimer
                </Button>
              </div>
            )}
            {!shouldShowActions && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Car className="h-3.5 w-3.5" />
                Vue synchronisée GPSwox
              </div>
            )}
          </div>
          {driver.vehiclePlate && (
            <div className="relative mt-3 rounded-lg border border-cyan-400/20 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-100">
              Véhicule actif: {driver.vehiclePlate}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('group relative overflow-hidden border-border/70 bg-gradient-to-br from-slate-900 to-slate-950 text-slate-100 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10')}>
      <CardContent className="p-0">
        <div className={cn('absolute inset-0 bg-gradient-to-br to-transparent opacity-80', config.glow)} />
        <div className="relative p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cn('relative rounded-xl p-[1px] ring-1', config.ring)}>
                <Avatar className="h-12 w-12 border border-white/10">
                  <AvatarFallback className="bg-slate-800 text-cyan-200 font-semibold text-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className={cn('absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-slate-900', driver.isOnline ? 'bg-emerald-500' : 'bg-zinc-500')}>
                  {driver.isOnline ? <Wifi className="h-3 w-3 text-slate-950" /> : <WifiOff className="h-3 w-3 text-slate-950" />}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold leading-tight text-slate-50">{driver.name}</h3>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className={cn('font-medium', signalClass)}>{signalLabel}</span>
                  {driver.source === 'gpswox' && <Badge variant="outline" className="h-5 border-blue-400/30 bg-blue-500/10 px-1.5 text-[10px] text-blue-200">GPSwox</Badge>}
                </div>
              </div>
            </div>
            <Badge className={cn('border px-2 py-1 text-[11px]', config.color)}>
              {config.label} {statusDetail}
            </Badge>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-2 text-xs">
            <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-slate-200">
              Téléphone: {driver.phone || 'Non renseigné'}
            </div>
            <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-slate-200">
              Permis: {driver.licenseType}
            </div>
            <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-slate-200">
              Véhicule: {driver.vehiclePlate || 'Aucun véhicule assigné'}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {shouldShowActions ? (
              <>
                <Button size="sm" className={cn(baseActionClass, 'text-sky-300 border-sky-400/30 bg-sky-500/10 hover:bg-sky-500/20')} onClick={onOpenHistory}>
                  <History className="w-3.5 h-3.5 mr-1" />
                  Historique
                </Button>
                <Button size="sm" className={cn(baseActionClass, 'text-violet-300 border-violet-400/30 bg-violet-500/10 hover:bg-violet-500/20')} onClick={onOpenRepos}>
                  <Clock className="w-3.5 h-3.5 mr-1" />
                  Repos
                </Button>
                <Button size="sm" className={cn(baseActionClass, 'text-amber-200 border-amber-400/30 bg-amber-500/10 hover:bg-amber-500/20')} onClick={onEdit}>
                  <SquarePen className="w-3.5 h-3.5 mr-1" />
                  Modifier
                </Button>
                <Button size="sm" className={cn(baseActionClass, 'text-rose-300 border-rose-400/30 bg-rose-500/10 hover:bg-rose-500/20')} onClick={onDelete}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Supprimer
                </Button>
              </>
            ) : (
              <Badge variant="outline" className="border-slate-700 bg-slate-900/80 text-slate-300">
                Carte synchronisée en lecture
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
