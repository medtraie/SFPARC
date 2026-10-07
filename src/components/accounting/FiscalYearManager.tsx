import { useState } from 'react';
import { useAccountingFiscalYears, useCreateFiscalYear } from '@/hooks/useAccounting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function FiscalYearManager() {
  const { data: fiscalYears, isLoading } = useAccountingFiscalYears();
  const createFY = useCreateFiscalYear();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '', status: 'open' });

  const handleCreate = async () => {
    try {
      await createFY.mutateAsync(form);
      toast({ title: 'Exercice créé' });
      setOpen(false);
      setForm({ name: '', start_date: '', end_date: '', status: 'open' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  if (isLoading) return <Skeleton className="h-40" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Exercices Comptables</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Nouvel exercice</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvel exercice comptable</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nom</Label><Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Exercice 2025" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date début</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({...f, start_date: e.target.value}))} /></div>
                <div><Label>Date fin</Label><Input type="date" value={form.end_date} onChange={e => setForm(f => ({...f, end_date: e.target.value}))} /></div>
              </div>
              <Button onClick={handleCreate} disabled={!form.name || !form.start_date || !form.end_date} className="w-full">Créer l'exercice</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!fiscalYears?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucun exercice comptable</p>
          <p className="text-sm">Créez votre premier exercice pour commencer</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {fiscalYears.map(fy => (
            <Card key={fy.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{fy.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(fy.start_date), 'dd MMM yyyy', { locale: fr })} → {format(new Date(fy.end_date), 'dd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                  <Badge className={fy.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                    {fy.status === 'open' ? 'Ouvert' : 'Clôturé'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
