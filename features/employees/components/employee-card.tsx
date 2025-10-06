/**
 * Employee Card
 *
 * Summary card for mobile/grid view with key info
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, MoreVertical } from 'lucide-react';
import { EmployeeAvatar } from './employee-avatar';
import { EmployeeStatusBadge } from './employee-status-badge';
import { formatCurrency } from '../hooks/use-salary-validation';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface EmployeeCardProps {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    status: 'active' | 'terminated' | 'suspended';
    photoUrl?: string | null;
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/employees/${employee.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                Voir le profil
              </Link>
            </DropdownMenuItem>
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
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Statut</span>
          <EmployeeStatusBadge status={employee.status} />
        </div>

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

        <Link href={`/employees/${employee.id}`} className="block">
          <Button className="w-full mt-2 min-h-[44px]" variant="outline">
            <Eye className="mr-2 h-4 w-4" />
            Voir les détails
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
