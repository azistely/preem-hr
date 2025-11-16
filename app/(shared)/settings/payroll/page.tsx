/**
 * Payroll Settings Page
 *
 * Consolidates payroll configuration settings into a tabbed interface:
 * - Salary Components (custom and standard components)
 * - Payslip Templates (branding and layout customization)
 *
 * Design: Follows same tab pattern as Company Settings page.
 * Mobile-responsive with horizontal scrolling tabs if needed.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComponentsTab } from "@/features/settings/components/payroll/components-tab";
import { TemplatesTab } from "@/features/settings/components/payroll/templates-tab";

export default function PayrollSettingsPage() {
  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Configuration de la Paie</h1>
        <p className="text-muted-foreground">
          Gérez les composants de salaire et les modèles de bulletins
        </p>
      </div>

      <Tabs defaultValue="components" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 gap-1">
          <TabsTrigger value="components" className="min-h-[44px]">
            Composants de Salaire
          </TabsTrigger>
          <TabsTrigger value="templates" className="min-h-[44px]">
            Modèles de Bulletins
          </TabsTrigger>
        </TabsList>

        <TabsContent value="components">
          <ComponentsTab />
        </TabsContent>

        <TabsContent value="templates">
          <TemplatesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
