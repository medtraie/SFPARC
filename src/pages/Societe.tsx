import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TourismCompanyForm } from '@/components/tourism/TourismCompanyForm';

export default function Societe() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Société</h1>
          <p className="text-muted-foreground">
            Informations globales de l&apos;entreprise utilisées dans les modules et documents
          </p>
        </div>

        <Card className="max-w-4xl">
          <CardHeader>
            <CardTitle>Profil de la société</CardTitle>
            <CardDescription>
              Ces informations sont partagées avec Missions, Transport BTP, Transport Voyageurs, Transport TMS et les factures PDF.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TourismCompanyForm />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
