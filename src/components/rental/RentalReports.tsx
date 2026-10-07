import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useRentalClients, useRentalRentals, useRentalReservations, useRentalVehicles } from '@/hooks/useRental';

function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Record<string, any>[]) {
  const headers = Array.from(
    rows.reduce((acc, r) => {
      Object.keys(r).forEach((k) => acc.add(k));
      return acc;
    }, new Set<string>())
  );

  const escape = (v: any) => {
    const s = v == null ? '' : String(v);
    const needs = /[",\n]/.test(s);
    const escaped = s.replace(/"/g, '""');
    return needs ? `"${escaped}"` : escaped;
  };

  const lines = [headers.join(',')];
  rows.forEach((r) => {
    lines.push(headers.map((h) => escape(r[h])).join(','));
  });
  return lines.join('\n');
}

export function RentalReports() {
  const vehiclesQ = useRentalVehicles();
  const clientsQ = useRentalClients();
  const reservationsQ = useRentalReservations();
  const rentalsQ = useRentalRentals();

  const totals = useMemo(() => {
    const rentals = rentalsQ.data || [];
    const revenue = rentals.reduce((acc, r) => acc + Number(r.total_price || 0), 0);
    const active = rentals.filter((r) => r.status === 'active').length;
    return {
      vehicles: (vehiclesQ.data || []).length,
      clients: (clientsQ.data || []).length,
      reservations: (reservationsQ.data || []).length,
      rentals: rentals.length,
      active,
      revenue: Number(revenue.toFixed(2)),
    };
  }, [clientsQ.data, rentalsQ.data, reservationsQ.data, vehiclesQ.data]);

  const exportVehiclesCsv = () => {
    const rows =
      (vehiclesQ.data || []).map((v) => ({
        registration: v.registration,
        brand: v.brand,
        model: v.model,
        year: v.year ?? '',
        vehicle_type: v.vehicle_type,
        status: v.status,
        price_per_day: v.price_per_day,
        price_per_week: v.price_per_week,
        price_per_month: v.price_per_month,
        current_mileage: v.current_mileage ?? '',
        gps_imei: v.gps_imei ?? '',
      })) || [];

    downloadText(`rental-vehicles-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
  };

  const exportReservationsCsv = () => {
    const rows =
      (reservationsQ.data || []).map((r: any) => ({
        reservation_number: r.reservation_number,
        client: r.client?.full_name || '',
        vehicle: r.vehicle?.registration || '',
        start_date: r.start_date,
        end_date: r.end_date,
        status: r.status,
        total_price: r.total_price,
        security_deposit: r.security_deposit,
      })) || [];

    downloadText(`rental-reservations-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
  };

  const exportRentalsPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Rapport Locations', 14, 18);
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleDateString('fr-MA')}`, 14, 24);

    const rows = (rentalsQ.data || []).map((r: any) => [
      r.rental_number,
      r.client?.full_name || '-',
      r.vehicle?.registration || '-',
      r.start_datetime ? new Date(r.start_datetime).toLocaleDateString('fr-MA') : '-',
      r.end_datetime ? new Date(r.end_datetime).toLocaleDateString('fr-MA') : '-',
      r.status,
      Number(r.total_price || 0).toFixed(2),
    ]);

    autoTable(doc, {
      head: [['N°', 'Client', 'Véhicule', 'Début', 'Fin', 'Statut', 'Total']],
      body: rows,
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [22, 78, 99], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 6: { halign: 'right' } },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 80;
    doc.setFontSize(12);
    doc.text(`Revenu total: ${totals.revenue.toFixed(2)} MAD`, 14, finalY + 12);
    doc.text(`Locations actives: ${totals.active}`, 14, finalY + 18);
    doc.save(`rental-rentals-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="dashboard-panel">
        <CardHeader>
          <CardTitle>Résumé</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Véhicules</span>
            <span className="font-medium">{totals.vehicles}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Clients</span>
            <span className="font-medium">{totals.clients}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Réservations</span>
            <span className="font-medium">{totals.reservations}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Locations</span>
            <span className="font-medium">{totals.rentals}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Actives</span>
            <span className="font-medium">{totals.active}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Revenu</span>
            <span className="font-medium">{totals.revenue.toFixed(2)} MAD</span>
          </div>
        </CardContent>
      </Card>

      <Card className="dashboard-panel lg:col-span-2">
        <CardHeader>
          <CardTitle>Exports</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={exportVehiclesCsv} disabled={vehiclesQ.isLoading}>
            <Download className="w-4 h-4" />
            Véhicules (CSV)
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportReservationsCsv} disabled={reservationsQ.isLoading}>
            <Download className="w-4 h-4" />
            Réservations (CSV)
          </Button>
          <Button className="gap-2" onClick={exportRentalsPdf} disabled={rentalsQ.isLoading}>
            <FileDown className="w-4 h-4" />
            Locations (PDF)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

