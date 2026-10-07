import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { StockItem, StockSupplier } from '@/types/stock';
import { getSuppliers } from '@/services/stockService';
import { toast } from 'sonner';

const stockSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  reference: z.string().min(1, 'Référence requise'),
  category: z.string().min(1, 'Catégorie requise'),
  quantity: z.coerce.number().min(0, 'Quantité invalide'),
  min_quantity: z.coerce.number().min(1, 'Quantité minimum requise'),
  unit: z.string().min(1, 'Unité requise'),
  unit_price: z.coerce.number().min(0, 'Prix invalide'),
  supplier_id: z.string().min(1, 'Fournisseur requis'),
  location: z.string().min(1, 'Emplacement requis'),
  stock_type: z.enum(['internal', 'external']).default('external'),
});

type StockFormData = z.infer<typeof stockSchema>;

interface StockFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stockItem?: StockItem;
  categories: { value: string; label: string }[];
  onSubmit: (data: any) => void;
}

export function StockForm({ open, onOpenChange, stockItem, categories, onSubmit }: StockFormProps) {
  const isEditing = !!stockItem;
  const [suppliers, setSuppliers] = useState<StockSupplier[]>([]);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const data = await getSuppliers();
        setSuppliers(data);
      } catch (error) {
        console.error('Error fetching suppliers:', error);
        toast.error('Erreur lors du chargement des fournisseurs');
      }
    };

    if (open) {
      fetchSuppliers();
    }
  }, [open]);

  const form = useForm<StockFormData>({
    resolver: zodResolver(stockSchema),
    defaultValues: {
      name: stockItem?.name || '',
      reference: stockItem?.reference || '',
      category: stockItem?.category || categories[0]?.value || 'pieces',
      quantity: stockItem?.quantity || 0,
      min_quantity: stockItem?.min_quantity || 5,
      unit: stockItem?.unit || 'unité',
      unit_price: stockItem?.unit_price || 0,
      supplier_id: stockItem?.supplier_id || '',
      location: stockItem?.location || '',
      stock_type: stockItem?.stock_type || 'external',
    },
  });

  // Reset form when stockItem changes
  useEffect(() => {
    if (stockItem) {
      form.reset({
        name: stockItem.name,
        reference: stockItem.reference || '',
        category: stockItem.category,
        quantity: stockItem.quantity,
        min_quantity: stockItem.min_quantity,
        unit: stockItem.unit,
        unit_price: stockItem.unit_price,
        supplier_id: stockItem.supplier_id || '',
        location: stockItem.location || '',
        stock_type: stockItem.stock_type || 'external',
      });
    } else {
      form.reset({
        name: '',
        reference: '',
        category: categories[0]?.value || 'pieces',
        quantity: 0,
        min_quantity: 5,
        unit: 'unité',
        unit_price: 0,
        supplier_id: '',
        location: '',
        stock_type: 'external',
      });
    }
  }, [stockItem, categories, form]);

  const handleSubmit = (data: StockFormData) => {
    let minQuantity = data.min_quantity;
    if (data.stock_type === 'internal') {
      const defaultMin = data.unit === 'L' ? 25 : 5;
      if (minQuantity < defaultMin) {
        minQuantity = defaultMin;
      }
    }
    onSubmit({ ...data, min_quantity: minQuantity });
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Modifier l\'article' : 'Nouvel article'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de l'article</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Filtre à huile" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Référence</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: FH-2024" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catégorie</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
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
                name="stock_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de stock</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="external">Externe</SelectItem>
                        <SelectItem value="internal">Interne</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantité</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="min_quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock min.</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unité</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="unité">Unité</SelectItem>
                        <SelectItem value="L">Litre</SelectItem>
                        <SelectItem value="kg">Kilogramme</SelectItem>
                        <SelectItem value="m">Mètre</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="unit_price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prix unitaire (MAD)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="supplier_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fournisseur</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un fournisseur" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
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
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emplacement</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Magasin A - Étagère 3" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Annuler
              </Button>
              <Button type="submit" className="flex-1">
                {isEditing ? 'Modifier' : 'Ajouter'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
