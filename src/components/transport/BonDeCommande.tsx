import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';

export function BonDeCommande() {
  const [data, setData] = useState([
    { materiel: 'Gravier', nbrBonCommander: 5, nbrPageReste: 30, bonPerdu: 0 },
    { materiel: 'Sable', nbrBonCommander: 6, nbrPageReste: 45, bonPerdu: 0 },
    { materiel: 'Zero', nbrBonCommander: 4, nbrPageReste: 45, bonPerdu: 0 },
    { materiel: 'beton', nbrBonCommander: 6, nbrPageReste: 50, bonPerdu: 5 },
  ]);

  const [perduData, setPerduData] = useState<Record<string, string[]>>({
    gravier: ['bon perdu G1'],
    sable: ['bon perdu S1', 'bon perdu S2'],
    zero: ['bon perdu Z1'],
    beton: ['bon perdu 13', 'bon perdu 9', 'bon perdu 24', 'bon perdu 4', 'bon perdu 5'],
  });

  // States for Modals
  const [isMatierOpen, setIsMatierOpen] = useState(false);
  const [newMatierName, setNewMatierName] = useState('');
  const [newMatierUnit, setNewMatierUnit] = useState('');

  const [isBonOpen, setIsBonOpen] = useState(false);
  const [selectedBonMatier, setSelectedBonMatier] = useState('');
  const [newBonPages, setNewBonPages] = useState('100');

  const [isPerduOpen, setIsPerduOpen] = useState(false);
  const [selectedPerduMatier, setSelectedPerduMatier] = useState('');
  const [newPerduNum, setNewPerduNum] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev => prev.map(item => {
        // Randomly decrement pages remaining
        if (Math.random() > 0.7 && item.nbrPageReste > 0) {
          return { ...item, nbrPageReste: item.nbrPageReste - 1 };
        }
        return item;
      }));
    }, 10000); // update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const handleCreateMatier = () => {
    if (newMatierName.trim()) {
      setData(prev => [...prev, {
        materiel: newMatierName.trim(),
        nbrBonCommander: 0,
        nbrPageReste: 0,
        bonPerdu: 0
      }]);
      setNewMatierName('');
      setNewMatierUnit('');
      setIsMatierOpen(false);
    }
  };

  const handleCreateBon = () => {
    if (selectedBonMatier && newBonPages) {
      setData(prev => prev.map(item => {
        if (item.materiel.toLowerCase() === selectedBonMatier.toLowerCase()) {
          return {
            ...item,
            nbrBonCommander: item.nbrBonCommander + 1,
            nbrPageReste: item.nbrPageReste + parseInt(newBonPages)
          };
        }
        return item;
      }));
      setNewBonPages('100');
      setSelectedBonMatier('');
      setIsBonOpen(false);
    }
  };

  const handleAddPerdu = () => {
    if (selectedPerduMatier && newPerduNum.trim()) {
      setPerduData(prev => ({
        ...prev,
        [selectedPerduMatier]: [...(prev[selectedPerduMatier] || []), newPerduNum.trim()]
      }));
      
      // Update the main table bonPerdu count
      setData(prev => prev.map(item => {
        if (item.materiel.toLowerCase() === selectedPerduMatier) {
          return { ...item, bonPerdu: item.bonPerdu + 1 };
        }
        return item;
      }));

      setNewPerduNum('');
      setSelectedPerduMatier('');
      setIsPerduOpen(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-8">
        {/* Action Buttons */}
        <div className="flex flex-col gap-4 min-w-[150px]">
          <Dialog open={isMatierOpen} onOpenChange={setIsMatierOpen}>
            <DialogTrigger asChild>
              <Button className="bg-destructive hover:bg-destructive/90 text-white w-full justify-start gap-2 shadow-sm">
                <Plus className="w-4 h-4" />
                Créer Matier
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Créer Matier</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <span className="text-sm font-medium">Matier</span>
                  <Input 
                    id="name" 
                    placeholder="nom de la matier" 
                    className="col-span-3" 
                    value={newMatierName}
                    onChange={(e) => setNewMatierName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <span className="text-sm font-medium">Unité de mesure</span>
                  <Select value={newMatierUnit} onValueChange={setNewMatierUnit}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="TONNE..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tonne">TONNE</SelectItem>
                      <SelectItem value="m2">m²</SelectItem>
                      <SelectItem value="m3">m³</SelectItem>
                      <SelectItem value="kg">KG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsMatierOpen(false)}>Annuler</Button>
                <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateMatier}>Enregistrer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isBonOpen} onOpenChange={setIsBonOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white w-full justify-start gap-2 shadow-sm">
                <Plus className="w-4 h-4" />
                Créer Bon
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Créer Bon</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <span className="text-sm font-medium">CHOISIR MATIER</span>
                  <Select value={selectedBonMatier} onValueChange={setSelectedBonMatier}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.map((item, idx) => (
                        <SelectItem key={idx} value={item.materiel.toLowerCase()}>{item.materiel}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <span className="text-sm font-medium">NBR DE PAGE</span>
                  <Input 
                    id="pages" 
                    type="number" 
                    value={newBonPages}
                    onChange={(e) => setNewBonPages(e.target.value)}
                    className="col-span-3" 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsBonOpen(false)}>Annuler</Button>
                <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateBon}>Enregistrer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isPerduOpen} onOpenChange={setIsPerduOpen}>
            <DialogTrigger asChild>
              <Button className="bg-orange-500 hover:bg-orange-600 text-white w-full justify-start gap-2 shadow-sm mt-4">
                <Plus className="w-4 h-4" />
                Ajouter un bon perdu
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Ajouter un bon perdu</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <span className="text-sm font-medium">MATIER</span>
                  <Select value={selectedPerduMatier} onValueChange={setSelectedPerduMatier}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.map((item, idx) => (
                        <SelectItem key={idx} value={item.materiel.toLowerCase()}>{item.materiel}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <span className="text-sm font-medium">NUMERO</span>
                  <Input 
                    placeholder="bon perdu 1" 
                    value={newPerduNum}
                    onChange={(e) => setNewPerduNum(e.target.value)}
                    className="col-span-3" 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsPerduOpen(false)}>Annuler</Button>
                <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleAddPerdu}>Enregistrer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Main Table */}
        <div className="flex-1">
          <Card className="dashboard-panel overflow-hidden border-0 shadow-lg rounded-xl">
            <CardContent className="p-0">
              <Table className="w-full border-collapse">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/50">
                    <TableHead className="font-bold text-muted-foreground h-12 text-sm tracking-wider">Matier</TableHead>
                    <TableHead className="font-bold text-muted-foreground h-12 text-sm tracking-wider text-center">NBR DE BON COMMANDER</TableHead>
                    <TableHead className="font-bold text-muted-foreground h-12 text-sm tracking-wider text-center">NBR DE PAGE QUI RESTE</TableHead>
                    <TableHead className="font-bold text-muted-foreground h-12 text-sm tracking-wider text-center">BON PERDU</TableHead>
                    <TableHead className="font-bold text-muted-foreground h-12 text-sm tracking-wider text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row, idx) => (
                    <TableRow key={idx} className="bg-background hover:bg-muted/30 border-b border-border/30 transition-all duration-200">
                      <TableCell className="py-3 text-foreground font-medium bg-emerald-50/30 dark:bg-emerald-950/10 border-r border-border/20">{row.materiel}</TableCell>
                      <TableCell className="py-3 text-foreground text-center font-semibold">{row.nbrBonCommander}</TableCell>
                      <TableCell className="py-3 text-foreground text-center font-semibold">{row.nbrPageReste}</TableCell>
                      <TableCell className="py-3 text-foreground text-center font-semibold">{row.bonPerdu}</TableCell>
                      <TableCell className="py-3 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 text-xs font-semibold uppercase text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => {
                            setSelectedBonMatier(row.materiel.toLowerCase());
                            setIsBonOpen(true);
                          }}
                        >
                          Créer un bon
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bon Perdu List Section */}
      <div className="w-full max-w-2xl mt-8">
        <Card className="dashboard-panel overflow-hidden border-0 shadow-lg rounded-xl">
          <CardContent className="p-0">
            <Table className="w-full border-collapse">
              <TableHeader>
                <TableRow className="bg-emerald-50/50 dark:bg-emerald-900/20 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 border-b border-border/50">
                  <TableHead className="font-bold text-muted-foreground h-10 text-xs">Gravier</TableHead>
                  <TableHead className="font-bold text-muted-foreground h-10 text-xs">Sable</TableHead>
                  <TableHead className="font-bold text-muted-foreground h-10 text-xs">zero</TableHead>
                  <TableHead className="font-bold text-muted-foreground h-10 text-xs">beton</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-background hover:bg-background border-0">
                  <TableCell className="py-2 text-foreground align-top p-0 border-r border-border/20">
                    <div className="flex flex-col">
                      {(perduData['gravier'] || []).map((perdu, i) => (
                        <div key={i} className="px-4 py-2 border-b border-border/20 last:border-0 text-sm">
                          {perdu}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-foreground align-top p-0 border-r border-border/20">
                    <div className="flex flex-col">
                      {(perduData['sable'] || []).map((perdu, i) => (
                        <div key={i} className="px-4 py-2 border-b border-border/20 last:border-0 text-sm">
                          {perdu}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-foreground align-top p-0 border-r border-border/20">
                    <div className="flex flex-col">
                      {(perduData['zero'] || []).map((perdu, i) => (
                        <div key={i} className="px-4 py-2 border-b border-border/20 last:border-0 text-sm">
                          {perdu}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-foreground align-top p-0">
                    <div className="flex flex-col">
                      {(perduData['beton'] || []).map((perdu, i) => (
                        <div key={i} className="px-4 py-2 border-b border-border/20 last:border-0 text-sm">
                          {perdu}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}