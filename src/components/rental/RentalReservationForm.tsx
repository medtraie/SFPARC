import { useEffect, useMemo } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  RentalReservation,
  RentalReservationInsert,
  RentalReservationUpdate,
  computeTotalPrice,
  useRentalClients,
  useRentalReservations,
  useRentalReservationMutations,
  useRentalVehicles,
  useVehicleAvailability,
} from '@/hooks/useRental';

const schema = z.object({
  client_id: z.string().min(1),
  vehicle_id: z.string().min(1),
  start_date: z.string().min(10),
  end_date: z.string().min(10),
  security_deposit: z.coerce.number().nonnegative().optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled']).default('pending'),
  options_json: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

type Values = z.infer<typeof schema>;

function parseJsonSafe(s: string) {
  const raw = (s || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function RentalReservationForm(props: {
  reservation?: RentalReservation | null;
  onDone: () => void;
}) {
  const clientsQ = useRentalClients();
  const vehiclesQ = useRentalVehicles();
  const reservationsQ = useRentalReservations();
  const { create, update } = useRentalReservationMutations();

  const defaultValues = useMemo<Values>(() => {
    const r = props.reservation;
    return {
      client_id: r?.client_id || '',
      vehicle_id: r?.vehicle_id || '',
      start_date: r?.start_date || new Date().toISOString().slice(0, 10),
      end_date: r?.end_date || new Date().toISOString().slice(0, 10),
      security_deposit: Number(r?.security_deposit ?? 0),
      status: (r?.status as any) || 'pending',
      options_json: r?.options ? JSON.stringify(r.options, null, 2) : '',
      notes: r?.notes || '',
    };
  }, [props.reservation]);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const vehicleId = form.watch('vehicle_id');
  const startDate = form.watch('start_date');
  const endDate = form.watch('end_date');

  const selectedVehicle = useMemo(() => {
    return (vehiclesQ.data || []).find((v) => v.id === vehicleId) || null;
  }, [vehicleId, vehiclesQ.data]);

  const pricePreview = useMemo(() => {
    if (!selectedVehicle || !startDate || !endDate) return null;
    const res = computeTotalPrice({
      startDate,
      endDate,
      pricePerDay: Number(selectedVehicle.price_per_day || 0),
      pricePerWeek: Number(selectedVehicle.price_per_week || 0),
      pricePerMonth: Number(selectedVehicle.price_per_month || 0),
    });
    return res;
  }, [selectedVehicle, startDate, endDate]);

  const availabilityQ = useVehicleAvailability(
    vehicleId && startDate && endDate
      ? {
          vehicleId,
          startDate,
          endDate,
          ignoreReservationId: props.reservation?.id || undefined,
        }
      : undefined
  );

  const isSaving = create.isPending || update.isPending;

  const onSubmit = async (values: Values) => {
    try {
      const vehicle = (vehiclesQ.data || []).find((v) => v.id === values.vehicle_id);
      if (!vehicle) throw new Error('Véhicule introuvable');

      if (availabilityQ.data && availabilityQ.data.available === false) {
        throw new Error('Véhicule indisponible sur cette période');
      }

      const price = computeTotalPrice({
        startDate: values.start_date,
        endDate: values.end_date,
        pricePerDay: Number(vehicle.price_per_day || 0),
        pricePerWeek: Number(vehicle.price_per_week || 0),
        pricePerMonth: Number(vehicle.price_per_month || 0),
      });

      const payloadBase = {
        client_id: values.client_id,
        vehicle_id: values.vehicle_id,
        start_date: values.start_date,
        end_date: values.end_date,
        price_per_day: Number(vehicle.price_per_day || 0),
        total_price: price.total,
        security_deposit: Number(values.security_deposit || 0),
        options: parseJsonSafe(values.options_json),
        status: values.status,
        notes: values.notes?.trim() ? values.notes.trim() : null,
      } satisfies Partial<RentalReservationInsert>;

      if (props.reservation?.id) {
        const updatePayload: RentalReservationUpdate & { id: string } = { id: props.reservation.id, ...payloadBase };
        await update.mutateAsync(updatePayload);
      } else {
        const insertPayload: RentalReservationInsert = payloadBase as RentalReservationInsert;
        await create.mutateAsync(insertPayload);
      }

      props.onDone();
    } catch (e: any) {
      toast.error(e?.message || 'Erreur lors de l’enregistrement');
    }
  };

  const availabilityBadge = useMemo(() => {
    if (!vehicleId || !startDate || !endDate) return null;
    if (availabilityQ.isLoading) return <Badge variant="outline">Vérification...</Badge>;
    if (availabilityQ.data?.available) return <Badge className="bg-emerald-600 hover:bg-emerald-600">Disponible</Badge>;
    if (availabilityQ.data && availabilityQ.data.available === false) return <Badge variant="destructive">Indisponible</Badge>;
    return null;
  }, [availabilityQ.data, availabilityQ.isLoading, vehicleId, startDate, endDate]);

  const disableSubmit = isSaving || (availabilityQ.data && availabilityQ.data.available === false);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <FormField
            control={form.control}
            name="client_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un client" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(clientsQ.data || []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
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
            name="vehicle_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Véhicule</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un véhicule" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(vehiclesQ.data || []).map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.registration} — {v.brand} {v.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="pt-2 flex items-center gap-2">
                  {availabilityBadge}
                  {selectedVehicle?.status && (
                    <Badge variant="secondary" className="capitalize">
                      {selectedVehicle.status}
                    </Badge>
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date début</FormLabel>
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
                <FormLabel>Date fin</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="security_deposit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dépôt garantie</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Statut</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="confirmed">Confirmée</SelectItem>
                    <SelectItem value="cancelled">Annulée</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {pricePreview && (
          <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/20">
            <div className="text-sm text-muted-foreground">
              Calcul automatique ({pricePreview.days} jours)
            </div>
            <div className="text-lg font-semibold">{pricePreview.total.toLocaleString('fr-MA')} MAD</div>
          </div>
        )}

        <FormField
          control={form.control}
          name="options_json"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Options supplémentaires (JSON)</FormLabel>
              <FormControl>
                <Textarea rows={4} placeholder='{"gps": true, "childSeat": 1}' {...field} />
              </FormControl>
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
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={disableSubmit}>
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enregistrement...
            </>
          ) : (
            'Enregistrer'
          )}
        </Button>
        {availabilityQ.data && availabilityQ.data.available === false && (
          <div className="text-sm text-destructive">
            Conflit détecté: une réservation/location existe déjà sur cette période.
          </div>
        )}
        {reservationsQ.isError && (
          <div className="text-sm text-destructive">
            Erreur chargement réservations: {(reservationsQ.error as Error).message}
          </div>
        )}
      </form>
    </Form>
  );
}

