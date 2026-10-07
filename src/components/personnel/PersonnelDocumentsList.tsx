import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, FileText } from 'lucide-react';
import { usePersonnelDocuments, usePersonnelDocumentMutation, PersonnelDocument } from '@/hooks/usePersonnel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { PersonnelDocumentForm } from './PersonnelDocumentForm';

export function PersonnelDocumentsList() {
  const { data: documents = [], isLoading } = usePersonnelDocuments();
  const { deleteDocument } = usePersonnelDocumentMutation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<PersonnelDocument | null>(null);

  const filteredDocuments = documents.filter(d => {
    const personnelName = d.personnel ? `${d.personnel.first_name} ${d.personnel.last_name}` : '';
    return (
      d.document_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      personnelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.document_number && d.document_number.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const handleDelete = async (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
      await deleteDocument.mutateAsync(id);
    }
  };

  const isExpired = (dateString: string | null) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par type, employé, numéro..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un document</DialogTitle>
            </DialogHeader>
            <PersonnelDocumentForm onSuccess={() => setIsAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employé</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Numéro</TableHead>
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
              ) : filteredDocuments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Aucun document trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      {doc.personnel ? `${doc.personnel.first_name} ${doc.personnel.last_name}` : '-'}
                    </TableCell>
                    <TableCell className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {doc.document_type}
                    </TableCell>
                    <TableCell>{doc.document_number || '-'}</TableCell>
                    <TableCell>
                      {doc.expiry_date ? (
                        <div className={isExpired(doc.expiry_date) ? 'text-destructive font-bold' : ''}>
                          {format(parseISO(doc.expiry_date), 'dd/MM/yyyy')}
                          {isExpired(doc.expiry_date) && <span className="ml-2">(Expiré)</span>}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingDocument(doc)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(doc.id)}
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

      {editingDocument && (
        <Dialog open={!!editingDocument} onOpenChange={(open) => !open && setEditingDocument(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier le document</DialogTitle>
            </DialogHeader>
            <PersonnelDocumentForm 
              initialData={editingDocument} 
              onSuccess={() => setEditingDocument(null)} 
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
