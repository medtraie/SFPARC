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
import { useCreatePassengerBaggage, usePassengerTrips, usePassengerTickets, generateBaggageNumber } from '@/hooks/usePassengerTransport';

const formSchema = z.object({
  trip_id: z.string().min(1, 'Le voyage est requis'),
  ticket_id: z.string().optional(),
  weight_kg: z.coerce.number().optional(),
  fee_amount: z.coerce.number().min(0, 'Le montant doit être positif'),
  description: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface BaggageFormProps {
  onSuccess?: () => void;
}

export function BaggageForm({ onSuccess }: BaggageFormProps) {
  const [open, setOpen] = useState(false);
  const { data: trips = [] } = usePassengerTrips();
  const { data: tickets = [] } = usePassengerTickets();
  const createBaggage = useCreatePassengerBaggage();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      trip_id: '',
      ticket_id: '',
      weight_kg: undefined,
      fee_amount: 0,
      description: '',
    },
  });

  const selectedTripId = form.watch('trip_id');
  const tripTickets = tickets.filter((t) => t.trip_id === selectedTripId && t.status === 'valid');

  const availableTrips = trips.filter((t) => t.status === 'scheduled' || t.status === 'boarding');

  const onSubmit = async (data: FormData) => {
    const baggageNumber = generateBaggageNumber();
    
    await createBaggage.mutateAsync({
      baggage_number: baggageNumber,
      trip_id: data.trip_id,
      ticket_id: data.ticket_id && data.ticket_id !== 'none' ? data.ticket_id : null,
      weight_kg: data.weight_kg || null,
      fee_amount: data.fee_amount,
      description: data.description || null,
      status: 'checked',
    });
    
    form.reset();
    setOpen(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="w-4 h-4 mr-1" />
          Enregistrer bagage
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enregistrer un bagage</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="trip_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Voyage</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue('ticket_id', '');
                    }} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un voyage" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableTrips.map((trip) => (
                        <SelectItem key={trip.id} value={trip.id}>
                          [{trip.line?.code}] {trip.trip_date} - {trip.departure_time?.slice(0, 5)}
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
              name="ticket_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Billet associé (optionnel)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!selectedTripId}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Aucun billet" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Aucun billet</SelectItem>
                      {tripTickets.map((ticket) => (
                        <SelectItem key={ticket.id} value={ticket.id}>
                          {ticket.ticket_number}
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
                name="weight_kg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Poids (kg)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fee_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frais (MAD)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.5" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Description du bagage..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createBaggage.isPending}>
                {createBaggage.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
