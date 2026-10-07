import { useTMSTarifs, useDeleteTMSTarif } from '@/hooks/useTMS';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Loader2, Tag } from 'lucide-react';
import { TarifForm } from './TarifForm';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export function TarifsList() {
  const { data: tarifs = [], isLoading } = useTMSTarifs();
  const deleteTarif = useDeleteTMSTarif();

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Tarification</h2>
          <p className="text-sm text-muted-foreground">{tarifs.length} tarif(s)</p>
        </div>
        <TarifForm />
      </div>

      {tarifs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Tag className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucun tarif configuré</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Prix/km</TableHead>
                  <TableHead className="text-right">Prix/tonne</TableHead>
                  <TableHead className="text-right">Prix min.</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tarifs.map((tarif) => (
                  <TableRow key={tarif.id}>
                    <TableCell className="font-medium">{tarif.name}</TableCell>
                    <TableCell>{tarif.client?.name || 'Général'}</TableCell>
                    <TableCell className="text-right">{Number(tarif.price_per_km).toFixed(2)} MAD</TableCell>
                    <TableCell className="text-right">{Number(tarif.price_per_ton).toFixed(2)} MAD</TableCell>
                    <TableCell className="text-right">{Number(tarif.min_price).toFixed(2)} MAD</TableCell>
                    <TableCell><Badge variant={tarif.status === 'active' ? 'default' : 'secondary'}>{tarif.status === 'active' ? 'Actif' : 'Inactif'}</Badge></TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer ce tarif ?</AlertDialogTitle>
                            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteTarif.mutate(tarif.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
