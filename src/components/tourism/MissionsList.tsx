import { useState } from 'react';
import { useTourismMissions, useDeleteTourismMission, useUpdateTourismMission, TourismMission } from '@/hooks/useTourism';
import { useTourismCompanyProfile, TourismCompanyProfile, TOURISM_COMPANY_ID } from '@/hooks/useTourismCompany';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  Trash2,
  User,
  Truck,
  Plane,
  Mountain,
  Route,
  Car,
  AlertCircle,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

export function MissionsList() {
  const { data: missions, isLoading } = useTourismMissions();
  const { data: company } = useTourismCompanyProfile();
  const deleteMission = useDeleteTourismMission();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (!missions?.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Aucune mission planifiée</p>
        <p className="text-sm">Créez votre première mission touristique</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {missions.map((mission) => (
        <MissionCard 
          key={mission.id} 
          mission={mission} 
          company={company}
          onDelete={() => deleteMission.mutate(mission.id)} 
        />
      ))}
    </div>
  );
}

interface MissionCardProps {
  mission: TourismMission;
  company?: TourismCompanyProfile | null;
  onDelete: () => void;
}

function MissionCard({ mission, company, onDelete }: MissionCardProps) {
  const updateMission = useUpdateTourismMission();
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [endTime, setEndTime] = useState(mission.end_time || '');
  const [endKm, setEndKm] = useState(
    typeof mission.end_km === 'number' ? String(mission.end_km) : '',
  );
  const [mealAmount, setMealAmount] = useState(
    typeof mission.meal_amount === 'number' ? String(mission.meal_amount) : '',
  );
  const [driverParking, setDriverParking] = useState(
    typeof mission.driver_parking === 'number' ? String(mission.driver_parking) : '',
  );
  const [driverToll, setDriverToll] = useState(
    typeof mission.driver_toll === 'number' ? String(mission.driver_toll) : '',
  );
  const [driverMisc, setDriverMisc] = useState(
    typeof mission.driver_misc === 'number' ? String(mission.driver_misc) : '',
  );
  const [observationsEndMission, setObservationsEndMission] = useState(
    mission.observations_end_mission || '',
  );

  const statusConfig: Record<string, { label: string; className: string }> = {
    planned: { label: 'Planifiée', className: 'bg-blue-100 text-blue-800' },
    dispatched: { label: 'Dispatchée', className: 'bg-purple-100 text-purple-800' },
    in_progress: { label: 'En cours', className: 'bg-yellow-100 text-yellow-800' },
    completed: { label: 'Terminée', className: 'bg-green-100 text-green-800' },
    cancelled: { label: 'Annulée', className: 'bg-red-100 text-red-800' },
  };

  const typeConfig: Record<string, { label: string; icon: React.ReactNode }> = {
    transfer: { label: 'Transfert', icon: <Plane className="w-4 h-4" /> },
    excursion: { label: 'Excursion', icon: <Mountain className="w-4 h-4" /> },
    circuit: { label: 'Circuit', icon: <Route className="w-4 h-4" /> },
    rental: { label: 'Location', icon: <Car className="w-4 h-4" /> },
  };

  const priorityConfig: Record<string, { label: string; className: string }> = {
    low: { label: 'Basse', className: 'text-gray-500' },
    normal: { label: 'Normale', className: 'text-blue-500' },
    high: { label: 'Haute', className: 'text-orange-500' },
    urgent: { label: 'Urgente', className: 'text-red-500' },
  };

  const status = statusConfig[mission.status] || statusConfig.planned;
  const type = typeConfig[mission.mission_type] || typeConfig.transfer;
  const priority = priorityConfig[mission.priority] || priorityConfig.normal;

  const handleStatusChange = (newStatus: TourismMission['status']) => {
    updateMission.mutate({ id: mission.id, status: newStatus });
  };

  const today = new Date();
  const missionEndDate = new Date(mission.end_date);
  const canFinalize =
    mission.status !== 'cancelled' &&
    mission.status !== 'completed' &&
    missionEndDate <= today;

  const driverParkingNumber =
    driverParking === '' ? 0 : Number(driverParking);
  const driverTollNumber = driverToll === '' ? 0 : Number(driverToll);
  const driverMiscNumber = driverMisc === '' ? 0 : Number(driverMisc);
  const mealAmountNumber = mealAmount === '' ? 0 : Number(mealAmount);
  
  const computedDriverExpensesTotal =
    (driverParkingNumber + driverTollNumber + driverMiscNumber + mealAmountNumber) || 0;

  const handleFinalize = () => {
    const endKmNumber = endKm === '' ? null : Number(endKm);
    const startKmNumber =
      typeof mission.start_km === 'number' ? mission.start_km : null;
    const totalKm =
      startKmNumber !== null && endKmNumber !== null
        ? Math.max(endKmNumber - startKmNumber, 0)
        : null;

    const parkingNumber =
      driverParking === '' ? null : Number(driverParking);
    const tollNumber = driverToll === '' ? null : Number(driverToll);
    const miscNumber = driverMisc === '' ? null : Number(driverMisc);
    const mealNumber = mealAmount === '' ? null : Number(mealAmount);

    updateMission.mutate(
      {
        id: mission.id,
        status: 'completed',
        end_time: endTime || null,
        end_km: endKmNumber,
        total_km: totalKm,
        meal_amount: mealNumber,
        driver_parking: parkingNumber,
        driver_toll: tollNumber,
        driver_misc: miscNumber,
        driver_expenses_total: computedDriverExpensesTotal || null,
        observations_end_mission: observationsEndMission || null,
      },
      {
        onSuccess: async (updated) => {
          await exportTourismMissionPdf(updated as TourismMission, company);
          setFinalizeOpen(false);
        },
      },
    );
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {mission.reference}
              </Badge>
              <Badge className={cn('text-xs', status.className)}>
                {status.label}
              </Badge>
              {mission.priority !== 'normal' && (
                <Badge variant="outline" className={cn('text-xs', priority.className)}>
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {priority.label}
                </Badge>
              )}
            </div>
            <CardTitle className="text-base flex items-center gap-2">
              {type.icon}
              {mission.title}
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>
              {format(new Date(mission.start_date), 'dd MMM', { locale: fr })}
              {mission.start_date !== mission.end_date && (
                <> - {format(new Date(mission.end_date), 'dd MMM', { locale: fr })}</>
              )}
            </span>
          </div>
          {mission.start_time && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{mission.start_time.substring(0, 5)}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{mission.passengers_count} passager(s)</span>
          </div>
          {mission.client && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="w-4 h-4" />
              <span className="truncate">{mission.client.name}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-green-500" />
          <span className="text-muted-foreground">{mission.pickup_location || 'Non défini'}</span>
          <span className="text-muted-foreground">→</span>
          <MapPin className="w-4 h-4 text-red-500" />
          <span className="text-muted-foreground">{mission.dropoff_location || 'Non défini'}</span>
        </div>

        {(mission.vehicle_id || mission.driver) && (
          <div className="flex items-center gap-4 text-sm">
            {mission.vehicle_id && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Truck className="w-4 h-4" />
                <span>{mission.vehicle_id}</span>
              </div>
            )}
            {mission.driver && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="w-4 h-4" />
                <span>{mission.driver.name}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          {mission.status === 'planned' && (
            <Button size="sm" variant="outline" onClick={() => handleStatusChange('dispatched')}>
              Dispatcher
            </Button>
          )}
          {mission.status === 'dispatched' && (
            <Button size="sm" variant="outline" onClick={() => handleStatusChange('in_progress')}>
              Démarrer
            </Button>
          )}
          {mission.status === 'in_progress' && (
            <Button size="sm" variant="outline" onClick={() => handleStatusChange('completed')}>
              Terminer
            </Button>
          )}
          {mission.status !== 'cancelled' && mission.status !== 'completed' && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleStatusChange('cancelled')}>
              Annuler
            </Button>
          )}
          {mission.status === 'completed' && (
            <Button size="sm" variant="outline" onClick={() => exportTourismMissionPdf(mission, company)}>
              <FileText className="w-4 h-4 mr-1" />
              PDF
            </Button>
          )}
          {canFinalize && (
            <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="default" className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Finaliser
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Finaliser la mission {mission.reference}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">heure retour garage</label>
                      <Input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">km arrivée</label>
                      <Input
                        type="number"
                        min={0}
                        value={endKm}
                        onChange={(e) => setEndKm(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">repas</label>
                    <Input
                      type="number"
                      min={0}
                      value={mealAmount}
                      onChange={(e) => setMealAmount(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Observations de fin de mission</label>
                    <Input
                      value={observationsEndMission}
                      onChange={(e) => setObservationsEndMission(e.target.value)}
                      placeholder="Observations..."
                    />
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Débours Chauffeur sur justificatifs</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">Parking</label>
                        <Input
                          type="number"
                          min={0}
                          value={driverParking}
                          onChange={(e) => setDriverParking(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Péage</label>
                        <Input
                          type="number"
                          min={0}
                          value={driverToll}
                          onChange={(e) => setDriverToll(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Divers</label>
                        <Input
                          type="number"
                          min={0}
                          value={driverMisc}
                          onChange={(e) => setDriverMisc(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Total</label>
                        <Input type="number" readOnly value={computedDriverExpensesTotal} />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFinalizeOpen(false)}
                    >
                      Annuler
                    </Button>
                    <Button type="button" onClick={handleFinalize}>
                      Enregistrer & PDF
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

async function exportTourismMissionPdf(mission: TourismMission, company?: TourismCompanyProfile | null) {
  const { default: jsPDF } = await import('jspdf');

  const doc = new jsPDF();

  const startDate = mission.start_date ? new Date(mission.start_date) : null;
  const formatDate = (d: Date | null) =>
    d ? d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : '-';

  const formatTime = (t?: string | null) => (t ? t.substring(0, 5) : '--:--');

  const startKm = mission.start_km ?? 0;
  const endKm = mission.end_km ?? 0;
  const totalKm = mission.total_km ?? (endKm && startKm ? Math.max(endKm - startKm, 0) : 0);

  const parking = mission.driver_parking ?? 0;
  const toll = mission.driver_toll ?? 0;
  const misc = mission.driver_misc ?? 0;
  const meal = mission.meal_amount ?? 0;
  const driverTotal = mission.driver_expenses_total ?? (parking + toll + misc + meal);

  const dossierNumber = mission.dossier_number || '';
  const missionNumber = mission.mission_number || '';
  const versionNumber = mission.version_number || '';

  const headerFill = { r: 15, g: 23, b: 42 };
  const subHeaderFill = { r: 30, g: 41, b: 59 };
  const tableBorder = 0.1;

  doc.setLineWidth(tableBorder);
  doc.setDrawColor(0, 0, 0);

  const ensureCompany = async () => {
    if (company) return company;
    const { data: singleton } = await supabase
      .from('tourism_company_profile')
      .select('*')
      .eq('id', TOURISM_COMPANY_ID)
      .maybeSingle();

    if (singleton) return singleton as TourismCompanyProfile;

    const { data } = await supabase.from('tourism_company_profile').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
    return data as TourismCompanyProfile | null;
  };

  const companyData = await ensureCompany();

  if (companyData?.logo_url) {
    try {
      const extractStoragePath = (logo: string) => {
        if (!logo) return null;
        if (!logo.startsWith('http')) return logo.split('?')[0];

        const publicMarker = '/storage/v1/object/public/tourism-assets/';
        const signedMarker = '/storage/v1/object/sign/tourism-assets/';

        const publicIdx = logo.indexOf(publicMarker);
        if (publicIdx >= 0) return logo.slice(publicIdx + publicMarker.length).split('?')[0];

        const signedIdx = logo.indexOf(signedMarker);
        if (signedIdx >= 0) return logo.slice(signedIdx + signedMarker.length).split('?')[0];

        return null;
      };

      const blobFromStorage = async () => {
        const path = extractStoragePath(companyData.logo_url || '');
        if (!path) return null;
        const { data: fileBlob, error } = await supabase.storage.from('tourism-assets').download(path);
        if (error || !fileBlob) return null;
        return fileBlob;
      };

      const blob = (await blobFromStorage()) ?? (await (async () => {
        const srcUrl = companyData.logo_url.includes('?') ? companyData.logo_url : `${companyData.logo_url}?t=${Date.now()}`;
        const response = await fetch(srcUrl, { cache: 'no-cache', headers: { Accept: 'image/*' } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.blob();
      })());

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const formatMatch = dataUrl.match(/^data:image\/([a-z]+);base64,/);
      const format = formatMatch ? formatMatch[1].toUpperCase() : 'PNG';
      doc.addImage(dataUrl, format, 14, 8, 35, 25, undefined, 'FAST');
    } catch (error) {
      console.error('Logo loading failed:', error);
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = companyData.logo_url.includes('?') ? companyData.logo_url : `${companyData.logo_url}?t=${Date.now()}`;
          
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = (e) => {
            console.error('Image tag load error:', e);
            reject(new Error('Image load failed'));
          };
          setTimeout(() => reject(new Error('Timeout')), 5000);
        });
        doc.addImage(img, 'PNG', 14, 8, 35, 25);
      } catch (err2) {
        console.error('Final fallback failed:', err2);
        doc.rect(14, 8, 35, 25);
        doc.setFontSize(8);
        doc.text('LOGO', 31.5, 20.5, { align: 'center' });
      }
    }
  } else {
    doc.rect(14, 8, 35, 25);
    doc.setFontSize(8);
    doc.text('LOGO', 31.5, 20.5, { align: 'center' });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const dispatchText = `Dispatch : ${companyData?.contact_email || 'contact@fanluxury.com'}`;
  const dossierText = `Dossier : ${dossierNumber || 'Non défini'}`;
  doc.text(dispatchText, 14, 38);
  doc.text(dossierText, 14, 43);

  const omX = 110;
  const omY = 10;
  const omWidth = 86;
  const omColWidth = omWidth / 3;

  const omHeaderFill = { r: 59, g: 130, b: 246 };
  const omSubHeaderFill = { r: 219, g: 234, b: 254 };

  doc.setFillColor(omSubHeaderFill.r, omSubHeaderFill.g, omSubHeaderFill.b);
  doc.rect(omX, omY + 8, omWidth, 10, 'FD');
  doc.setFillColor(omHeaderFill.r, omHeaderFill.g, omHeaderFill.b);
  doc.rect(omX, omY, omWidth, 8, 'FD');
  doc.line(omX, omY + 8, omX + omWidth, omY + 8);
  doc.line(omX + omColWidth, omY + 8, omX + omColWidth, omY + 18);
  doc.line(omX + 2 * omColWidth, omY + 8, omX + 2 * omColWidth, omY + 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('ORDRE MISSION', omX + omWidth / 2, omY + 5.5, { align: 'center' });
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('N° de dossier', omX + omColWidth / 2, omY + 11.5, { align: 'center' });
  doc.text('N° de mission', omX + 1.5 * omColWidth, omY + 11.5, { align: 'center' });
  doc.text('N° de version', omX + 2.5 * omColWidth, omY + 11.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.text(dossierNumber || '-', omX + omColWidth / 2, omY + 16, { align: 'center' });
  doc.text(missionNumber || '-', omX + 1.5 * omColWidth, omY + 16, { align: 'center' });
  doc.text(versionNumber || '-', omX + 2.5 * omColWidth, omY + 16, { align: 'center' });

  doc.setLineWidth(0.5);
  doc.line(14, 48, 196, 48);
  doc.setLineWidth(tableBorder);

  const t1Y = 52;
  const t1Width = 182;
  const t1Col1 = 45;
  const t1Col2 = 60;
  const t1Col3 = 77;

  doc.setFillColor(headerFill.r, headerFill.g, headerFill.b);
  doc.rect(14, t1Y, t1Width, 7, 'FD');
  doc.line(14 + t1Col1, t1Y, 14 + t1Col1, t1Y + 7);
  doc.line(14 + t1Col1 + t1Col2, t1Y, 14 + t1Col1 + t1Col2, t1Y + 7);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('Date', 14 + t1Col1 / 2, t1Y + 4.5, { align: 'center' });
  doc.text('Client', 14 + t1Col1 + t1Col2 / 2, t1Y + 4.5, { align: 'center' });
  doc.text('Chauffeur', 14 + t1Col1 + t1Col2 + t1Col3 / 2, t1Y + 4.5, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // Data Row 1
  doc.setFont('helvetica', 'normal');
  doc.rect(14, t1Y + 7, t1Width, 12);
  doc.line(14 + t1Col1, t1Y + 7, 14 + t1Col1, t1Y + 19);
  doc.line(14 + t1Col1 + t1Col2, t1Y + 7, 14 + t1Col1 + t1Col2, t1Y + 19);
  
  doc.setFontSize(9);
  doc.text(formatDate(startDate), 14 + 2, t1Y + 14);
  
  // Client cell
  if (mission.client?.name) {
    doc.setFont('helvetica', 'bold');
    doc.text(mission.client.name, 14 + t1Col1 + t1Col2 / 2, t1Y + 14, { align: 'center' });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.text('Non défini', 14 + t1Col1 + t1Col2 / 2, t1Y + 14, { align: 'center' });
  }

  // Chauffeur cell
  doc.setFont('helvetica', 'bold');
  const driverName = mission.driver?.name || 'Non défini';
  doc.text(driverName, 14 + t1Col1 + t1Col2 + t1Col3 / 2, t1Y + 14, { align: 'center' });

  // Vehicle sub-table under Chauffeur
  const vY = t1Y + 19;
  doc.setFillColor(headerFill.r, headerFill.g, headerFill.b);
  doc.rect(14 + t1Col1 + t1Col2, vY, t1Col3, 6, 'FD');
  doc.line(14 + t1Col1 + t1Col2 + t1Col3 / 2, vY, 14 + t1Col1 + t1Col2 + t1Col3 / 2, vY + 6);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('Marque / Modèle', 14 + t1Col1 + t1Col2 + t1Col3 / 4, vY + 4, { align: 'center' });
  doc.text('Matricule', 14 + t1Col1 + t1Col2 + 3 * t1Col3 / 4, vY + 4, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  doc.rect(14 + t1Col1 + t1Col2, vY + 6, t1Col3, 7);
  doc.line(14 + t1Col1 + t1Col2 + t1Col3 / 2, vY + 6, 14 + t1Col1 + t1Col2 + t1Col3 / 2, vY + 13);
  doc.setFont('helvetica', 'normal');
  
  const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

  const parseVehicle = (raw: string | null | undefined) => {
    if (!raw) return { model: '-', plate: '-' };
    const mainPart = raw.includes(' - ') ? raw.split(' - ')[0] : raw;
    const cleaned = normalizeWhitespace(mainPart);

    const plateMatch = cleaned.match(/(\d{1,6})\s*(?:-|–|\s)\s*([A-Za-z])\s*(?:-|–|\s)\s*(\d{1,3})/);
    if (plateMatch) {
      const plate = `${plateMatch[1]}-${plateMatch[2].toUpperCase()}-${plateMatch[3]}`;
      const model = normalizeWhitespace(cleaned.replace(plateMatch[0], '').replace(/[-–]+/g, ' '));
      return { model: model || '-', plate };
    }

    const parts = cleaned.split(' ');
    if (parts.length >= 2) {
      return { model: parts.slice(0, -1).join(' '), plate: parts[parts.length - 1] };
    }

    return { model: cleaned, plate: '-' };
  };

  const { model: vehicleType, plate: vehiclePlate } = parseVehicle(mission.vehicle_id);

  doc.setFontSize(7.5);
  doc.text(vehicleType, 14 + t1Col1 + t1Col2 + t1Col3 / 4, vY + 10.5, { align: 'center' });
  doc.text(vehiclePlate, 14 + t1Col1 + t1Col2 + 3 * t1Col3 / 4, vY + 10.5, { align: 'center' });
  doc.setFontSize(8);

  // --- MAIN TABLE 2 (Service, Passengers, Note) ---
  const t2Y = vY + 13;
  doc.setFillColor(headerFill.r, headerFill.g, headerFill.b);
  doc.rect(14, t2Y, t1Width, 7, 'FD');
  doc.line(14 + t1Col1, t2Y, 14 + t1Col1, t2Y + 7);
  doc.line(14 + t1Col1 + t1Col2, t2Y, 14 + t1Col1 + t1Col2, t2Y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('Service', 14 + t1Col1 / 2, t2Y + 4.5, { align: 'center' });
  doc.text(`Passager(s) : ${mission.passengers_count || 1}`, 14 + t1Col1 + t1Col2 / 2, t2Y + 4.5, { align: 'center' });
  doc.text('Note au chauffeur', 14 + t1Col1 + t1Col2 + t1Col3 / 2, t2Y + 4.5, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // Data Row 2
  doc.rect(14, t2Y + 7, t1Width, 25);
  doc.line(14 + t1Col1, t2Y + 7, 14 + t1Col1, t2Y + 32);
  doc.line(14 + t1Col1 + t1Col2, t2Y + 7, 14 + t1Col1 + t1Col2, t2Y + 32);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(mission.mission_type || 'Transfert', 14 + t1Col1 / 2, t2Y + 15, { align: 'center' });
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Nombre d'adulte(s) : ${mission.passengers_count || 1}`, 14 + t1Col1 + t1Col2 / 2, t2Y + 17.5, { align: 'center' });

  // Note
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const noteText = mission.notes || '';
  const splitNote = doc.splitTextToSize(noteText, t1Col3 - 4);
  doc.text(splitNote, 14 + t1Col1 + t1Col2 + 2, t2Y + 11);

  doc.setFillColor(headerFill.r, headerFill.g, headerFill.b);
  doc.rect(14, t2Y + 18, t1Col1, 6, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Référence mission', 14 + t1Col1 / 2, t2Y + 22, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  
  doc.rect(14, t2Y + 24, t1Col1, 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(mission.reference_mission || mission.reference || '-', 14 + t1Col1 / 2, t2Y + 29, { align: 'center' });

  // --- PRISE EN CHARGE ---
  const pecY = t2Y + 32;
  doc.setFillColor(headerFill.r, headerFill.g, headerFill.b);
  doc.rect(14, pecY, t1Width, 6, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Prise en charge', 14 + t1Width / 2, pecY + 4.5, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  doc.rect(14, pecY + 6, t1Width, 12);
  doc.line(14 + 40, pecY + 6, 14 + 40, pecY + 18);
  doc.setFontSize(22);
  doc.text(formatTime(mission.start_time), 14 + 20, pecY + 15, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(mission.pickup_location || 'Non défini', 14 + 42, pecY + 13.5);

  // --- DESTINATION ---
  const destY = pecY + 18;
  doc.setFillColor(headerFill.r, headerFill.g, headerFill.b);
  doc.rect(14, destY, t1Width, 6, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Destination', 14 + t1Width / 2, destY + 4.5, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  doc.rect(14, destY + 6, t1Width, 12);
  doc.line(14 + t1Width - 40, destY + 6, 14 + t1Width - 40, destY + 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(mission.dropoff_location || 'Non défini', 14 + 2, destY + 13.5);
  doc.setFontSize(22);
  doc.text(formatTime(mission.end_time), 14 + t1Width - 20, destY + 15, { align: 'center' });

  // --- INFORMATIONS OBLIGATOIRES ---
  const infoY = destY + 18;
  doc.setFillColor(headerFill.r, headerFill.g, headerFill.b);
  doc.rect(14, infoY, t1Width, 6, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('Informations obligatoires à compléter', 14 + t1Width / 2, infoY + 4.5, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  const infoColWidth = t1Width / 5;
  doc.setFillColor(subHeaderFill.r, subHeaderFill.g, subHeaderFill.b);
  doc.rect(14, infoY + 6, t1Width, 7, 'FD');
  for (let i = 1; i < 5; i++) {
    doc.line(14 + i * infoColWidth, infoY + 6, 14 + i * infoColWidth, infoY + 23);
  }
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Heure départ garage', 14 + infoColWidth / 2, infoY + 10.5, { align: 'center' });
  doc.text('Heure retour garage', 14 + 1.5 * infoColWidth, infoY + 10.5, { align: 'center' });
  doc.text('Km départ', 14 + 2.5 * infoColWidth, infoY + 10.5, { align: 'center' });
  doc.text('Km arrivée', 14 + 3.5 * infoColWidth, infoY + 10.5, { align: 'center' });
  doc.text('TOTAL km', 14 + 4.5 * infoColWidth, infoY + 10.5, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  doc.rect(14, infoY + 13, t1Width, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(formatTime(mission.start_time), 14 + infoColWidth / 2, infoY + 20, { align: 'center' });
  doc.text(formatTime(mission.end_time), 14 + 1.5 * infoColWidth, infoY + 20, { align: 'center' });
  doc.text(String(startKm), 14 + 2.5 * infoColWidth, infoY + 20, { align: 'center' });
  doc.text(String(endKm), 14 + 3.5 * infoColWidth, infoY + 20, { align: 'center' });
  doc.text(String(totalKm), 14 + 4.5 * infoColWidth, infoY + 20, { align: 'center' });

  // --- REPAS & OBSERVATIONS ---
  const bottomY = infoY + 23;
  const leftColWidth = 70;
  const rightColWidth = t1Width - leftColWidth;

  // Headers
  doc.setFillColor(headerFill.r, headerFill.g, headerFill.b);
  doc.rect(14, bottomY, leftColWidth, 6, 'FD');
  doc.rect(14 + leftColWidth, bottomY, rightColWidth, 6, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Repas', 14 + leftColWidth / 2, bottomY + 4.5, { align: 'center' });
  doc.text('Observations de fin de mission', 14 + leftColWidth + rightColWidth / 2, bottomY + 4.5, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // Content areas
  doc.rect(14, bottomY + 6, leftColWidth, 15);
  doc.rect(14 + leftColWidth, bottomY + 6, rightColWidth, 45);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (meal > 0) {
    doc.text(`${meal} MAD`, 14 + leftColWidth / 2, bottomY + 15, { align: 'center' });
  }
  
  const obsText = mission.observations_end_mission || '';
  const splitObs = doc.splitTextToSize(obsText, rightColWidth - 4);
  doc.text(splitObs, 14 + leftColWidth + 2, bottomY + 11);

  // Signature lines at the bottom of observations box
  const sigY = bottomY + 6 + 45 - 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Signature Chauffeur', 14 + leftColWidth + 10, sigY);
  doc.text('Signature Responsable', 14 + leftColWidth + rightColWidth - 10, sigY, { align: 'right' });
  doc.line(14 + leftColWidth + 5, sigY + 2, 14 + leftColWidth + 45, sigY + 2);
  doc.line(14 + leftColWidth + rightColWidth - 45, sigY + 2, 14 + leftColWidth + rightColWidth - 5, sigY + 2);

  const debY = bottomY + 21;
  doc.setFillColor(headerFill.r, headerFill.g, headerFill.b);
  doc.rect(14, debY, leftColWidth, 6, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Débours Chauffeur sur justificatifs', 14 + leftColWidth / 2, debY + 4.5, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  const debRows = ['Parking', 'Péage', 'Divers', 'Total'];
  const debValues = [parking, toll, misc, driverTotal];
  for (let i = 0; i < 4; i++) {
    const rowY = debY + 6 + i * 6;
    doc.setFillColor(subHeaderFill.r, subHeaderFill.g, subHeaderFill.b);
    doc.rect(14, rowY, leftColWidth * 0.6, 6, 'FD');
    doc.rect(14 + leftColWidth * 0.6, rowY, leftColWidth * 0.4, 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(debRows[i], 14 + 2, rowY + 4.5);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`${debValues[i]} MAD`, 14 + leftColWidth * 0.8, rowY + 4.5, { align: 'center' });
  }

  // --- FOOTER ---
  const footY = 280;
  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 0);
  doc.line(14, footY - 5, 196, footY - 5);
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  
  const foot1 = companyData?.company_name || 'Fan Luxury SARL';
  const foot2 = `${companyData?.address || 'Adresse non définie'} - Tél: ${companyData?.contact_phone || ''}`;
  const foot3 = companyData?.tax_info || 'Informations fiscales non définies';
  
  doc.text(foot1, 105, footY, { align: 'center' });
  doc.text(foot2, 105, footY + 4, { align: 'center' });
  doc.text(foot3, 105, footY + 8, { align: 'center' });

  doc.save(`ordre_mission_${mission.reference}.pdf`);
}
