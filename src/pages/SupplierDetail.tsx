import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useForm,
  useFieldArray,
  type Control,
  type FieldArrayWithId,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, FileText, Package, Truck, Clock, Plus, Trash2, LayoutGrid } from 'lucide-react';
import { StockSupplier, StockItem } from '@/types/stock';
import { StockItemCard } from '@/components/stock/StockItemCard';
import { supabase } from '@/integrations/supabase/client';
import {
  usePurchaseOrders,
  useDeliveryNotes,
  useSupplierInvoices,
  useCreatePurchaseOrder,
  useCreateSupplierInvoice,
} from '@/hooks/useAchats';
import { usePayments } from '@/hooks/useFinance';
import { PaymentForm } from '@/components/finance/PaymentForm';

const normalizeSupplierName = (name: string | null | undefined) =>
  (name || '').trim().toLowerCase();

const itemSchema = z.object({
  description: z.string().min(1, 'Description requise'),
  quantity: z.coerce.number().min(0.01, 'Quantité requise'),
  unit: z.string().min(1, 'Unité requise'),
  unit_price: z.coerce.number().min(0, 'Prix requis'),
});

const purchaseOrderSchema = z.object({
  order_number: z.string().min(1, 'Numéro requis'),
  supplier_name: z.string().min(1, 'Fournisseur requis'),
  order_date: z.string().min(1, 'Date requise'),
  expected_delivery_date: z.string().optional(),
  status: z.string().min(1, 'Statut requis'),
  tax_rate: z.coerce.number().min(0),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Au moins un article'),
});

const supplierInvoiceSchema = z.object({
  invoice_number: z.string().min(1, 'Numéro requis'),
  supplier_name: z.string().min(1, 'Fournisseur requis'),
  invoice_date: z.string().min(1, 'Date requise'),
  due_date: z.string().optional(),
  status: z.string().min(1, 'Statut requis'),
  tax_rate: z.coerce.number().min(0),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Au moins un article'),
});

type ItemFormValues = z.infer<typeof itemSchema>;
type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;
type SupplierInvoiceFormValues = z.infer<typeof supplierInvoiceSchema>;

function calculateItemsTotal(items: ItemFormValues[]) {
  return items.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
    0,
  );
}

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
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            append({ description: '', quantity: 1, unit: 'u', unit_price: 0 })
          }
        >
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
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type PurchaseOrderQuickFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierName: string;
};

