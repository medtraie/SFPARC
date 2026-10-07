import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wallet, DollarSign, CreditCard, BookOpen, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

import { CashRegistersList } from '@/components/finance/CashRegistersList';
import { CashTransactionsList } from '@/components/finance/CashTransactionsList';
import { PaymentsList } from '@/components/finance/PaymentsList';
import { ExpensesList } from '@/components/finance/ExpensesList';
import { RevenuesList } from '@/components/finance/RevenuesList';

export default function FinancePage() {
  const { t } = useTranslation();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t('finance.title')}</h1>
          <p className="text-muted-foreground">{t('finance.subtitle')}</p>
        </div>

        <Tabs defaultValue="cash_registers" className="space-y-4">
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="cash_registers" className="gap-2">
              <Wallet className="h-4 w-4" />
              {t('finance.cashRegisters')}
            </TabsTrigger>
            <TabsTrigger value="cash_balance" className="gap-2">
              <DollarSign className="h-4 w-4" />
              {t('finance.cashBalance')}
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <CreditCard className="h-4 w-4" />
              {t('finance.payments')}
            </TabsTrigger>
            <TabsTrigger value="expenses" className="gap-2">
              <ArrowUpRight className="h-4 w-4" />
              {t('finance.expenses')}
            </TabsTrigger>
            <TabsTrigger value="revenues" className="gap-2">
              <ArrowDownLeft className="h-4 w-4" />
              {t('finance.revenues')}
            </TabsTrigger>
            <TabsTrigger value="bank_journal" className="gap-2">
              <BookOpen className="h-4 w-4" />
              {t('finance.bankJournal')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cash_registers">
            <CashRegistersList />
          </TabsContent>

          <TabsContent value="cash_balance">
            <CashTransactionsList />
          </TabsContent>

          <TabsContent value="payments">
            <PaymentsList />
          </TabsContent>

          <TabsContent value="expenses">
            <ExpensesList />
          </TabsContent>

          <TabsContent value="revenues">
            <RevenuesList />
          </TabsContent>
          
          <TabsContent value="bank_journal">
            <Card className="dashboard-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  {t('finance.bankJournal')}
                </CardTitle>
                <CardDescription>
                  Suivi des chéquiers et opérations bancaires
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  Module en cours de développement
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
