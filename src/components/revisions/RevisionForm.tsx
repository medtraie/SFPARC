import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCreateRevision } from '@/hooks/useRevisions';
import { useGPSwoxVehicles } from '@/hooks/useGPSwoxVehicles';
import { supabase } from '@/integrations/supabase/client';
import { consumeInternalStock } from '@/services/stockService';
import { useEffect, useMemo, useState } from 'react';
import { getStockItems } from '@/services/stockService';
import { StockItem } from '@/types/stock';

const formSchema = z.object({
  vehicle_plate: z.string().min(1, 'Véhicule requis'),
  type: z.enum(['vidange', 'vignette', 'visite_technique', 'assurance', 'chaine_distribution', 'adblue', 'vidange_boite', 'autre_document']),
  mode: z.enum(['days', 'km']),
  interval_days: z.number().optional(),
  interval_km: z.number().optional(),
  last_date: z.string().optional(),
  last_km: z.number().optional(),
  current_km: z.number().optional(),
  reminder_km: z.number().optional(),
  file_url: z.string().optional(),
  notes: z.string().optional(),
  cost: z.number().min(0).optional(),
  garage_name: z.string().optional(),
  invoice_number: z.string().optional(),
  recurrence_enabled: z.boolean().default(true),
  stock_items: z.array(
    z.object({
      stockItemId: z.string().min(1),
      quantity: z.number().min(1),
    })
  ).optional(),
});

interface RevisionFormProps {
  onSuccess?: () => void;
}

