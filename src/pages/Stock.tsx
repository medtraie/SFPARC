import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { StockItemCard } from '@/components/stock/StockItemCard';
import { SupplierCard } from '@/components/stock/SupplierCard';
import { StockForm } from '@/components/stock/StockForm';
import { SupplierForm } from '@/components/stock/SupplierForm';
import { RestockForm } from '@/components/stock/RestockForm';
import { StockItem, StockSupplier, StockTransactionWithItem } from '@/types/stock';
import { 
  getStockItems, 
  createStockItem, 
  updateStockItem, 
  getSuppliers, 
  createSupplier, 
  updateSupplier, 
  restockItem,
  getStockTransactions, 
} from '@/services/stockService';
import { usePurchaseOrders, useSupplierInvoices } from '@/hooks/useAchats';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  Building2,
  Filter,
  RefreshCw,
  History,
  FileDown,
  LayoutGrid,
  Rows3,
  Boxes,
  Wallet
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTourismCompanyProfile } from '@/hooks/useTourismCompany';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

const defaultCategories = [
  { value: 'pieces', label: 'Pièces détachées' },
  { value: 'consommables', label: 'Consommables' },
  { value: 'pneus', label: 'Pneus' },
  { value: 'huiles', label: 'Huiles & Lubrifiants' },
];

const getCategoryLabel = (value: string) =>
  defaultCategories.find((category) => category.value === value)?.label ?? value;

const normalizeSupplierName = (name: string | null | undefined) =>
  (name || '').trim().toLowerCase();

const formatCurrency = (value: number) =>
  `${new Intl.NumberFormat('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} MAD`;

