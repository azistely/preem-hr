'use client';

import { useState } from 'react';
import {
  PendingApprovalsDashboard,
  ActiveAdvancesList,
  AdvancesHistory,
  CreateAdvanceModal,
} from '@/features/salary-advances/components/hr';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, History, TrendingUp, Plus } from 'lucide-react';

export default function AdminSalaryAdvancesPage() {
  const [createModalOpen, setCreateModalOpen] = useState(false);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Avances sur Salaire</h1>
          <p className="text-muted-foreground">
            Gérer les demandes d'avances sur salaire des employés
          </p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)} size="lg" className="min-h-[48px]">
          <Plus className="mr-2 h-5 w-5" />
          Créer une avance
        </Button>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            En attente
          </TabsTrigger>
          <TabsTrigger value="active" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Actives
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Historique
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <PendingApprovalsDashboard />
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          <ActiveAdvancesList />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <AdvancesHistory />
        </TabsContent>
      </Tabs>

      {/* Create Advance Modal */}
      <CreateAdvanceModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={() => {
          // Modal will close automatically
        }}
      />
    </div>
  );
}
