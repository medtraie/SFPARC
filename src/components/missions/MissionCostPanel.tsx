import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { Mission } from '@/hooks/useMissions';
import { useDrivers } from '@/hooks/useDrivers';
import { useGPSwoxVehicles } from '@/hooks/useGPSwoxVehicles';

interface MissionCostPanelProps {
  missions: Mission[];
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-MA', { minimumFractionDigits: 0 }).format(amount) + ' MAD';

export function MissionCostPanel({ missions }: MissionCostPanelProps) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [driverId, setDriverId] = useState('all');
  const [vehicleId, setVehicleId] = useState('all');
  const [tableQuery, setTableQuery] = useState('');
  const [sortKey, setSortKey] = useState<'date' | 'route' | 'driver' | 'vehicle' | 'fuel' | 'extras' | 'cash' | 'total'>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { data: drivers = [] } = useDrivers();
  const { data: gpswoxVehicles = [] } = useGPSwoxVehicles();

  const driverIds = Array.from(
    new Set(
      missions
        .map((m) => m.driver_id)
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
    ),
  );
  const vehicleIds = Array.from(
    new Set(
      missions
        .map((m) => m.vehicle_id)
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
    ),
  );

  const filteredAll = missions.filter((m) => {
    if (fromDate && m.mission_date < fromDate) return false;
    if (toDate && m.mission_date > toDate) return false;
    if (driverId !== 'all' && m.driver_id !== driverId) return false;
    if (vehicleId !== 'all' && m.vehicle_id !== vehicleId) return false;
    return true;
  });
  const delivered = filteredAll.filter((m) => m.status === 'completed');

  const resolveDriverName = (id: string | null) =>
    id ? drivers.find((d) => d.id === id)?.name || id : 'N/A';

  const resolveVehicleLabel = (id: string) => {
    const v = gpswoxVehicles.find((veh) => String(veh.id) === id);
    if (v) return `${v.plate}`;
    return id;
  };

  const rows = delivered.map((m) => ({
    id: m.id,
    date: m.mission_date,
    route: `${m.departure_zone} → ${m.arrival_zone}`,
    driver: resolveDriverName(m.driver_id),
    vehicle: resolveVehicleLabel(m.vehicle_id),
    client: m.client || 'N/A',
    fuel: (m.fuel_cost || 0),
    extras: (m.extra_fees || 0),
    cash: (m.cash_amount || 0),
    total: (m.total_cost || 0),
  }));

  const chartData = rows.map((r) => ({
    name: r.route,
    total: r.total,
  }));

