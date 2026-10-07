import { useState } from 'react';
import { useAccountingAccounts, useGrandLivre, useBalance } from '@/hooks/useAccounting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export function GrandLivreBalance() {
  const { data: accounts } = useAccountingAccounts();
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const { data: grandLivre, isLoading: glLoading } = useGrandLivre(selectedAccount || undefined);
  const { data: balance, isLoading: balLoading } = useBalance();

  const detailAccounts = (accounts || []).filter(a => a.account_type === 'detail');

  return (
    <Tabs defaultValue="balance" className="space-y-4">
      <TabsList>
        <TabsTrigger value="balance">Balance Générale</TabsTrigger>
        <TabsTrigger value="grandlivre">Grand Livre</TabsTrigger>
      </TabsList>

      <TabsContent value="balance">
        <Card>
          <CardHeader><CardTitle>Balance Générale</CardTitle></CardHeader>
          <CardContent>
            {balLoading ? <Skeleton className="h-40" /> : !balance?.length ? (
              <p className="text-center py-8 text-muted-foreground">Aucune écriture validée</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b font-medium text-left">
                      <th className="py-2 px-3">Code</th>
                      <th className="py-2 px-3">Libellé</th>
                      <th className="py-2 px-3 text-right">Total Débit</th>
                      <th className="py-2 px-3 text-right">Total Crédit</th>
                      <th className="py-2 px-3 text-right">Solde Débit</th>
                      <th className="py-2 px-3 text-right">Solde Crédit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balance.map((b, i) => (
                      <tr key={i} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3 font-mono">{b.code}</td>
                        <td className="py-2 px-3">{b.name}</td>
                        <td className="py-2 px-3 text-right">{b.totalDebit.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right">{b.totalCredit.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-semibold">{b.soldeDebit > 0 ? b.soldeDebit.toFixed(2) : ''}</td>
                        <td className="py-2 px-3 text-right font-semibold">{b.soldeCredit > 0 ? b.soldeCredit.toFixed(2) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold border-t-2">
                      <td colSpan={2} className="py-2 px-3">TOTAL</td>
                      <td className="py-2 px-3 text-right">{balance.reduce((s, b) => s + b.totalDebit, 0).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right">{balance.reduce((s, b) => s + b.totalCredit, 0).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right">{balance.reduce((s, b) => s + b.soldeDebit, 0).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right">{balance.reduce((s, b) => s + b.soldeCredit, 0).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="grandlivre">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <CardTitle>Grand Livre</CardTitle>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger className="w-[300px]"><SelectValue placeholder="Sélectionner un compte" /></SelectTrigger>
                <SelectContent>
                  {detailAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedAccount ? (
              <p className="text-center py-8 text-muted-foreground">Sélectionnez un compte pour voir son grand livre</p>
            ) : glLoading ? <Skeleton className="h-40" /> : !grandLivre?.length ? (
              <p className="text-center py-8 text-muted-foreground">Aucun mouvement sur ce compte</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b font-medium text-left">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">N° Pièce</th>
                      <th className="py-2 px-3">Libellé</th>
                      <th className="py-2 px-3 text-right">Débit</th>
                      <th className="py-2 px-3 text-right">Crédit</th>
                      <th className="py-2 px-3 text-right">Solde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let runningBalance = 0;
                      return grandLivre.map((line: any, i: number) => {
                        runningBalance += Number(line.debit) - Number(line.credit);
                        return (
                          <tr key={i} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-3">{line.accounting_entries?.entry_date}</td>
                            <td className="py-2 px-3 font-mono">{line.accounting_entries?.entry_number}</td>
                            <td className="py-2 px-3">{line.label}</td>
                            <td className="py-2 px-3 text-right">{Number(line.debit) > 0 ? Number(line.debit).toFixed(2) : ''}</td>
                            <td className="py-2 px-3 text-right">{Number(line.credit) > 0 ? Number(line.credit).toFixed(2) : ''}</td>
                            <td className="py-2 px-3 text-right font-semibold">{runningBalance.toFixed(2)}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
