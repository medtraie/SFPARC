import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { useDrivingLicenses, useDrivingLicenseMutation, DrivingLicense } from '@/hooks/usePersonnel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { DrivingLicenseForm } from './DrivingLicenseForm';

export function DrivingLicensesList() {
  const { data: licenses = [], isLoading } = useDrivingLicenses();
  const { deleteLicense } = useDrivingLicenseMutation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<DrivingLicense | null>(null);

  const filteredLicenses = licenses.filter(l => {
    const personnelName = l.personnel ? `${l.personnel.first_name} ${l.personnel.last_name}` : '';
    return (
      l.license_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      personnelName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleDelete = async (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce permis ?')) {
      await deleteLicense.mutateAsync(id);
    }
  };

  const isExpired = (dateString: string) => {
    return new Date(dateString) < new Date();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par numéro ou employé..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un permis
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un permis</DialogTitle>
            </DialogHeader>
            <DrivingLicenseForm onSuccess={() => setIsAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employé</TableHead>
                <TableHead>Numéro</TableHead>
                <TableHead>Catégories</TableHead>
                <TableHead>Expiration</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : filteredLicenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Aucun permis trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredLicenses.map((license) => (
                  <TableRow key={license.id}>
                    <TableCell className="font-medium">
                      {license.personnel ? `${license.personnel.first_name} ${license.personnel.last_name}` : '-'}
                    </TableCell>
                    <TableCell>{license.license_number}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {license.categories?.length ? license.categories.join(', ') : '-'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className={isExpired(license.expiry_date) ? 'text-destructive font-bold' : ''}>
                        {format(parseISO(license.expiry_date), 'dd/MM/yyyy')}
                        {isExpired(license.expiry_date) && <span className="ml-2">(Expiré)</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingLicense(license)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(license.id)}
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

      {editingLicense && (
        <Dialog open={!!editingLicense} onOpenChange={(open) => !open && setEditingLicense(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier le permis</DialogTitle>
            </DialogHeader>
            <DrivingLicenseForm 
              initialData={editingLicense} 
              onSuccess={() => setEditingLicense(null)} 
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
