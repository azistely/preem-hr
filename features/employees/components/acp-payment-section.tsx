'use client'

import { useState } from 'react'
import { Calendar, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { trpc } from '@/lib/trpc/client'
import { useToast } from '@/hooks/use-toast'

interface ACPPaymentSectionProps {
  employeeId: string
  initialData?: {
    acpPaymentDate: Date | null
    acpPaymentActive: boolean
    acpNotes: string | null
    acpLastPaidAt: Date | null
  }
}

export function ACPPaymentSection({ employeeId, initialData }: ACPPaymentSectionProps) {
  const [active, setActive] = useState(initialData?.acpPaymentActive ?? false)
  const [paymentDate, setPaymentDate] = useState<Date | null>(initialData?.acpPaymentDate ?? null)
  const [notes, setNotes] = useState(initialData?.acpNotes ?? '')

  const { toast } = useToast()
  const setACPMutation = trpc.employees.setACPPaymentDate.useMutation()

  const handleSave = async () => {
    try {
      await setACPMutation.mutateAsync({
        employeeId,
        paymentDate,
        active,
        notes,
      })

      toast({
        title: 'Configuration enregistrée',
        description: active
          ? 'Le paiement ACP a été activé pour cet employé'
          : 'Le paiement ACP a été désactivé',
      })
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder les paramètres ACP',
        variant: 'destructive',
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Paiement des Allocations de Congés Payés (ACP)
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Status Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-lg">
              Statut: {active ? '🟢 Actif' : '⚫ Inactif'}
            </Label>
            {!active && (
              <p className="text-sm text-muted-foreground mt-1">
                Quand actif, l'ACP sera calculé et payé automatiquement dans la paie du mois.
              </p>
            )}
          </div>
          <Button
            variant={active ? 'outline' : 'default'}
            onClick={() => setActive(!active)}
            className="min-h-[44px]"
          >
            {active ? 'Désactiver' : 'Activer le paiement ACP'}
          </Button>
        </div>

        {/* Payment Date (only shown when active) */}
        {active && (
          <>
            <div className="space-y-2">
              <Label htmlFor="acp-date">Date de paiement</Label>
              <DatePicker
                id="acp-date"
                value={paymentDate}
                onChange={setPaymentDate}
                placeholder="Sélectionner une date"
                className="min-h-[48px]"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="acp-notes">Notes (optionnel)</Label>
              <Textarea
                id="acp-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Paie ACP à chaque départ en congés annuels"
                rows={2}
              />
            </div>

            {/* Last Payment Info */}
            {initialData?.acpLastPaidAt && (
              <div className="text-sm text-muted-foreground">
                Dernier paiement:{' '}
                {new Date(initialData.acpLastPaidAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
            )}
          </>
        )}

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={(active && !paymentDate) || setACPMutation.isPending}
          className="w-full min-h-[56px]"
        >
          {setACPMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Enregistrement...
            </>
          ) : (
            'Enregistrer'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
