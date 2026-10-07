import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area, Legend } from 'recharts';
import { ComputedRevision } from '@/hooks/useRevisions';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, AlertTriangle, CheckCircle2, DollarSign, Activity } from 'lucide-react';

interface RevisionAnalyticsProps {
  revisions: ComputedRevision[];
}

export function RevisionAnalytics({ revisions }: RevisionAnalyticsProps) {
  // 1. Total Cost
  const totalCost = revisions.reduce((sum, rev) => sum + (rev.cost || 0), 0);
  
  // 2. Cost by Vehicle
  const costByVehicle = revisions.reduce((acc, rev) => {
    const plate = rev.vehicle_plate || 'Inconnu';
    acc[plate] = (acc[plate] || 0) + (rev.cost || 0);
    return acc;
  }, {} as Record<string, number>);

  const vehicleChartData = Object.entries(costByVehicle)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10); // Top 10

  // 3. Status Distribution
  const statusCounts = revisions.reduce((acc, rev) => {
    acc[rev.status] = (acc[rev.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusData = [
    { name: 'En retard', value: statusCounts['overdue'] || 0, color: '#ef4444' },
    { name: 'À faire', value: statusCounts['due'] || 0, color: '#f59e0b' },
    { name: 'Planifiée', value: statusCounts['pending'] || 0, color: '#3b82f6' },
    { name: 'Terminée', value: statusCounts['completed'] || 0, color: '#10b981' },
  ].filter(d => d.value > 0);

  // 4. Monthly Cost Trend (Last 12 months)
  const monthlyCost = revisions.reduce((acc, rev) => {
    const date = rev.last_date ? new Date(rev.last_date) : new Date(rev.created_at);
    // Format: YYYY-MM for sorting
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    acc[key] = (acc[key] || 0) + (rev.cost || 0);
    return acc;
  }, {} as Record<string, number>);

  const monthlyChartData = Object.entries(monthlyCost)
    .map(([date, value]) => {
      const [year, month] = date.split('-');
      // Display format: MM/YY
      const name = `${month}/${year.slice(2)}`; 
      return { name, value, date }; // keep date for sorting if needed
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="dashboard-panel p-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coût Total</CardTitle>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCost)}</div>
            <p className="text-xs text-muted-foreground mt-1">Toutes révisions confondues</p>
          </CardContent>
        </Card>
        
        <Card className="dashboard-panel p-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Retard</CardTitle>
            <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts['overdue'] || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Véhicules nécessitant attention</p>
          </CardContent>
        </Card>
        
        <Card className="dashboard-panel p-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">À Faire Bientôt</CardTitle>
            <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts['due'] || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Dans les 30 prochains jours</p>
          </CardContent>
        </Card>
        
        <Card className="dashboard-panel p-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Terminées</CardTitle>
            <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts['completed'] || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Historique complet</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Cost by Vehicle Chart */}
        <Card className="col-span-1 lg:col-span-2 dashboard-panel p-4">
          <CardHeader>
            <CardTitle>Coût par Véhicule (Top 10)</CardTitle>
            <CardDescription>Les véhicules les plus coûteux en maintenance</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vehicleChartData} layout="vertical" margin={{ left: 40, right: 20, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={100} 
                  tick={{ fontSize: 12, fill: '#6b7280' }} 
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [formatCurrency(value), 'Coût']}
                />
                <Bar 
                  dataKey="value" 
                  fill="#3b82f6" 
                  radius={[0, 4, 4, 0]} 
                  barSize={20}
                  animationDuration={1500}
                >
                  {vehicleChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index < 3 ? '#2563eb' : '#60a5fa'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution Pie Chart */}
        <Card className="col-span-1 dashboard-panel p-4">
          <CardHeader>
            <CardTitle>Répartition par Statut</CardTitle>
            <CardDescription>État actuel du parc</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] flex flex-col justify-center">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    cornerRadius={5}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    iconType="circle"
                    formatter={(value, entry: any) => (
                      <span className="text-sm text-muted-foreground ml-1">{value} ({entry.payload.value})</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend Chart */}
      <Card className="dashboard-panel p-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Évolution des Coûts</CardTitle>
              <CardDescription>Tendance des dépenses sur les 12 derniers mois</CardDescription>
            </div>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Activity className="h-4 w-4 text-primary" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis 
                dataKey="name" 
                tickLine={false} 
                axisLine={false} 
                tick={{ fontSize: 12, fill: '#6b7280' }}
                dy={10}
              />
              <YAxis 
                tickLine={false} 
                axisLine={false} 
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickFormatter={(value) => `${value / 1000}k`}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => [formatCurrency(value), 'Dépenses']}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#8b5cf6" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorValue)" 
                animationDuration={2000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
