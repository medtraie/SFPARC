import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, FileText } from 'lucide-react';
import { useCreateFacture, useChantiers, useVoyages, type Facture } from '@/hooks/useTransportBTP';

const factureSchema = z.object({
  facture_number: z.string().min(1, 'Le numéro de facture est requis'),
  client_name: z.string().min(1, 'Le nom du client est requis'),
  client_address: z.string().optional(),
  chantier_id: z.string().optional(),
  date_from: z.string().min(1, 'La date de début est requise'),
  date_to: z.string().min(1, 'La date de fin est requise'),
  tax_rate: z.string().default('20'),
  notes: z.string().optional(),
});

type FactureFormValues = z.infer<typeof factureSchema>;

interface FactureFormProps {
  onSuccess?: () => void;
}

export function FactureForm({ onSuccess }: FactureFormProps) {
  const [open, setOpen] = useState(false);
  const createFacture = useCreateFacture();
  const { data: chantiers = [] } = useChantiers();
  const { data: voyages = [] } = useVoyages();

  const form = useForm<FactureFormValues>({
    resolver: zodResolver(factureSchema),
    defaultValues: {
      facture_number: '',
      client_name: '',
      client_address: '',
      chantier_id: '',
      date_from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
      date_to: new Date().toISOString().split('T')[0],
      tax_rate: '20',
      notes: '',
    },
  });

  const watchedChantier = form.watch('chantier_id');
  const watchedDateFrom = form.watch('date_from');
  const watchedDateTo = form.watch('date_to');

  // Calculate totals based on selected chantier and date range
  const [calculatedTotals, setCalculatedTotals] = useState({
    totalTonnage: 0,
    totalTrips: 0,
    totalAmount: 0,
  });

  useEffect(() => {
    if (watchedDateFrom && watchedDateTo) {
      const filteredVoyages = voyages.filter((v) => {
        const voyageDate = new Date(v.voyage_date);
        const fromDate = new Date(watchedDateFrom);
        const toDate = new Date(watchedDateTo);
        
        const matchesChantier = !watchedChantier || watchedChantier === 'none' || 
          (v.trajet?.origin_chantier_id === watchedChantier || 
           v.trajet?.destination_chantier_id === watchedChantier);
        
        return voyageDate >= fromDate && voyageDate <= toDate && matchesChantier && v.status === 'completed';
      });

      const totalTonnage = filteredVoyages.reduce((sum, v) => sum + Number(v.tonnage), 0);
      const totalTrips = filteredVoyages.length;
      const totalAmount = filteredVoyages.reduce((sum, v) => {
        const pricePerTon = v.trajet?.price_per_ton || 0;
        return sum + (Number(v.tonnage) * Number(pricePerTon));
      }, 0);

      setCalculatedTotals({ totalTonnage, totalTrips, totalAmount });
    }
  }, [voyages, watchedChantier, watchedDateFrom, watchedDateTo]);

  // Generate facture number
  useEffect(() => {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    form.setValue('facture_number', `FAC-${year}${month}-${random}`);
  }, [open]);

  const onSubmit = async (values: FactureFormValues) => {
    const taxRate = parseFloat(values.tax_rate);
    const taxAmount = calculatedTotals.totalAmount * (taxRate / 100);
    const totalWithTax = calculatedTotals.totalAmount + taxAmount;

    const factureData: Omit<Facture, 'id' | 'created_at' | 'updated_at' | 'chantier'> = {
      facture_number: values.facture_number,
      client_name: values.client_name,
      client_address: values.client_address || null,
      chantier_id: values.chantier_id && values.chantier_id !== 'none' ? values.chantier_id : null,
      date_from: values.date_from,
      date_to: values.date_to,
      total_tonnage: calculatedTotals.totalTonnage,
      total_trips: calculatedTotals.totalTrips,
      total_amount: calculatedTotals.totalAmount,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total_with_tax: totalWithTax,
      status: 'draft',
      notes: values.notes || null,
    };

    await createFacture.mutateAsync(factureData);
    form.reset();
    setOpen(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle facture
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Créer une facture
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="facture_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>N° Facture *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="chantier_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chantier</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Tous les chantiers" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Tous les chantiers</SelectItem>
                        {chantiers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="client_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom du client *</FormLabel>
                  <FormControl>
                    <Input placeholder="Société ABC" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="client_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse du client</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Rue Exemple, Casablanca" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date_from"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Période du *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Au *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Calculated Totals Preview */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-sm">Aperçu calculé</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Voyages:</span>
                  <p className="font-semibold">{calculatedTotals.totalTrips}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tonnage:</span>
                  <p className="font-semibold">{calculatedTotals.totalTonnage.toFixed(2)} t</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Montant HT:</span>
                  <p className="font-semibold">{calculatedTotals.totalAmount.toFixed(2)} MAD</p>
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="tax_rate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Taux TVA (%)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Observations..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createFacture.isPending}>
                {createFacture.isPending ? 'Création...' : 'Créer la facture'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
