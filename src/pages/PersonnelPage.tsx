import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileText, CreditCard, Stethoscope, AlertTriangle, Users } from 'lucide-react';
import { PersonnelList } from '@/components/personnel/PersonnelList';
import { PersonnelDocumentsList } from '@/components/personnel/PersonnelDocumentsList';
import { DrivingLicensesList } from '@/components/personnel/DrivingLicensesList';
import { MedicalVisitsList } from '@/components/personnel/MedicalVisitsList';
import { InfractionsList } from '@/components/personnel/InfractionsList';

export default function PersonnelPage() {
  const { t } = useTranslation();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t('personnel.title')}</h1>
          <p className="text-muted-foreground">{t('personnel.subtitle')}</p>
        </div>

        <Tabs defaultValue="personnel_list" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 max-w-5xl">
            <TabsTrigger value="personnel_list">Employés</TabsTrigger>
            <TabsTrigger value="admin_files">{t('personnel.adminFiles')}</TabsTrigger>
            <TabsTrigger value="driving_licenses">{t('personnel.drivingLicenses')}</TabsTrigger>
            <TabsTrigger value="medical_visits">{t('personnel.medicalVisits')}</TabsTrigger>
            <TabsTrigger value="infractions">{t('personnel.infractions')}</TabsTrigger>
          </TabsList>

          <TabsContent value="personnel_list">
            <Card className="dashboard-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Liste des employés
                </CardTitle>
                <CardDescription>
                  Gestion du personnel (chauffeurs, mécaniciens, etc.)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PersonnelList />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admin_files">
            <Card className="dashboard-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {t('personnel.adminFiles')}
                </CardTitle>
                <CardDescription>
                  Gestion des dossiers administratifs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PersonnelDocumentsList />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="driving_licenses">
            <Card className="dashboard-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  {t('personnel.drivingLicenses')}
                </CardTitle>
                <CardDescription>
                  Suivi des permis de conduire
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DrivingLicensesList />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="medical_visits">
            <Card className="dashboard-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5" />
                  {t('personnel.medicalVisits')}
                </CardTitle>
                <CardDescription>
                  Suivi des visites médicales
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MedicalVisitsList />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="infractions">
            <Card className="dashboard-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  {t('personnel.infractions')}
                </CardTitle>
                <CardDescription>
                  Gestion des infractions routières
                </CardDescription>
              </CardHeader>
              <CardContent>
                <InfractionsList />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
