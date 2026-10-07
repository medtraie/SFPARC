import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  User, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  FileText, 
  Truck, 
  LayoutGrid, 
  Clock,
  TrendingUp,
  CreditCard
} from 'lucide-react';
import { TourismClient, TourismMission, TourismInvoice } from '@/hooks/useTourism';
import { TMSClient, TMSOrder, TMSInvoice } from '@/hooks/useTMS';
import { formatCurrency } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ClientDetailProps {
  type: 'tourism' | 'tms';
}

export default function ClientDetail({ type }: ClientDetailProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Fetch Client Data
  const { data: client, isLoading: loadingClient } = useQuery({
    queryKey: ['client', type, id],
    queryFn: async () => {
      const table = type === 'tourism' ? 'tourism_clients' : 'tms_clients';
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as (TourismClient | TMSClient);
    },
    enabled: !!id,
  });

  // Fetch Related Data (Missions/Orders)
  const { data: missions = [], isLoading: loadingMissions } = useQuery({
    queryKey: ['client-missions', type, id],
    queryFn: async () => {
      if (type === 'tourism') {
        const { data, error } = await supabase
          .from('tourism_missions')
          .select('*')
          .eq('client_id', id)
          .order('start_date', { ascending: false });
        if (error) throw error;
        return data as TourismMission[];
      } else {
        const { data, error } = await supabase
          .from('tms_orders')
          .select('*')
          .eq('client_id', id)
          .order('pickup_date', { ascending: false });
        if (error) throw error;
        return data as unknown as TMSOrder[]; // Using unknown because the type might not perfectly match if I haven't imported it correctly or if it's dynamic
      }
    },
    enabled: !!id,
  });

  // Fetch Invoices
  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['client-invoices', type, id],
    queryFn: async () => {
      const table = type === 'tourism' ? 'tourism_invoices' : 'tms_invoices';
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as (TourismInvoice | TMSInvoice)[];
    },
    enabled: !!id,
  });

  // Calculate Stats
  const stats = useMemo(() => {
    const totalMissions = missions.length;
    const totalInvoices = invoices.length;
    
    // Calculate total spent based on invoices
    const totalSpent = invoices.reduce((sum, inv) => {
      // Handle potentially different field names or types
      const amount = (inv as any).total_amount || (inv as any).amount_ttc || 0;
      return sum + Number(amount);
    }, 0);

    // Calculate outstanding amount (unpaid invoices)
    const outstandingAmount = invoices.reduce((sum, inv) => {
      const status = (inv as any).status;
      const amount = (inv as any).total_amount || (inv as any).amount_ttc || 0;
      if (status !== 'paid' && status !== 'cancelled') {
        return sum + Number(amount);
      }
      return sum;
    }, 0);

    return {
      totalMissions,
      totalInvoices,
      totalSpent,
      outstandingAmount
    };
  }, [missions, invoices]);

  if (loadingClient) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-12 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!client) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[50vh]">
          <User className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Client introuvable</h2>
          <Button variant="ghost" onClick={() => navigate('/clients')} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour aux clients
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/clients')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{client.name}</h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Badge variant={type === 'tourism' ? 'default' : 'secondary'}>
                  {type === 'tourism' ? 'Transport Touristique' : 'Transport TMS'}
                </Badge>
                {client.company && (
                  <span className="flex items-center gap-1 text-sm">
                    <Building2 className="h-3 w-3" /> {client.company}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">Modifier</Button>
            {type === 'tourism' ? (
              <Button>Nouvelle Mission</Button>
            ) : (
              <Button>Nouvelle Commande</Button>
            )}
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Coordonnées</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {client.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${client.email}`} className="hover:underline">{client.email}</a>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${client.phone}`} className="hover:underline">{client.phone}</a>
                </div>
              )}
              {(client.address || client.city) && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span>
                    {[client.address, client.city].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Activité</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold">{stats.totalMissions}</div>
                  <p className="text-xs text-muted-foreground">
                    {type === 'tourism' ? 'Missions' : 'Commandes'}
                  </p>
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.totalInvoices}</div>
                  <p className="text-xs text-muted-foreground">Factures</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Finances</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex justify-between items-end">
                  <span className="text-sm text-muted-foreground">Total facturé</span>
                  <span className="text-lg font-bold">{formatCurrency(stats.totalSpent)}</span>
                </div>
                {stats.outstandingAmount > 0 && (
                  <div className="flex justify-between items-end text-destructive">
                    <span className="text-sm">Reste à payer</span>
                    <span className="text-lg font-bold">{formatCurrency(stats.outstandingAmount)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="history" className="space-y-4">
          <TabsList>
            <TabsTrigger value="history" className="gap-2">
              {type === 'tourism' ? <Calendar className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
              Historique
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-2">
              <FileText className="h-4 w-4" />
              Factures
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-2">
              <FileText className="h-4 w-4" />
              Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Historique des {type === 'tourism' ? 'missions' : 'commandes'}</CardTitle>
                <CardDescription>Liste des opérations effectuées pour ce client</CardDescription>
              </CardHeader>
              <CardContent>
                {missions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Aucun historique trouvé.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Référence</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {missions.map((mission: any) => (
                        <TableRow key={mission.id}>
                          <TableCell>
                            {new Date(mission.start_date || mission.pickup_date).toLocaleDateString('fr-FR')}
                          </TableCell>
                          <TableCell className="font-medium">
                            {mission.reference || mission.order_number || '-'}
                          </TableCell>
                          <TableCell>
                            {type === 'tourism' ? mission.title : (mission.merchandise_type || 'Transport')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{mission.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {mission.total_amount || mission.total_cost ? formatCurrency(mission.total_amount || mission.total_cost) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle>Factures</CardTitle>
                <CardDescription>Historique de facturation</CardDescription>
              </CardHeader>
              <CardContent>
                {invoices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Aucune facture trouvée.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Numéro</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Montant TTC</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice: any) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                          <TableCell>{new Date(invoice.invoice_date || invoice.created_at).toLocaleDateString('fr-FR')}</TableCell>
                          <TableCell>
                            <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                              {invoice.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(invoice.total_amount || invoice.amount_ttc)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes">
            <Card>
              <CardHeader>
                <CardTitle>Notes et Remarques</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap">
                  {client.notes || "Aucune note enregistrée pour ce client."}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
