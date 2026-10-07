import { useForm } from 'react-hook-form';
import { usePaymentMutation, useCashRegisters, useBankAccounts, type Payment, type PaymentInsert, type PaymentUpdate } from '@/hooks/useFinance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CashRegisterForm } from './CashRegisterForm';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';

const formSchema = z
  .object({
    payment_type: z.enum(['income', 'expense']),
    payment_method: z.enum(['cash', 'check', 'transfer', 'virement']),
    amount: z.coerce.number().min(0.01, 'Le montant doit être supérieur à 0'),
    payment_date: z.string().min(1, 'Date requise'),
    entity_name: z.string().min(1, "Nom de l'entité requis"),
    reference_number: z.string().optional(),
    cash_register_id: z.string().optional(),
    bank_account_id: z.string().optional(),
    status: z.enum(['pending', 'completed', 'cancelled']).optional(),
    category: z.string().optional(),
    subcategory: z.string().optional(),
    source_module: z.string().optional(),
    source_id: z.union([z.string().uuid('UUID invalide'), z.literal('')]).optional(),
    attachment_url: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.payment_method === 'cash' && !values.cash_register_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Caisse requise',
        path: ['cash_register_id'],
      });
    }
    if (values.payment_method !== 'cash' && !values.bank_account_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Compte bancaire requis',
        path: ['bank_account_id'],
      });
    }
  });

export type PaymentFormValues = z.infer<typeof formSchema>;

interface PaymentFormProps {
  onSuccess: () => void;
  initialValues?: Partial<PaymentFormValues>;
  payment?: Payment | null;
  fixedPaymentType?: 'income' | 'expense';
}

