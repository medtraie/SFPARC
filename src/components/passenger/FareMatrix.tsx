import { useState, useEffect } from 'react';
import { usePassengerFares, useCreatePassengerFare, useUpdatePassengerFare, PassengerStation } from '@/hooks/usePassengerTransport';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Save } from 'lucide-react';

interface FareMatrixProps {
  lineId: string;
  stations: PassengerStation[];
}

export function FareMatrix({ lineId, stations }: FareMatrixProps) {
  const { data: existingFares = [], isLoading } = usePassengerFares(lineId);
  const createFare = useCreatePassengerFare();
  const updateFare = useUpdatePassengerFare();
  
  const [fares, setFares] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  // Initialize fares from existing data
  useEffect(() => {
    const fareMap: Record<string, number> = {};
    existingFares.forEach((fare) => {
      fareMap[`${fare.from_station_id}-${fare.to_station_id}`] = fare.fare_amount;
    });
    setFares(fareMap);
  }, [existingFares]);

  const handleFareChange = (fromId: string, toId: string, value: string) => {
    const key = `${fromId}-${toId}`;
    setFares((prev) => ({
      ...prev,
      [key]: parseFloat(value) || 0,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Go through all station pairs and create/update fares
      for (let i = 0; i < stations.length; i++) {
        for (let j = i + 1; j < stations.length; j++) {
          const fromStation = stations[i];
          const toStation = stations[j];
          const key = `${fromStation.id}-${toStation.id}`;
          const fareAmount = fares[key] || 0;

          // Check if fare already exists
          const existingFare = existingFares.find(
            (f) => f.from_station_id === fromStation.id && f.to_station_id === toStation.id
          );

          if (existingFare) {
            if (existingFare.fare_amount !== fareAmount) {
              await updateFare.mutateAsync({ id: existingFare.id, fare_amount: fareAmount });
            }
          } else if (fareAmount > 0) {
            await createFare.mutateAsync({
              line_id: lineId,
              from_station_id: fromStation.id,
              to_station_id: toStation.id,
              fare_amount: fareAmount,
            });
          }
        }
      }
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Sort stations by sequence order
  const sortedStations = [...stations].sort((a, b) => a.sequence_order - b.sequence_order);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border p-2 bg-muted text-left">De ↓ / Vers →</th>
              {sortedStations.slice(1).map((station) => (
                <th key={station.id} className="border p-2 bg-muted text-center min-w-[100px]">
                  {station.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedStations.slice(0, -1).map((fromStation, rowIndex) => (
              <tr key={fromStation.id}>
                <td className="border p-2 bg-muted font-medium">{fromStation.name}</td>
                {sortedStations.slice(1).map((toStation, colIndex) => {
                  // Only show cells where destination is after origin
                  if (colIndex < rowIndex) {
                    return <td key={toStation.id} className="border p-2 bg-muted/30"></td>;
                  }

                  const key = `${fromStation.id}-${toStation.id}`;
                  return (
                    <td key={toStation.id} className="border p-2">
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        value={fares[key] || ''}
                        onChange={(e) => handleFareChange(fromStation.id, toStation.id, e.target.value)}
                        className="h-8 text-center"
                        placeholder="0"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Enregistrer les tarifs
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        💡 Les tarifs sont en MAD. Entrez le prix pour chaque trajet de station à station.
      </p>
    </div>
  );
}
