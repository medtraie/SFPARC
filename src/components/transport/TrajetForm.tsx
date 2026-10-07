import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Plus, Route } from 'lucide-react';
import { useCreateTrajet, useChantiers, useCreateChantier, type Trajet } from '@/hooks/useTransportBTP';
import { useGPSwoxGeofences } from '@/hooks/useGPSwoxGeofences';
import { useToast } from '@/hooks/use-toast';

const trajetSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  origin_chantier_id: z.string().optional(),
  destination_chantier_id: z.string().optional(),
  distance_km: z.string().optional(),
  estimated_duration_minutes: z.string().optional(),
  price_per_ton: z.string().min(1, 'Le prix par tonne est requis'),
  price_per_trip: z.string().optional(),
  status: z.string().default('active'),
  notes: z.string().optional(),
});

type TrajetFormValues = z.infer<typeof trajetSchema>;

interface TrajetFormProps {
  onSuccess?: () => void;
}

export function TrajetForm({ onSuccess }: TrajetFormProps) {
  const [open, setOpen] = useState(false);
  const createTrajet = useCreateTrajet();
  const { data: chantiers = [] } = useChantiers();
  const createChantier = useCreateChantier();
  const { data: geofences = [] } = useGPSwoxGeofences();
  const { toast } = useToast();

  const form = useForm<TrajetFormValues>({
    resolver: zodResolver(trajetSchema),
    defaultValues: {
      name: '',
      origin_chantier_id: '',
      destination_chantier_id: '',
      distance_km: '',
      estimated_duration_minutes: '',
      price_per_ton: '',
      price_per_trip: '',
      status: 'active',
      notes: '',
    },
  });

  const onSubmit = async (values: TrajetFormValues) => {
    try {
      const chantierByName = new Map(
        chantiers
          .filter((chantier) => typeof chantier.name === 'string' && chantier.name.trim().length > 0)
          .map((chantier) => [chantier.name.trim().toLowerCase(), chantier]),
      );

      const ensureChantierId = async (name?: string) => {
        if (!name || name === 'none') return null;
        const key = name.toLowerCase();
        const existing = chantierByName.get(key);
        if (existing) return existing.id;
        const created = await createChantier.mutateAsync({
          name,
          type: 'chantier',
          status: 'active',
          address: null,
          city: null,
          gps_lat: null,
          gps_lng: null,
          contact_name: null,
          contact_phone: null,
          notes: null,
        });
        chantierByName.set(key, created);
        return created.id;
      };

      const originId = await ensureChantierId(values.origin_chantier_id);
      const destinationId = await ensureChantierId(values.destination_chantier_id);

      const trajetData: Omit<Trajet, 'id' | 'created_at' | 'updated_at' | 'origin_chantier' | 'destination_chantier'> = {
        name: values.name,
        origin_chantier_id: originId,
        destination_chantier_id: destinationId,
        distance_km: values.distance_km ? parseFloat(values.distance_km) : null,
        estimated_duration_minutes: values.estimated_duration_minutes ? parseInt(values.estimated_duration_minutes) : null,
        price_per_ton: parseFloat(values.price_per_ton) || 0,
        price_per_trip: values.price_per_trip ? parseFloat(values.price_per_trip) : 0,
        status: values.status,
        notes: values.notes || null,
      };

      await createTrajet.mutateAsync(trajetData);
      form.reset();
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: 'Erreur lors de la création',
        variant: 'destructive',
      });
    }
  };

  const geofenceNames = Array.from(
    new Set(
      geofences
        .map((geofence) => (typeof geofence.name === 'string' ? geofence.name.trim() : ''))
        .filter((name) => name.length > 0),
    ),
  );
  const geofenceNameSet = new Set(geofenceNames.map((name) => name.toLowerCase()));
  const chantierNames = Array.from(
    new Set(
      chantiers
        .map((chantier) => (typeof chantier.name === 'string' ? chantier.name.trim() : ''))
        .filter((name) => name.length > 0)
        .filter((name) => !geofenceNameSet.has(name.toLowerCase())),
    ),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nouveau trajet
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="w-5 h-5" />
            Ajouter un trajet
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom du trajet *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Carrière A → Chantier B" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="origin_chantier_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origine</FormLabel>
                    <Select
                      value={field.value && field.value.trim().length > 0 ? field.value : 'none'}
                      onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {geofenceNames.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="text-primary font-bold">Zones GPSwox</SelectLabel>
                            {geofenceNames.map((name) => (
                              <SelectItem key={`geo-${name}`} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        {chantierNames.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="text-slate-500 font-bold">Chantiers Locaux</SelectLabel>
                            {chantierNames.map((name) => (
                              <SelectItem key={`local-${name}`} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="destination_chantier_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination</FormLabel>
                    <Select
                      value={field.value && field.value.trim().length > 0 ? field.value : 'none'}
                      onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {geofenceNames.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="text-primary font-bold">Zones GPSwox</SelectLabel>
                            {geofenceNames.map((name) => (
                              <SelectItem key={`geo-${name}`} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        {chantierNames.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="text-slate-500 font-bold">Chantiers Locaux</SelectLabel>
                            {chantierNames.map((name) => (
                              <SelectItem key={`local-${name}`} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
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
                name="distance_km"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Distance (km)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" placeholder="25" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="estimated_duration_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Durée (min)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="45" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price_per_ton"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prix/tonne (MAD) *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="price_per_trip"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prix/voyage (MAD)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="500" {...field} />
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
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="inactive">Inactif</SelectItem>
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
                    <Textarea placeholder="Notes supplémentaires..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createTrajet.isPending}>
                {createTrajet.isPending ? 'Enregistrement...' : 'Créer'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
