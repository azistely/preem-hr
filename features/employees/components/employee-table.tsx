/**
 * Employee Table
 *
 * Desktop table view with sorting and actions
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

interface EmployeeTableProps {
  employees: Array<{
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    status: 'active' | 'terminated' | 'suspended';
    email: string;
    photoUrl?: string | null;
    currentPosition?: {
      title: string;
      department?: string;
    };
    currentSalary?: {
      baseSalary: number;
    };
  }>;
  onEdit?: (id: string) => void;
  onTerminate?: (id: string) => void;
}

export function EmployeeTable({ employees, onEdit, onTerminate }: EmployeeTableProps) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employé</TableHead>
            <TableHead>Poste</TableHead>
            <TableHead>Salaire brut</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                Aucun employé trouvé
              </TableCell>
            </TableRow>
          ) : (
            employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <EmployeeAvatar
                      firstName={employee.firstName}
                      lastName={employee.lastName}
                      photoUrl={employee.photoUrl}
                      size="sm"
                    />
                    <div>
                      <div className="font-medium">
                        {employee.firstName} {employee.lastName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {employee.employeeNumber}
                      </div>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  {employee.currentPosition ? (
                    <div>
                      <div className="font-medium">{employee.currentPosition.title}</div>
                      {employee.currentPosition.department && (
                        <div className="text-sm text-muted-foreground">
                          {employee.currentPosition.department}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>

                <TableCell className="font-medium">
                  {employee.currentSalary
                    ? formatCurrency(employee.currentSalary.baseSalary)
                    : '-'}
                </TableCell>

                <TableCell>
                  <EmployeeStatusBadge status={employee.status} />
                </TableCell>

                <TableCell>
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
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
