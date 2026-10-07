import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateTourismMission, useTourismClients, generateMissionReference, useCreateTourismWaypoint } from '@/hooks/useTourism';
import { useCreateDriver, useDrivers } from '@/hooks/useDrivers';
import { useGPSwoxData } from '@/hooks/useGPSwoxVehicles';
import { useGPSwoxGeofences } from '@/hooks/useGPSwoxGeofences';
import { Calendar, MapPin, Users, Clock, FileText, PlusCircle, Trash2, Route } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';

const formSchema = z.object({
  title: z.string().min(2, 'Le titre est requis'),
  mission_type: z.enum(['transfer', 'excursion', 'circuit', 'rental']),
  client_id: z.string().optional(),
  vehicle_id: z.string().optional(),
  driver_id: z.string().optional(),
  passengers_count: z.number().min(1).default(1),
  start_date: z.string().min(1, 'Date de début requise'),
  end_date: z.string().min(1, 'Date de fin requise'),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  pickup_location: z.string().optional(),
  dropoff_location: z.string().optional(),
  start_km: z.number().optional(),
  end_km: z.number().optional(),
  total_km: z.number().optional(),
  meal_amount: z.number().optional(),
  driver_parking: z.number().optional(),
  driver_toll: z.number().optional(),
  driver_misc: z.number().optional(),
  driver_expenses_total: z.number().optional(),
  dossier_number: z.string().optional(),
  mission_number: z.string().optional(),
  version_number: z.string().optional(),
  reference_mission: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  notes: z.string().optional(),
  observations_end_mission: z.string().optional(),
});

interface MissionFormProps {
  onSuccess?: () => void;
}

interface CircuitSegment {
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_mode: 'select' | 'input';
  dropoff_mode: 'select' | 'input';
}

