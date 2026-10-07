import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, TruckIcon, Loader2 } from 'lucide-react';
import { useCreateVoyage, useTrajets, type Voyage } from '@/hooks/useTransportBTP';
import { useCreateDriver, useDrivers } from '@/hooks/useDrivers';
import { useGPSwoxData } from '@/hooks/useGPSwoxVehicles';

const voyageSchema = z.object({
  trajet_id: z.string().optional(),
  vehicle_id: z.string().min(1, 'Le véhicule est requis'),
  driver_id: z.string().optional(),
  voyage_date: z.string().min(1, 'La date est requise'),
  tonnage: z.string().min(1, 'Le tonnage est requis'),
  material_type: z.string().optional(),
  departure_time: z.string().optional(),
  arrival_time: z.string().optional(),
  status: z.string().default('completed'),
  bon_number: z.string().optional(),
  notes: z.string().optional(),
});

type VoyageFormValues = z.infer<typeof voyageSchema>;

const MATERIAL_TYPES = [
  { value: 'sable', label: 'Sable' },
  { value: 'gravier', label: 'Gravier' },
  { value: 'beton', label: 'Béton' },
  { value: 'ciment', label: 'Ciment' },
  { value: 'terre', label: 'Terre' },
  { value: 'pierres', label: 'Pierres' },
  { value: 'autre', label: 'Autre' },
];

interface VoyageFormProps {
  onSuccess?: () => void;
}

export function VoyageForm({ onSuccess }: VoyageFormProps) {
  const [open, setOpen] = useState(false);
  const createVoyage = useCreateVoyage();
  const { data: trajets = [] } = useTrajets();
  const { data: drivers = [], isLoading: driversLoading } = useDrivers();
  const createDriver = useCreateDriver();
  const { data: gpswoxData, isLoading: gpswoxLoading } = useGPSwoxData();
  const vehicles = gpswoxData?.vehicles || [];
  const gpswoxDrivers = gpswoxData?.drivers || [];

  const form = useForm<VoyageFormValues>({
    resolver: zodResolver(voyageSchema),
    defaultValues: {
      trajet_id: '',
      vehicle_id: '',
      driver_id: '',
      voyage_date: new Date().toISOString().split('T')[0],
      tonnage: '',
      material_type: '',
      departure_time: '',
      arrival_time: '',
      status: 'completed',
      bon_number: '',
      notes: '',
    },
  });

  const onSubmit = async (values: VoyageFormValues) => {
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

    const voyageData: Omit<Voyage, 'id' | 'created_at' | 'updated_at' | 'trajet'> = {
      trajet_id: values.trajet_id && values.trajet_id !== 'none' ? values.trajet_id : null,
      vehicle_id: values.vehicle_id,
      driver_id: driverId,
      voyage_date: values.voyage_date,
      tonnage: parseFloat(values.tonnage),
      material_type: values.material_type && values.material_type !== 'none' ? values.material_type : null,
      departure_time: values.departure_time || null,
      arrival_time: values.arrival_time || null,
      status: values.status,
      bon_number: values.bon_number || null,
      notes: values.notes || null,
    };

    await createVoyage.mutateAsync(voyageData);
    form.reset();
    setOpen(false);
    onSuccess?.();
  };

  const localDriverNames = new Set(drivers.map((d) => d.name.toLowerCase()));
  const selectableDrivers = [
    ...drivers.map((driver) => ({ id: driver.id, name: driver.name, source: 'local' as const })),
    ...gpswoxDrivers
      .filter((driver) => !localDriverNames.has(driver.name.toLowerCase()))
      .map((driver) => ({
        id: `gpswox:${driver.id}`,
        name: driver.name,
        source: 'gpswox' as const,
      })),
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nouveau voyage
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TruckIcon className="w-5 h-5" />
            Enregistrer un voyage
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="trajet_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trajet</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un trajet" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Aucun trajet prédéfini</SelectItem>
                      {trajets.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} - {t.price_per_ton} MAD/t
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vehicle_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Véhicule *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={gpswoxLoading}>
                      <FormControl>
                        <SelectTrigger>
                          {gpswoxLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <SelectValue placeholder="Sélectionner" />
                          )}
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id.toString()}>
                            {v.plate} - {v.brand} {v.model}
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
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={driversLoading || gpswoxLoading}>
                      <FormControl>
                        <SelectTrigger>
                          {driversLoading || gpswoxLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <SelectValue placeholder="Sélectionner" />
                          )}
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="voyage_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bon_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>N° Bon de livraison</FormLabel>
                    <FormControl>
                      <Input placeholder="BL-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tonnage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tonnage (t) *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="25" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="material_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de matériau</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Non spécifié</SelectItem>
                        {MATERIAL_TYPES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="departure_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Heure de départ</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="arrival_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Heure d'arrivée</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statut</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="in_progress">En cours</SelectItem>
                      <SelectItem value="completed">Terminé</SelectItem>
                      <SelectItem value="cancelled">Annulé</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Observations..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createVoyage.isPending}>
                {createVoyage.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
