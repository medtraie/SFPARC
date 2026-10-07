import { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useGPSwoxAlerts, GPSwoxAlert } from '@/hooks/useGPSwoxAlerts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Bell,
  AlertTriangle,
  MapPin,
  Wifi,
  Fuel,
  Wrench,
  Gauge,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useRevisionAlerts, useAcknowledgeRevisionAlert, RevisionAlert } from '@/hooks/useRevisions';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

const alertTypeConfig = {
  speed: { icon: Gauge, label: 'Excès de vitesse', color: 'text-destructive', bg: 'bg-destructive/10' },
  geofence: { icon: MapPin, label: 'Zone / Arrêt', color: 'text-warning', bg: 'bg-warning/10' },
  disconnect: { icon: Wifi, label: 'Déconnexion', color: 'text-destructive', bg: 'bg-destructive/10' },
  fuel: { icon: Fuel, label: 'Carburant', color: 'text-info', bg: 'bg-info/10' },
  maintenance: { icon: Wrench, label: 'Maintenance', color: 'text-warning', bg: 'bg-warning/10' },
};

const severityConfig = {
  high: { label: 'Critique', variant: 'destructive' as const, color: 'text-destructive' },
  medium: { label: 'Moyen', variant: 'default' as const, color: 'text-warning' },
  low: { label: 'Faible', variant: 'secondary' as const, color: 'text-muted-foreground' },
};

