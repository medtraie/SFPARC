import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useRentalDashboardStats, useRentalReservations, useRentalRentals, useRentalVehicles } from '@/hooks/useRental';

function currency(v: number) {
  return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(v || 0);
}

function statusBadge(status: string) {
  if (status === 'active') return <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>;
  if (status === 'completed') return <Badge variant="secondary">Clôturée</Badge>;
  if (status === 'pending') return <Badge className="bg-amber-600 hover:bg-amber-600">En attente</Badge>;
  if (status === 'confirmed') return <Badge className="bg-sky-600 hover:bg-sky-600">Confirmée</Badge>;
  if (status === 'cancelled') return <Badge variant="destructive">Annulée</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export function RentalDashboard() {
  const statsQ = useRentalDashboardStats();
  const vehiclesQ = useRentalVehicles();
  const reservationsQ = useRentalReservations();
  const rentalsQ = useRentalRentals();

  const monthlyRevenue = useMemo(() => {
    const rentals = rentalsQ.data || [];
    const map = new Map<string, number>();
    rentals.forEach((r) => {
      const key = r.created_at.slice(0, 7);
      map.set(key, (map.get(key) || 0) + (r.total_price || 0));
    });
    return Array.from(map.entries())
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);
  }, [rentalsQ.data]);

  const utilization = useMemo(() => {
    const vehicles = vehiclesQ.data || [];
    const available = vehicles.filter((v) => v.status === 'available').length;
    const rented = vehicles.filter((v) => v.status === 'rented').length;
    const maintenance = vehicles.filter((v) => v.status === 'maintenance').length;
    return [
      { name: 'Disponible', value: available, color: '#10b981' },
      { name: 'Loué', value: rented, color: '#ef4444' },
      { name: 'Maintenance', value: maintenance, color: '#f59e0b' },
    ];
  }, [vehiclesQ.data]);

  const rentalsByVehicle = useMemo(() => {
    const rentals = rentalsQ.data || [];
    const map = new Map<string, number>();
    rentals.forEach((r) => {
      const reg = r.vehicle?.registration || r.vehicle_id;
      map.set(reg, (map.get(reg) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([vehicle, count]) => ({ vehicle, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [rentalsQ.data]);

  const activeRentals = useMemo(() => (rentalsQ.data || []).filter((r) => r.status === 'active').slice(0, 10), [rentalsQ.data]);
  const upcomingReservations = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (reservationsQ.data || [])
      .filter((r) => r.start_date >= today && r.status !== 'cancelled')
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .slice(0, 10);
  }, [reservationsQ.data]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="dashboard-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Véhicules disponibles</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {statsQ.isLoading ? '...' : statsQ.stats.available}
          </CardContent>
        </Card>
        <Card className="dashboard-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Véhicules loués</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {statsQ.isLoading ? '...' : statsQ.stats.rented}
          </CardContent>
        </Card>
        <Card className="dashboard-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Réservations en attente</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {statsQ.isLoading ? '...' : statsQ.stats.pendingReservations}
          </CardContent>
        </Card>
        <Card className="dashboard-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Revenus du jour</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {statsQ.isLoading ? '...' : currency(statsQ.stats.revenueDay)}
          </CardContent>
        </Card>
        <Card className="dashboard-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Revenus du mois</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {statsQ.isLoading ? '...' : currency(statsQ.stats.revenueMonth)}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="dashboard-panel lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenus location mensuels</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.28)" />
                <XAxis dataKey="month" stroke="rgba(148,163,184,0.9)" fontSize={12} />
                <YAxis stroke="rgba(148,163,184,0.9)" fontSize={12} />
                <Tooltip
                  formatter={(value: any) => currency(Number(value))}
                  contentStyle={{
                    backgroundColor: 'rgba(15,23,42,0.96)',
                    border: '1px solid rgba(148,163,184,0.5)',
                    borderRadius: '8px',
                  }}
                />
                <Area type="monotone" dataKey="total" stroke="#42e8e0" strokeWidth={2.4} fill="rgba(66,232,224,0.18)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="dashboard-panel">
          <CardHeader>
            <CardTitle>Taux d'utilisation</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={utilization} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {utilization.map((e) => (
                    <Cell key={e.name} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15,23,42,0.96)',
                    border: '1px solid rgba(148,163,184,0.5)',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="dashboard-panel">
          <CardHeader>
            <CardTitle>Locations par véhicule</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rentalsByVehicle}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.28)" />
                <XAxis dataKey="vehicle" stroke="rgba(148,163,184,0.9)" fontSize={11} />
                <YAxis stroke="rgba(148,163,184,0.9)" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15,23,42,0.96)',
                    border: '1px solid rgba(148,163,184,0.5)',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="count" fill="#60a5fa" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="dashboard-panel lg:col-span-2">
          <CardHeader>
            <CardTitle>Locations actives</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Véhicule</TableHead>
                  <TableHead>Début</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeRentals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Aucune location active
                    </TableCell>
                  </TableRow>
                ) : (
                  activeRentals.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.rental_number}</TableCell>
                      <TableCell>{r.client?.full_name || '-'}</TableCell>
                      <TableCell>{r.vehicle?.registration || '-'}</TableCell>
                      <TableCell>{format(new Date(r.start_datetime), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>{r.end_datetime ? format(new Date(r.end_datetime), 'dd/MM/yyyy') : '-'}</TableCell>
                      <TableCell className="text-right">{currency(r.total_price || 0)}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="dashboard-panel">
        <CardHeader>
          <CardTitle>Réservations à venir</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Véhicule</TableHead>
                <TableHead>Début</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead className="text-right">Prix</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcomingReservations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Aucune réservation à venir
                  </TableCell>
                </TableRow>
              ) : (
                upcomingReservations.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.reservation_number}</TableCell>
                    <TableCell>{r.client?.full_name || '-'}</TableCell>
                    <TableCell>{r.vehicle?.registration || '-'}</TableCell>
                    <TableCell>{format(new Date(r.start_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{format(new Date(r.end_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-right">{currency(r.total_price || 0)}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
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

