import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function TrajetsList() {
  const [data, setData] = useState([
    { depart: 'CAMION1', heure: '16:59', materiel: 'beton', quantite: '20m²', bon: 'be15', destination: 'zone2', remainingSeconds: 90 * 60, finalStatus: 'terminer' },
    { depart: 'CAMION2', heure: '16:50', materiel: 'gravier', quantite: '5tonne', bon: 'gr18', destination: 'zone4', remainingSeconds: 90 * 60, finalStatus: 'terminer' },
    { depart: 'CAMION3', heure: '16:40', materiel: 'zero', quantite: '6tonne', bon: 'ze14', destination: 'zone5', remainingSeconds: 809 * 60, finalStatus: 'terminer' },
    { depart: 'CAMION4', heure: '16:30', materiel: 'souiria', quantite: '8tonne', bon: 'so45', destination: 'zone1', remainingSeconds: 145 * 60, finalStatus: 'terminer' },
    { depart: 'CAMION5', heure: '16:29', materiel: 'g1', quantite: '6tonne', bon: 'go858', destination: 'zone2', remainingSeconds: 238 * 60, finalStatus: 'terminer' },
    { depart: 'CAMION6', heure: '16:08', materiel: 'beton', quantite: '20m²', bon: 'be14', destination: 'zone10', remainingSeconds: 58 * 60, finalStatus: 'terminer' },
    { depart: 'CAMION7', heure: '14:30', materiel: 'gravier', quantite: '5tonne', bon: 'gr17', destination: 'zone22', remainingSeconds: 10, finalStatus: 'terminer' }, // Will finish in 10s
    { depart: 'CAMION8', heure: '12:56', materiel: 'zero', quantite: '6tonne', bon: 'ze13', destination: 'zone2', remainingSeconds: 52 * 60, finalStatus: 'terminer' },
    { depart: 'CAMION9', heure: '12:50', materiel: 'souiria', quantite: '8tonne', bon: 'so44', destination: 'zone4', remainingSeconds: 15, finalStatus: 'échouer' }, // Will fail in 15s
    { depart: 'CAMION10', heure: '12:30', materiel: 'g1', quantite: '6tonne', bon: 'go857', destination: 'zone5', remainingSeconds: 75 * 60, finalStatus: 'terminer' },
    { depart: 'CAMION11', heure: '12:29', materiel: 'beton', quantite: '20m²', bon: 'be13', destination: 'zone1', remainingSeconds: 90 * 60, finalStatus: 'terminer' },
    { depart: 'CAMION12', heure: '12:20', materiel: 'gravier', quantite: '5tonne', bon: 'gr16', destination: 'zone2', remainingSeconds: 0, finalStatus: 'terminer' },
    { depart: 'CAMION13', heure: '12:10', materiel: 'zero', quantite: '6tonne', bon: 'ze12', destination: 'zone10', remainingSeconds: 0, finalStatus: 'terminer' },
    { depart: 'CAMION14', heure: '11:00', materiel: 'souiria', quantite: '8tonne', bon: 'so43', destination: 'zone22', remainingSeconds: 0, finalStatus: 'échouer' },
  ]);

  useEffect(() => {
    // Ticks down every second
    const interval = setInterval(() => {
      setData(prev => prev.map(item => {
        if (item.remainingSeconds > 0) {
          // Decrement time. Occasionally make a random jump to simulate network updates
          const drop = Math.random() > 0.8 ? Math.floor(Math.random() * 5) + 1 : 1;
          return { ...item, remainingSeconds: Math.max(0, item.remainingSeconds - drop) };
        }
        return item;
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatRemainingTime = (seconds: number, finalStatus: string) => {
    if (seconds <= 0) return finalStatus;
    
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    if (h > 0) {
      return `${h}h ${m.toString().padStart(2, '0')}min ${s.toString().padStart(2, '0')}s`;
    }
    if (m > 0) {
      return `${m}min ${s.toString().padStart(2, '0')}s`;
    }
    return `${s}s`;
  };

  const getStatusStyle = (status: string) => {
    if (status.toLowerCase() === 'terminer') {
      return 'bg-emerald-600 text-white font-medium animate-pulse shadow-sm shadow-emerald-600/50';
    }
    if (status.toLowerCase() === 'échouer') {
      return 'bg-destructive text-white font-medium animate-pulse shadow-sm shadow-destructive/50';
    }
    return 'text-foreground font-medium';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Trajets</h2>
          <p className="text-sm text-muted-foreground">
            Suivi des camions en temps réel
          </p>
        </div>
      </div>

      <Card className="dashboard-panel overflow-hidden border-0 shadow-lg rounded-xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="w-full border-collapse">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/50">
                  <TableHead className="font-bold text-muted-foreground h-12 uppercase text-xs tracking-wider">DEPART</TableHead>
                  <TableHead className="font-bold text-muted-foreground h-12 uppercase text-xs tracking-wider">HEURE</TableHead>
                  <TableHead className="font-bold text-muted-foreground h-12 uppercase text-xs tracking-wider">Matériel</TableHead>
                  <TableHead className="font-bold text-muted-foreground h-12 uppercase text-xs tracking-wider">quantité</TableHead>
                  <TableHead className="font-bold text-muted-foreground h-12 uppercase text-xs tracking-wider">numero de bon</TableHead>
                  <TableHead className="font-bold text-muted-foreground h-12 uppercase text-xs tracking-wider text-center">TEMPS QUI RESTE</TableHead>
                  <TableHead className="font-bold text-muted-foreground h-12 uppercase text-xs tracking-wider">DESTINATION</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, idx) => {
                  const tempsRestant = formatRemainingTime(row.remainingSeconds, row.finalStatus);
                  return (
                    <TableRow key={idx} className="bg-background hover:bg-muted/30 border-b border-border/30 transition-all duration-200">
                      <TableCell className="py-3 text-foreground font-medium">{row.depart}</TableCell>
                      <TableCell className="py-3 text-foreground">{row.heure}</TableCell>
                      <TableCell className="py-3 text-foreground capitalize">{row.materiel}</TableCell>
                      <TableCell className="py-3 text-foreground">{row.quantite}</TableCell>
                      <TableCell className="py-3 text-foreground font-mono text-sm">{row.bon}</TableCell>
                      <TableCell className="py-3 text-center align-middle">
                        <div className={`inline-flex items-center justify-center px-4 py-1.5 rounded-full text-sm min-w-[100px] ${getStatusStyle(tempsRestant)}`}>
                          {tempsRestant}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-foreground">{row.destination}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
