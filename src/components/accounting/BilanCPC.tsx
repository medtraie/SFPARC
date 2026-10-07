import { useBalance } from '@/hooks/useAccounting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

export function BilanCPC() {
  const { data: balance, isLoading } = useBalance();

  if (isLoading) return <Skeleton className="h-60" />;

  const balanceData = balance || [];
  
  // Bilan: Actif (classes 2,3,5) vs Passif (classes 1,4)
  const actifImmobilise = balanceData.filter(b => b.class === 2);
  const actifCirculant = balanceData.filter(b => b.class === 3);
  const tresorerie = balanceData.filter(b => b.class === 5);
  const financementPermanent = balanceData.filter(b => b.class === 1);
  const passifCirculant = balanceData.filter(b => b.class === 4);

  const sumSolde = (items: typeof balanceData) => items.reduce((s, b) => s + b.soldeDebit - b.soldeCredit, 0);

  const totalActif = sumSolde(actifImmobilise) + sumSolde(actifCirculant) + sumSolde(tresorerie);
  const totalPassif = -sumSolde(financementPermanent) - sumSolde(passifCirculant);

  // CPC: Charges (classe 6) vs Produits (classe 7)
  const charges = balanceData.filter(b => b.class === 6);
  const produits = balanceData.filter(b => b.class === 7);
  const totalCharges = charges.reduce((s, b) => s + b.soldeDebit, 0);
  const totalProduits = produits.reduce((s, b) => s + b.soldeCredit, 0);
  const resultat = totalProduits - totalCharges;

  return (
    <Tabs defaultValue="bilan" className="space-y-4">
      <TabsList>
        <TabsTrigger value="bilan">Bilan</TabsTrigger>
        <TabsTrigger value="cpc">Compte de Produits et Charges</TabsTrigger>
      </TabsList>

      <TabsContent value="bilan">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ACTIF */}
          <Card>
            <CardHeader className="bg-blue-50"><CardTitle className="text-blue-900">ACTIF</CardTitle></CardHeader>
            <CardContent className="pt-4 space-y-4">
              <Section title="Actif Immobilisé" items={actifImmobilise} debit />
              <Section title="Actif Circulant" items={actifCirculant} debit />
              <Section title="Trésorerie - Actif" items={tresorerie} debit />
              <div className="border-t-2 pt-2 flex justify-between font-bold text-lg">
                <span>TOTAL ACTIF</span>
                <span>{Math.abs(totalActif).toFixed(2)} MAD</span>
              </div>
            </CardContent>
          </Card>

          {/* PASSIF */}
          <Card>
            <CardHeader className="bg-green-50"><CardTitle className="text-green-900">PASSIF</CardTitle></CardHeader>
            <CardContent className="pt-4 space-y-4">
              <Section title="Financement Permanent" items={financementPermanent} />
              <Section title="Passif Circulant" items={passifCirculant} />
              <div className="border-t pt-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>Résultat net de l'exercice</span>
                  <span className={resultat >= 0 ? 'text-green-600' : 'text-red-600'}>{resultat.toFixed(2)} MAD</span>
                </div>
              </div>
              <div className="border-t-2 pt-2 flex justify-between font-bold text-lg">
                <span>TOTAL PASSIF</span>
                <span>{(totalPassif + resultat).toFixed(2)} MAD</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="cpc">
        <Card>
          <CardHeader><CardTitle>Compte de Produits et Charges (CPC)</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {/* Produits d'exploitation */}
            <div>
              <h3 className="font-semibold text-green-700 border-b pb-1 mb-2">I - PRODUITS D'EXPLOITATION</h3>
              {produits.filter(p => p.code.startsWith('71')).map((p, i) => (
                <div key={i} className="flex justify-between text-sm py-1"><span>{p.code} - {p.name}</span><span>{p.soldeCredit.toFixed(2)}</span></div>
              ))}
            </div>

            {/* Charges d'exploitation */}
            <div>
              <h3 className="font-semibold text-red-700 border-b pb-1 mb-2">II - CHARGES D'EXPLOITATION</h3>
              {charges.filter(c => c.code.startsWith('61') || c.code.startsWith('6')).map((c, i) => (
                <div key={i} className="flex justify-between text-sm py-1"><span>{c.code} - {c.name}</span><span>{c.soldeDebit.toFixed(2)}</span></div>
              ))}
            </div>

            {/* Résultat */}
            <div className="border-t-2 pt-3">
              <div className="flex justify-between text-sm"><span>Total Produits</span><span className="font-semibold text-green-700">{totalProduits.toFixed(2)} MAD</span></div>
              <div className="flex justify-between text-sm"><span>Total Charges</span><span className="font-semibold text-red-700">{totalCharges.toFixed(2)} MAD</span></div>
              <div className="flex justify-between text-lg font-bold mt-2 border-t pt-2">
                <span>RÉSULTAT NET</span>
                <span className={resultat >= 0 ? 'text-green-600' : 'text-red-600'}>{resultat.toFixed(2)} MAD</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function Section({ title, items, debit }: { title: string; items: { code: string; name: string; soldeDebit: number; soldeCredit: number }[]; debit?: boolean }) {
  const total = items.reduce((s, b) => s + (debit ? b.soldeDebit - b.soldeCredit : b.soldeCredit - b.soldeDebit), 0);
  return (
    <div>
      <h4 className="font-medium text-sm text-muted-foreground mb-1">{title}</h4>
      {items.map((item, i) => (
        <div key={i} className="flex justify-between text-sm py-0.5">
          <span className="truncate">{item.code} - {item.name}</span>
          <span>{Math.abs(debit ? item.soldeDebit - item.soldeCredit : item.soldeCredit - item.soldeDebit).toFixed(2)}</span>
        </div>
      ))}
      <div className="flex justify-between text-sm font-semibold border-t mt-1 pt-1">
        <span>Sous-total</span>
        <span>{Math.abs(total).toFixed(2)} MAD</span>
      </div>
    </div>
  );
}
