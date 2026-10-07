import { useTMSDevis, useDeleteTMSDevis, useUpdateTMSDevis } from '@/hooks/useTMS';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Loader2, FileText } from 'lucide-react';
import { DevisForm } from './DevisForm';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary', sent: 'default', accepted: 'outline', rejected: 'destructive', expired: 'destructive',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon', sent: 'Envoyé', accepted: 'Accepté', rejected: 'Rejeté', expired: 'Expiré',
};

export function DevisList() {
  const { data: devis = [], isLoading } = useTMSDevis();
  const deleteDevis = useDeleteTMSDevis();
  const updateDevis = useUpdateTMSDevis();

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Devis</h2>
          <p className="text-sm text-muted-foreground">{devis.length} devis</p>
        </div>
        <DevisForm />
      </div>

      {devis.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucun devis créé</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Devis</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Trajet</TableHead>
                  <TableHead className="text-right">Distance</TableHead>
                  <TableHead className="text-right">Poids</TableHead>
                  <TableHead className="text-right">Montant TTC</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devis.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.devis_number}</TableCell>
                    <TableCell>{d.client?.name || '-'}</TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <p>{d.pickup_address}</p>
                        <p className="text-muted-foreground">→ {d.delivery_address}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{Number(d.distance_km).toFixed(0)} km</TableCell>
                    <TableCell className="text-right">{Number(d.weight_tons).toFixed(2)} t</TableCell>
                    <TableCell className="text-right font-semibold">{Number(d.amount_ttc).toFixed(2)} MAD</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-auto p-0">
                            <Badge variant={STATUS_COLORS[d.status] || 'secondary'}>{STATUS_LABELS[d.status] || d.status}</Badge>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {['draft', 'sent', 'accepted', 'rejected'].map(s => (
                            <DropdownMenuItem key={s} onClick={() => updateDevis.mutate({ id: d.id, status: s })}>{STATUS_LABELS[s]}</DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer ce devis ?</AlertDialogTitle>
                            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteDevis.mutate(d.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
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
