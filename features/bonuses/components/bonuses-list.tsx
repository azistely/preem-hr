/**
 * Bonuses List Component
 *
 * Purpose: Display list of bonuses with actions
 * Features:
 * - Data table with sorting
 * - Status badges
 * - Approve/reject actions
 * - Mobile-responsive
 * - Loading/error states
 */

'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, X, Loader2, Eye } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
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

interface BonusesListProps {
  period?: string;
  status?: string;
  employeeId?: string;
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  paid: 'bg-blue-100 text-blue-800 border-blue-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
};

const statusLabels = {
  pending: 'En attente',
  approved: 'Approuvée',
  paid: 'Payée',
  cancelled: 'Annulée',
};

const bonusTypeLabels = {
  performance: 'Performance',
  holiday: 'Fête',
  project: 'Projet',
  sales_commission: 'Commission',
  attendance: 'Assiduité',
  retention: 'Fidélité',
  other: 'Autre',
};

export function BonusesList({ period, status, employeeId }: BonusesListProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [bonusToApprove, setBonusToApprove] = useState<{ id: string; approve: boolean } | null>(null);

  // Fetch bonuses
  const { data, isLoading, error } = trpc.bonuses.list.useQuery({
    period,
    status: status as any,
    employeeId,
    limit: 100,
  });

  // Approve/reject mutation
  const approveMutation = trpc.bonuses.approve.useMutation({
    onSuccess: (_, variables) => {
      toast({
        title: variables.approve ? 'Prime approuvée' : 'Prime rejetée',
        description: variables.approve
          ? 'La prime a été approuvée avec succès'
          : 'La prime a été rejetée',
      });
      utils.bonuses.list.invalidate();
      setBonusToApprove(null);
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleApprove = (id: string, approve: boolean) => {
    setBonusToApprove({ id, approve });
  };

  const confirmApprove = () => {
    if (!bonusToApprove) return;

    approveMutation.mutate({
      id: bonusToApprove.id,
      approve: bonusToApprove.approve,
    });
  };

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Chargement des primes...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-8">
        <div className="text-center text-destructive">
          <p className="font-semibold">Erreur de chargement</p>
          <p className="text-sm mt-2">{error.message}</p>
        </div>
      </Card>
    );
  }

  if (!data || data.bonuses.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">Aucune prime trouvée</p>
          <p className="text-sm mt-2">
            Créez une nouvelle prime pour commencer
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employé</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Période</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.bonuses.map((bonus) => (
                <TableRow key={bonus.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div>{bonus.employeeName}</div>
                      <div className="text-xs text-muted-foreground">
                        {bonus.employeeNumber}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {bonusTypeLabels[bonus.bonusType as keyof typeof bonusTypeLabels] || bonus.bonusType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {Number(bonus.amount).toLocaleString('fr-FR')} FCFA
                  </TableCell>
                  <TableCell>
                    {new Date(bonus.period).toLocaleDateString('fr-FR', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px] truncate" title={bonus.description || ''}>
                      {bonus.description || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusColors[bonus.status as keyof typeof statusColors]}
                    >
                      {statusLabels[bonus.status as keyof typeof statusLabels] || bonus.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      {bonus.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="min-h-[36px] min-w-[36px] p-2"
                            onClick={() => handleApprove(bonus.id, true)}
                            title="Approuver"
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="min-h-[36px] min-w-[36px] p-2"
                            onClick={() => handleApprove(bonus.id, false)}
                            title="Rejeter"
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="min-h-[36px] min-w-[36px] p-2"
                        title="Voir les détails"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination info */}
        <div className="border-t p-4 text-sm text-muted-foreground">
          {data.bonuses.length} prime{data.bonuses.length > 1 ? 's' : ''} affichée{data.bonuses.length > 1 ? 's' : ''}
          {data.total > data.bonuses.length && ` sur ${data.total}`}
        </div>
      </Card>

      {/* Approval confirmation dialog */}
      <AlertDialog open={!!bonusToApprove} onOpenChange={() => setBonusToApprove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bonusToApprove?.approve ? 'Approuver la prime' : 'Rejeter la prime'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bonusToApprove?.approve
                ? 'Cette prime sera incluse dans le prochain calcul de paie.'
                : 'Cette prime sera annulée et ne sera pas incluse dans la paie.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmApprove}
              disabled={approveMutation.isPending}
              className={bonusToApprove?.approve ? '' : 'bg-destructive hover:bg-destructive/90'}
            >
              {approveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
