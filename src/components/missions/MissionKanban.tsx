import { Mission } from '@/hooks/useMissions';
import { MissionCard } from './MissionCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Clock, Truck, CheckCircle, XCircle } from 'lucide-react';

interface MissionKanbanProps {
  missions: any[]; // Using any to match the mapped type in Missions.tsx or MissionCardData
  onView: (mission: any) => void;
  onEdit: (mission: any) => void;
  onStatusChange: (mission: any, status: 'delivered' | 'cancelled') => void;
  onDelete: (mission: any) => void;
}

const columns = [
  {
    id: 'planned',
    title: 'Planifiées',
    icon: Clock,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    status: 'pending' // Matches DB status
  },
  {
    id: 'in_progress',
    title: 'En cours',
    icon: Truck,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    status: 'in_progress'
  },
  {
    id: 'completed',
    title: 'Livrées',
    icon: CheckCircle,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    status: 'delivered'
  },
  {
    id: 'cancelled',
    title: 'Annulées',
    icon: XCircle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    status: 'cancelled'
  }
];

export function MissionKanban({ missions, onView, onEdit, onStatusChange, onDelete }: MissionKanbanProps) {
  return (
    <div className="flex h-full gap-4 overflow-x-auto pb-4">
      {columns.map((column) => {
        const columnMissions = missions.filter(
          (m) => m.status === column.status || (column.status === 'pending' && m.status === 'planned') // Handle potential status mismatch
        );

        return (
          <div key={column.id} className="flex-1 min-w-[300px] flex flex-col rounded-lg border bg-muted/40">
            <div className={`p-4 border-b flex items-center justify-between ${column.bgColor}`}>
              <div className="flex items-center gap-2 font-medium">
                <column.icon className={`w-4 h-4 ${column.color}`} />
                {column.title}
              </div>
              <Badge variant="secondary" className="bg-background">
                {columnMissions.length}
              </Badge>
            </div>
            
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {columnMissions.map((mission) => (
                  <MissionCard
                    key={mission.id}
                    mission={mission}
                    onView={onView}
                    onEdit={onEdit}
                    onStatusChange={onStatusChange}
                    onDelete={onDelete}
                  />
                ))}
                {columnMissions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                    Aucune mission
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}
