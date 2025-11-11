'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { BarChart3, Calendar, DollarSign, Medal, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { ACPCalculationResult } from '@/features/leave/services/acp-calculation.service'

interface ACPPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeName: string
  calculation: ACPCalculationResult | null
  isLoading?: boolean
}

export function ACPPreviewDialog({
  open,
  onOpenChange,
  employeeName,
  calculation,
  isLoading = false,
}: ACPPreviewDialogProps) {
  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chargement...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!calculation) {
    return null
  }

  const {
    acpAmount,
    leaveDaysTakenCalendar,
    dailyAverageSalary,
    referencePeriodStart,
    referencePeriodEnd,
    numberOfMonths,
    totalGrossTaxableSalary,
    totalPaidDays,
    seniorityBonusDays,
    warnings,
  } = calculation

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Prévisualisation du calcul ACP - {employeeName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Result Summary */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Résultat du calcul</h3>
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-bold">{formatCurrency(acpAmount)} FCFA</div>
                <div className="text-sm text-muted-foreground">
                  ({leaveDaysTakenCalendar} jours × {formatCurrency(dailyAverageSalary)} FCFA/jour)
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reference Period */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4" />
              <h3 className="font-semibold">Période de référence</h3>
            </div>
            <p className="text-sm">
              Du {formatDate(referencePeriodStart)} au {formatDate(referencePeriodEnd)}
              {' '}({numberOfMonths.toFixed(1)} mois)
            </p>
          </div>

          <Separator />

          {/* Average Daily Wage */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-4 w-4" />
              <h3 className="font-semibold">Salaire moyen journalier</h3>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total salaire brut imposable:</span>
                <span className="font-medium">{formatCurrency(totalGrossTaxableSalary)} FCFA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Jours payés:</span>
                <span className="font-medium">{totalPaidDays} jours</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-muted-foreground">Moyenne:</span>
                <span className="font-semibold">{formatCurrency(dailyAverageSalary)} FCFA/jour</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Leave Days */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4" />
              <h3 className="font-semibold">Congés pris</h3>
            </div>
            <p className="text-sm">
              {leaveDaysTakenCalendar} jours calendaires
            </p>
          </div>

          {/* Seniority Bonus */}
          {seniorityBonusDays > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Medal className="h-4 w-4" />
                  <h3 className="font-semibold">Prime d'ancienneté</h3>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Jours supplémentaires:</span>
                    <span className="font-medium text-primary">+{seniorityBonusDays} jours</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Warnings */}
          {warnings && warnings.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <h3 className="font-semibold text-yellow-600">Avertissements</h3>
                </div>
                <ul className="space-y-2">
                  {warnings.map((warning, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <span className="text-yellow-600 mt-0.5">•</span>
                      <span>{warning.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {(!warnings || warnings.length === 0) && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4" />
                  <h3 className="font-semibold">Avertissements</h3>
                </div>
                <p className="text-sm text-muted-foreground">Aucun</p>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={() => onOpenChange(false)} className="min-h-[44px]">
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
