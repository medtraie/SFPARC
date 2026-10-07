import { usePassengerBaggage } from '@/hooks/usePassengerTransport';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Luggage, Printer } from 'lucide-react';
import { BaggageForm } from './BaggageForm';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  checked: 'default',
  loaded: 'outline',
  delivered: 'secondary',
  lost: 'destructive',
};

const STATUS_LABELS: Record<string, string> = {
  checked: 'Enregistré',
  loaded: 'Chargé',
  delivered: 'Livré',
  lost: 'Perdu',
};

export function BaggageList() {
  const { data: baggage = [], isLoading } = usePassengerBaggage();

  const handlePrint = (item: typeof baggage[0]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bagage ${item.baggage_number}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 300px; margin: 0 auto; }
          .baggage { border: 2px solid #333; padding: 15px; border-radius: 8px; }
          .header { text-align: center; border-bottom: 1px dashed #ccc; padding-bottom: 10px; margin-bottom: 10px; }
          .company { font-size: 18px; font-weight: bold; }
          .number { font-size: 20px; font-weight: bold; margin: 10px 0; font-family: monospace; }
          .details { font-size: 12px; }
          .detail-row { display: flex; justify-content: space-between; padding: 3px 0; }
          .price { text-align: center; font-size: 18px; font-weight: bold; margin-top: 10px; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="baggage">
          <div class="header">
            <div class="company">SFTM Transport</div>
            <div>BAGAGE</div>
          </div>
          <div class="number">${item.baggage_number}</div>
          <div class="details">
            ${item.weight_kg ? `<div class="detail-row"><span>Poids:</span><span>${item.weight_kg} kg</span></div>` : ''}
            ${item.description ? `<div class="detail-row"><span>Description:</span><span>${item.description}</span></div>` : ''}
            <div class="detail-row"><span>Date:</span><span>${format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</span></div>
          </div>
          ${item.fee_amount > 0 ? `<div class="price">${item.fee_amount.toFixed(2)} MAD</div>` : ''}
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
  const totalBaggage = baggage.length;
  const totalFees = baggage.reduce((sum, b) => sum + b.fee_amount, 0);
  const totalWeight = baggage.reduce((sum, b) => sum + (b.weight_kg || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Bagages enregistrés</h2>
          <p className="text-sm text-muted-foreground">
            {totalBaggage} bagage(s) • {totalWeight.toFixed(1)} kg • {totalFees.toFixed(2)} MAD
          </p>
        </div>
        <BaggageForm />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Luggage className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total bagages</p>
              <p className="text-2xl font-bold">{totalBaggage}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-lg bg-info/10 flex items-center justify-center">
              <Luggage className="w-6 h-6 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Poids total</p>
              <p className="text-2xl font-bold">{totalWeight.toFixed(1)} kg</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
              <Luggage className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Frais collectés</p>
              <p className="text-2xl font-bold">{totalFees.toFixed(2)} MAD</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {baggage.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Luggage className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucun bagage enregistré</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Bagage</TableHead>
                  <TableHead>Poids</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Frais</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {baggage.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">{item.baggage_number}</TableCell>
                    <TableCell>{item.weight_kg ? `${item.weight_kg} kg` : '-'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{item.description || '-'}</TableCell>
                    <TableCell>
                      {format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {item.fee_amount > 0 ? `${item.fee_amount.toFixed(2)} MAD` : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_COLORS[item.status] || 'secondary'}>
                        {STATUS_LABELS[item.status] || item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handlePrint(item)}
                        title="Imprimer étiquette"
                      >
                        <Printer className="w-4 h-4" />
                      </Button>
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
