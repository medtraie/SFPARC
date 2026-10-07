import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useCreateTourismInvoice, useTourismClients, useTourismMissions, generateInvoiceNumber } from '@/hooks/useTourism';
import { Plus, Trash2, Calculator } from 'lucide-react';

const formSchema = z.object({
  client_id: z.string().min(1, 'Client requis'),
  mission_id: z.string().optional(),
  invoice_date: z.string().min(1, 'Date requise'),
  due_date: z.string().optional(),
  billing_type: z.enum(['flat', 'hourly', 'per_km', 'custom']),
  hours_worked: z.number().min(0).default(0),
  hourly_rate: z.number().min(0).default(0),
  kilometers: z.number().min(0).default(0),
  per_km_rate: z.number().min(0).default(0),
  flat_rate: z.number().min(0).default(0),
  tax_rate: z.number().min(0).max(100).default(20),
  notes: z.string().optional(),
});

interface CustomLine {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface InvoiceFormProps {
  onSuccess?: () => void;
}

export function InvoiceForm({ onSuccess }: InvoiceFormProps) {
  const createInvoice = useCreateTourismInvoice();
  const { data: clients } = useTourismClients();
  const { data: missions } = useTourismMissions();
  const [customLines, setCustomLines] = useState<CustomLine[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      invoice_date: new Date().toISOString().split('T')[0],
      billing_type: 'flat',
      hours_worked: 0,
      hourly_rate: 0,
      kilometers: 0,
      per_km_rate: 0,
      flat_rate: 0,
      tax_rate: 20,
    },
  });

  const billingType = form.watch('billing_type');
  const hoursWorked = form.watch('hours_worked');
  const hourlyRate = form.watch('hourly_rate');
  const kilometers = form.watch('kilometers');
  const perKmRate = form.watch('per_km_rate');
  const flatRate = form.watch('flat_rate');
  const taxRate = form.watch('tax_rate');

  // Calculate totals
  const calculateSubtotal = () => {
    switch (billingType) {
      case 'hourly':
        return hoursWorked * hourlyRate;
      case 'per_km':
        return kilometers * perKmRate;
      case 'flat':
        return flatRate;
      case 'custom':
        return customLines.reduce((sum, line) => sum + line.total, 0);
      default:
        return 0;
    }
  };

  const subtotal = calculateSubtotal();
  const taxAmount = subtotal * (taxRate / 100);
  const totalAmount = subtotal + taxAmount;

  const addCustomLine = () => {
    setCustomLines([...customLines, { description: '', quantity: 1, unit_price: 0, total: 0 }]);
  };

  const updateCustomLine = (index: number, field: keyof CustomLine, value: string | number) => {
    const updated = [...customLines];
    if (field === 'description') {
      updated[index].description = value as string;
    } else {
      updated[index][field] = Number(value);
      updated[index].total = updated[index].quantity * updated[index].unit_price;
    }
    setCustomLines(updated);
  };

  const removeCustomLine = (index: number) => {
    setCustomLines(customLines.filter((_, i) => i !== index));
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    await createInvoice.mutateAsync({
      invoice_number: generateInvoiceNumber(),
      client_id: values.client_id,
      mission_id: values.mission_id || null,
      invoice_date: values.invoice_date,
      due_date: values.due_date || null,
      billing_type: values.billing_type,
      hours_worked: values.hours_worked,
      hourly_rate: values.hourly_rate,
      kilometers: values.kilometers,
      per_km_rate: values.per_km_rate,
      flat_rate: values.flat_rate,
      custom_lines: customLines,
      subtotal,
      tax_rate: values.tax_rate,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      status: 'draft',
      notes: values.notes || null,
    });
    form.reset();
    setCustomLines([]);
    onSuccess?.();
  };

  const billingTypes = [
    { value: 'flat', label: 'Forfait' },
    { value: 'hourly', label: 'Tarif horaire' },
    { value: 'per_km', label: 'Prix au kilomètre' },
    { value: 'custom', label: 'Devis personnalisé' },
  ];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="client_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
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
            name="mission_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mission associée</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une mission" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {missions?.map((mission) => (
                      <SelectItem key={mission.id} value={mission.id}>
                        {mission.reference} - {mission.title}
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
            name="invoice_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date de facturation *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="due_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date d'échéance</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="billing_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type de facturation *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Type de facturation" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {billingTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Billing Type Specific Fields */}
        {billingType === 'hourly' && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="hours_worked"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Heures travaillées</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.5"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="hourly_rate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Taux horaire (MAD)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {billingType === 'per_km' && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="kilometers"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kilomètres</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="per_km_rate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prix/km (MAD)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {billingType === 'flat' && (
          <FormField
            control={form.control}
            name="flat_rate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Montant forfaitaire (MAD)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {billingType === 'custom' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Lignes de facturation</h4>
              <Button type="button" variant="outline" size="sm" onClick={addCustomLine}>
                <Plus className="w-4 h-4 mr-1" />
                Ajouter ligne
              </Button>
            </div>
            {customLines.map((line, index) => (
              <Card key={index}>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <label className="text-sm font-medium">Description</label>
                      <Input
                        value={line.description}
                        onChange={(e) => updateCustomLine(index, 'description', e.target.value)}
                        placeholder="Description du service"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium">Quantité</label>
                      <Input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => updateCustomLine(index, 'quantity', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium">Prix unit.</label>
                      <Input
                        type="number"
                        value={line.unit_price}
                        onChange={(e) => updateCustomLine(index, 'unit_price', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium">Total</label>
                      <Input type="number" value={line.total} readOnly className="bg-muted" />
                    </div>
                    <div className="col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCustomLine(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <FormField
          control={form.control}
          name="tax_rate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Taux TVA (%)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Totals */}
        <Card className="bg-muted/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="w-5 h-5" />
              <span className="font-medium">Récapitulatif</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sous-total HT</span>
                <span className="font-medium">{subtotal.toFixed(2)} MAD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">TVA ({taxRate}%)</span>
                <span className="font-medium">{taxAmount.toFixed(2)} MAD</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total TTC</span>
                <span className="text-primary">{totalAmount.toFixed(2)} MAD</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="Notes pour la facture..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={createInvoice.isPending} className="w-full">
          {createInvoice.isPending ? 'Création...' : 'Créer la facture'}
        </Button>
      </form>
    </Form>
  );
}
