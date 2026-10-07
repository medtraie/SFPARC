import { useState } from 'react';
import { useCashRegisters } from '@/hooks/useFinance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Wallet, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CashRegisterForm } from './CashRegisterForm';

export function CashRegistersList() {
  const { data: registers = [], isLoading } = useCashRegisters();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = registers.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card className="dashboard-panel">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Liste des Caisses</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une caisse..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle Caisse
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter une nouvelle caisse</DialogTitle>
              </DialogHeader>
              <CashRegisterForm onSuccess={() => setIsAddOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Solde Initial</TableHead>
              <TableHead className="text-right">Solde Actuel</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">Chargement...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Aucune caisse trouvée. Veuillez en créer une.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((reg) => (
                <TableRow key={reg.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    {reg.name}
                  </TableCell>
                  <TableCell>{reg.description || '-'}</TableCell>
                  <TableCell className="text-right">{reg.initial_balance.toLocaleString()} {reg.currency}</TableCell>
                  <TableCell className="text-right font-bold text-primary">
                    {reg.current_balance.toLocaleString()} {reg.currency}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${reg.is_active ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`}>
                      {reg.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
