export interface StockSupplier {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  categories: string[] | null;
  rating: number;
  notes: string | null;
  ordersCount?: number;
  totalSpent?: number;
  invoicesCount?: number;
  outstandingAmount?: number;
  lastInvoiceDate?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StockItem {
  id: string;
  name: string;
  reference: string | null;
  category: string;
  quantity: number;
  min_quantity: number;
  unit: string;
  unit_price: number;
  supplier_id: string | null;
  location: string | null;
  last_restocked: string | null;
  stock_type?: 'internal' | 'external';
  created_at?: string;
  updated_at?: string;
  supplier?: StockSupplier; // For joined queries
}

export interface StockTransaction {
  id: string;
  item_id: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export interface StockTransactionWithItem extends StockTransaction {
  item?: StockItem | null;
}