function PurchaseOrderQuickForm({
  open,
  onOpenChange,
  supplierName,
}: PurchaseOrderQuickFormProps) {
  const createOrder = useCreatePurchaseOrder();
  const form = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      order_number: '',
      supplier_name: supplierName,
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

  const items = form.watch('items');
  const subtotal = calculateItemsTotal(items);
  const taxRate = Number(form.watch('tax_rate') || 0);
  const taxAmount = subtotal * (taxRate / 100);
  const totalAmount = subtotal + taxAmount;

  const handleSubmit = async (values: PurchaseOrderFormValues) => {
    await createOrder.mutateAsync({
      order: {
        order_number: values.order_number,
        supplier_name: supplierName,
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
      items: values.items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unit: item.unit,
        unit_price: Number(item.unit_price),
        total_price: Number(item.quantity) * Number(item.unit_price),
      })),
    });

    form.reset({
      order_number: '',
      supplier_name: supplierName,
      order_date: new Date().toISOString().split('T')[0],
      expected_delivery_date: '',
      status: 'draft',
      tax_rate: 20,
      notes: '',
      items: [{ description: '', quantity: 1, unit: 'u', unit_price: 0 }],
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau bon de commande</DialogTitle>
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
                      <Input placeholder="BC-2026-001" {...field} />
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
            <div className="grid grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>Fournisseur</FormLabel>
                <FormControl>
                  <Input value={supplierName} readOnly />
                </FormControl>
              </FormItem>
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
                        <SelectItem value="sent">Envoyé</SelectItem>
                        <SelectItem value="confirmed">Confirmé</SelectItem>
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
              <div className="text-sm text-muted-foreground">
                Total HT:{' '}
                <span className="font-semibold">
                  {new Intl.NumberFormat('fr-MA').format(subtotal)} MAD
                </span>
                {' · '}
                TVA:{' '}
                <span className="font-semibold">
                  {new Intl.NumberFormat('fr-MA').format(taxAmount)} MAD
                </span>
                {' · '}
                Total TTC:{' '}
                <span className="font-semibold">
                  {new Intl.NumberFormat('fr-MA').format(totalAmount)} MAD
                </span>
              </div>
              <Button type="submit" disabled={createOrder.isPending}>
                {createOrder.isPending ? 'Création...' : 'Enregistrer le bon'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

type SupplierInvoiceQuickFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierName: string;
};

function SupplierInvoiceQuickForm({
  open,
  onOpenChange,
  supplierName,
}: SupplierInvoiceQuickFormProps) {
  const createInvoice = useCreateSupplierInvoice();
  const form = useForm<SupplierInvoiceFormValues>({
    resolver: zodResolver(supplierInvoiceSchema),
    defaultValues: {
      invoice_number: '',
      supplier_name: supplierName,
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

  const items = form.watch('items');
  const subtotal = calculateItemsTotal(items);
  const taxRate = Number(form.watch('tax_rate') || 0);
  const taxAmount = subtotal * (taxRate / 100);
  const totalAmount = subtotal + taxAmount;

  const handleSubmit = async (values: SupplierInvoiceFormValues) => {
    await createInvoice.mutateAsync({
      invoice: {
        invoice_number: values.invoice_number,
        supplier_name: supplierName,
        invoice_date: values.invoice_date,
        due_date: values.due_date || null,
        status: values.status,
        subtotal,
        tax_rate: Number(values.tax_rate),
        tax_amount: taxAmount,
        total_amount: totalAmount,
        notes: values.notes || null,
      },
      items: values.items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unit: item.unit,
        unit_price: Number(item.unit_price),
        total_price: Number(item.quantity) * Number(item.unit_price),
      })),
    });

    form.reset({
      invoice_number: '',
      supplier_name: supplierName,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: '',
      status: 'draft',
      tax_rate: 20,
      notes: '',
      items: [{ description: '', quantity: 1, unit: 'u', unit_price: 0 }],
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle facture fournisseur</DialogTitle>
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
                      <Input placeholder="FF-2026-001" {...field} />
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
            <div className="grid grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>Fournisseur</FormLabel>
                <FormControl>
                  <Input value={supplierName} readOnly />
                </FormControl>
              </FormItem>
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
              <div className="text-sm text-muted-foreground">
                Total HT:{' '}
                <span className="font-semibold">
                  {new Intl.NumberFormat('fr-MA').format(subtotal)} MAD
                </span>
                {' · '}
                TVA:{' '}
                <span className="font-semibold">
                  {new Intl.NumberFormat('fr-MA').format(taxAmount)} MAD
                </span>
                {' · '}
                Total TTC:{' '}
                <span className="font-semibold">
                  {new Intl.NumberFormat('fr-MA').format(totalAmount)} MAD
                </span>
              </div>
              <Button type="submit" disabled={createInvoice.isPending}>
                {createInvoice.isPending ? 'Création...' : 'Enregistrer la facture'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<StockSupplier | null>(null);
  const [loadingSupplier, setLoadingSupplier] = useState(true);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loadingStockItems, setLoadingStockItems] = useState(true);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentInitialAmount, setPaymentInitialAmount] = useState<number>(0);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);

  const { data: purchaseOrders = [] } = usePurchaseOrders();
  const { data: deliveryNotes = [] } = useDeliveryNotes();
  const { data: supplierInvoices = [] } = useSupplierInvoices();
  const { data: payments = [] } = usePayments();

  useEffect(() => {
    const loadSupplier = async () => {
      if (!id) return;
      setLoadingSupplier(true);
      const { data, error } = await supabase
        .from('stock_suppliers')
        .select('*')
        .eq('id', id)
        .single();
      if (!error) {
        setSupplier(data as StockSupplier);
      }
      setLoadingSupplier(false);
    };

    loadSupplier();
  }, [id]);

  useEffect(() => {
    const loadStockItems = async () => {
      if (!id) return;
      setLoadingStockItems(true);
      const { data, error } = await supabase
        .from('stock_items')
        .select('*, supplier:stock_suppliers(*)')
        .eq('supplier_id', id);
      
      if (!error) {
        setStockItems(data as StockItem[]);
      }
      setLoadingStockItems(false);
    };

    loadStockItems();
  }, [id]);

  const supplierKey = normalizeSupplierName(supplier?.name);

  const supplierOrders = useMemo(
    () =>
      purchaseOrders.filter(
        (order) => normalizeSupplierName(order.supplier_name) === supplierKey,
      ),
    [purchaseOrders, supplierKey],
  );

  const supplierDeliveries = useMemo(
    () =>
      deliveryNotes.filter(
        (note) => normalizeSupplierName(note.supplier_name) === supplierKey,
      ),
    [deliveryNotes, supplierKey],
  );

  const supplierInvoicesFiltered = useMemo(
    () =>
      supplierInvoices.filter(
        (invoice) => normalizeSupplierName(invoice.supplier_name) === supplierKey,
      ),
    [supplierInvoices, supplierKey],
  );

  const stats = useMemo(() => {
    const ordersCount = supplierOrders.length;
    const deliveriesCount = supplierDeliveries.length;
    const invoicesCount = supplierInvoicesFiltered.length;
    const invoicesTotal = supplierInvoicesFiltered.reduce(
      (sum, inv) => sum + (Number((inv as any).total_amount ?? inv.subtotal) || 0),
      0,
    );
    const outstandingAmount = supplierInvoicesFiltered.reduce((sum, inv) => {
      const total = Number((inv as any).total_amount ?? inv.subtotal) || 0;
      return inv.status === 'paid' ? sum : sum + total;
    }, 0);
    const lastInvoiceDate =
      supplierInvoicesFiltered.reduce<string | null>((current, inv) => {
        if (!current || inv.invoice_date > current) return inv.invoice_date;
        return current;
      }, null) || null;

    return {
      ordersCount,
      deliveriesCount,
      invoicesCount,
      invoicesTotal,
      outstandingAmount,
      lastInvoiceDate,
    };
  }, [supplierOrders, supplierDeliveries, supplierInvoicesFiltered]);

  const supplierPayments = useMemo(
    () =>
      (payments || []).filter(
        (payment: any) =>
          normalizeSupplierName(payment.entity_name) === supplierKey &&
          payment.payment_type === 'expense' &&
          (payment.status === 'completed' || !payment.status),
      ),
    [payments, supplierKey],
  );

  const totalPaid = useMemo(
    () =>
      supplierPayments.reduce(
        (sum: number, payment: any) => sum + (Number(payment.amount) || 0),
        0,
      ),
    [supplierPayments],
  );

  const paymentsByReference = useMemo(() => {
    const map = new Map<string, number>();
    supplierPayments.forEach((payment: any) => {
      const ref = (payment.reference_number || '').trim();
      if (!ref) return;
      const previous = map.get(ref) || 0;
      map.set(ref, previous + (Number(payment.amount) || 0));
    });
    return map;
  }, [supplierPayments]);

  const preciseOutstanding = useMemo(() => {
    return supplierInvoicesFiltered.reduce((sum, invoice) => {
      const total = Number((invoice as any).total_amount ?? invoice.subtotal) || 0;
      const ref = (invoice.invoice_number || '').trim();
      const paidForInvoice = ref ? paymentsByReference.get(ref) || 0 : 0;
      const remaining = Math.max(0, total - paidForInvoice);
      return sum + remaining;
    }, 0);
  }, [supplierInvoicesFiltered, paymentsByReference]);

  const handleOpenPaymentForOutstanding = () => {
    setPaymentInitialAmount(preciseOutstanding);
    setPaymentReference(null);
    setIsPaymentDialogOpen(true);
  };

  const handleOpenPaymentForInvoice = (invoice: any, remainingAmount: number) => {
    setPaymentInitialAmount(remainingAmount);
    setPaymentReference(invoice.invoice_number || null);
    setIsPaymentDialogOpen(true);
  };

  const timelineEvents = useMemo(() => {
    type Event = {
      id: string;
      date: string;
      label: string;
      type: 'order' | 'delivery' | 'invoice';
      amount?: number;
      status?: string;
      ref: string;
    };

    const events: Event[] = [];

    supplierOrders.forEach((order) => {
      const total = Number((order as any).total_amount ?? order.subtotal) || 0;
      events.push({
        id: `order-${order.id}`,
        date: order.order_date,
        label: 'Bon de commande',
        type: 'order',
        amount: total,
        status: order.status,
        ref: order.order_number,
      });
    });

    supplierDeliveries.forEach((note) => {
      const total = Number(note.total_amount) || 0;
      events.push({
        id: `delivery-${note.id}`,
        date: note.delivery_date,
        label: 'Bon de livraison',
        type: 'delivery',
        amount: total,
        status: note.status,
        ref: note.delivery_number,
      });
    });

    supplierInvoicesFiltered.forEach((invoice) => {
      const total = Number((invoice as any).total_amount ?? invoice.subtotal) || 0;
      events.push({
        id: `invoice-${invoice.id}`,
        date: invoice.invoice_date,
        label: 'Facture fournisseur',
        type: 'invoice',
        amount: total,
        status: invoice.status,
        ref: invoice.invoice_number,
      });
    });

    return events.sort((a, b) => a.date.localeCompare(b.date)).reverse();
  }, [supplierOrders, supplierDeliveries, supplierInvoicesFiltered]);

  if (loadingSupplier) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Clock className="w-6 h-6 mr-2 animate-spin text-primary" />
          <span className="text-muted-foreground">Chargement du fournisseur...</span>
        </div>
      </DashboardLayout>
    );
  }

  if (!supplier) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => navigate('/stock')} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Retour au stock
          </Button>
          <Card className="dashboard-panel">
            <CardContent className="p-6">
              <p className="text-muted-foreground">Fournisseur introuvable.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/stock')} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{supplier.name}</h1>
              <p className="text-muted-foreground">
                {supplier.city || 'Ville inconnue'} ·{' '}
                {supplier.email || 'Email non renseigné'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOrderDialogOpen(true)}
            >
              Créer bon de commande
            </Button>
            <Button variant="outline" size="sm" onClick={() => setInvoiceDialogOpen(true)}>
              Créer facture fournisseur
            </Button>
            <Button size="sm" onClick={handleOpenPaymentForOutstanding}>
              Enregistrer un règlement
            </Button>
            <Badge variant="secondary">
              Score {supplier.rating?.toFixed(1) ?? 'N/A'}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="kpi-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Commandes</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.ordersCount}</div>
              <p className="text-xs text-muted-foreground">
                {stats.deliveriesCount} livraisons reçues
              </p>
            </CardContent>
          </Card>
          <Card className="kpi-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Factures</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.invoicesCount}</div>
              <p className="text-xs text-muted-foreground">
                Total: {new Intl.NumberFormat('fr-MA').format(stats.invoicesTotal)} MAD
              </p>
            </CardContent>
          </Card>
          <Card className="kpi-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Articles fournis</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stockItems.length}</div>
              <p className="text-xs text-muted-foreground">Références actives</p>
            </CardContent>
          </Card>
          <Card className="kpi-card kpi-card-destructive">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-destructive">Dette actuelle</CardTitle>
              <Clock className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {new Intl.NumberFormat('fr-MA').format(preciseOutstanding)} MAD
              </div>
              <p className="text-xs text-destructive/80">Reste à payer</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview" className="gap-2">
              <LayoutGrid className="w-4 h-4" />
              Résumé
            </TabsTrigger>
            <TabsTrigger value="supplied-items" className="gap-2">
              <Package className="w-4 h-4" />
              Articles fournis
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-2">
              <FileText className="w-4 h-4" />
              Factures
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2">
              <Truck className="w-4 h-4" />
              Bons de commande
            </TabsTrigger>
            <TabsTrigger value="deliveries" className="gap-2">
              <Truck className="w-4 h-4" />
              Bons de livraison
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2">
              <Clock className="w-4 h-4" />
              Timeline
            </TabsTrigger>
          </TabsList>

        <TabsContent value="supplied-items" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Articles fournis par ce fournisseur</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingStockItems ? (
                <div className="flex items-center justify-center h-32">
                  <Clock className="w-6 h-6 mr-2 animate-spin text-primary" />
                  <span className="text-muted-foreground">Chargement des articles...</span>
                </div>
              ) : stockItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Package className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-lg font-medium text-muted-foreground">Aucun article trouvé</p>
                  <p className="text-sm text-muted-foreground max-w-sm mt-1">
                    Ce fournisseur n'est associé à aucun article dans le stock.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stockItems.map((item) => (
                    <StockItemCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
            <Card className="dashboard-panel">
              <CardHeader>
                <CardTitle>Résumé financier</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Total facturé:{' '}
                  <span className="font-semibold text-foreground">
                    {new Intl.NumberFormat('fr-MA').format(stats.invoicesTotal)} MAD
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Total réglé:{' '}
                  <span className="font-semibold text-foreground">
                    {new Intl.NumberFormat('fr-MA').format(totalPaid)} MAD
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Dette actuelle:{' '}
                  <span className="font-semibold text-foreground">
                    {new Intl.NumberFormat('fr-MA').format(preciseOutstanding)} MAD
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Dernière facture:{' '}
                  <span className="font-semibold text-foreground">
                    {stats.lastInvoiceDate
                      ? new Date(stats.lastInvoiceDate).toLocaleDateString('fr-MA')
                      : 'Aucune'}
                  </span>
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices">
            <Card className="dashboard-panel">
              <CardHeader>
                <CardTitle>Factures fournisseur</CardTitle>
              </CardHeader>
              <CardContent>
                {supplierInvoicesFiltered.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucune facture trouvée pour ce fournisseur.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Numéro</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Échéance</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead className="text-right">Restant</TableHead>
                        <TableHead className="text-right">Règlement</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplierInvoicesFiltered.map((invoice) => {
                        const total =
                          Number((invoice as any).total_amount ?? invoice.subtotal) || 0;
                        const ref = (invoice.invoice_number || '').trim();
                        const paidForInvoice = ref ? paymentsByReference.get(ref) || 0 : 0;
                        const remainingForInvoice = Math.max(0, total - paidForInvoice);
                        return (
                          <TableRow key={invoice.id}>
                            <TableCell>{invoice.invoice_number}</TableCell>
                            <TableCell>
                              {new Date(invoice.invoice_date).toLocaleDateString('fr-MA')}
                            </TableCell>
                            <TableCell>
                              {invoice.due_date
                                ? new Date(invoice.due_date).toLocaleDateString('fr-MA')
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  invoice.status === 'paid'
                                    ? 'default'
                                    : invoice.status === 'overdue'
                                    ? 'destructive'
                                    : 'secondary'
                                }
                              >
                                {invoice.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {new Intl.NumberFormat('fr-MA').format(total)} MAD
                            </TableCell>
                            <TableCell className="text-right">
                              {remainingForInvoice <= 0 ? (
                                <span className="text-xs text-muted-foreground">Payée</span>
                              ) : (
                                <span className="text-xs">
                                  {new Intl.NumberFormat('fr-MA').format(remainingForInvoice)} MAD
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {remainingForInvoice <= 0 ? (
                                <span className="text-xs text-muted-foreground">Aucun règlement à faire</span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleOpenPaymentForInvoice(invoice, remainingForInvoice)
                                  }
                                >
                                  Règler cette facture
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card className="dashboard-panel">
              <CardHeader>
                <CardTitle>Bons de commande</CardTitle>
              </CardHeader>
              <CardContent>
                {supplierOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun bon de commande trouvé pour ce fournisseur.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Numéro</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplierOrders.map((order) => {
                        const total =
                          Number((order as any).total_amount ?? order.subtotal) || 0;
                        return (
                          <TableRow key={order.id}>
                            <TableCell>{order.order_number}</TableCell>
                            <TableCell>
                              {new Date(order.order_date).toLocaleDateString('fr-MA')}
                            </TableCell>
                            <TableCell>{order.status}</TableCell>
                            <TableCell className="text-right">
                              {new Intl.NumberFormat('fr-MA').format(total)} MAD
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deliveries">
            <Card className="dashboard-panel">
              <CardHeader>
                <CardTitle>Bons de livraison</CardTitle>
              </CardHeader>
              <CardContent>
                {supplierDeliveries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun bon de livraison trouvé pour ce fournisseur.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Numéro</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Bon de commande</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplierDeliveries.map((note) => (
                        <TableRow key={note.id}>
                          <TableCell>{note.delivery_number}</TableCell>
                          <TableCell>
                            {new Date(note.delivery_date).toLocaleDateString('fr-MA')}
                          </TableCell>
                          <TableCell>{note.order_number || '-'}</TableCell>
                          <TableCell>{note.status}</TableCell>
                          <TableCell className="text-right">
                            {new Intl.NumberFormat('fr-MA').format(note.total_amount)} MAD
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline">
            <Card>
              <CardHeader>
                <CardTitle>Timeline des opérations</CardTitle>
              </CardHeader>
              <CardContent>
                {timelineEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucune opération enregistrée pour ce fournisseur.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {timelineEvents.map((event) => (
                      <div key={event.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-primary mb-1" />
                          <div className="flex-1 w-px bg-border" />
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{event.label}</Badge>
                              <span className="text-sm text-muted-foreground">
                                {event.ref}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(event.date).toLocaleString('fr-MA')}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              Statut: {event.status || '-'}
                            </span>
                            {typeof event.amount === 'number' && (
                              <span className="font-medium">
                                {new Intl.NumberFormat('fr-MA').format(event.amount)} MAD
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <PurchaseOrderQuickForm
        open={isOrderDialogOpen}
        onOpenChange={setIsOrderDialogOpen}
        supplierName={supplier.name}
      />
      <SupplierInvoiceQuickForm
        open={isInvoiceDialogOpen}
        onOpenChange={setIsInvoiceDialogOpen}
        supplierName={supplier.name}
      />
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enregistrer un règlement pour ce fournisseur</DialogTitle>
          </DialogHeader>
          <PaymentForm
            key={`${supplier.id}-${paymentReference ?? 'outstanding'}`}
            onSuccess={() => setPaymentDialogOpen(false)}
            initialValues={{
              payment_type: 'expense',
              entity_name: supplier.name,
              amount: paymentInitialAmount,
              reference_number: paymentReference || undefined,
            }}
          />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
