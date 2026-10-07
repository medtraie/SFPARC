import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RentalDashboard } from '@/components/rental/RentalDashboard';
import { RentalVehiclesList } from '@/components/rental/RentalVehiclesList';
import { RentalClientsList } from '@/components/rental/RentalClientsList';
import { RentalReservationsList } from '@/components/rental/RentalReservationsList';
import { RentalRentalsList } from '@/components/rental/RentalRentalsList';
import { RentalInvoicesList } from '@/components/rental/RentalInvoicesList';
import { RentalMap } from '@/components/rental/RentalMap';
import { RentalFuelLogs } from '@/components/rental/RentalFuelLogs';
import { RentalInspections } from '@/components/rental/RentalInspections';
import { RentalReports } from '@/components/rental/RentalReports';
import { RentalContractsList } from '@/components/rental/RentalContractsList';
import { supabase } from '@/integrations/supabase/client';
import {
  useRentalClients,
  useRentalContracts,
  useRentalFuelLogs,
  useRentalInspections,
  useRentalInvoices,
  useRentalRentals,
  useRentalReservations,
  useRentalVehicles,
} from '@/hooks/useRental';

export default function LocationVehicules() {
  const queryClient = useQueryClient();
  const [seeding, setSeeding] = useState(false);
  const [tab, setTab] = useState('dashboard');
  const [demoEnabled, setDemoEnabled] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('rental_demo') === '1' : false));

  const vehiclesQ = useRentalVehicles();
  const clientsQ = useRentalClients();
  const reservationsQ = useRentalReservations();
  const rentalsQ = useRentalRentals();
  const invoicesQ = useRentalInvoices();
  const contractsQ = useRentalContracts();
  const fuelQ = useRentalFuelLogs();
  const inspectionsQ = useRentalInspections();

  const demo = useMemo(() => {
    const vehicles = (vehiclesQ.data || []).filter((v) => (v.registration || '').startsWith('DEMO-'));
    const clients = (clientsQ.data || []).filter((c) => (c.email || '').startsWith('demo.'));
    const reservations = (reservationsQ.data || []).filter((r) => (r.reservation_number || '').startsWith('DEMO-'));
    const rentals = (rentalsQ.data || []).filter((r) => (r.rental_number || '').startsWith('DEMO-'));
    const invoices = (invoicesQ.data || []).filter((i) => (i.invoice_number || '').startsWith('DEMO-'));
    const contracts = (contractsQ.data || []).filter((c) => (c.contract_number || '').startsWith('DEMO-'));
    const fuelLogs = (fuelQ.data || []).filter((f) => (f.vehicle?.registration || '').startsWith('DEMO-'));
    const inspections = (inspectionsQ.data || []).filter((i) => (i.vehicle?.registration || '').startsWith('DEMO-'));

    const isOn = demoEnabled || vehicles.length > 0 || reservations.length > 0 || rentals.length > 0 || contracts.length > 0;
    return { isOn, vehicles, clients, reservations, rentals, invoices, contracts, fuelLogs, inspections };
  }, [
    clientsQ.data,
    contractsQ.data,
    demoEnabled,
    fuelQ.data,
    inspectionsQ.data,
    invoicesQ.data,
    rentalsQ.data,
    reservationsQ.data,
    vehiclesQ.data,
  ]);

  const seedDemo = async () => {
    setSeeding(true);
    try {
      const { data: existing, error: existingErr } = await supabase
        .from('rental_reservations')
        .select('id')
        .eq('reservation_number', 'DEMO-RES-001')
        .limit(1);
      if (existingErr) throw existingErr;
      if (existing && existing.length > 0) {
        localStorage.setItem('rental_demo', '1');
        setDemoEnabled(true);
        toast.info('Les données démo existent déjà');
        return;
      }

      const demoVehicles = [
        {
          registration: 'DEMO-001',
          brand: 'Dacia',
          model: 'Duster',
          year: 2022,
          vehicle_type: 'suv',
          current_mileage: 48210,
          price_per_day: 350,
          price_per_week: 2200,
          price_per_month: 8000,
          status: 'available',
          gps_imei: null,
          notes: 'Véhicule démo',
        },
        {
          registration: 'DEMO-002',
          brand: 'Renault',
          model: 'Clio',
          year: 2021,
          vehicle_type: 'car',
          current_mileage: 61500,
          price_per_day: 280,
          price_per_week: 1750,
          price_per_month: 6500,
          status: 'maintenance',
          gps_imei: null,
          notes: 'Véhicule démo (maintenance)',
        },
        {
          registration: 'DEMO-003',
          brand: 'Hyundai',
          model: 'i10',
          year: 2020,
          vehicle_type: 'car',
          current_mileage: 70220,
          price_per_day: 240,
          price_per_week: 1500,
          price_per_month: 5600,
          status: 'available',
          gps_imei: null,
          notes: 'Véhicule démo',
        },
      ];

      const { error: vErr } = await supabase
        .from('rental_vehicles')
        .upsert(demoVehicles as any, { onConflict: 'registration' });
      if (vErr) throw vErr;

      const { data: vehicles, error: vSelErr } = await supabase
        .from('rental_vehicles')
        .select('id, registration, price_per_day')
        .in(
          'registration',
          demoVehicles.map((v) => v.registration)
        );
      if (vSelErr) throw vSelErr;
      const vehicleByReg = new Map<string, { id: string; price_per_day: number | null }>();
      (vehicles || []).forEach((v: any) => vehicleByReg.set(v.registration, { id: v.id, price_per_day: v.price_per_day }));

      const demoClients = [
        {
          full_name: 'Client Démo 1',
          phone: '+212 600 000 001',
          email: 'demo.client1@example.com',
          address: 'Casablanca',
          driver_license_number: 'DL-DEMO-001',
          security_deposit_amount: 2000,
          score: 10,
          notes: 'Client démo',
        },
        {
          full_name: 'Client Démo 2',
          phone: '+212 600 000 002',
          email: 'demo.client2@example.com',
          address: 'Rabat',
          driver_license_number: 'DL-DEMO-002',
          security_deposit_amount: 1500,
          score: 6,
          notes: 'Client démo',
        },
        {
          full_name: 'Client Démo 3',
          phone: '+212 600 000 003',
          email: 'demo.client3@example.com',
          address: 'Marrakech',
          driver_license_number: 'DL-DEMO-003',
          security_deposit_amount: 1000,
          score: 2,
          notes: 'Client démo',
        },
      ];

      const { data: existingClients, error: cSelErr } = await supabase
        .from('rental_clients')
        .select('id, email')
        .in(
          'email',
          demoClients.map((c) => c.email)
        );
      if (cSelErr) throw cSelErr;

      const existingEmails = new Set((existingClients || []).map((c: any) => c.email));
      const missingClients = demoClients.filter((c) => !existingEmails.has(c.email));
      if (missingClients.length > 0) {
        const { error: cInsErr } = await supabase.from('rental_clients').insert(missingClients as any);
        if (cInsErr) throw cInsErr;
      }

      const { data: clients, error: cSel2Err } = await supabase
        .from('rental_clients')
        .select('id, email')
        .in(
          'email',
          demoClients.map((c) => c.email)
        );
      if (cSel2Err) throw cSel2Err;
      const clientByEmail = new Map<string, string>();
      (clients || []).forEach((c: any) => clientByEmail.set(c.email, c.id));

      const today = new Date();
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const addDays = (base: Date, days: number) => new Date(base.getTime() + days * 86400000);

      const v1 = vehicleByReg.get('DEMO-001')!;
      const v3 = vehicleByReg.get('DEMO-003')!;
      const c1 = clientByEmail.get('demo.client1@example.com')!;
      const c2 = clientByEmail.get('demo.client2@example.com')!;

      const res1Start = fmt(addDays(today, 1));
      const res1End = fmt(addDays(today, 3));
      const res2Start = fmt(today);
      const res2End = fmt(addDays(today, 2));

      const reservations = [
        {
          reservation_number: 'DEMO-RES-001',
          client_id: c1,
          vehicle_id: v1.id,
          start_date: res1Start,
          end_date: res1End,
          price_per_day: v1.price_per_day || 350,
          total_price: Number(((v1.price_per_day || 350) * 3).toFixed(2)),
          security_deposit: 2000,
          options: { gps: true, child_seat: false },
          status: 'pending',
          notes: 'Réservation démo',
        },
        {
          reservation_number: 'DEMO-RES-002',
          client_id: c2,
          vehicle_id: v3.id,
          start_date: res2Start,
          end_date: res2End,
          price_per_day: v3.price_per_day || 240,
          total_price: Number(((v3.price_per_day || 240) * 3).toFixed(2)),
          security_deposit: 1500,
          options: { gps: false, delivery: true },
          status: 'confirmed',
          notes: 'Réservation démo (confirmée)',
        },
      ];

      const { error: rErr } = await supabase
        .from('rental_reservations')
        .upsert(reservations as any, { onConflict: 'reservation_number' });
      if (rErr) throw rErr;

      const { data: resRows, error: resSelErr } = await supabase
        .from('rental_reservations')
        .select('id, reservation_number')
        .in('reservation_number', ['DEMO-RES-001', 'DEMO-RES-002']);
      if (resSelErr) throw resSelErr;
      const resByNumber = new Map<string, string>();
      (resRows || []).forEach((r: any) => resByNumber.set(r.reservation_number, r.id));

      const rentals = [
        {
          rental_number: 'DEMO-LOC-001',
          reservation_id: resByNumber.get('DEMO-RES-002') || null,
          client_id: c2,
          vehicle_id: v3.id,
          start_datetime: new Date(`${res2Start}T10:00:00.000Z`).toISOString(),
          end_datetime: new Date(`${res2End}T10:00:00.000Z`).toISOString(),
          total_price: Number(((v3.price_per_day || 240) * 3).toFixed(2)),
          status: 'active',
          notes: 'Location démo (active)',
        },
        {
          rental_number: 'DEMO-LOC-002',
          reservation_id: null,
          client_id: c1,
          vehicle_id: v1.id,
          start_datetime: addDays(today, -10).toISOString(),
          end_datetime: addDays(today, -7).toISOString(),
          actual_return_datetime: addDays(today, -7).toISOString(),
          total_price: Number(((v1.price_per_day || 350) * 4).toFixed(2)),
          extra_charges: 0,
          late_penalty: 0,
          missing_fuel_charge: 0,
          status: 'completed',
          notes: 'Location démo (terminée)',
        },
      ];

      const { error: lErr } = await supabase.from('rental_rentals').upsert(rentals as any, { onConflict: 'rental_number' });
      if (lErr) throw lErr;

      const { data: rentalRows, error: lSelErr } = await supabase
        .from('rental_rentals')
        .select('id, rental_number, vehicle_id')
        .in('rental_number', ['DEMO-LOC-001', 'DEMO-LOC-002']);
      if (lSelErr) throw lSelErr;
      const rentalByNumber = new Map<string, { id: string; vehicle_id: string }>();
      (rentalRows || []).forEach((r: any) => rentalByNumber.set(r.rental_number, { id: r.id, vehicle_id: r.vehicle_id }));

      const activeRental = rentalByNumber.get('DEMO-LOC-001');
      if (activeRental) {
        const { error: upVehErr } = await supabase.from('rental_vehicles').update({ status: 'rented' }).eq('id', activeRental.vehicle_id);
        if (upVehErr) throw upVehErr;
      }

      const contractRentalId = rentalByNumber.get('DEMO-LOC-001')?.id || null;
      if (contractRentalId) {
        const { error: cErr } = await supabase.from('rental_contracts').insert({
          rental_id: contractRentalId,
          contract_number: 'DEMO-CTR-001',
          contract_json: { demo: true, photos: { departure: [], return: [] } },
          signature_data_url: null,
          signed_at: null,
        } as any);
        if (cErr) throw cErr;
      }

      const invoices = [
        {
          invoice_number: 'DEMO-FAC-001',
          rental_id: rentalByNumber.get('DEMO-LOC-001')?.id,
          issue_date: fmt(today),
          due_date: fmt(addDays(today, 7)),
          amount_total: rentals[0].total_price,
          status: 'draft',
          email_sent: false,
          invoice_json: { demo: true },
        },
        {
          invoice_number: 'DEMO-FAC-002',
          rental_id: rentalByNumber.get('DEMO-LOC-002')?.id,
          issue_date: fmt(addDays(today, -7)),
          due_date: fmt(addDays(today, -3)),
          amount_total: rentals[1].total_price,
          status: 'paid',
          email_sent: true,
          invoice_json: { demo: true },
        },
      ].filter((i) => !!i.rental_id);

      const { error: fErr } = await supabase.from('rental_invoices').upsert(invoices as any, { onConflict: 'invoice_number' });
      if (fErr) throw fErr;

      const fuelLogs = [
        {
          vehicle_id: v1.id,
          rental_id: null,
          log_date: fmt(addDays(today, -2)),
          liters: 32,
          fuel_price_total: 480,
          mileage: 120,
        },
        {
          vehicle_id: v3.id,
          rental_id: rentalByNumber.get('DEMO-LOC-001')?.id || null,
          log_date: fmt(today),
          liters: 25,
          fuel_price_total: 370,
          mileage: 95,
        },
      ];
      const { error: flErr } = await supabase.from('rental_fuel_logs').insert(fuelLogs as any);
      if (flErr) throw flErr;

      const inspections = [
        {
          rental_id: rentalByNumber.get('DEMO-LOC-001')?.id || null,
          vehicle_id: v3.id,
          inspection_type: 'pre',
          fuel_level: 80,
          mileage: 70100,
          checklist: { carrosserie: 'ok', pneus: 'ok', vitres: 'ok', interieur: 'ok' },
          photos: [],
          notes: 'Inspection démo (avant)',
        },
        {
          rental_id: null,
          vehicle_id: v1.id,
          inspection_type: 'post',
          fuel_level: 35,
          mileage: 48310,
          checklist: { carrosserie: 'ok', pneus: 'ok', vitres: 'rayure mineure' },
          photos: [],
          notes: 'Inspection démo (après)',
        },
      ];
      const { error: inspErr } = await supabase.from('rental_inspections').insert(inspections as any);
      if (inspErr) throw inspErr;

      localStorage.setItem('rental_demo', '1');
      setDemoEnabled(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rental_vehicles'] }),
        queryClient.invalidateQueries({ queryKey: ['rental_clients'] }),
        queryClient.invalidateQueries({ queryKey: ['rental_reservations'] }),
        queryClient.invalidateQueries({ queryKey: ['rental_rentals'] }),
        queryClient.invalidateQueries({ queryKey: ['rental_contracts'] }),
        queryClient.invalidateQueries({ queryKey: ['rental_invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['rental_fuel_logs'] }),
        queryClient.invalidateQueries({ queryKey: ['rental_inspections'] }),
      ]);

      toast.success('Données de démonstration créées');
      setTab('dashboard');
    } catch (e: any) {
      toast.error(e?.message || 'Erreur lors du remplissage');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Location de Véhicules</h1>
              <p className="text-muted-foreground">
                Gestion complète: véhicules, clients, réservations, contrats, facturation et suivi
              </p>
            </div>
            <Button onClick={seedDemo} disabled={seeding} className="gap-2">
              <Sparkles className="w-4 h-4" />
              Remplir avec des données démo
            </Button>
          </div>
        </div>

        {demo.isOn && (
          <Card className="dashboard-panel">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Informations de démonstration</CardTitle>
                <div className="text-sm text-muted-foreground">Données fictives pour tester les fonctionnalités du module.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="gap-2" onClick={() => setTab('vehicles')}>
                  Véhicules <ArrowRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => setTab('clients')}>
                  Clients <ArrowRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => setTab('reservations')}>
                  Réservations <ArrowRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => setTab('gps')}>
                  GPS <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-8">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Véhicules</div>
                  <div className="text-lg font-semibold">{demo.vehicles.length}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Clients</div>
                  <div className="text-lg font-semibold">{demo.clients.length}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Réservations</div>
                  <div className="text-lg font-semibold">{demo.reservations.length}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Locations</div>
                  <div className="text-lg font-semibold">{demo.rentals.length}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Contrats</div>
                  <div className="text-lg font-semibold">{demo.contracts.length}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Factures</div>
                  <div className="text-lg font-semibold">{demo.invoices.length}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Carburant</div>
                  <div className="text-lg font-semibold">{demo.fuelLogs.length}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Inspections</div>
                  <div className="text-lg font-semibold">{demo.inspections.length}</div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Véhicule</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Prix/J</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(demo.vehicles || []).slice(0, 5).map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-medium">{v.registration}</TableCell>
                          <TableCell>{v.brand} {v.model}</TableCell>
                          <TableCell>
                            {v.status === 'available' ? (
                              <Badge className="bg-emerald-600 hover:bg-emerald-600">Disponible</Badge>
                            ) : v.status === 'rented' ? (
                              <Badge className="bg-red-600 hover:bg-red-600">Loué</Badge>
                            ) : v.status === 'maintenance' ? (
                              <Badge className="bg-amber-600 hover:bg-amber-600">Maintenance</Badge>
                            ) : (
                              <Badge variant="outline">{v.status}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{Number(v.price_per_day || 0).toFixed(0)} MAD</TableCell>
                        </TableRow>
                      ))}
                      {demo.vehicles.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                            Cliquez sur “Remplir avec des données démo”
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Réservation</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Véhicule</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(demo.reservations || []).slice(0, 5).map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.reservation_number}</TableCell>
                          <TableCell>{r.client?.full_name || '-'}</TableCell>
                          <TableCell>{r.vehicle?.registration || '-'}</TableCell>
                          <TableCell>
                            {r.status === 'pending' ? (
                              <Badge className="bg-amber-600 hover:bg-amber-600">En attente</Badge>
                            ) : r.status === 'confirmed' ? (
                              <Badge className="bg-sky-600 hover:bg-sky-600">Confirmée</Badge>
                            ) : (
                              <Badge variant="outline">{r.status}</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {demo.reservations.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                            Cliquez sur “Remplir avec des données démo”
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 lg:grid-cols-11">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="vehicles">Véhicules</TabsTrigger>
            <TabsTrigger value="clients">Clients</TabsTrigger>
            <TabsTrigger value="reservations">Réservations</TabsTrigger>
            <TabsTrigger value="rentals">Locations</TabsTrigger>
            <TabsTrigger value="invoices">Facturation</TabsTrigger>
            <TabsTrigger value="contracts">Contrats</TabsTrigger>
            <TabsTrigger value="gps">GPS</TabsTrigger>
            <TabsTrigger value="fuel">Carburant</TabsTrigger>
            <TabsTrigger value="inspections">Inspection</TabsTrigger>
            <TabsTrigger value="reports">Rapports</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <RentalDashboard />
          </TabsContent>
          <TabsContent value="vehicles">
            <RentalVehiclesList />
          </TabsContent>
          <TabsContent value="clients">
            <RentalClientsList />
          </TabsContent>
          <TabsContent value="reservations">
            <RentalReservationsList />
          </TabsContent>
          <TabsContent value="rentals">
            <RentalRentalsList />
          </TabsContent>
          <TabsContent value="invoices">
            <RentalInvoicesList />
          </TabsContent>
          <TabsContent value="contracts">
            <RentalContractsList />
          </TabsContent>
          <TabsContent value="gps">
            <RentalMap />
          </TabsContent>
          <TabsContent value="fuel">
            <RentalFuelLogs />
          </TabsContent>
          <TabsContent value="inspections">
            <RentalInspections />
          </TabsContent>
          <TabsContent value="reports">
            <RentalReports />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
