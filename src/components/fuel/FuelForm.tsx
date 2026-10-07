import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FuelLog } from '@/lib/mock-data';
import { useEffect } from 'react';
import { useGPSwoxVehicles } from '@/hooks/useGPSwoxVehicles';
import { useDrivers } from '@/hooks/useDrivers';

const fuelSchema = z.object({
  vehicleId: z.string().min(1, 'Véhicule requis'),
  driverId: z.string().min(1, 'Chauffeur requis'),
  date: z.string().min(1, 'Date requise'),
  liters: z.coerce.number().min(1, 'Quantité requise'),
  pricePerLiter: z.coerce.number().min(0.01, 'Prix requis'),
  station: z.string().min(1, 'Station requise'),
  mileage: z.coerce.number().min(1, 'Kilométrage requis'),
});

type FuelFormData = z.infer<typeof fuelSchema>;

interface FuelFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fuelLog?: FuelLog;
  onSubmit: (data: FuelFormData) => void;
}

export function FuelForm({ open, onOpenChange, fuelLog, onSubmit }: FuelFormProps) {
  const isEditing = !!fuelLog;
  
  // Fetch real vehicles from GPSwox
  const { data: gpswoxVehicles = [], isLoading: vehiclesLoading } = useGPSwoxVehicles();
  // Fetch real drivers from database
  const { data: drivers = [], isLoading: driversLoading } = useDrivers();
  
  const form = useForm<FuelFormData>({
    resolver: zodResolver(fuelSchema),
    defaultValues: {
      vehicleId: '',
      driverId: '',
      date: new Date().toISOString().split('T')[0],
      liters: 0,
      pricePerLiter: 12.50,
      station: '',
      mileage: 0,
    },
  });

  const selectedVehicleId = form.watch('vehicleId');

  // Auto-fill mileage and fuel quantity when vehicle is selected
  useEffect(() => {
    if (selectedVehicleId && !isEditing) {
      const selectedVehicle = gpswoxVehicles.find(v => String(v.id) === selectedVehicleId);
      if (selectedVehicle) {
        // Set mileage from GPSwox
        if (selectedVehicle.mileage) {
          form.setValue('mileage', Math.round(selectedVehicle.mileage));
        }
        // Set fuel quantity from GPSwox if available
        if (selectedVehicle.fuelQuantity !== null && selectedVehicle.fuelQuantity !== undefined) {
          form.setValue('liters', selectedVehicle.fuelQuantity);
        }
      }
    }
  }, [selectedVehicleId, gpswoxVehicles, form, isEditing]);

  useEffect(() => {
    if (fuelLog) {
      form.reset({
        vehicleId: fuelLog.vehicleId,
        driverId: fuelLog.driverId,
        date: fuelLog.date,
        liters: fuelLog.liters,
        pricePerLiter: fuelLog.pricePerLiter,
        station: fuelLog.station,
        mileage: fuelLog.mileage,
      });
    } else {
      form.reset({
        vehicleId: '',
        driverId: '',
        date: new Date().toISOString().split('T')[0],
        liters: 0,
        pricePerLiter: 12.50,
        station: '',
        mileage: 0,
      });
    }
  }, [fuelLog, form]);

  const liters = form.watch('liters');
  const pricePerLiter = form.watch('pricePerLiter');
  const totalCost = (liters || 0) * (pricePerLiter || 0);

  const handleSubmit = (data: FuelFormData) => {
    onSubmit(data);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="sr-only">
            {isEditing ? 'Modifier le plein' : 'Nouveau plein carburant'}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vehicleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Véhicule</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={vehiclesLoading}>
                      <FormControl>
                        <SelectTrigger>
                          {vehiclesLoading ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Chargement...</span>
                            </div>
                          ) : (
                            <SelectValue placeholder="Sélectionner" />
                          )}
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {gpswoxVehicles.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                            {vehicle.plate} - {vehicle.brand} {vehicle.model}
                          </SelectItem>
                        ))}
                        {!vehiclesLoading && gpswoxVehicles.length === 0 && (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            Aucun véhicule disponible
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="driverId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chauffeur</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={driversLoading}>
                      <FormControl>
                        <SelectTrigger>
                          {driversLoading ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Chargement...</span>
                            </div>
                          ) : (
                            <SelectValue placeholder="Sélectionner" />
                          )}
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {drivers.map((driver) => (
                          <SelectItem key={driver.id} value={driver.id}>
                            {driver.name}
                          </SelectItem>
                        ))}
                        {!driversLoading && drivers.length === 0 && (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            Aucun chauffeur disponible
                          </div>
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
                name="date"
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
                name="mileage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kilométrage (km)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="station"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Station</FormLabel>
                  <FormControl>
                    <Input placeholder="Nom de la station" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="liters"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantité (litres)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pricePerLiter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prix/litre (MAD)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="12.50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Total Cost Display */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Coût total</span>
                <span className="text-2xl font-bold text-primary">
                  {totalCost.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit">
                {isEditing ? 'Mettre à jour' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
