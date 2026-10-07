import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useGPSwoxVehicles } from '@/hooks/useGPSwoxVehicles';
import { Driver, useCreateDriver, useUpdateDriver } from '@/hooks/useDrivers';

interface DriverFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editDriver?: Driver | null;
  onSuccess?: () => void;
}

interface FormData {
  name: string;
  phone: string;
  license: string;
  licenseExpiry: string;
  vehicleId: string;
  status: 'available' | 'on_mission' | 'off_duty';
}

const defaultFormData: FormData = {
  name: '',
  phone: '',
  license: 'B',
  licenseExpiry: '',
  vehicleId: '',
  status: 'available',
};

export function DriverForm({ open, onOpenChange, editDriver, onSuccess }: DriverFormProps) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  
  const { data: vehicles = [], isLoading: vehiclesLoading } = useGPSwoxVehicles();
  const createDriver = useCreateDriver();
  const updateDriver = useUpdateDriver();
  const isEditing = Boolean(editDriver);

  const [formData, setFormData] = useState<FormData>(defaultFormData);

  useEffect(() => {
    if (!open) return;
    if (editDriver) {
      setFormData({
        name: editDriver.name || '',
        phone: editDriver.phone || '',
        license: editDriver.license_type || 'B',
        licenseExpiry: (editDriver.license_expiry || '').slice(0, 10),
        vehicleId: editDriver.vehicle_id || '',
        status: editDriver.status || 'available',
      });
      return;
    }
    setFormData(defaultFormData);
  }, [open, editDriver]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.phone || !formData.licenseExpiry) {
      toast({
        title: 'Erreur',
        description: 'Veuillez remplir tous les champs obligatoires',
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      name: formData.name,
      phone: formData.phone,
      license_type: formData.license,
      license_expiry: formData.licenseExpiry,
      vehicle_id: formData.vehicleId || null,
      status: formData.status,
    };

    if (editDriver) {
      updateDriver.mutate(
        {
          id: editDriver.id,
          ...payload,
        },
        {
          onSuccess: () => {
            setFormData(defaultFormData);
            onOpenChange(false);
            onSuccess?.();
          },
        }
      );
      return;
    }

    createDriver.mutate(payload, {
      onSuccess: () => {
        setFormData(defaultFormData);
        onOpenChange(false);
        onSuccess?.();
      },
    });
  };

  const isSubmitting = createDriver.isPending || updateDriver.isPending;

  const availableVehicles = vehicles;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Modifier un chauffeur' : 'Ajouter un chauffeur'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modifiez les informations du chauffeur' : 'Remplissez les informations du nouveau chauffeur'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom complet *</Label>
            <Input
              id="name"
              placeholder="Ex: Mohammed Alami"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="Ex: +212 6XX XXX XXX"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              dir="ltr"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="license">Type de permis *</Label>
              <Select
                value={formData.license}
                onValueChange={(value) => setFormData({ ...formData, license: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Permis A (Moto)</SelectItem>
                  <SelectItem value="B">Permis B (Voiture)</SelectItem>
                  <SelectItem value="C">Permis C (Poids lourd)</SelectItem>
                  <SelectItem value="D">Permis D (Transport)</SelectItem>
                  <SelectItem value="EC">Permis EC (Remorque)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="licenseExpiry">Expiration permis *</Label>
              <Input
                id="licenseExpiry"
                type="date"
                value={formData.licenseExpiry}
                onChange={(e) => setFormData({ ...formData, licenseExpiry: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicle">Véhicule assigné</Label>
            <Select
              value={formData.vehicleId || 'none'}
              onValueChange={(value) => setFormData({ ...formData, vehicleId: value === 'none' ? '' : value })}
              disabled={vehiclesLoading}
            >
              <SelectTrigger>
                {vehiclesLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Chargement...</span>
                  </div>
                ) : (
                  <SelectValue placeholder="Aucun véhicule" />
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun véhicule</SelectItem>
                {availableVehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                    {vehicle.plate} {vehicle.driverDetails?.name ? `- ${vehicle.driverDetails.name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Statut initial</Label>
            <Select
              value={formData.status}
              onValueChange={(value: 'available' | 'on_mission' | 'off_duty') => 
                setFormData({ ...formData, status: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Disponible</SelectItem>
                <SelectItem value="on_mission">En mission</SelectItem>
                <SelectItem value="off_duty">Repos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEditing
                  ? 'Mise à jour en cours...'
                  : 'Ajout en cours...'
                : isEditing
                ? 'Enregistrer les modifications'
                : 'Ajouter le chauffeur'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
