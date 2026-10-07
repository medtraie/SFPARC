import { useForm } from 'react-hook-form';
import { useMedicalVisitMutation, MedicalVisit, usePersonnelSelectOptions } from '@/hooks/usePersonnel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect } from 'react';

const formSchema = z.object({
  personnel_id: z.string().min(1, 'Employé requis'),
  visit_date: z.string().min(1, 'Date de visite requise'),
  visit_type: z.string().min(1, 'Type de visite requis'),
  fitness_status: z.string().default('completed'),
  next_visit_date: z.string().optional(),
  doctor_name: z.string().optional(),
  notes: z.string().optional(),
});

interface MedicalVisitFormProps {
  initialData?: MedicalVisit;
  onSuccess: () => void;
  preselectedPersonnelId?: string;
}

export function MedicalVisitForm({ initialData, onSuccess, preselectedPersonnelId }: MedicalVisitFormProps) {
  const { createVisit, updateVisit } = useMedicalVisitMutation();
  const { options: personnelOptions, resolvePersonnelId } = usePersonnelSelectOptions();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      personnel_id: preselectedPersonnelId || '',
      visit_date: '',
      visit_type: '',
      fitness_status: 'completed',
      next_visit_date: '',
      doctor_name: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        personnel_id: initialData.personnel_id,
        visit_date: initialData.visit_date,
        visit_type: initialData.visit_type,
        fitness_status: initialData.fitness_status || 'completed',
        next_visit_date: initialData.next_visit_date || '',
        doctor_name: initialData.doctor_name || '',
        notes: initialData.notes || '',
      });
    } else if (preselectedPersonnelId) {
        form.setValue('personnel_id', preselectedPersonnelId);
    }
  }, [initialData, preselectedPersonnelId, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const personnelId = await resolvePersonnelId(values.personnel_id);
      // Clean up empty strings for optional dates
      const cleanValues = {
        ...values,
        personnel_id: personnelId,
        next_visit_date: values.next_visit_date || null,
      };

      if (initialData) {
        await updateVisit.mutateAsync({
          id: initialData.id,
          ...cleanValues,
        });
      } else {
        await createVisit.mutateAsync(cleanValues);
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving medical visit:', error);
    }
  };

  const isSubmitting = createVisit.isPending || updateVisit.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="visit_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date de visite</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="visit_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type de visite</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Aptitude, Reprise..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="doctor_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Médecin</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fitness_status"
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
                    <SelectItem value="scheduled">Planifié</SelectItem>
                    <SelectItem value="completed">Effectué</SelectItem>
                    <SelectItem value="cancelled">Annulé</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="next_visit_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prochaine visite (optionnel)</FormLabel>
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
