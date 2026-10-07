import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Plus } from 'lucide-react';
import { useCreatePassengerStation, PassengerStation } from '@/hooks/usePassengerTransport';

const formSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  city: z.string().min(1, 'La ville est requise'),
  sequence_order: z.coerce.number().min(1, "L'ordre est requis"),
  distance_from_start_km: z.coerce.number().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface StationFormProps {
  lineId: string;
  existingStations: PassengerStation[];
  onSuccess?: () => void;
}

export function StationForm({ lineId, existingStations, onSuccess }: StationFormProps) {
  const [open, setOpen] = useState(false);
  const createStation = useCreatePassengerStation();

  const nextOrder = existingStations.length > 0 
    ? Math.max(...existingStations.map(s => s.sequence_order)) + 1 
    : 1;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      city: '',
      sequence_order: nextOrder,
      distance_from_start_km: undefined,
    },
  });

  const onSubmit = async (data: FormData) => {
    await createStation.mutateAsync({
      line_id: lineId,
      name: data.name,
      city: data.city,
      sequence_order: data.sequence_order,
      distance_from_start_km: data.distance_from_start_km || null,
      gps_lat: null,
      gps_lng: null,
    });
    form.reset({ ...form.formState.defaultValues, sequence_order: nextOrder + 1 });
    setOpen(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="w-4 h-4 mr-1" />
          Ajouter station
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter une station</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de la station</FormLabel>
                  <FormControl>
                    <Input placeholder="ex: Gare routière Casa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ville</FormLabel>
                  <FormControl>
                    <Input placeholder="Casablanca" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sequence_order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ordre</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="distance_from_start_km"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Distance depuis départ (km)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createStation.isPending}>
                {createStation.isPending ? 'Ajout...' : 'Ajouter'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
