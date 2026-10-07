import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Route, MapPin, LayoutDashboard, FileSpreadsheet } from 'lucide-react';
import { TrajetsList } from '@/components/transport/TrajetsList';
import { ChantiersList } from '@/components/transport/ChantiersList';
import { TransportBTPDashboard } from '@/components/transport/TransportBTPDashboard';
import { BonDeCommande } from '@/components/transport/BonDeCommande';
import { useTourismCompanyProfile } from '@/hooks/useTourismCompany';

export default function TransportBTP() {
  const { t } = useTranslation();
  const { data: companyProfile } = useTourismCompanyProfile();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('nav.transportBTP')}</h1>
          <p className="text-muted-foreground">
            Gestion du transport BTP: chantiers, trajets, voyages et facturation
          </p>
          <p className="text-sm text-muted-foreground">
            Société: {companyProfile?.company_name || 'Non renseignée'}
          </p>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Tableau de bord</span>
            </TabsTrigger>
            <TabsTrigger value="chantiers" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span className="hidden sm:inline">Zones & Chantiers</span>
            </TabsTrigger>
            <TabsTrigger value="trajets" className="flex items-center gap-2">
              <Route className="w-4 h-4" />
              <span className="hidden sm:inline">Trajets</span>
            </TabsTrigger>
            <TabsTrigger value="bon_commande" className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Bon de commande</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <TransportBTPDashboard />
          </TabsContent>

          <TabsContent value="chantiers" className="mt-6">
            <ChantiersList />
          </TabsContent>

          <TabsContent value="trajets" className="mt-6">
            <TrajetsList />
          </TabsContent>

          <TabsContent value="bon_commande" className="mt-6">
            <BonDeCommande />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
