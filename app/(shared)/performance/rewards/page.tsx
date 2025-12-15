/**
 * Rewards Approval Page (HR Only)
 *
 * Review and approve/reject bonus and promotion recommendations
 * from recognition feedback.
 */

'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Award,
  Banknote,
  TrendingUp,
  User,
  Clock,
  Check,
  X,
  AlertCircle,
  Sparkles,
  Building2,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

// Format currency for FCFA
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' FCFA';
};

// Reward type badge
function RewardTypeBadge({ hasBonus, hasPromotion }: { hasBonus: boolean; hasPromotion: boolean }) {
  if (hasBonus && hasPromotion) {
    return (
      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
        <Award className="h-3 w-3 mr-1" />
        Prime + Promotion
      </Badge>
    );
  }
  if (hasBonus) {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        <Banknote className="h-3 w-3 mr-1" />
        Prime
      </Badge>
    );
  }
  if (hasPromotion) {
    return (
      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
        <TrendingUp className="h-3 w-3 mr-1" />
        Promotion
      </Badge>
    );
  }
  return null;
}

// Item returned from listPendingRewards - flat structure with employee nested
interface PendingRewardItem {
  id: string;
  title: string | null;
  content: string;
  feedbackType: string;
  createdAt: Date;
  recommendsBonusAmount: string | null;
  recommendsBonusReason: string | null;
  recommendsPromotion: boolean | null;
  recommendsPromotionTo: string | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string | null;
    division: string | null;
    jobTitle: string | null;
  } | null;
}

