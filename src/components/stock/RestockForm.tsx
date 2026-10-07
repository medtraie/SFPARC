import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StockItem } from '@/types/stock';
import { Package, AlertTriangle } from 'lucide-react';

const restockSchema = z.object({
  quantity: z.coerce.number().min(1, 'Quantité minimale de 1'),
  notes: z.string().optional(),
});

type RestockFormData = z.infer<typeof restockSchema>;

interface RestockFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stockItem: StockItem | null;
  onSubmit: (itemId: string, quantity: number, notes?: string) => void;
}

export function RestockForm({ open, onOpenChange, stockItem, onSubmit }: RestockFormProps) {
  const form = useForm<RestockFormData>({
    resolver: zodResolver(restockSchema),
    defaultValues: {
      quantity: stockItem ? Math.max(stockItem.min_quantity - stockItem.quantity + 5, 10) : 10,
      notes: '',
    },
  });

  const handleSubmit = (data: RestockFormData) => {
    if (stockItem) {
      onSubmit(stockItem.id, data.quantity, data.notes);
      onOpenChange(false);
      form.reset();
    }
  };

  if (!stockItem) return null;

  const isLowStock = stockItem.quantity <= stockItem.min_quantity;
  const suggestedQuantity = Math.max(stockItem.min_quantity - stockItem.quantity + 10, 10);
  const totalCost = (form.watch('quantity') || 0) * stockItem.unit_price;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Réapprovisionnement</DialogTitle>
        </DialogHeader>

        <div className="bg-muted/50 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-8 h-8 text-primary" />
            <div>
              <h3 className="font-semibold">{stockItem.name}</h3>
              <p className="text-sm text-muted-foreground">Réf: {stockItem.reference}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="text-center p-2 bg-background rounded">
              <p className="text-xs text-muted-foreground">Stock actuel</p>
              <p className={`text-lg font-bold ${isLowStock ? 'text-destructive' : 'text-foreground'}`}>
                {stockItem.quantity} {stockItem.unit}
              </p>
            </div>
            <div className="text-center p-2 bg-background rounded">
              <p className="text-xs text-muted-foreground">Stock min.</p>
              <p className="text-lg font-bold text-foreground">{stockItem.min_quantity} {stockItem.unit}</p>
            </div>
            <div className="text-center p-2 bg-background rounded">
              <p className="text-xs text-muted-foreground">Prix/unité</p>
              <p className="text-lg font-bold text-foreground">{stockItem.unit_price} MAD</p>
            </div>
          </div>

          {isLowStock && (
            <div className="flex items-center gap-2 mt-3 p-2 bg-destructive/10 rounded">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-xs text-destructive">Stock critique - réapprovisionnement urgent recommandé</span>
            </div>
          )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantité à commander</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Suggestion: {suggestedQuantity} {stockItem.unit}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="p-3 bg-primary/10 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Coût estimé:</span>
                <span className="text-lg font-bold text-primary">{totalCost.toFixed(2)} MAD</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-sm text-muted-foreground">Nouveau stock:</span>
                <span className="text-lg font-bold text-success">
                  {stockItem.quantity + (form.watch('quantity') || 0)} {stockItem.unit}
                </span>
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Ajouter une note pour cette commande..."
                      className="resize-none"
                      rows={2}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Annuler
              </Button>
              <Button type="submit" className="flex-1">
                Commander
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
