import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, Calendar } from 'lucide-react';
import { useMedicalVisits, useMedicalVisitMutation, MedicalVisit } from '@/hooks/usePersonnel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { MedicalVisitForm } from './MedicalVisitForm';

export function MedicalVisitsList() {
  const { data: visits = [], isLoading } = useMedicalVisits();
  const { deleteVisit } = useMedicalVisitMutation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<MedicalVisit | null>(null);

  const filteredVisits = visits.filter(v => {
    const personnelName = v.personnel ? `${v.personnel.first_name} ${v.personnel.last_name}` : '';
    return (
      v.visit_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      personnelName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleDelete = async (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette visite ?')) {
      await deleteVisit.mutateAsync(id);
    }
  };

  const statusLabels: Record<string, string> = {
    scheduled: 'Planifié',
    completed: 'Effectué',
    cancelled: 'Annulé',
  };

  const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    scheduled: 'outline',
    completed: 'default',
    cancelled: 'destructive',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par type ou employé..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter une visite
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter une visite médicale</DialogTitle>
            </DialogHeader>
            <MedicalVisitForm onSuccess={() => setIsAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employé</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Médecin</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Prochaine visite</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : filteredVisits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Aucune visite trouvée
                  </TableCell>
                </TableRow>
              ) : (
                filteredVisits.map((visit) => (
                  <TableRow key={visit.id}>
                    <TableCell className="font-medium">
                      {visit.personnel ? `${visit.personnel.first_name} ${visit.personnel.last_name}` : '-'}
                    </TableCell>
                    <TableCell>
                      {format(parseISO(visit.visit_date), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>{visit.visit_type}</TableCell>
                    <TableCell>{visit.doctor_name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[visit.fitness_status] || 'secondary'}>
                        {statusLabels[visit.fitness_status] || visit.fitness_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {visit.next_visit_date ? format(parseISO(visit.next_visit_date), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingVisit(visit)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(visit.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editingVisit && (
        <Dialog open={!!editingVisit} onOpenChange={(open) => !open && setEditingVisit(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier la visite</DialogTitle>
            </DialogHeader>
            <MedicalVisitForm 
              initialData={editingVisit} 
              onSuccess={() => setEditingVisit(null)} 
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
