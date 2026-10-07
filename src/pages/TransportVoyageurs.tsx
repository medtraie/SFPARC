import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Route, Calendar, Ticket, Luggage, BarChart3 } from 'lucide-react';

import { LinesList } from '@/components/passenger/LinesList';
import { TripsList } from '@/components/passenger/TripsList';
import { TicketsList } from '@/components/passenger/TicketsList';
import { BaggageList } from '@/components/passenger/BaggageList';
import { PassengerReports } from '@/components/passenger/PassengerReports';
import { useTourismCompanyProfile } from '@/hooks/useTourismCompany';

export default function TransportVoyageurs() {
  const [activeTab, setActiveTab] = useState('trips');
  const { data: companyProfile } = useTourismCompanyProfile();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transport de Voyageurs</h1>
          <p className="text-muted-foreground">
            Gestion des lignes, voyages, billetterie et bagages
          </p>
          <p className="text-sm text-muted-foreground">
            Société: {companyProfile?.company_name || 'Non renseignée'}
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="trips" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Voyages</span>
            </TabsTrigger>
            <TabsTrigger value="lines" className="flex items-center gap-2">
              <Route className="w-4 h-4" />
              <span className="hidden sm:inline">Lignes & Tarifs</span>
            </TabsTrigger>
            <TabsTrigger value="tickets" className="flex items-center gap-2">
              <Ticket className="w-4 h-4" />
              <span className="hidden sm:inline">Billetterie</span>
            </TabsTrigger>
            <TabsTrigger value="baggage" className="flex items-center gap-2">
              <Luggage className="w-4 h-4" />
              <span className="hidden sm:inline">Bagages</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Rapports</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trips" className="mt-6">
            <TripsList />
          </TabsContent>

          <TabsContent value="lines" className="mt-6">
            <LinesList />
          </TabsContent>

          <TabsContent value="tickets" className="mt-6">
            <TicketsList />
          </TabsContent>

          <TabsContent value="baggage" className="mt-6">
            <BaggageList />
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <PassengerReports />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
