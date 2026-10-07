import { useForm } from 'react-hook-form';
import { useCashRegisterMutation, CashRegisterInsert } from '@/hooks/useFinance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const formSchema = z.object({
  name: z.string().min(1, 'Nom de la caisse requis'),
  description: z.string().optional(),
  initial_balance: z.coerce.number().min(0, 'Le solde initial doit être positif'),
  currency: z.string().default('MAD'),
});

interface CashRegisterFormProps {
  onSuccess: () => void;
}

export function CashRegisterForm({ onSuccess }: CashRegisterFormProps) {
  const { createRegister } = useCashRegisterMutation();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      initial_balance: 0,
      currency: 'MAD',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await createRegister.mutateAsync(values as CashRegisterInsert);
      onSuccess();
    } catch (error) {
      console.error('Error creating cash register:', error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom de la caisse</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Caisse Principale, Caisse Agence..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="initial_balance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Solde Initial</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Devise</FormLabel>
                <FormControl>
                  <Input {...field} readOnly />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optionnel)</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={createRegister.isPending}>
            {createRegister.isPending ? 'Création...' : 'Créer la caisse'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
