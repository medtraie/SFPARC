import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { 
  useCreatePassengerTicket, 
  usePassengerTrips, 
  usePassengerStations, 
  usePassengerFares,
  useCreatePassengerStation,
  generateTicketNumber,
  PassengerTrip
} from '@/hooks/usePassengerTransport';
import { useGPSwoxGeofences } from '@/hooks/useGPSwoxGeofences';

const formSchema = z.object({
  trip_id: z.string().min(1, 'Le voyage est requis'),
  from_station_id: z.string().min(1, 'La station de départ est requise'),
  to_station_id: z.string().min(1, "La station d'arrivée est requise"),
});

type FormData = z.infer<typeof formSchema>;

interface TicketFormProps {
  onSuccess?: () => void;
  preSelectedTripId?: string;
}

export function TicketForm({ onSuccess, preSelectedTripId }: TicketFormProps) {
  const [open, setOpen] = useState(false);
  const { data: trips = [] } = usePassengerTrips();
  const createTicket = useCreatePassengerTicket();
  const createStation = useCreatePassengerStation();
  const { data: gpswoxGeofences = [] } = useGPSwoxGeofences();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      trip_id: preSelectedTripId || '',
      from_station_id: '',
      to_station_id: '',
    },
  });

  const selectedTripId = form.watch('trip_id');
  const selectedTrip = trips.find((t) => t.id === selectedTripId);
  const lineId = selectedTrip?.line_id;

  const { data: stations = [] } = usePassengerStations(lineId);
  const { data: fares = [] } = usePassengerFares(lineId);

  const fromStationId = form.watch('from_station_id');
  const toStationId = form.watch('to_station_id');

  // Find fare for selected stations
  const selectedFare = fares.find(
    (f) => f.from_station_id === fromStationId && f.to_station_id === toStationId
  );
  const fareAmount = selectedFare?.fare_amount || 0;

  // Available trips (only scheduled or boarding)
  const availableTrips = trips.filter((t) => t.status === 'scheduled' || t.status === 'boarding');

  // Sort stations by sequence order
  const sortedStations = [...stations].sort((a, b) => a.sequence_order - b.sequence_order);

  // Filter destination stations to only show those after origin
  const fromStation = sortedStations.find((s) => s.id === fromStationId);
  const availableToStations = fromStation
    ? sortedStations.filter((s) => s.sequence_order > fromStation.sequence_order)
    : sortedStations;

  const getGeofenceId = (id: string) => id.startsWith('gpswox-') ? id.replace('gpswox-', '') : null;

  const onSubmit = async (data: FormData) => {
    try {
      let finalFromStationId = data.from_station_id;
      let finalToStationId = data.to_station_id;

      // Handle GPSwox geofences for departure
      const fromGeofenceId = getGeofenceId(data.from_station_id);
      if (fromGeofenceId && lineId) {
        const geofence = gpswoxGeofences.find(g => g.id === fromGeofenceId);
        if (geofence) {
          // Check if station already exists for this line with same name
          const existingStation = stations.find(s => s.name === geofence.name);
          if (existingStation) {
            finalFromStationId = existingStation.id;
          } else {
            // Create new station
            const maxSeq = Math.max(...stations.map(s => s.sequence_order), 0);
            const newStation = await createStation.mutateAsync({
              line_id: lineId,
              name: geofence.name,
              city: 'GPSwox', // Indicate source
              sequence_order: maxSeq + 1,
              distance_from_start_km: 0,
              gps_lat: null,
              gps_lng: null
            });
            finalFromStationId = newStation.id;
          }
        }
      }

      // Handle GPSwox geofences for arrival
      const toGeofenceId = getGeofenceId(data.to_station_id);
      if (toGeofenceId && lineId) {
        const geofence = gpswoxGeofences.find(g => g.id === toGeofenceId);
        if (geofence) {
           // Check if station already exists for this line with same name
           const existingStation = stations.find(s => s.name === geofence.name);
           if (existingStation) {
             finalToStationId = existingStation.id;
           } else {
            // Create new station
            const maxSeq = Math.max(...stations.map(s => s.sequence_order), 0);
            const newStation = await createStation.mutateAsync({
              line_id: lineId,
              name: geofence.name,
              city: 'GPSwox',
              sequence_order: maxSeq + 2, // Ensure different sequence if both are new
              distance_from_start_km: 0,
              gps_lat: null,
              gps_lng: null
            });
            finalToStationId = newStation.id;
          }
        }
      }

      const ticketNumber = generateTicketNumber();
      
      await createTicket.mutateAsync({
        ticket_number: ticketNumber,
        trip_id: data.trip_id,
        from_station_id: finalFromStationId,
        to_station_id: finalToStationId,
        fare_amount: fareAmount,
        issue_date: new Date().toISOString(),
        status: 'valid',
        notes: null,
      });
      
      form.reset();
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error creating ticket:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-1" />
          Émettre un billet
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Émettre un billet de voyage</DialogTitle>
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
                      form.setValue('from_station_id', '');
                      form.setValue('to_station_id', '');
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

            {selectedTrip && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-medium">{selectedTrip.line?.name}</p>
                <p className="text-muted-foreground">
                  {selectedTrip.line?.departure_city} → {selectedTrip.line?.arrival_city}
                </p>
              </div>
            )}

            <FormField
              control={form.control}
              name="from_station_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Station de départ</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue('to_station_id', '');
                    }} 
                    value={field.value}
                    disabled={!lineId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner la station de départ" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Stations de la ligne</SelectLabel>
                        {sortedStations.slice(0, -1).map((station) => (
                          <SelectItem key={station.id} value={station.id}>
                            {station.name} ({station.city})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      {gpswoxGeofences.length > 0 && (
                        <>
                          <SelectSeparator />
                          <SelectGroup>
                            <SelectLabel>Géofences GPSwox</SelectLabel>
                            {gpswoxGeofences.map((geofence) => (
                              <SelectItem key={`gpswox-${geofence.id}`} value={`gpswox-${geofence.id}`}>
                                {geofence.name} (GPSwox)
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="to_station_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Station d'arrivée</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!fromStationId}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner la station d'arrivée" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Stations de la ligne</SelectLabel>
                        {availableToStations.map((station) => (
                          <SelectItem key={station.id} value={station.id}>
                            {station.name} ({station.city})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      {gpswoxGeofences.length > 0 && (
                        <>
                          <SelectSeparator />
                          <SelectGroup>
                            <SelectLabel>Géofences GPSwox</SelectLabel>
                            {gpswoxGeofences.map((geofence) => (
                              <SelectItem key={`gpswox-${geofence.id}`} value={`gpswox-${geofence.id}`}>
                                {geofence.name} (GPSwox)
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {fareAmount > 0 ? (
              <div className="p-4 bg-primary/10 rounded-lg">
                <p className="text-sm text-muted-foreground">Prix du billet</p>
                <p className="text-2xl font-bold text-primary">{fareAmount.toFixed(2)} MAD</p>
              </div>
            ) : (fromStationId && toStationId) ? (
               <div className="p-4 bg-warning/10 rounded-lg border border-warning/50">
                <p className="text-sm text-warning">⚠️ Aucun tarif défini pour ce trajet. Le billet sera à 0 MAD.</p>
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createTicket.isPending || (!fareAmount && !fromStationId)}>
                {createTicket.isPending ? 'Émission...' : 'Émettre le billet'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
