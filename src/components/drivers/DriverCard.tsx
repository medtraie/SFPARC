import { useState } from 'react';
import { Phone, Award, Car, MoreVertical, User, History, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface GPSwoxDriverData {
  id: string;
  name: string;
  phone: string;
  license: string;
  licenseExpiry: string;
  vehicleId?: string;
  vehiclePlate?: string;
  status: 'available' | 'on_mission' | 'off_duty';
  score: number;
  isOnline?: boolean;
}

interface DriverCardProps {
  driver: GPSwoxDriverData;
  isRTL?: boolean;
}

export function DriverCard({ driver, isRTL }: DriverCardProps) {
  const [showProfile, setShowProfile] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const statusConfig = {
    available: { label: 'Disponible', color: 'bg-success text-success-foreground' },
    on_mission: { label: 'En mission', color: 'bg-info text-info-foreground' },
    off_duty: { label: 'Hors ligne', color: 'bg-muted text-muted-foreground' },
  };

  const status = statusConfig[driver.status];

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-success';
    if (score >= 75) return 'text-warning';
    return 'text-destructive';
  };

  const getInitials = (name: string) => 
    name.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <div className="group bg-card rounded-xl border border-border p-4 hover:shadow-lg hover:border-primary/30 transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-lg font-bold text-primary">
                {getInitials(driver.name)}
              </span>
            </div>
            {/* Online indicator */}
            <div className={cn(
              'absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-card flex items-center justify-center',
              driver.isOnline ? 'bg-success' : 'bg-muted'
            )}>
              {driver.isOnline ? (
                <Wifi className="w-2 h-2 text-success-foreground" />
              ) : (
                <WifiOff className="w-2 h-2 text-muted-foreground" />
              )}
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {driver.name}
            </h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="w-3 h-3" />
              <span dir="ltr">{driver.phone || 'Non disponible'}</span>
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="bg-popover">
            <DropdownMenuItem onClick={() => setShowProfile(true)}>
              <User className="w-4 h-4 mr-2" />
              Voir le profil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowHistory(true)}>
              <History className="w-4 h-4 mr-2" />
              Historique missions
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Status Badge */}
      <div className="flex items-center justify-between mb-4">
        <Badge className={cn('font-medium', status.color)}>
          {status.label}
        </Badge>
        <div className={cn('flex items-center gap-1 font-semibold', getScoreColor(driver.score))}>
          <Award className="w-4 h-4" />
          <span>{driver.score}/100</span>
        </div>
      </div>

      {/* Vehicle Assignment */}
      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
        <Car className="w-4 h-4 text-muted-foreground" />
        <span className="text-muted-foreground text-sm">Véhicule:</span>
        {driver.vehiclePlate ? (
          <span className="font-medium text-foreground text-sm">{driver.vehiclePlate}</span>
        ) : (
          <span className="text-muted-foreground italic text-sm">Non assigné</span>
        )}
      </div>

      {/* Profile Dialog */}
      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">
                    {getInitials(driver.name)}
                  </span>
                </div>
                <div className={cn(
                  'absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-background',
                  driver.isOnline ? 'bg-success' : 'bg-muted'
                )} />
              </div>
              {driver.name}
            </DialogTitle>
            <DialogDescription>Informations du conducteur (GPSwox)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Téléphone</p>
                <p className="font-medium" dir="ltr">{driver.phone || 'Non disponible'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Statut</p>
                <Badge className={cn('font-medium mt-1', status.color)}>
                  {status.label}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Connexion</p>
                <div className="flex items-center gap-1 mt-1">
                  {driver.isOnline ? (
                    <>
                      <Wifi className="w-4 h-4 text-success" />
                      <span className="text-success font-medium">En ligne</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Hors ligne</span>
                    </>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Véhicule assigné</p>
                <p className="font-medium">{driver.vehiclePlate || 'Non assigné'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Score de conduite</p>
                <p className={cn('font-medium', getScoreColor(driver.score))}>
                  {driver.score}/100
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProfile(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Historique des missions - {driver.name}</DialogTitle>
            <DialogDescription>Liste des missions effectuées par ce conducteur</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="text-center py-8 text-muted-foreground">
              <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Aucun historique disponible</p>
              <p className="text-sm">Les missions seront affichées ici</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistory(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
