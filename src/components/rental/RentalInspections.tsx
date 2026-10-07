import { useMemo, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useRentalInspections, useRentalInspectionMutations, useRentalRentals, useRentalVehicles } from '@/hooks/useRental';

const schema = z.object({
  rental_id: z.string().optional().or(z.literal('')),
  vehicle_id: z.string().min(1),
  inspection_type: z.enum(['pre', 'post']).default('pre'),
  fuel_level: z.coerce.number().min(0).max(100).optional().or(z.nan()),
  mileage: z.coerce.number().nonnegative().optional().or(z.nan()),
  checklist_json: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

type Values = z.infer<typeof schema>;

function parseJsonSafe(s: string) {
  const raw = (s || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function RentalInspections() {
  const rentalsQ = useRentalRentals();
  const vehiclesQ = useRentalVehicles();
  const inspectionsQ = useRentalInspections();
  const { create, remove } = useRentalInspectionMutations();

  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      rental_id: '',
      vehicle_id: '',
      inspection_type: 'pre',
      fuel_level: undefined as any,
      mileage: undefined as any,
      checklist_json: '',
      notes: '',
    },
  });

  const inspections = useMemo(() => inspectionsQ.data || [], [inspectionsQ.data]);

  const uploadPhotos = async (vehicleId: string) => {
    if (!files.length) return null;
    const urls: string[] = [];
    for (const f of files) {
      const safeName = f.name.replace(/[\\/:*?"<>|]/g, '-');
      const filePath = `rental-inspections/${vehicleId}/${Date.now()}-${safeName}`;
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
      setUploading(true);
      const photos = await uploadPhotos(values.vehicle_id);
      await create.mutateAsync({
        rental_id: values.rental_id?.trim() ? values.rental_id.trim() : null,
        vehicle_id: values.vehicle_id,
        inspection_type: values.inspection_type,
        fuel_level: Number.isNaN(values.fuel_level as any) ? null : (values.fuel_level as any),
        mileage: Number.isNaN(values.mileage as any) ? null : (values.mileage as any),
        checklist: parseJsonSafe(values.checklist_json),
        photos,
        notes: values.notes?.trim() ? values.notes.trim() : null,
      } as any);
      setOpen(false);
      setFiles([]);
      form.reset({
        rental_id: '',
        vehicle_id: '',
        inspection_type: 'pre',
        fuel_level: undefined as any,
        mileage: undefined as any,
        checklist_json: '',
        notes: '',
      });
    } catch (e: any) {
      toast.error(e?.message || 'Erreur lors de la création');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="dashboard-panel">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Inspection Véhicule</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nouvelle inspection
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Inspection (départ / retour)</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="inspection_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Choisir" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pre">Avant location</SelectItem>
                            <SelectItem value="post">Après location</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rental_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location (optionnel)</FormLabel>
                        <Select value={field.value || ''} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Choisir" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">Aucune</SelectItem>
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
                    name="vehicle_id"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Véhicule</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Choisir un véhicule" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(vehiclesQ.data || []).map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.registration} — {v.brand} {v.model}
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
                    name="fuel_level"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Niveau carburant (%)</FormLabel>
                        <FormControl>
                          <Input type="number" step="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="mileage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kilométrage</FormLabel>
                        <FormControl>
                          <Input type="number" step="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">Photos</div>
                    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                      <Upload className="w-4 h-4" />
                      <span>Importer</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => setFiles(Array.from(e.target.files || []))}
                      />
                    </label>
                  </div>
                  {files.length > 0 && (
                    <div className="text-xs text-muted-foreground">{files.length} fichier(s) sélectionné(s)</div>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="checklist_json"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Checklist (JSON)</FormLabel>
                      <FormControl>
                        <Textarea rows={5} placeholder='{"carrosserie":"ok","pneus":"ok","vitres":"ok"}' {...field} />
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
                        <Textarea rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={create.isPending || uploading}>
                  Enregistrer
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Véhicule</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Carburant</TableHead>
                <TableHead>KM</TableHead>
                <TableHead>Photos</TableHead>
                <TableHead className="w-[90px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inspectionsQ.isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : inspections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Aucune inspection
                  </TableCell>
                </TableRow>
              ) : (
                inspections.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.created_at ? new Date(i.created_at).toLocaleDateString('fr-MA') : '-'}</TableCell>
                    <TableCell>
                      {i.inspection_type === 'pre' ? (
                        <Badge className="bg-sky-600 hover:bg-sky-600">Avant</Badge>
                      ) : (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">Après</Badge>
                      )}
                    </TableCell>
                    <TableCell>{(i as any).vehicle?.registration || '-'}</TableCell>
                    <TableCell>{(i as any).rental?.rental_number || '-'}</TableCell>
                    <TableCell>{i.fuel_level != null ? `${Number(i.fuel_level).toFixed(0)}%` : '-'}</TableCell>
                    <TableCell>{i.mileage != null ? Number(i.mileage).toFixed(0) : '-'}</TableCell>
                    <TableCell>{Array.isArray(i.photos) ? `${i.photos.length}` : '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="icon" onClick={() => remove.mutate(i.id)} disabled={remove.isPending}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

