import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, FileText, Calculator, BarChart3, Receipt, Settings } from 'lucide-react';
import { PlanComptable } from '@/components/accounting/PlanComptable';
import { JournalComptable } from '@/components/accounting/JournalComptable';
import { GrandLivreBalance } from '@/components/accounting/GrandLivreBalance';
import { BilanCPC } from '@/components/accounting/BilanCPC';
import { TVADeclarations } from '@/components/accounting/TVADeclarations';
import { FiscalYearManager } from '@/components/accounting/FiscalYearManager';

export default function Comptabilite() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comptabilité Générale</h1>
          <p className="text-muted-foreground">Plan comptable marocain - Classes 1 à 7</p>
        </div>

        <Tabs defaultValue="plan" className="space-y-4">
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="plan" className="gap-2">
              <BookOpen className="w-4 h-4" />
              Plan Comptable
            </TabsTrigger>
            <TabsTrigger value="journal" className="gap-2">
              <FileText className="w-4 h-4" />
              Journal
            </TabsTrigger>
            <TabsTrigger value="grandlivre" className="gap-2">
              <Calculator className="w-4 h-4" />
              Grand Livre & Balance
            </TabsTrigger>
            <TabsTrigger value="bilan" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Bilan & CPC
            </TabsTrigger>
            <TabsTrigger value="tva" className="gap-2">
              <Receipt className="w-4 h-4" />
              TVA
            </TabsTrigger>
            <TabsTrigger value="exercice" className="gap-2">
              <Settings className="w-4 h-4" />
              Exercice
            </TabsTrigger>
          </TabsList>

          <TabsContent value="plan"><PlanComptable /></TabsContent>
          <TabsContent value="journal"><JournalComptable /></TabsContent>
          <TabsContent value="grandlivre"><GrandLivreBalance /></TabsContent>
          <TabsContent value="bilan"><BilanCPC /></TabsContent>
          <TabsContent value="tva"><TVADeclarations /></TabsContent>
          <TabsContent value="exercice"><FiscalYearManager /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
