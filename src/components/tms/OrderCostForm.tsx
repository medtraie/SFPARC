import { useState } from 'react';
import { useUpdateTMSOrder, TMSOrder } from '@/hooks/useTMS';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator } from 'lucide-react';

interface Props {
  order: TMSOrder;
}

export function OrderCostForm({ order }: Props) {
  const [open, setOpen] = useState(false);
  const updateOrder = useUpdateTMSOrder();
  const [fuelCost, setFuelCost] = useState(Number(order.fuel_cost));
  const [tollCost, setTollCost] = useState(Number(order.toll_cost));
  const [driverCost, setDriverCost] = useState(Number(order.driver_cost));
  const [otherCosts, setOtherCosts] = useState(Number(order.other_costs));

  const totalCost = fuelCost + tollCost + driverCost + otherCosts;
  const profit = Number(order.amount_ht) - totalCost;

  const handleSave = async () => {
    await updateOrder.mutateAsync({
      id: order.id,
      fuel_cost: fuelCost,
      toll_cost: tollCost,
      driver_cost: driverCost,
      other_costs: otherCosts,
      total_cost: totalCost,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Calculator className="w-4 h-4 mr-1" /> Coûts</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Coûts - {order.order_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Carburant (MAD)</Label>
              <Input type="number" step="0.01" value={fuelCost} onChange={e => setFuelCost(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Péage (MAD)</Label>
              <Input type="number" step="0.01" value={tollCost} onChange={e => setTollCost(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Chauffeur (MAD)</Label>
              <Input type="number" step="0.01" value={driverCost} onChange={e => setDriverCost(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Autres frais (MAD)</Label>
              <Input type="number" step="0.01" value={otherCosts} onChange={e => setOtherCosts(Number(e.target.value))} />
            </div>
          </div>
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Revenu HT</span>
              <span className="font-medium">{Number(order.amount_ht).toFixed(2)} MAD</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Total coûts</span>
              <span className="font-medium text-destructive">-{totalCost.toFixed(2)} MAD</span>
            </div>
            <div className="border-t pt-2 flex justify-between text-base font-bold">
              <span>Marge</span>
              <span className={profit >= 0 ? 'text-success' : 'text-destructive'}>{profit.toFixed(2)} MAD</span>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={updateOrder.isPending}>Enregistrer</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
