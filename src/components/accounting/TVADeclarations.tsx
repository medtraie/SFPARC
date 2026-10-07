import { useState } from 'react';
import { useTVADeclarations, useCreateTVADeclaration, useUpdateTVADeclaration, TVADeclaration } from '@/hooks/useAccounting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Receipt, CheckCircle, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function TVADeclarations() {
  const { data: declarations, isLoading } = useTVADeclarations();
  const createDecl = useCreateTVADeclaration();
  const updateDecl = useUpdateTVADeclaration();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    period_start: '',
    period_end: '',
    regime: 'monthly',
    tva_collected_20: 0,
    tva_collected_14: 0,
    tva_collected_10: 0,
    tva_collected_7: 0,
    tva_deductible_immobilisations: 0,
    tva_deductible_charges: 0,
    credit_report: 0,
    notes: '',
  });

  const totalCollected = form.tva_collected_20 + form.tva_collected_14 + form.tva_collected_10 + form.tva_collected_7;
  const totalDeductible = form.tva_deductible_immobilisations + form.tva_deductible_charges;
  const tvaDue = totalCollected - totalDeductible;
  const tvaToPay = Math.max(0, tvaDue - form.credit_report);
  const newCredit = tvaDue < 0 ? Math.abs(tvaDue) + form.credit_report : form.credit_report > tvaDue ? form.credit_report - tvaDue : 0;

  const handleCreate = async () => {
    try {
      await createDecl.mutateAsync({
        ...form,
        tva_due: tvaDue,
        tva_to_pay: tvaToPay,
        status: 'draft',
        notes: form.notes || null,
      });
      toast({ title: 'Déclaration TVA créée' });
      setOpen(false);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Déclarations TVA</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Nouvelle déclaration</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nouvelle déclaration TVA</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Début période</Label><Input type="date" value={form.period_start} onChange={e => setForm(f => ({...f, period_start: e.target.value}))} /></div>
                <div><Label>Fin période</Label><Input type="date" value={form.period_end} onChange={e => setForm(f => ({...f, period_end: e.target.value}))} /></div>
                <div><Label>Régime</Label>
                  <Select value={form.regime} onValueChange={v => setForm(f => ({...f, regime: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="monthly">Mensuel</SelectItem><SelectItem value="quarterly">Trimestriel</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>

              <Card>
                <CardHeader className="py-3"><CardTitle className="text-sm">TVA Collectée (facturée)</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <div><Label>TVA 20%</Label><Input type="number" value={form.tva_collected_20 || ''} onChange={e => setForm(f => ({...f, tva_collected_20: Number(e.target.value)}))} /></div>
                  <div><Label>TVA 14%</Label><Input type="number" value={form.tva_collected_14 || ''} onChange={e => setForm(f => ({...f, tva_collected_14: Number(e.target.value)}))} /></div>
                  <div><Label>TVA 10%</Label><Input type="number" value={form.tva_collected_10 || ''} onChange={e => setForm(f => ({...f, tva_collected_10: Number(e.target.value)}))} /></div>
                  <div><Label>TVA 7%</Label><Input type="number" value={form.tva_collected_7 || ''} onChange={e => setForm(f => ({...f, tva_collected_7: Number(e.target.value)}))} /></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3"><CardTitle className="text-sm">TVA Déductible (récupérable)</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <div><Label>Sur immobilisations</Label><Input type="number" value={form.tva_deductible_immobilisations || ''} onChange={e => setForm(f => ({...f, tva_deductible_immobilisations: Number(e.target.value)}))} /></div>
                  <div><Label>Sur charges</Label><Input type="number" value={form.tva_deductible_charges || ''} onChange={e => setForm(f => ({...f, tva_deductible_charges: Number(e.target.value)}))} /></div>
                </CardContent>
              </Card>

              <div><Label>Crédit de TVA reporté</Label><Input type="number" value={form.credit_report || ''} onChange={e => setForm(f => ({...f, credit_report: Number(e.target.value)}))} /></div>

              <Card className="bg-muted/50">
                <CardContent className="py-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span>TVA collectée</span><span className="font-semibold">{totalCollected.toFixed(2)} MAD</span></div>
                  <div className="flex justify-between"><span>TVA déductible</span><span className="font-semibold">-{totalDeductible.toFixed(2)} MAD</span></div>
                  <div className="flex justify-between border-t pt-1"><span>TVA due</span><span className="font-semibold">{tvaDue.toFixed(2)} MAD</span></div>
                  <div className="flex justify-between"><span>Crédit reporté</span><span>-{form.credit_report.toFixed(2)} MAD</span></div>
                  <div className="flex justify-between border-t pt-1 text-lg font-bold">
                    <span>TVA à payer</span>
                    <span className={tvaToPay > 0 ? 'text-red-600' : 'text-green-600'}>{tvaToPay.toFixed(2)} MAD</span>
                  </div>
                </CardContent>
              </Card>

              <Button onClick={handleCreate} disabled={!form.period_start || !form.period_end} className="w-full">Créer la déclaration</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!declarations?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucune déclaration TVA</p>
        </div>
      ) : (
        <div className="space-y-3">
          {declarations.map(decl => (
            <Card key={decl.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{decl.regime === 'monthly' ? 'Mensuel' : 'Trimestriel'}</Badge>
                      <Badge className={decl.status === 'submitted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                        {decl.status === 'submitted' ? 'Déclarée' : 'Brouillon'}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">
                      {format(new Date(decl.period_start), 'dd MMM', { locale: fr })} - {format(new Date(decl.period_end), 'dd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-lg font-bold">{decl.tva_to_pay.toFixed(2)} MAD</p>
                    <p className="text-xs text-muted-foreground">TVA à payer</p>
                    {decl.status === 'draft' && (
                      <Button size="sm" variant="outline" onClick={() => updateDecl.mutate({ id: decl.id, status: 'submitted' })}>
                        <Send className="w-3 h-3 mr-1" />Déclarer
                      </Button>
                    )}
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
