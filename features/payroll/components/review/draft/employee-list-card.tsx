'use client';

/**
 * Employee List Card - Draft Mode
 *
 * Shows employees grouped by review status for draft payroll runs
 * - Critical: No time entries, missing data
 * - Warning: Unapproved hours, pending adjustments
 * - Ready: All data complete
 *
 * Design: Mobile-first, collapsible sections, touch-friendly
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { EmployeeStatusBadge } from '../employee-status-badge';
import { SearchFilterBar, type SearchFilters } from './search-filter-bar';
import { api } from '@/trpc/react';

type DraftStatus = 'critical' | 'warning' | 'ready';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  status: DraftStatus;
  statusMessage: string;
  paymentFrequency: string | null;
}

interface EmployeeListCardProps {
  runId: string;
  onEmployeeClick: (employee: Employee) => void;
}

export function EmployeeListCard({
  runId,
  onEmployeeClick,
}: EmployeeListCardProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    statuses: [],
    paymentFrequencies: [],
    issues: [],
  });
  const [expandedSections, setExpandedSections] = useState<Set<DraftStatus>>(
    new Set(['critical', 'warning'])
  );

  // Fetch employees with their draft review status
  const { data: employees = [], isLoading } = api.payroll.getDraftEmployeesGrouped.useQuery({
    runId,
  });

  const toggleSection = (status: DraftStatus) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  // Group employees by status
  const groupedEmployees: Record<DraftStatus, Employee[]> = {
    critical: employees.filter((e) => e.status === 'critical'),
    warning: employees.filter((e) => e.status === 'warning'),
    ready: employees.filter((e) => e.status === 'ready'),
  };

  // Filter by all criteria
  const filterEmployees = (empList: Employee[]) => {
    let filtered = empList;

    // Filter by search query
    if (filters.query) {
      const query = filters.query.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.firstName.toLowerCase().includes(query) ||
          e.lastName.toLowerCase().includes(query) ||
          e.employeeNumber.toLowerCase().includes(query)
      );
    }

    // Filter by payment frequency
    if (filters.paymentFrequencies.length > 0) {
      filtered = filtered.filter((e) =>
        e.paymentFrequency
          ? filters.paymentFrequencies.includes(e.paymentFrequency as any)
          : false
      );
    }

    return filtered;
  };

  const filteredGroups = {
    critical:
      filters.statuses.length === 0 || filters.statuses.includes('critical')
        ? filterEmployees(groupedEmployees.critical)
        : [],
    warning:
      filters.statuses.length === 0 || filters.statuses.includes('warning')
        ? filterEmployees(groupedEmployees.warning)
        : [],
    ready:
      filters.statuses.length === 0 || filters.statuses.includes('ready')
        ? filterEmployees(groupedEmployees.ready)
        : [],
  };

  const totalFiltered =
    filteredGroups.critical.length +
    filteredGroups.warning.length +
    filteredGroups.ready.length;

  const sectionConfig: Record<
    DraftStatus,
    { title: string; colorClass: string }
  > = {
    critical: {
      title: 'Nécessite Attention',
      colorClass: 'border-red-200 bg-red-50',
    },
    warning: {
      title: 'À Vérifier',
      colorClass: 'border-orange-200 bg-orange-50',
    },
    ready: {
      title: 'Prêts',
      colorClass: 'border-green-200 bg-green-50',
    },
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Révision des Employés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Chargement...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Révision des Employés
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filter Bar */}
        <SearchFilterBar
          filters={filters}
          onFiltersChange={setFilters}
          resultCount={totalFiltered}
        />

        {/* Grouped Employee Lists */}
        <div className="space-y-3">
          {(['critical', 'warning', 'ready'] as DraftStatus[]).map((status) => {
            const config = sectionConfig[status];
            const employees = filteredGroups[status];
            const isExpanded = expandedSections.has(status);

            if (employees.length === 0) return null;

            return (
              <Collapsible
                key={status}
                open={isExpanded}
                onOpenChange={() => toggleSection(status)}
              >
                <Card className={config.colorClass}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-black/5 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <EmployeeStatusBadge mode="draft" status={status} />
                          <span className="font-semibold">
                            {config.title} ({employees.length})
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="space-y-2 pt-0">
                      {employees.map((employee) => (
                        <Button
                          key={employee.id}
                          variant="outline"
                          onClick={() => onEmployeeClick(employee)}
                          className="w-full min-h-[60px] justify-start text-left p-4 hover:bg-white/80"
                        >
                          <div className="flex-1">
                            <div className="font-medium">
                              {employee.firstName} {employee.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              #{employee.employeeNumber}
                              {employee.paymentFrequency && (
                                <> · {employee.paymentFrequency}</>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {employee.statusMessage}
                            </div>
                          </div>
                        </Button>
                      ))}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>

        {/* No Results */}
        {totalFiltered === 0 && employees.length > 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Aucun employé ne correspond aux filtres sélectionnés
          </div>
        )}
      </CardContent>
    </Card>
  );
}