// Pending reward card component
function PendingRewardCard({
  item,
  onApprove,
  onReject,
}: {
  item: PendingRewardItem;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { employee } = item;
  const bonusAmount = item.recommendsBonusAmount ? parseFloat(item.recommendsBonusAmount) : 0;
  const hasBonus = bonusAmount > 0;
  const hasPromotion = item.recommendsPromotion === true;

  return (
    <Card className="hover:bg-muted/50 transition-colors">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-amber-100 dark:bg-amber-900 rounded-full">
                <Award className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-medium text-lg">
                  {employee?.firstName} {employee?.lastName}
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mt-1">
                  {employee?.employeeNumber && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {employee.employeeNumber}
                    </span>
                  )}
                  {employee?.jobTitle && (
                    <>
                      <span>•</span>
                      <span>{employee.jobTitle}</span>
                    </>
                  )}
                  {employee?.division && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {employee.division}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <RewardTypeBadge hasBonus={hasBonus} hasPromotion={hasPromotion} />
          </div>

          {/* Recommendation details */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Bonus recommendation */}
            {hasBonus && (
              <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
                  <Banknote className="h-4 w-4" />
                  <span className="font-medium">Prime recommandée</span>
                </div>
                <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                  {formatCurrency(bonusAmount)}
                </p>
                {item.recommendsBonusReason && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                    {item.recommendsBonusReason}
                  </p>
                )}
              </div>
            )}

            {/* Promotion recommendation */}
            {hasPromotion && (
              <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="font-medium">Promotion recommandée</span>
                </div>
                {item.recommendsPromotionTo ? (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{employee?.jobTitle ?? 'Poste actuel'}</span>
                    <ChevronRight className="h-4 w-4" />
                    <span className="font-bold text-blue-800 dark:text-blue-200">
                      {item.recommendsPromotionTo}
                    </span>
                  </div>
                ) : (
                  <p className="text-blue-800 dark:text-blue-200 font-medium">
                    Promotion suggérée
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Original feedback */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">Reconnaissance originale</span>
            </div>
            {item.title && (
              <p className="font-medium mb-1">{item.title}</p>
            )}
            <p className="text-sm whitespace-pre-wrap">{item.content}</p>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(item.createdAt), {
                addSuffix: true,
                locale: fr,
              })}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="outline"
              onClick={onReject}
              className="min-h-[44px]"
            >
              <X className="mr-2 h-4 w-4" />
              Refuser
            </Button>
            <Button
              onClick={onApprove}
              className="min-h-[44px] bg-green-600 hover:bg-green-700"
            >
              <Check className="mr-2 h-4 w-4" />
              Approuver
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RewardsPage() {
  const [selectedItem, setSelectedItem] = useState<PendingRewardItem | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [createBonus, setCreateBonus] = useState(true);
  const [bonusAmount, setBonusAmount] = useState('');

  const utils = api.useUtils();

  // Fetch pending rewards
  const { data, isLoading, error } = api.performance.feedback.listPendingRewards.useQuery({
    limit: 50,
    offset: 0,
  });

  // Approve mutation
  const approveMutation = api.performance.feedback.approveReward.useMutation({
    onSuccess: () => {
      toast.success('Récompense approuvée avec succès');
      setShowApproveDialog(false);
      setSelectedItem(null);
      setBonusAmount('');
      setCreateBonus(true);
      utils.performance.feedback.listPendingRewards.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'approbation');
    },
  });

  // Reject mutation
  const rejectMutation = api.performance.feedback.rejectReward.useMutation({
    onSuccess: () => {
      toast.success('Recommandation refusée');
      setShowRejectDialog(false);
      setSelectedItem(null);
      setRejectionReason('');
      utils.performance.feedback.listPendingRewards.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors du refus');
    },
  });

  const pendingRewards = data?.data ?? [];
  const total = data?.total ?? 0;

  const handleApprove = () => {
    if (!selectedItem) return;

    const originalAmount = selectedItem.recommendsBonusAmount
      ? parseFloat(selectedItem.recommendsBonusAmount)
      : 0;
    const finalAmount = bonusAmount ? parseFloat(bonusAmount) : originalAmount;

    approveMutation.mutate({
      feedbackId: selectedItem.id,
      createBonus: createBonus && finalAmount > 0,
      bonusAmount: finalAmount > 0 ? finalAmount : undefined,
      bonusReason: selectedItem.recommendsBonusReason || undefined,
    });
  };

  const handleReject = () => {
    if (!selectedItem || !rejectionReason.trim()) {
      toast.error('Veuillez indiquer une raison de refus');
      return;
    }

    rejectMutation.mutate({
      feedbackId: selectedItem.id,
      reason: rejectionReason.trim(),
    });
  };

  const openApproveDialog = (item: PendingRewardItem) => {
    setSelectedItem(item);
    setBonusAmount(item.recommendsBonusAmount || '');
    setShowApproveDialog(true);
  };

  const openRejectDialog = (item: PendingRewardItem) => {
    setSelectedItem(item);
    setRejectionReason('');
    setShowRejectDialog(true);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Award className="h-8 w-8 text-amber-500" />
          Approbation des récompenses
        </h1>
        <p className="text-muted-foreground mt-1">
          Validez les recommandations de primes et promotions issues des reconnaissances
        </p>
      </div>

      {/* Stats card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900 rounded-lg">
              <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">En attente d'approbation</p>
              <p className="text-2xl font-bold">{total}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h3 className="text-lg font-medium mb-2">Erreur de chargement</h3>
            <p className="text-muted-foreground">
              Impossible de charger les recommandations en attente
            </p>
          </CardContent>
        </Card>
      ) : pendingRewards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Check className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">Aucune recommandation en attente</h3>
            <p className="text-muted-foreground">
              Toutes les recommandations de récompenses ont été traitées
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingRewards.map((item) => (
            <PendingRewardCard
              key={item.id}
              item={item}
              onApprove={() => openApproveDialog(item)}
              onReject={() => openRejectDialog(item)}
            />
          ))}
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Approuver la récompense</DialogTitle>
            <DialogDescription>
              Confirmez l'approbation pour {selectedItem?.employee?.firstName}{' '}
              {selectedItem?.employee?.lastName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedItem?.recommendsBonusAmount && (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="createBonus"
                    checked={createBonus}
                    onChange={(e) => setCreateBonus(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="createBonus" className="text-sm font-normal">
                    Créer une prime dans la paie
                  </Label>
                </div>

                {createBonus && (
                  <div className="space-y-2">
                    <Label htmlFor="bonusAmount">Montant de la prime</Label>
                    <div className="relative">
                      <Input
                        id="bonusAmount"
                        type="number"
                        value={bonusAmount}
                        onChange={(e) => setBonusAmount(e.target.value)}
                        className="min-h-[48px] pr-16"
                        placeholder="Ex: 50000"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        FCFA
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Montant recommandé: {formatCurrency(parseFloat(selectedItem.recommendsBonusAmount || '0'))}
                    </p>
                  </div>
                )}
              </>
            )}

            {selectedItem?.recommendsPromotion && (
              <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="font-medium">Promotion à traiter séparément</span>
                </div>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  La promotion vers "{selectedItem.recommendsPromotionTo || 'nouveau poste'}"
                  devra être traitée dans le module de gestion des contrats.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
              className="min-h-[48px]"
            >
              Annuler
            </Button>
            <Button
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              className="min-h-[48px] bg-green-600 hover:bg-green-700"
            >
              <Check className="mr-2 h-4 w-4" />
              {approveMutation.isPending ? 'Approbation...' : 'Confirmer l\'approbation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refuser la recommandation</AlertDialogTitle>
            <AlertDialogDescription>
              Indiquez la raison du refus pour {selectedItem?.employee?.firstName}{' '}
              {selectedItem?.employee?.lastName}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-4">
            <Label htmlFor="rejectionReason">
              Raison du refus <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="rejectionReason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ex: Budget insuffisant, critères non remplis..."
              className="min-h-[100px]"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[48px]">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={rejectMutation.isPending || !rejectionReason.trim()}
              className="min-h-[48px] bg-destructive hover:bg-destructive/90"
            >
              <X className="mr-2 h-4 w-4" />
              {rejectMutation.isPending ? 'Refus...' : 'Confirmer le refus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
