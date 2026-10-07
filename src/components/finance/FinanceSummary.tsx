import { useState } from 'react';
import { usePayments, useCashRegisters } from '@/hooks/useFinance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Search, Wallet, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PaymentForm } from './PaymentForm';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export function FinanceSummary() {
  const { data: registers = [] } = useCashRegisters();
  const { data: payments = [] } = usePayments();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const filteredPayments = (payments || []).filter(p => 
    p.entity_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.reference_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalCurrentBalance = registers.reduce(
    (sum, reg) => sum + (reg.current_balance || 0),
    0,
  );

  const totalIncome = payments.reduce(
    (sum, p) => sum + (p.payment_type === 'income' ? p.amount : 0),
    0,
  );

  const totalExpense = payments.reduce(
    (sum, p) => sum + (p.payment_type !== 'income' ? p.amount : 0),
    0,
  );

  const netCashFlow = totalIncome - totalExpense;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="kpi-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Solde total des caisses
              </p>
              <p className="text-3xl font-bold text-foreground tracking-tight">
                {totalCurrentBalance.toLocaleString()} MAD
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
              <Wallet className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="kpi-card kpi-card-success">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Encaissements
              </p>
              <p className="text-3xl font-bold text-foreground tracking-tight">
                {totalIncome.toLocaleString()} MAD
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-success/10 text-success">
              <ArrowDownLeft className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="kpi-card kpi-card-destructive">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Décaissements nets
              </p>
              <p className="text-3xl font-bold text-foreground tracking-tight">
                {totalExpense.toLocaleString()} MAD
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Flux net: {netCashFlow.toLocaleString()} MAD
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-destructive/10 text-destructive">
              <ArrowUpRight className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {registers.map((reg) => (
          <Card key={reg.id} className="dashboard-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                {reg.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {reg.current_balance?.toLocaleString()} {reg.currency}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Solde en temps réel
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payments List */}
      <Card className="dashboard-panel">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Règlements Récents</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau Règlement
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Enregistrer un règlement</DialogTitle>
                </DialogHeader>
                <PaymentForm onSuccess={() => setIsAddOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Entité</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Aucun règlement trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{format(new Date(payment.payment_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {payment.payment_type === 'income' ? (
                          <ArrowDownLeft className="h-4 w-4 text-success" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-destructive" />
                        )}
                        <span className={payment.payment_type === 'income' ? 'text-success' : 'text-destructive'}>
                          {payment.payment_type === 'income' ? 'Encaissement' : 'Décaissement'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{payment.entity_name}</TableCell>
                    <TableCell className="capitalize">{payment.payment_method}</TableCell>
                    <TableCell>{payment.reference_number || '-'}</TableCell>
                    <TableCell className="text-right font-bold">
                      {payment.amount.toLocaleString()} MAD
                    </TableCell>
                    <TableCell>
                      <Badge variant={payment.status === 'completed' ? 'default' : 'secondary'}>
                        {payment.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
