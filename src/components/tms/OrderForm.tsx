import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useCreateTMSOrder, useTMSClients, useTMSTarifs } from '@/hooks/useTMS';
import { useDrivers } from '@/hooks/useDrivers';
import { useGPSwoxVehicles } from '@/hooks/useGPSwoxVehicles';
import { useGPSwoxGeofences } from '@/hooks/useGPSwoxGeofences';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';

interface FormData {
  order_number: string;
  client_id: string;
  tarif_id: string;
  vehicle_id: string;
  driver_id: string;
  pickup_address: string;
  delivery_address: string;
  pickup_date: string;
  delivery_date: string;
  distance_km: number;
  weight_tons: number;
  merchandise_type: string;
  notes: string;
}

export function OrderForm() {
  const [open, setOpen] = useState(false);
  const createOrder = useCreateTMSOrder();
  const { data: clients = [] } = useTMSClients();
  const { data: tarifs = [] } = useTMSTarifs();
  const { data: drivers = [] } = useDrivers();
  const { data: vehicles = [] } = useGPSwoxVehicles();
  const { data: geofences = [] } = useGPSwoxGeofences();
  const clientOptions = clients.filter((client) => typeof client.id === 'string' && client.id.trim().length > 0);
  const vehicleOptions = vehicles.filter((vehicle) => String(vehicle.id ?? '').trim().length > 0);
  const driverOptions = drivers.filter((driver) => typeof driver.id === 'string' && driver.id.trim().length > 0);
  const geofenceOptions = geofences.filter(
    (geofence) => typeof geofence.name === 'string' && geofence.name.trim().length > 0,
  );
  const { register, handleSubmit, reset, setValue, watch } = useForm<FormData>({
    defaultValues: { order_number: `OT-${Date.now().toString(36).toUpperCase()}` }
  });

  const selectedTarifId = watch('tarif_id');
  const distanceKm = watch('distance_km');
  const weightTons = watch('weight_tons');
  const selectedTarif = tarifs.find(t => t.id === selectedTarifId);

  const amountHT = selectedTarif
    ? Math.max(
        (Number(distanceKm || 0) * Number(selectedTarif.price_per_km)) +
        (Number(weightTons || 0) * Number(selectedTarif.price_per_ton)),
        Number(selectedTarif.min_price)
      )
    : 0;

  const onSubmit = async (data: FormData) => {
    await createOrder.mutateAsync({
      order_number: data.order_number,
      client_id: data.client_id && data.client_id !== 'none' ? data.client_id : null,
      tarif_id: data.tarif_id && data.tarif_id !== 'none' ? data.tarif_id : null,
      vehicle_id: data.vehicle_id && data.vehicle_id !== 'none' ? data.vehicle_id : null,
      driver_id: data.driver_id && data.driver_id !== 'none' ? data.driver_id : null,
      pickup_address: data.pickup_address,
      delivery_address: data.delivery_address,
      pickup_date: data.pickup_date,
      delivery_date: data.delivery_date || null,
      distance_km: Number(data.distance_km) || 0,
      weight_tons: Number(data.weight_tons) || 0,
      merchandise_type: data.merchandise_type || null,
      amount_ht: amountHT,
      notes: data.notes || null,
    });
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" /> Nouvel ordre</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvel ordre de transport</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>N° Ordre</Label>
              <Input {...register('order_number', { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Select onValueChange={(v) => setValue('client_id', v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {clientOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Véhicule</Label>
              <Select onValueChange={(v) => setValue('vehicle_id', v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {vehicleOptions.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.plate} - {v.brand} {v.model}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Chauffeur</Label>
              <Select onValueChange={(v) => setValue('driver_id', v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {driverOptions.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Adresse enlèvement *</Label>
              <Select onValueChange={(v) => setValue('pickup_address', v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une zone" /></SelectTrigger>
                <SelectContent>
                  {geofenceOptions.map(g => (
                    <SelectItem key={g.id} value={g.name.trim()}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                        {g.name.trim()}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Adresse livraison *</Label>
              <Select onValueChange={(v) => setValue('delivery_address', v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une zone" /></SelectTrigger>
                <SelectContent>
                  {geofenceOptions.map(g => (
                    <SelectItem key={g.id} value={g.name.trim()}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                        {g.name.trim()}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date enlèvement *</Label>
              <Input type="date" {...register('pickup_date', { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>Date livraison</Label>
              <Input type="date" {...register('delivery_date')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tarif</Label>
            <Select onValueChange={(v) => setValue('tarif_id', v)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un tarif" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Manuel</SelectItem>
                {tarifs.filter(t => t.status === 'active').map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Distance (km)</Label>
              <Input type="number" step="0.1" {...register('distance_km')} />
            </div>
            <div className="space-y-2">
              <Label>Poids (tonnes)</Label>
              <Input type="number" step="0.1" {...register('weight_tons')} />
            </div>
            <div className="space-y-2">
              <Label>Type marchandise</Label>
              <Input {...register('merchandise_type')} />
            </div>
          </div>

          {selectedTarif && amountHT > 0 && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm font-semibold">Montant HT calculé: {amountHT.toFixed(2)} MAD</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea {...register('notes')} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={createOrder.isPending}>Créer</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