export default function Alerts() {
  const { data, isLoading, error, refetch, isFetching } = useGPSwoxAlerts(60000);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const { data: revData = [], isLoading: revLoading } = useRevisionAlerts();
  const ackMutation = useAcknowledgeRevisionAlert();
  const queryClient = useQueryClient();

  const alerts = data?.alerts || [];
  const revAlerts = revData as RevisionAlert[];

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const isAcknowledged = acknowledgedIds.has(alert.id);
      const matchesSearch =
        !search ||
        alert.device_name.toLowerCase().includes(search.toLowerCase()) ||
        alert.message.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'all' || alert.type === typeFilter;
      const matchesSeverity = severityFilter === 'all' || alert.severity === severityFilter;
      return matchesSearch && matchesType && matchesSeverity;
    });
  }, [alerts, search, typeFilter, severityFilter, acknowledgedIds]);

  const stats = useMemo(() => {
    const total = alerts.length;
    const high = alerts.filter((a) => a.severity === 'high').length;
    const medium = alerts.filter((a) => a.severity === 'medium').length;
    const acknowledged = acknowledgedIds.size;
    return { total, high, medium, acknowledged };
  }, [alerts, acknowledgedIds]);

  const filteredRevisionAlerts = useMemo(() => {
    return revAlerts.filter((a) => {
      const matchesSearch =
        !search ||
        a.vehicle_plate.toLowerCase().includes(search.toLowerCase()) ||
        a.message.toLowerCase().includes(search.toLowerCase());
      return matchesSearch;
    });
  }, [revAlerts, search]);

  useEffect(() => {
    const ch = supabase
      .channel('rev_alerts_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'revision_alerts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['revision_alerts'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [queryClient]);

  const handleAcknowledge = (id: string) => {
    setAcknowledgedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Bell className="w-6 h-6 text-accent" />
              Centre d'Alertes
            </h1>
            <p className="text-muted-foreground text-sm">
              Alertes en temps réel depuis GPSwox
              {data?.source && (
                <span className="ml-2 text-xs text-muted-foreground/70">
                  (source: {data.source})
                </span>
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
            Actualiser
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="kpi-card kpi-card-accent">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Total Alertes
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {isLoading ? <Skeleton className="h-8 w-12" /> : stats.total}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="kpi-card kpi-card-destructive">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Critiques
                  </p>
                  <p className="text-2xl font-bold text-destructive mt-1">
                    {isLoading ? <Skeleton className="h-8 w-12" /> : stats.high}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="kpi-card kpi-card-warning">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Moyennes
                  </p>
                  <p className="text-2xl font-bold text-warning mt-1">
                    {isLoading ? <Skeleton className="h-8 w-12" /> : stats.medium}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="kpi-card kpi-card-success">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Acquittées
                  </p>
                  <p className="text-2xl font-bold text-success mt-1">
                    {isLoading ? <Skeleton className="h-8 w-12" /> : stats.acknowledged}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par véhicule ou message..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Type d'alerte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="speed">Excès de vitesse</SelectItem>
                  <SelectItem value="disconnect">Déconnexion</SelectItem>
                  <SelectItem value="geofence">Zone / Arrêt</SelectItem>
                  <SelectItem value="fuel">Carburant</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Sévérité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="high">Critique</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="low">Faible</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="w-4 h-4 text-warning" />
              Alertes Révisions ({filteredRevisionAlerts.length})
              {revLoading && (
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  Mise à jour...
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {revLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredRevisionAlerts.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">Aucune alerte révision</p>
                <p className="text-sm text-muted-foreground/70">
                  Tout fonctionne normalement
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Statut</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Véhicule</TableHead>
                    <TableHead className="min-w-[250px]">Message</TableHead>
                    <TableHead>Date / Heure</TableHead>
                    <TableHead className="w-[100px] text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRevisionAlerts.map((a) => {
                    const sev = a.status === 'overdue' ? severityConfig.high : severityConfig.medium;
                    const isAcked = a.ack;
                    return (
                      <TableRow key={a.id} className={cn(isAcked && 'opacity-50')}>
                        <TableCell>
                          <Badge variant={sev.variant} className="text-[10px] px-1.5">
                            {a.status === 'overdue' ? 'En retard' : 'À faire'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-medium">{a.type}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs">{a.mode === 'days' ? 'Par jours' : 'Par kilométrage'}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-sm">{a.vehicle_plate}</span>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-foreground">{a.message}</p>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <p className="text-foreground">
                              {(() => {
                                try {
                                  return format(new Date(a.triggered_at), 'dd/MM/yyyy HH:mm', { locale: fr });
                                } catch {
                                  return a.triggered_at;
                                }
                              })()}
                            </p>
                            <p className="text-muted-foreground">
                              {(() => {
                                try {
                                  return formatDistanceToNow(new Date(a.triggered_at), {
                                    addSuffix: true,
                                    locale: fr,
                                  });
                                } catch {
                                  return '';
                                }
                              })()}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant={isAcked ? 'secondary' : 'outline'}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => ackMutation.mutate({ id: a.id, ack: !isAcked })}
                          >
                            {isAcked ? 'Annuler' : 'Acquitter'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3">
              <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Erreur de chargement</p>
                <p className="text-xs text-muted-foreground">{(error as Error).message}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto">
                Réessayer
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Alerts Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" />
              Alertes ({filteredAlerts.length})
              {isFetching && (
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  Mise à jour...
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">Aucune alerte</p>
                <p className="text-sm text-muted-foreground/70">
                  {alerts.length > 0
                    ? 'Aucune alerte ne correspond aux filtres'
                    : 'Tout fonctionne normalement'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Sévérité</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Véhicule</TableHead>
                    <TableHead className="min-w-[250px]">Message</TableHead>
                    <TableHead>Date / Heure</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead className="w-[100px] text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAlerts.map((alert) => {
                    const typeConf = alertTypeConfig[alert.type] || alertTypeConfig.maintenance;
                    const sevConf = severityConfig[alert.severity] || severityConfig.medium;
                    const Icon = typeConf.icon;
                    const isAcked = acknowledgedIds.has(alert.id);

                    return (
                      <TableRow
                        key={alert.id}
                        className={cn(isAcked && 'opacity-50')}
                      >
                        <TableCell>
                          <Badge variant={sevConf.variant} className="text-[10px] px-1.5">
                            {sevConf.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className={cn('flex items-center gap-2', typeConf.color)}>
                            <div className={cn('w-7 h-7 rounded-full flex items-center justify-center', typeConf.bg)}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-medium">{typeConf.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-sm">{alert.device_name}</span>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-foreground">{alert.message}</p>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <p className="text-foreground">
                              {(() => {
                                try {
                                  return format(new Date(alert.timestamp), 'dd/MM/yyyy HH:mm', { locale: fr });
                                } catch {
                                  return alert.timestamp;
                                }
                              })()}
                            </p>
                            <p className="text-muted-foreground">
                              {(() => {
                                try {
                                  return formatDistanceToNow(new Date(alert.timestamp), {
                                    addSuffix: true,
                                    locale: fr,
                                  });
                                } catch {
                                  return '';
                                }
                              })()}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {alert.lat && alert.lng ? (
                            <a
                              href={`https://www.google.com/maps?q=${alert.lat},${alert.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              <MapPin className="w-3 h-3" />
                              Voir
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant={isAcked ? 'secondary' : 'outline'}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleAcknowledge(alert.id)}
                          >
                            {isAcked ? 'Annuler' : 'Acquitter'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Footer info */}
        {data?.timestamp && (
          <p className="text-xs text-muted-foreground text-center">
            Dernière mise à jour:{' '}
            {format(new Date(data.timestamp), 'dd/MM/yyyy à HH:mm:ss', { locale: fr })}
            {' · '}Actualisation automatique toutes les 60 secondes
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
