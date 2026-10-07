import { Building2, Phone, Mail, MapPin, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StockSupplier } from '@/types/stock';

interface SupplierCardProps {
  supplier: StockSupplier;
  onEdit?: (supplier: StockSupplier) => void;
  onOrder?: (supplier: StockSupplier) => void;
   onView?: (supplier: StockSupplier) => void;
}

export function SupplierCard({ supplier, onEdit, onOrder, onView }: SupplierCardProps) {
  return (
    <Card
      className="dashboard-panel animate-in fade-in zoom-in-95 duration-300 cursor-pointer"
      onClick={() => onView?.(supplier)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{supplier.name}</h3>
              <p className="text-sm text-muted-foreground">{supplier.contact_name || 'Sans contact'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-warning fill-warning" />
            <span className="text-sm font-medium">{supplier.rating?.toFixed(1) || 'N/A'}</span>
          </div>
        </div>

        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="w-4 h-4" />
            <span>{supplier.phone || 'Non renseigné'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="w-4 h-4" />
            <span>{supplier.email || 'Non renseigné'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span>{supplier.city || 'Non renseigné'}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mb-3">
          {supplier.categories?.map((category) => (
            <Badge key={category} variant="secondary" className="text-xs">
              {category}
            </Badge>
          )) || <span className="text-xs text-muted-foreground">Aucune catégorie</span>}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-background/50 rounded-lg p-2 text-center border border-border/50">
            <p className="text-xs text-muted-foreground">Commandes</p>
            <p className="text-lg font-bold text-foreground">{supplier.ordersCount || 0}</p>
          </div>
          <div className="bg-background/50 rounded-lg p-2 text-center border border-border/50">
            <p className="text-xs text-muted-foreground">Total dépensé</p>
            <p className="text-lg font-bold text-foreground">{((supplier.totalSpent || 0) / 1000).toFixed(1)}K</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-background/50 rounded-lg p-2 text-center border border-border/50">
            <p className="text-xs text-muted-foreground">Dette actuelle</p>
            <p className="text-lg font-bold text-foreground">
              {new Intl.NumberFormat('fr-MA').format(supplier.outstandingAmount || 0)} MAD
            </p>
          </div>
          <div className="bg-background/50 rounded-lg p-2 text-center border border-border/50">
            <p className="text-xs text-muted-foreground">Dernière facture</p>
            <p className="text-xs font-medium text-foreground">
              {supplier.lastInvoiceDate
                ? new Date(supplier.lastInvoiceDate).toLocaleDateString('fr-MA')
                : 'Aucune'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 hover:bg-primary/5"
            onClick={(e) => { e.stopPropagation(); onEdit?.(supplier); }}
          >
            Modifier
          </Button>
          <Button
            size="sm"
            className="flex-1 shadow-sm"
            onClick={(e) => { e.stopPropagation(); onOrder?.(supplier); }}
          >
            Commander
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
