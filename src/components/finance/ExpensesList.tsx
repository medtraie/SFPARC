import { useMemo, useState } from 'react';
import { useFinancePayments, usePaymentMutation, type Payment } from '@/hooks/useFinance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
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
import { PaymentForm } from '@/components/finance/PaymentForm';
import { Plus, Search, Pencil, Trash2, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'default',
  pending: 'secondary',
  cancelled: 'destructive',
};

export function ExpensesList() {
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [paymentMethod, setPaymentMethod] = useState<string>('all');
  const [category, setCategory] = useState('');

  const { data: payments = [], isLoading } = useFinancePayments({
    paymentType: 'expense',
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    status: status === 'all' ? undefined : status,
    paymentMethod: paymentMethod === 'all' ? undefined : paymentMethod,
    search: search || undefined,
  });
  const { deletePayment } = usePaymentMutation();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);

  const filtered = useMemo(() => {
    const list = (payments || []) as any[];
    const cat = category.trim().toLowerCase();
    if (!cat) return list;
    return list.filter((p) => String(p.category || '').toLowerCase().includes(cat));
  }, [payments, category]);

  const stats = useMemo(() => {
    const total = filtered.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const pendingCount = filtered.filter((p) => p.status === 'pending').length;
    return { total, pendingCount, count: filtered.length };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="dashboard-panel">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total dépenses</div>
            <div className="text-2xl font-bold text-destructive">-{stats.total.toFixed(2)} MAD</div>
          </CardContent>
        </Card>
        <Card className="dashboard-panel">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">En attente</div>
            <div className="text-2xl font-bold">{stats.pendingCount}</div>
          </CardContent>
        </Card>
        <Card className="dashboard-panel">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Transactions</div>
            <div className="text-2xl font-bold">{stats.count}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="dashboard-panel">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="h-5 w-5 text-destructive" />
            <CardTitle>Dépenses</CardTitle>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle dépense
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Nouvelle dépense</DialogTitle>
                </DialogHeader>
                <PaymentForm fixedPaymentType="expense" onSuccess={() => setIsAddOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Du</div>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Au</div>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Statut</div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="completed">Validé</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Mode</div>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="cash">Espèces</SelectItem>
                  <SelectItem value="check">Chèque</SelectItem>
                  <SelectItem value="transfer">Virement</SelectItem>
                  <SelectItem value="virement">Virement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Catégorie</div>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Carburant..." />
            </div>
          </div>

          <div className="hidden md:block border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Partenaire</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-[90px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Aucune dépense trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{format(new Date(p.payment_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="font-medium">{p.category || '-'}</TableCell>
                      <TableCell>{p.entity_name || '-'}</TableCell>
                      <TableCell className="capitalize">{p.payment_method}</TableCell>
                      <TableCell>{p.reference_number || '-'}</TableCell>
                      <TableCell className="text-right font-bold text-destructive">
                        -{Number(p.amount).toLocaleString()} MAD
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[p.status] || 'secondary'}>{p.status || 'completed'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setEditing(p as Payment)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer la dépense ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Cette action est définitive.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => void deletePayment.mutateAsync(String(p.id))}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Aucune dépense trouvée</div>
            ) : (
              filtered.map((p) => (
                <div key={p.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{p.category || 'Dépense'}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(p.payment_date), 'dd/MM/yyyy')} • {p.entity_name || '-'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-destructive">-{Number(p.amount).toFixed(2)} MAD</div>
                      <Badge variant={STATUS_VARIANT[p.status] || 'secondary'}>{p.status || 'completed'}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="outline" size="sm" onClick={() => setEditing(p as Payment)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Modifier
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4 mr-1 text-destructive" />
                          Supprimer
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer la dépense ?</AlertDialogTitle>
                          <AlertDialogDescription>Cette action est définitive.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => void deletePayment.mutateAsync(String(p.id))}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => (!open ? setEditing(null) : undefined)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier la dépense</DialogTitle>
          </DialogHeader>
          {editing && <PaymentForm fixedPaymentType="expense" payment={editing} onSuccess={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