export default function Stock() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockTypeFilter, setStockTypeFilter] = useState<'all' | 'internal' | 'external'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'qty_asc' | 'qty_desc' | 'value_desc'>('name');
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [suppliers, setSuppliers] = useState<StockSupplier[]>([]);
  const [categories, setCategories] = useState(defaultCategories);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<StockTransactionWithItem[]>([]);
  const [isTxLoading, setIsTxLoading] = useState(false);
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'IN' | 'OUT' | 'ADJUSTMENT'>('all');
  const [txVehicleFilter, setTxVehicleFilter] = useState('');
  const [txStartDate, setTxStartDate] = useState('');
  const [txEndDate, setTxEndDate] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTransactions, setHistoryTransactions] = useState<StockTransactionWithItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'IN' | 'OUT' | 'ADJUSTMENT'>('all');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [historyUserFilter, setHistoryUserFilter] = useState('');
  const [historyItemFilter, setHistoryItemFilter] = useState('');
  const [showOnlyLowStock, setShowOnlyLowStock] = useState(false);
  const [supplierSort, setSupplierSort] = useState<'name' | 'spent_desc' | 'debt_desc'>('name');
  const [stockView, setStockView] = useState<'cards' | 'table'>('cards');
  const [supplierView, setSupplierView] = useState<'cards' | 'table'>('cards');
  const [stockTablePage, setStockTablePage] = useState(1);
  const [stockTablePageSize, setStockTablePageSize] = useState(10);
  const [supplierTablePage, setSupplierTablePage] = useState(1);
  const [supplierTablePageSize, setSupplierTablePageSize] = useState(10);
  const [stockTableSort, setStockTableSort] = useState<{
    key: 'name' | 'reference' | 'category' | 'type' | 'quantity' | 'value' | 'supplier';
    direction: 'asc' | 'desc';
  }>({ key: 'name', direction: 'asc' });
  const [supplierTableSort, setSupplierTableSort] = useState<{
    key: 'name' | 'contact' | 'city' | 'orders' | 'spent' | 'debt';
    direction: 'asc' | 'desc';
  }>({ key: 'name', direction: 'asc' });
  const [stockColumnsVisibility, setStockColumnsVisibility] = useState<Record<string, boolean>>({
    article: true,
    reference: true,
    category: true,
    type: true,
    stock: true,
    value: true,
    supplier: true,
    actions: true,
  });
  const [supplierColumnsVisibility, setSupplierColumnsVisibility] = useState<Record<string, boolean>>({
    supplier: true,
    contact: true,
    city: true,
    orders: true,
    spent: true,
    debt: true,
    actions: true,
  });
  const [stockColumnFilters, setStockColumnFilters] = useState({
    article: '',
    reference: '',
    category: '',
    type: 'all' as 'all' | 'internal' | 'external',
    supplier: '',
    minStock: '',
    maxStock: '',
    minValue: '',
    maxValue: '',
  });
  const [supplierColumnFilters, setSupplierColumnFilters] = useState({
    supplier: '',
    contact: '',
    city: '',
    minOrders: '',
    minSpent: '',
    minDebt: '',
  });
  
  // Form states
  const [stockFormOpen, setStockFormOpen] = useState(false);
  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  const [restockFormOpen, setRestockFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | undefined>();
  const [editingSupplier, setEditingSupplier] = useState<StockSupplier | undefined>();
  const [restockingItem, setRestockingItem] = useState<StockItem | null>(null);

  const { data: purchaseOrders = [] } = usePurchaseOrders();
  const { data: supplierInvoices = [] } = useSupplierInvoices();
  const { data: companyProfile } = useTourismCompanyProfile();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [itemsData, suppliersData] = await Promise.all([
        getStockItems(),
        getSuppliers()
      ]);
      setStockItems(itemsData);
      setSuppliers(suppliersData);
    } catch (error) {
      console.error('Error fetching stock data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setIsTxLoading(true);
    try {
      const data = await getStockTransactions();
      const internalOnly = data.filter((tx) => tx.item?.stock_type === 'internal');
      setTransactions(internalOnly);
    } catch (error) {
      console.error('Error fetching stock transactions:', error);
      toast.error('Erreur lors du chargement des mouvements de stock');
    } finally {
      setIsTxLoading(false);
    }
  };

  const fetchHistoryTransactions = async () => {
    setIsHistoryLoading(true);
    try {
      const data = await getStockTransactions();
      setHistoryTransactions(data);
    } catch (error) {
      console.error('Error fetching full stock transactions:', error);
      toast.error('Erreur lors du chargement de l’historique complet');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    if (historyOpen) {
      fetchHistoryTransactions();
    }
  }, [historyOpen]);

  useEffect(() => {
    setCategories((current) => {
      const merged = new Map(current.map((category) => [category.value, category]));
      stockItems.forEach((item) => {
        const value = item.category?.trim();
        if (!value) return;
        if (!merged.has(value)) {
          merged.set(value, { value, label: getCategoryLabel(value) });
        }
      });
      return Array.from(merged.values());
    });
  }, [stockItems]);

  // Calculate stats
  const totalItems = stockItems.length;
  const lowStockItems = stockItems.filter(item => item.quantity <= item.min_quantity).length;
  const totalValue = stockItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const totalSuppliers = suppliers.length;
  const internalItemsCount = stockItems.filter((item) => item.stock_type === 'internal').length;
  const externalItemsCount = stockItems.filter((item) => item.stock_type !== 'internal').length;
  const lowStockValue = stockItems
    .filter((item) => item.quantity <= item.min_quantity)
    .reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  const supplierAggregates = useMemo(() => {
    type Agg = {
      ordersCount: number;
      ordersTotal: number;
      invoicesCount: number;
      invoicesTotal: number;
      outstandingAmount: number;
      lastInvoiceDate: string | null;
    };

    const map = new Map<string, Agg>();

    const ensure = (name: string) => {
      const key = normalizeSupplierName(name);
      if (!key) return null;
      if (!map.has(key)) {
        map.set(key, {
          ordersCount: 0,
          ordersTotal: 0,
          invoicesCount: 0,
          invoicesTotal: 0,
          outstandingAmount: 0,
          lastInvoiceDate: null,
        });
      }
      return map.get(key)!;
    };

    purchaseOrders.forEach((order) => {
      const agg = ensure(order.supplier_name);
      if (!agg) return;
      agg.ordersCount += 1;
      const total = typeof order.total_amount === 'number'
        ? order.total_amount
        : (order as any).total_amount ?? order.subtotal ?? 0;
      agg.ordersTotal += Number(total) || 0;
    });

    supplierInvoices.forEach((invoice) => {
      const agg = ensure(invoice.supplier_name);
      if (!agg) return;
      agg.invoicesCount += 1;
      const total = typeof invoice.total_amount === 'number'
        ? invoice.total_amount
        : (invoice as any).total_amount ?? invoice.subtotal ?? 0;
      const numericTotal = Number(total) || 0;
      agg.invoicesTotal += numericTotal;
      const isPaid = invoice.status === 'paid';
      if (!isPaid) {
        agg.outstandingAmount += numericTotal;
      }
      if (!agg.lastInvoiceDate || invoice.invoice_date > agg.lastInvoiceDate) {
        agg.lastInvoiceDate = invoice.invoice_date;
      }
    });

    return map;
  }, [purchaseOrders, supplierInvoices]);

  const suppliersWithStats: StockSupplier[] = useMemo(
    () =>
      suppliers.map((supplier) => {
        const key = normalizeSupplierName(supplier.name);
        const agg = key ? supplierAggregates.get(key) : undefined;
        return {
          ...supplier,
          ordersCount: agg?.ordersCount ?? supplier.ordersCount,
          totalSpent: agg?.invoicesTotal ?? supplier.totalSpent,
          invoicesCount: agg?.invoicesCount ?? supplier.invoicesCount,
          outstandingAmount: agg?.outstandingAmount ?? supplier.outstandingAmount ?? 0,
          lastInvoiceDate: agg?.lastInvoiceDate ?? supplier.lastInvoiceDate ?? null,
        };
      }),
    [suppliers, supplierAggregates],
  );

  // Filter items
  const filteredItems = stockItems.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesType =
      stockTypeFilter === 'all' ||
      (stockTypeFilter === 'internal' ? item.stock_type === 'internal' : item.stock_type !== 'internal');
    const isLowStock = item.quantity <= item.min_quantity;
    const matchesLowStock = !showOnlyLowStock || isLowStock;
    return matchesSearch && matchesCategory && matchesType && matchesLowStock;
  });

  const sortedItems = useMemo(() => {
    const items = [...filteredItems];
    if (sortBy === 'name') {
      return items.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortBy === 'qty_asc') {
      return items.sort((a, b) => a.quantity - b.quantity);
    }
    if (sortBy === 'qty_desc') {
      return items.sort((a, b) => b.quantity - a.quantity);
    }
    if (sortBy === 'value_desc') {
      return items.sort(
        (a, b) => b.quantity * b.unit_price - a.quantity * a.unit_price,
      );
    }
    return items;
  }, [filteredItems, sortBy]);

  // Filter suppliers
  const filteredSuppliers = suppliersWithStats.filter((supplier) =>
    supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (supplier.city?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false),
  );

  const sortedSuppliers = useMemo(() => {
    const list = [...filteredSuppliers];
    if (supplierSort === 'name') {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (supplierSort === 'spent_desc') {
      return list.sort(
        (a, b) => (b.totalSpent ?? 0) - (a.totalSpent ?? 0),
      );
    }
    if (supplierSort === 'debt_desc') {
      return list.sort(
        (a, b) => (b.outstandingAmount ?? 0) - (a.outstandingAmount ?? 0),
      );
    }
    return list;
  }, [filteredSuppliers, supplierSort]);

  const stockTableItems = useMemo(() => {
    const list = filteredItems.filter((item) => {
      const byArticle = item.name.toLowerCase().includes(stockColumnFilters.article.trim().toLowerCase());
      const byReference = (item.reference || '').toLowerCase().includes(stockColumnFilters.reference.trim().toLowerCase());
      const byCategory = (item.category || '').toLowerCase().includes(stockColumnFilters.category.trim().toLowerCase());
      const byType =
        stockColumnFilters.type === 'all' ||
        (stockColumnFilters.type === 'internal' ? item.stock_type === 'internal' : item.stock_type !== 'internal');
      const bySupplier = (item.supplier?.name || '').toLowerCase().includes(stockColumnFilters.supplier.trim().toLowerCase());
      const qty = item.quantity;
      const value = item.quantity * item.unit_price;
      const minStock = stockColumnFilters.minStock.trim() === '' ? Number.NEGATIVE_INFINITY : Number(stockColumnFilters.minStock);
      const maxStock = stockColumnFilters.maxStock.trim() === '' ? Number.POSITIVE_INFINITY : Number(stockColumnFilters.maxStock);
      const minValue = stockColumnFilters.minValue.trim() === '' ? Number.NEGATIVE_INFINITY : Number(stockColumnFilters.minValue);
      const maxValue = stockColumnFilters.maxValue.trim() === '' ? Number.POSITIVE_INFINITY : Number(stockColumnFilters.maxValue);
      const byStockRange = qty >= minStock && qty <= maxStock;
      const byValueRange = value >= minValue && value <= maxValue;
      return byArticle && byReference && byCategory && byType && bySupplier && byStockRange && byValueRange;
    });
    list.sort((a, b) => {
      const factor = stockTableSort.direction === 'asc' ? 1 : -1;
      if (stockTableSort.key === 'name') return a.name.localeCompare(b.name) * factor;
      if (stockTableSort.key === 'reference') return (a.reference || '').localeCompare(b.reference || '') * factor;
      if (stockTableSort.key === 'category') return (a.category || '').localeCompare(b.category || '') * factor;
      if (stockTableSort.key === 'type') return a.stock_type.localeCompare(b.stock_type) * factor;
      if (stockTableSort.key === 'quantity') return (a.quantity - b.quantity) * factor;
      if (stockTableSort.key === 'value') return ((a.quantity * a.unit_price) - (b.quantity * b.unit_price)) * factor;
      if (stockTableSort.key === 'supplier') return (a.supplier?.name || '').localeCompare(b.supplier?.name || '') * factor;
      return 0;
    });
    return list;
  }, [filteredItems, stockColumnFilters, stockTableSort]);

  const supplierTableItems = useMemo(() => {
    const list = filteredSuppliers.filter((supplier) => {
      const bySupplier = supplier.name.toLowerCase().includes(supplierColumnFilters.supplier.trim().toLowerCase());
      const byContact = (supplier.contact_name || supplier.phone || '').toLowerCase().includes(supplierColumnFilters.contact.trim().toLowerCase());
      const byCity = (supplier.city || '').toLowerCase().includes(supplierColumnFilters.city.trim().toLowerCase());
      const minOrders = supplierColumnFilters.minOrders.trim() === '' ? Number.NEGATIVE_INFINITY : Number(supplierColumnFilters.minOrders);
      const minSpent = supplierColumnFilters.minSpent.trim() === '' ? Number.NEGATIVE_INFINITY : Number(supplierColumnFilters.minSpent);
      const minDebt = supplierColumnFilters.minDebt.trim() === '' ? Number.NEGATIVE_INFINITY : Number(supplierColumnFilters.minDebt);
      const byOrders = (supplier.ordersCount || 0) >= minOrders;
      const bySpent = (supplier.totalSpent || 0) >= minSpent;
      const byDebt = (supplier.outstandingAmount || 0) >= minDebt;
      return bySupplier && byContact && byCity && byOrders && bySpent && byDebt;
    });
    list.sort((a, b) => {
      const factor = supplierTableSort.direction === 'asc' ? 1 : -1;
      if (supplierTableSort.key === 'name') return a.name.localeCompare(b.name) * factor;
      if (supplierTableSort.key === 'contact') return (a.contact_name || a.phone || '').localeCompare(b.contact_name || b.phone || '') * factor;
      if (supplierTableSort.key === 'city') return (a.city || '').localeCompare(b.city || '') * factor;
      if (supplierTableSort.key === 'orders') return ((a.ordersCount || 0) - (b.ordersCount || 0)) * factor;
      if (supplierTableSort.key === 'spent') return ((a.totalSpent || 0) - (b.totalSpent || 0)) * factor;
      if (supplierTableSort.key === 'debt') return ((a.outstandingAmount || 0) - (b.outstandingAmount || 0)) * factor;
      return 0;
    });
    return list;
  }, [filteredSuppliers, supplierColumnFilters, supplierTableSort]);

  const stockTablePages = Math.max(1, Math.ceil(stockTableItems.length / stockTablePageSize));
  const supplierTablePages = Math.max(1, Math.ceil(supplierTableItems.length / supplierTablePageSize));

  const paginatedStockTableItems = useMemo(
    () => stockTableItems.slice((stockTablePage - 1) * stockTablePageSize, stockTablePage * stockTablePageSize),
    [stockTableItems, stockTablePage, stockTablePageSize],
  );
  const paginatedSupplierTableItems = useMemo(
    () => supplierTableItems.slice((supplierTablePage - 1) * supplierTablePageSize, supplierTablePage * supplierTablePageSize),
    [supplierTableItems, supplierTablePage, supplierTablePageSize],
  );

  useEffect(() => {
    setStockTablePage(1);
  }, [searchQuery, categoryFilter, stockTypeFilter, showOnlyLowStock, stockTablePageSize, stockColumnFilters]);

  useEffect(() => {
    setSupplierTablePage(1);
  }, [searchQuery, supplierSort, supplierTablePageSize, supplierColumnFilters]);

  useEffect(() => {
    if (stockTablePage > stockTablePages) {
      setStockTablePage(stockTablePages);
    }
  }, [stockTablePage, stockTablePages]);

  useEffect(() => {
    if (supplierTablePage > supplierTablePages) {
      setSupplierTablePage(supplierTablePages);
    }
  }, [supplierTablePage, supplierTablePages]);

  const filteredTransactions = transactions.filter((tx) => {
    const createdAt = new Date(tx.created_at);
    const matchesType = txTypeFilter === 'all' || tx.type === txTypeFilter;
    const matchesStart = !txStartDate || createdAt >= new Date(txStartDate);
    const matchesEnd = !txEndDate || createdAt <= new Date(txEndDate + 'T23:59:59');
    const notes = tx.notes?.toLowerCase() || '';
    const matchesVehicle =
      txVehicleFilter.trim().length === 0 ||
      notes.includes(txVehicleFilter.trim().toLowerCase());
    return matchesType && matchesStart && matchesEnd && matchesVehicle;
  });

  const filteredHistoryTransactions = historyTransactions.filter((tx) => {
    const createdAt = new Date(tx.created_at);
    const matchesType = historyTypeFilter === 'all' || tx.type === historyTypeFilter;
    const matchesStart = !historyStartDate || createdAt >= new Date(historyStartDate);
    const matchesEnd = !historyEndDate || createdAt <= new Date(historyEndDate + 'T23:59:59');
    const createdBy = (tx.created_by || '').toLowerCase();
    const itemName = (tx.item?.name || '').toLowerCase();
    const matchesUser = !historyUserFilter.trim() || createdBy.includes(historyUserFilter.trim().toLowerCase());
    const matchesItem = !historyItemFilter.trim() || itemName.includes(historyItemFilter.trim().toLowerCase());
    return matchesType && matchesStart && matchesEnd && matchesUser && matchesItem;
  });

  const inCount = filteredTransactions.filter((tx) => tx.type === 'IN').length;
  const outCount = filteredTransactions.filter((tx) => tx.type === 'OUT').length;
  const adjustmentCount = filteredTransactions.filter((tx) => tx.type === 'ADJUSTMENT').length;
  const totalOutQuantity = filteredTransactions
    .filter((tx) => tx.type === 'OUT')
    .reduce((sum, tx) => sum + (tx.quantity || 0), 0);

  const parsedConsumption = useMemo(() => {
    const byVehicle: Record<
      string,
      { vehiclePlate: string; totalQuantity: number; totalCost: number; lines: number }
    > = {};
    const byRevisionType: Record<
      string,
      { type: string; totalQuantity: number; totalCost: number; lines: number }
    > = {};

    filteredTransactions
      .filter((tx) => tx.type === 'OUT')
      .forEach((tx) => {
        const notes = tx.notes || '';
        const lower = notes.toLowerCase();
        const unitPrice = tx.item?.unit_price ?? 0;
        const qty = tx.quantity || 0;
        const cost = unitPrice * qty;

        let vehiclePlate: string | null = null;
        let revisionType: string | null = null;

        if (lower.startsWith('révision ')) {
          const parts = notes.split(' ');
          if (parts.length >= 4) {
            revisionType = parts[1];
            const vehIndex = parts.findIndex(
              (p) => p.toLowerCase().startsWith('véhicule'),
            );
            if (vehIndex >= 0 && vehIndex + 1 < parts.length) {
              vehiclePlate = parts.slice(vehIndex + 1).join(' ').trim();
            }
          }
        } else if (lower.startsWith('maintenance véhicule ')) {
          const afterPrefix = notes.slice('Maintenance véhicule '.length);
          const dashIndex = afterPrefix.indexOf(' - ');
          if (dashIndex > 0) {
            vehiclePlate = afterPrefix.slice(0, dashIndex).trim();
          } else {
            vehiclePlate = afterPrefix.trim();
          }
        }

        if (vehiclePlate) {
          const key = vehiclePlate;
          if (!byVehicle[key]) {
            byVehicle[key] = {
              vehiclePlate: key,
              totalQuantity: 0,
              totalCost: 0,
              lines: 0,
            };
          }
          byVehicle[key].totalQuantity += qty;
          byVehicle[key].totalCost += cost;
          byVehicle[key].lines += 1;
        }

        if (revisionType) {
          const key = revisionType;
          if (!byRevisionType[key]) {
            byRevisionType[key] = {
              type: key,
              totalQuantity: 0,
              totalCost: 0,
              lines: 0,
            };
          }
          byRevisionType[key].totalQuantity += qty;
          byRevisionType[key].totalCost += cost;
          byRevisionType[key].lines += 1;
        }
      });

    return {
      byVehicle: Object.values(byVehicle).sort((a, b) =>
        a.vehiclePlate.localeCompare(b.vehiclePlate),
      ),
      byRevisionType: Object.values(byRevisionType),
    };
  }, [filteredTransactions]);

  // Handlers
  const handleStockSubmit = async (data: any) => {
    try {
      if (editingItem) {
        await updateStockItem(editingItem.id, data);
        toast.success('Article modifié avec succès');
      } else {
        await createStockItem(data);
        toast.success('Article ajouté avec succès');
      }
      setStockFormOpen(false);
      setEditingItem(undefined);
      fetchData();
      fetchTransactions();
      if (historyOpen) fetchHistoryTransactions();
    } catch (error) {
      console.error('Error saving stock item:', error);
      toast.error('Erreur lors de l\'enregistrement de l\'article');
    }
  };

  const handleEditItem = (item: StockItem) => {
    setEditingItem(item);
    setStockFormOpen(true);
  };

  const handleRestock = (item: StockItem) => {
    setRestockingItem(item);
    setRestockFormOpen(true);
  };

  const handleRestockSubmit = async (itemId: string, quantity: number, notes?: string) => {
    try {
      await restockItem(itemId, quantity, notes);
      toast.success(`Réapprovisionnement de ${quantity} unités enregistré`);
      setRestockFormOpen(false);
      setRestockingItem(null);
      fetchData();
      fetchTransactions();
      if (historyOpen) fetchHistoryTransactions();
    } catch (error) {
      console.error('Error restocking item:', error);
      toast.error('Erreur lors du réapprovisionnement');
    }
  };

  const handleSupplierSubmit = async (data: any) => {
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, data);
        toast.success('Fournisseur modifié avec succès');
      } else {
        await createSupplier(data);
        toast.success('Fournisseur ajouté avec succès');
      }
      setSupplierFormOpen(false);
      setEditingSupplier(undefined);
      fetchData();
      fetchTransactions();
      if (historyOpen) fetchHistoryTransactions();
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast.error('Erreur lors de l\'enregistrement du fournisseur');
    }
  };

  const handleEditSupplier = (supplier: StockSupplier) => {
    setEditingSupplier(supplier);
    setSupplierFormOpen(true);
  };

  const handleViewSupplier = (supplier: StockSupplier) => {
    navigate(`/stock/suppliers/${supplier.id}`);
  };

  const handleAddCategory = () => {
    const value = newCategoryLabel.trim();
    if (!value) {
      toast.error('Nom de catégorie requis');
      return;
    }
    const exists = categories.some(
      (category) =>
        category.value.toLowerCase() === value.toLowerCase() ||
        category.label.toLowerCase() === value.toLowerCase()
    );
    if (exists) {
      toast.info('Catégorie déjà existante');
      return;
    }
    setCategories((current) => [...current, { value, label: value }]);
    setNewCategoryLabel('');
    setCategoryDialogOpen(false);
  };

  const dataUrlFromBlob = async (blob: Blob) =>
    await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(blob);
    });

  const extractStoragePath = (logo: string) => {
    if (!logo) return null;
    if (!logo.startsWith('http')) return logo.split('?')[0];

    const publicMarker = '/storage/v1/object/public/tourism-assets/';
    const signedMarker = '/storage/v1/object/sign/tourism-assets/';

    const publicIdx = logo.indexOf(publicMarker);
    if (publicIdx >= 0) return logo.slice(publicIdx + publicMarker.length).split('?')[0];

    const signedIdx = logo.indexOf(signedMarker);
    if (signedIdx >= 0) return logo.slice(signedIdx + signedMarker.length).split('?')[0];

    return null;
  };

  const loadCompanyLogoDataUrl = async () => {
    if (!companyProfile?.logo_url) return null;
    try {
      const path = extractStoragePath(companyProfile.logo_url);
      if (path) {
        const { data: fileBlob, error } = await supabase.storage.from('tourism-assets').download(path);
        if (!error && fileBlob) {
          return await dataUrlFromBlob(fileBlob);
        }
      }
      const srcUrl = companyProfile.logo_url.includes('?')
        ? companyProfile.logo_url
        : `${companyProfile.logo_url}?t=${Date.now()}`;
      const response = await fetch(srcUrl, { cache: 'no-cache', headers: { Accept: 'image/*' } });
      if (!response.ok) return null;
      const blob = await response.blob();
      return await dataUrlFromBlob(blob);
    } catch {
      return null;
    }
  };

  const applyPdfBranding = async (doc: jsPDF, headerColor: [number, number, number], reportTitle: string, generatedAt: string) => {
    const companyName = companyProfile?.company_name || 'SFTM';
    const logoX = 14;
    const logoY = 5;
    const logoW = 28;
    const logoH = 18;

    doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
    doc.rect(0, 0, 210, 28, 'F');

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(logoX, logoY, logoW, logoH, 2, 2, 'F');

    const logoDataUrl = await loadCompanyLogoDataUrl();
    if (logoDataUrl) {
      const formatMatch = logoDataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,/);
      const rawFormat = formatMatch ? formatMatch[1].toUpperCase() : 'PNG';
      const format = rawFormat === 'JPG' ? 'JPEG' : rawFormat;
      doc.addImage(logoDataUrl, format as any, logoX + 1, logoY + 1, logoW - 2, logoH - 2, undefined, 'FAST');
    } else {
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('LOGO', logoX + logoW / 2, logoY + logoH / 2 + 2, { align: 'center' });
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(companyName, 46, 12);
    doc.setFontSize(10);
    doc.text(reportTitle, 46, 20);
    doc.text(generatedAt, 196, 20, { align: 'right' });
  };

  const applyPdfFooterAndPagination = (doc: jsPDF) => {
    const totalPages = doc.getNumberOfPages();
    const contactLine = [companyProfile?.contact_email, companyProfile?.contact_phone].filter(Boolean).join(' | ');
    const footerLine = [companyProfile?.address, companyProfile?.tax_info].filter(Boolean).join(' | ');

    for (let i = 1; i <= totalPages; i += 1) {
      doc.setPage(i);
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setDrawColor(226, 232, 240);
      doc.line(14, pageHeight - 18, 196, pageHeight - 18);
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8.5);
      if (contactLine) doc.text(contactLine, 14, pageHeight - 11);
      if (footerLine) doc.text(footerLine, 14, pageHeight - 6);
      doc.text(`Page ${i}/${totalPages}`, 196, pageHeight - 6, { align: 'right' });
    }
  };

  const exportStockPdf = async () => {
    const doc = new jsPDF();
    const generatedAt = new Date().toLocaleString('fr-FR');
    const activeSearch = searchQuery.trim() || 'Tous';
    const activeCategory = categoryFilter === 'all' ? 'Toutes' : getCategoryLabel(categoryFilter);
    const activeType =
      stockTypeFilter === 'all'
        ? 'Tous'
        : stockTypeFilter === 'internal'
        ? 'Interne'
        : 'Externe';

    await applyPdfBranding(doc, [17, 24, 39], 'Rapport Stock', generatedAt);

    doc.setTextColor(17, 24, 39);
    doc.setFontSize(11);
    doc.text(`Articles: ${totalItems}`, 14, 38);
    doc.text(`Stock faible: ${lowStockItems}`, 70, 38);
    doc.text(`Valeur totale: ${formatCurrency(totalValue)}`, 125, 38);
    doc.setFontSize(9);
    doc.text(
      `Filtres - Recherche: ${activeSearch} | Catégorie: ${activeCategory} | Type: ${activeType} | Faible uniquement: ${showOnlyLowStock ? 'Oui' : 'Non'}`,
      14,
      44,
    );

    autoTable(doc, {
      startY: 48,
      head: [['Référence', 'Article', 'Catégorie', 'Type', 'Qté', 'Min', 'Prix U', 'Valeur', 'Fournisseur', 'Statut']],
      body: stockTableItems.map((item) => [
        item.reference || '-',
        item.name,
        item.category || '-',
        item.stock_type === 'internal' ? 'Interne' : 'Externe',
        `${item.quantity} ${item.unit}`,
        `${item.min_quantity} ${item.unit}`,
        formatCurrency(item.unit_price),
        formatCurrency(item.quantity * item.unit_price),
        item.supplier?.name || '-',
        item.quantity <= item.min_quantity ? 'Faible' : 'Normal',
      ]),
      styles: { fontSize: 9, cellPadding: 2.8 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
      },
    });

    applyPdfFooterAndPagination(doc);
    doc.save(`stock-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportMovementsPdf = async () => {
    const doc = new jsPDF();
    const generatedAt = new Date().toLocaleString('fr-FR');
    const typeLabel =
      txTypeFilter === 'all'
        ? 'Tous'
        : txTypeFilter === 'IN'
        ? 'Entrées'
        : txTypeFilter === 'OUT'
        ? 'Sorties'
        : 'Ajustements';
    const dateRangeLabel =
      txStartDate || txEndDate
        ? `${txStartDate || '...'} → ${txEndDate || '...'}`
        : 'Toutes les dates';
    const vehicleLabel = txVehicleFilter.trim() || 'Tous';
    const totalEstimatedAmount = filteredTransactions.reduce(
      (sum, tx) => sum + (tx.item?.unit_price || 0) * Math.abs(tx.quantity || 0),
      0,
    );

    await applyPdfBranding(doc, [15, 118, 110], 'Facture interne consommation stock', generatedAt);

    doc.setTextColor(17, 24, 39);
    doc.setFontSize(11);
    doc.text(`Entrées: ${inCount}`, 14, 38);
    doc.text(`Sorties: ${outCount}`, 60, 38);
    doc.text(`Ajustements: ${adjustmentCount}`, 102, 38);
    doc.text(`Qté sortie: ${totalOutQuantity}`, 160, 38, { align: 'right' });
    doc.setFontSize(9);
    doc.text(`Filtres - Type: ${typeLabel} | Date: ${dateRangeLabel} | Véhicule: ${vehicleLabel}`, 14, 44);
    doc.text(`Montant total estimé (tous mouvements): ${formatCurrency(totalEstimatedAmount)}`, 14, 49);

    autoTable(doc, {
      startY: 54,
      head: [['Date', 'Article', 'Type', 'Quantité', 'Avant', 'Après', 'Montant estimé', 'Utilisateur', 'Notes']],
      body: filteredTransactions.map((tx) => [
        new Date(tx.created_at).toLocaleString('fr-FR'),
        tx.item?.name || '-',
        tx.type === 'IN' ? 'Entrée' : tx.type === 'OUT' ? 'Sortie' : 'Ajustement',
        `${tx.type === 'OUT' ? '-' : tx.type === 'IN' ? '+' : ''}${tx.quantity}`,
        String(tx.previous_quantity ?? '-'),
        String(tx.new_quantity ?? '-'),
        formatCurrency((tx.item?.unit_price || 0) * (tx.quantity || 0)),
        tx.created_by || '-',
        tx.notes || '-',
      ]),
      styles: { fontSize: 8.5, cellPadding: 2.4 },
      headStyles: { fillColor: [13, 148, 136], textColor: 255 },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
    });

    applyPdfFooterAndPagination(doc);
    doc.save(`stock-mouvements-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportHistoryPdf = async () => {
    const doc = new jsPDF();
    const generatedAt = new Date().toLocaleString('fr-FR');
    const typeLabel =
      historyTypeFilter === 'all'
        ? 'Tous'
        : historyTypeFilter === 'IN'
        ? 'Entrées'
        : historyTypeFilter === 'OUT'
        ? 'Sorties'
        : 'Ajustements';
    const dateRangeLabel =
      historyStartDate || historyEndDate
        ? `${historyStartDate || '...'} → ${historyEndDate || '...'}`
        : 'Toutes les dates';
    const userLabel = historyUserFilter.trim() || 'Tous';
    const itemLabel = historyItemFilter.trim() || 'Tous';

    await applyPdfBranding(doc, [30, 64, 175], 'Historique complet des mouvements stock', generatedAt);

    doc.setTextColor(17, 24, 39);
    doc.setFontSize(9);
    doc.text(`Filtres - Type: ${typeLabel} | Date: ${dateRangeLabel}`, 14, 36);
    doc.text(`Utilisateur: ${userLabel} | Article: ${itemLabel}`, 14, 41);
    doc.text(`Nombre de lignes: ${filteredHistoryTransactions.length}`, 14, 46);

    autoTable(doc, {
      startY: 50,
      head: [['Date', 'Article', 'Type', 'Quantité', 'Avant', 'Après', 'Utilisateur', 'Notes']],
      body: filteredHistoryTransactions.map((tx) => [
        new Date(tx.created_at).toLocaleString('fr-FR'),
        tx.item?.name || '-',
        tx.type === 'IN' ? 'Entrée' : tx.type === 'OUT' ? 'Sortie' : 'Ajustement',
        `${tx.type === 'OUT' ? '-' : tx.type === 'IN' ? '+' : ''}${tx.quantity}`,
        String(tx.previous_quantity ?? '-'),
        String(tx.new_quantity ?? '-'),
        tx.created_by || '-',
        tx.notes || '-',
      ]),
      styles: { fontSize: 8.5, cellPadding: 2.3 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255 },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
      },
    });

    applyPdfFooterAndPagination(doc);
    doc.save(`stock-historique-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportHistoryCsv = () => {
    const escapeCsv = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const headers = ['Date', 'Article', 'Type', 'Quantité', 'Avant', 'Après', 'Utilisateur', 'Notes'];
    const rows = filteredHistoryTransactions.map((tx) => [
      new Date(tx.created_at).toLocaleString('fr-FR'),
      tx.item?.name || '',
      tx.type === 'IN' ? 'Entrée' : tx.type === 'OUT' ? 'Sortie' : 'Ajustement',
      `${tx.type === 'OUT' ? '-' : tx.type === 'IN' ? '+' : ''}${tx.quantity}`,
      tx.previous_quantity ?? '',
      tx.new_quantity ?? '',
      tx.created_by || '',
      tx.notes || '',
    ]);
    const csv = [headers, ...rows].map((line) => line.map(escapeCsv).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stock-historique-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportStockCsv = () => {
    const escapeCsv = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const headers = ['Article', 'Référence', 'Catégorie', 'Type', 'Quantité', 'Min', 'Prix U', 'Valeur', 'Fournisseur'];
    const rows = stockTableItems.map((item) => [
      item.name,
      item.reference || '',
      item.category || '',
      item.stock_type === 'internal' ? 'Interne' : 'Externe',
      `${item.quantity} ${item.unit}`,
      `${item.min_quantity} ${item.unit}`,
      formatCurrency(item.unit_price),
      formatCurrency(item.quantity * item.unit_price),
      item.supplier?.name || '',
    ]);
    const csv = [headers, ...rows].map((line) => line.map(escapeCsv).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stock-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportSuppliersCsv = () => {
    const escapeCsv = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const headers = ['Fournisseur', 'Contact', 'Ville', 'Commandes', 'Total dépensé', 'Dette'];
    const rows = supplierTableItems.map((supplier) => [
      supplier.name,
      supplier.contact_name || supplier.phone || '',
      supplier.city || '',
      supplier.ordersCount || 0,
      formatCurrency(supplier.totalSpent || 0),
      formatCurrency(supplier.outstandingAmount || 0),
    ]);
    const csv = [headers, ...rows].map((line) => line.map(escapeCsv).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fournisseurs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleStockSort = (key: 'name' | 'reference' | 'category' | 'type' | 'quantity' | 'value' | 'supplier') => {
    setStockTableSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const toggleSupplierSort = (key: 'name' | 'contact' | 'city' | 'orders' | 'spent' | 'debt') => {
    setSupplierTableSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Stock</h1>
            <p className="text-muted-foreground">Gestion des articles, fournisseurs, mouvements internes et rapports PDF</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportStockPdf}>
              <FileDown className="w-4 h-4 mr-2" />
              PDF stock
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4"
        >
          <Card className="dashboard-panel">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Articles en stock</p>
                  <p className="text-2xl font-bold text-foreground">{totalItems}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="dashboard-panel">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Stock faible</p>
                  <p className="text-2xl font-bold text-destructive">{lowStockItems}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="dashboard-panel">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valeur totale</p>
                  <p className="text-2xl font-bold text-foreground">{(totalValue).toFixed(2)} MAD</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="dashboard-panel">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fournisseurs</p>
                  <p className="text-2xl font-bold text-foreground">{totalSuppliers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="dashboard-panel">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Boxes className="w-5 h-5 text-violet-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Interne / Externe</p>
                  <p className="text-xl font-bold text-foreground">{internalItemsCount} / {externalItemsCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="dashboard-panel">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valeur stock faible</p>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(lowStockValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="stock" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <TabsList>
              <TabsTrigger value="stock" className="gap-2">
                <Package className="w-4 h-4" />
                Articles
              </TabsTrigger>
              <TabsTrigger value="suppliers" className="gap-2">
                <Building2 className="w-4 h-4" />
                Fournisseurs
              </TabsTrigger>
              <TabsTrigger value="movements" className="gap-2">
                <History className="w-4 h-4" />
                Mouvements internes
              </TabsTrigger>
            </TabsList>

            <div className="flex gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {/* Stock Tab */}
          <TabsContent value="stock" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les catégories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={stockTypeFilter} onValueChange={(v) => setStockTypeFilter(v as 'all' | 'internal' | 'external')}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Type de stock" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="internal">Stock interne</SelectItem>
                    <SelectItem value="external">Stock externe</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Ordre d'affichage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Par nom</SelectItem>
                    <SelectItem value="qty_asc">Quantité croissante</SelectItem>
                    <SelectItem value="qty_desc">Quantité décroissante</SelectItem>
                    <SelectItem value="value_desc">Valeur décroissante</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant={showOnlyLowStock ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowOnlyLowStock((v) => !v)}
                >
                  Stock faible seulement
                </Button>
                <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      Ajouter catégorie
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Ajouter une catégorie</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nom de la catégorie</Label>
                        <Input
                          value={newCategoryLabel}
                          onChange={(e) => setNewCategoryLabel(e.target.value)}
                          placeholder="Ex: Batteries"
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                          Annuler
                        </Button>
                        <Button onClick={handleAddCategory}>Ajouter</Button>
                      </DialogFooter>
                    </div>
                  </DialogContent>
                </Dialog>
                <div className="flex items-center rounded-md border border-border p-1">
                  <Button
                    variant={stockView === 'cards' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setStockView('cards')}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={stockView === 'table' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setStockView('table')}
                  >
                    <Rows3 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <Button onClick={() => { setEditingItem(undefined); setStockFormOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Nouvel article
              </Button>
            </div>

            {lowStockItems > 0 && (
              <Card className="dashboard-panel border-destructive/50 animate-in slide-in-from-top-2">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    <div>
                      <p className="font-medium text-destructive">Attention: {lowStockItems} article(s) en stock faible</p>
                      <p className="text-sm text-muted-foreground">Pensez à réapprovisionner ces articles</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {stockView === 'cards' ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {sortedItems.map((item) => (
                  <StockItemCard
                    key={item.id}
                    item={item}
                    onEdit={handleEditItem}
                    onRestock={handleRestock}
                  />
                ))}
              </motion.div>
            ) : (
              <Card className="dashboard-panel p-0 overflow-hidden">
                <CardContent className="p-3 border-b flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={exportStockCsv}>
                      <FileDown className="w-4 h-4 mr-2" />
                      Export CSV
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">Colonnes</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Afficher/masquer</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {[
                          { key: 'article', label: 'Article' },
                          { key: 'reference', label: 'Référence' },
                          { key: 'category', label: 'Catégorie' },
                          { key: 'type', label: 'Type' },
                          { key: 'stock', label: 'Stock' },
                          { key: 'value', label: 'Valeur' },
                          { key: 'supplier', label: 'Fournisseur' },
                          { key: 'actions', label: 'Actions' },
                        ].map((column) => (
                          <DropdownMenuCheckboxItem
                            key={column.key}
                            checked={stockColumnsVisibility[column.key]}
                            onCheckedChange={(checked) =>
                              setStockColumnsVisibility((current) => ({ ...current, [column.key]: checked === true }))
                            }
                          >
                            {column.label}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Lignes</Label>
                    <Select
                      value={String(stockTablePageSize)}
                      onValueChange={(value) => setStockTablePageSize(Number(value))}
                    >
                      <SelectTrigger className="w-20 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {stockColumnsVisibility.article && (
                          <TableHead>
                            <Button variant="ghost" size="sm" onClick={() => toggleStockSort('name')}>Article</Button>
                          </TableHead>
                        )}
                        {stockColumnsVisibility.reference && (
                          <TableHead>
                            <Button variant="ghost" size="sm" onClick={() => toggleStockSort('reference')}>Référence</Button>
                          </TableHead>
                        )}
                        {stockColumnsVisibility.category && (
                          <TableHead>
                            <Button variant="ghost" size="sm" onClick={() => toggleStockSort('category')}>Catégorie</Button>
                          </TableHead>
                        )}
                        {stockColumnsVisibility.type && (
                          <TableHead>
                            <Button variant="ghost" size="sm" onClick={() => toggleStockSort('type')}>Type</Button>
                          </TableHead>
                        )}
                        {stockColumnsVisibility.stock && (
                          <TableHead className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => toggleStockSort('quantity')}>Stock</Button>
                          </TableHead>
                        )}
                        {stockColumnsVisibility.value && (
                          <TableHead className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => toggleStockSort('value')}>Valeur</Button>
                          </TableHead>
                        )}
                        {stockColumnsVisibility.supplier && (
                          <TableHead>
                            <Button variant="ghost" size="sm" onClick={() => toggleStockSort('supplier')}>Fournisseur</Button>
                          </TableHead>
                        )}
                        {stockColumnsVisibility.actions && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                      <TableRow>
                        {stockColumnsVisibility.article && (
                          <TableHead>
                            <Input
                              className="h-8"
                              placeholder="Filtrer..."
                              value={stockColumnFilters.article}
                              onChange={(e) => setStockColumnFilters((current) => ({ ...current, article: e.target.value }))}
                            />
                          </TableHead>
                        )}
                        {stockColumnsVisibility.reference && (
                          <TableHead>
                            <Input
                              className="h-8"
                              placeholder="Référence..."
                              value={stockColumnFilters.reference}
                              onChange={(e) => setStockColumnFilters((current) => ({ ...current, reference: e.target.value }))}
                            />
                          </TableHead>
                        )}
                        {stockColumnsVisibility.category && (
                          <TableHead>
                            <Input
                              className="h-8"
                              placeholder="Catégorie..."
                              value={stockColumnFilters.category}
                              onChange={(e) => setStockColumnFilters((current) => ({ ...current, category: e.target.value }))}
                            />
                          </TableHead>
                        )}
                        {stockColumnsVisibility.type && (
                          <TableHead>
                            <Select
                              value={stockColumnFilters.type}
                              onValueChange={(value) =>
                                setStockColumnFilters((current) => ({
                                  ...current,
                                  type: value as 'all' | 'internal' | 'external',
                                }))
                              }
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Tous</SelectItem>
                                <SelectItem value="internal">Interne</SelectItem>
                                <SelectItem value="external">Externe</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableHead>
                        )}
                        {stockColumnsVisibility.stock && (
                          <TableHead className="text-right">
                            <div className="grid grid-cols-2 gap-1">
                              <Input
                                type="number"
                                className="h-8"
                                placeholder="Min"
                                value={stockColumnFilters.minStock}
                                onChange={(e) => setStockColumnFilters((current) => ({ ...current, minStock: e.target.value }))}
                              />
                              <Input
                                type="number"
                                className="h-8"
                                placeholder="Max"
                                value={stockColumnFilters.maxStock}
                                onChange={(e) => setStockColumnFilters((current) => ({ ...current, maxStock: e.target.value }))}
                              />
                            </div>
                          </TableHead>
                        )}
                        {stockColumnsVisibility.value && (
                          <TableHead className="text-right">
                            <div className="grid grid-cols-2 gap-1">
                              <Input
                                type="number"
                                className="h-8"
                                placeholder="Min"
                                value={stockColumnFilters.minValue}
                                onChange={(e) => setStockColumnFilters((current) => ({ ...current, minValue: e.target.value }))}
                              />
                              <Input
                                type="number"
                                className="h-8"
                                placeholder="Max"
                                value={stockColumnFilters.maxValue}
                                onChange={(e) => setStockColumnFilters((current) => ({ ...current, maxValue: e.target.value }))}
                              />
                            </div>
                          </TableHead>
                        )}
                        {stockColumnsVisibility.supplier && (
                          <TableHead>
                            <Input
                              className="h-8"
                              placeholder="Fournisseur..."
                              value={stockColumnFilters.supplier}
                              onChange={(e) => setStockColumnFilters((current) => ({ ...current, supplier: e.target.value }))}
                            />
                          </TableHead>
                        )}
                        {stockColumnsVisibility.actions && (
                          <TableHead className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setStockColumnFilters({
                                  article: '',
                                  reference: '',
                                  category: '',
                                  type: 'all',
                                  supplier: '',
                                  minStock: '',
                                  maxStock: '',
                                  minValue: '',
                                  maxValue: '',
                                })
                              }
                            >
                              Reset
                            </Button>
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedStockTableItems.map((item) => {
                        const isLow = item.quantity <= item.min_quantity;
                        return (
                          <TableRow key={item.id} className={isLow ? 'bg-destructive/5' : ''}>
                            {stockColumnsVisibility.article && <TableCell className="font-medium">{item.name}</TableCell>}
                            {stockColumnsVisibility.reference && <TableCell>{item.reference || '-'}</TableCell>}
                            {stockColumnsVisibility.category && <TableCell>{item.category}</TableCell>}
                            {stockColumnsVisibility.type && (
                              <TableCell>
                                <Badge variant="outline">
                                  {item.stock_type === 'internal' ? 'Interne' : 'Externe'}
                                </Badge>
                              </TableCell>
                            )}
                            {stockColumnsVisibility.stock && (
                              <TableCell className="text-right">
                                <span className={isLow ? 'text-destructive font-semibold' : ''}>
                                  {item.quantity} {item.unit}
                                </span>
                              </TableCell>
                            )}
                            {stockColumnsVisibility.value && (
                              <TableCell className="text-right">{formatCurrency(item.quantity * item.unit_price)}</TableCell>
                            )}
                            {stockColumnsVisibility.supplier && <TableCell>{item.supplier?.name || '-'}</TableCell>}
                            {stockColumnsVisibility.actions && (
                              <TableCell className="text-right">
                                <div className="inline-flex gap-2">
                                  <Button variant="outline" size="sm" onClick={() => handleEditItem(item)}>
                                    Modifier
                                  </Button>
                                  <Button size="sm" onClick={() => handleRestock(item)}>
                                    Réappro
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
                <CardContent className="p-3 border-t flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {stockTablePage} / {stockTablePages} • {stockTableItems.length} ligne(s)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={stockTablePage <= 1}
                      onClick={() => setStockTablePage((p) => Math.max(1, p - 1))}
                    >
                      Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={stockTablePage >= stockTablePages}
                      onClick={() => setStockTablePage((p) => Math.min(stockTablePages, p + 1))}
                    >
                      Suivant
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {filteredItems.length === 0 && !isLoading && (
              <div className="text-center py-12">
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground">Aucun article trouvé</p>
                <p className="text-sm text-muted-foreground">Modifiez vos filtres ou ajoutez un nouvel article</p>
              </div>
            )}
            
            {isLoading && (
               <div className="text-center py-12">
                 <p className="text-muted-foreground">Chargement...</p>
               </div>
            )}
          </TabsContent>

          {/* Suppliers Tab */}
          <TabsContent value="suppliers" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={supplierSort} onValueChange={(v) => setSupplierSort(v as typeof supplierSort)}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Ordre des fournisseurs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Par nom</SelectItem>
                    <SelectItem value="spent_desc">Montant dépensé décroissant</SelectItem>
                    <SelectItem value="debt_desc">Dette décroissante</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center rounded-md border border-border p-1">
                  <Button
                    variant={supplierView === 'cards' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setSupplierView('cards')}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={supplierView === 'table' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setSupplierView('table')}
                  >
                    <Rows3 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => { setEditingSupplier(undefined); setSupplierFormOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau fournisseur
                </Button>
              </div>
            </div>

            {supplierView === 'cards' ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {sortedSuppliers.map((supplier) => (
                  <SupplierCard
                    key={supplier.id}
                    supplier={supplier}
                    onEdit={handleEditSupplier}
                    onOrder={() => toast.info('Fonctionnalité de commande en cours de développement')}
                    onView={handleViewSupplier}
                  />
                ))}
              </motion.div>
            ) : (
              <Card className="dashboard-panel p-0 overflow-hidden">
                <CardContent className="p-3 border-b flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={exportSuppliersCsv}>
                      <FileDown className="w-4 h-4 mr-2" />
                      Export CSV
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">Colonnes</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Afficher/masquer</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {[
                          { key: 'supplier', label: 'Fournisseur' },
                          { key: 'contact', label: 'Contact' },
                          { key: 'city', label: 'Ville' },
                          { key: 'orders', label: 'Commandes' },
                          { key: 'spent', label: 'Total dépensé' },
                          { key: 'debt', label: 'Dette' },
                          { key: 'actions', label: 'Actions' },
                        ].map((column) => (
                          <DropdownMenuCheckboxItem
                            key={column.key}
                            checked={supplierColumnsVisibility[column.key]}
                            onCheckedChange={(checked) =>
                              setSupplierColumnsVisibility((current) => ({ ...current, [column.key]: checked === true }))
                            }
                          >
                            {column.label}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Lignes</Label>
                    <Select
                      value={String(supplierTablePageSize)}
                      onValueChange={(value) => setSupplierTablePageSize(Number(value))}
                    >
                      <SelectTrigger className="w-20 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {supplierColumnsVisibility.supplier && (
                          <TableHead>
                            <Button variant="ghost" size="sm" onClick={() => toggleSupplierSort('name')}>Fournisseur</Button>
                          </TableHead>
                        )}
                        {supplierColumnsVisibility.contact && (
                          <TableHead>
                            <Button variant="ghost" size="sm" onClick={() => toggleSupplierSort('contact')}>Contact</Button>
                          </TableHead>
                        )}
                        {supplierColumnsVisibility.city && (
                          <TableHead>
                            <Button variant="ghost" size="sm" onClick={() => toggleSupplierSort('city')}>Ville</Button>
                          </TableHead>
                        )}
                        {supplierColumnsVisibility.orders && (
                          <TableHead className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => toggleSupplierSort('orders')}>Commandes</Button>
                          </TableHead>
                        )}
                        {supplierColumnsVisibility.spent && (
                          <TableHead className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => toggleSupplierSort('spent')}>Total dépensé</Button>
                          </TableHead>
                        )}
                        {supplierColumnsVisibility.debt && (
                          <TableHead className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => toggleSupplierSort('debt')}>Dette</Button>
                          </TableHead>
                        )}
                        {supplierColumnsVisibility.actions && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                      <TableRow>
                        {supplierColumnsVisibility.supplier && (
                          <TableHead>
                            <Input
                              className="h-8"
                              placeholder="Filtrer..."
                              value={supplierColumnFilters.supplier}
                              onChange={(e) => setSupplierColumnFilters((current) => ({ ...current, supplier: e.target.value }))}
                            />
                          </TableHead>
                        )}
                        {supplierColumnsVisibility.contact && (
                          <TableHead>
                            <Input
                              className="h-8"
                              placeholder="Contact..."
                              value={supplierColumnFilters.contact}
                              onChange={(e) => setSupplierColumnFilters((current) => ({ ...current, contact: e.target.value }))}
                            />
                          </TableHead>
                        )}
                        {supplierColumnsVisibility.city && (
                          <TableHead>
                            <Input
                              className="h-8"
                              placeholder="Ville..."
                              value={supplierColumnFilters.city}
                              onChange={(e) => setSupplierColumnFilters((current) => ({ ...current, city: e.target.value }))}
                            />
                          </TableHead>
                        )}
                        {supplierColumnsVisibility.orders && (
                          <TableHead className="text-right">
                            <Input
                              type="number"
                              className="h-8"
                              placeholder="Min"
                              value={supplierColumnFilters.minOrders}
                              onChange={(e) => setSupplierColumnFilters((current) => ({ ...current, minOrders: e.target.value }))}
                            />
                          </TableHead>
                        )}
                        {supplierColumnsVisibility.spent && (
                          <TableHead className="text-right">
                            <Input
                              type="number"
                              className="h-8"
                              placeholder="Min"
                              value={supplierColumnFilters.minSpent}
                              onChange={(e) => setSupplierColumnFilters((current) => ({ ...current, minSpent: e.target.value }))}
                            />
                          </TableHead>
                        )}
                        {supplierColumnsVisibility.debt && (
                          <TableHead className="text-right">
                            <Input
                              type="number"
                              className="h-8"
                              placeholder="Min"
                              value={supplierColumnFilters.minDebt}
                              onChange={(e) => setSupplierColumnFilters((current) => ({ ...current, minDebt: e.target.value }))}
                            />
                          </TableHead>
                        )}
                        {supplierColumnsVisibility.actions && (
                          <TableHead className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setSupplierColumnFilters({
                                  supplier: '',
                                  contact: '',
                                  city: '',
                                  minOrders: '',
                                  minSpent: '',
                                  minDebt: '',
                                })
                              }
                            >
                              Reset
                            </Button>
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedSupplierTableItems.map((supplier) => (
                        <TableRow key={supplier.id}>
                          {supplierColumnsVisibility.supplier && <TableCell className="font-medium">{supplier.name}</TableCell>}
                          {supplierColumnsVisibility.contact && <TableCell>{supplier.contact_name || supplier.phone || '-'}</TableCell>}
                          {supplierColumnsVisibility.city && <TableCell>{supplier.city || '-'}</TableCell>}
                          {supplierColumnsVisibility.orders && <TableCell className="text-right">{supplier.ordersCount || 0}</TableCell>}
                          {supplierColumnsVisibility.spent && (
                            <TableCell className="text-right">{formatCurrency(supplier.totalSpent || 0)}</TableCell>
                          )}
                          {supplierColumnsVisibility.debt && (
                            <TableCell className="text-right">{formatCurrency(supplier.outstandingAmount || 0)}</TableCell>
                          )}
                          {supplierColumnsVisibility.actions && (
                            <TableCell className="text-right">
                              <div className="inline-flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleEditSupplier(supplier)}>
                                  Modifier
                                </Button>
                                <Button size="sm" onClick={() => handleViewSupplier(supplier)}>
                                  Ouvrir
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
                <CardContent className="p-3 border-t flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {supplierTablePage} / {supplierTablePages} • {supplierTableItems.length} ligne(s)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={supplierTablePage <= 1}
                      onClick={() => setSupplierTablePage((p) => Math.max(1, p - 1))}
                    >
                      Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={supplierTablePage >= supplierTablePages}
                      onClick={() => setSupplierTablePage((p) => Math.min(supplierTablePages, p + 1))}
                    >
                      Suivant
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {filteredSuppliers.length === 0 && !isLoading && (
              <div className="text-center py-12">
                <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground">Aucun fournisseur trouvé</p>
                <p className="text-sm text-muted-foreground">Ajoutez un nouveau fournisseur</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="movements" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={txTypeFilter} onValueChange={(v) => setTxTypeFilter(v as 'all' | 'IN' | 'OUT' | 'ADJUSTMENT')}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Type de mouvement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="IN">Entrées</SelectItem>
                    <SelectItem value="OUT">Sorties</SelectItem>
                    <SelectItem value="ADJUSTMENT">Ajustements</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={txStartDate}
                  onChange={(e) => setTxStartDate(e.target.value)}
                  className="w-40"
                />
                <Input
                  type="date"
                  value={txEndDate}
                  onChange={(e) => setTxEndDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Filtrer par véhicule (plaque dans les notes)"
                  value={txVehicleFilter}
                  onChange={(e) => setTxVehicleFilter(e.target.value)}
                  className="w-64"
                />
                <Button variant="outline" onClick={() => setHistoryOpen(true)}>
                  <History className="w-4 h-4 mr-2" />
                  Historique complet
                </Button>
                <Button variant="outline" onClick={exportMovementsPdf}>
                  <FileDown className="w-4 h-4 mr-2" />
                  PDF mouvements
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="dashboard-panel p-3">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground mb-1">Entrées</p>
                  <p className="text-lg font-bold text-foreground">{inCount}</p>
                </CardContent>
              </Card>
              <Card className="dashboard-panel p-3">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground mb-1">Sorties</p>
                  <p className="text-lg font-bold text-foreground">
                    {outCount} ({totalOutQuantity} unités)
                  </p>
                </CardContent>
              </Card>
              <Card className="dashboard-panel p-3">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground mb-1">Ajustements</p>
                  <p className="text-lg font-bold text-foreground">{adjustmentCount}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="dashboard-panel overflow-hidden p-0">
                <CardContent className="p-0">
                  <div className="p-3 border-b">
                    <p className="text-xs font-medium text-muted-foreground">
                      Consommation stock interne par véhicule
                    </p>
                  </div>
                  {parsedConsumption.byVehicle.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground">
                      Aucune consommation liée à une maintenance ou révision pour ce filtre
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/60">
                          <tr>
                            <th className="text-left px-3 py-2">Véhicule</th>
                            <th className="text-right px-3 py-2">Quantité utilisée</th>
                            <th className="text-right px-3 py-2">Coût estimé</th>
                            <th className="text-right px-3 py-2">Lignes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedConsumption.byVehicle.map((row) => (
                            <tr key={row.vehiclePlate} className="border-t">
                              <td className="px-3 py-2">{row.vehiclePlate}</td>
                              <td className="px-3 py-2 text-right">
                                {row.totalQuantity}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {row.totalCost.toFixed(2)} MAD
                              </td>
                              <td className="px-3 py-2 text-right">{row.lines}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="dashboard-panel overflow-hidden p-0">
                <CardContent className="p-0">
                  <div className="p-3 border-b">
                    <p className="text-xs font-medium text-muted-foreground">
                      Consommation liée aux révisions (par type)
                    </p>
                  </div>
                  {parsedConsumption.byRevisionType.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground">
                      Aucune consommation stock provenant des fiches Révisions pour ce filtre
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/60">
                          <tr>
                            <th className="text-left px-3 py-2">Type de révision</th>
                            <th className="text-right px-3 py-2">Quantité utilisée</th>
                            <th className="text-right px-3 py-2">Coût estimé</th>
                            <th className="text-right px-3 py-2">Lignes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedConsumption.byRevisionType.map((row) => (
                            <tr key={row.type} className="border-t">
                              <td className="px-3 py-2">
                                {row.type.replace('_', ' ')}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {row.totalQuantity}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {row.totalCost.toFixed(2)} MAD
                              </td>
                              <td className="px-3 py-2 text-right">{row.lines}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="dashboard-panel overflow-hidden p-0">
              <CardContent className="p-0">
                {isTxLoading ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Chargement des mouvements...</p>
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Aucun mouvement trouvé pour ce filtre</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left px-4 py-2">Date</th>
                          <th className="text-left px-4 py-2">Article</th>
                          <th className="text-left px-4 py-2">Type</th>
                          <th className="text-right px-4 py-2">Quantité</th>
                          <th className="text-right px-4 py-2">Stock avant</th>
                          <th className="text-right px-4 py-2">Stock après</th>
                          <th className="text-left px-4 py-2">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions.map((tx) => (
                          <tr
                            key={tx.id}
                            className={
                              'border-t transition-colors ' +
                              (tx.type === 'IN'
                                ? 'bg-emerald-50/40 dark:bg-emerald-950/20'
                                : tx.type === 'OUT'
                                ? 'bg-rose-50/40 dark:bg-rose-950/20'
                                : 'bg-muted/40')
                            }
                          >
                            <td className="px-4 py-2">
                              {new Date(tx.created_at).toLocaleString('fr-FR')}
                            </td>
                            <td className="px-4 py-2">
                              {tx.item?.name || '-'}
                            </td>
                            <td className="px-4 py-2">
                              {tx.type === 'IN'
                                ? 'Entrée'
                                : tx.type === 'OUT'
                                ? 'Sortie'
                                : 'Ajustement'}
                            </td>
                            <td className="px-4 py-2 text-right">
                              {tx.type === 'IN' ? '+' : tx.type === 'OUT' ? '-' : ''}
                              {tx.quantity}
                            </td>
                            <td className="px-4 py-2 text-right">
                              {tx.previous_quantity ?? '-'}
                            </td>
                            <td className="px-4 py-2 text-right">
                              {tx.new_quantity ?? '-'}
                            </td>
                            <td className="px-4 py-2 max-w-xs truncate" title={tx.notes || ''}>
                              {tx.notes || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Historique complet des mouvements stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <Select value={historyTypeFilter} onValueChange={(v) => setHistoryTypeFilter(v as 'all' | 'IN' | 'OUT' | 'ADJUSTMENT')}>
                <SelectTrigger>
                  <SelectValue placeholder="Type de mouvement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="IN">Entrées</SelectItem>
                  <SelectItem value="OUT">Sorties</SelectItem>
                  <SelectItem value="ADJUSTMENT">Ajustements</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={historyStartDate}
                onChange={(e) => setHistoryStartDate(e.target.value)}
              />
              <Input
                type="date"
                value={historyEndDate}
                onChange={(e) => setHistoryEndDate(e.target.value)}
              />
              <Input
                placeholder="Filtre utilisateur (created_by)"
                value={historyUserFilter}
                onChange={(e) => setHistoryUserFilter(e.target.value)}
              />
              <Input
                placeholder="Filtre article"
                value={historyItemFilter}
                onChange={(e) => setHistoryItemFilter(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" onClick={exportHistoryCsv}>
                <FileDown className="w-4 h-4 mr-2" />
                CSV historique
              </Button>
              <Button variant="outline" size="sm" onClick={exportHistoryPdf}>
                <FileDown className="w-4 h-4 mr-2" />
                PDF historique
              </Button>
            </div>

            <Card className="dashboard-panel overflow-hidden p-0">
              <CardContent className="p-0">
                {isHistoryLoading ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Chargement de l’historique...</p>
                  </div>
                ) : filteredHistoryTransactions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Aucune donnée trouvée pour ce filtre</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[60vh]">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left px-4 py-2">Date</th>
                          <th className="text-left px-4 py-2">Article</th>
                          <th className="text-left px-4 py-2">Type</th>
                          <th className="text-right px-4 py-2">Quantité</th>
                          <th className="text-right px-4 py-2">Stock avant</th>
                          <th className="text-right px-4 py-2">Stock après</th>
                          <th className="text-left px-4 py-2">Utilisateur</th>
                          <th className="text-left px-4 py-2">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHistoryTransactions.map((tx) => (
                          <tr
                            key={tx.id}
                            className={
                              'border-t transition-colors ' +
                              (tx.type === 'IN'
                                ? 'bg-emerald-50/40 dark:bg-emerald-950/20'
                                : tx.type === 'OUT'
                                ? 'bg-rose-50/40 dark:bg-rose-950/20'
                                : 'bg-muted/40')
                            }
                          >
                            <td className="px-4 py-2">{new Date(tx.created_at).toLocaleString('fr-FR')}</td>
                            <td className="px-4 py-2">{tx.item?.name || '-'}</td>
                            <td className="px-4 py-2">
                              {tx.type === 'IN' ? 'Entrée' : tx.type === 'OUT' ? 'Sortie' : 'Ajustement'}
                            </td>
                            <td className="px-4 py-2 text-right">
                              {tx.type === 'IN' ? '+' : tx.type === 'OUT' ? '-' : ''}
                              {tx.quantity}
                            </td>
                            <td className="px-4 py-2 text-right">{tx.previous_quantity ?? '-'}</td>
                            <td className="px-4 py-2 text-right">{tx.new_quantity ?? '-'}</td>
                            <td className="px-4 py-2">{tx.created_by || '-'}</td>
                            <td className="px-4 py-2 max-w-xs truncate" title={tx.notes || ''}>{tx.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Forms */}
      <StockForm
        open={stockFormOpen}
        onOpenChange={setStockFormOpen}
        stockItem={editingItem}
        categories={categories}
        onSubmit={handleStockSubmit}
      />

      <SupplierForm
        open={supplierFormOpen}
        onOpenChange={setSupplierFormOpen}
        supplier={editingSupplier}
        onSubmit={handleSupplierSubmit}
      />

      <RestockForm
        open={restockFormOpen}
        onOpenChange={setRestockFormOpen}
        stockItem={restockingItem}
        onSubmit={handleRestockSubmit}
      />
    </DashboardLayout>
  );
}
