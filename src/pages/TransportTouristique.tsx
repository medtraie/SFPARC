import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Calendar, Users, FileText, DollarSign, Map, Building2 } from 'lucide-react';

import { ClientForm } from '@/components/tourism/ClientForm';
import { ClientsList } from '@/components/tourism/ClientsList';
import { MissionForm } from '@/components/tourism/MissionForm';
import { MissionsList } from '@/components/tourism/MissionsList';
import { DispatchingCalendar } from '@/components/tourism/DispatchingCalendar';
import { RouteSheet } from '@/components/tourism/RouteSheet';
import { InvoiceForm } from '@/components/tourism/InvoiceForm';
import { InvoicesList } from '@/components/tourism/InvoicesList';
import { TourismCompanyForm } from '@/components/tourism/TourismCompanyForm';

export default function TransportTouristique() {
  const [activeTab, setActiveTab] = useState('planning');
  const [showMissionForm, setShowMissionForm] = useState(false);
  const [showClientForm, setShowClientForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Transport Touristique</h1>
            <p className="text-muted-foreground">
              Gestion des missions touristiques, dispatching et facturation
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showClientForm} onOpenChange={setShowClientForm}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Nouveau client
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Nouveau client</DialogTitle>
                </DialogHeader>
                <ClientForm onSuccess={() => setShowClientForm(false)} />
              </DialogContent>
            </Dialog>

            <Dialog open={showMissionForm} onOpenChange={setShowMissionForm}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Nouvelle mission
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nouvelle mission touristique</DialogTitle>
                </DialogHeader>
                <MissionForm onSuccess={() => setShowMissionForm(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="planning" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Planification</span>
            </TabsTrigger>
            <TabsTrigger value="dispatching" className="flex items-center gap-2">
              <Map className="w-4 h-4" />
              <span className="hidden sm:inline">Dispatching</span>
            </TabsTrigger>
            <TabsTrigger value="routes" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Feuilles de route</span>
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">Facturation</span>
            </TabsTrigger>
            <TabsTrigger value="clients" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Clients</span>
            </TabsTrigger>
            <TabsTrigger value="company" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">Société</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="planning" className="mt-6">
            <MissionsList />
          </TabsContent>

          <TabsContent value="dispatching" className="mt-6">
            <DispatchingCalendar />
          </TabsContent>

          <TabsContent value="routes" className="mt-6">
            <RouteSheet />
          </TabsContent>

          <TabsContent value="invoices" className="mt-6">
            <div className="space-y-6">
              <div className="flex justify-end">
                <Dialog open={showInvoiceForm} onOpenChange={setShowInvoiceForm}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      Nouvelle facture
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Nouvelle facture</DialogTitle>
                    </DialogHeader>
                    <InvoiceForm onSuccess={() => setShowInvoiceForm(false)} />
                  </DialogContent>
                </Dialog>
              </div>
              <InvoicesList />
            </div>
          </TabsContent>

          <TabsContent value="clients" className="mt-6">
            <ClientsList />
          </TabsContent>

          <TabsContent value="company" className="mt-6">
            <div className="max-w-3xl space-y-4">
              <h2 className="text-lg font-semibold">Profil de la société (Transport Touristique)</h2>
              <p className="text-sm text-muted-foreground">
                Ces informations seront utilisées dans l&apos;ordre de mission (PDF) : entête, coordonnées, mentions
                légales et logo.
              </p>
              <TourismCompanyForm />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
