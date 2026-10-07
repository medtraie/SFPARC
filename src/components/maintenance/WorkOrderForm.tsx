import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { WorkOrder } from '@/lib/mock-data';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useGPSwoxVehicles } from '@/hooks/useGPSwoxVehicles';
import { getStockItems } from '@/services/stockService';
import { StockItem } from '@/types/stock';

const partSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  quantity: z.coerce.number().min(1, 'Quantité requise'),
  unitPrice: z.coerce.number().min(0, 'Prix requis'),
  stockItemId: z.string().optional().nullable(),
});

const workOrderSchema = z.object({
  vehicleId: z.string().min(1, 'Véhicule requis'),
  type: z.enum(['preventive', 'corrective', 'inspection']),
  priority: z.enum(['low', 'medium', 'high']),
  description: z.string().min(1, 'Description requise'),
  diagnosis: z.string().optional(),
  garage: z.string().optional(),
  scheduledDate: z.string().min(1, 'Date requise'),
  laborCost: z.coerce.number().min(0),
  parts: z.array(partSchema),
  notes: z.string().optional(),
});

type WorkOrderFormData = z.infer<typeof workOrderSchema>;

interface WorkOrderFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrder?: WorkOrder;
  onSubmit: (data: WorkOrderFormData) => Promise<void> | void;
}

export function WorkOrderForm({ open, onOpenChange, workOrder, onSubmit }: WorkOrderFormProps) {
  const isEditing = !!workOrder;
  const [internalStockItems, setInternalStockItems] = useState<StockItem[]>([]);
  
  // Fetch real vehicles from GPSwox
  const { data: gpswoxVehicles = [], isLoading: vehiclesLoading } = useGPSwoxVehicles();
  
  const form = useForm<WorkOrderFormData>({
    resolver: zodResolver(workOrderSchema),
    defaultValues: {
      vehicleId: '',
      type: 'preventive',
      priority: 'medium',
      description: '',
      diagnosis: '',
      garage: '',
      scheduledDate: new Date().toISOString().split('T')[0],
      laborCost: 0,
      parts: [],
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'parts',
  });

  useEffect(() => {
    if (workOrder) {
      form.reset({
        vehicleId: workOrder.vehicleId,
        type: workOrder.type,
        priority: workOrder.priority,
        description: workOrder.description,
        diagnosis: workOrder.diagnosis || '',
        garage: workOrder.garage || '',
        scheduledDate: workOrder.scheduledDate,
        laborCost: workOrder.laborCost,
        parts: workOrder.parts.map((p) => ({
          ...p,
          stockItemId: null,
        })),
        notes: workOrder.notes || '',
      });
    } else {
      form.reset({
        vehicleId: '',
        type: 'preventive',
        priority: 'medium',
        description: '',
        diagnosis: '',
        garage: '',
        scheduledDate: new Date().toISOString().split('T')[0],
        laborCost: 0,
        parts: [],
        notes: '',
      });
    }
  }, [workOrder, form]);

  useEffect(() => {
    const loadInternalStock = async () => {
      try {
        const items = await getStockItems();
        const internal = items.filter((item) => item.stock_type === 'internal');
        setInternalStockItems(internal);
      } catch (error) {
        console.error('Error loading internal stock items', error);
      }
    };

    if (open) {
      loadInternalStock();
    }
  }, [open]);

  const parts = form.watch('parts');
  const laborCost = form.watch('laborCost') || 0;
  const partsCost = parts.reduce((acc, p) => acc + (p.quantity * p.unitPrice), 0);
  const totalCost = laborCost + partsCost;

  const handleSubmit = async (data: WorkOrderFormData) => {
    await onSubmit(data);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Modifier l\'ordre de travail' : 'Nouvel ordre de travail'}
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
                name="scheduledDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date prévue</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="preventive">Préventif</SelectItem>
                        <SelectItem value="corrective">Correctif</SelectItem>
                        <SelectItem value="inspection">Inspection</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priorité</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Faible</SelectItem>
                        <SelectItem value="medium">Moyenne</SelectItem>
                        <SelectItem value="high">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
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
                    <Textarea 
                      placeholder="Décrivez les travaux à effectuer..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="diagnosis"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Diagnostic (optionnel)</FormLabel>
                  <FormControl>
                    <Input placeholder="Diagnostic technique" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="garage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Garage (optionnel)</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom du garage" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="laborCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coût main d'œuvre (MAD)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Parts */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <FormLabel>Pièces</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ name: '', quantity: 1, unitPrice: 0 })}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter
                </Button>
              </div>
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 mb-2">
                  <div className="col-span-4">
                    <FormField
                      control={form.control}
                      name={`parts.${index}.stockItemId`}
                      render={({ field: stockField }) => (
                        <Select
                          value={stockField.value || ''}
                          onValueChange={(value) => {
                            stockField.onChange(value);
                            const selected = internalStockItems.find((item) => item.id === value);
                            if (selected) {
                              form.setValue(`parts.${index}.name`, selected.name);
                              form.setValue(`parts.${index}.unitPrice`, selected.unit_price);
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Stock interne" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {internalStockItems.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name} ({item.quantity} {item.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      placeholder="Nom de la pièce"
                      {...form.register(`parts.${index}.name`)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="Qté"
                      {...form.register(`parts.${index}.quantity`)}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      placeholder="Prix unitaire"
                      {...form.register(`parts.${index}.unitPrice`)}
                    />
                  </div>
                  <div className="col-span-12 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Remarques, instructions..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Total Cost */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between text-sm mb-2">
                <span>Main d'œuvre</span>
                <span>{laborCost.toLocaleString('fr-MA')} MAD</span>
              </div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span>Pièces</span>
                <span>{partsCost.toLocaleString('fr-MA')} MAD</span>
              </div>
              <div className="h-px bg-border my-2" />
              <div className="flex items-center justify-between font-bold">
                <span>Total</span>
                <span className="text-xl text-primary">{totalCost.toLocaleString('fr-MA')} MAD</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit">
                {isEditing ? 'Mettre à jour' : 'Créer'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
