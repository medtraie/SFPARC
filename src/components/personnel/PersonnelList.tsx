import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Search, FileText } from 'lucide-react';
import { usePersonnel, usePersonnelMutation, Personnel } from '@/hooks/usePersonnel';
import { useDrivers } from '@/hooks/useDrivers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PersonnelForm } from './PersonnelForm';

export function PersonnelList() {
  const { t } = useTranslation();
  const { data: personnel = [], isLoading } = usePersonnel();
  const { data: drivers = [], isLoading: isLoadingDrivers } = useDrivers();
  const { deletePersonnel } = usePersonnelMutation();
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'personnel' | 'drivers'>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null);

  const personnelRows = useMemo(
    () =>
      personnel.map((person) => ({
        id: person.id,
        fullName: `${person.first_name} ${person.last_name}`.trim(),
        cin: person.cin || '-',
        role: person.role,
        status: person.status,
        source: 'personnel' as const,
        personnel: person,
      })),
    [personnel]
  );

  const existingDriverKeys = useMemo(() => {
    return new Set(
      personnelRows
        .filter((person) => person.role === 'driver')
        .map((person) => person.fullName.toLowerCase())
    );
  }, [personnelRows]);

  const driverRows = useMemo(
    () =>
      drivers
        .map((driver) => {
          const driverStatus = driver.status === 'off_duty' ? 'inactive' : 'active';
          return {
            id: `driver-${driver.id}`,
            fullName: driver.name,
            cin: '-',
            role: 'driver',
            status: driverStatus,
            source: 'drivers' as const,
            personnel: null,
          };
        })
        .filter((driver) => {
          const key = driver.fullName.toLowerCase();
          return !existingDriverKeys.has(key);
        }),
    [drivers, existingDriverKeys]
  );

  const allRows = useMemo(() => [...personnelRows, ...driverRows], [personnelRows, driverRows]);
  const sourceCounts = useMemo(() => {
    const personnelCount = allRows.filter((row) => row.source === 'personnel').length;
    const driversCount = allRows.filter((row) => row.source === 'drivers').length;
    return {
      all: allRows.length,
      personnel: personnelCount,
      drivers: driversCount,
    };
  }, [allRows]);

  const filteredPersonnel = allRows.filter((row) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      row.fullName.toLowerCase().includes(query) ||
      row.cin.toLowerCase().includes(query);
    const matchesSource = sourceFilter === 'all' || row.source === sourceFilter;
    return matchesSearch && matchesSource;
  });

  const handleDelete = async (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cet employé ?')) {
      await deletePersonnel.mutateAsync(id);
    }
  };

  const roleLabels: Record<string, string> = {
    driver: 'Chauffeur',
    mechanic: 'Mécanicien',
    manager: 'Manager',
    admin: 'Administrateur',
  };

  const statusLabels: Record<string, string> = {
    active: 'Actif',
    inactive: 'Inactif',
    suspended: 'Suspendu',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, CIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un employé
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un employé</DialogTitle>
            </DialogHeader>
            <PersonnelForm onSuccess={() => setIsAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={sourceFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSourceFilter('all')}
        >
          Tous ({sourceCounts.all})
        </Button>
        <Button
          variant={sourceFilter === 'personnel' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSourceFilter('personnel')}
        >
          Personnel ({sourceCounts.personnel})
        </Button>
        <Button
          variant={sourceFilter === 'drivers' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSourceFilter('drivers')}
        >
          Chauffeurs (Drivers) ({sourceCounts.drivers})
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom complet</TableHead>
                <TableHead>CIN</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || isLoadingDrivers ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : filteredPersonnel.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Aucun employé trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredPersonnel.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell className="font-medium">
                      {person.fullName}
                    </TableCell>
                    <TableCell>{person.cin}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{roleLabels[person.role] || person.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={person.status === 'active' ? 'default' : 'secondary'}>
                        {statusLabels[person.status] || person.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {person.source === 'personnel' && person.personnel ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingPersonnel(person.personnel)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(person.personnel.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="secondary">Depuis Drivers</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editingPersonnel && (
        <Dialog open={!!editingPersonnel} onOpenChange={(open) => !open && setEditingPersonnel(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier l'employé</DialogTitle>
            </DialogHeader>
            <PersonnelForm 
              initialData={editingPersonnel} 
              onSuccess={() => setEditingPersonnel(null)} 
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
