import { useState } from 'react';
import { usePassengerLines, usePassengerStations, useDeletePassengerLine, useDeletePassengerStation } from '@/hooks/usePassengerTransport';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, MapPin, Trash2, ChevronDown, ChevronRight, Route } from 'lucide-react';
import { LineForm } from './LineForm';
import { StationForm } from './StationForm';
import { FareMatrix } from './FareMatrix';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function LinesList() {
  const { data: lines = [], isLoading } = usePassengerLines();
  const deleteLine = useDeletePassengerLine();
  const [expandedLine, setExpandedLine] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Lignes de transport</h2>
          <p className="text-sm text-muted-foreground">{lines.length} ligne(s) configurée(s)</p>
        </div>
        <LineForm />
      </div>

      {lines.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Route className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucune ligne configurée</p>
            <p className="text-sm text-muted-foreground">Créez votre première ligne de transport</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {lines.map((line) => (
            <LineCard
              key={line.id}
              line={line}
              isExpanded={expandedLine === line.id}
              onToggle={() => setExpandedLine(expandedLine === line.id ? null : line.id)}
              onDelete={() => deleteLine.mutate(line.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface LineCardProps {
  line: {
    id: string;
    name: string;
    code: string;
    departure_city: string;
    arrival_city: string;
    distance_km: number | null;
    estimated_duration_minutes: number | null;
    status: string;
  };
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

function LineCard({ line, isExpanded, onToggle, onDelete }: LineCardProps) {
  const { data: stations = [] } = usePassengerStations(line.id);
  const deleteStation = useDeletePassengerStation();

  return (
    <Card>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Badge variant="outline">{line.code}</Badge>
                    {line.name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {line.departure_city} → {line.arrival_city}
                    {line.distance_km && ` • ${line.distance_km} km`}
                    {line.estimated_duration_minutes && ` • ${Math.floor(line.estimated_duration_minutes / 60)}h${line.estimated_duration_minutes % 60}min`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Badge variant={line.status === 'active' ? 'default' : 'secondary'}>
                  {line.status === 'active' ? 'Active' : 'Inactive'}
                </Badge>
                <Badge variant="outline">
                  <MapPin className="w-3 h-3 mr-1" />
                  {stations.length} stations
                </Badge>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer cette ligne ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action supprimera la ligne et toutes ses stations et tarifs associés.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-6">
            {/* Stations */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium">Stations</h4>
                <StationForm lineId={line.id} existingStations={stations} />
              </div>
              {stations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune station. Ajoutez des stations pour définir les tarifs.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Ordre</TableHead>
                      <TableHead>Station</TableHead>
                      <TableHead>Ville</TableHead>
                      <TableHead>Distance</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stations.map((station) => (
                      <TableRow key={station.id}>
                        <TableCell className="font-medium">{station.sequence_order}</TableCell>
                        <TableCell>{station.name}</TableCell>
                        <TableCell>{station.city}</TableCell>
                        <TableCell>{station.distance_from_start_km ? `${station.distance_from_start_km} km` : '-'}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => deleteStation.mutate(station.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Fare Matrix */}
            {stations.length >= 2 && (
              <div>
                <h4 className="font-medium mb-4">Grille tarifaire</h4>
                <FareMatrix lineId={line.id} stations={stations} />
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