export function PaymentForm({ onSuccess, initialValues, payment, fixedPaymentType }: PaymentFormProps) {
  const { createPayment, updatePayment } = usePaymentMutation();
  const { data: cashRegisters = [] } = useCashRegisters();
  const { data: bankAccounts = [] } = useBankAccounts();
  const [isAddCaisseOpen, setIsAddCaisseOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      payment_type: fixedPaymentType || payment?.payment_type || 'expense',
      payment_method: 'cash',
      amount: 0,
      payment_date: new Date().toISOString().split('T')[0],
      entity_name: '',
      reference_number: '',
      status: 'completed',
      category: '',
      subcategory: '',
      source_module: '',
      source_id: '',
      attachment_url: '',
      notes: '',
      ...(payment
        ? {
            payment_method: payment.payment_method as any,
            amount: Number(payment.amount || 0),
            payment_date: payment.payment_date,
            entity_name: payment.entity_name || '',
            reference_number: payment.reference_number || '',
            cash_register_id: payment.cash_register_id || '',
            bank_account_id: payment.bank_account_id || '',
            status: (payment.status as any) || 'completed',
            category: (payment as any).category || '',
            subcategory: (payment as any).subcategory || '',
            source_module: (payment as any).source_module || '',
            source_id: (payment as any).source_id || '',
            attachment_url: (payment as any).attachment_url || '',
            notes: payment.notes || '',
          }
        : {}),
      ...(initialValues || {}),
    },
  });

  const paymentMethod = form.watch('payment_method');
  const paymentType = form.watch('payment_type');

  const expenseCategories = [
    'Carburant',
    'Maintenance',
    'Péage',
    'Assurance',
    'Bureau',
    'Dépôt',
    'Loyer',
    'Salaire',
    'Fournitures',
    'Autre',
  ];

  const incomeCategories = ['Vente', 'Prestation', 'Location', 'Remboursement', 'Autre'];

  const normalizeValues = (values: PaymentFormValues) => {
    const cleanText = (v?: string) => {
      const s = (v ?? '').trim();
      return s.length ? s : null;
    };

    const cleanId = (v?: string) => {
      const s = (v ?? '').trim();
      return s.length ? s : null;
    };

    return {
      ...values,
      reference_number: cleanText(values.reference_number ?? ''),
      category: cleanText(values.category ?? ''),
      subcategory: cleanText(values.subcategory ?? ''),
      source_module: cleanText(values.source_module ?? ''),
      source_id: cleanId(values.source_id ?? ''),
      attachment_url: cleanText(values.attachment_url ?? ''),
      notes: cleanText(values.notes ?? ''),
      cash_register_id: values.payment_method === 'cash' ? cleanId(values.cash_register_id ?? '') : null,
      bank_account_id: values.payment_method === 'cash' ? null : cleanId(values.bank_account_id ?? ''),
    } as any;
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const normalized = normalizeValues(values as PaymentFormValues);
      if (payment?.id) {
        const payload: PaymentUpdate & { id: string } = {
          id: payment.id,
          ...(normalized as any),
        };
        await updatePayment.mutateAsync(payload);
      } else {
        await createPayment.mutateAsync(normalized as PaymentInsert);
      }
      toast.success(payment?.id ? 'Paiement mis à jour' : 'Paiement enregistré');
      onSuccess();
    } catch (error) {
      const message =
        typeof error === 'object' && error && 'message' in error ? String((error as any).message) : 'Erreur lors de l’enregistrement';
      toast.error(message);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, () => toast.error('Veuillez corriger les champs requis'))}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-4">
          {!fixedPaymentType && (
            <FormField
              control={form.control}
              name="payment_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner le type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="income">Recette (Encaissement)</SelectItem>
                      <SelectItem value="expense">Dépense (Décaissement)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="payment_date"
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
        </div>

        <FormField
          control={form.control}
          name="entity_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Partenaire</FormLabel>
              <FormControl>
                <Input placeholder="Nom de l'entité" {...field} />
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
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="payment_method"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mode de paiement</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner le mode" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="cash">Espèces</SelectItem>
                    <SelectItem value="check">Chèque</SelectItem>
                    <SelectItem value="transfer">Virement</SelectItem>
                    <SelectItem value="virement">Virement</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {paymentMethod === 'cash' ? (
          <FormField
            control={form.control}
            name="cash_register_id"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Caisse</FormLabel>
                  <Dialog open={isAddCaisseOpen} onOpenChange={setIsAddCaisseOpen}>
                    <DialogTrigger asChild>
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                        <Plus className="h-3 w-3 mr-1" />
                        Nouvelle Caisse
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Ajouter une caisse</DialogTitle>
                      </DialogHeader>
                      <CashRegisterForm onSuccess={() => setIsAddCaisseOpen(false)} />
                    </DialogContent>
                  </Dialog>
                </div>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={cashRegisters.length === 0 ? "Aucune caisse disponible" : "Sélectionner la caisse"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {cashRegisters.map((reg) => (
                      <SelectItem key={reg.id} value={reg.id}>{reg.name} ({reg.current_balance} {reg.currency})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <FormField
            control={form.control}
            name="bank_account_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Compte Bancaire</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner le compte" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {bankAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.bank_name} - {acc.account_number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="reference_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Référence</FormLabel>
                <FormControl>
                  <Input placeholder="N° Chèque / Virement" {...field} />
                </FormControl>
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
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="completed">Validé</SelectItem>
                    <SelectItem value="cancelled">Annulé</SelectItem>
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
            name="category"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between gap-2">
                  <FormLabel>Catégorie</FormLabel>
                  <div className="hidden md:flex flex-wrap gap-1 justify-end">
                    {(paymentType === 'expense' ? expenseCategories : incomeCategories).slice(0, 6).map((c) => (
                      <Button
                        key={c}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => form.setValue('category', c, { shouldDirty: true, shouldValidate: true })}
                      >
                        {c}
                      </Button>
                    ))}
                  </div>
                </div>
                <FormControl>
                  <Select
                    onValueChange={(v) =>
                      form.setValue('category', v === '__none__' ? '' : v, { shouldDirty: true, shouldValidate: true })
                    }
                    value={field.value ? field.value : '__none__'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {(paymentType === 'expense' ? expenseCategories : incomeCategories).map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                      <SelectItem value="__none__">(Vide)</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <div className="md:hidden flex flex-wrap gap-1">
                  {(paymentType === 'expense' ? expenseCategories : incomeCategories).map((c) => (
                    <Button
                      key={c}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => form.setValue('category', c, { shouldDirty: true, shouldValidate: true })}
                    >
                      {c}
                    </Button>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="subcategory"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sous-catégorie</FormLabel>
                <FormControl>
                  <Input placeholder="Optionnel" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-between">
              Options avancées
              <span className="text-muted-foreground text-xs">
                {advancedOpen ? 'Masquer' : 'Afficher'}
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="source_module"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source (module)</FormLabel>
                    <FormControl>
                      <Input placeholder="tourism, tms, maintenance..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="source_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source (ID)</FormLabel>
                    <FormControl>
                      <Input placeholder="UUID optionnel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="attachment_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pièce jointe (URL)</FormLabel>
                  <FormControl>
                    <Input placeholder="Lien vers reçu/facture" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CollapsibleContent>
        </Collapsible>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={createPayment.isPending || updatePayment.isPending}>
            {createPayment.isPending || updatePayment.isPending ? 'Enregistrement...' : payment?.id ? 'Mettre à jour' : 'Enregistrer'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
