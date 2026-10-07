import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useCreateTMSInvoice, useTMSClients, useTMSOrders } from '@/hooks/useTMS';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';

interface FormData {
  invoice_number: string;
  client_id: string;
  date_from: string;
  date_to: string;
  notes: string;
}

export function InvoiceForm() {
  const [open, setOpen] = useState(false);
  const createInvoice = useCreateTMSInvoice();
  const { data: clients = [] } = useTMSClients();
  const { data: orders = [] } = useTMSOrders();
  const { register, handleSubmit, reset, setValue, watch } = useForm<FormData>({
    defaultValues: { invoice_number: `FACT-${Date.now().toString(36).toUpperCase()}` }
  });

  const clientId = watch('client_id');
  const dateFrom = watch('date_from');
  const dateTo = watch('date_to');

  // Filter delivered orders for selected client & period
  const filteredOrders = orders.filter(o => {
    if (clientId && clientId !== 'none' && o.client_id !== clientId) return false;
    if (dateFrom && o.pickup_date < dateFrom) return false;
    if (dateTo && o.pickup_date > dateTo) return false;
    return o.status === 'delivered';
  });

  const totalOrders = filteredOrders.length;
  const totalDistance = filteredOrders.reduce((s, o) => s + Number(o.distance_km), 0);
  const totalWeight = filteredOrders.reduce((s, o) => s + Number(o.weight_tons), 0);
  const amountHT = filteredOrders.reduce((s, o) => s + Number(o.amount_ht), 0);
  const totalCost = filteredOrders.reduce((s, o) => s + Number(o.total_cost), 0);
  const taxAmount = amountHT * 0.2;
  const amountTTC = amountHT + taxAmount;
  const profit = amountHT - totalCost;

  const onSubmit = async (data: FormData) => {
    await createInvoice.mutateAsync({
      invoice_number: data.invoice_number,
      client_id: data.client_id && data.client_id !== 'none' ? data.client_id : null,
      date_from: data.date_from,
      date_to: data.date_to,
      total_orders: totalOrders,
      total_distance_km: totalDistance,
      total_weight_tons: totalWeight,
      amount_ht: amountHT,
      tax_rate: 20,
      tax_amount: taxAmount,
      amount_ttc: amountTTC,
      total_cost: totalCost,
      profit: profit,
      notes: data.notes || null,
    });
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" /> Nouvelle facture</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle facture</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>N° Facture</Label>
              <Input {...register('invoice_number', { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Select onValueChange={(v) => setValue('client_id', v)}>
                <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tous les clients</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Du *</Label>
              <Input type="date" {...register('date_from', { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>Au *</Label>
              <Input type="date" {...register('date_to', { required: true })} />
            </div>
          </div>

          <div className="rounded-lg bg-muted p-4 space-y-2">
            <p className="text-sm font-medium">Résumé ({totalOrders} ordres livrés)</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span>Distance totale:</span><span className="text-right">{totalDistance.toFixed(0)} km</span>
              <span>Tonnage total:</span><span className="text-right">{totalWeight.toFixed(2)} t</span>
              <span>Montant HT:</span><span className="text-right font-medium">{amountHT.toFixed(2)} MAD</span>
              <span>TVA (20%):</span><span className="text-right">{taxAmount.toFixed(2)} MAD</span>
              <span className="font-bold">Total TTC:</span><span className="text-right font-bold">{amountTTC.toFixed(2)} MAD</span>
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span>Coûts totaux:</span><span className="text-right text-destructive">-{totalCost.toFixed(2)} MAD</span>
                <span className="font-bold">Marge nette:</span><span className={`text-right font-bold ${profit >= 0 ? 'text-success' : 'text-destructive'}`}>{profit.toFixed(2)} MAD</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea {...register('notes')} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={createInvoice.isPending || totalOrders === 0}>Créer</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
