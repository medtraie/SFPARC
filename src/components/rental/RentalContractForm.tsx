import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { RentalContract, useRentalContractMutations, useRentalRentals } from '@/hooks/useRental';

const schema = z.object({
  rental_id: z.string().min(1),
  contract_number: z.string().optional().or(z.literal('')),
  lessor_name: z.string().optional().or(z.literal('')),
  lessor_phone: z.string().optional().or(z.literal('')),
  lessor_address: z.string().optional().or(z.literal('')),
  pickup_location: z.string().optional().or(z.literal('')),
  return_location: z.string().optional().or(z.literal('')),
  start_mileage: z.coerce.number().nonnegative().optional().or(z.nan()),
  end_mileage: z.coerce.number().nonnegative().optional().or(z.nan()),
  fuel_level_start: z.coerce.number().min(0).max(100).optional().or(z.nan()),
  fuel_level_end: z.coerce.number().min(0).max(100).optional().or(z.nan()),
  deposit_amount: z.coerce.number().nonnegative().optional().or(z.nan()),
  terms: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  signed: z.boolean().default(false),
});

type Values = z.infer<typeof schema>;

function safeJsonObject(v: any) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  return {};
}

function safeStringArray(v: any): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
}

function SignaturePad(props: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const width = 520;
    const height = 160;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    if (props.value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
      };
      img.src = props.value;
    }
  }, [props.value]);

  const getPoint = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const commit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    props.onChange(canvas.toDataURL('image/png'));
  };

  const clear = () => {
    props.onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label>Signature</Label>
        <Button type="button" variant="outline" size="sm" onClick={clear}>
          Effacer
        </Button>
      </div>
      <div className="rounded-md border bg-white p-2 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="touch-none"
          onPointerDown={(e) => {
            drawingRef.current = true;
            lastRef.current = getPoint(e);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drawingRef.current) return;
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (!canvas || !ctx) return;
            const p = getPoint(e);
            const last = lastRef.current;
            if (!last) {
              lastRef.current = p;
              return;
            }
            ctx.beginPath();
            ctx.moveTo(last.x, last.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            lastRef.current = p;
          }}
          onPointerUp={() => {
            drawingRef.current = false;
            lastRef.current = null;
            commit();
          }}
          onPointerCancel={() => {
            drawingRef.current = false;
            lastRef.current = null;
            commit();
          }}
        />
      </div>
    </div>
  );
}

