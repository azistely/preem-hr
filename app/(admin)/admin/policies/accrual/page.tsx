/**
 * Leave Accrual Rules Page
 *
 * Age-based and seniority-based accrual rules
 * - Standard rule (2.0 days/month for CI)
 * - Youth bonus (<21 years: 2.5 days/month)
 * - Seniority bonuses (15y: +2d, 20y: +4d, 25y: +6d)
 * - Interactive calculator
 */

'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Lock, Calculator, Users, Award, Globe } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

const COUNTRIES = [
  { code: 'CI', name: 'Côte d\'Ivoire', flag: '🇨🇮' },
  { code: 'SN', name: 'Sénégal', flag: '🇸🇳' },
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫' },
];

export default function AccrualRulesPage() {
  const [selectedCountry, setSelectedCountry] = useState('CI');
  const [calculatorAge, setCalculatorAge] = useState(22);
  const [calculatorSeniority, setCalculatorSeniority] = useState(18);

  const { data: rules, isLoading } = trpc.policies.getAccrualRules.useQuery({
    countryCode: selectedCountry,
  });

  const { data: calculatedAccrual } =
    trpc.policies.calculateAccrualForEmployee.useQuery({
      countryCode: selectedCountry,
      age: calculatorAge,
      seniorityYears: calculatorSeniority,
    });

  const isLocked = selectedCountry === 'CI'; // CI rules are locked by Convention Collective

  // Separate rules by type
  const standardRule = rules?.find(
    (r) => !r.ageThreshold && !r.seniorityYears
  );
  const youthRule = rules?.find((r) => r.ageThreshold && !r.seniorityYears);
  const seniorityRules = rules
    ?.filter((r) => r.seniorityYears)
    .sort((a, b) => (a.seniorityYears || 0) - (b.seniorityYears || 0));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Règles d'acquisition de congés</h2>
          <p className="text-muted-foreground mt-1">
            Barème selon l'âge et l'ancienneté
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-muted-foreground" />
          <Select value={selectedCountry} onValueChange={setSelectedCountry}>
            <SelectTrigger className="w-[200px] min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{country.flag}</span>
                    <span>{country.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Standard Rule */}
          {standardRule && (
            <Card className="border-primary">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Règle standard</CardTitle>
                      <CardDescription>
                        Applicable à tous les employés par défaut
                      </CardDescription>
                    </div>
                  </div>
                  {isLocked && (
                    <Badge variant="secondary" className="gap-1">
                      <Lock className="h-3 w-3" />
                      Verrouillée
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-6 bg-primary/5 rounded-lg">
                  <div>
                    <p className="text-3xl font-bold text-primary">
                      {standardRule.daysPerMonth} jours/mois
                    </p>
                    <p className="text-muted-foreground mt-1">
                      = {(parseFloat(standardRule.daysPerMonth) * 12).toFixed(1)}{' '}
                      jours/an
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="mb-1">
                      Minimum légal
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      {standardRule.legalReference}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Youth Rule */}
          {youthRule && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle>
                        Employés de moins de {youthRule.ageThreshold} ans
                      </CardTitle>
                      <CardDescription>
                        Bonus jeunesse selon la Convention Collective
                      </CardDescription>
                    </div>
                  </div>
                  {isLocked && (
                    <Badge variant="secondary" className="gap-1">
                      <Lock className="h-3 w-3" />
                      Verrouillée
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-6 bg-blue-50 rounded-lg border border-blue-200">
                  <div>
                    <p className="text-3xl font-bold text-blue-600">
                      {youthRule.daysPerMonth} jours/mois
                    </p>
                    <p className="text-muted-foreground mt-1">
                      = {(parseFloat(youthRule.daysPerMonth) * 12).toFixed(1)}{' '}
                      jours/an
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      Âge &lt; {youthRule.ageThreshold} ans
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {youthRule.legalReference}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Seniority Bonuses */}
          {seniorityRules && seniorityRules.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <Award className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <CardTitle>Bonus d'ancienneté</CardTitle>
                      <CardDescription>
                        Jours additionnels selon les années de service
                      </CardDescription>
                    </div>
                  </div>
                  {isLocked && (
                    <Badge variant="secondary" className="gap-1">
                      <Lock className="h-3 w-3" />
                      Verrouillée
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {seniorityRules.map((rule) => {
                  const baseRate = parseFloat(standardRule?.daysPerMonth || '2.0');
                  const bonusDays = rule.bonusDays || 0;
                  const totalAnnual = baseRate * 12 + bonusDays;

                  return (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-amber-50 border-amber-200"
                    >
                      <div>
                        <p className="font-semibold text-lg">
                          {rule.seniorityYears} ans d'ancienneté
                        </p>
                        <p className="text-sm text-muted-foreground">
                          +{bonusDays} jours de bonus
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-amber-600">
                          {totalAnnual.toFixed(0)} jours/an
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {baseRate} × 12 + {bonusDays}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {seniorityRules[0]?.legalReference && (
                  <p className="text-xs text-muted-foreground italic pt-2 border-t">
                    {seniorityRules[0].legalReference}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Interactive Calculator */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Calculateur d'acquisition</CardTitle>
                  <CardDescription>
                    Calculez les jours de congés selon l'âge et l'ancienneté
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Âge de l'employé (ans)
                  </label>
                  <Input
                    type="number"
                    min={16}
                    max={70}
                    value={calculatorAge}
                    onChange={(e) => setCalculatorAge(parseInt(e.target.value))}
                    className="min-h-[48px]"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Ancienneté (années)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={calculatorSeniority}
                    onChange={(e) =>
                      setCalculatorSeniority(parseInt(e.target.value))
                    }
                    className="min-h-[48px]"
                  />
                </div>
              </div>

              {/* Result */}
              {calculatedAccrual && (
                <div className="rounded-lg bg-primary/5 border-2 border-primary p-6">
                  <div className="text-center space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Employé de <strong>{calculatorAge} ans</strong> avec{' '}
                      <strong>{calculatorSeniority} ans d'ancienneté</strong>
                    </p>

                    <div className="space-y-1">
                      <p className="text-4xl font-bold text-primary">
                        {calculatedAccrual.totalAnnual.toFixed(0)} jours/an
                      </p>
                      <p className="text-lg text-muted-foreground">
                        = {calculatedAccrual.daysPerMonth.toFixed(1)} jours/mois
                        {calculatedAccrual.bonusDays > 0 && (
                          <> + {calculatedAccrual.bonusDays} jours de bonus</>
                        )}
                      </p>
                    </div>

                    {/* Breakdown */}
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Base mensuelle
                        </p>
                        <p className="text-lg font-semibold">
                          {calculatedAccrual.daysPerMonth.toFixed(1)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Bonus ancienneté
                        </p>
                        <p className="text-lg font-semibold">
                          +{calculatedAccrual.bonusDays}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total annuel</p>
                        <p className="text-lg font-semibold text-primary">
                          {calculatedAccrual.totalAnnual.toFixed(0)}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground italic pt-2">
                      {calculatedAccrual.legalReference}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* No Rules Message */}
          {!rules || rules.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">
                  Aucune règle configurée
                </p>
                <p className="text-muted-foreground">
                  Aucune règle d'acquisition trouvée pour ce pays
                </p>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
