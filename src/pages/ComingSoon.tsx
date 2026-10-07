import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Construction, Download, FileText, Filter, KanbanSquare, Languages, Loader2, Pencil, Plus, QrCode, Receipt, ShoppingCart, Trash2, Truck, XCircle } from 'lucide-react';
import { useForm, useFieldArray, type Control, type FieldArrayWithId } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useTourismCompanyProfile } from '@/hooks/useTourismCompany';
import { supabase } from '@/integrations/supabase/client';
import {
  useApprovePurchaseOrder,
  useApprovePurchaseRequest,
  useCreateDeliveryNote,
  useCreatePurchaseOrder,
  useCreatePurchaseRequest,
  useCreateSupplier,
  useCreateSupplierInvoice,
  useAchatsAlerts,
  useAchatsDashboardKpis,
  useAchatsCashForecast,
  useAchatsSuppliers,
  useAchatsTopSuppliers,
  useBulkUpdatePurchaseOrdersStatus,
  useBulkUpdatePurchaseRequestsStatus,
  useBulkUpdateSupplierInvoicesStatus,
  useMarkDeliveryReceived,
  useMarkInvoicePaid,
  useRejectPurchaseOrder,
  useRejectPurchaseRequest,
  useSubmitPurchaseOrder,
  useSubmitPurchaseRequest,
  useDeleteDeliveryNote,
  useDeletePurchaseOrder,
  useDeletePurchaseRequest,
  useDeleteSupplier,
  useDeleteSupplierInvoice,
  useDeliveryNotesPaged,
  usePurchaseOrdersPaged,
  usePurchaseRequestsPaged,
  useSupplierInvoicesPaged,
  usePurchaseRequestItems,
  usePurchaseOrderItems,
  useDeliveryNoteItems,
  useSupplierInvoiceItems,
  useUpdateDeliveryNote,
  useUpdatePurchaseOrder,
  useUpdatePurchaseRequest,
  useUpdateSupplier,
  useUpdateSupplierInvoice,
  type AchatsSupplier,
  type DeliveryNote,
  type PurchaseOrder,
  type PurchaseRequest,
  type SupplierInvoice,
} from '@/hooks/useAchats';

interface ComingSoonPageProps {
  title: string;
  description: string;
}

export function ComingSoonPage({ title, description }: ComingSoonPageProps) {
  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-10rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Construction className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
          <p className="text-muted-foreground max-w-md">{description}</p>
        </div>
      </div>
    </DashboardLayout>
  );
}



export function FinancePage() {
  const { t } = useTranslation();
  return (
    <ComingSoonPage
      title={t('nav.finance')}
      description="Système de Point de Vente pour la gestion des transactions. En cours de développement."
    />
  );
}

const itemSchema = z.object({
  description: z.string().min(1, 'Description requise'),
  quantity: z.coerce.number().min(0.01, 'Quantité requise'),
  unit: z.string().min(1, 'Unité requise'),
  unit_price: z.coerce.number().min(0, 'Prix requis'),
});

type ItemFormValues = z.infer<typeof itemSchema>;

const purchaseRequestSchema = z.object({
  request_number: z.string().optional(),
  requester_name: z.string().optional(),
  supplier_name: z.string().optional(),
  supplier_id: z.string().optional(),
  request_date: z.string().min(1, 'Date requise'),
  needed_date: z.string().optional(),
  status: z.string().min(1, 'Statut requis'),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Au moins un article'),
});

const purchaseOrderSchema = z.object({
  order_number: z.string().optional(),
  supplier_name: z.string().min(1, 'Fournisseur requis'),
  supplier_id: z.string().optional(),
  request_id: z.string().optional(),
  order_date: z.string().min(1, 'Date requise'),
  expected_delivery_date: z.string().optional(),
  status: z.string().min(1, 'Statut requis'),
  tax_rate: z.coerce.number().min(0),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Au moins un article'),
});

const deliveryNoteSchema = z.object({
  delivery_number: z.string().optional(),
  supplier_name: z.string().min(1, 'Fournisseur requis'),
  supplier_id: z.string().optional(),
  order_number: z.string().optional(),
  order_id: z.string().optional(),
  delivery_date: z.string().min(1, 'Date requise'),
  status: z.string().min(1, 'Statut requis'),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Au moins un article'),
});

const supplierInvoiceSchema = z.object({
  invoice_number: z.string().optional(),
  supplier_name: z.string().min(1, 'Fournisseur requis'),
  supplier_id: z.string().optional(),
  order_id: z.string().optional(),
  delivery_id: z.string().optional(),
  invoice_date: z.string().min(1, 'Date requise'),
  due_date: z.string().optional(),
  status: z.string().min(1, 'Statut requis'),
  tax_rate: z.coerce.number().min(0),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Au moins un article'),
});

const supplierSchema = z.object({
  supplier_code: z.string().min(1, 'Code requis'),
  legal_name: z.string().min(1, 'Raison sociale requise'),
  trade_name: z.string().optional(),
  ice_if: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  payment_terms: z.string().optional(),
  payment_due_days: z.coerce.number().min(0),
});

type PurchaseRequestFormValues = z.infer<typeof purchaseRequestSchema>;
type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;
type DeliveryNoteFormValues = z.infer<typeof deliveryNoteSchema>;
type SupplierInvoiceFormValues = z.infer<typeof supplierInvoiceSchema>;
type SupplierFormValues = z.infer<typeof supplierSchema>;

