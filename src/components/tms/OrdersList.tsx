import { useTMSOrders, useDeleteTMSOrder, useUpdateTMSOrder } from '@/hooks/useTMS';
import { useDrivers } from '@/hooks/useDrivers';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Loader2, Truck } from 'lucide-react';
import { OrderForm } from './OrderForm';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  planned: 'secondary', loading: 'default', in_transit: 'default', delivered: 'outline', cancelled: 'destructive',
};
const STATUS_LABELS: Record<string, string> = {
  planned: 'Planifié', loading: 'En chargement', in_transit: 'En transit', delivered: 'Livré', cancelled: 'Annulé',
};

export function OrdersList() {
  const { data: orders = [], isLoading } = useTMSOrders();
  const { data: drivers = [] } = useDrivers();
  const deleteOrder = useDeleteTMSOrder();
  const updateOrder = useUpdateTMSOrder();

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  const getDriverName = (driverId: string | null) => {
    if (!driverId) return '-';
    return drivers.find(d => d.id === driverId)?.name || '-';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Ordres de transport</h2>
          <p className="text-sm text-muted-foreground">{orders.length} ordre(s)</p>
        </div>
        <OrderForm />
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Truck className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucun ordre de transport</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Ordre</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Trajet</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Chauffeur</TableHead>
                  <TableHead className="text-right">Distance</TableHead>
                  <TableHead className="text-right">Poids</TableHead>
                  <TableHead className="text-right">Montant HT</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell>{order.client?.name || '-'}</TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <p>{order.pickup_address}</p>
                        <p className="text-muted-foreground">→ {order.delivery_address}</p>
                      </div>
                    </TableCell>
                    <TableCell>{format(new Date(order.pickup_date), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                    <TableCell>{getDriverName(order.driver_id)}</TableCell>
                    <TableCell className="text-right">{Number(order.distance_km).toFixed(0)} km</TableCell>
                    <TableCell className="text-right">{Number(order.weight_tons).toFixed(2)} t</TableCell>
                    <TableCell className="text-right font-semibold">{Number(order.amount_ht).toFixed(2)} MAD</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-auto p-0">
                            <Badge variant={STATUS_COLORS[order.status] || 'secondary'}>{STATUS_LABELS[order.status] || order.status}</Badge>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {Object.entries(STATUS_LABELS).map(([k, v]) => (
                            <DropdownMenuItem key={k} onClick={() => updateOrder.mutate({ id: order.id, status: k })}>{v}</DropdownMenuItem>
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
                            <AlertDialogTitle>Supprimer cet ordre ?</AlertDialogTitle>
                            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteOrder.mutate(order.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
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
