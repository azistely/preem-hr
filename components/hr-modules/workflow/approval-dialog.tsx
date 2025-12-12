/**
 * Approval Dialog Component
 *
 * Dialog for approving or rejecting workflow steps.
 * Includes optional comment field and validation.
 *
 * Features:
 * - Approve/Reject actions
 * - Required/optional comment field
 * - Delegation option
 * - Confirmation before action
 */

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ThumbsUp, ThumbsDown, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export type ApprovalDecision = 'approved' | 'rejected';

interface ApprovalDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Step name for display */
  stepName: string;
  /** Subject name (e.g., employee being evaluated) */
  subjectName?: string;
  /** Whether comment is required */
  requireComment?: boolean;
  /** Allow delegation to another person */
  allowDelegation?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Callback when approved */
  onApprove: (comment?: string) => void;
  /** Callback when rejected */
  onReject: (comment: string) => void;
  /** Callback when delegated */
  onDelegate?: (toEmployeeId: string) => void;
}

export function ApprovalDialog({
  open,
  onOpenChange,
  stepName,
  subjectName,
  requireComment = false,
  allowDelegation = false,
  isLoading = false,
  onApprove,
  onReject,
  onDelegate,
}: ApprovalDialogProps) {
  const [decision, setDecision] = useState<ApprovalDecision | null>(null);
  const [comment, setComment] = useState('');
  const [showConfirmReject, setShowConfirmReject] = useState(false);

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setDecision(null);
      setComment('');
    }
    onOpenChange(newOpen);
  };

  // Handle approve
  const handleApprove = () => {
    if (requireComment && !comment.trim()) {
      toast.error('Un commentaire est requis');
      return;
    }
    onApprove(comment.trim() || undefined);
  };

  // Handle reject (with confirmation)
  const handleRejectClick = () => {
    if (!comment.trim()) {
      toast.error('Un commentaire est requis pour le rejet');
      return;
    }
    setShowConfirmReject(true);
  };

  const handleRejectConfirm = () => {
    setShowConfirmReject(false);
    onReject(comment.trim());
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Décision d&apos;approbation</DialogTitle>
            <DialogDescription>
              {subjectName ? (
                <>Approuvez ou rejetez l&apos;étape &quot;{stepName}&quot; pour <strong>{subjectName}</strong>.</>
              ) : (
                <>Approuvez ou rejetez l&apos;étape &quot;{stepName}&quot;.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Decision radio group */}
            <div className="space-y-3">
              <Label>Votre décision</Label>
              <RadioGroup
                value={decision ?? ''}
                onValueChange={(val) => setDecision(val as ApprovalDecision)}
                className="grid grid-cols-2 gap-4"
              >
                <div>
                  <RadioGroupItem
                    value="approved"
                    id="approved"
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor="approved"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-green-500 peer-data-[state=checked]:bg-green-50 [&:has([data-state=checked])]:border-green-500 cursor-pointer"
                  >
                    <ThumbsUp className="h-6 w-6 mb-2 text-green-600" />
                    <span className="font-medium">Approuver</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem
                    value="rejected"
                    id="rejected"
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor="rejected"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-red-500 peer-data-[state=checked]:bg-red-50 [&:has([data-state=checked])]:border-red-500 cursor-pointer"
                  >
                    <ThumbsDown className="h-6 w-6 mb-2 text-red-600" />
                    <span className="font-medium">Rejeter</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Comment field */}
            <div className="space-y-2">
              <Label htmlFor="comment">
                Commentaire {decision === 'rejected' || requireComment ? '(requis)' : '(optionnel)'}
              </Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  decision === 'rejected'
                    ? 'Expliquez les raisons du rejet...'
                    : 'Ajoutez un commentaire ou des remarques...'
                }
                className="min-h-[100px]"
              />
              {decision === 'rejected' && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Un commentaire est requis pour expliquer le rejet
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Annuler
            </Button>

            {decision === 'approved' && (
              <Button
                type="button"
                onClick={handleApprove}
                disabled={isLoading || (requireComment && !comment.trim())}
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ThumbsUp className="mr-2 h-4 w-4" />
                )}
                Confirmer l&apos;approbation
              </Button>
            )}

            {decision === 'rejected' && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleRejectClick}
                disabled={isLoading || !comment.trim()}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ThumbsDown className="mr-2 h-4 w-4" />
                )}
                Confirmer le rejet
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection confirmation */}
      <AlertDialog open={showConfirmReject} onOpenChange={setShowConfirmReject}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer le rejet</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir rejeter cette étape ? Cette action peut affecter
              le processus en cours et nécessiter des corrections.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirmer le rejet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Quick Approval Buttons Component
 *
 * Inline approve/reject buttons for simple cases.
 */
interface QuickApprovalButtonsProps {
  /** Loading state */
  isLoading?: boolean;
  /** Callback when approved */
  onApprove: () => void;
  /** Callback when rejected */
  onReject: () => void;
  /** Size variant */
  size?: 'default' | 'sm' | 'lg';
  /** Show labels */
  showLabels?: boolean;
}

export function QuickApprovalButtons({
  isLoading = false,
  onApprove,
  onReject,
  size = 'default',
  showLabels = true,
}: QuickApprovalButtonsProps) {
  return (
    <div className="flex gap-2">
      <Button
        size={size}
        onClick={onApprove}
        disabled={isLoading}
        className="bg-green-600 hover:bg-green-700"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ThumbsUp className={showLabels ? 'mr-2 h-4 w-4' : 'h-4 w-4'} />
        )}
        {showLabels && 'Approuver'}
      </Button>
      <Button
        size={size}
        variant="destructive"
        onClick={onReject}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ThumbsDown className={showLabels ? 'mr-2 h-4 w-4' : 'h-4 w-4'} />
        )}
        {showLabels && 'Rejeter'}
      </Button>
    </div>
  );
}

export default ApprovalDialog;
