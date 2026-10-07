import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { useCreatePassengerTrip, usePassengerLines, PassengerLine } from '@/hooks/usePassengerTransport';
import { useDrivers } from '@/hooks/useDrivers';
import { useGPSwoxVehicles } from '@/hooks/useGPSwoxVehicles';
import { format } from 'date-fns';

const formSchema = z.object({
  line_id: z.string().min(1, 'La ligne est requise'),
  trip_date: z.string().min(1, 'La date est requise'),
  departure_time: z.string().min(1, "L'heure de départ est requise"),
  arrival_time: z.string().optional(),
  vehicle_id: z.string().optional(),
  driver_id: z.string().optional(),
  available_seats: z.coerce.number().min(1).optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface TripFormProps {
  onSuccess?: () => void;
}

export function TripForm({ onSuccess }: TripFormProps) {
  const [open, setOpen] = useState(false);
  const { data: lines = [] } = usePassengerLines();
  const { data: drivers = [] } = useDrivers();
  const { data: vehicles = [] } = useGPSwoxVehicles();
  const createTrip = useCreatePassengerTrip();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      line_id: '',
      trip_date: format(new Date(), 'yyyy-MM-dd'),
      departure_time: '',
      arrival_time: '',
      vehicle_id: '',
      driver_id: '',
      available_seats: 50,
      notes: '',
    },
  });

  const selectedLine = lines.find((l) => l.id === form.watch('line_id'));

  const onSubmit = async (data: FormData) => {
    await createTrip.mutateAsync({
      line_id: data.line_id,
      trip_date: data.trip_date,
      departure_time: data.departure_time,
      arrival_time: data.arrival_time || null,
      vehicle_id: data.vehicle_id || null,
      driver_id: data.driver_id || null,
      available_seats: data.available_seats || 50,
      notes: data.notes || null,
      status: 'scheduled',
    });
    form.reset();
    setOpen(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-1" />
          Nouveau voyage
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Planifier un voyage</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="line_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ligne</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une ligne" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {lines.map((line) => (
                        <SelectItem key={line.id} value={line.id}>
                          [{line.code}] {line.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedLine && (
              <p className="text-sm text-muted-foreground">
                {selectedLine.departure_city} → {selectedLine.arrival_city}
              </p>
            )}

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="trip_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="departure_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Départ</FormLabel>
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
                    <FormLabel>Arrivée (est.)</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vehicle_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Véhicule</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vehicles.map((v) => (
                          <SelectItem key={v.id} value={String(v.id)}>
                            {v.plate} - {v.model}
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {drivers.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="available_seats"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Places disponibles</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} />
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
                    <Textarea placeholder="Notes additionnelles..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createTrip.isPending}>
                {createTrip.isPending ? 'Création...' : 'Créer le voyage'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
