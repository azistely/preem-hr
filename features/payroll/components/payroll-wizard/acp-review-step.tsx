'use client'

import { Eye, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'
import { ACPPreviewDialog } from '@/features/employees/components/acp-preview-dialog'
import type { ACPCalculationResult } from '@/features/leave/services/acp-calculation.service'

interface ACPEmployee {
  id: string
  firstName: string
  lastName: string
  acpPaymentDate: Date | null
  acpCalculation?: {
    acpAmount: number
    leaveDays: number
    dailyRate: number
  }
}

interface ACPReviewStepProps {
  employees: ACPEmployee[]
  onBack: () => void
  onContinue: () => void
  isLoading?: boolean
}

export function ACPReviewStep({
  employees,
  onBack,
  onContinue,
  isLoading = false,
}: ACPReviewStepProps) {
  const [selectedEmployee, setSelectedEmployee] = useState<ACPEmployee | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (date: Date | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
    })
  }

  const totalACP = employees.reduce(
    (sum, emp) => sum + (emp.acpCalculation?.acpAmount ?? 0),
    0
  )

  const handleViewDetails = (employee: ACPEmployee) => {
    setSelectedEmployee(employee)
    setPreviewOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Étape 3 sur 5: Vérification des ACP</h2>
        <p className="text-muted-foreground">
          {employees.length} employé{employees.length > 1 ? 's' : ''} avec paiement ACP actif ce mois
        </p>
      </div>

      {/* Employees Table */}
      {employees.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Date ACP</TableHead>
                  <TableHead className="text-right">Jours</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">
                      {employee.firstName} {employee.lastName}
                    </TableCell>
                    <TableCell>{formatDate(employee.acpPaymentDate)}</TableCell>
                    <TableCell className="text-right">
                      {employee.acpCalculation?.leaveDays ?? '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {employee.acpCalculation
                        ? formatCurrency(employee.acpCalculation.acpAmount)
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(employee)}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">Voir les détails</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucun employé avec paiement ACP actif ce mois
          </CardContent>
        </Card>
      )}

      {/* Total */}
      {employees.length > 0 && (
        <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
          <span className="font-semibold">Total ACP ce mois:</span>
          <span className="text-2xl font-bold">{formatCurrency(totalACP)} FCFA</span>
        </div>
      )}

      {/* Info Box */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-900">
              Les montants ACP seront ajoutés au salaire brut et soumis à l'ITS et CNPS.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between gap-4">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isLoading}
          className="min-h-[44px]"
        >
          Retour
        </Button>
        <Button
          onClick={onContinue}
          disabled={isLoading}
          className="min-h-[56px] px-8"
        >
          Continuer →
        </Button>
      </div>

      {/* Preview Dialog */}
      {selectedEmployee && (
        <ACPPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          employeeName={`${selectedEmployee.firstName} ${selectedEmployee.lastName}`}
          calculation={
            selectedEmployee.acpCalculation
              ? ({
                  ...selectedEmployee.acpCalculation,
                  referencePeriod: {
                    startDate: new Date(),
                    endDate: new Date(),
                    months: 12,
                  },
                  totalGrossWages: selectedEmployee.acpCalculation.acpAmount,
                  totalPaidDays: 240,
                  warnings: [],
                } as unknown as ACPCalculationResult)
              : null
          }
        />
      )}
    </div>
  )
}
