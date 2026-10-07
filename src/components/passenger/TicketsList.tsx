import { usePassengerTickets, useCancelPassengerTicket } from '@/hooks/usePassengerTransport';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Ticket, XCircle, Printer } from 'lucide-react';
import { TicketForm } from './TicketForm';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
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

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  valid: 'default',
  used: 'outline',
  cancelled: 'destructive',
  expired: 'secondary',
};

const STATUS_LABELS: Record<string, string> = {
  valid: 'Valide',
  used: 'Utilisé',
  cancelled: 'Annulé',
  expired: 'Expiré',
};

export function TicketsList() {
  const { data: tickets = [], isLoading } = usePassengerTickets();
  const cancelTicket = useCancelPassengerTicket();

  const handlePrint = (ticket: typeof tickets[0]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Billet ${ticket.ticket_number}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
          .ticket { border: 2px solid #333; padding: 20px; border-radius: 8px; }
          .header { text-align: center; border-bottom: 1px dashed #ccc; padding-bottom: 15px; margin-bottom: 15px; }
          .company { font-size: 24px; font-weight: bold; }
          .ticket-number { font-size: 14px; color: #666; margin-top: 5px; }
          .route { text-align: center; margin: 20px 0; }
          .route-cities { font-size: 18px; font-weight: bold; }
          .arrow { font-size: 24px; margin: 0 10px; }
          .details { margin: 15px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dotted #eee; }
          .price { text-align: center; font-size: 28px; font-weight: bold; color: #2563eb; margin: 20px 0; }
          .footer { text-align: center; font-size: 12px; color: #666; margin-top: 20px; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="header">
            <div class="company">FleetPro Transport</div>
            <div class="ticket-number">N° ${ticket.ticket_number}</div>
          </div>
          
          <div class="route">
            <div class="route-cities">
              ${ticket.from_station?.city || ''} <span class="arrow">→</span> ${ticket.to_station?.city || ''}
            </div>
            <div style="font-size: 12px; color: #666; margin-top: 5px;">
              ${ticket.from_station?.name || ''} → ${ticket.to_station?.name || ''}
            </div>
          </div>
          
          <div class="details">
            <div class="detail-row">
              <span>Ligne:</span>
              <span>${ticket.trip?.line?.code || ''} - ${ticket.trip?.line?.name || ''}</span>
            </div>
            <div class="detail-row">
              <span>Date:</span>
              <span>${ticket.trip?.trip_date ? format(new Date(ticket.trip.trip_date), 'dd/MM/yyyy', { locale: fr }) : ''}</span>
            </div>
            <div class="detail-row">
              <span>Départ:</span>
              <span>${ticket.trip?.departure_time?.slice(0, 5) || ''}</span>
            </div>
            <div class="detail-row">
              <span>Émis le:</span>
              <span>${format(new Date(ticket.issue_date), 'dd/MM/yyyy HH:mm', { locale: fr })}</span>
            </div>
          </div>
          
          <div class="price">${ticket.fare_amount.toFixed(2)} MAD</div>
          
          <div class="footer">
            Merci de votre confiance<br>
            Ce billet est valable uniquement pour le voyage indiqué
          </div>
        </div>
        <script>window.print(); window.close();</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Stats
  const validTickets = tickets.filter((t) => t.status === 'valid').length;
  const totalRevenue = tickets.filter((t) => t.status !== 'cancelled').reduce((sum, t) => sum + t.fare_amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Billets émis</h2>
          <p className="text-sm text-muted-foreground">
            {tickets.length} billet(s) • {validTickets} valide(s) • {totalRevenue.toFixed(2)} MAD
          </p>
        </div>
        <TicketForm />
      </div>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Ticket className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucun billet émis</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Billet</TableHead>
                  <TableHead>Voyage</TableHead>
                  <TableHead>Trajet</TableHead>
                  <TableHead>Date émission</TableHead>
                  <TableHead className="text-right">Prix</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-mono text-sm">{ticket.ticket_number}</TableCell>
                    <TableCell>
                      <div>
                        <Badge variant="outline" className="mb-1">{ticket.trip?.line?.code}</Badge>
                        <p className="text-sm">{ticket.trip?.trip_date} - {ticket.trip?.departure_time?.slice(0, 5)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{ticket.from_station?.name}</p>
                        <p className="text-muted-foreground">→ {ticket.to_station?.name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(ticket.issue_date), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {ticket.fare_amount.toFixed(2)} MAD
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_COLORS[ticket.status] || 'secondary'}>
                        {STATUS_LABELS[ticket.status] || ticket.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handlePrint(ticket)}
                          title="Imprimer"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                        {ticket.status === 'valid' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                title="Annuler"
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Annuler ce billet ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Le billet {ticket.ticket_number} sera marqué comme annulé.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Fermer</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => cancelTicket.mutate(ticket.id)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  Annuler le billet
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
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