export function RevisionForm({ onSuccess }: RevisionFormProps) {
  const createRevision = useCreateRevision();
  const { data: vehicles = [] } = useGPSwoxVehicles();
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [modeTab, setModeTab] = useState<'days' | 'km'>('days');
   const [internalStockItems, setInternalStockItems] = useState<StockItem[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vehicle_plate: '',
      type: 'vidange',
      mode: 'days',
      interval_days: 90,
      interval_km: 10000,
      reminder_km: 200,
      notes: '',
      stock_items: [],
      cost: 0,
      garage_name: '',
      invoice_number: '',
      recurrence_enabled: true,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'stock_items',
  });
  const selectedVehiclePlate = form.watch('vehicle_plate');
  const selectedMode = form.watch('mode');
  const selectedType = form.watch('type');

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.plate === selectedVehiclePlate),
    [vehicles, selectedVehiclePlate]
  );

  // Handle Type -> Mode logic
  useEffect(() => {
    if (selectedType === 'visite_technique' || selectedType === 'assurance' || selectedType === 'vignette') {
      if (selectedMode !== 'days') {
        form.setValue('mode', 'days', { shouldValidate: true });
        setModeTab('days');
      }
    } else if (selectedType === 'chaine_distribution' || selectedType === 'adblue' || selectedType === 'vidange_boite') {
      if (selectedMode !== 'km') {
        form.setValue('mode', 'km', { shouldValidate: true });
        setModeTab('km');
      }
    }
  }, [selectedType, selectedMode, form]);

  useEffect(() => {
    const loadInternalStock = async () => {
      try {
        const items = await getStockItems();
        const internal = items.filter((item) => item.stock_type === 'internal');
        setInternalStockItems(internal);
      } catch (error) {
        console.error('Error loading internal stock items for revisions', error);
      }
    };

    loadInternalStock();
  }, []);

  useEffect(() => {
    if (!selectedVehicle) return;
    if (selectedMode !== 'km') return;
    const mileage = Number(selectedVehicle.mileage || 0);
    if (Number.isNaN(mileage)) return;
    form.setValue('current_km', Math.max(0, Math.round(mileage)), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [selectedVehicle, selectedMode, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    let fileUrl = values.file_url || null;
    if (file) {
      setUploading(true);
      const safeName = file.name.replace(/[\\/:*?"<>|]/g, '-');
      const filePath = `revisions-docs/${values.vehicle_plate}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('revisions-docs')
        .upload(filePath, file, { cacheControl: '3600', upsert: true, contentType: file.type || undefined });
      if (!uploadError) {
        const { data } = supabase.storage.from('revisions-docs').getPublicUrl(filePath);
        fileUrl = data.publicUrl;
      }
      setUploading(false);
    }

    let next_due_date: string | null = null;
    let next_due_km: number | null = null;

    if (values.mode === 'days' && values.last_date && values.interval_days) {
      const d = new Date(values.last_date);
      d.setDate(d.getDate() + values.interval_days);
      next_due_date = d.toISOString().slice(0, 10);
    } else if (values.mode === 'km' && values.interval_km) {
      const baseKm = values.last_km ?? values.current_km ?? 0;
      next_due_km = baseKm + values.interval_km;
    }

    const stockItems = values.stock_items || [];

    for (const item of stockItems) {
      const quantity = item.quantity || 0;
      if (!item.stockItemId || quantity <= 0) continue;
      await consumeInternalStock(
        item.stockItemId,
        quantity,
        `Révision ${values.type} véhicule ${values.vehicle_plate}`
      );
    }

    await createRevision.mutateAsync({
      vehicle_id: selectedVehicle?.id ? String(selectedVehicle.id) : null,
      vehicle_plate: values.vehicle_plate,
      type: values.type,
      mode: values.mode,
      interval_days: values.mode === 'days' ? (values.interval_days || null) : null,
      interval_km: values.mode === 'km' ? (values.interval_km || null) : null,
      last_date: values.mode === 'days' ? (values.last_date || null) : null,
      last_km: values.mode === 'km' ? (values.last_km || null) : null,
      current_km: values.mode === 'km' ? (values.current_km || null) : null,
      reminder_km: values.mode === 'km' ? (values.reminder_km || null) : null,
      next_due_date,
      next_due_km,
      status: 'pending',
      file_url: fileUrl,
      notes: values.notes || null,
      cost: values.cost || null,
      garage_name: values.garage_name || null,
      invoice_number: values.invoice_number || null,
      recurrence_enabled: values.recurrence_enabled,
    });
    form.reset();
    onSuccess?.();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="vehicle_plate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Véhicule</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un véhicule" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.plate}>{v.plate} - {v.brand} {v.model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Type de révision" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="vidange">Vidange</SelectItem>
                    <SelectItem value="visite_technique">Visite technique</SelectItem>
                    <SelectItem value="assurance">Assurance</SelectItem>
                    <SelectItem value="vignette">Vignette</SelectItem>
                    <SelectItem value="chaine_distribution">Chaîne de distribution</SelectItem>
                    <SelectItem value="adblue">Adblue</SelectItem>
                    <SelectItem value="vidange_boite">Vidange boîte de vitesse</SelectItem>
                    <SelectItem value="autre_document">Autre</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="mode"
          render={({ field }) => {
            const isDaysOnly = selectedType === 'visite_technique' || selectedType === 'assurance' || selectedType === 'vignette';
            const isKmOnly = selectedType === 'chaine_distribution' || selectedType === 'adblue' || selectedType === 'vidange_boite';

            return (
              <FormItem>
                <FormLabel>Mode d'alerte</FormLabel>
                <Tabs value={modeTab} onValueChange={(v) => { 
                  if (isDaysOnly && v === 'km') return;
                  if (isKmOnly && v === 'days') return;
                  setModeTab(v as 'days' | 'km'); 
                  field.onChange(v); 
                }}>
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="days" disabled={isKmOnly}>Par jours</TabsTrigger>
                    <TabsTrigger value="km" disabled={isDaysOnly}>Par kilométrage</TabsTrigger>
                  </TabsList>
                <TabsContent value="days">
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <FormField
                      control={form.control}
                      name="interval_days"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Intervalle (jours)</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="last_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dernière date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="km">
                  <div className="grid grid-cols-2 gap-4 mt-3">
                      <FormField
                        control={form.control}
                        name="last_km"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Kilométrage dernier entretien</FormLabel>
                            <FormControl>
                              <Input type="number" min={0} step={1} {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="current_km"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Kilométrage actuel</FormLabel>
                            <FormControl>
                              <Input type="number" min={0} step={1} {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="interval_km"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Intervalle (km)</FormLabel>
                            <FormControl>
                              <Input type="number" min={100} step={100} {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="reminder_km"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Créer un rappel lorsqu'il reste (km)</FormLabel>
                            <FormControl>
                              <Input type="number" min={0} step={10} {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </FormItem>
            );
          }}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="cost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Coût (MAD)</FormLabel>
                <FormControl>
                  <Input type="number" min={0} {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="invoice_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>N° Facture</FormLabel>
                <FormControl>
                  <Input placeholder="FAC-2024-001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="garage_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prestataire / Garage</FormLabel>
                <FormControl>
                  <Input placeholder="Nom du garage" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="recurrence_enabled"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-6">
                <div className="space-y-0.5">
                  <FormLabel>Récurrence automatique</FormLabel>
                  <div className="text-[0.8rem] text-muted-foreground">
                    Créer automatiquement la prochaine échéance
                  </div>
                </div>
                <FormControl>
                  <Checkbox 
                    checked={field.value} 
                    onCheckedChange={field.onChange} 
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormItem>
            <FormLabel>Image (optionnel)</FormLabel>
            <FormControl>
              <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </FormControl>
            <FormMessage />
          </FormItem>
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea placeholder="Observations, référence, etc." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <FormLabel>Consommation stock interne (optionnel)</FormLabel>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ stockItemId: '', quantity: 1 })}
              disabled={internalStockItems.length === 0}
            >
              Ajouter
            </Button>
          </div>
          {fields.length > 0 && (
            <div className="space-y-2">
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-2">
                  <div className="col-span-7">
                    <FormField
                      control={form.control}
                      name={`stock_items.${index}.stockItemId`}
                      render={({ field: stockField }) => (
                        <FormItem>
                          <Select
                            value={stockField.value}
                            onValueChange={stockField.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner un article interne" />
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-3">
                    <FormField
                      control={form.control}
                      name={`stock_items.${index}.quantity`}
                      render={({ field: qtyField }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              {...qtyField}
                              onChange={(e) => qtyField.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-2 flex items-center justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button type="submit" disabled={createRevision.isPending || uploading} className="w-full">
          {(createRevision.isPending || uploading) ? 'Enregistrement...' : 'Ajouter la révision'}
        </Button>
      </form>
    </Form>
  );
}
