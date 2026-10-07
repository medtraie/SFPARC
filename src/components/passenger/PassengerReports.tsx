import { useState, useMemo } from 'react';
import { usePassengerTickets, usePassengerTrips, usePassengerLines, usePassengerBaggage } from '@/hooks/usePassengerTransport';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, TrendingUp, Users, DollarSign, Bus, Calendar, Luggage } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export function PassengerReports() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedLine, setSelectedLine] = useState<string>('all');

  const { data: tickets = [], isLoading: ticketsLoading } = usePassengerTickets();
  const { data: trips = [], isLoading: tripsLoading } = usePassengerTrips();
  const { data: lines = [] } = usePassengerLines();
  const { data: baggage = [], isLoading: baggageLoading } = usePassengerBaggage();

  const isLoading = ticketsLoading || tripsLoading || baggageLoading;

  // Filter data by selected month
  const filteredData = useMemo(() => {
    const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
    const monthEnd = endOfMonth(monthStart);

    const filteredTickets = tickets.filter((t) => {
      const issueDate = new Date(t.issue_date);
      const inMonth = issueDate >= monthStart && issueDate <= monthEnd;
      const matchesLine = selectedLine === 'all' || t.trip?.line_id === selectedLine;
      return inMonth && matchesLine && t.status !== 'cancelled';
    });

    const filteredTrips = trips.filter((t) => {
      const tripDate = new Date(t.trip_date);
      const inMonth = tripDate >= monthStart && tripDate <= monthEnd;
      const matchesLine = selectedLine === 'all' || t.line_id === selectedLine;
      return inMonth && matchesLine;
    });

    const filteredBaggage = baggage.filter((b) => {
      const createdAt = new Date(b.created_at);
      return createdAt >= monthStart && createdAt <= monthEnd;
    });

    return { filteredTickets, filteredTrips, filteredBaggage, monthStart, monthEnd };
  }, [tickets, trips, baggage, selectedMonth, selectedLine]);

  // Calculate stats
  const stats = useMemo(() => {
    const { filteredTickets, filteredTrips, filteredBaggage } = filteredData;

    const totalRevenue = filteredTickets.reduce((sum, t) => sum + t.fare_amount, 0);
    const baggageRevenue = filteredBaggage.reduce((sum, b) => sum + b.fee_amount, 0);
    const totalTickets = filteredTickets.length;
    const totalTrips = filteredTrips.length;
    const totalBaggage = filteredBaggage.length;

    // Revenue by line
    const revenueByLine: Record<string, { name: string; revenue: number; tickets: number }> = {};
    filteredTickets.forEach((t) => {
      const lineId = t.trip?.line_id;
      const lineName = t.trip?.line?.name || 'Inconnu';
      if (lineId) {
        if (!revenueByLine[lineId]) {
          revenueByLine[lineId] = { name: lineName, revenue: 0, tickets: 0 };
        }
        revenueByLine[lineId].revenue += t.fare_amount;
        revenueByLine[lineId].tickets += 1;
      }
    });

    // Daily revenue
    const days = eachDayOfInterval({ start: filteredData.monthStart, end: filteredData.monthEnd });
    const dailyRevenue = days.map((day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayTickets = filteredTickets.filter((t) => format(new Date(t.issue_date), 'yyyy-MM-dd') === dayStr);
      return {
        date: format(day, 'dd', { locale: fr }),
        revenue: dayTickets.reduce((sum, t) => sum + t.fare_amount, 0),
        tickets: dayTickets.length,
      };
    });

    return {
      totalRevenue,
      baggageRevenue,
      totalTickets,
      totalTrips,
      totalBaggage,
      revenueByLine: Object.values(revenueByLine).sort((a, b) => b.revenue - a.revenue),
      dailyRevenue,
      avgTicketPrice: totalTickets > 0 ? totalRevenue / totalTickets : 0,
    };
  }, [filteredData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Rapports métier</h2>
          <p className="text-sm text-muted-foreground">Statistiques et analyses de performance</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-auto"
            />
          </div>
          <Select value={selectedLine} onValueChange={setSelectedLine}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Toutes les lignes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les lignes</SelectItem>
              {lines.map((line) => (
                <SelectItem key={line.id} value={line.id}>
                  [{line.code}] {line.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Chiffre d'affaires</p>
              <p className="text-2xl font-bold">{stats.totalRevenue.toFixed(2)} MAD</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Billets vendus</p>
              <p className="text-2xl font-bold">{stats.totalTickets}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-lg bg-info/10 flex items-center justify-center">
              <Bus className="w-6 h-6 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Voyages effectués</p>
              <p className="text-2xl font-bold">{stats.totalTrips}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Prix moyen/billet</p>
              <p className="text-2xl font-bold">{stats.avgTicketPrice.toFixed(2)} MAD</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Line */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Revenus par ligne</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.revenueByLine.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucune donnée pour cette période</p>
          ) : (
            <div className="space-y-4">
              {stats.revenueByLine.map((line, index) => {
                const maxRevenue = stats.revenueByLine[0]?.revenue || 1;
                // If total revenue is 0, use ticket count for visualization if available
                const isZeroRevenue = maxRevenue <= 1 && line.revenue === 0;
                const maxTickets = Math.max(...stats.revenueByLine.map(l => l.tickets), 1);
                
                const percentage = isZeroRevenue 
                  ? (line.tickets / maxTickets) * 100 
                  : (line.revenue / maxRevenue) * 100;

                return (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{line.name}</span>
                      <span className="text-muted-foreground">
                        {line.tickets} billets • {line.revenue.toFixed(2)} MAD
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isZeroRevenue ? 'bg-blue-400' : 'bg-primary'}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Revenue Chart (Simple) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ventes quotidiennes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-end gap-1">
            {stats.dailyRevenue.map((day, index) => {
              const maxRevenue = Math.max(...stats.dailyRevenue.map((d) => d.revenue), 1);
              const maxTickets = Math.max(...stats.dailyRevenue.map((d) => d.tickets), 1);
              
              const isZeroRevenue = maxRevenue <= 1 && day.revenue === 0;
              
              // Use revenue for height, fallback to tickets if revenue is 0
              let height = 0;
              if (day.revenue > 0) {
                height = Math.max((day.revenue / maxRevenue) * 100, 5);
              } else if (day.tickets > 0) {
                // If no revenue but tickets exist, show bar based on tickets (max 50% height to differentiate)
                height = Math.max((day.tickets / maxTickets) * 50, 5);
              }

              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t transition-all duration-300 hover:opacity-80 ${day.revenue > 0 ? 'bg-primary/80' : (day.tickets > 0 ? 'bg-blue-400/80' : 'bg-primary/80')}`}
                    style={{ height: `${height}%` }}
                    title={`${day.date}: ${day.revenue.toFixed(2)} MAD (${day.tickets} billets)`}
                  />
                  {index % 5 === 0 && (
                    <span className="text-[10px] text-muted-foreground">{day.date}</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Baggage Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Luggage className="w-5 h-5" />
            Bagages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-3xl font-bold">{stats.totalBaggage}</p>
              <p className="text-sm text-muted-foreground">Bagages enregistrés</p>
            </div>
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-3xl font-bold">{stats.baggageRevenue.toFixed(2)} MAD</p>
              <p className="text-sm text-muted-foreground">Frais collectés</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