  const filteredRows = useMemo(() => {
    if (!tableQuery.trim()) return rows;
    const q = tableQuery.toLowerCase();
    return rows.filter((row) =>
      [row.route, row.driver, row.vehicle, row.client].some((value) =>
        value.toLowerCase().includes(q),
      ),
    );
  }, [rows, tableQuery]);

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'date') {
        return (new Date(a.date).getTime() - new Date(b.date).getTime()) * dir;
      }
      if (sortKey === 'fuel' || sortKey === 'extras' || sortKey === 'cash' || sortKey === 'total') {
        return (a[sortKey] - b[sortKey]) * dir;
      }
      return a[sortKey].localeCompare(b[sortKey]) * dir;
    });
    return sorted;
  }, [filteredRows, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (key === sortKey) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const statusConfig = [
    { key: 'pending', label: 'Planifiées', color: 'hsl(199, 89%, 48%)' },
    { key: 'in_progress', label: 'En cours', color: 'hsl(24, 94%, 50%)' },
    { key: 'completed', label: 'Livrées', color: 'hsl(142, 71%, 45%)' },
    { key: 'cancelled', label: 'Annulées', color: 'hsl(0, 84%, 60%)' },
  ] as const;

  const statusCounts = statusConfig.map((status) => ({
    name: status.label,
    value: filteredAll.filter((m) => m.status === status.key).length,
    color: status.color,
  }));

  const statusTotal = statusCounts.reduce((acc, item) => acc + item.value, 0);

  const costByVehicle = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      map.set(r.vehicle, (map.get(r.vehicle) || 0) + r.total);
    });
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [rows]);

  const maxVehicleCost = costByVehicle.reduce((acc, item) => Math.max(acc, item.total), 0);
  const costByVehicleColored = costByVehicle.map((item, index) => {
    const hue = (index * 47) % 360;
    const lightness = maxVehicleCost ? 42 + Math.round((item.total / maxVehicleCost) * 18) : 50;
    return { ...item, color: `hsl(${hue}, 70%, ${lightness}%)` };
  });

  const clientBreakdown = useMemo(() => {
    const result: { client: string; total: number; missions: number }[] = [];
    const map = new Map<string, { total: number; missions: number }>();
    rows.forEach((r) => {
      const key = r.client || 'N/A';
      const item = map.get(key) || { total: 0, missions: 0 };
      item.total += r.total;
      item.missions += 1;
      map.set(key, item);
    });
    map.forEach((value, key) => {
      result.push({ client: key, total: value.total, missions: value.missions });
    });
    return result.sort((a, b) => b.total - a.total);
  }, [rows]);

  const totalCost = rows.reduce((acc, r) => acc + r.total, 0);
  const missionsCount = rows.length;
  const averageCost = missionsCount ? totalCost / missionsCount : 0;

  const exportCsv = () => {
    const headers = [
      'Date',
      'Trajet',
      'Client',
      'Chauffeur',
      'Véhicule',
      'Carburant',
      'Frais_supp',
      'Montant_remis',
      'Total',
    ];
    const csvRows = rows.map((r) => {
      let dateStr = '';
      try {
        dateStr = new Date(r.date).toISOString().split('T')[0];
      } catch (e) {
        dateStr = r.date || '';
      }
      return [
        dateStr,
        r.route,
        r.client,
        r.driver,
        r.vehicle,
        r.fuel.toString(),
        r.extras.toString(),
        r.cash.toString(),
        r.total.toString(),
      ];
    });
    const csv = [headers, ...csvRows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `missions-cost-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportTopVehiclesCsv = () => {
    const headers = ['Véhicule', 'Total'];
    const csvRows = costByVehicleColored.map((row) => [row.name, row.total.toString()]);
    const csv = [headers, ...csvRows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `top-vehicles-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text('Rapport des coûts missions livrées', 14, 18);
    doc.setFontSize(10);
    if (fromDate || toDate) {
      doc.text(
        `Période: ${fromDate || '...'} au ${toDate || '...'}`,
        14,
        24,
      );
    }

    const body = rows.map((r) => {
      let dateStr = '';
      try {
        dateStr = new Date(r.date).toLocaleDateString('fr-FR');
      } catch (e) {
        dateStr = r.date || '';
      }
      return [
        dateStr,
        r.route,
        r.client,
        r.driver,
        r.vehicle,
        formatCurrency(r.fuel),
        formatCurrency(r.extras),
        formatCurrency(r.cash),
        formatCurrency(r.total),
      ];
    });

    autoTable(doc, {
      head: [
        [
          'Date',
          'Trajet',
          'Client',
          'Chauffeur',
          'Véhicule',
          'Carburant',
          'Frais supp.',
          'Montant remis',
          'Total',
        ],
      ],
      body,
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    });

    const safeName = (fromDate || 'periode') + '_' + (toDate || 'courante');
    doc.save(`missions-cost-${safeName}.pdf`);
  };

  if (!rows.length) {
    return null;
  }

  return (
    <div className="space-y-6 mt-6">
      <Card className="dashboard-panel">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <CardTitle>Filtres coûts</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              Export Excel (CSV)
            </Button>
            <Button variant="outline" size="sm" onClick={exportPdf}>
              Export PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Date début
            </label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Date fin
            </label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Chauffeur
            </label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger>
                <SelectValue placeholder="Tous les chauffeurs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {driverIds.map((id) => (
                  <SelectItem key={id} value={id}>
                    {resolveDriverName(id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Véhicule
            </label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger>
                <SelectValue placeholder="Tous les véhicules" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {vehicleIds.map((id) => (
                  <SelectItem key={id} value={id}>
                    {resolveVehicleLabel(id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 dashboard-panel">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Liste des coûts (missions livrées)</CardTitle>
                <div className="text-xs text-muted-foreground mt-1">
                  {missionsCount} missions • Coût moyen: {formatCurrency(averageCost)} • Total: {formatCurrency(totalCost)}
                </div>
              </div>
              <div className="w-full max-w-xs">
                <Input
                  value={tableQuery}
                  onChange={(e) => setTableQuery(e.target.value)}
                  placeholder="Rechercher (trajet, chauffeur, véhicule, client)"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button type="button" className="flex items-center gap-1" onClick={() => toggleSort('date')}>
                      Date {sortKey === 'date' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="flex items-center gap-1" onClick={() => toggleSort('route')}>
                      Trajet {sortKey === 'route' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="flex items-center gap-1" onClick={() => toggleSort('driver')}>
                      Chauffeur {sortKey === 'driver' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="flex items-center gap-1" onClick={() => toggleSort('vehicle')}>
                      Véhicule {sortKey === 'vehicle' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="flex items-center gap-1" onClick={() => toggleSort('fuel')}>
                      Carburant {sortKey === 'fuel' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="flex items-center gap-1" onClick={() => toggleSort('extras')}>
                      Frais supp. {sortKey === 'extras' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="flex items-center gap-1" onClick={() => toggleSort('cash')}>
                      Montant remis {sortKey === 'cash' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button type="button" className="flex items-center gap-1 ml-auto" onClick={() => toggleSort('total')}>
                      Total {sortKey === 'total' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell>{new Date(row.date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>{row.route}</TableCell>
                    <TableCell>{row.driver}</TableCell>
                    <TableCell>{row.vehicle}</TableCell>
                    <TableCell>{formatCurrency(row.fuel)}</TableCell>
                    <TableCell>{formatCurrency(row.extras)}</TableCell>
                    <TableCell>{formatCurrency(row.cash)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(row.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="dashboard-panel">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Répartition par statut</CardTitle>
                <div className="text-xs text-muted-foreground">{statusTotal} missions</div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusCounts}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                    >
                      {statusCounts.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {statusCounts.map((item) => (
                  <div key={item.name} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                    <div className="font-semibold">
                      {item.value} ({statusTotal ? Math.round((item.value / statusTotal) * 100) : 0}%)
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="dashboard-panel">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Coût par véhicule (Top 10)</CardTitle>
              <Button variant="outline" size="sm" onClick={exportTopVehiclesCsv}>
                Export Top 10 (CSV)
              </Button>
            </CardHeader>
            <CardContent className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costByVehicleColored} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={90} />
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                  <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                    {costByVehicleColored.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="dashboard-panel">
            <CardHeader>
              <CardTitle>Coût par mission</CardTitle>
            </CardHeader>
            <CardContent className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" hide />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="dashboard-panel">
        <CardHeader>
          <CardTitle>Breakdown par client</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Missions</TableHead>
                <TableHead className="text-right">Coût total</TableHead>
                <TableHead className="text-right">Coût moyen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientBreakdown.map((c) => (
                <TableRow key={c.client}>
                  <TableCell>{c.client}</TableCell>
                  <TableCell className="text-right">{c.missions}</TableCell>
                  <TableCell className="text-right">{formatCurrency(c.total)}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(c.total / c.missions)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
