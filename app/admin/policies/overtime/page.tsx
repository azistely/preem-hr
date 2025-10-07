/**
 * Overtime Rules Page
 *
 * Multi-country overtime rate configuration
 * - Shows legal minimums for selected country
 * - Locked rates for CI (Convention Collective)
 * - Editable for new countries (super admin)
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Lock, Calculator, Globe } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

const COUNTRIES = [
  { code: 'CI', name: 'Côte d\'Ivoire', flag: '🇨🇮' },
  { code: 'SN', name: 'Sénégal', flag: '🇸🇳' },
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫' },
];

const PERIOD_LABELS: Record<string, { label: string; description: string }> = {
  weekday_41_48: {
    label: 'Semaine 41-48h',
    description: 'Heures hebdomadaires entre 41h et 48h',
  },
  weekday_48_plus: {
    label: 'Semaine 48h+',
    description: 'Heures hebdomadaires au-delà de 48h',
  },
  saturday: {
    label: 'Samedi',
    description: 'Travail le samedi (jour normalement non travaillé)',
  },
  sunday: {
    label: 'Dimanche',
    description: 'Travail le dimanche (jour de repos légal)',
  },
  holiday: {
    label: 'Jour férié',
    description: 'Travail durant un jour férié légal',
  },
  night: {
    label: 'Nuit (21h-5h)',
    description: 'Heures de travail entre 21h et 5h',
  },
};

export default function OvertimeRulesPage() {
  const [selectedCountry, setSelectedCountry] = useState('CI');
  const [calculatorHours, setCalculatorHours] = useState(10);
  const [calculatorPeriod, setCalculatorPeriod] = useState('sunday');

  const { data: rates, isLoading } = trpc.policies.getOvertimeRates.useQuery({
    countryCode: selectedCountry,
  });

  const isLocked = selectedCountry === 'CI'; // CI rates are locked by Convention Collective

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Taux d'heures supplémentaires</h2>
          <p className="text-muted-foreground mt-1">
            Configuration des majorations selon la Convention Collective
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

      {/* Rates Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Barème des majorations</CardTitle>
              <CardDescription>
                {isLocked
                  ? 'Taux verrouillés par la Convention Collective'
                  : 'Taux configurables pour ce pays'}
              </CardDescription>
            </div>
            {isLocked && (
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" />
                Verrouillé
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : rates && rates.length > 0 ? (
            <div className="space-y-3">
              {rates.map((rate) => {
                const config = PERIOD_LABELS[rate.periodType] || {
                  label: rate.periodType,
                  description: '',
                };
                const multiplier = parseFloat(rate.rateMultiplier);
                const legalMinimum = parseFloat(rate.legalMinimum);

                return (
                  <div
                    key={rate.id}
                    className={cn(
                      'flex items-center justify-between p-4 rounded-lg border',
                      'transition-colors hover:bg-muted/50'
                    )}
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg">{config.label}</h4>
                      <p className="text-sm text-muted-foreground">
                        {config.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">
                          {multiplier.toFixed(0)}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Taux actuel
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">
                            Min: {legalMinimum.toFixed(0)}%
                          </p>
                          {isLocked && (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {rate.legalReference}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Aucun taux configuré pour ce pays
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interactive Calculator */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Calculateur d'heures supplémentaires</CardTitle>
              <CardDescription>
                Calculez le nombre d'heures payées avec les majorations
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Type de période
              </label>
              <Select value={calculatorPeriod} onValueChange={setCalculatorPeriod}>
                <SelectTrigger className="min-h-[48px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rates?.map((rate) => {
                    const config = PERIOD_LABELS[rate.periodType];
                    return (
                      <SelectItem key={rate.periodType} value={rate.periodType}>
                        {config?.label || rate.periodType}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Heures travaillées
              </label>
              <Input
                type="number"
                min={1}
                max={24}
                value={calculatorHours}
                onChange={(e) => setCalculatorHours(parseInt(e.target.value))}
                className="min-h-[48px]"
              />
            </div>
          </div>

          {/* Result */}
          {(() => {
            const rate = rates?.find((r) => r.periodType === calculatorPeriod);
            if (!rate) return null;

            const multiplier = parseFloat(rate.rateMultiplier);
            const bonus = ((multiplier - 100) / 100) * calculatorHours;
            const totalPaid = calculatorHours + bonus;
            const config = PERIOD_LABELS[calculatorPeriod];

            return (
              <div className="rounded-lg bg-primary/5 border-2 border-primary p-6">
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Un employé qui travaille{' '}
                    <strong>{calculatorHours}h</strong> un{' '}
                    <strong>{config?.label.toLowerCase()}</strong>
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-3xl font-bold text-primary">
                      +{bonus.toFixed(1)}h
                    </span>
                    <span className="text-muted-foreground">=</span>
                    <span className="text-3xl font-bold">
                      {totalPaid.toFixed(1)}h payées
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Majoration de {multiplier - 100}% ({multiplier}% du taux normal)
                  </p>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Multi-Country Comparison */}
      {COUNTRIES.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Comparaison multi-pays</CardTitle>
            <CardDescription>
              Visualisez les différences de taux entre pays
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {COUNTRIES.map((country) => (
                <CountryComparisonCard
                  key={country.code}
                  countryCode={country.code}
                  countryName={country.name}
                  countryFlag={country.flag}
                  isActive={country.code === selectedCountry}
                  onClick={() => setSelectedCountry(country.code)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CountryComparisonCard({
  countryCode,
  countryName,
  countryFlag,
  isActive,
  onClick,
}: {
  countryCode: string;
  countryName: string;
  countryFlag: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const { data: rates } = trpc.policies.getOvertimeRates.useQuery({
    countryCode,
  });

  return (
    <button
      onClick={onClick}
      className={cn(
        'text-left rounded-lg border-2 p-4 transition-all hover:shadow-md',
        isActive ? 'border-primary bg-primary/5' : 'border-border'
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{countryFlag}</span>
        <h4 className="font-semibold">{countryName}</h4>
      </div>

      {rates && rates.length > 0 ? (
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dimanche:</span>
            <span className="font-medium">
              {rates.find((r) => r.periodType === 'sunday')?.rateMultiplier ||
                'N/A'}
              %
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Férié:</span>
            <span className="font-medium">
              {rates.find((r) => r.periodType === 'holiday')?.rateMultiplier ||
                'N/A'}
              %
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nuit:</span>
            <span className="font-medium">
              {rates.find((r) => r.periodType === 'night')?.rateMultiplier ||
                'N/A'}
              %
            </span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Non configuré</p>
      )}
    </button>
  );
}
