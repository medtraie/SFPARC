import {
  useComputedRevisions,
  useDeleteRevision,
  useUpdateRevision,
  ComputedRevision,
} from '@/hooks/useRevisions';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2, AlertTriangle, CheckCircle2, Clock, Paperclip } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface RevisionsListProps {
  revisions?: ComputedRevision[];
}

export function RevisionsList({ revisions: external }: RevisionsListProps) {
  const { revisions: hookRevisions } = useComputedRevisions();
  const deleteRevision = useDeleteRevision();
  const updateRevision = useUpdateRevision();

  const revisions = external ?? hookRevisions;

  if (!revisions) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  const statusBadge = (s: string) => {
    switch (s) {
      case 'overdue':
        return <Badge className="bg-destructive text-destructive-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> En retard</Badge>;
      case 'due':
        return <Badge className="bg-warning text-black flex items-center gap-1"><Clock className="w-3 h-3" /> À faire</Badge>;
      case 'completed':
        return <Badge className="bg-success text-success-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Terminé</Badge>;
      default:
        return <Badge variant="outline">Planifiée</Badge>;
    }
  };

  const formatDue = (rev: ComputedRevision) => {
    if (rev.mode === 'days') {
      if (!rev.next_due_date) return '-';
      try {
        return format(new Date(rev.next_due_date), 'dd/MM/yyyy', {
          locale: fr,
        });
      } catch {
        return rev.next_due_date;
      }
    }
    if (rev.next_due_km == null) return '-';
    return `${rev.next_due_km.toLocaleString('fr-FR')} km`;
  };

  const remainingLabel = (rev: ComputedRevision) => {
    if (rev.mode === 'days') {
      if (rev.remainingDays == null) return '-';
      const v = rev.remainingDays;
      if (v === 0) return 'Aujourd’hui';
      return `${v > 0 ? '+' : ''}${v} j`;
    }
    if (rev.remainingKm == null) return '-';
    const v = rev.remainingKm;
    return `${v > 0 ? '+' : ''}${v.toLocaleString('fr-FR')} km`;
  };

  const remainingClass = (status: string) => {
    if (status === 'overdue') return 'text-destructive font-medium';
    if (status === 'due') return 'text-amber-600 font-medium';
    if (status === 'completed') return 'text-success font-medium';
    return 'text-muted-foreground';
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      vidange: 'Vidange',
      vignette: 'Vignette',
      visite_technique: 'Visite technique',
      assurance: 'Assurance',
      chaine_distribution: 'Chaîne de distribution',
      adblue: 'Adblue',
      vidange_boite: 'Vidange boîte',
      autre_document: 'Autre'
    };
    return labels[type] || type;
  };

  return (
    <Card className="dashboard-panel">
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Véhicule</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Dernier Entretien</TableHead>
              <TableHead>Actuel</TableHead>
              <TableHead>Prochaine échéance</TableHead>
              <TableHead>Écart</TableHead>
              <TableHead>Rappel (km)</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {revisions.map((rev) => (
              <TableRow key={rev.id}>
                <TableCell className="font-medium">{rev.vehicle_plate}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{getTypeLabel(rev.type)}</span>
                    {rev.file_url && (
                      <a
                        href={rev.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary flex items-center gap-1 hover:underline"
                      >
                        <Paperclip className="w-3 h-3" />
                        Pièce
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell>{rev.mode === 'days' ? 'Jours' : 'Km'}</TableCell>
                
                <TableCell>
                  {rev.mode === 'days' && rev.last_date ? (
                    new Date(rev.last_date).toLocaleDateString('fr-FR')
                  ) : rev.mode === 'km' && rev.last_km != null ? (
                    `${rev.last_km.toLocaleString()} km`
                  ) : (
                    '-'
                  )}
                </TableCell>

                <TableCell>
                  {rev.mode === 'km' && rev.currentKm != null ? `${rev.currentKm.toLocaleString()} km` : '-'}
                </TableCell>

                <TableCell>{formatDue(rev)}</TableCell>
                <TableCell className={remainingClass(rev.status)}>
                  {remainingLabel(rev)}
                </TableCell>
                <TableCell>
                  {rev.mode === 'km' && rev.reminder_km ? `${rev.reminder_km.toLocaleString()} km` : '-'}
                </TableCell>
                <TableCell>{statusBadge(rev.status)}</TableCell>
                <TableCell className="text-right">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer cette révision ?</AlertDialogTitle>
                        <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteRevision.mutate(rev.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  {rev.status !== 'completed' && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 ml-2"
                      onClick={() =>
                        updateRevision.mutate({
                          id: rev.id,
                          status: 'completed',
                        })
                      }
                    >
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