function calculateItemsTotal(items: ItemFormValues[]) {
  return items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MAD', minimumFractionDigits: 2 }).format(value || 0);

const requestStatusLabels: Record<string, string> = {
  draft: 'Brouillon',
  submitted: 'Soumise',
  approved: 'Approuvée',
  rejected: 'Rejetée',
};

const orderStatusLabels: Record<string, string> = {
  draft: 'Brouillon',
  submitted: 'Soumis',
  approved: 'Approuvé',
  rejected: 'Rejeté',
  sent: 'Envoyé',
  received: 'Réceptionné',
  cancelled: 'Annulé',
};

const deliveryStatusLabels: Record<string, string> = {
  pending: 'En attente',
  partial: 'Partielle',
  received: 'Réceptionnée',
  cancelled: 'Annulée',
};

const invoiceStatusLabels: Record<string, string> = {
  draft: 'Brouillon',
  received: 'Reçue',
  paid: 'Payée',
  overdue: 'En retard',
  cancelled: 'Annulée',
};

function ItemsFields({
  control,
  fields,
  append,
  remove,
}: {
  control: Control<any>;
  fields: FieldArrayWithId<any, 'items', 'id'>[];
  append: (value: ItemFormValues) => void;
  remove: (index: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Articles</h4>
        <Button type="button" variant="outline" onClick={() => append({ description: '', quantity: 1, unit: 'u', unit_price: 0 })}>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un article
        </Button>
      </div>
      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-12 gap-3 items-end">
            <FormField
              control={control}
              name={`items.${index}.description`}
              render={({ field: formField }) => (
                <FormItem className="col-span-12 md:col-span-4">
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="Article" {...formField} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`items.${index}.quantity`}
              render={({ field: formField }) => (
                <FormItem className="col-span-4 md:col-span-2">
                  <FormLabel>Quantité</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...formField} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`items.${index}.unit`}
              render={({ field: formField }) => (
                <FormItem className="col-span-4 md:col-span-2">
                  <FormLabel>Unité</FormLabel>
                  <FormControl>
                    <Input placeholder="u" {...formField} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`items.${index}.unit_price`}
              render={({ field: formField }) => (
                <FormItem className="col-span-4 md:col-span-3">
                  <FormLabel>Prix unitaire</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...formField} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="col-span-12 md:col-span-1 flex md:justify-end">
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PurchaseRequestForm({
  open,
  onOpenChange,
  request,
  suppliers,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request?: PurchaseRequest | null;
  suppliers: AchatsSupplier[];
  onSubmit: (values: PurchaseRequestFormValues) => void;
}) {
  const form = useForm<PurchaseRequestFormValues>({
    resolver: zodResolver(purchaseRequestSchema),
    defaultValues: {
      request_number: '',
      requester_name: '',
      supplier_name: '',
      supplier_id: '',
      request_date: new Date().toISOString().split('T')[0],
      needed_date: '',
      status: 'draft',
      notes: '',
      items: [{ description: '', quantity: 1, unit: 'u', unit_price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  useEffect(() => {
    if (request) {
      form.reset({
        request_number: request.request_number,
        requester_name: request.requester_name || '',
        supplier_name: request.supplier_name || '',
        supplier_id: request.supplier_id || '',
        request_date: request.request_date,
        needed_date: request.needed_date || '',
        status: request.status,
        notes: request.notes || '',
        items: request.items?.length
          ? request.items.map(item => ({
              description: item.description,
              quantity: Number(item.quantity),
              unit: item.unit,
              unit_price: Number(item.unit_price),
            }))
          : [{ description: '', quantity: 1, unit: 'u', unit_price: 0 }],
      });
    } else {
      form.reset({
        request_number: '',
        requester_name: '',
        supplier_name: '',
        supplier_id: '',
        request_date: new Date().toISOString().split('T')[0],
        needed_date: '',
        status: 'draft',
        notes: '',
        items: [{ description: '', quantity: 1, unit: 'u', unit_price: 0 }],
      });
    }
  }, [request, form]);

  const items = form.watch('items');
  const totalAmount = calculateItemsTotal(items);

  const handleSubmit = (values: PurchaseRequestFormValues) => {
    onSubmit(values);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{request ? 'Modifier la demande d’achat' : 'Nouvelle demande d’achat'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="request_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numéro</FormLabel>
                    <FormControl>
                      <Input placeholder="Auto (DA-YYYY-XXXX)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="request_date"
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
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="requester_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Demandeur</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom du demandeur" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="supplier_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fournisseur</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom du fournisseur" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="supplier_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carte fournisseur</FormLabel>
                    <Select
                      value={field.value || 'none'}
                      onValueChange={(value) => {
                        const supplier = suppliers.find((item) => item.id === value);
                        field.onChange(value === 'none' ? '' : value);
                        if (supplier) form.setValue('supplier_name', supplier.legal_name);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.legal_name} ({supplier.supplier_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="needed_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date souhaitée</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Brouillon</SelectItem>
                        <SelectItem value="submitted">Soumise</SelectItem>
                        <SelectItem value="approved">Approuvée</SelectItem>
                        <SelectItem value="rejected">Rejetée</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <ItemsFields control={form.control} fields={fields} append={append} remove={remove} />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Notes ou remarques" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Total: {totalAmount.toFixed(2)} MAD</p>
              <Button type="submit">{request ? 'Mettre à jour' : 'Créer'}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function PurchaseOrderForm({
  open,
  onOpenChange,
  order,
  suppliers,
  availableRequests,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: PurchaseOrder | null;
  suppliers: AchatsSupplier[];
  availableRequests: PurchaseRequest[];
  onSubmit: (values: PurchaseOrderFormValues) => void;
}) {
  const form = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      order_number: '',
      supplier_name: '',
      supplier_id: '',
      request_id: '',
      order_date: new Date().toISOString().split('T')[0],
      expected_delivery_date: '',
      status: 'draft',
      tax_rate: 20,
      notes: '',
      items: [{ description: '', quantity: 1, unit: 'u', unit_price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  useEffect(() => {
    if (order) {
      form.reset({
        order_number: order.order_number,
        supplier_name: order.supplier_name,
        supplier_id: order.supplier_id || '',
        request_id: order.request_id || '',
        order_date: order.order_date,
        expected_delivery_date: order.expected_delivery_date || '',
        status: order.status,
        tax_rate: Number(order.tax_rate),
        notes: order.notes || '',
        items: order.items?.length
          ? order.items.map(item => ({
              description: item.description,
              quantity: Number(item.quantity),
              unit: item.unit,
              unit_price: Number(item.unit_price),
            }))
          : [{ description: '', quantity: 1, unit: 'u', unit_price: 0 }],
      });
    } else {
      form.reset({
        order_number: '',
        supplier_name: '',
        supplier_id: '',
        request_id: '',
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery_date: '',
        status: 'draft',
        tax_rate: 20,
        notes: '',
        items: [{ description: '', quantity: 1, unit: 'u', unit_price: 0 }],
      });
    }
  }, [order, form]);

  const items = form.watch('items');
  const subtotal = calculateItemsTotal(items);
  const taxRate = Number(form.watch('tax_rate') || 0);
  const taxAmount = subtotal * (taxRate / 100);
  const totalAmount = subtotal + taxAmount;

  const handleSubmit = (values: PurchaseOrderFormValues) => {
    onSubmit(values);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order ? 'Modifier le bon de commande' : 'Nouveau bon de commande'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="order_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numéro</FormLabel>
                    <FormControl>
                      <Input placeholder="Auto (BC-YYYY-XXXX)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="order_date"
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
            <div className="grid grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="supplier_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fournisseur</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom du fournisseur" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="supplier_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carte fournisseur</FormLabel>
                    <Select
                      value={field.value || 'none'}
                      onValueChange={(value) => {
                        const supplier = suppliers.find((item) => item.id === value);
                        field.onChange(value === 'none' ? '' : value);
                        if (supplier) form.setValue('supplier_name', supplier.legal_name);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.legal_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="request_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DA liée</FormLabel>
                    <Select value={field.value || 'none'} onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Aucune</SelectItem>
                        {availableRequests.map((request) => (
                          <SelectItem key={request.id} value={request.id}>
                            {request.request_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expected_delivery_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Livraison prévue</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Brouillon</SelectItem>
                        <SelectItem value="submitted">Soumis</SelectItem>
                        <SelectItem value="approved">Approuvé</SelectItem>
                        <SelectItem value="rejected">Rejeté</SelectItem>
                        <SelectItem value="sent">Envoyé</SelectItem>
                        <SelectItem value="received">Reçu</SelectItem>
                        <SelectItem value="cancelled">Annulé</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tax_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>TVA %</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <ItemsFields control={form.control} fields={fields} append={append} remove={remove} />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Notes ou remarques" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Sous-total: {subtotal.toFixed(2)} MAD • TVA: {taxAmount.toFixed(2)} MAD • Total: {totalAmount.toFixed(2)} MAD
              </p>
              <Button type="submit">{order ? 'Mettre à jour' : 'Créer'}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DeliveryNoteForm({
  open,
  onOpenChange,
  note,
  suppliers,
  availableOrders,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note?: DeliveryNote | null;
  suppliers: AchatsSupplier[];
  availableOrders: PurchaseOrder[];
  onSubmit: (values: DeliveryNoteFormValues) => void;
}) {
  const form = useForm<DeliveryNoteFormValues>({
    resolver: zodResolver(deliveryNoteSchema),
    defaultValues: {
      delivery_number: '',
      supplier_name: '',
      supplier_id: '',
      order_number: '',
      order_id: '',
      delivery_date: new Date().toISOString().split('T')[0],
      status: 'pending',
      notes: '',
      items: [{ description: '', quantity: 1, unit: 'u', unit_price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  useEffect(() => {
    if (note) {
      form.reset({
        delivery_number: note.delivery_number,
        supplier_name: note.supplier_name,
        supplier_id: note.supplier_id || '',
        order_number: note.order_number || '',
        order_id: note.order_id || '',
        delivery_date: note.delivery_date,
        status: note.status,
        notes: note.notes || '',
        items: note.items?.length
          ? note.items.map(item => ({
              description: item.description,
              quantity: Number(item.quantity),
              unit: item.unit,
              unit_price: Number(item.unit_price),
            }))
          : [{ description: '', quantity: 1, unit: 'u', unit_price: 0 }],
      });
    } else {
      form.reset({
        delivery_number: '',
        supplier_name: '',
        supplier_id: '',
        order_number: '',
        order_id: '',
        delivery_date: new Date().toISOString().split('T')[0],
        status: 'pending',
        notes: '',
        items: [{ description: '', quantity: 1, unit: 'u', unit_price: 0 }],
      });
    }
  }, [note, form]);

  const items = form.watch('items');
  const totalAmount = calculateItemsTotal(items);

  const handleSubmit = (values: DeliveryNoteFormValues) => {
    onSubmit(values);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{note ? 'Modifier le bon de livraison' : 'Nouveau bon de livraison'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="delivery_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numéro</FormLabel>
                    <FormControl>
                      <Input placeholder="Auto (BL-YYYY-XXXX)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="delivery_date"
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
            <div className="grid grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="supplier_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fournisseur</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom du fournisseur" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="supplier_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carte fournisseur</FormLabel>
                    <Select
                      value={field.value || 'none'}
                      onValueChange={(value) => {
                        const supplier = suppliers.find((item) => item.id === value);
                        field.onChange(value === 'none' ? '' : value);
                        if (supplier) form.setValue('supplier_name', supplier.legal_name);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.legal_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="order_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commande</FormLabel>
                    <FormControl>
                      <Input placeholder="Référence commande" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="order_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>BC lié</FormLabel>
                    <Select
                      value={field.value || 'none'}
                      onValueChange={(value) => {
                        const order = availableOrders.find((item) => item.id === value);
                        field.onChange(value === 'none' ? '' : value);
                        if (order) form.setValue('order_number', order.order_number || '');
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {availableOrders.map((order) => (
                          <SelectItem key={order.id} value={order.id}>
                            {order.order_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statut</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="partial">Partielle</SelectItem>
                      <SelectItem value="received">Reçue</SelectItem>
                      <SelectItem value="cancelled">Annulée</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <ItemsFields control={form.control} fields={fields} append={append} remove={remove} />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Notes ou remarques" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Total: {totalAmount.toFixed(2)} MAD</p>
              <Button type="submit">{note ? 'Mettre à jour' : 'Créer'}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function SupplierInvoiceForm({
  open,
  onOpenChange,
  invoice,
  suppliers,
  availableOrders,
  availableDeliveries,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: SupplierInvoice | null;
  suppliers: AchatsSupplier[];
  availableOrders: PurchaseOrder[];
  availableDeliveries: DeliveryNote[];
  onSubmit: (values: SupplierInvoiceFormValues) => void;
}) {
  const form = useForm<SupplierInvoiceFormValues>({
    resolver: zodResolver(supplierInvoiceSchema),
    defaultValues: {
      invoice_number: '',
      supplier_name: '',
      supplier_id: '',
      order_id: '',
      delivery_id: '',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: '',
      status: 'draft',
      tax_rate: 20,
      notes: '',
      items: [{ description: '', quantity: 1, unit: 'u', unit_price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  useEffect(() => {
    if (invoice) {
      form.reset({
        invoice_number: invoice.invoice_number,
        supplier_name: invoice.supplier_name,
        supplier_id: invoice.supplier_id || '',
        order_id: invoice.order_id || '',
        delivery_id: invoice.delivery_id || '',
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date || '',
        status: invoice.status,
        tax_rate: Number(invoice.tax_rate),
        notes: invoice.notes || '',
        items: invoice.items?.length
          ? invoice.items.map(item => ({
              description: item.description,
              quantity: Number(item.quantity),
              unit: item.unit,
              unit_price: Number(item.unit_price),
            }))
          : [{ description: '', quantity: 1, unit: 'u', unit_price: 0 }],
      });
    } else {
      form.reset({
        invoice_number: '',
        supplier_name: '',
        supplier_id: '',
        order_id: '',
        delivery_id: '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        status: 'draft',
        tax_rate: 20,
        notes: '',
        items: [{ description: '', quantity: 1, unit: 'u', unit_price: 0 }],
      });
    }
  }, [invoice, form]);

  const items = form.watch('items');
  const subtotal = calculateItemsTotal(items);
  const taxRate = Number(form.watch('tax_rate') || 0);
  const taxAmount = subtotal * (taxRate / 100);
  const totalAmount = subtotal + taxAmount;

  const handleSubmit = (values: SupplierInvoiceFormValues) => {
    onSubmit(values);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{invoice ? 'Modifier la facture fournisseur' : 'Nouvelle facture fournisseur'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="invoice_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numéro</FormLabel>
                    <FormControl>
                      <Input placeholder="Auto (FF-YYYY-XXXX)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="invoice_date"
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
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="supplier_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fournisseur</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom du fournisseur" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Échéance</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="supplier_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carte fournisseur</FormLabel>
                    <Select
                      value={field.value || 'none'}
                      onValueChange={(value) => {
                        const supplier = suppliers.find((item) => item.id === value);
                        field.onChange(value === 'none' ? '' : value);
                        if (supplier) form.setValue('supplier_name', supplier.legal_name);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.legal_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Brouillon</SelectItem>
                        <SelectItem value="received">Reçue</SelectItem>
                        <SelectItem value="paid">Payée</SelectItem>
                        <SelectItem value="overdue">En retard</SelectItem>
                        <SelectItem value="cancelled">Annulée</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tax_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>TVA %</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="order_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>BC liée</FormLabel>
                    <Select value={field.value || 'none'} onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Aucune</SelectItem>
                        {availableOrders.map((order) => (
                          <SelectItem key={order.id} value={order.id}>
                            {order.order_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="delivery_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>BL liée</FormLabel>
                    <Select value={field.value || 'none'} onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Aucune</SelectItem>
                        {availableDeliveries.map((delivery) => (
                          <SelectItem key={delivery.id} value={delivery.id}>
                            {delivery.delivery_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
            <ItemsFields control={form.control} fields={fields} append={append} remove={remove} />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Notes ou remarques" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Sous-total: {subtotal.toFixed(2)} MAD • TVA: {taxAmount.toFixed(2)} MAD • Total: {totalAmount.toFixed(2)} MAD
              </p>
              <Button type="submit">{invoice ? 'Mettre à jour' : 'Créer'}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function SupplierForm({
  open,
  onOpenChange,
  supplier,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: AchatsSupplier | null;
  onSubmit: (values: SupplierFormValues) => void;
}) {
  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      supplier_code: '',
      legal_name: '',
      trade_name: '',
      ice_if: '',
      email: '',
      phone: '',
      address: '',
      payment_terms: '',
      payment_due_days: 30,
    },
  });

  useEffect(() => {
    if (supplier) {
      form.reset({
        supplier_code: supplier.supplier_code,
        legal_name: supplier.legal_name,
        trade_name: supplier.trade_name || '',
        ice_if: supplier.ice_if || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
        payment_terms: supplier.payment_terms || '',
        payment_due_days: Number(supplier.payment_due_days || 30),
      });
    } else {
      form.reset({
        supplier_code: '',
        legal_name: '',
        trade_name: '',
        ice_if: '',
        email: '',
        phone: '',
        address: '',
        payment_terms: '',
        payment_due_days: 30,
      });
    }
  }, [supplier, form]);

  const handleSubmit = (values: SupplierFormValues) => {
    onSubmit(values);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{supplier ? 'Modifier fournisseur' : 'Nouveau fournisseur'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="supplier_code" render={({ field }) => (
                <FormItem><FormLabel>Code</FormLabel><FormControl><Input placeholder="SUP-001" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="legal_name" render={({ field }) => (
                <FormItem><FormLabel>Raison sociale</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="trade_name" render={({ field }) => (
                <FormItem><FormLabel>Nom commercial</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="ice_if" render={({ field }) => (
                <FormItem><FormLabel>ICE/IF</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Téléphone</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="payment_terms" render={({ field }) => (
                <FormItem><FormLabel>Conditions</FormLabel><FormControl><Input placeholder="Virement 30j" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="payment_due_days" render={({ field }) => (
                <FormItem><FormLabel>Échéance (jours)</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem><FormLabel>Adresse</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
            )} />
            <div className="flex justify-end">
              <Button type="submit">{supplier ? 'Mettre à jour' : 'Créer'}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function AchatsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: companyProfile } = useTourismCompanyProfile();
  const pageSize = 25;
  const [reqPage, setReqPage] = useState(1);
  const [ordPage, setOrdPage] = useState(1);
  const [delPage, setDelPage] = useState(1);
  const [invPage, setInvPage] = useState(1);
  const [requestOpen, setRequestOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [requestSearch, setRequestSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [deliverySearch, setDeliverySearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [editingRequest, setEditingRequest] = useState<PurchaseRequest | null>(null);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [editingDelivery, setEditingDelivery] = useState<DeliveryNote | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<SupplierInvoice | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<AchatsSupplier | null>(null);
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const { data: reqRes, isLoading: loadingRequests } = usePurchaseRequestsPaged(reqPage, pageSize);
  const { data: ordRes, isLoading: loadingOrders } = usePurchaseOrdersPaged(ordPage, pageSize);
  const { data: delRes, isLoading: loadingDeliveries } = useDeliveryNotesPaged(delPage, pageSize);
  const { data: invRes, isLoading: loadingInvoices } = useSupplierInvoicesPaged(invPage, pageSize);
  const { data: suppliers = [], isLoading: loadingSuppliers } = useAchatsSuppliers();
  const { data: dashboardKpis } = useAchatsDashboardKpis();
  const { data: achatsAlerts = [] } = useAchatsAlerts();
  const { data: cashForecast = [] } = useAchatsCashForecast();
  const { data: topSuppliers = [] } = useAchatsTopSuppliers();
  const requests = reqRes?.data || [];
  const orders = ordRes?.data || [];
  const deliveries = delRes?.data || [];
  const invoices = invRes?.data || [];
  const totalRequests = reqRes?.count || 0;
  const totalOrders = ordRes?.count || 0;
  const totalDeliveries = delRes?.count || 0;
  const totalInvoices = invRes?.count || 0;
  const createRequest = useCreatePurchaseRequest();
  const updateRequest = useUpdatePurchaseRequest();
  const deleteRequest = useDeletePurchaseRequest();
  const createOrder = useCreatePurchaseOrder();
  const updateOrder = useUpdatePurchaseOrder();
  const deleteOrder = useDeletePurchaseOrder();
  const createDelivery = useCreateDeliveryNote();
  const updateDelivery = useUpdateDeliveryNote();
  const deleteDelivery = useDeleteDeliveryNote();
  const createInvoice = useCreateSupplierInvoice();
  const updateInvoice = useUpdateSupplierInvoice();
  const deleteInvoice = useDeleteSupplierInvoice();
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();
  const submitRequest = useSubmitPurchaseRequest();
  const approveRequest = useApprovePurchaseRequest();
  const rejectRequest = useRejectPurchaseRequest();
  const submitOrder = useSubmitPurchaseOrder();
  const approveOrder = useApprovePurchaseOrder();
  const rejectOrder = useRejectPurchaseOrder();
  const markDeliveryReceived = useMarkDeliveryReceived();
  const markInvoicePaid = useMarkInvoicePaid();
  const bulkRequests = useBulkUpdatePurchaseRequestsStatus();
  const bulkOrders = useBulkUpdatePurchaseOrdersStatus();
  const bulkInvoices = useBulkUpdateSupplierInvoicesStatus();
  const { data: editingRequestItems = [] } = usePurchaseRequestItems(editingRequest?.id || null);
  const { data: editingOrderItems = [] } = usePurchaseOrderItems(editingOrder?.id || null);
  const { data: editingDeliveryItems = [] } = useDeliveryNoteItems(editingDelivery?.id || null);
  const { data: editingInvoiceItems = [] } = useSupplierInvoiceItems(editingInvoice?.id || null);

  const requestStatusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    draft: 'secondary',
    submitted: 'default',
    approved: 'outline',
    rejected: 'destructive',
  };
  const orderStatusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    draft: 'secondary',
    submitted: 'default',
    approved: 'outline',
    rejected: 'destructive',
    sent: 'default',
    received: 'outline',
    cancelled: 'destructive',
  };
  const deliveryStatusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'secondary',
    partial: 'default',
    received: 'outline',
    cancelled: 'destructive',
  };
  const invoiceStatusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    draft: 'secondary',
    received: 'default',
    paid: 'outline',
    overdue: 'destructive',
    cancelled: 'destructive',
  };

  const requestsAmount = requests.reduce((sum, request) => sum + Number(request.total_amount || 0), 0);
  const ordersAmount = orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const deliveriesAmount = deliveries.reduce((sum, delivery) => sum + Number(delivery.total_amount || 0), 0);
  const invoicesAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0);
  const overdueInvoices = invoices.filter((invoice) => invoice.status === 'overdue').length;
  const filteredRequests = requests.filter((request) => {
    const query = requestSearch.trim().toLowerCase();
    if (!query) return true;
    return [request.request_number, request.requester_name, request.supplier_name, request.status].some((value) =>
      String(value || '').toLowerCase().includes(query)
    );
  });
  const filteredOrders = orders.filter((order) => {
    const query = orderSearch.trim().toLowerCase();
    if (!query) return true;
    return [order.order_number, order.supplier_name, order.status].some((value) =>
      String(value || '').toLowerCase().includes(query)
    );
  });
  const filteredDeliveries = deliveries.filter((delivery) => {
    const query = deliverySearch.trim().toLowerCase();
    if (!query) return true;
    return [delivery.delivery_number, delivery.supplier_name, delivery.status].some((value) =>
      String(value || '').toLowerCase().includes(query)
    );
  });
  const filteredInvoices = invoices.filter((invoice) => {
    const query = invoiceSearch.trim().toLowerCase();
    if (!query) return true;
    return [invoice.invoice_number, invoice.supplier_name, invoice.status].some((value) =>
      String(value || '').toLowerCase().includes(query)
    );
  });
  const filteredSuppliers = suppliers.filter((supplier) => {
    const query = supplierSearch.trim().toLowerCase();
    if (!query) return true;
    return [supplier.supplier_code, supplier.legal_name, supplier.trade_name, supplier.ice_if].some((value) =>
      String(value || '').toLowerCase().includes(query)
    );
  });

  const requestsCount = Number(dashboardKpis?.requests_count || totalRequests);
  const ordersCount = Number(dashboardKpis?.orders_count || totalOrders);
  const deliveriesCount = Number(dashboardKpis?.deliveries_count || totalDeliveries);
  const invoicesCount = Number(dashboardKpis?.invoices_count || totalInvoices);
  const overdueInvoicesCount = Number(dashboardKpis?.overdue_invoices || overdueInvoices);
  const requestsTotalAmount = Number(dashboardKpis?.requests_total_amount || requestsAmount);
  const ordersTotalAmount = Number(dashboardKpis?.orders_total_amount || ordersAmount);
  const deliveriesTotalAmount = Number(dashboardKpis?.deliveries_total_amount || deliveriesAmount);
  const invoicesTotalAmount = Number(dashboardKpis?.invoices_total_amount || invoicesAmount);

  const loadItemsForExport = async (documentType: 'request' | 'order' | 'delivery' | 'invoice', documentId: string) => {
    if (documentType === 'request') {
      const { data, error } = await supabase
        .from('achats_purchase_request_items')
        .select('description, quantity, unit, unit_price, total_price')
        .eq('request_id', documentId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }
    if (documentType === 'order') {
      const { data, error } = await supabase
        .from('achats_purchase_order_items')
        .select('description, quantity, unit, unit_price, total_price')
        .eq('order_id', documentId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }
    if (documentType === 'delivery') {
      const { data, error } = await supabase
        .from('achats_delivery_note_items')
        .select('description, quantity, unit, unit_price, total_price')
        .eq('delivery_id', documentId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }
    const { data, error } = await supabase
      .from('achats_supplier_invoice_items')
      .select('description, quantity, unit, unit_price, total_price')
      .eq('invoice_id', documentId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  };

  const exportDocumentPdf = async (
    documentType: 'request' | 'order' | 'delivery' | 'invoice',
    document:
      | Pick<PurchaseRequest, 'id' | 'request_number' | 'request_date' | 'supplier_name' | 'status' | 'total_amount'>
      | Pick<PurchaseOrder, 'id' | 'order_number' | 'order_date' | 'supplier_name' | 'status' | 'total_amount'>
      | Pick<DeliveryNote, 'id' | 'delivery_number' | 'delivery_date' | 'supplier_name' | 'status' | 'total_amount'>
      | Pick<SupplierInvoice, 'id' | 'invoice_number' | 'invoice_date' | 'supplier_name' | 'status' | 'total_amount'>
  ) => {
    try {
      const doc = new jsPDF();
      const now = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr });
      const items = await loadItemsForExport(documentType, document.id);

      const metadata =
        documentType === 'request'
          ? {
              title: 'Demande d’achat',
              number: (document as Pick<PurchaseRequest, 'request_number'>).request_number,
              date: (document as Pick<PurchaseRequest, 'request_date'>).request_date,
              supplier: (document as Pick<PurchaseRequest, 'supplier_name'>).supplier_name || '-',
              status: requestStatusLabels[document.status] || document.status,
            }
          : documentType === 'order'
            ? {
                title: 'Bon de commande',
                number: (document as Pick<PurchaseOrder, 'order_number'>).order_number,
                date: (document as Pick<PurchaseOrder, 'order_date'>).order_date,
                supplier: (document as Pick<PurchaseOrder, 'supplier_name'>).supplier_name,
                status: orderStatusLabels[document.status] || document.status,
              }
            : documentType === 'delivery'
              ? {
                  title: 'Bon de livraison',
                  number: (document as Pick<DeliveryNote, 'delivery_number'>).delivery_number,
                  date: (document as Pick<DeliveryNote, 'delivery_date'>).delivery_date,
                  supplier: (document as Pick<DeliveryNote, 'supplier_name'>).supplier_name,
                  status: deliveryStatusLabels[document.status] || document.status,
                }
              : {
                  title: 'Facture fournisseur',
                  number: (document as Pick<SupplierInvoice, 'invoice_number'>).invoice_number,
                  date: (document as Pick<SupplierInvoice, 'invoice_date'>).invoice_date,
                  supplier: (document as Pick<SupplierInvoice, 'supplier_name'>).supplier_name,
                  status: invoiceStatusLabels[document.status] || document.status,
                };

      doc.setFillColor(22, 78, 99);
      doc.rect(0, 0, 210, 34, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text(companyProfile?.company_name || 'Société', 14, 17);
      doc.setFontSize(10);
      doc.text(metadata.title, 14, 25);
      doc.text(`Édité le ${now}`, 14, 31);
      doc.text(`N° ${metadata.number}`, 150, 20);
      doc.text(formatCurrency(Number(document.total_amount || 0)), 150, 28);

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.text(`Date: ${format(new Date(metadata.date), 'dd/MM/yyyy', { locale: fr })}`, 14, 46);
      doc.text(`Fournisseur: ${metadata.supplier}`, 14, 53);
      doc.text(`Statut: ${metadata.status}`, 14, 60);

      autoTable(doc, {
        startY: 68,
        head: [['Description', 'Qté', 'Unité', 'Prix unitaire', 'Total']],
        body: items.map((item) => [
          item.description,
          Number(item.quantity).toFixed(2),
          item.unit,
          formatCurrency(Number(item.unit_price)),
          formatCurrency(Number(item.total_price)),
        ]),
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [14, 116, 144], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setDrawColor(226, 232, 240);
      doc.line(14, pageHeight - 18, 196, pageHeight - 18);
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      const contactLine = [companyProfile?.contact_email, companyProfile?.contact_phone].filter(Boolean).join(' | ');
      doc.text(contactLine || 'Document généré automatiquement', 14, pageHeight - 10);

      doc.save(`${metadata.number}.pdf`);
    } catch {
      toast({
        title: 'Export PDF impossible',
        description: 'Une erreur est survenue pendant la génération du document.',
        variant: 'destructive',
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-2xl font-bold">{t('achats.title')}</h1>
          <p className="text-muted-foreground">{t('achats.subtitle')}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card className="dashboard-panel hover:shadow-md transition-shadow animate-in fade-in zoom-in-95 duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Demandes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{requestsCount}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(requestsTotalAmount)}</p>
            </CardContent>
          </Card>
          <Card className="dashboard-panel hover:shadow-md transition-shadow animate-in fade-in zoom-in-95 duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Commandes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{ordersCount}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(ordersTotalAmount)}</p>
            </CardContent>
          </Card>
          <Card className="dashboard-panel hover:shadow-md transition-shadow animate-in fade-in zoom-in-95 duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Livraisons</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{deliveriesCount}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(deliveriesTotalAmount)}</p>
            </CardContent>
          </Card>
          <Card className="dashboard-panel hover:shadow-md transition-shadow animate-in fade-in zoom-in-95 duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Factures</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{invoicesCount}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(invoicesTotalAmount)}</p>
            </CardContent>
          </Card>
          <Card className="dashboard-panel hover:shadow-md transition-shadow animate-in fade-in zoom-in-95 duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Factures en retard</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">{overdueInvoicesCount}</p>
              <p className="text-xs text-muted-foreground">Suivi des échéances fournisseurs</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="dashboard-panel">
            <CardHeader><CardTitle className="text-sm font-medium">Alertes achats</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {achatsAlerts.slice(0, 4).map((alert) => (
                <div key={alert.id} className="text-sm flex items-center justify-between">
                  <span className="truncate">{alert.title}</span>
                  <Badge variant={alert.severity === 'high' ? 'destructive' : 'secondary'}>{alert.severity}</Badge>
                </div>
              ))}
              {achatsAlerts.length === 0 && <p className="text-sm text-muted-foreground">Aucune alerte active</p>}
            </CardContent>
          </Card>
          <Card className="dashboard-panel">
            <CardHeader><CardTitle className="text-sm font-medium">Top fournisseurs</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {topSuppliers.slice(0, 4).map((supplier) => (
                <div key={supplier.supplier_id} className="text-sm flex items-center justify-between">
                  <span className="truncate">{supplier.supplier_name}</span>
                  <span>{formatCurrency(Number(supplier.total_amount || 0))}</span>
                </div>
              ))}
              {topSuppliers.length === 0 && <p className="text-sm text-muted-foreground">Pas de données</p>}
            </CardContent>
          </Card>
          <Card className="dashboard-panel">
            <CardHeader><CardTitle className="text-sm font-medium">Prévision trésorerie</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {cashForecast.slice(0, 4).map((item) => (
                <div key={item.id} className="text-sm flex items-center justify-between">
                  <span>{item.reference}</span>
                  <span>{formatCurrency(Number(item.amount || 0))}</span>
                </div>
              ))}
              {cashForecast.length === 0 && <p className="text-sm text-muted-foreground">Pas de décaissement prévu</p>}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="requests" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6 max-w-6xl">
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">{t('achats.requests')}</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">{t('achats.orders')}</span>
            </TabsTrigger>
            <TabsTrigger value="deliveries" className="flex items-center gap-2">
              <Truck className="w-4 h-4" />
              <span className="hidden sm:inline">{t('achats.deliveries')}</span>
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              <span className="hidden sm:inline">{t('achats.invoices')}</span>
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="flex items-center gap-2">
              <Languages className="w-4 h-4" />
              <span className="hidden sm:inline">Fournisseurs</span>
            </TabsTrigger>
            <TabsTrigger value="kanban" className="flex items-center gap-2">
              <KanbanSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Kanban</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Demandes d’achat</h2>
                  <p className="text-sm text-muted-foreground">{filteredRequests.length} résultat(s) sur {totalRequests}</p>
                </div>
                <Button onClick={() => { setEditingRequest(null); setRequestOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nouvelle demande
                </Button>
              </div>
              <Input
                value={requestSearch}
                onChange={(event) => setRequestSearch(event.target.value)}
                placeholder="Rechercher par numéro, demandeur, fournisseur ou statut"
                className="max-w-xl"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => bulkRequests.mutate({ ids: selectedRequestIds, status: 'submitted' })} disabled={selectedRequestIds.length === 0}>
                  Soumettre sélection
                </Button>
                <Button variant="outline" size="sm" onClick={() => bulkRequests.mutate({ ids: selectedRequestIds, status: 'approved' })} disabled={selectedRequestIds.length === 0}>
                  Approuver sélection
                </Button>
                <Button variant="outline" size="sm" onClick={() => bulkRequests.mutate({ ids: selectedRequestIds, status: 'rejected' })} disabled={selectedRequestIds.length === 0}>
                  Rejeter sélection
                </Button>
              </div>
              {loadingRequests ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : requests.length === 0 ? (
                <Card className="dashboard-panel">
                  <CardContent className="p-6 text-center text-muted-foreground">
                    Aucune demande d’achat créée
                  </CardContent>
                </Card>
              ) : filteredRequests.length === 0 ? (
                <Card className="dashboard-panel">
                  <CardContent className="p-6 text-center text-muted-foreground">
                    Aucune demande ne correspond à la recherche
                  </CardContent>
                </Card>
              ) : (
                <Card className="dashboard-panel">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={filteredRequests.length > 0 && selectedRequestIds.length === filteredRequests.length}
                              onCheckedChange={(checked) => setSelectedRequestIds(checked ? filteredRequests.map((request) => request.id) : [])}
                            />
                          </TableHead>
                          <TableHead>Numéro</TableHead>
                          <TableHead>Demandeur</TableHead>
                          <TableHead>Fournisseur</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRequests.map(request => (
                          <TableRow key={request.id} className="hover:bg-muted/40 transition-colors">
                            <TableCell>
                              <Checkbox
                                checked={selectedRequestIds.includes(request.id)}
                                onCheckedChange={(checked) =>
                                  setSelectedRequestIds((prev) =>
                                    checked ? [...prev, request.id] : prev.filter((id) => id !== request.id)
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell className="font-medium">{request.request_number}</TableCell>
                            <TableCell>{request.requester_name || '-'}</TableCell>
                            <TableCell>{request.supplier_name || '-'}</TableCell>
                            <TableCell>{format(new Date(request.request_date), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                            <TableCell className="text-right">{formatCurrency(Number(request.total_amount))}</TableCell>
                            <TableCell>
                              <Badge variant={requestStatusColors[request.status] || 'secondary'}>
                                {requestStatusLabels[request.status] || request.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => exportDocumentPdf('request', request)}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setEditingRequest(request); setRequestOpen(true); }}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => submitRequest.mutate(request.id)}>
                                <Filter className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => approveRequest.mutate(request.id)}>
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => rejectRequest.mutate(request.id)}>
                                <XCircle className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Supprimer la demande ?</AlertDialogTitle>
                                    <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteRequest.mutate(request.id)}>Supprimer</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex items-center justify-between p-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReqPage((p) => Math.max(1, p - 1))}
                        disabled={reqPage === 1}
                      >
                        Précédent
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Page {reqPage} / {Math.max(1, Math.ceil(totalRequests / pageSize))}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReqPage((p) => p + 1)}
                        disabled={reqPage * pageSize >= totalRequests}
                      >
                        Suivant
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              <PurchaseRequestForm
                open={requestOpen}
                onOpenChange={setRequestOpen}
                request={editingRequest ? { ...editingRequest, items: editingRequestItems } : null}
                suppliers={suppliers}
                onSubmit={(values) => {
                  const totalAmount = calculateItemsTotal(values.items);
                  if (editingRequest) {
                    updateRequest.mutate({
                      id: editingRequest.id,
                      request: {
                        request_number: values.request_number,
                        requester_name: values.requester_name || null,
                        supplier_name: values.supplier_name || null,
                        supplier_id: values.supplier_id || null,
                        request_date: values.request_date,
                        needed_date: values.needed_date || null,
                        status: values.status,
                        notes: values.notes || null,
                        total_amount: totalAmount,
                        updated_at: new Date().toISOString(),
                      },
                      items: values.items.map(item => ({
                        description: item.description,
                        quantity: Number(item.quantity),
                        unit: item.unit,
                        unit_price: Number(item.unit_price),
                        total_price: Number(item.quantity) * Number(item.unit_price),
                      })),
                    });
                  } else {
                    createRequest.mutate({
                      request: {
                        request_number: values.request_number,
                        requester_name: values.requester_name || null,
                        supplier_name: values.supplier_name || null,
                        supplier_id: values.supplier_id || null,
                        request_date: values.request_date,
                        needed_date: values.needed_date || null,
                        status: values.status,
                        notes: values.notes || null,
                        total_amount: totalAmount,
                      },
                      items: values.items.map(item => ({
                        description: item.description,
                        quantity: Number(item.quantity),
                        unit: item.unit,
                        unit_price: Number(item.unit_price),
                        total_price: Number(item.quantity) * Number(item.unit_price),
                      })),
                    });
                  }
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="orders">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Bons de commandes</h2>
                  <p className="text-sm text-muted-foreground">{filteredOrders.length} résultat(s) sur {totalOrders}</p>
                </div>
                <Button onClick={() => { setEditingOrder(null); setOrderOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau bon
                </Button>
              </div>
              <Input
                value={orderSearch}
                onChange={(event) => setOrderSearch(event.target.value)}
                placeholder="Rechercher par numéro, fournisseur ou statut"
                className="max-w-xl"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => bulkOrders.mutate({ ids: selectedOrderIds, status: 'submitted' })} disabled={selectedOrderIds.length === 0}>
                  Soumettre sélection
                </Button>
                <Button variant="outline" size="sm" onClick={() => bulkOrders.mutate({ ids: selectedOrderIds, status: 'approved' })} disabled={selectedOrderIds.length === 0}>
                  Approuver sélection
                </Button>
                <Button variant="outline" size="sm" onClick={() => bulkOrders.mutate({ ids: selectedOrderIds, status: 'rejected' })} disabled={selectedOrderIds.length === 0}>
                  Rejeter sélection
                </Button>
              </div>
              {loadingOrders ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : orders.length === 0 ? (
                <Card className="dashboard-panel">
                  <CardContent className="p-6 text-center text-muted-foreground">
                    Aucun bon de commande créé
                  </CardContent>
                </Card>
              ) : filteredOrders.length === 0 ? (
                <Card className="dashboard-panel">
                  <CardContent className="p-6 text-center text-muted-foreground">
                    Aucun bon de commande ne correspond à la recherche
                  </CardContent>
                </Card>
              ) : (
                <Card className="dashboard-panel">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={filteredOrders.length > 0 && selectedOrderIds.length === filteredOrders.length}
                              onCheckedChange={(checked) => setSelectedOrderIds(checked ? filteredOrders.map((order) => order.id) : [])}
                            />
                          </TableHead>
                          <TableHead>Numéro</TableHead>
                          <TableHead>Fournisseur</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map(order => (
                          <TableRow key={order.id} className="hover:bg-muted/40 transition-colors">
                            <TableCell>
                              <Checkbox
                                checked={selectedOrderIds.includes(order.id)}
                                onCheckedChange={(checked) =>
                                  setSelectedOrderIds((prev) =>
                                    checked ? [...prev, order.id] : prev.filter((id) => id !== order.id)
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell className="font-medium">{order.order_number}</TableCell>
                            <TableCell>{order.supplier_name}</TableCell>
                            <TableCell>{format(new Date(order.order_date), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                            <TableCell className="text-right">{formatCurrency(Number(order.total_amount))}</TableCell>
                            <TableCell>
                              <Badge variant={orderStatusColors[order.status] || 'secondary'}>
                                {orderStatusLabels[order.status] || order.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => exportDocumentPdf('order', order)}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setEditingOrder(order); setOrderOpen(true); }}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => submitOrder.mutate(order.id)}>
                                <Filter className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => approveOrder.mutate(order.id)}>
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => rejectOrder.mutate(order.id)}>
                                <XCircle className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Supprimer le bon ?</AlertDialogTitle>
                                    <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteOrder.mutate(order.id)}>Supprimer</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex items-center justify-between p-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOrdPage((p) => Math.max(1, p - 1))}
                        disabled={ordPage === 1}
                      >
                        Précédent
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Page {ordPage} / {Math.max(1, Math.ceil(totalOrders / pageSize))}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOrdPage((p) => p + 1)}
                        disabled={ordPage * pageSize >= totalOrders}
                      >
                        Suivant
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              <PurchaseOrderForm
                open={orderOpen}
                onOpenChange={setOrderOpen}
                order={editingOrder ? { ...editingOrder, items: editingOrderItems } : null}
                suppliers={suppliers}
                availableRequests={requests}
                onSubmit={(values) => {
                  const subtotal = calculateItemsTotal(values.items);
                  const taxAmount = subtotal * (Number(values.tax_rate) / 100);
                  const totalAmount = subtotal + taxAmount;
                  if (editingOrder) {
                    updateOrder.mutate({
                      id: editingOrder.id,
                      order: {
                        order_number: values.order_number,
                        supplier_name: values.supplier_name,
                        supplier_id: values.supplier_id || null,
                        request_id: values.request_id || null,
                        order_date: values.order_date,
                        expected_delivery_date: values.expected_delivery_date || null,
                        status: values.status,
                        subtotal,
                        tax_rate: Number(values.tax_rate),
                        tax_amount: taxAmount,
                        total_amount: totalAmount,
                        notes: values.notes || null,
                        updated_at: new Date().toISOString(),
                      },
                      items: values.items.map(item => ({
                        description: item.description,
                        quantity: Number(item.quantity),
                        unit: item.unit,
                        unit_price: Number(item.unit_price),
                        total_price: Number(item.quantity) * Number(item.unit_price),
                      })),
                    });
                  } else {
                    createOrder.mutate({
                      order: {
                        order_number: values.order_number,
                        supplier_name: values.supplier_name,
                        supplier_id: values.supplier_id || null,
                        request_id: values.request_id || null,
                        order_date: values.order_date,
                        expected_delivery_date: values.expected_delivery_date || null,
                        status: values.status,
                        subtotal,
                        tax_rate: Number(values.tax_rate),
                        tax_amount: taxAmount,
                        total_amount: totalAmount,
                        notes: values.notes || null,
                      },
                      items: values.items.map(item => ({
                        description: item.description,
                        quantity: Number(item.quantity),
                        unit: item.unit,
                        unit_price: Number(item.unit_price),
                        total_price: Number(item.quantity) * Number(item.unit_price),
                      })),
                    });
                  }
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="deliveries">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Bons de livraisons</h2>
                  <p className="text-sm text-muted-foreground">{filteredDeliveries.length} résultat(s) sur {totalDeliveries}</p>
                </div>
                <Button onClick={() => { setEditingDelivery(null); setDeliveryOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau bon
                </Button>
              </div>
              <Input
                value={deliverySearch}
                onChange={(event) => setDeliverySearch(event.target.value)}
                placeholder="Rechercher par numéro, fournisseur ou statut"
                className="max-w-xl"
              />
              {loadingDeliveries ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : deliveries.length === 0 ? (
                <Card className="dashboard-panel">
                  <CardContent className="p-6 text-center text-muted-foreground">
                    Aucun bon de livraison créé
                  </CardContent>
                </Card>
              ) : filteredDeliveries.length === 0 ? (
                <Card className="dashboard-panel">
                  <CardContent className="p-6 text-center text-muted-foreground">
                    Aucun bon de livraison ne correspond à la recherche
                  </CardContent>
                </Card>
              ) : (
                <Card className="dashboard-panel">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Numéro</TableHead>
                          <TableHead>Fournisseur</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDeliveries.map(delivery => (
                          <TableRow key={delivery.id} className="hover:bg-muted/40 transition-colors">
                            <TableCell className="font-medium">{delivery.delivery_number}</TableCell>
                            <TableCell>{delivery.supplier_name}</TableCell>
                            <TableCell>{format(new Date(delivery.delivery_date), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                            <TableCell className="text-right">{formatCurrency(Number(delivery.total_amount))}</TableCell>
                            <TableCell>
                              <Badge variant={deliveryStatusColors[delivery.status] || 'secondary'}>
                                {deliveryStatusLabels[delivery.status] || delivery.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => exportDocumentPdf('delivery', delivery)}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setEditingDelivery(delivery); setDeliveryOpen(true); }}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => markDeliveryReceived.mutate(delivery.id)}>
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Supprimer le bon ?</AlertDialogTitle>
                                    <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteDelivery.mutate(delivery.id)}>Supprimer</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex items-center justify-between p-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDelPage((p) => Math.max(1, p - 1))}
                        disabled={delPage === 1}
                      >
                        Précédent
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Page {delPage} / {Math.max(1, Math.ceil(totalDeliveries / pageSize))}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDelPage((p) => p + 1)}
                        disabled={delPage * pageSize >= totalDeliveries}
                      >
                        Suivant
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              <DeliveryNoteForm
                open={deliveryOpen}
                onOpenChange={setDeliveryOpen}
                note={editingDelivery ? { ...editingDelivery, items: editingDeliveryItems } : null}
                suppliers={suppliers}
                availableOrders={orders}
                onSubmit={(values) => {
                  const totalAmount = calculateItemsTotal(values.items);
                  if (editingDelivery) {
                    updateDelivery.mutate({
                      id: editingDelivery.id,
                      note: {
                        delivery_number: values.delivery_number,
                        supplier_name: values.supplier_name,
                        supplier_id: values.supplier_id || null,
                        order_number: values.order_number || null,
                        order_id: values.order_id || null,
                        delivery_date: values.delivery_date,
                        status: values.status,
                        notes: values.notes || null,
                        total_amount: totalAmount,
                        updated_at: new Date().toISOString(),
                      },
                      items: values.items.map(item => ({
                        description: item.description,
                        quantity: Number(item.quantity),
                        unit: item.unit,
                        unit_price: Number(item.unit_price),
                        total_price: Number(item.quantity) * Number(item.unit_price),
                      })),
                    });
                  } else {
                    createDelivery.mutate({
                      note: {
                        delivery_number: values.delivery_number,
                        supplier_name: values.supplier_name,
                        supplier_id: values.supplier_id || null,
                        order_number: values.order_number || null,
                        order_id: values.order_id || null,
                        delivery_date: values.delivery_date,
                        status: values.status,
                        notes: values.notes || null,
                        total_amount: totalAmount,
                      },
                      items: values.items.map(item => ({
                        description: item.description,
                        quantity: Number(item.quantity),
                        unit: item.unit,
                        unit_price: Number(item.unit_price),
                        total_price: Number(item.quantity) * Number(item.unit_price),
                      })),
                    });
                  }
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="invoices">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Factures fournisseurs</h2>
                  <p className="text-sm text-muted-foreground">{filteredInvoices.length} résultat(s) sur {totalInvoices}</p>
                </div>
                <Button onClick={() => { setEditingInvoice(null); setInvoiceOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nouvelle facture
                </Button>
              </div>
              <Input
                value={invoiceSearch}
                onChange={(event) => setInvoiceSearch(event.target.value)}
                placeholder="Rechercher par numéro, fournisseur ou statut"
                className="max-w-xl"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => bulkInvoices.mutate({ ids: selectedInvoiceIds, status: 'paid' })} disabled={selectedInvoiceIds.length === 0}>
                  Marquer payé
                </Button>
                <Button variant="outline" size="sm" onClick={() => bulkInvoices.mutate({ ids: selectedInvoiceIds, status: 'overdue' })} disabled={selectedInvoiceIds.length === 0}>
                  Marquer en retard
                </Button>
              </div>
              {loadingInvoices ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : invoices.length === 0 ? (
                <Card className="dashboard-panel">
                  <CardContent className="p-6 text-center text-muted-foreground">
                    Aucune facture fournisseur créée
                  </CardContent>
                </Card>
              ) : filteredInvoices.length === 0 ? (
                <Card className="dashboard-panel">
                  <CardContent className="p-6 text-center text-muted-foreground">
                    Aucune facture ne correspond à la recherche
                  </CardContent>
                </Card>
              ) : (
                <Card className="dashboard-panel">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={filteredInvoices.length > 0 && selectedInvoiceIds.length === filteredInvoices.length}
                              onCheckedChange={(checked) => setSelectedInvoiceIds(checked ? filteredInvoices.map((invoice) => invoice.id) : [])}
                            />
                          </TableHead>
                          <TableHead>Numéro</TableHead>
                          <TableHead>Fournisseur</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInvoices.map(invoice => (
                          <TableRow key={invoice.id} className="hover:bg-muted/40 transition-colors">
                            <TableCell>
                              <Checkbox
                                checked={selectedInvoiceIds.includes(invoice.id)}
                                onCheckedChange={(checked) =>
                                  setSelectedInvoiceIds((prev) =>
                                    checked ? [...prev, invoice.id] : prev.filter((id) => id !== invoice.id)
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                            <TableCell>{invoice.supplier_name}</TableCell>
                            <TableCell>{format(new Date(invoice.invoice_date), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                            <TableCell className="text-right">{formatCurrency(Number(invoice.total_amount))}</TableCell>
                            <TableCell>
                              <Badge variant={invoiceStatusColors[invoice.status] || 'secondary'}>
                                {invoiceStatusLabels[invoice.status] || invoice.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => exportDocumentPdf('invoice', invoice)}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setEditingInvoice(invoice); setInvoiceOpen(true); }}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => markInvoicePaid.mutate(invoice.id)}>
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Supprimer la facture ?</AlertDialogTitle>
                                    <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteInvoice.mutate(invoice.id)}>Supprimer</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex items-center justify-between p-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setInvPage((p) => Math.max(1, p - 1))}
                        disabled={invPage === 1}
                      >
                        Précédent
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Page {invPage} / {Math.max(1, Math.ceil(totalInvoices / pageSize))}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setInvPage((p) => p + 1)}
                        disabled={invPage * pageSize >= totalInvoices}
                      >
                        Suivant
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              <SupplierInvoiceForm
                open={invoiceOpen}
                onOpenChange={setInvoiceOpen}
                invoice={editingInvoice ? { ...editingInvoice, items: editingInvoiceItems } : null}
                suppliers={suppliers}
                availableOrders={orders}
                availableDeliveries={deliveries}
                onSubmit={(values) => {
                  const subtotal = calculateItemsTotal(values.items);
                  const taxAmount = subtotal * (Number(values.tax_rate) / 100);
                  const totalAmount = subtotal + taxAmount;
                  if (editingInvoice) {
                    updateInvoice.mutate({
                      id: editingInvoice.id,
                      invoice: {
                        invoice_number: values.invoice_number,
                        supplier_name: values.supplier_name,
                        supplier_id: values.supplier_id || null,
                        order_id: values.order_id || null,
                        delivery_id: values.delivery_id || null,
                        invoice_date: values.invoice_date,
                        due_date: values.due_date || null,
                        status: values.status,
                        subtotal,
                        tax_rate: Number(values.tax_rate),
                        tax_amount: taxAmount,
                        total_amount: totalAmount,
                        notes: values.notes || null,
                        updated_at: new Date().toISOString(),
                      },
                      items: values.items.map(item => ({
                        description: item.description,
                        quantity: Number(item.quantity),
                        unit: item.unit,
                        unit_price: Number(item.unit_price),
                        total_price: Number(item.quantity) * Number(item.unit_price),
                      })),
                    });
                  } else {
                    createInvoice.mutate({
                      invoice: {
                        invoice_number: values.invoice_number,
                        supplier_name: values.supplier_name,
                        supplier_id: values.supplier_id || null,
                        order_id: values.order_id || null,
                        delivery_id: values.delivery_id || null,
                        invoice_date: values.invoice_date,
                        due_date: values.due_date || null,
                        status: values.status,
                        subtotal,
                        tax_rate: Number(values.tax_rate),
                        tax_amount: taxAmount,
                        total_amount: totalAmount,
                        notes: values.notes || null,
                      },
                      items: values.items.map(item => ({
                        description: item.description,
                        quantity: Number(item.quantity),
                        unit: item.unit,
                        unit_price: Number(item.unit_price),
                        total_price: Number(item.quantity) * Number(item.unit_price),
                      })),
                    });
                  }
                }}
              />
            </div>
          </TabsContent>
          <TabsContent value="suppliers">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Fournisseurs</h2>
                  <p className="text-sm text-muted-foreground">{filteredSuppliers.length} fournisseur(s)</p>
                </div>
                <Button onClick={() => { setEditingSupplier(null); setSupplierOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau fournisseur
                </Button>
              </div>
              <Input value={supplierSearch} onChange={(event) => setSupplierSearch(event.target.value)} placeholder="Rechercher code, raison sociale ou ICE" className="max-w-xl" />
              {loadingSuppliers ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Card className="dashboard-panel">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Raison sociale</TableHead>
                          <TableHead>ICE/IF</TableHead>
                          <TableHead>Délai</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSuppliers.map((supplier) => (
                          <TableRow key={supplier.id}>
                            <TableCell>{supplier.supplier_code}</TableCell>
                            <TableCell>{supplier.legal_name}</TableCell>
                            <TableCell>{supplier.ice_if || '-'}</TableCell>
                            <TableCell>{supplier.payment_due_days} jours</TableCell>
                            <TableCell className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => { setEditingSupplier(supplier); setSupplierOpen(true); }}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteSupplier.mutate(supplier.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
              <SupplierForm
                open={supplierOpen}
                onOpenChange={setSupplierOpen}
                supplier={editingSupplier}
                onSubmit={(values) => {
                  if (editingSupplier) {
                    updateSupplier.mutate({ id: editingSupplier.id, supplier: values });
                  } else {
                    createSupplier.mutate(values);
                  }
                }}
              />
            </div>
          </TabsContent>
          <TabsContent value="kanban">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="dashboard-panel">
                <CardHeader><CardTitle className="text-sm">À traiter</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {requests.filter((request) => ['draft', 'submitted'].includes(request.status)).slice(0, 6).map((request) => (
                    <div key={request.id} className="rounded border p-2 text-sm">{request.request_number} • {request.supplier_name || '-'}</div>
                  ))}
                </CardContent>
              </Card>
              <Card className="dashboard-panel">
                <CardHeader><CardTitle className="text-sm">En exécution</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {orders.filter((order) => ['approved', 'sent'].includes(order.status)).slice(0, 6).map((order) => (
                    <div key={order.id} className="rounded border p-2 text-sm">{order.order_number} • {order.supplier_name}</div>
                  ))}
                </CardContent>
              </Card>
              <Card className="dashboard-panel">
                <CardHeader><CardTitle className="text-sm">Risque cash</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {invoices.filter((invoice) => ['overdue', 'received'].includes(invoice.status)).slice(0, 6).map((invoice) => (
                    <div key={invoice.id} className="rounded border p-2 text-sm">{invoice.invoice_number} • {formatCurrency(Number(invoice.total_amount || 0))}</div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ReportsPage moved to src/pages/Reports.tsx

// AlertsPage moved to src/pages/Alerts.tsx

export function SettingsPage() {
  const { t } = useTranslation();
  return (
    <ComingSoonPage
      title={t('nav.settings')}
      description="Paramètres de l'entreprise, utilisateurs et rôles. En cours de développement."
    />
  );
}
