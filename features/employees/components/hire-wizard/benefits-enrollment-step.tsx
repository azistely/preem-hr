/**
 * Benefits Enrollment Step - Hire Wizard
 *
 * Allows enrolling new employee in benefit plans during onboarding
 */

'use client';

import { useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Plus, X, Heart, Check } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface BenefitsEnrollmentStepProps {
  form: UseFormReturn<any>;
}

export function BenefitsEnrollmentStep({ form }: BenefitsEnrollmentStepProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [effectiveFrom, setEffectiveFrom] = useState<Date | undefined>(
    form.getValues('hireDate') || new Date()
  );

  // Create benefit plan state
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanCode, setNewPlanCode] = useState('');
  const [newPlanType, setNewPlanType] = useState<string>('health');

  // Fetch active benefit plans
  const utils = trpc.useUtils();
  const { data: benefitPlans, isLoading, refetch } = trpc.benefits.listPlans.useQuery({
    isActive: true,
  });
  const createPlanMutation = trpc.benefits.createPlan.useMutation();

  const benefitEnrollments = form.watch('benefitEnrollments') || [];

  const handleAddEnrollment = () => {
    if (!selectedPlanId || !effectiveFrom) return;

    const plan = benefitPlans?.find((p: any) => p.id === selectedPlanId);
    if (!plan) return;

    const newEnrollment = {
      planId: selectedPlanId,
      effectiveFrom: effectiveFrom,
    };

    form.setValue('benefitEnrollments', [...benefitEnrollments, newEnrollment]);

    // Reset form
    setSelectedPlanId('');
    setEffectiveFrom(form.getValues('hireDate') || new Date());
    setShowAddDialog(false);
  };

  const handleRemoveEnrollment = (index: number) => {
    const updated = benefitEnrollments.filter((_: any, i: number) => i !== index);
    form.setValue('benefitEnrollments', updated);
  };

  const handleCreatePlan = async () => {
    if (!newPlanName.trim() || !newPlanCode.trim()) {
      toast.error('Le nom et le code du plan sont requis');
      return;
    }

    try {
      const newPlan = await createPlanMutation.mutateAsync({
        planName: newPlanName.trim(),
        planCode: newPlanCode.trim(),
        benefitType: newPlanType as any,
        currency: 'XOF',
        costFrequency: 'monthly',
        waitingPeriodDays: 0,
        effectiveFrom: new Date().toISOString().split('T')[0],
        isActive: true,
      });

      // Invalidate and refetch plans to include the new one
      await utils.benefits.listPlans.invalidate();
      await refetch();

      // Automatically select the newly created plan in the enrollment dialog
      setSelectedPlanId(newPlan.id);

      // Reset form and close dialog
      setNewPlanName('');
      setNewPlanCode('');
      setNewPlanType('health');
      setShowCreateDialog(false);

      toast.success(`Plan "${newPlan.planName}" créé avec succès!`);

      // Open the add enrollment dialog
      setShowAddDialog(true);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création du plan');
    }
  };

  const getPlanName = (planId: string) => {
    const plan = benefitPlans?.find((p: any) => p.id === planId);
    return plan?.planName || 'Plan inconnu';
  };

  const getPlanType = (planId: string) => {
    const plan = benefitPlans?.find((p: any) => p.id === planId);
    return plan?.benefitType || 'other';
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      health: 'Santé',
      dental: 'Dentaire',
      vision: 'Vision',
      life_insurance: 'Assurance vie',
      disability: 'Invalidité',
      retirement: 'Retraite',
      transport: 'Transport',
      meal: 'Repas',
      other: 'Autre',
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Sélectionnez les avantages sociaux (CMU, assurance maladie, etc.) auxquels l'employé sera inscrit.
          Cette étape est optionnelle - vous pouvez ajouter des avantages plus tard.
        </AlertDescription>
      </Alert>

      {!benefitPlans || benefitPlans.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">Aucun plan d'avantages configuré</p>
            <p className="text-sm text-muted-foreground">
              Créez des plans d'avantages dans les paramètres pour les proposer aux employés.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Enrolled Benefits */}
          {benefitEnrollments.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Avantages sélectionnés ({benefitEnrollments.length})</h3>
              {benefitEnrollments.map((enrollment: any, index: number) => (
                <Card key={index}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{getPlanName(enrollment.planId)}</h4>
                          <Badge variant="outline" className="text-xs">
                            {getTypeLabel(getPlanType(enrollment.planId))}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          À partir du {format(new Date(enrollment.effectiveFrom), 'PPP', { locale: fr })}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveEnrollment(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {/* Create Benefit Plan Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="h-10">
                  <Plus className="mr-2 h-4 w-4" />
                  Créer un plan
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Créer un nouveau plan d'avantages</DialogTitle>
                  <DialogDescription>
                    Créez rapidement un plan. Vous pourrez ajouter plus de détails plus tard.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="benefitType">Type d'avantage *</Label>
                    <Select value={newPlanType} onValueChange={setNewPlanType}>
                      <SelectTrigger className="min-h-[48px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="health">Santé</SelectItem>
                        <SelectItem value="dental">Dentaire</SelectItem>
                        <SelectItem value="vision">Vision</SelectItem>
                        <SelectItem value="life_insurance">Assurance Vie</SelectItem>
                        <SelectItem value="retirement">Retraite</SelectItem>
                        <SelectItem value="disability">Invalidité</SelectItem>
                        <SelectItem value="transport">Transport</SelectItem>
                        <SelectItem value="meal">Restauration</SelectItem>
                        <SelectItem value="other">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="planName">Nom du plan *</Label>
                    <Input
                      id="planName"
                      placeholder="Ex: CMU Basique, Assurance Vie Premium"
                      value={newPlanName}
                      onChange={(e) => setNewPlanName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newPlanName.trim() && newPlanCode.trim()) {
                          e.preventDefault();
                          handleCreatePlan();
                        }
                      }}
                      className="min-h-[48px]"
                      autoFocus
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="planCode">Code du plan *</Label>
                    <Input
                      id="planCode"
                      placeholder="Ex: CMU-001, AVP-001"
                      value={newPlanCode}
                      onChange={(e) => setNewPlanCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newPlanName.trim() && newPlanCode.trim()) {
                          e.preventDefault();
                          handleCreatePlan();
                        }
                      }}
                      className="min-h-[48px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Code unique pour identifier le plan
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setNewPlanName('');
                      setNewPlanCode('');
                      setNewPlanType('health');
                      setShowCreateDialog(false);
                    }}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCreatePlan}
                    disabled={createPlanMutation.isPending || !newPlanName.trim() || !newPlanCode.trim()}
                  >
                    {createPlanMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Création...
                      </>
                    ) : (
                      'Créer le plan'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Add Benefit Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" className="flex-1 min-h-[48px]">
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter un avantage
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter un avantage social</DialogTitle>
                <DialogDescription>
                  Sélectionnez un plan d'avantages et la date de début d'inscription.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Plan d'avantages *</label>
                  <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                    <SelectTrigger className="min-h-[48px]">
                      <SelectValue placeholder="Sélectionner un plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {benefitPlans?.map((plan: any) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          <div className="flex items-center gap-2">
                            <span>{plan.planName}</span>
                            <Badge variant="outline" className="text-xs">
                              {getTypeLabel(plan.benefitType)}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Date de début *</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full min-h-[48px] justify-start text-left font-normal',
                          !effectiveFrom && 'text-muted-foreground'
                        )}
                      >
                        {effectiveFrom ? (
                          format(effectiveFrom, 'PPP', { locale: fr })
                        ) : (
                          <span>Sélectionner une date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={effectiveFrom}
                        onSelect={setEffectiveFrom}
                        initialFocus
                        locale={fr}
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">
                    Généralement la date d'embauche
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddDialog(false)}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  onClick={handleAddEnrollment}
                  disabled={!selectedPlanId || !effectiveFrom}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Ajouter
                </Button>
              </div>
            </DialogContent>
            </Dialog>
          </div>

          {benefitEnrollments.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Aucun avantage sélectionné. Cliquez sur "Ajouter un avantage" pour commencer.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