export function RentalContractForm(props: {
  contract?: RentalContract | null;
  onDone: () => void;
}) {
  const rentalsQ = useRentalRentals();
  const { upsert } = useRentalContractMutations();

  const [departureFiles, setDepartureFiles] = useState<File[]>([]);
  const [returnFiles, setReturnFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [signature, setSignature] = useState<string | null>(props.contract?.signature_data_url || null);

  const defaultValues = useMemo<Values>(() => {
    const c = props.contract;
    const json = safeJsonObject(c?.contract_json);
    const photos = safeJsonObject(json.photos);
    const extra = safeJsonObject(json.extra);

    return {
      rental_id: c?.rental_id || '',
      contract_number: c?.contract_number || '',
      lessor_name: String((json.lessor as any)?.name || ''),
      lessor_phone: String((json.lessor as any)?.phone || ''),
      lessor_address: String((json.lessor as any)?.address || ''),
      pickup_location: String(extra.pickup_location || ''),
      return_location: String(extra.return_location || ''),
      start_mileage: Number(extra.start_mileage ?? NaN),
      end_mileage: Number(extra.end_mileage ?? NaN),
      fuel_level_start: Number(extra.fuel_level_start ?? NaN),
      fuel_level_end: Number(extra.fuel_level_end ?? NaN),
      deposit_amount: Number(extra.deposit_amount ?? NaN),
      terms: String(json.terms || ''),
      notes: String(json.notes || ''),
      signed: Boolean(c?.signed_at),
    };
  }, [props.contract]);

  const [departureUrls, setDepartureUrls] = useState<string[]>(() => {
    const json = safeJsonObject(props.contract?.contract_json);
    const photos = safeJsonObject(json.photos);
    return safeStringArray(photos.departure);
  });
  const [returnUrls, setReturnUrls] = useState<string[]>(() => {
    const json = safeJsonObject(props.contract?.contract_json);
    const photos = safeJsonObject(json.photos);
    return safeStringArray(photos.return);
  });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
    setSignature(props.contract?.signature_data_url || null);
    const json = safeJsonObject(props.contract?.contract_json);
    const photos = safeJsonObject(json.photos);
    setDepartureUrls(safeStringArray(photos.departure));
    setReturnUrls(safeStringArray(photos.return));
    setDepartureFiles([]);
    setReturnFiles([]);
  }, [defaultValues, form, props.contract]);

  const selectedRental = useMemo(() => {
    const id = form.watch('rental_id');
    return (rentalsQ.data || []).find((r) => r.id === id) || null;
  }, [form, rentalsQ.data]);

  const uploadFiles = async (rentalId: string, group: 'departure' | 'return', files: File[]) => {
    if (!files.length) return [];
    const urls: string[] = [];
    for (const f of files) {
      const safeName = f.name.replace(/[\\/:*?"<>|]/g, '-');
      const filePath = `rental-contracts/${rentalId}/${group}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage
        .from('rental-assets')
        .upload(filePath, f, { cacheControl: '3600', upsert: true, contentType: f.type || undefined });
      if (error) throw error;
      const { data } = supabase.storage.from('rental-assets').getPublicUrl(filePath);
      urls.push(data.publicUrl);
    }
    return urls;
  };

  const onSubmit = async (values: Values) => {
    try {
      setSaving(true);
      const rental = (rentalsQ.data || []).find((r) => r.id === values.rental_id);
      if (!rental) throw new Error('Location introuvable');

      const newDeparture = await uploadFiles(values.rental_id, 'departure', departureFiles);
      const newReturn = await uploadFiles(values.rental_id, 'return', returnFiles);

      const nextDepartureUrls = [...departureUrls, ...newDeparture];
      const nextReturnUrls = [...returnUrls, ...newReturn];

      const baseJson = safeJsonObject(props.contract?.contract_json);
      const lessor = {
        name: values.lessor_name?.trim() ? values.lessor_name.trim() : (baseJson.lessor as any)?.name || '',
        phone: values.lessor_phone?.trim() ? values.lessor_phone.trim() : (baseJson.lessor as any)?.phone || '',
        address: values.lessor_address?.trim() ? values.lessor_address.trim() : (baseJson.lessor as any)?.address || '',
      };

      const lessee = {
        name: rental.client?.full_name || '',
        phone: rental.client?.phone || '',
        email: rental.client?.email || '',
        address: rental.client?.address || '',
        driver_license_number: rental.client?.driver_license_number || '',
      };

      const vehicle = {
        registration: rental.vehicle?.registration || '',
        brand: rental.vehicle?.brand || '',
        model: rental.vehicle?.model || '',
        year: rental.vehicle?.year || null,
      };

      const extra = {
        pickup_location: values.pickup_location?.trim() ? values.pickup_location.trim() : null,
        return_location: values.return_location?.trim() ? values.return_location.trim() : null,
        start_mileage: Number.isNaN(values.start_mileage as any) ? null : Number(values.start_mileage),
        end_mileage: Number.isNaN(values.end_mileage as any) ? null : Number(values.end_mileage),
        fuel_level_start: Number.isNaN(values.fuel_level_start as any) ? null : Number(values.fuel_level_start),
        fuel_level_end: Number.isNaN(values.fuel_level_end as any) ? null : Number(values.fuel_level_end),
        deposit_amount: Number.isNaN(values.deposit_amount as any) ? null : Number(values.deposit_amount),
      };

      const contractJson: any = {
        ...baseJson,
        lessor,
        lessee,
        vehicle,
        rental: {
          rental_id: rental.id,
          rental_number: rental.rental_number,
          start_datetime: rental.start_datetime,
          end_datetime: rental.end_datetime,
          total_price: rental.total_price,
          status: rental.status,
        },
        photos: { departure: nextDepartureUrls, return: nextReturnUrls },
        extra,
        terms: values.terms?.trim() ? values.terms.trim() : null,
        notes: values.notes?.trim() ? values.notes.trim() : null,
      };

      const signedAt = values.signed ? props.contract?.signed_at || new Date().toISOString() : null;

      if (props.contract?.id) {
        await upsert.mutateAsync({
          id: props.contract.id,
          rental_id: values.rental_id,
          contract_json: contractJson,
          signature_data_url: signature,
          signed_at: signedAt,
        } as any);
      } else {
        await upsert.mutateAsync({
          rental_id: values.rental_id,
          contract_number: values.contract_number?.trim() ? values.contract_number.trim() : undefined,
          contract_json: contractJson,
          signature_data_url: signature,
          signed_at: signedAt,
        } as any);
      }

      toast.success('Contrat enregistré');
      props.onDone();
    } catch (e: any) {
      toast.error(e?.message || 'Erreur lors de l’enregistrement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <FormField
            control={form.control}
            name="rental_id"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Location</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une location" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(rentalsQ.data || []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.rental_number} — {r.client?.full_name || '-'} — {r.vehicle?.registration || '-'}
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
            name="contract_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Numéro (optionnel)</FormLabel>
                <FormControl>
                  <Input placeholder="CTR-..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <Label>Signé</Label>
            <div className="flex items-center gap-3">
              <FormField
                control={form.control}
                name="signed"
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <div className="text-sm text-muted-foreground">
                {form.watch('signed') ? 'Le contrat est marqué comme signé' : 'Brouillon'}
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-3 md:col-span-2">
            <div className="text-sm font-medium mb-2">Résumé</div>
            <div className="grid gap-2 md:grid-cols-4 text-sm">
              <div className="text-muted-foreground">Client</div>
              <div className="md:col-span-3">{selectedRental?.client?.full_name || '-'}</div>
              <div className="text-muted-foreground">Véhicule</div>
              <div className="md:col-span-3">{selectedRental?.vehicle?.registration || '-'} — {selectedRental?.vehicle?.brand || ''} {selectedRental?.vehicle?.model || ''}</div>
              <div className="text-muted-foreground">Période</div>
              <div className="md:col-span-3">
                {(selectedRental?.start_datetime || '').slice(0, 10)} → {(selectedRental?.end_datetime || '').slice(0, 10)}
              </div>
              <div className="text-muted-foreground">Total</div>
              <div className="md:col-span-3">{Number(selectedRental?.total_price || 0).toFixed(2)} MAD</div>
            </div>
          </div>

          <FormField
            control={form.control}
            name="lessor_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Loueur (nom)</FormLabel>
                <FormControl>
                  <Input placeholder="Agence / Loueur" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lessor_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Loueur (téléphone)</FormLabel>
                <FormControl>
                  <Input placeholder="+212 ..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lessor_address"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Loueur (adresse)</FormLabel>
                <FormControl>
                  <Input placeholder="Adresse" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="pickup_location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lieu de départ</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Casablanca" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="return_location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lieu de retour</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Rabat" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="start_mileage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Km départ</FormLabel>
                <FormControl>
                  <Input type="number" step="1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fuel_level_start"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Carburant départ (%)</FormLabel>
                <FormControl>
                  <Input type="number" step="1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="end_mileage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Km retour</FormLabel>
                <FormControl>
                  <Input type="number" step="1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fuel_level_end"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Carburant retour (%)</FormLabel>
                <FormControl>
                  <Input type="number" step="1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="deposit_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Caution (MAD)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <SignaturePad value={signature} onChange={setSignature} />

          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">Photos départ</div>
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Importer</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => setDepartureFiles(Array.from(e.target.files || []))}
                />
              </label>
            </div>
            {departureUrls.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-3">
                {departureUrls.map((u) => (
                  <div key={u} className="relative border rounded-md overflow-hidden">
                    <img src={u} alt="photo" className="w-full h-28 object-cover" />
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={() => setDepartureUrls((prev) => prev.filter((x) => x !== u))}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {departureFiles.length > 0 && (
              <div className="text-xs text-muted-foreground">{departureFiles.length} fichier(s) à uploader</div>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">Photos retour</div>
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Importer</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => setReturnFiles(Array.from(e.target.files || []))}
                />
              </label>
            </div>
            {returnUrls.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-3">
                {returnUrls.map((u) => (
                  <div key={u} className="relative border rounded-md overflow-hidden">
                    <img src={u} alt="photo" className="w-full h-28 object-cover" />
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={() => setReturnUrls((prev) => prev.filter((x) => x !== u))}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {returnFiles.length > 0 && (
              <div className="text-xs text-muted-foreground">{returnFiles.length} fichier(s) à uploader</div>
            )}
          </div>

          <FormField
            control={form.control}
            name="terms"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Conditions</FormLabel>
                <FormControl>
                  <Textarea rows={6} placeholder="Conditions générales..." {...field} />
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
                  <Textarea rows={4} placeholder="Notes..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={props.onDone}>
            Annuler
          </Button>
          <Button type="submit" disabled={saving || upsert.isPending}>
            {(saving || upsert.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </form>
    </Form>
  );
}
