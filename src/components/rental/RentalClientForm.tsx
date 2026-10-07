import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { RentalClient, RentalClientInsert, RentalClientUpdate, useRentalClientMutations } from '@/hooks/useRental';

const schema = z.object({
  full_name: z.string().min(1),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  driver_license_number: z.string().optional().or(z.literal('')),
  driver_license_expiry: z.string().optional().or(z.literal('')),
  driver_license_photo_url: z.string().url().optional().or(z.literal('')),
  id_document_url: z.string().url().optional().or(z.literal('')),
  security_deposit_amount: z.coerce.number().nonnegative().optional(),
  score: z.coerce.number().int().min(0).max(100).optional(),
  notes: z.string().optional().or(z.literal('')),
});

type Values = z.infer<typeof schema>;

function cleanString(v: string | undefined) {
  if (!v) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function cleanNumber(v: number | undefined) {
  if (typeof v !== 'number' || Number.isNaN(v)) return null;
  return v;
}

export function RentalClientForm(props: { client?: RentalClient | null; onDone: () => void }) {
  const { create, update } = useRentalClientMutations();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const defaultValues = useMemo<Values>(() => {
    const c = props.client;
    return {
      full_name: c?.full_name || '',
      phone: c?.phone || '',
      email: c?.email || '',
      address: c?.address || '',
      driver_license_number: c?.driver_license_number || '',
      driver_license_expiry: c?.driver_license_expiry || '',
      driver_license_photo_url: c?.driver_license_photo_url || '',
      id_document_url: c?.id_document_url || '',
      security_deposit_amount: Number(c?.security_deposit_amount ?? 0),
      score: Number(c?.score ?? 0),
      notes: c?.notes || '',
    };
  }, [props.client]);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
    setLicenseFile(null);
    setIdFile(null);
  }, [defaultValues, form]);

  const isSaving = create.isPending || update.isPending || uploading;

  const uploadToBucket = async (file: File, path: string) => {
    const { error: uploadError } = await supabase.storage
      .from('rental-assets')
      .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type || undefined });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('rental-assets').getPublicUrl(path);
    return data.publicUrl;
  };

  const onSubmit = async (values: Values) => {
    try {
      setUploading(true);

      let driverLicensePhotoUrl = cleanString(values.driver_license_photo_url);
      let idDocumentUrl = cleanString(values.id_document_url);

      if (licenseFile) {
        const safeName = licenseFile.name.replace(/[\\/:*?"<>|]/g, '-');
        const filePath = `rental-clients/${values.full_name}/${Date.now()}-permis-${safeName}`;
        driverLicensePhotoUrl = await uploadToBucket(licenseFile, filePath);
      }

      if (idFile) {
        const safeName = idFile.name.replace(/[\\/:*?"<>|]/g, '-');
        const filePath = `rental-clients/${values.full_name}/${Date.now()}-id-${safeName}`;
        idDocumentUrl = await uploadToBucket(idFile, filePath);
      }

      const payloadBase = {
        full_name: values.full_name,
        phone: cleanString(values.phone),
        email: cleanString(values.email),
        address: cleanString(values.address),
        driver_license_number: cleanString(values.driver_license_number),
        driver_license_expiry: cleanString(values.driver_license_expiry),
        driver_license_photo_url: driverLicensePhotoUrl,
        id_document_url: idDocumentUrl,
        security_deposit_amount: cleanNumber(values.security_deposit_amount) ?? 0,
        score: (cleanNumber(values.score) ?? 0) as any,
        notes: cleanString(values.notes),
      } satisfies Partial<RentalClientInsert>;

      if (props.client?.id) {
        const updatePayload: RentalClientUpdate & { id: string } = { id: props.client.id, ...payloadBase };
        await update.mutateAsync(updatePayload);
      } else {
        const insertPayload: RentalClientInsert = payloadBase as RentalClientInsert;
        await create.mutateAsync(insertPayload);
      }

      props.onDone();
    } catch (e: any) {
      toast.error(e?.message || 'Erreur lors de l’enregistrement');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Nom complet</FormLabel>
                <FormControl>
                  <Input placeholder="Nom Prénom" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Téléphone</FormLabel>
                <FormControl>
                  <Input placeholder="+212..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="client@email.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Adresse</FormLabel>
                <FormControl>
                  <Input placeholder="Ville, Quartier..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" className="w-full justify-between">
              Infos permis & documents
              <ChevronDown className={`w-4 h-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                control={form.control}
                name="driver_license_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numéro permis</FormLabel>
                    <FormControl>
                      <Input placeholder="DL-..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="driver_license_expiry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date expiration permis</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="md:col-span-2 grid gap-2 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">Photo permis</div>
                    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                      <Upload className="w-4 h-4" />
                      <span>Importer</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => setLicenseFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                  <FormField
                    control={form.control}
                    name="driver_license_photo_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">Carte nationale / passeport</div>
                    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                      <Upload className="w-4 h-4" />
                      <span>Importer</span>
                      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setIdFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                  <FormField
                    control={form.control}
                    name="id_document_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="security_deposit_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dépôt garantie</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Score client</FormLabel>
                    <FormControl>
                      <Input type="number" step="1" {...field} />
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

