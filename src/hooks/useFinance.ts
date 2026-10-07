import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

export type CashRegister = Database['public']['Tables']['finance_cash_registers']['Row'];
export type CashRegisterInsert = Database['public']['Tables']['finance_cash_registers']['Insert'];
export type CashRegisterUpdate = Database['public']['Tables']['finance_cash_registers']['Update'];

export type BankAccount = Database['public']['Tables']['finance_bank_accounts']['Row'];
export type BankAccountInsert = Database['public']['Tables']['finance_bank_accounts']['Insert'];
export type BankAccountUpdate = Database['public']['Tables']['finance_bank_accounts']['Update'];

export type Checkbook = Database['public']['Tables']['finance_checkbooks']['Row'];
export type CheckbookInsert = Database['public']['Tables']['finance_checkbooks']['Insert'];

export type Payment = Database['public']['Tables']['finance_payments']['Row'];
export type PaymentInsert = Database['public']['Tables']['finance_payments']['Insert'];
export type PaymentUpdate = Database['public']['Tables']['finance_payments']['Update'];

export type CashTransaction = Database['public']['Tables']['finance_cash_transactions']['Row'];

export interface FinancePaymentsFilters {
  paymentType?: 'income' | 'expense';
  fromDate?: string;
  toDate?: string;
  status?: string;
  paymentMethod?: string;
  cashRegisterId?: string;
  bankAccountId?: string;
  category?: string;
  search?: string;
}

// ─── Cash Registers Hooks ───────────────────────────────────────────────────
// ... existing code ...

// ─── Cash Transactions Hooks ────────────────────────────────────────────────

export function useCashTransactions(cashRegisterId?: string) {
  return useQuery({
    queryKey: ['cash_transactions', cashRegisterId],
    queryFn: async () => {
      let query = supabase
        .from('finance_cash_transactions')
        .select('*, cash_register:finance_cash_registers(name)')
        .order('created_at', { ascending: false });
      
      if (cashRegisterId) {
        query = query.eq('cash_register_id', cashRegisterId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useCashRegisters() {
  return useQuery({
    queryKey: ['cash_registers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_cash_registers')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data as CashRegister[];
    },
  });
}

export function useCashRegisterMutation() {
  const queryClient = useQueryClient();
  
  const createRegister = useMutation({
    mutationFn: async (newRegister: CashRegisterInsert) => {
      const { data, error } = await supabase
        .from('finance_cash_registers')
        .insert(newRegister)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash_registers'] });
    },
  });

  return { createRegister };
}

// ─── Bank Accounts Hooks ────────────────────────────────────────────────────

export function useBankAccounts() {
  return useQuery({
    queryKey: ['bank_accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_bank_accounts')
        .select('*')
        .order('bank_name', { ascending: true });
      if (error) throw error;
      return data as BankAccount[];
    },
  });
}

// ─── Payments Hooks ─────────────────────────────────────────────────────────

export function usePayments() {
  return useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_payments')
        .select('*, cash_register:finance_cash_registers(name), bank_account:finance_bank_accounts(bank_name)')
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useFinancePayments(filters: FinancePaymentsFilters = {}) {
  const {
    paymentType,
    fromDate,
    toDate,
    status,
    paymentMethod,
    cashRegisterId,
    bankAccountId,
    category,
    search,
  } = filters;

  return useQuery({
    queryKey: [
      'finance_payments',
      paymentType || null,
      fromDate || null,
      toDate || null,
      status || null,
      paymentMethod || null,
      cashRegisterId || null,
      bankAccountId || null,
      category || null,
      search || null,
    ],
    queryFn: async () => {
      let query = supabase
        .from('finance_payments')
        .select('*, cash_register:finance_cash_registers(name), bank_account:finance_bank_accounts(bank_name)')
        .order('payment_date', { ascending: false });

      if (paymentType) query = query.eq('payment_type', paymentType);
      if (fromDate) query = query.gte('payment_date', fromDate);
      if (toDate) query = query.lte('payment_date', toDate);
      if (status) query = query.eq('status', status);
      if (paymentMethod) query = query.eq('payment_method', paymentMethod);
      if (cashRegisterId) query = query.eq('cash_register_id', cashRegisterId);
      if (bankAccountId) query = query.eq('bank_account_id', bankAccountId);
      if (category) query = query.ilike('category', category);
      if (search) {
        const q = search.replaceAll(',', ' ').trim();
        if (q) {
          query = query.or(
            `entity_name.ilike.%${q}%,reference_number.ilike.%${q}%,notes.ilike.%${q}%,category.ilike.%${q}%,subcategory.ilike.%${q}%`,
          );
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function usePaymentMutation() {
  const queryClient = useQueryClient();

  const createPayment = useMutation({
    mutationFn: async (newPayment: PaymentInsert) => {
      const { data, error } = await supabase
        .from('finance_payments')
        .insert(newPayment)
        .select()
        .single();
      if (error) throw error;
      
      // Update balance logic would go here (ideally handled by DB triggers)
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['finance_payments'] });
      queryClient.invalidateQueries({ queryKey: ['cash_registers'] });
      queryClient.invalidateQueries({ queryKey: ['bank_accounts'] });
    },
  });

  const updatePayment = useMutation({
    mutationFn: async ({ id, ...updates }: PaymentUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('finance_payments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['finance_payments'] });
      queryClient.invalidateQueries({ queryKey: ['cash_registers'] });
      queryClient.invalidateQueries({ queryKey: ['bank_accounts'] });
    },
  });

  const deletePayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('finance_payments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['finance_payments'] });
      queryClient.invalidateQueries({ queryKey: ['cash_registers'] });
      queryClient.invalidateQueries({ queryKey: ['bank_accounts'] });
    },
  });

  return { createPayment, updatePayment, deletePayment };
}
