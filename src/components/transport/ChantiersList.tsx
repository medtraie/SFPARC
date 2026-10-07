import { useMemo, useState, useEffect } from 'react';
import { useChantiers, useDeleteChantier, useSyncGeofencesToChantiers, useVoyages, useTrajets, useCreateTrajet } from '@/hooks/useTransportBTP';
import { useGPSwoxGeofences } from '@/hooks/useGPSwoxGeofences';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, MapPin, Phone, User, Trash2, Loader2, Target, RefreshCw, Link2, Sparkles } from 'lucide-react';
import { ChantierForm } from './ChantierForm';
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

export function ChantiersList() {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [createdSuggestionKeys, setCreatedSuggestionKeys] = useState<Set<string>>(new Set());
  const { data: chantiers = [], isLoading: chantiersLoading } = useChantiers();
  const { data: trajets = [] } = useTrajets();
  const { data: voyages = [] } = useVoyages();
  const { data: geofences = [], isLoading: geofencesLoading, refetch: refetchGeofences } = useGPSwoxGeofences();
  const deleteChantier = useDeleteChantier();
  const syncGeofences = useSyncGeofencesToChantiers();
  const createTrajet = useCreateTrajet();

  const [dummyZones, setDummyZones] = useState(() => 
    Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      name: i % 2 === 0 ? 'ZONE A' : 'ZONE B',
      camions: [
        { name: 'camion1', count: Math.floor(Math.random() * 5) + 5 },
        { name: 'camion2', count: Math.floor(Math.random() * 5) + 3 },
        { name: 'camion3', count: Math.floor(Math.random() * 5) + 2 },
        { name: 'camion4', count: Math.floor(Math.random() * 5) + 1 },
      ],
      totalVehicles: Math.floor(Math.random() * 10) + 10
    }))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setDummyZones(prev => prev.map(zone => {
        const newCamions = zone.camions.map(c => ({ ...c, count: Math.floor(Math.random() * 10) + 1 }));
        const newTotal = newCamions.reduce((acc, curr) => acc + curr.count, 0) - Math.floor(Math.random() * 5);
        return {
          ...zone,
          camions: newCamions,
          totalVehicles: newTotal > 0 ? newTotal : 10
        };
      }));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const isLoading = chantiersLoading || geofencesLoading;
  const chantierById = useMemo(() => new Map(chantiers.map((c) => [c.id, c])), [chantiers]);
  const trajetPairSet = useMemo(() => new Set(trajets
    .filter((t) => t.origin_chantier_id && t.destination_chantier_id)
    .map((t) => `${t.origin_chantier_id}|${t.destination_chantier_id}`)), [trajets]);

  const suggestions = useMemo(() => {
    const pairCounts = new Map<string, number>();

    voyages.forEach((voyage) => {
      const originId = voyage.trajet?.origin_chantier_id;
      const destinationId = voyage.trajet?.destination_chantier_id;
      if (!originId || !destinationId) return;
      const key = `${originId}|${destinationId}`;
      pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
    });

    return Array.from(pairCounts.entries())
      .map(([pairKey, usageCount]) => {
        const [originId, destinationId] = pairKey.split('|');
        const origin = chantierById.get(originId);
        const destination = chantierById.get(destinationId);
        if (!origin || !destination) return null;
        return { pairKey, originId, destinationId, originName: origin.name, destinationName: destination.name, usageCount };
      })
      .filter((item): item is NonNullable<typeof item> => !!item)
      .filter((item) => !trajetPairSet.has(item.pairKey))
      .filter((item) => !createdSuggestionKeys.has(item.pairKey))
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 8);
  }, [voyages, chantierById, trajetPairSet, createdSuggestionKeys]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const geofenceNames = new Set(geofences.map(g => g.name.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Zones & Chantiers</h2>
          <p className="text-sm text-muted-foreground">
            {chantiers.length} site(s) local(aux) • {geofences.length} zone(s) GPSwox
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => syncGeofences.mutate(geofences)}
            disabled={syncGeofences.isPending || geofencesLoading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncGeofences.isPending ? 'animate-spin' : ''}`} />
            Importer zones GPSwox
          </Button>
          <Button variant="ghost" onClick={() => refetchGeofences()} disabled={geofencesLoading}>
            Actualiser
          </Button>
          <Button
            variant="secondary"
            className="gap-2"
            disabled={syncGeofences.isPending || geofencesLoading}
            onClick={async () => {
              await syncGeofences.mutateAsync(geofences);
              setShowSuggestions(true);
            }}
          >
            <Link2 className="w-4 h-4" />
            Sync + Link trajets suggestions
          </Button>
          <ChantierForm />
        </div>
      </div>

      {showSuggestions && (
        <Card className="dashboard-panel border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Suggestions de trajets basées sur les zones les plus utilisées
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune suggestion pour le moment. Les trajets existants couvrent déjà les zones les plus utilisées.</p>
            ) : (
              suggestions.map((item) => (
                <div key={item.pairKey} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="font-medium">{item.originName} → {item.destinationName}</p>
                    <p className="text-xs text-muted-foreground">{item.usageCount} voyage(s) détecté(s)</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => createTrajet.mutate({
                      name: `${item.originName} → ${item.destinationName}`,
                      origin_chantier_id: item.originId,
                      destination_chantier_id: item.destinationId,
                      distance_km: null,
                      estimated_duration_minutes: null,
                      price_per_ton: 0,
                      price_per_trip: 0,
                      status: 'active',
                      notes: 'suggested:gpswox',
                    }, {
                      onSuccess: () => {
                        setCreatedSuggestionKeys((prev) => new Set([...prev, item.pairKey]));
                      },
                    })}
                    disabled={createTrajet.isPending}
                  >
                    Créer trajet
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {dummyZones.map((zone) => (
          <Card key={zone.id} className="overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-muted/30 px-4 py-2 border-b border-border/50 flex items-center justify-between">
              <span className="font-bold text-foreground">{zone.name}</span>
              <span className="text-xs text-muted-foreground">ce mois</span>
              <span className="text-xs font-medium text-emerald-600 bg-emerald-100/50 dark:bg-emerald-900/30 px-2 py-0.5 rounded">actif</span>
            </div>
            <CardContent className="p-4 bg-background">
              <div className="text-center mb-4">
                <p className="text-xs text-muted-foreground mb-1">cette semaine</p>
              </div>
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  {zone.camions.map((camion, idx) => (
                    <div key={idx} className="text-xs font-medium text-muted-foreground">
                      {camion.name}:{camion.count}
                    </div>
                  ))}
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xs text-muted-foreground mb-1">aujourd'hui</span>
                  <span className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">NBR DE Véhicules</span>
                  <div className="bg-primary/10 text-primary text-xl font-bold px-6 py-2 rounded-md shadow-sm">
                    {zone.totalVehicles}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
