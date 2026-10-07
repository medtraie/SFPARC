import { useState } from 'react';
import { useAccountingEntries, useAccountingJournals, useAccountingAccounts, useAccountingFiscalYears, useCreateEntry, useDeleteEntry } from '@/hooks/useAccounting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface EntryLineForm {
  account_id: string;
  label: string;
  debit: number;
  credit: number;
  tva_rate: number;
  tva_amount: number;
}

export function JournalComptable() {
  const [selectedJournal, setSelectedJournal] = useState<string>('all');
  const { data: entries, isLoading } = useAccountingEntries(selectedJournal === 'all' ? undefined : selectedJournal);
  const { data: journals } = useAccountingJournals();
  const { data: accounts } = useAccountingAccounts();
  const { data: fiscalYears } = useAccountingFiscalYears();
  const createEntry = useCreateEntry();
  const deleteEntry = useDeleteEntry();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const detailAccounts = (accounts || []).filter(a => a.account_type === 'detail');
  const openFY = (fiscalYears || []).find(fy => fy.status === 'open');

  const [entryForm, setEntryForm] = useState({
    entry_number: '',
    entry_date: new Date().toISOString().split('T')[0],
    journal_id: '',
    description: '',
    reference: '',
  });

  const [lines, setLines] = useState<EntryLineForm[]>([
    { account_id: '', label: '', debit: 0, credit: 0, tva_rate: 0, tva_amount: 0 },
    { account_id: '', label: '', debit: 0, credit: 0, tva_rate: 0, tva_amount: 0 },
  ]);

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const addLine = () => setLines(ls => [...ls, { account_id: '', label: '', debit: 0, credit: 0, tva_rate: 0, tva_amount: 0 }]);
  const removeLine = (i: number) => setLines(ls => ls.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: string, value: any) => {
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const handleCreate = async () => {
    if (!openFY) { toast({ title: 'Erreur', description: 'Créez d\'abord un exercice comptable', variant: 'destructive' }); return; }
    if (!isBalanced) { toast({ title: 'Erreur', description: 'L\'écriture n\'est pas équilibrée', variant: 'destructive' }); return; }

    try {
      await createEntry.mutateAsync({
        entry: {
          ...entryForm,
          fiscal_year_id: openFY.id,
          source_type: null,
          source_id: null,
          status: 'draft',
          total_debit: totalDebit,
          total_credit: totalCredit,
        },
        lines,
      });
      toast({ title: 'Écriture créée' });
      setOpen(false);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <Select value={selectedJournal} onValueChange={setSelectedJournal}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Tous les journaux" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les journaux</SelectItem>
            {(journals || []).map(j => <SelectItem key={j.id} value={j.id}>{j.code} - {j.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-1" />Nouvelle écriture</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nouvelle écriture comptable</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><Label>N° Pièce</Label><Input value={entryForm.entry_number} onChange={e => setEntryForm(f => ({...f, entry_number: e.target.value}))} placeholder="AC-001" /></div>
                <div><Label>Date</Label><Input type="date" value={entryForm.entry_date} onChange={e => setEntryForm(f => ({...f, entry_date: e.target.value}))} /></div>
                <div><Label>Journal</Label>
                  <Select value={entryForm.journal_id} onValueChange={v => setEntryForm(f => ({...f, journal_id: v}))}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>{(journals || []).map(j => <SelectItem key={j.id} value={j.id}>{j.code} - {j.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Référence</Label><Input value={entryForm.reference} onChange={e => setEntryForm(f => ({...f, reference: e.target.value}))} placeholder="FAC-2025-001" /></div>
              </div>
              <div><Label>Libellé</Label><Input value={entryForm.description} onChange={e => setEntryForm(f => ({...f, description: e.target.value}))} placeholder="Achat de carburant" /></div>

              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-sm">Lignes d'écriture</h4>
                  <Button size="sm" variant="outline" onClick={addLine}><Plus className="w-3 h-3 mr-1" />Ligne</Button>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="text-left border-b"><th className="py-1 px-2">Compte</th><th className="py-1 px-2">Libellé</th><th className="py-1 px-2 w-24">Débit</th><th className="py-1 px-2 w-24">Crédit</th><th className="py-1 px-2 w-20">TVA %</th><th className="w-8"></th></tr></thead>
                  <tbody>
                    {lines.map((line, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-1 px-2">
                          <Select value={line.account_id} onValueChange={v => updateLine(i, 'account_id', v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Compte" /></SelectTrigger>
                            <SelectContent>{detailAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td className="py-1 px-2"><Input className="h-8 text-xs" value={line.label} onChange={e => updateLine(i, 'label', e.target.value)} /></td>
                        <td className="py-1 px-2"><Input className="h-8 text-xs" type="number" value={line.debit || ''} onChange={e => updateLine(i, 'debit', Number(e.target.value))} /></td>
                        <td className="py-1 px-2"><Input className="h-8 text-xs" type="number" value={line.credit || ''} onChange={e => updateLine(i, 'credit', Number(e.target.value))} /></td>
                        <td className="py-1 px-2">
                          <Select value={String(line.tva_rate)} onValueChange={v => updateLine(i, 'tva_rate', Number(v))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">0%</SelectItem>
                              <SelectItem value="7">7%</SelectItem>
                              <SelectItem value="10">10%</SelectItem>
                              <SelectItem value="14">14%</SelectItem>
                              <SelectItem value="20">20%</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-1 px-2">{lines.length > 2 && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeLine(i)}><Trash2 className="w-3 h-3" /></Button>}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td colSpan={2} className="py-2 px-2 text-right">Total</td>
                      <td className="py-2 px-2">{totalDebit.toFixed(2)}</td>
                      <td className="py-2 px-2">{totalCredit.toFixed(2)}</td>
                      <td colSpan={2} className="py-2 px-2">
                        {isBalanced ? <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Équilibrée</Badge> : <Badge variant="destructive">Déséquilibrée</Badge>}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <Button onClick={handleCreate} disabled={!isBalanced || !entryForm.entry_number || !entryForm.journal_id} className="w-full">Enregistrer l'écriture</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {(!entries?.length) ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucune écriture comptable</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <Card key={entry.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">{entry.entry_number}</Badge>
                      {entry.journal && <Badge className="text-xs">{entry.journal.code}</Badge>}
                      <Badge className={entry.status === 'validated' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                        {entry.status === 'validated' ? 'Validée' : 'Brouillon'}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{entry.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(entry.entry_date), 'dd MMM yyyy', { locale: fr })}
                      {entry.reference && ` • Réf: ${entry.reference}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      <p>Débit: <span className="font-semibold">{entry.total_debit.toFixed(2)}</span></p>
                      <p>Crédit: <span className="font-semibold">{entry.total_credit.toFixed(2)}</span></p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteEntry.mutate(entry.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function FileIcon(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>;
}
