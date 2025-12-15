/**
 * Evaluation Print Preview Page
 *
 * Displays a print-friendly version of an evaluation with options:
 * - Print filled form (with existing data)
 * - Print blank form (for handwritten completion)
 * - Download PDF (future feature)
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PrintableEvaluationForm } from '@/components/performance/printable-evaluation-form';
import { ArrowLeft, Printer, FileText, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import '@/styles/print-evaluation.css';
import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function EvaluationPrintPage() {
  const params = useParams();
  const router = useRouter();
  const evaluationId = params.id as string;
  const [showBlankFields, setShowBlankFields] = useState(false);

  // Fetch evaluation
  const { data: evaluation, isLoading } = api.performance.evaluations.getById.useQuery(
    { id: evaluationId },
    { enabled: !!evaluationId }
  );

  // Build QR code URL
  const qrCodeUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/performance/evaluations/${evaluationId}`
    : undefined;

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[800px] w-full" />
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="container max-w-4xl mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Evaluation non trouvee</h3>
            <p className="text-muted-foreground mb-6">
              Cette evaluation n&apos;existe pas ou vous n&apos;avez pas les droits d&apos;acces.
            </p>
            <Button onClick={() => router.push('/performance/evaluations')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux evaluations
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Print Controls - Hidden when printing */}
      <div className="no-print sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="container max-w-4xl mx-auto py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/performance/evaluations/${evaluationId}`)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Apercu impression</span>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="blank-mode"
                  checked={showBlankFields}
                  onCheckedChange={setShowBlankFields}
                />
                <Label htmlFor="blank-mode" className="text-sm cursor-pointer">
                  Formulaire vierge
                </Label>
              </div>

              <Button onClick={handlePrint} className="min-h-[44px]">
                <Printer className="mr-2 h-4 w-4" />
                Imprimer
              </Button>
            </div>
          </div>

          {showBlankFields && (
            <p className="text-sm text-muted-foreground mt-2">
              Mode formulaire vierge : les champs sont vides pour permettre une saisie manuscrite.
            </p>
          )}
        </div>
      </div>

      {/* Print Preview */}
      <div className="container max-w-4xl mx-auto py-6">
        <div className="bg-white shadow-lg">
          <PrintableEvaluationForm
            evaluation={{
              id: evaluation.id,
              evaluationType: evaluation.evaluationType as 'self' | 'manager' | 'peer' | '360_report',
              status: evaluation.status,
              employee: evaluation.employee ? {
                firstName: evaluation.employee.firstName ?? '',
                lastName: evaluation.employee.lastName ?? '',
                employeeNumber: evaluation.employee.employeeNumber ?? null,
                jobTitle: evaluation.employee.jobTitle ?? null,
                department: null, // Not available in current query
              } : null,
              cycle: evaluation.cycle ? {
                name: evaluation.cycle.name,
                periodStart: evaluation.cycle.periodStart,
                periodEnd: evaluation.cycle.periodEnd,
              } : null,
              objectives: evaluation.objectives?.map(obj => ({
                id: obj.id,
                title: obj.title,
                description: obj.description ?? null,
                objectiveLevel: obj.objectiveLevel as 'company' | 'team' | 'individual',
                targetValue: obj.targetValue ?? null,
                targetUnit: obj.targetUnit ?? null,
                currentValue: obj.currentValue ?? null,
                weight: obj.weight ?? null,
              })) ?? null,
              objectiveScores: evaluation.objectiveScores?.map(score => ({
                objectiveId: score.objectiveId,
                score: score.score,
                comment: score.comment ?? null,
              })) ?? null,
              positionCompetencies: evaluation.positionCompetencies?.map(pc => ({
                competency: {
                  id: pc.competency.id,
                  name: pc.competency.name,
                  description: pc.competency.description ?? null,
                  category: pc.competency.category,
                },
                requiredLevel: pc.requiredLevel,
                isCritical: pc.isCritical ?? false,
              })) ?? null,
              competencyRatings: evaluation.competencyRatings?.map(rating => ({
                competencyId: rating.competencyId,
                rating: rating.rating,
                comment: rating.comment ?? null,
                expectedLevel: rating.expectedLevel ?? null,
              })) ?? null,
              overallRating: evaluation.overallRating ?? null,
              overallScore: evaluation.overallScore ?? null,
              strengthsComment: evaluation.strengthsComment ?? null,
              improvementAreasComment: evaluation.improvementAreasComment ?? null,
              developmentPlanComment: evaluation.developmentPlanComment ?? null,
              generalComment: evaluation.generalComment ?? null,
              submittedAt: evaluation.submittedAt ? evaluation.submittedAt.toISOString() : null,
              validatedAt: evaluation.validatedAt ? evaluation.validatedAt.toISOString() : null,
            }}
            qrCodeUrl={qrCodeUrl}
            showBlankFields={showBlankFields}
          />
        </div>
      </div>

      {/* Print Information - Hidden when printing */}
      <div className="no-print container max-w-4xl mx-auto pb-6">
        <Card>
          <CardContent className="py-4">
            <h3 className="font-medium mb-2">Conseils d&apos;impression</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>- Utilisez le format A4 en mode portrait</li>
              <li>- Desactivez les en-tetes et pieds de page du navigateur</li>
              <li>- Activez l&apos;impression des couleurs d&apos;arriere-plan si necessaire</li>
              <li>- Le mode &quot;Formulaire vierge&quot; permet d&apos;imprimer un formulaire a remplir a la main</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
