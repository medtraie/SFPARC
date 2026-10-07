import { useForm } from 'react-hook-form';
import { useDrivingLicenseMutation, DrivingLicense, usePersonnelSelectOptions } from '@/hooks/usePersonnel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect } from 'react';

const formSchema = z.object({
  personnel_id: z.string().min(1, 'Employé requis'),
  license_number: z.string().min(1, 'Numéro de permis requis'),
  categories: z.string().optional(),
  issue_date: z.string().optional(),
  expiry_date: z.string().min(1, 'Date d\'expiration requise'),
});

interface DrivingLicenseFormProps {
  initialData?: DrivingLicense;
  onSuccess: () => void;
  preselectedPersonnelId?: string;
}

export function DrivingLicenseForm({ initialData, onSuccess, preselectedPersonnelId }: DrivingLicenseFormProps) {
  const { createLicense, updateLicense } = useDrivingLicenseMutation();
  const { options: personnelOptions, resolvePersonnelId } = usePersonnelSelectOptions();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      personnel_id: preselectedPersonnelId || '',
      license_number: '',
      categories: '',
      issue_date: '',
      expiry_date: '',
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        personnel_id: initialData.personnel_id,
        license_number: initialData.license_number,
        categories: initialData.categories?.join(', ') || '',
        issue_date: initialData.issue_date || '',
        expiry_date: initialData.expiry_date,
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
        categories: values.categories
          ? values.categories.split(',').map((value) => value.trim()).filter(Boolean)
          : null,
        issue_date: values.issue_date || null,
      };

      if (initialData) {
        await updateLicense.mutateAsync({
          id: initialData.id,
          ...cleanValues,
        });
      } else {
        await createLicense.mutateAsync(cleanValues);
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving license:', error);
    }
  };

  const isSubmitting = createLicense.isPending || updateLicense.isPending;

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
            name="license_number"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Numéro de permis</FormLabel>
                <FormControl>
                    <Input {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />

            <FormField
            control={form.control}
            name="categories"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Catégories (A, B, C...)</FormLabel>
                <FormControl>
                    <Input {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="issue_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date de délivrance</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="expiry_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date d'expiration</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Enregistrement...' : initialData ? 'Mettre à jour' : 'Ajouter'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
