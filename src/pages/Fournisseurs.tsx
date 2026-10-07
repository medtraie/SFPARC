import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AchatsSupplier,
  useAchatsSuppliers,
  useCreateSupplier,
  useDeleteSupplier,
  usePurchaseOrders,
  useSupplierInvoices,
  useUpdateSupplier,
} from '@/hooks/useAchats';
import { AlertTriangle, ArrowRightLeft, Building2, Eye, Plus, Search, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';

type SupplierFormState = {
  supplier_code: string;
  legal_name: string;
  trade_name: string;
  ice_if: string;
  phone: string;
  email: string;
  address: string;
  payment_terms: string;
  payment_due_days: string;
  quality_score: string;
  delay_score: string;
  volume_score: string;
  is_active: boolean;
};

const emptyForm: SupplierFormState = {
  supplier_code: '',
  legal_name: '',
  trade_name: '',
  ice_if: '',
  phone: '',
  email: '',
  address: '',
  payment_terms: '30 jours',
  payment_due_days: '30',
  quality_score: '70',
  delay_score: '70',
  volume_score: '50',
  is_active: true,
};

const toRiskLevel = (score: number, openAmount: number) => {
  if (score < 45 || openAmount > 50000) return 'high';
  if (score < 70 || openAmount > 15000) return 'medium';
  return 'low';
};

const riskLabel = (risk: 'high' | 'medium' | 'low') => {
  if (risk === 'high') return { text: 'Risque élevé', className: 'bg-red-500/15 text-red-300 border-red-500/30' };
  if (risk === 'medium') return { text: 'Risque moyen', className: 'bg-amber-500/15 text-amber-300 border-amber-400/30' };
  return { text: 'Risque faible', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' };
};

export default function Fournisseurs() {
  const navigate = useNavigate();
  const suppliersQ = useAchatsSuppliers();
  const purchaseOrdersQ = usePurchaseOrders();
  const supplierInvoicesQ = useSupplierInvoices();
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierFormState>(emptyForm);

  const suppliers = suppliersQ.data || [];
  const purchaseOrders = purchaseOrdersQ.data || [];
  const invoices = supplierInvoicesQ.data || [];

  const analyticsBySupplier = useMemo(() => {
    const map = new Map<
      string,
      {
        orderCount: number;
        invoiceCount: number;
        totalOrders: number;
        totalInvoiced: number;
        openAmount: number;
      }
    >();

    const ensure = (id: string) => {
      if (!map.has(id)) {
        map.set(id, { orderCount: 0, invoiceCount: 0, totalOrders: 0, totalInvoiced: 0, openAmount: 0 });
      }
      return map.get(id)!;
    };

    purchaseOrders.forEach((o) => {
      if (!o.supplier_id) return;
      const row = ensure(o.supplier_id);
      row.orderCount += 1;
      row.totalOrders += Number(o.total_amount || 0);
    });

    invoices.forEach((inv) => {
      if (!inv.supplier_id) return;
      const row = ensure(inv.supplier_id);
      const amount = Number(inv.total_amount || 0);
      row.invoiceCount += 1;
      row.totalInvoiced += amount;
      if (inv.status !== 'paid') row.openAmount += amount;
    });

    return map;
  }, [purchaseOrders, invoices]);

  const enrichedSuppliers = useMemo(() => {
    return suppliers.map((s) => {
      const an = analyticsBySupplier.get(s.id) || { orderCount: 0, invoiceCount: 0, totalOrders: 0, totalInvoiced: 0, openAmount: 0 };
      const smartScore = Math.round(s.quality_score * 0.4 + s.delay_score * 0.4 + s.volume_score * 0.2);
      const risk = toRiskLevel(smartScore, an.openAmount);
      return { ...s, ...an, smartScore, risk };
    });
  }, [suppliers, analyticsBySupplier]);

  const filteredSuppliers = useMemo(() => {
    return enrichedSuppliers.filter((s) => {
      if (statusFilter === 'active' && !s.is_active) return false;
      if (statusFilter === 'inactive' && s.is_active) return false;
      if (riskFilter !== 'all' && s.risk !== riskFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const text = `${s.supplier_code} ${s.legal_name} ${s.trade_name || ''} ${s.ice_if || ''} ${s.email || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [enrichedSuppliers, statusFilter, riskFilter, search]);

  const kpis = useMemo(() => {
    const total = enrichedSuppliers.length;
    const active = enrichedSuppliers.filter((s) => s.is_active).length;
    const risky = enrichedSuppliers.filter((s) => s.risk === 'high').length;
    const totalOpen = enrichedSuppliers.reduce((acc, s) => acc + s.openAmount, 0);
    return { total, active, risky, totalOpen };
  }, [enrichedSuppliers]);

  const topRisky = useMemo(() => {
    return [...enrichedSuppliers]
      .sort((a, b) => (b.risk === 'high' ? 1000 : b.openAmount) - (a.risk === 'high' ? 1000 : a.openAmount))
      .slice(0, 3);
  }, [enrichedSuppliers]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (supplier: AchatsSupplier) => {
    setEditingId(supplier.id);
    setForm({
      supplier_code: supplier.supplier_code || '',
      legal_name: supplier.legal_name || '',
      trade_name: supplier.trade_name || '',
      ice_if: supplier.ice_if || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      payment_terms: supplier.payment_terms || '30 jours',
      payment_due_days: String(supplier.payment_due_days || 30),
      quality_score: String(supplier.quality_score || 70),
      delay_score: String(supplier.delay_score || 70),
      volume_score: String(supplier.volume_score || 50),
      is_active: supplier.is_active,
    });
    setDialogOpen(true);
  };

  const submit = () => {
    if (!form.legal_name.trim()) return;
    const payload: Partial<AchatsSupplier> = {
      supplier_code: form.supplier_code.trim(),
      legal_name: form.legal_name.trim(),
      trade_name: form.trade_name.trim() || null,
      ice_if: form.ice_if.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      payment_terms: form.payment_terms.trim() || null,
      payment_due_days: Number(form.payment_due_days || 30),
      quality_score: Number(form.quality_score || 70),
      delay_score: Number(form.delay_score || 70),
      volume_score: Number(form.volume_score || 50),
      is_active: form.is_active,
    };
    if (editingId) {
      updateSupplier.mutate(
        { id: editingId, supplier: payload },
        { onSuccess: () => setDialogOpen(false) }
      );
    } else {
      createSupplier.mutate(payload, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const archiveSupplier = (id: string) => {
    const ok = window.confirm('Archiver ce fournisseur ?');
    if (!ok) return;
    deleteSupplier.mutate(id);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Fournisseurs</h1>
            <p className="text-sm text-muted-foreground">Hub intelligent des fournisseurs, connecté à Facturation et Achats</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/facturation')}>
              <ArrowRightLeft className="w-4 h-4 mr-1" />
              Ouvrir Facturation
            </Button>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" />
              Nouveau fournisseur
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Fournisseurs</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{kpis.total}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Actifs</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{kpis.active}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Risque élevé</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-red-400">{kpis.risky}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Dette ouverte</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{kpis.totalOpen.toFixed(2)} MAD</CardContent></Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          <Card className="xl:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Vue Fournisseurs</CardTitle>
              <CardDescription>Recherche, pilotage risque, performance et exposition</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
                  <Input className="pl-8 w-[260px]" placeholder="Code, nom, ICE, email..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <Select value={statusFilter} onValueChange={(v: 'all' | 'active' | 'inactive') => setStatusFilter(v)}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="active">Actifs</SelectItem>
                    <SelectItem value="inactive">Inactifs</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={riskFilter} onValueChange={(v: 'all' | 'high' | 'medium' | 'low') => setRiskFilter(v)}>
                  <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous risques</SelectItem>
                    <SelectItem value="high">Risque élevé</SelectItem>
                    <SelectItem value="medium">Risque moyen</SelectItem>
                    <SelectItem value="low">Risque faible</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead className="text-right">Commandes</TableHead>
                      <TableHead className="text-right">Dette</TableHead>
                      <TableHead>Risque</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliersQ.isLoading ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
                    ) : filteredSuppliers.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucun fournisseur.</TableCell></TableRow>
                    ) : (
                      filteredSuppliers.map((s) => {
                        const risk = riskLabel(s.risk);
                        return (
                          <TableRow key={s.id} className="hover:bg-muted/20">
                            <TableCell>{s.supplier_code || '-'}</TableCell>
                            <TableCell>
                              <div className="font-medium">{s.legal_name}</div>
                              <div className="text-xs text-muted-foreground">{s.trade_name || '-'}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{s.email || '-'}</div>
                              <div className="text-xs text-muted-foreground">{s.phone || '-'}</div>
                            </TableCell>
                            <TableCell className="text-right font-semibold">{s.smartScore}</TableCell>
                            <TableCell className="text-right">{s.orderCount}</TableCell>
                            <TableCell className="text-right">{s.openAmount.toFixed(2)} MAD</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={risk.className}>{risk.text}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="inline-flex items-center gap-1">
                                <Button size="sm" variant="outline" onClick={() => navigate(`/fournisseurs/${s.id}`)}>
                                  <Eye className="w-4 h-4 mr-1" />
                                  360
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => openEdit(s)}>Éditer</Button>
                                <Button size="sm" variant="outline" className="text-red-500 border-red-300 hover:bg-red-50" onClick={() => archiveSupplier(s.id)}>
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Archiver
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Insights Smart</CardTitle>
              <CardDescription>Top fournisseurs à surveiller</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {topRisky.length === 0 ? (
                <div className="text-sm text-muted-foreground">Pas de données.</div>
              ) : (
                topRisky.map((s) => (
                  <div key={s.id} className="border rounded-md p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm">{s.legal_name}</div>
                      {s.risk === 'high' ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <ShieldCheck className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Score: {s.smartScore} · Dette: {s.openAmount.toFixed(2)} MAD</div>
                    <div className="text-xs text-muted-foreground">Factures: {s.invoiceCount} · Commandes: {s.orderCount}</div>
                  </div>
                ))
              )}
              <div className="rounded-md border p-3 bg-muted/20">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="w-4 h-4 text-sky-500" />
                  Recommandation système
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Négocier les délais sur fournisseurs à risque élevé et prioriser les partenaires avec score {'>'} 70.
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => navigate('/facturation')}>
                <Building2 className="w-4 h-4 mr-1" />
                Gérer dans Facturation
              </Button>
            </CardContent>
          </Card>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Modifier fournisseur' : 'Nouveau fournisseur'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Code</Label>
                <Input value={form.supplier_code} onChange={(e) => setForm((p) => ({ ...p, supplier_code: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Raison sociale</Label>
                <Input value={form.legal_name} onChange={(e) => setForm((p) => ({ ...p, legal_name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Nom commercial</Label>
                <Input value={form.trade_name} onChange={(e) => setForm((p) => ({ ...p, trade_name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>ICE / IF</Label>
                <Input value={form.ice_if} onChange={(e) => setForm((p) => ({ ...p, ice_if: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Téléphone</Label>
                <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Adresse</Label>
                <Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Conditions paiement</Label>
                <Input value={form.payment_terms} onChange={(e) => setForm((p) => ({ ...p, payment_terms: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Échéance (jours)</Label>
                <Input type="number" value={form.payment_due_days} onChange={(e) => setForm((p) => ({ ...p, payment_due_days: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Score qualité</Label>
                <Input type="number" value={form.quality_score} onChange={(e) => setForm((p) => ({ ...p, quality_score: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Score délai</Label>
                <Input type="number" value={form.delay_score} onChange={(e) => setForm((p) => ({ ...p, delay_score: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Score volume</Label>
                <Input type="number" value={form.volume_score} onChange={(e) => setForm((p) => ({ ...p, volume_score: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Statut</Label>
                <Select value={form.is_active ? 'active' : 'inactive'} onValueChange={(v) => setForm((p) => ({ ...p, is_active: v === 'active' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="inactive">Inactif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button onClick={submit} disabled={createSupplier.isPending || updateSupplier.isPending}>
                {editingId ? 'Mettre à jour' : 'Créer'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
