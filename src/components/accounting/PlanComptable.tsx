import { useState } from 'react';
import { useAccountingAccounts, useCreateAccount, useDeleteAccount, AccountingAccount } from '@/hooks/useAccounting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const classLabels: Record<number, string> = {
  1: 'Financement permanent',
  2: 'Actif immobilisé',
  3: 'Actif circulant',
  4: 'Passif circulant',
  5: 'Trésorerie',
  6: 'Charges',
  7: 'Produits',
};

const classColors: Record<number, string> = {
  1: 'bg-blue-100 text-blue-800',
  2: 'bg-purple-100 text-purple-800',
  3: 'bg-green-100 text-green-800',
  4: 'bg-orange-100 text-orange-800',
  5: 'bg-cyan-100 text-cyan-800',
  6: 'bg-red-100 text-red-800',
  7: 'bg-emerald-100 text-emerald-800',
};

export function PlanComptable() {
  const { data: accounts, isLoading } = useAccountingAccounts();
  const createAccount = useCreateAccount();
  const deleteAccount = useDeleteAccount();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', class: 6, nature: 'debit', account_type: 'detail' as string });

  const filtered = (accounts || []).filter((a) => {
    const matchSearch = a.code.includes(search) || a.name.toLowerCase().includes(search.toLowerCase());
    const matchClass = filterClass === 'all' || a.class === Number(filterClass);
    return matchSearch && matchClass;
  });

  const handleCreate = async () => {
    try {
      await createAccount.mutateAsync({ ...form, parent_code: null, is_active: true, notes: null });
      toast({ title: 'Compte créé' });
      setOpen(false);
      setForm({ code: '', name: '', class: 6, nature: 'debit', account_type: 'detail' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 items-center flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher par code ou nom..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          <Select value={filterClass} onValueChange={setFilterClass}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les classes</SelectItem>
              {[1,2,3,4,5,6,7].map(c => (
                <SelectItem key={c} value={String(c)}>Classe {c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-1" />Nouveau compte</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouveau compte comptable</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Code</Label><Input value={form.code} onChange={e => setForm(f => ({...f, code: e.target.value}))} placeholder="6125" /></div>
                <div><Label>Classe</Label>
                  <Select value={String(form.class)} onValueChange={v => setForm(f => ({...f, class: Number(v)}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{[1,2,3,4,5,6,7].map(c => <SelectItem key={c} value={String(c)}>Classe {c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Libellé</Label><Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Achats de carburants" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Nature</Label>
                  <Select value={form.nature} onValueChange={v => setForm(f => ({...f, nature: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="debit">Débit</SelectItem><SelectItem value="credit">Crédit</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Type</Label>
                  <Select value={form.account_type} onValueChange={v => setForm(f => ({...f, account_type: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="detail">Détail</SelectItem><SelectItem value="title">Titre</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleCreate} disabled={!form.code || !form.name} className="w-full">Créer le compte</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Plan Comptable Général Marocain ({filtered.length} comptes)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 px-3 font-medium">Code</th>
                  <th className="py-2 px-3 font-medium">Libellé</th>
                  <th className="py-2 px-3 font-medium">Classe</th>
                  <th className="py-2 px-3 font-medium">Nature</th>
                  <th className="py-2 px-3 font-medium">Type</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(acc => (
                  <tr key={acc.id} className={cn('border-b hover:bg-muted/50', acc.account_type === 'title' && 'font-semibold bg-muted/30')}>
                    <td className="py-2 px-3 font-mono">{acc.code}</td>
                    <td className="py-2 px-3" style={{ paddingLeft: `${(acc.code.length - 1) * 12 + 12}px` }}>{acc.name}</td>
                    <td className="py-2 px-3"><Badge className={classColors[acc.class]}>{acc.class} - {classLabels[acc.class]}</Badge></td>
                    <td className="py-2 px-3">{acc.nature === 'debit' ? 'Débit' : 'Crédit'}</td>
                    <td className="py-2 px-3">{acc.account_type === 'title' ? 'Titre' : 'Détail'}</td>
                    <td className="py-2 px-3">
                      {acc.account_type === 'detail' && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteAccount.mutate(acc.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
