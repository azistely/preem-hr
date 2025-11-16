/**
 * Benefits Management Dashboard
 *
 * Allows HR managers to:
 * - Create and manage benefit plans (health, dental, life insurance, etc.)
 * - Enroll employees in benefit plans
 * - Track enrollment history and costs
 * - Manage benefit eligibility by employee type
 */

'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BenefitPlansList } from '@/components/admin/benefits/benefit-plans-list';
import { EmployeeBenefitsTable } from '@/components/admin/benefits/employee-benefits-table';
import { Heart, Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CreateBenefitPlanWizard } from '@/components/admin/benefits/create-benefit-plan-wizard';

export default function BenefitsPage() {
  const [activeTab, setActiveTab] = useState<'plans' | 'enrollments'>('enrollments');
  const [showCreatePlanDialog, setShowCreatePlanDialog] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Avantages</h1>
          <p className="text-muted-foreground">
            Gérez les plans d'avantages sociaux et les inscriptions des employés
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'plans' | 'enrollments')}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <TabsList>
            <TabsTrigger value="plans" className="gap-2">
              <Heart className="h-4 w-4" />
              Plans d'Avantages
            </TabsTrigger>
            <TabsTrigger value="enrollments" className="gap-2">
              <Users className="h-4 w-4" />
              Inscriptions
            </TabsTrigger>
          </TabsList>

          {/* Action Button */}
          {activeTab === 'plans' && (
            <Button
              size="lg"
              className="gap-2 min-h-[56px]"
              onClick={() => setShowCreatePlanDialog(true)}
            >
              <Plus className="h-5 w-5" />
              Nouveau Plan
            </Button>
          )}
        </div>

        {/* Plans Tab */}
        <TabsContent value="plans" className="mt-6">
          <BenefitPlansList />
        </TabsContent>

        {/* Enrollments Tab - Excel-like table */}
        <TabsContent value="enrollments" className="mt-6">
          <EmployeeBenefitsTable />
        </TabsContent>
      </Tabs>

      {/* Create Plan Dialog */}
      <Dialog open={showCreatePlanDialog} onOpenChange={setShowCreatePlanDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Créer un Plan d'Avantages</DialogTitle>
            <DialogDescription>
              Définissez un nouveau plan d'avantages pour vos employés
            </DialogDescription>
          </DialogHeader>
          <CreateBenefitPlanWizard
            onSuccess={() => {
              setShowCreatePlanDialog(false);
            }}
            onCancel={() => setShowCreatePlanDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
