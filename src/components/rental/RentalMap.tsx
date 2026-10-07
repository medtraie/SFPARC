import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import FleetMap, { type MapVehicle } from '@/components/map/FleetMap';
import { useGPSwoxVehicles } from '@/hooks/useGPSwoxVehicles';
import { useRentalVehicles } from '@/hooks/useRental';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function normalize(v: string) {
  return (v || '').trim().toLowerCase();
}

function hashSeed(s: string) {
  let acc = 0;
  for (let i = 0; i < s.length; i++) acc = (acc + s.charCodeAt(i) * (i + 1)) % 100000;
  return acc;
}

function demoLastPosition(seed: string) {
  const cities = [
    { city: 'Casablanca', lat: 33.5731, lng: -7.5898 },
    { city: 'Rabat', lat: 34.0209, lng: -6.8416 },
    { city: 'Marrakech', lat: 31.6295, lng: -7.9811 },
    { city: 'Tanger', lat: 35.7595, lng: -5.834 },
    { city: 'Agadir', lat: 30.4278, lng: -9.5981 },
  ];

  const h = hashSeed(seed);
  const base = cities[h % cities.length];
  const jitterLat = ((h % 97) - 48) / 5000;
  const jitterLng = (((h * 7) % 97) - 48) / 5000;
  return { city: base.city, lat: base.lat + jitterLat, lng: base.lng + jitterLng };
}

export function RentalMap() {
  const rentalVehiclesQ = useRentalVehicles();
  const gpsQ = useGPSwoxVehicles(30000);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>(undefined);
  const demoMode = typeof window !== 'undefined' && localStorage.getItem('rental_demo') === '1';

  const mapVehicles = useMemo<MapVehicle[]>(() => {
    const rentalVehicles = rentalVehiclesQ.data || [];
    const gpsVehicles = gpsQ.data || [];

    const byImei = new Map<string, (typeof gpsVehicles)[number]>();
    const byPlate = new Map<string, (typeof gpsVehicles)[number]>();
    gpsVehicles.forEach((g) => {
      if (g.imei) byImei.set(normalize(g.imei), g);
      if (g.plate) byPlate.set(normalize(g.plate), g);
    });

    return rentalVehicles.map((rv) => {
      const gps =
        (rv.gps_imei ? byImei.get(normalize(rv.gps_imei)) : undefined) ||
        byPlate.get(normalize(rv.registration));

      const status: MapVehicle['status'] =
        rv.status === 'available' || rv.status === 'maintenance' || rv.status === 'rented'
          ? (rv.status as any)
          : rv.status === 'Disponible'
            ? 'available'
            : rv.status === 'Loué'
              ? 'rented'
              : rv.status === 'Maintenance'
                ? 'maintenance'
                : 'inactive';

      return {
        id: rv.id,
        plate: rv.registration,
        brand: rv.brand,
        model: rv.model,
        status,
        mileage: Number(gps?.mileage ?? rv.current_mileage ?? 0),
        driver: gps?.driver ?? (demoMode ? 'Démo' : null),
        lastPosition: gps?.lastPosition
          ? { lat: gps.lastPosition.lat, lng: gps.lastPosition.lng, city: gps.lastPosition.city }
          : demoMode
            ? demoLastPosition(rv.registration)
            : undefined,
      };
    });
  }, [demoMode, gpsQ.data, rentalVehiclesQ.data]);

  const selectable = useMemo(() => mapVehicles.filter((v) => v.lastPosition), [mapVehicles]);

  return (
    <Card className="dashboard-panel">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Suivi GPS</CardTitle>
        <div className="w-[340px] max-w-full">
          <Select value={selectedVehicleId || ''} onValueChange={(v) => setSelectedVehicleId(v || undefined)}>
            <SelectTrigger>
              <SelectValue placeholder="Centrer sur un véhicule" />
            </SelectTrigger>
            <SelectContent>
              {selectable.length === 0 ? (
                <SelectItem value="none" disabled>
                  Aucun véhicule localisable
                </SelectItem>
              ) : (
                selectable.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.plate} — {v.brand} {v.model}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative h-[520px] rounded-lg overflow-hidden border">
          <FleetMap vehicles={mapVehicles} selectedVehicleId={selectedVehicleId} onVehicleSelect={setSelectedVehicleId} />
        </div>
      </CardContent>
    </Card>
  );
}
