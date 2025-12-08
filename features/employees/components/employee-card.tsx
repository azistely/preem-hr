/**
 * Employee Card
 *
 * Summary card for mobile/grid view with key info
 * Clear visible "Voir" button for low digital literacy users
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, MoreVertical } from 'lucide-react';
import { EmployeeAvatar } from './employee-avatar';
import { EmployeeStatusBadge } from './employee-status-badge';
import { ContractEndingBadge, TrialPeriodBadge } from './contract-alert-badges';
import { formatCurrency } from '../hooks/use-salary-validation';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

const CONTRACT_TYPE_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  CDI: { label: 'CDI', variant: 'default' },
  CDD: { label: 'CDD', variant: 'secondary' },
  CDDTI: { label: 'CDDTI', variant: 'secondary' },
  INTERIM: { label: 'Intérim', variant: 'outline' },
  STAGE: { label: 'Stage', variant: 'outline' },
};

interface EmployeeCardProps {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    status: 'active' | 'terminated' | 'suspended';
    photoUrl?: string | null;
    contractType?: 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE' | null;
    contractEndDate?: string | null;
    hireDate?: string | Date;
    currentPosition?: {
      title: string;
      department?: string;
    };
    currentSalary?: {
      baseSalary: number;
    };
  };
  onEdit?: (id: string) => void;
  onTerminate?: (id: string) => void;
}

export function EmployeeCard({ employee, onEdit, onTerminate }: EmployeeCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <EmployeeAvatar
            firstName={employee.firstName}
            lastName={employee.lastName}
            photoUrl={employee.photoUrl}
            size="md"
          />
          <div>
            <h3 className="font-semibold">
              {employee.firstName} {employee.lastName}
            </h3>
            <p className="text-sm text-muted-foreground">{employee.employeeNumber}</p>
          </div>
        </div>

        {(onEdit || onTerminate) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(employee.id)}>
                  Modifier
                </DropdownMenuItem>
              )}
              {onTerminate && employee.status === 'active' && (
                <DropdownMenuItem
                  onClick={() => onTerminate(employee.id)}
                  className="text-destructive"
                >
                  Terminer le contrat
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Statut</span>
          <div className="flex flex-wrap items-center gap-1 justify-end">
            <EmployeeStatusBadge status={employee.status} />
            {employee.hireDate && (
              <TrialPeriodBadge hireDate={employee.hireDate} />
            )}
            <ContractEndingBadge
              contractEndDate={employee.contractEndDate ?? null}
              contractType={employee.contractType ?? null}
            />
          </div>
        </div>

        {employee.contractType && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Contrat</span>
            <Badge variant={CONTRACT_TYPE_LABELS[employee.contractType]?.variant || 'outline'}>
              {CONTRACT_TYPE_LABELS[employee.contractType]?.label || employee.contractType}
            </Badge>
          </div>
        )}

        {employee.currentPosition && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Poste</span>
            <span className="text-sm font-medium">{employee.currentPosition.title}</span>
          </div>
        )}

        {employee.currentSalary && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Salaire brut</span>
            <span className="text-sm font-medium">
              {formatCurrency(employee.currentSalary.baseSalary)}
            </span>
          </div>
        )}

        {/* Clear visible CTA button - HCI best practice for low digital literacy */}
        <Link href={`/employees/${employee.id}`} className="block pt-2">
          <Button className="w-full min-h-[56px] text-lg gap-2" variant="default">
            <Eye className="h-5 w-5" />
            Voir le profil
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
