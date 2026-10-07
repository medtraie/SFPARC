import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RefreshCcw, Filter, Plus, List, Calendar as CalendarIcon, TrendingUp } from 'lucide-react';
import { RevisionForm } from '@/components/revisions/RevisionForm';
import { RevisionsList } from '@/components/revisions/RevisionsList';
import { RevisionAnalytics } from '@/components/revisions/RevisionAnalytics';
import { RevisionCalendar } from '@/components/revisions/RevisionCalendar';
import {
  useComputedRevisions,
  RevisionType,
} from '@/hooks/useRevisions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Revisions() {
  const [open, setOpen] = useState(false);
  const { revisions } = useComputedRevisions();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending' | 'due' | 'overdue' | 'completed'
  >('all');
  const [typeFilter, setTypeFilter] = useState<'all' | RevisionType>('all');
  const [viewMode, setViewMode] = useState('list');

  const total = revisions.length;
  const overdue = revisions.filter((r) => r.status === 'overdue').length;
  const due = revisions.filter((r) => r.status === 'due').length;

  const filtered = useMemo(
    () =>
      revisions.filter((rev) => {
        const matchesSearch =
          !search ||
          rev.vehicle_plate
            .toLowerCase()
            .includes(search.toLowerCase());
        const matchesStatus =
          statusFilter === 'all' || rev.status === statusFilter;
        const matchesType =
          typeFilter === 'all' || rev.type === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
      }),
    [revisions, search, statusFilter, typeFilter]
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">
              Gestion des Révisions
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="flex items-center gap-2">
                <RefreshCcw className="w-4 h-4" /> Total: {total}
              </Badge>
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0">
                À faire: {due}
              </Badge>
              <Badge className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-0">
                En retard: {overdue}
              </Badge>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Nouvelle révision
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Ajouter une révision</DialogTitle>
              </DialogHeader>
              <RevisionForm onSuccess={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={viewMode} onValueChange={setViewMode} className="space-y-4">
          <TabsList>
            <TabsTrigger value="list" className="gap-2">
              <List className="h-4 w-4" /> Liste
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <CalendarIcon className="h-4 w-4" /> Calendrier
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <TrendingUp className="h-4 w-4" /> Analytique
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            <div className="dashboard-panel p-4 flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Input
                  placeholder="Rechercher par véhicule..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9"
                />
                <Filter className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) =>
                  setStatusFilter(
                    v as 'all' | 'pending' | 'due' | 'overdue' | 'completed'
                  )
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">Planifiée</SelectItem>
                  <SelectItem value="due">À faire</SelectItem>
                  <SelectItem value="overdue">En retard</SelectItem>
                  <SelectItem value="completed">Terminée</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={typeFilter}
                onValueChange={(v) => setTypeFilter(v as 'all' | RevisionType)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="vidange">Vidange</SelectItem>
                  <SelectItem value="vignette">Vignette</SelectItem>
                  <SelectItem value="visite_technique">Visite technique</SelectItem>
                  <SelectItem value="autre_document">Autre document</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <RevisionsList revisions={filtered} />
          </TabsContent>

          <TabsContent value="calendar" className="space-y-4">
            <RevisionCalendar revisions={filtered} onView={() => {}} />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <RevisionAnalytics revisions={revisions} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
