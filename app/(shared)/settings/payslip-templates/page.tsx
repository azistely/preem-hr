/**
 * Payslip Templates Settings Page (GAP-DOC-002)
 *
 * Allows companies to customize pay slip layout, branding, and sections
 */

import { Suspense } from 'react';
import { TemplateList } from '@/features/templates/components/template-list';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: 'Modèles de Bulletin de Paie',
  description: 'Personnalisez vos bulletins de paie (logo, couleurs, sections)',
};

export default function PayslipTemplatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Modèles de Bulletin de Paie"
        description="Personnalisez l'apparence de vos bulletins de paie avec votre logo, vos couleurs et vos sections préférées."
      />

      <Card className="p-6">
        <Suspense fallback={<TemplateListSkeleton />}>
          <TemplateList />
        </Suspense>
      </Card>
    </div>
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
