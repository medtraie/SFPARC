import { useForm } from 'react-hook-form';
import { useInfractionMutation, Infraction, usePersonnelSelectOptions } from '@/hooks/usePersonnel';
import { useGPSwoxVehicles } from '@/hooks/useGPSwoxVehicles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect } from 'react';

const formSchema = z.object({
  personnel_id: z.string().min(1, 'Employé requis'),
  vehicle_id: z.string().optional(),
  infraction_date: z.string().min(1, 'Date requise'),
  infraction_type: z.string().min(1, 'Type requis'),
  location: z.string().optional(),
  amount: z.coerce.number().min(0, 'Montant invalide'),
  points_deducted: z.coerce.number().optional(),
  status: z.string().default('unpaid'),
  payment_date: z.string().optional(),
  notes: z.string().optional(),
});

interface InfractionFormProps {
  initialData?: Infraction;
  onSuccess: () => void;
  preselectedPersonnelId?: string;
}

export function InfractionForm({ initialData, onSuccess, preselectedPersonnelId }: InfractionFormProps) {
  const { createInfraction, updateInfraction } = useInfractionMutation();
  const { options: personnelOptions, resolvePersonnelId } = usePersonnelSelectOptions();
  const { data: gpswoxData } = useGPSwoxVehicles();
  const vehicles = gpswoxData || [];

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      personnel_id: preselectedPersonnelId || '',
      vehicle_id: '',
      infraction_date: '',
      infraction_type: '',
      location: '',
      amount: 0,
      points_deducted: 0,
      status: 'unpaid',
      payment_date: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        personnel_id: initialData.personnel_id,
        vehicle_id: initialData.vehicle_id || '',
        infraction_date: initialData.infraction_date,
        infraction_type: initialData.infraction_type,
        location: initialData.location || '',
        amount: initialData.amount,
        points_deducted: initialData.points_deducted || 0,
        status: initialData.status || 'unpaid',
        payment_date: initialData.payment_date || '',
        notes: initialData.notes || '',
      });
    } else if (preselectedPersonnelId) {
        form.setValue('personnel_id', preselectedPersonnelId);
    }
  }, [initialData, preselectedPersonnelId, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const personnelId = await resolvePersonnelId(values.personnel_id);
      const cleanValues = {
        ...values,
        personnel_id: personnelId,
        vehicle_id: values.vehicle_id && values.vehicle_id !== 'none' ? values.vehicle_id : null,
        points_deducted: values.points_deducted || null,
        payment_date: values.payment_date || null,
      };

      if (initialData) {
        await updateInfraction.mutateAsync({
          id: initialData.id,
          ...cleanValues,
        });
      } else {
        await createInfraction.mutateAsync(cleanValues);
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving infraction:', error);
    }
  };

  const isSubmitting = createInfraction.isPending || updateInfraction.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="personnel_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Employé</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!!initialData || !!preselectedPersonnelId}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un employé" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {personnelOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
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
              <FormItem>
                <FormLabel>Véhicule (optionnel)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un véhicule" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.plate}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="infraction_date"
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
            name="infraction_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type d'infraction</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Excès de vitesse" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Lieu</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Montant</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="points_deducted"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Points retirés</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Statut</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un statut" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="unpaid">Non payé</SelectItem>
                    <SelectItem value="paid">Payé</SelectItem>
                    <SelectItem value="contested">Contesté</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="payment_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date de paiement</FormLabel>
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
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Enregistrement...' : initialData ? 'Mettre à jour' : 'Ajouter'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
