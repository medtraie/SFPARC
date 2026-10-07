import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, ArrowLeft, CalendarClock, FileText, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { useAchatsSuppliers, usePurchaseOrders, useSupplierInvoices } from '@/hooks/useAchats';

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function FournisseurDetail() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const navigate = useNavigate();

  const suppliersQ = useAchatsSuppliers();
  const purchaseOrdersQ = usePurchaseOrders();
  const invoicesQ = useSupplierInvoices();

  const supplier = useMemo(
    () => (suppliersQ.data || []).find((s) => s.id === supplierId) || null,
    [suppliersQ.data, supplierId]
  );

  const orders = useMemo(
    () => (purchaseOrdersQ.data || []).filter((o) => o.supplier_id === supplierId),
    [purchaseOrdersQ.data, supplierId]
  );

  const invoices = useMemo(
    () => (invoicesQ.data || []).filter((i) => i.supplier_id === supplierId),
    [invoicesQ.data, supplierId]
  );

  const timeline = useMemo(() => {
    const rows = [
      ...orders.map((o) => ({
        id: `order-${o.id}`,
        date: o.order_date,
        label: 'Bon de commande',
        ref: o.order_number,
        amount: Number(o.total_amount || 0),
        status: o.status,
      })),
      ...invoices.map((i) => ({
        id: `invoice-${i.id}`,
        date: i.invoice_date,
        label: 'Facture fournisseur',
        ref: i.invoice_number,
        amount: Number(i.total_amount || 0),
        status: i.status,
      })),
    ];
    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, invoices]);

  const contracts = useMemo(() => {
    if (!supplier) return [];
    return [
      {
        id: `${supplier.id}-standard`,
        name: 'Contrat cadre standard',
        terms: supplier.payment_terms || '30 jours',
        dueDays: supplier.payment_due_days || 30,
        qualityCommitment: supplier.quality_score,
        delayCommitment: supplier.delay_score,
      },
    ];
  }, [supplier]);

  const monthlyPerformance = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }).map((_, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
      return { key: monthKey(d), label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) };
    });
    const invoiceByMonth = new Map<string, number>();
    const paidByMonth = new Map<string, number>();
    invoices.forEach((inv) => {
      const k = monthKey(new Date(inv.invoice_date));
      const total = Number(inv.total_amount || 0);
      invoiceByMonth.set(k, (invoiceByMonth.get(k) || 0) + total);
      if (inv.status === 'paid') {
        paidByMonth.set(k, (paidByMonth.get(k) || 0) + total);
      }
    });
    return months.map((m) => {
      const invoiced = invoiceByMonth.get(m.key) || 0;
      const paid = paidByMonth.get(m.key) || 0;
      const payRate = invoiced > 0 ? Math.round((paid / invoiced) * 100) : 0;
      return { ...m, invoiced, paid, payRate };
    });
  }, [invoices]);

  const overdueAlerts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return invoices
      .filter((inv) => inv.status !== 'paid' && inv.due_date && inv.due_date < today)
      .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
  }, [invoices]);

  const cashflowForecast = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 3 }).map((_, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth() + idx, 1);
      return { key: monthKey(d), label: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }), expectedOut: 0 };
    });
    const map = new Map(buckets.map((b) => [b.key, b]));
    invoices.forEach((inv) => {
      if (inv.status === 'paid') return;
      const due = inv.due_date ? new Date(inv.due_date) : new Date(inv.invoice_date);
      const k = monthKey(new Date(due.getFullYear(), due.getMonth(), 1));
      if (!map.has(k)) return;
      map.get(k)!.expectedOut += Number(inv.total_amount || 0);
    });
    return buckets;
  }, [invoices]);

  if (suppliersQ.isLoading || purchaseOrdersQ.isLoading || invoicesQ.isLoading) {
    return (
      <DashboardLayout>
        <div className="text-sm text-muted-foreground">Chargement du Supplier 360...</div>
      </DashboardLayout>
    );
  }

  if (!supplier) {
    return (
      <DashboardLayout>
        <div className="space-y-3">
          <Button variant="outline" onClick={() => navigate('/fournisseurs')}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Retour fournisseurs
          </Button>
          <Card><CardContent className="py-8 text-muted-foreground">Fournisseur introuvable.</CardContent></Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Supplier 360</h1>
            <p className="text-sm text-muted-foreground">{supplier.legal_name} · {supplier.supplier_code || '-'}</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/fournisseurs')}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Retour fournisseurs
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Commandes</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{orders.length}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Factures</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{invoices.length}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Overdue alerts</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-red-400">{overdueAlerts.length}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Score global</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{Math.round(supplier.quality_score * 0.4 + supplier.delay_score * 0.4 + supplier.volume_score * 0.2)}</CardContent></Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          <Card className="xl:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Timeline</CardTitle>
              <CardDescription>Opérations récentes fournisseur</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {timeline.length === 0 ? (
                <div className="text-sm text-muted-foreground">Aucun événement.</div>
              ) : (
                timeline.slice(0, 12).map((evt) => (
                  <div key={evt.id} className="border rounded-md p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{evt.label}</Badge>
                        <span className="text-sm font-medium">{evt.ref}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(evt.date).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Statut: {evt.status} · Montant: {evt.amount.toFixed(2)} MAD</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Contrats</CardTitle>
              <CardDescription>Cadre et engagements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {contracts.map((c) => (
                <div key={c.id} className="border rounded-md p-3">
                  <div className="font-semibold text-sm">{c.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">Terms: {c.terms} · Due days: {c.dueDays}</div>
                  <div className="text-xs text-muted-foreground">Qualité: {c.qualityCommitment} · Délai: {c.delayCommitment}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          <Card className="xl:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Performance mensuelle</CardTitle>
              <CardDescription>Facturé, payé et taux de recouvrement</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mois</TableHead>
                    <TableHead className="text-right">Facturé</TableHead>
                    <TableHead className="text-right">Payé</TableHead>
                    <TableHead className="text-right">Taux</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyPerformance.map((m) => (
                    <TableRow key={m.key}>
                      <TableCell>{m.label}</TableCell>
                      <TableCell className="text-right">{m.invoiced.toFixed(2)} MAD</TableCell>
                      <TableCell className="text-right">{m.paid.toFixed(2)} MAD</TableCell>
                      <TableCell className="text-right">{m.payRate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Alertes & Risques</CardTitle>
              <CardDescription>Retards de paiement détectés</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {overdueAlerts.length === 0 ? (
                <div className="text-sm text-emerald-400 flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Aucune alerte active</div>
              ) : (
                overdueAlerts.slice(0, 6).map((a) => (
                  <div key={a.id} className="border rounded-md p-3">
                    <div className="text-sm font-medium flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-400" />{a.invoice_number}</div>
                    <div className="text-xs text-muted-foreground mt-1">Échéance: {a.due_date} · {Number(a.total_amount || 0).toFixed(2)} MAD</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Prévision Cashflow</CardTitle>
            <CardDescription>Sorties attendues sur 3 mois (factures non réglées)</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {cashflowForecast.map((f) => (
              <div key={f.key} className="border rounded-md p-4">
                <div className="flex items-center gap-2 text-sm font-semibold"><CalendarClock className="w-4 h-4 text-sky-500" />{f.label}</div>
                <div className="text-2xl font-bold mt-1">{f.expectedOut.toFixed(2)} MAD</div>
                <div className="text-xs text-muted-foreground mt-1">Sortie prévisionnelle</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="rounded-md border p-3 bg-muted/20">
          <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4 text-sky-500" />Recommandation IA</div>
          <p className="text-xs text-muted-foreground mt-1">
            Prioriser le règlement des factures en retard et renégocier les termes si les alertes dépassent 2/mois.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

