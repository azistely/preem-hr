/**
 * Company Settings Page
 *
 * Allows tenant admins to view and edit company information including:
 * - General information (name, address, contact)
 * - Legal information (tax ID, social security number, etc.)
 * - Fund accounts (tax offices, social security, insurance)
 *
 * Design: Tabbed interface for organizing different categories of information.
 * Mobile-responsive with vertical stacking on small screens.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralInfoForm } from "@/features/settings/components/company-info/general-info-form";
import { LegalInfoForm } from "@/features/settings/components/company-info/legal-info-form";
import { FundsManager } from "@/features/settings/components/company-info/funds-manager";

export default function CompanySettingsPage() {
  return (
    <div className="container max-w-5xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Paramètres de l'Entreprise</h1>
        <p className="text-muted-foreground">
          Gérez les informations de votre entreprise
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general" className="min-h-[44px]">
            Général
          </TabsTrigger>
          <TabsTrigger value="legal" className="min-h-[44px]">
            Légal
          </TabsTrigger>
          <TabsTrigger value="funds" className="min-h-[44px]">
            Caisses
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralInfoForm />
        </TabsContent>

        <TabsContent value="legal">
          <LegalInfoForm />
        </TabsContent>

        <TabsContent value="funds">
          <FundsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
