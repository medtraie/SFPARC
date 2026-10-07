import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClientsList } from '@/components/tms/ClientsList';
import { TarifsList } from '@/components/tms/TarifsList';
import { DevisList } from '@/components/tms/DevisList';
import { OrdersList } from '@/components/tms/OrdersList';
import { InvoicesList } from '@/components/tms/InvoicesList';
import { useTourismCompanyProfile } from '@/hooks/useTourismCompany';

export default function TransportTMS() {
  const { data: companyProfile } = useTourismCompanyProfile();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Transport - TMS</h1>
          <p className="text-muted-foreground">Gestion du transport de marchandises</p>
          <p className="text-sm text-muted-foreground">
            Société: {companyProfile?.company_name || 'Non renseignée'}
          </p>
        </div>

        <Tabs defaultValue="orders" className="space-y-4">
          <TabsList className="grid grid-cols-5 w-full max-w-3xl">
            <TabsTrigger value="clients">Clients</TabsTrigger>
            <TabsTrigger value="tarifs">Tarification</TabsTrigger>
            <TabsTrigger value="devis">Devis</TabsTrigger>
            <TabsTrigger value="orders">Ordres</TabsTrigger>
            <TabsTrigger value="invoices">Facturation</TabsTrigger>
          </TabsList>

          <TabsContent value="clients"><ClientsList /></TabsContent>
          <TabsContent value="tarifs"><TarifsList /></TabsContent>
          <TabsContent value="devis"><DevisList /></TabsContent>
          <TabsContent value="orders"><OrdersList /></TabsContent>
          <TabsContent value="invoices"><InvoicesList /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
