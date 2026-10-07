import { useState } from 'react';
import { MissionCard } from './MissionCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Truck, CheckCircle, XCircle } from 'lucide-react';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface MissionCalendarProps {
  missions: any[];
  onView: (mission: any) => void;
  onEdit: (mission: any) => void;
  onStatusChange: (mission: any, status: 'delivered' | 'cancelled') => void;
  onDelete: (mission: any) => void;
}

export function MissionCalendar({ missions, onView, onEdit, onStatusChange, onDelete }: MissionCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const days = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const today = () => setCurrentDate(new Date());

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned':
      case 'pending':
        return 'bg-blue-500';
      case 'in_progress':
        return 'bg-amber-500';
      case 'completed':
      case 'delivered':
        return 'bg-emerald-500';
      case 'cancelled':
        return 'bg-destructive';
      default:
        return 'bg-gray-500';
    }
  };

  const getDayMissions = (date: Date) => {
    return missions.filter((mission) => {
      const missionDate = new Date(mission.departureDate);
      if (Number.isNaN(missionDate.getTime())) {
        return false;
      }
      return isSameDay(missionDate, date);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[150px] text-center capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: fr })}
          </h2>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" onClick={today}>
          Aujourd'hui
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden border">
        {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((day) => (
          <div key={day} className="bg-background p-2 text-center text-sm font-medium text-muted-foreground">
            {day}
          </div>
        ))}
        {Array.from({ length: startOfMonth(currentDate).getDay() }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-background/50 min-h-[100px]" />
        ))}
        {days.map((day) => {
          const dayMissions = getDayMissions(day);
          const isCurrentDay = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={`bg-background p-2 min-h-[100px] hover:bg-muted/50 transition-colors cursor-pointer group relative ${
                isCurrentDay ? 'bg-primary/5 ring-1 ring-inset ring-primary' : ''
              }`}
              onClick={() => setSelectedDay(day)}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                    isCurrentDay ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {format(day, 'd')}
                </span>
                {dayMissions.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                    {dayMissions.length}
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                {dayMissions.slice(0, 3).map((mission) => (
                  <div
                    key={mission.id}
                    className="text-[10px] truncate px-1.5 py-0.5 rounded bg-muted border flex items-center gap-1"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(mission.status)}`} />
                    <span className="truncate">{mission.client}</span>
                  </div>
                ))}
                {dayMissions.length > 3 && (
                  <div className="text-[10px] text-muted-foreground pl-1">
                    + {dayMissions.length - 3} autres
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Missions du {selectedDay && format(selectedDay, 'd MMMM yyyy', { locale: fr })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedDay && getDayMissions(selectedDay).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune mission prévue pour ce jour.
              </div>
            ) : (
              selectedDay && getDayMissions(selectedDay).map((mission) => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  onView={onView}
                  onEdit={onEdit}
                  onStatusChange={onStatusChange}
                  onDelete={onDelete}
                />
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
