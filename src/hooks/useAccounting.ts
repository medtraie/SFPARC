import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Types
export interface AccountingAccount {
  id: string;
  code: string;
  name: string;
  class: number;
  parent_code: string | null;
  account_type: string;
  nature: string;
  is_active: boolean;
  notes: string | null;
}

export interface AccountingJournal {
  id: string;
  code: string;
  name: string;
  journal_type: string;
  is_active: boolean;
}

export interface AccountingFiscalYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
}

export interface AccountingEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  journal_id: string;
  fiscal_year_id: string;
  description: string;
  reference: string | null;
  source_type: string | null;
  source_id: string | null;
  status: string;
  total_debit: number;
  total_credit: number;
  created_at: string;
  journal?: AccountingJournal;
  lines?: AccountingEntryLine[];
}

export interface AccountingEntryLine {
  id: string;
  entry_id: string;
  account_id: string;
  label: string;
  debit: number;
  credit: number;
  tva_rate: number;
  tva_amount: number;
  account?: AccountingAccount;
}

export interface TVADeclaration {
  id: string;
  period_start: string;
  period_end: string;
  regime: string;
  tva_collected_20: number;
  tva_collected_14: number;
  tva_collected_10: number;
  tva_collected_7: number;
  tva_deductible_immobilisations: number;
  tva_deductible_charges: number;
  tva_due: number;
  credit_report: number;
  tva_to_pay: number;
  status: string;
  notes: string | null;
}

// ---- Accounts ----
export function useAccountingAccounts() {
  return useQuery({
    queryKey: ['accounting_accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_accounts')
        .select('*')
        .order('code');
      if (error) throw error;
      return data as AccountingAccount[];
    },
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (account: Omit<AccountingAccount, 'id'>) => {
      const { data, error } = await supabase.from('accounting_accounts').insert(account).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounting_accounts'] }),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('accounting_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounting_accounts'] }),
  });
}

// ---- Journals ----
export function useAccountingJournals() {
  return useQuery({
    queryKey: ['accounting_journals'],
    queryFn: async () => {
      const { data, error } = await supabase.from('accounting_journals').select('*').order('code');
      if (error) throw error;
      return data as AccountingJournal[];
    },
  });
}

// ---- Fiscal Years ----
export function useAccountingFiscalYears() {
  return useQuery({
    queryKey: ['accounting_fiscal_years'],
    queryFn: async () => {
      const { data, error } = await supabase.from('accounting_fiscal_years').select('*').order('start_date', { ascending: false });
      if (error) throw error;
      return data as AccountingFiscalYear[];
    },
  });
}

export function useCreateFiscalYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fy: Omit<AccountingFiscalYear, 'id'>) => {
      const { data, error } = await supabase.from('accounting_fiscal_years').insert(fy).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounting_fiscal_years'] }),
  });
}

// ---- Entries ----
export function useAccountingEntries(journalId?: string) {
  return useQuery({
    queryKey: ['accounting_entries', journalId],
    queryFn: async () => {
      let query = supabase
        .from('accounting_entries')
        .select('*, accounting_journals(*)')
        .order('entry_date', { ascending: false });
      if (journalId) query = query.eq('journal_id', journalId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((e: any) => ({ ...e, journal: e.accounting_journals })) as AccountingEntry[];
    },
  });
}

export function useAccountingEntryLines(entryId?: string) {
  return useQuery({
    queryKey: ['accounting_entry_lines', entryId],
    enabled: !!entryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_entry_lines')
        .select('*, accounting_accounts(*)')
        .eq('entry_id', entryId!)
        .order('created_at');
      if (error) throw error;
      return (data || []).map((l: any) => ({ ...l, account: l.accounting_accounts })) as AccountingEntryLine[];
    },
  });
}

export function useCreateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      entry: Omit<AccountingEntry, 'id' | 'created_at' | 'journal' | 'lines'>;
      lines: Omit<AccountingEntryLine, 'id' | 'entry_id' | 'account'>[];
    }) => {
      const { data: entry, error: entryErr } = await supabase
        .from('accounting_entries')
        .insert(payload.entry)
        .select()
        .single();
      if (entryErr) throw entryErr;

      const linesWithEntry = payload.lines.map((l) => ({ ...l, entry_id: entry.id }));
      const { error: linesErr } = await supabase.from('accounting_entry_lines').insert(linesWithEntry);
      if (linesErr) throw linesErr;

      return entry;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting_entries'] });
      qc.invalidateQueries({ queryKey: ['accounting_entry_lines'] });
    },
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('accounting_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting_entries'] });
      qc.invalidateQueries({ queryKey: ['accounting_entry_lines'] });
    },
  });
}

// ---- TVA Declarations ----
export function useTVADeclarations() {
  return useQuery({
    queryKey: ['accounting_tva_declarations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_tva_declarations')
        .select('*')
        .order('period_start', { ascending: false });
      if (error) throw error;
      return data as TVADeclaration[];
    },
  });
}

export function useCreateTVADeclaration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (decl: Omit<TVADeclaration, 'id'>) => {
      const { data, error } = await supabase.from('accounting_tva_declarations').insert(decl).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounting_tva_declarations'] }),
  });
}

export function useUpdateTVADeclaration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TVADeclaration> & { id: string }) => {
      const { error } = await supabase.from('accounting_tva_declarations').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounting_tva_declarations'] }),
  });
}

// ---- Grand Livre & Balance helpers ----
export function useGrandLivre(accountId?: string) {
  return useQuery({
    queryKey: ['grand_livre', accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_entry_lines')
        .select('*, accounting_entries!inner(entry_date, entry_number, description, status), accounting_accounts(*)')
        .eq('account_id', accountId!)
        .eq('accounting_entries.status', 'validated')
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

export function useBalance() {
  return useQuery({
    queryKey: ['balance_generale'],
    queryFn: async () => {
      // Get all validated entry lines with accounts
      const { data, error } = await supabase
        .from('accounting_entry_lines')
        .select('debit, credit, account_id, accounting_accounts(code, name, class, nature), accounting_entries!inner(status)')
        .eq('accounting_entries.status', 'validated');
      if (error) throw error;

      // Aggregate by account
      const balanceMap = new Map<string, { code: string; name: string; class: number; totalDebit: number; totalCredit: number; soldeDebit: number; soldeCredit: number }>();
      
      for (const line of data || []) {
        const acc = (line as any).accounting_accounts;
        if (!acc) continue;
        const key = line.account_id;
        if (!balanceMap.has(key)) {
          balanceMap.set(key, { code: acc.code, name: acc.name, class: acc.class, totalDebit: 0, totalCredit: 0, soldeDebit: 0, soldeCredit: 0 });
        }
        const b = balanceMap.get(key)!;
        b.totalDebit += Number(line.debit);
        b.totalCredit += Number(line.credit);
      }

      // Calculate soldes
      for (const b of balanceMap.values()) {
        const diff = b.totalDebit - b.totalCredit;
        if (diff > 0) { b.soldeDebit = diff; b.soldeCredit = 0; }
        else { b.soldeDebit = 0; b.soldeCredit = Math.abs(diff); }
      }

      return Array.from(balanceMap.values()).sort((a, b) => a.code.localeCompare(b.code));
    },
  });
}
