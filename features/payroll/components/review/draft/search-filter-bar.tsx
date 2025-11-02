'use client';

/**
 * Search and Filter Bar Component
 *
 * Real-time search and filtering for employee list
 * - Search by name/employee number
 * - Filter by status, payment frequency, issues
 * - Mobile bottom sheet for filters
 * - Clear visual feedback
 *
 * Design: Mobile-first, touch-friendly, real-time updates
 */

import { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

type DraftStatus = 'critical' | 'warning' | 'ready';
type PaymentFrequency = 'MONTHLY' | 'WEEKLY' | 'BIWEEKLY' | 'DAILY';
type IssueType = 'missing_hours' | 'unapproved_hours' | 'overtime' | 'pay_variables';

export interface SearchFilters {
  query: string;
  statuses: DraftStatus[];
  paymentFrequencies: PaymentFrequency[];
  issues: IssueType[];
}

interface SearchFilterBarProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  resultCount?: number;
}

export function SearchFilterBar({
  filters,
  onFiltersChange,
  resultCount,
}: SearchFilterBarProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const handleQueryChange = (query: string) => {
    onFiltersChange({ ...filters, query });
  };

  const handleStatusToggle = (status: DraftStatus) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];
    onFiltersChange({ ...filters, statuses: newStatuses });
  };

  const handleFrequencyToggle = (freq: PaymentFrequency) => {
    const newFreqs = filters.paymentFrequencies.includes(freq)
      ? filters.paymentFrequencies.filter((f) => f !== freq)
      : [...filters.paymentFrequencies, freq];
    onFiltersChange({ ...filters, paymentFrequencies: newFreqs });
  };

  const handleIssueToggle = (issue: IssueType) => {
    const newIssues = filters.issues.includes(issue)
      ? filters.issues.filter((i) => i !== issue)
      : [...filters.issues, issue];
    onFiltersChange({ ...filters, issues: newIssues });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      query: '',
      statuses: [],
      paymentFrequencies: [],
      issues: [],
    });
    setIsFilterOpen(false);
  };

  const activeFilterCount =
    filters.statuses.length +
    filters.paymentFrequencies.length +
    filters.issues.length;

  const hasActiveFilters = activeFilterCount > 0 || filters.query.length > 0;

  return (
    <div className="space-y-3">
      {/* Search and Filter Row */}
      <div className="flex gap-2">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou matricule..."
            value={filters.query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="pl-10 min-h-[48px]"
          />
          {filters.query && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleQueryChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Filter Sheet Trigger */}
        <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              className="min-h-[48px] px-4 gap-2 relative"
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filtrer</span>
              {activeFilterCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                >
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>

          <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
            <SheetHeader className="pb-6">
              <SheetTitle>Filtres</SheetTitle>
              <SheetDescription>
                Affinez votre recherche d&apos;employés
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6">
              {/* Status Filters */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Statut</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="status-critical"
                      checked={filters.statuses.includes('critical')}
                      onCheckedChange={() => handleStatusToggle('critical')}
                    />
                    <Label htmlFor="status-critical" className="font-normal cursor-pointer">
                      Nécessite attention
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="status-warning"
                      checked={filters.statuses.includes('warning')}
                      onCheckedChange={() => handleStatusToggle('warning')}
                    />
                    <Label htmlFor="status-warning" className="font-normal cursor-pointer">
                      À vérifier
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="status-ready"
                      checked={filters.statuses.includes('ready')}
                      onCheckedChange={() => handleStatusToggle('ready')}
                    />
                    <Label htmlFor="status-ready" className="font-normal cursor-pointer">
                      Prêts
                    </Label>
                  </div>
                </div>
              </div>

              {/* Payment Frequency Filters */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Fréquence de paie</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="freq-monthly"
                      checked={filters.paymentFrequencies.includes('MONTHLY')}
                      onCheckedChange={() => handleFrequencyToggle('MONTHLY')}
                    />
                    <Label htmlFor="freq-monthly" className="font-normal cursor-pointer">
                      Mensuel
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="freq-weekly"
                      checked={filters.paymentFrequencies.includes('WEEKLY')}
                      onCheckedChange={() => handleFrequencyToggle('WEEKLY')}
                    />
                    <Label htmlFor="freq-weekly" className="font-normal cursor-pointer">
                      Hebdomadaire
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="freq-biweekly"
                      checked={filters.paymentFrequencies.includes('BIWEEKLY')}
                      onCheckedChange={() => handleFrequencyToggle('BIWEEKLY')}
                    />
                    <Label htmlFor="freq-biweekly" className="font-normal cursor-pointer">
                      Quinzaine
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="freq-daily"
                      checked={filters.paymentFrequencies.includes('DAILY')}
                      onCheckedChange={() => handleFrequencyToggle('DAILY')}
                    />
                    <Label htmlFor="freq-daily" className="font-normal cursor-pointer">
                      Journalier
                    </Label>
                  </div>
                </div>
              </div>

              {/* Issue Type Filters */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Problème spécifique</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="issue-missing"
                      checked={filters.issues.includes('missing_hours')}
                      onCheckedChange={() => handleIssueToggle('missing_hours')}
                    />
                    <Label htmlFor="issue-missing" className="font-normal cursor-pointer">
                      Heures manquantes
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="issue-unapproved"
                      checked={filters.issues.includes('unapproved_hours')}
                      onCheckedChange={() => handleIssueToggle('unapproved_hours')}
                    />
                    <Label htmlFor="issue-unapproved" className="font-normal cursor-pointer">
                      Heures non approuvées
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="issue-overtime"
                      checked={filters.issues.includes('overtime')}
                      onCheckedChange={() => handleIssueToggle('overtime')}
                    />
                    <Label htmlFor="issue-overtime" className="font-normal cursor-pointer">
                      Heures supplémentaires
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="issue-variables"
                      checked={filters.issues.includes('pay_variables')}
                      onCheckedChange={() => handleIssueToggle('pay_variables')}
                    />
                    <Label htmlFor="issue-variables" className="font-normal cursor-pointer">
                      Variables de paie à ajouter
                    </Label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={handleClearFilters}
                  className="flex-1 min-h-[48px]"
                >
                  Réinitialiser
                </Button>
                <Button
                  onClick={() => setIsFilterOpen(false)}
                  className="flex-1 min-h-[48px]"
                >
                  Appliquer
                  {activeFilterCount > 0 && ` (${activeFilterCount})`}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtres actifs:</span>
          {filters.query && (
            <Badge variant="secondary" className="gap-1">
              Recherche: {filters.query}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleQueryChange('')}
              />
            </Badge>
          )}
          {filters.statuses.map((status) => (
            <Badge key={status} variant="secondary" className="gap-1">
              {status === 'critical' && 'Critique'}
              {status === 'warning' && 'Attention'}
              {status === 'ready' && 'Prêt'}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleStatusToggle(status)}
              />
            </Badge>
          ))}
          {resultCount !== undefined && (
            <span className="text-sm font-medium">
              {resultCount} résultat{resultCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
