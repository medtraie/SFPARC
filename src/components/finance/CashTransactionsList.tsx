import { useState } from 'react';
import { useCashTransactions, useCashRegisters } from '@/hooks/useFinance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ArrowUpRight, ArrowDownLeft, Wallet } from 'lucide-react';

export function CashTransactionsList() {
  const [selectedCaisse, setSelectedCaisse] = useState<string>('all');
  const { data: registers = [] } = useCashRegisters();
  const { data: transactions = [], isLoading } = useCashTransactions(selectedCaisse === 'all' ? undefined : selectedCaisse);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-64">
          <Select value={selectedCaisse} onValueChange={setSelectedCaisse}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrer par caisse" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les caisses</SelectItem>
              {registers.map((reg) => (
                <SelectItem key={reg.id} value={reg.id}>{reg.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="dashboard-panel">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Journal des mouvements de caisse
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Heure</TableHead>
                <TableHead>Caisse</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="text-right">Solde après</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Chargement...</TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Aucun mouvement enregistré
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx: any) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-xs">
                      {format(new Date(tx.created_at), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="font-medium">{tx.cash_register?.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {tx.transaction_type === 'in' ? (
                          <ArrowDownLeft className="h-4 w-4 text-success" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-destructive" />
                        )}
                        <span className={tx.transaction_type === 'in' ? 'text-success' : 'text-destructive'}>
                          {tx.transaction_type === 'in' ? 'Entrée' : 'Sortie'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={tx.description}>
                      {tx.description || '-'}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {tx.transaction_type === 'in' ? '+' : '-'}{tx.amount.toLocaleString()} MAD
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {tx.balance_after.toLocaleString()} MAD
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
