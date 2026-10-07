import { useMemo, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRentalFuelLogs, useRentalFuelLogMutations, useRentalVehicles } from '@/hooks/useRental';

const schema = z.object({
  vehicle_id: z.string().min(1),
  rental_id: z.string().optional().or(z.literal('')),
  log_date: z.string().min(10),
  liters: z.coerce.number().nonnegative(),
  fuel_price_total: z.coerce.number().nonnegative(),
  mileage: z.coerce.number().nonnegative().optional().or(z.nan()),
});

type Values = z.infer<typeof schema>;

export function RentalFuelLogs() {
  const vehiclesQ = useRentalVehicles();
  const logsQ = useRentalFuelLogs();
  const { create, remove } = useRentalFuelLogMutations();

  const [open, setOpen] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicle_id: '',
      rental_id: '',
      log_date: new Date().toISOString().slice(0, 10),
      liters: 0,
      fuel_price_total: 0,
      mileage: undefined as any,
    },
  });

  const rows = useMemo(() => logsQ.data || [], [logsQ.data]);

  const avgConsumption = useMemo(() => {
    const byVehicle = new Map<string, { liters: number; km: number }>();
    rows.forEach((r) => {
      if (!r.vehicle_id) return;
      const mileage = Number(r.mileage || 0);
      if (mileage <= 0) return;
      const curr = byVehicle.get(r.vehicle_id) || { liters: 0, km: 0 };
      byVehicle.set(r.vehicle_id, { liters: curr.liters + Number(r.liters || 0), km: curr.km + mileage });
    });
    const totals = Array.from(byVehicle.values()).reduce((acc, v) => ({ liters: acc.liters + v.liters, km: acc.km + v.km }), {
      liters: 0,
      km: 0,
    });
    if (totals.km <= 0) return null;
    return Number(((totals.liters / totals.km) * 100).toFixed(2));
  }, [rows]);

  const onSubmit = async (values: Values) => {
    try {
      await create.mutateAsync({
        vehicle_id: values.vehicle_id,
        rental_id: values.rental_id?.trim() ? values.rental_id.trim() : null,
        log_date: values.log_date,
        liters: values.liters,
        fuel_price_total: values.fuel_price_total,
        mileage: Number.isNaN(values.mileage as any) ? null : (values.mileage as any),
      } as any);
      setOpen(false);
      form.reset({
        vehicle_id: '',
        rental_id: '',
        log_date: new Date().toISOString().slice(0, 10),
        liters: 0,
        fuel_price_total: 0,
        mileage: undefined as any,
      });
    } catch (e: any) {
      toast.error(e?.message || 'Erreur lors de la création');
    }
  };

  return (
    <Card className="dashboard-panel">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Gestion Carburant</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Ajouter un plein</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
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
                    name="log_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
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
                        <FormLabel>Kilométrage (km)</FormLabel>
                        <FormControl>
                          <Input type="number" step="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="liters"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Litres</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fuel_price_total"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Montant total (MAD)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={create.isPending}>
                  Enregistrer
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {avgConsumption != null ? `Consommation moyenne (approx): ${avgConsumption} L/100km` : 'Consommation moyenne: -'}
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Véhicule</TableHead>
                <TableHead className="text-right">Litres</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="text-right">KM</TableHead>
                <TableHead className="w-[90px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsQ.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Aucun plein enregistré
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.log_date ? new Date(r.log_date).toLocaleDateString('fr-MA') : '-'}</TableCell>
                    <TableCell>{(r as any).vehicle?.registration || '-'}</TableCell>
                    <TableCell className="text-right">{Number(r.liters || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{Number(r.fuel_price_total || 0).toFixed(2)} MAD</TableCell>
                    <TableCell className="text-right">{r.mileage != null ? Number(r.mileage).toFixed(0) : '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="icon" onClick={() => remove.mutate(r.id)} disabled={remove.isPending}>
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

