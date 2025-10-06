/**
 * Salary Review Decision Modal
 *
 * Modal for approving or rejecting salary review requests
 * Following HCI principles:
 * - Clear context (show full employee/salary details)
 * - Error prevention (require confirmation, notes for rejection)
 * - Visual feedback (color-coded actions)
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, X, Loader2, AlertTriangle } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { SalaryComparisonCard } from './salary-comparison-card';
import { api } from '@/lib/trpc/client';
import { toast } from 'sonner';

const reviewDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reviewNotes: z.string().optional(),
});

type ReviewDecisionFormData = z.infer<typeof reviewDecisionSchema>;

interface SalaryReviewModalProps {
  review: {
    id: string;
    employeeId: string;
    employeeName: string;
    currentSalary: number;
    proposedSalary: number;
    effectiveFrom: string;
    reason: string;
    justification?: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SalaryReviewModal({
  review,
  isOpen,
  onClose,
  onSuccess,
}: SalaryReviewModalProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<'approved' | 'rejected' | null>(
    null
  );

  const form = useForm<ReviewDecisionFormData>({
    resolver: zodResolver(reviewDecisionSchema),
    defaultValues: {
      decision: 'approved',
      reviewNotes: '',
    },
  });

  const reviewMutation = api.salaryReviews.review.useMutation({
    onSuccess: () => {
      toast.success(
        pendingDecision === 'approved'
          ? 'Révision salariale approuvée'
          : 'Révision salariale rejetée'
      );
      onClose();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleDecision = (decision: 'approved' | 'rejected') => {
    setPendingDecision(decision);
    form.setValue('decision', decision);

    // For rejection, require notes - show confirmation
    if (decision === 'rejected') {
      setShowConfirmation(true);
    } else {
      // For approval, show confirmation directly
      setShowConfirmation(true);
    }
  };

  const onSubmit = (data: ReviewDecisionFormData) => {
    if (!review) return;

    // Validate rejection notes
    if (data.decision === 'rejected' && !data.reviewNotes?.trim()) {
      form.setError('reviewNotes', {
        message: 'Les notes sont requises pour un rejet',
      });
      return;
    }

    reviewMutation.mutate({
      reviewId: review.id,
      decision: data.decision,
      reviewNotes: data.reviewNotes,
    });
  };

  if (!review) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Révision salariale</DialogTitle>
          <DialogDescription>
            {review.employeeName} • Date d'effet:{' '}
            {new Date(review.effectiveFrom).toLocaleDateString('fr-FR')}
          </DialogDescription>
        </DialogHeader>

        {!showConfirmation ? (
          /* Decision Form */
          <div className="space-y-6 py-4">
            {/* Salary Comparison */}
            <SalaryComparisonCard
              oldSalary={review.currentSalary}
              newSalary={review.proposedSalary}
            />

            {/* Details */}
            <div className="space-y-3">
              <div>
                <Label className="text-sm text-muted-foreground">Raison</Label>
                <p className="font-medium">{review.reason}</p>
              </div>

              {review.justification && (
                <div>
                  <Label className="text-sm text-muted-foreground">
                    Justification
                  </Label>
                  <p className="text-sm bg-muted/50 p-3 rounded-md">
                    {review.justification}
                  </p>
                </div>
              )}
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Decision Buttons */}
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="destructive"
                    className="flex-1 min-h-[56px] text-lg"
                    onClick={() => handleDecision('rejected')}
                  >
                    <X className="mr-2 h-5 w-5" />
                    Rejeter
                  </Button>

                  <Button
                    type="button"
                    className="flex-1 min-h-[56px] text-lg bg-green-600 hover:bg-green-700"
                    onClick={() => handleDecision('approved')}
                  >
                    <Check className="mr-2 h-5 w-5" />
                    Approuver
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        ) : (
          /* Confirmation Step */
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
              <div
                className={`p-4 rounded-lg border-2 ${
                  pendingDecision === 'approved'
                    ? 'bg-green-50 border-green-500'
                    : 'bg-red-50 border-red-500'
                }`}
              >
                <div className="flex items-start gap-3">
                  {pendingDecision === 'approved' ? (
                    <Check className="h-6 w-6 text-green-600 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
                  )}
                  <div>
                    <h3
                      className={`font-semibold text-lg ${
                        pendingDecision === 'approved'
                          ? 'text-green-900'
                          : 'text-red-900'
                      }`}
                    >
                      {pendingDecision === 'approved'
                        ? 'Confirmer l\'approbation'
                        : 'Confirmer le rejet'}
                    </h3>
                    <p
                      className={`text-sm mt-1 ${
                        pendingDecision === 'approved'
                          ? 'text-green-800'
                          : 'text-red-800'
                      }`}
                    >
                      {pendingDecision === 'approved'
                        ? 'Le salaire sera modifié automatiquement à la date d\'effet.'
                        : 'La demande sera rejetée et l\'employé sera notifié.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes field (required for rejection) */}
              <FormField
                control={form.control}
                name="reviewNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Notes{' '}
                      {pendingDecision === 'rejected' && (
                        <span className="text-destructive">*</span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <textarea
                        className="w-full min-h-[100px] p-3 border rounded-md"
                        placeholder={
                          pendingDecision === 'approved'
                            ? 'Commentaires additionnels (optionnel)...'
                            : 'Expliquez la raison du rejet...'
                        }
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Actions */}
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowConfirmation(false)}
                  disabled={reviewMutation.isPending}
                  className="min-h-[44px]"
                >
                  Retour
                </Button>

                <Button
                  type="submit"
                  disabled={reviewMutation.isPending}
                  className={`min-h-[44px] min-w-[140px] ${
                    pendingDecision === 'approved'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {reviewMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Traitement...
                    </>
                  ) : (
                    <>
                      {pendingDecision === 'approved' ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Confirmer l'approbation
                        </>
                      ) : (
                        <>
                          <X className="mr-2 h-4 w-4" />
                          Confirmer le rejet
                        </>
                      )}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
