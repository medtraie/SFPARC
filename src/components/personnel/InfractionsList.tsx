import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, AlertTriangle } from 'lucide-react';
import { useInfractions, useInfractionMutation, Infraction } from '@/hooks/usePersonnel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { InfractionForm } from './InfractionForm';

export function InfractionsList() {
  const { data: infractions = [], isLoading } = useInfractions();
  const { deleteInfraction } = useInfractionMutation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingInfraction, setEditingInfraction] = useState<Infraction | null>(null);

  const filteredInfractions = infractions.filter(i => {
    const personnelName = i.personnel ? `${i.personnel.first_name} ${i.personnel.last_name}` : '';
    return (
      i.infraction_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      personnelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.location && i.location.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const handleDelete = async (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette infraction ?')) {
      await deleteInfraction.mutateAsync(id);
    }
  };

  const statusLabels: Record<string, string> = {
    unpaid: 'Non payé',
    paid: 'Payé',
    contested: 'Contesté',
  };

  const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    unpaid: 'destructive',
    paid: 'default',
    contested: 'outline',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par type, employé, lieu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Ajouter une infraction
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter une infraction</DialogTitle>
            </DialogHeader>
            <InfractionForm onSuccess={() => setIsAddOpen(false)} />
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
                <TableHead>Lieu</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="text-center">Points</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : filteredInfractions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Aucune infraction trouvée
                  </TableCell>
                </TableRow>
              ) : (
                filteredInfractions.map((infraction) => (
                  <TableRow key={infraction.id}>
                    <TableCell className="font-medium">
                      {infraction.personnel ? `${infraction.personnel.first_name} ${infraction.personnel.last_name}` : '-'}
                    </TableCell>
                    <TableCell>
                      {format(parseISO(infraction.infraction_date), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>{infraction.infraction_type}</TableCell>
                    <TableCell>{infraction.location || '-'}</TableCell>
                    <TableCell className="text-right">{infraction.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{infraction.points_deducted || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[infraction.status || 'unpaid'] || 'secondary'}>
                        {statusLabels[infraction.status || 'unpaid'] || infraction.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingInfraction(infraction)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(infraction.id)}
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

      {editingInfraction && (
        <Dialog open={!!editingInfraction} onOpenChange={(open) => !open && setEditingInfraction(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier l'infraction</DialogTitle>
            </DialogHeader>
            <InfractionForm 
              initialData={editingInfraction} 
              onSuccess={() => setEditingInfraction(null)} 
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
