import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { RentalVehicle, RentalVehicleInsert, RentalVehicleUpdate, useRentalVehicleMutations } from '@/hooks/useRental';

const schema = z.object({
  photo_url: z.string().url().optional().or(z.literal('')),
  brand: z.string().min(1),
  model: z.string().min(1),
  year: z.coerce.number().int().min(1900).max(2100).optional().or(z.nan()),
  registration: z.string().min(1),
  vehicle_type: z.enum(['suv', 'utilitaire', 'camion', 'voiture', 'car']).default('voiture'),
  fuel_capacity: z.coerce.number().nonnegative().optional().or(z.nan()),
  current_mileage: z.coerce.number().nonnegative().optional().or(z.nan()),
  price_per_day: z.coerce.number().nonnegative(),
  price_per_week: z.coerce.number().nonnegative().optional().or(z.nan()),
  price_per_month: z.coerce.number().nonnegative().optional().or(z.nan()),
  status: z.enum(['available', 'rented', 'maintenance']).default('available'),
  gps_imei: z.string().optional().or(z.literal('')),
  fuel_consumption: z.coerce.number().nonnegative().optional().or(z.nan()),
  insurance_company: z.string().optional().or(z.literal('')),
  insurance_expiry: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

type Values = z.infer<typeof schema>;

function cleanNumber(v: number | undefined) {
  if (typeof v !== 'number' || Number.isNaN(v)) return null;
  return v;
}

function cleanString(v: string | undefined) {
  if (!v) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export function RentalVehicleForm(props: {
  vehicle?: RentalVehicle | null;
  onDone: () => void;
}) {
  const { create, update } = useRentalVehicleMutations();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const defaultValues = useMemo<Values>(() => {
    const v = props.vehicle;
    return {
      photo_url: v?.photo_url || '',
      brand: v?.brand || '',
      model: v?.model || '',
      year: (v?.year ?? undefined) as any,
      registration: v?.registration || '',
      vehicle_type: (v?.vehicle_type as any) || 'voiture',
      fuel_capacity: (v?.fuel_capacity ?? undefined) as any,
      current_mileage: (v?.current_mileage ?? undefined) as any,
      price_per_day: Number(v?.price_per_day ?? 0),
      price_per_week: (v?.price_per_week ?? undefined) as any,
      price_per_month: (v?.price_per_month ?? undefined) as any,
      status: (v?.status as any) || 'available',
      gps_imei: v?.gps_imei || '',
      fuel_consumption: (v?.fuel_consumption ?? undefined) as any,
      insurance_company: v?.insurance_company || '',
      insurance_expiry: v?.insurance_expiry || '',
      notes: v?.notes || '',
    };
  }, [props.vehicle]);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
    setFile(null);
  }, [defaultValues, form]);

  const isSaving = create.isPending || update.isPending || uploading;

  const onSubmit = async (values: Values) => {
    try {
      let photoUrl = cleanString(values.photo_url) || null;

      if (file) {
        setUploading(true);
        const safeName = file.name.replace(/[\\/:*?"<>|]/g, '-');
        const filePath = `rental-vehicles/${values.registration}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('rental-assets')
          .upload(filePath, file, { cacheControl: '3600', upsert: true, contentType: file.type || undefined });

        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('rental-assets').getPublicUrl(filePath);
        photoUrl = data.publicUrl;
        setUploading(false);
      }

      const payloadBase = {
        photo_url: photoUrl,
        brand: values.brand,
        model: values.model,
        year: cleanNumber(values.year as any),
        registration: values.registration,
        vehicle_type: values.vehicle_type,
        fuel_capacity: cleanNumber(values.fuel_capacity as any),
        current_mileage: cleanNumber(values.current_mileage as any),
        price_per_day: values.price_per_day,
        price_per_week: cleanNumber(values.price_per_week as any) ?? 0,
        price_per_month: cleanNumber(values.price_per_month as any) ?? 0,
        status: values.status,
        gps_imei: cleanString(values.gps_imei),
        fuel_consumption: cleanNumber(values.fuel_consumption as any),
        insurance_company: cleanString(values.insurance_company),
        insurance_expiry: cleanString(values.insurance_expiry),
        notes: cleanString(values.notes),
      } satisfies Partial<RentalVehicleInsert>;

      if (props.vehicle?.id) {
        const updatePayload: RentalVehicleUpdate & { id: string } = { id: props.vehicle.id, ...payloadBase };
        await update.mutateAsync(updatePayload);
      } else {
        const insertPayload: RentalVehicleInsert = payloadBase as RentalVehicleInsert;
        await create.mutateAsync(insertPayload);
      }

      props.onDone();
    } catch (e: any) {
      setUploading(false);
      toast.error(e?.message || 'Erreur lors de l’enregistrement');
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">Photo du véhicule</div>
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Importer</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
            <FormField
              control={form.control}
              name="photo_url"
              render={({ field }) => (
                <FormItem className="mt-2">
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="brand"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Marque</FormLabel>
                <FormControl>
                  <Input placeholder="Toyota" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="model"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Modèle</FormLabel>
                <FormControl>
                  <Input placeholder="Hilux" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="year"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Année</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="2022" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="registration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Immatriculation</FormLabel>
                <FormControl>
                  <Input placeholder="12345-A-6" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="vehicle_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type véhicule</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="voiture">Voiture</SelectItem>
                    <SelectItem value="suv">SUV</SelectItem>
                    <SelectItem value="utilitaire">Utilitaire</SelectItem>
                    <SelectItem value="camion">Camion</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Statut</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="available">Disponible</SelectItem>
                    <SelectItem value="rented">Loué</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price_per_day"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prix par jour</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price_per_week"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prix par semaine</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price_per_month"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prix par mois</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" className="w-full justify-between">
              Options supplémentaires
              <ChevronDown className={`w-4 h-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                control={form.control}
                name="fuel_capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacité carburant</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="current_mileage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kilométrage actuel</FormLabel>
                    <FormControl>
                      <Input type="number" step="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gps_imei"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GPS tracker IMEI</FormLabel>
                    <FormControl>
                      <Input placeholder="356..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fuel_consumption"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consommation carburant (L/100)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="insurance_company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assurance</FormLabel>
                    <FormControl>
                      <Input placeholder="Wafa..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="insurance_expiry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date expiration assurance</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Button type="submit" className="w-full" disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enregistrement...
            </>
          ) : (
            'Enregistrer'
          )}
        </Button>
      </form>
    </Form>
  );
}

