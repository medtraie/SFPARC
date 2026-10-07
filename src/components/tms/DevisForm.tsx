import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useCreateTMSDevis, useTMSClients, useTMSTarifs } from '@/hooks/useTMS';
import { useGPSwoxGeofences } from '@/hooks/useGPSwoxGeofences';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';

interface FormData {
  devis_number: string;
  client_id: string;
  tarif_id: string;
  pickup_address: string;
  delivery_address: string;
  distance_km: number;
  weight_tons: number;
  merchandise_type: string;
  valid_until: string;
  notes: string;
}

export function DevisForm() {
  const [open, setOpen] = useState(false);
  const createDevis = useCreateTMSDevis();
  const { data: clients = [] } = useTMSClients();
  const { data: tarifs = [] } = useTMSTarifs();
  const { data: geofences = [] } = useGPSwoxGeofences();
  const { register, handleSubmit, reset, setValue, watch } = useForm<FormData>({
    defaultValues: { devis_number: `DEV-${Date.now().toString(36).toUpperCase()}` }
  });

  const selectedTarifId = watch('tarif_id');
  const distanceKm = watch('distance_km');
  const weightTons = watch('weight_tons');

  const selectedTarif = tarifs.find(t => t.id === selectedTarifId);
  const calculatedAmount = selectedTarif
    ? Math.max(
        (Number(distanceKm || 0) * Number(selectedTarif.price_per_km)) +
        (Number(weightTons || 0) * Number(selectedTarif.price_per_ton)),
        Number(selectedTarif.min_price)
      )
    : 0;

  const taxAmount = calculatedAmount * 0.2;
  const totalTTC = calculatedAmount + taxAmount;

  const onSubmit = async (data: FormData) => {
    await createDevis.mutateAsync({
      devis_number: data.devis_number,
      client_id: data.client_id && data.client_id !== 'none' ? data.client_id : null,
      tarif_id: data.tarif_id && data.tarif_id !== 'none' ? data.tarif_id : null,
      pickup_address: data.pickup_address,
      delivery_address: data.delivery_address,
      distance_km: Number(data.distance_km) || 0,
      weight_tons: Number(data.weight_tons) || 0,
      merchandise_type: data.merchandise_type || null,
      amount_ht: calculatedAmount,
      tax_rate: 20,
      tax_amount: taxAmount,
      amount_ttc: totalTTC,
      valid_until: data.valid_until || null,
      notes: data.notes || null,
    });
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" /> Nouveau devis</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau devis</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>N° Devis</Label>
              <Input {...register('devis_number', { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Select onValueChange={(v) => setValue('client_id', v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tarif applicable</Label>
            <Select onValueChange={(v) => setValue('tarif_id', v)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un tarif" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun tarif</SelectItem>
                {tarifs.filter(t => t.status === 'active').map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name} ({Number(t.price_per_km).toFixed(2)}/km, {Number(t.price_per_ton).toFixed(2)}/t)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Adresse enlèvement *</Label>
              <Select onValueChange={(v) => setValue('pickup_address', v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une zone" /></SelectTrigger>
                <SelectContent>
                  {geofences.map(g => (
                    <SelectItem key={g.id} value={g.name}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                        {g.name}
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
                  {geofences.map(g => (
                    <SelectItem key={g.id} value={g.name}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                        {g.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

          {selectedTarif && (
            <div className="rounded-lg bg-muted p-4 space-y-1">
              <p className="text-sm font-medium">Calcul automatique :</p>
              <p className="text-sm text-muted-foreground">{Number(distanceKm || 0)} km × {Number(selectedTarif.price_per_km).toFixed(2)} = {(Number(distanceKm || 0) * Number(selectedTarif.price_per_km)).toFixed(2)} MAD</p>
              <p className="text-sm text-muted-foreground">{Number(weightTons || 0)} t × {Number(selectedTarif.price_per_ton).toFixed(2)} = {(Number(weightTons || 0) * Number(selectedTarif.price_per_ton)).toFixed(2)} MAD</p>
              <p className="text-sm font-semibold">Total HT: {calculatedAmount.toFixed(2)} MAD</p>
              <p className="text-sm text-muted-foreground">TVA (20%): {taxAmount.toFixed(2)} MAD</p>
              <p className="text-base font-bold">Total TTC: {totalTTC.toFixed(2)} MAD</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valide jusqu'au</Label>
              <Input type="date" {...register('valid_until')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea {...register('notes')} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={createDevis.isPending}>Créer</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
