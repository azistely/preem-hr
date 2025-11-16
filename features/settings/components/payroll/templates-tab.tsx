"use client";

/**
 * Payslip Templates Tab for Payroll Settings
 *
 * Allows customization of payslip templates (logo, colors, layout, sections).
 * Extracted from standalone payslip-templates page for use within tabbed settings.
 *
 * Features:
 * - View all templates
 * - Create new templates
 * - Edit existing templates
 * - Set default template
 */

import { Suspense } from "react";
import { TemplateList } from "@/features/templates/components/template-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function TemplatesTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Modèles de Bulletin de Paie</CardTitle>
        <CardDescription>
          Personnalisez l'apparence de vos bulletins de paie avec votre logo, vos couleurs et vos sections préférées.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<TemplateListSkeleton />}>
          <TemplateList />
        </Suspense>
      </CardContent>
    </Card>
  );
}

function TemplateListSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
