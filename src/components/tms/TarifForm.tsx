import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useCreateTMSTarif, useTMSClients } from '@/hooks/useTMS';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';

interface FormData {
  name: string;
  client_id: string;
  price_per_km: number;
  price_per_ton: number;
  min_price: number;
  notes: string;
}

export function TarifForm() {
  const [open, setOpen] = useState(false);
  const createTarif = useCreateTMSTarif();
  const { data: clients = [] } = useTMSClients();
  const { register, handleSubmit, reset, setValue, watch } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    await createTarif.mutateAsync({
      name: data.name,
      client_id: data.client_id && data.client_id !== 'none' ? data.client_id : null,
      price_per_km: Number(data.price_per_km) || 0,
      price_per_ton: Number(data.price_per_ton) || 0,
      min_price: Number(data.min_price) || 0,
      notes: data.notes || null,
    });
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" /> Nouveau tarif</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau tarif</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Nom du tarif *</Label>
            <Input {...register('name', { required: true })} placeholder="Ex: Tarif standard Casablanca" />
          </div>
          <div className="space-y-2">
            <Label>Client (optionnel)</Label>
            <Select onValueChange={(v) => setValue('client_id', v)}>
              <SelectTrigger><SelectValue placeholder="Tarif général" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tarif général</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Prix/km (MAD)</Label>
              <Input type="number" step="0.01" {...register('price_per_km')} />
            </div>
            <div className="space-y-2">
              <Label>Prix/tonne (MAD)</Label>
              <Input type="number" step="0.01" {...register('price_per_ton')} />
            </div>
            <div className="space-y-2">
              <Label>Prix minimum</Label>
              <Input type="number" step="0.01" {...register('min_price')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea {...register('notes')} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={createTarif.isPending}>Créer</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