export function MissionForm({ onSuccess }: MissionFormProps) {
  const createMission = useCreateTourismMission();
  const createWaypoint = useCreateTourismWaypoint();
  const { data: clients } = useTourismClients();
  const { data: drivers } = useDrivers();
  const createDriver = useCreateDriver();
  const { data: gpswoxData } = useGPSwoxData();
  const vehicles = gpswoxData?.vehicles || [];
  const gpswoxDrivers = gpswoxData?.drivers || [];
  const { data: geofences } = useGPSwoxGeofences();
  const [pickupMode, setPickupMode] = useState<'select' | 'input'>('select');
  const [dropoffMode, setDropoffMode] = useState<'select' | 'input'>('select');
  const today = new Date().toISOString().split('T')[0];
  const [extraCircuits, setExtraCircuits] = useState<CircuitSegment[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      mission_type: 'transfer',
      passengers_count: 1,
      start_date: today,
      end_date: today,
      priority: 'normal',
      start_km: undefined,
      end_km: undefined,
      total_km: undefined,
      meal_amount: undefined,
      driver_parking: undefined,
      driver_toll: undefined,
      driver_misc: undefined,
      driver_expenses_total: undefined,
      dossier_number: '',
      mission_number: '',
      version_number: '',
      reference_mission: '',
    },
  });

  const missionType = form.watch('mission_type');
  const startKm = form.watch('start_km');
  const endKm = form.watch('end_km');
  const driverParking = form.watch('driver_parking');
  const driverToll = form.watch('driver_toll');
  const driverMisc = form.watch('driver_misc');
  const computedTotalKm =
    typeof startKm === 'number' && typeof endKm === 'number' ? Math.max(endKm - startKm, 0) : undefined;
  const computedDriverExpensesTotal =
    [driverParking, driverToll, driverMisc]
      .filter((v): v is number => typeof v === 'number')
      .reduce((sum, v) => sum + v, 0) || undefined;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const resolveDriverId = async () => {
      if (!values.driver_id || values.driver_id === 'none') return null;
      if (!values.driver_id.startsWith('gpswox:')) return values.driver_id;
      const gpswoxId = values.driver_id.replace('gpswox:', '');
      const gpswoxDriver = gpswoxDrivers.find((d) => String(d.id) === gpswoxId);
      if (!gpswoxDriver) return null;
      const created = await createDriver.mutateAsync({
        name: gpswoxDriver.name,
        phone: gpswoxDriver.phone || '',
        license_type: 'GPSwox',
        license_expiry: '2099-12-31',
        status: 'available',
        vehicle_id: gpswoxDriver.deviceId ? String(gpswoxDriver.deviceId) : null,
      });
      return created.id;
    };

    const driverId = await resolveDriverId();
    const startKmValue = typeof values.start_km === 'number' ? values.start_km : null;
    const endKmValue = typeof values.end_km === 'number' ? values.end_km : null;
    const totalKmValue =
      startKmValue !== null && endKmValue !== null ? Math.max(endKmValue - startKmValue, 0) : null;
    const driverExpensesTotalValue =
      typeof values.driver_expenses_total === 'number'
        ? values.driver_expenses_total
        : [values.driver_parking, values.driver_toll, values.driver_misc]
            .filter((v): v is number => typeof v === 'number')
            .reduce((sum, v) => sum + v, 0) || null;
    const circuitsInUse = values.mission_type === 'circuit' ? extraCircuits : [];

    const allPickupLocations = [
      values.pickup_location,
      ...circuitsInUse.map((circuit) => circuit.pickup_location),
    ]
      .filter((location) => location && location.trim().length > 0)
      .map((location) => location.trim())
      .join(' | ');

    const allDropoffLocations = [
      values.dropoff_location,
      ...circuitsInUse.map((circuit) => circuit.dropoff_location),
    ]
      .filter((location) => location && location.trim().length > 0)
      .map((location) => location.trim())
      .join(' | ');

    const circuitDetailsText =
      values.mission_type === 'circuit' && circuitsInUse.length > 0
        ? circuitsInUse
            .map(
              (circuit, index) =>
                `Circuit ${index + 2}: ${circuit.start_date || '-'} ${circuit.start_time || '--:--'} → ${circuit.end_date || '-'} ${circuit.end_time || '--:--'} | ${circuit.pickup_location || '-'} -> ${circuit.dropoff_location || '-'}`,
            )
            .join('\n')
        : '';

    const notesWithCircuits = [values.notes?.trim(), circuitDetailsText ? `Détails circuits:\n${circuitDetailsText}` : '']
      .filter((note) => note && note.length > 0)
      .join('\n\n');

    const createdMission = await createMission.mutateAsync({
      reference: generateMissionReference(),
      title: values.title,
      mission_type: values.mission_type,
      client_id: values.client_id || null,
      vehicle_id: values.vehicle_id || null,
      driver_id: driverId,
      passengers_count: values.passengers_count,
      start_date: values.start_date,
      end_date: values.end_date,
      start_time: values.start_time || null,
      end_time: values.end_time || null,
      pickup_location: allPickupLocations || null,
      dropoff_location: allDropoffLocations || null,
      start_km: startKmValue,
      end_km: endKmValue,
      total_km: totalKmValue,
      meal_amount: typeof values.meal_amount === 'number' ? values.meal_amount : null,
      driver_parking: typeof values.driver_parking === 'number' ? values.driver_parking : null,
      driver_toll: typeof values.driver_toll === 'number' ? values.driver_toll : null,
      driver_misc: typeof values.driver_misc === 'number' ? values.driver_misc : null,
      driver_expenses_total: driverExpensesTotalValue,
      dossier_number: values.dossier_number || null,
      mission_number: values.mission_number || null,
      version_number: values.version_number || null,
      reference_mission: values.reference_mission || null,
      priority: values.priority,
      status: 'planned',
      notes: notesWithCircuits || null,
      observations_end_mission: values.observations_end_mission || null,
    });
    if (values.mission_type === 'circuit' && createdMission && (createdMission as any).id) {
      const missionId = (createdMission as any).id as string;
      const waypointLocations: string[] = [];
      if (values.pickup_location && values.pickup_location.trim().length > 0) {
        waypointLocations.push(values.pickup_location.trim());
      }
      circuitsInUse.forEach((circuit) => {
        if (circuit.pickup_location && circuit.pickup_location.trim().length > 0) {
          waypointLocations.push(circuit.pickup_location.trim());
        }
        if (circuit.dropoff_location && circuit.dropoff_location.trim().length > 0) {
          waypointLocations.push(circuit.dropoff_location.trim());
        }
      });
      if (values.dropoff_location && values.dropoff_location.trim().length > 0) {
        waypointLocations.push(values.dropoff_location.trim());
      }
      if (waypointLocations.length > 0) {
        await Promise.all(
          waypointLocations.map((location, index) =>
            createWaypoint.mutateAsync({
              mission_id: missionId,
              sequence_order: index + 1,
              location_name: location,
              address: null,
              gps_lat: null,
              gps_lng: null,
              planned_arrival: null,
              planned_departure: null,
              actual_arrival: null,
              actual_departure: null,
              distance_from_previous_km: null,
              duration_from_previous_minutes: null,
              notes: null,
            }),
          ),
        );
      }
    }
    form.reset();
    setExtraCircuits([]);
    onSuccess?.();
  };

  const missionTypes = [
    { value: 'transfer', label: 'Transfert Aéroport/Hôtel' },
    { value: 'excursion', label: 'Excursion Journalière' },
    { value: 'circuit', label: 'Circuit Multi-jours' },
    { value: 'rental', label: 'Location avec Chauffeur' },
  ];

  const priorities = [
    { value: 'low', label: 'Basse' },
    { value: 'normal', label: 'Normale' },
    { value: 'high', label: 'Haute' },
    { value: 'urgent', label: 'Urgente' },
  ];

  const localDriverNames = new Set(drivers?.map((driver) => driver.name.toLowerCase()));
  const selectableDrivers = [
    ...(drivers || []).map((driver) => ({ id: driver.id, name: driver.name, source: 'local' as const })),
    ...gpswoxDrivers
      .filter((driver) => !localDriverNames.has(driver.name.toLowerCase()))
      .map((driver) => ({
        id: `gpswox:${driver.id}`,
        name: driver.name,
        source: 'gpswox' as const,
      })),
  ];

  const addCircuit = () => {
    setExtraCircuits((current) => [
      ...current,
      {
        start_date: form.getValues('start_date') || today,
        end_date: form.getValues('end_date') || today,
        start_time: form.getValues('start_time') || '',
        end_time: form.getValues('end_time') || '',
        pickup_location: '',
        dropoff_location: '',
        pickup_mode: 'select',
        dropoff_mode: 'select',
      },
    ]);
  };

  const updateCircuit = (index: number, updates: Partial<CircuitSegment>) => {
    setExtraCircuits((current) =>
      current.map((circuit, circuitIndex) =>
        circuitIndex === index ? { ...circuit, ...updates } : circuit,
      ),
    );
  };

  const removeCircuit = (index: number) => {
    setExtraCircuits((current) => current.filter((_, circuitIndex) => circuitIndex !== index));
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Titre de la mission *
                </FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Transfert Aéroport Mohammed V" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mission_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type de mission *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Type de mission" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {missionTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="client_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name} {client.company && `(${client.company})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="passengers_count"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Nombre de passagers
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Date de début *
                </FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="end_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Date de fin *
                </FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dossier_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Numéro de dossier touristique</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: 1415/TOUR/2017" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mission_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>N° de mission</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: 9" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="version_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>N° de version</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: 1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="start_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  heure départ garage
                </FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="end_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  heure retour garage
                </FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="pickup_location"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Lieu de prise en charge
                </FormLabel>
                <Tabs value={pickupMode} onValueChange={(v) => setPickupMode(v as 'select' | 'input')}>
                  <TabsList className="grid grid-cols-2 w-full mb-2">
                    <TabsTrigger value="select">Sélectionner un lieu</TabsTrigger>
                    <TabsTrigger value="input">Taper un lieu</TabsTrigger>
                  </TabsList>
                  <TabsContent value="select">
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un lieu" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {geofences?.map((geofence) => (
                          <SelectItem key={geofence.id} value={geofence.name}>
                            {geofence.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TabsContent>
                  <TabsContent value="input">
                    <FormControl>
                      <Input placeholder="Saisir un lieu..." value={field.value || ''} onChange={(e) => field.onChange(e.target.value)} />
                    </FormControl>
                  </TabsContent>
                </Tabs>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dropoff_location"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Lieu de destination
                </FormLabel>
                <Tabs value={dropoffMode} onValueChange={(v) => setDropoffMode(v as 'select' | 'input')}>
                  <TabsList className="grid grid-cols-2 w-full mb-2">
                    <TabsTrigger value="select">Sélectionner un lieu</TabsTrigger>
                    <TabsTrigger value="input">Taper un lieu</TabsTrigger>
                  </TabsList>
                  <TabsContent value="select">
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un lieu" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {geofences?.map((geofence) => (
                          <SelectItem key={geofence.id} value={geofence.name}>
                            {geofence.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TabsContent>
                  <TabsContent value="input">
                    <FormControl>
                      <Input placeholder="Saisir un lieu..." value={field.value || ''} onChange={(e) => field.onChange(e.target.value)} />
                    </FormControl>
                  </TabsContent>
                </Tabs>
                <FormMessage />
              </FormItem>
            )}
          />

          {missionType === 'circuit' && (
            <div className="md:col-span-2 space-y-3 rounded-lg border border-border/70 p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Route className="w-4 h-4" />
                  Circuits supplémentaires
                </h3>
                <Button type="button" variant="outline" size="sm" onClick={addCircuit}>
                  <PlusCircle className="w-3.5 h-3.5 mr-1" />
                  Ajouter un Circuit
                </Button>
              </div>
              {extraCircuits.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Ajoutez un circuit pour définir Date de début, Date de fin, heure de départ, heure retour, Lieu de prise en charge et Lieu de destination.
                </p>
              )}
              {extraCircuits.map((circuit, index) => (
                <div key={index} className="rounded-md border border-border/70 p-3 space-y-3 bg-background/50">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Circuit {index + 2}</p>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeCircuit(index)}>
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Supprimer
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Date de début *
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={circuit.start_date}
                          onChange={(e) => updateCircuit(index, { start_date: e.target.value })}
                        />
                      </FormControl>
                    </FormItem>
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Date de fin *
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={circuit.end_date}
                          onChange={(e) => updateCircuit(index, { end_date: e.target.value })}
                        />
                      </FormControl>
                    </FormItem>
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        heure de départ
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          value={circuit.start_time}
                          onChange={(e) => updateCircuit(index, { start_time: e.target.value })}
                        />
                      </FormControl>
                    </FormItem>
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        heure retour
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          value={circuit.end_time}
                          onChange={(e) => updateCircuit(index, { end_time: e.target.value })}
                        />
                      </FormControl>
                    </FormItem>
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Lieu de prise en charge
                      </FormLabel>
                      <Tabs
                        value={circuit.pickup_mode}
                        onValueChange={(value) => updateCircuit(index, { pickup_mode: value as 'select' | 'input' })}
                      >
                        <TabsList className="grid grid-cols-2 w-full mb-2">
                          <TabsTrigger value="select">Sélectionner un lieu</TabsTrigger>
                          <TabsTrigger value="input">Taper un lieu</TabsTrigger>
                        </TabsList>
                        <TabsContent value="select">
                          <Select
                            onValueChange={(value) => updateCircuit(index, { pickup_location: value })}
                            value={circuit.pickup_location || undefined}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner un lieu" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {geofences?.map((geofence) => (
                                <SelectItem key={`${geofence.id}-pickup-${index}`} value={geofence.name}>
                                  {geofence.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TabsContent>
                        <TabsContent value="input">
                          <Input
                            placeholder="Saisir un lieu..."
                            value={circuit.pickup_location}
                            onChange={(e) => updateCircuit(index, { pickup_location: e.target.value })}
                          />
                        </TabsContent>
                      </Tabs>
                    </FormItem>
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Lieu de destination
                      </FormLabel>
                      <Tabs
                        value={circuit.dropoff_mode}
                        onValueChange={(value) => updateCircuit(index, { dropoff_mode: value as 'select' | 'input' })}
                      >
                        <TabsList className="grid grid-cols-2 w-full mb-2">
                          <TabsTrigger value="select">Sélectionner un lieu</TabsTrigger>
                          <TabsTrigger value="input">Taper un lieu</TabsTrigger>
                        </TabsList>
                        <TabsContent value="select">
                          <Select
                            onValueChange={(value) => updateCircuit(index, { dropoff_location: value })}
                            value={circuit.dropoff_location || undefined}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner un lieu" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {geofences?.map((geofence) => (
                                <SelectItem key={`${geofence.id}-dropoff-${index}`} value={geofence.name}>
                                  {geofence.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TabsContent>
                        <TabsContent value="input">
                          <Input
                            placeholder="Saisir un lieu..."
                            value={circuit.dropoff_location}
                            onChange={(e) => updateCircuit(index, { dropoff_location: e.target.value })}
                          />
                        </TabsContent>
                      </Tabs>
                    </FormItem>
                  </div>
                </div>
              ))}
            </div>
          )}

          <FormField
            control={form.control}
            name="vehicle_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Véhicule</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un véhicule" />
                    </SelectTrigger>
                  </FormControl>
                <SelectContent>
                    {vehicles?.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.plate}>
                        {vehicle.plate} - {vehicle.brand} {vehicle.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="driver_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Chauffeur</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un chauffeur" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {selectableDrivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name}{driver.source === 'gpswox' ? ' (GPSwox)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="reference_mission"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Référence mission</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: REF-123" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priorité</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Priorité" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {priorities.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <FormField
            control={form.control}
            name="start_km"
            render={({ field }) => (
              <FormItem>
                <FormLabel>km départ</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    {...field}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === '' ? undefined : Number(e.target.value),
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="end_km"
            render={({ field }) => (
              <FormItem>
                <FormLabel>km arrivée</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    {...field}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === '' ? undefined : Number(e.target.value),
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="total_km"
            render={({ field }) => (
              <FormItem>
                <FormLabel>total km</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    readOnly
                    value={computedTotalKm ?? ''}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="mt-4">
          <FormField
            control={form.control}
            name="meal_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>repas</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    {...field}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === '' ? undefined : Number(e.target.value),
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium">Débours Chauffeur sur justificatifs</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <FormField
              control={form.control}
              name="driver_parking"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parking</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === '' ? undefined : Number(e.target.value),
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="driver_toll"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Péage</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === '' ? undefined : Number(e.target.value),
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="driver_misc"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Divers</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === '' ? undefined : Number(e.target.value),
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="driver_expenses_total"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      readOnly
                      value={computedDriverExpensesTotal ?? ''}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note au chauffeur</FormLabel>
              <FormControl>
                <Textarea placeholder="Note au chauffeur..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="observations_end_mission"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observations de fin de mission</FormLabel>
              <FormControl>
                <Textarea placeholder="Observations de fin de mission..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={createMission.isPending} className="w-full">
          {createMission.isPending ? 'Création...' : 'Créer la mission'}
        </Button>
      </form>
    </Form>
  );
}
