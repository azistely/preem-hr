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
import Link from 'next/link';
import { CategoryBadge } from '@/components/employees/category-badge';
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

interface EmployeeTableProps {
  employees: Array<{
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    status: 'active' | 'terminated' | 'suspended';
    email: string;
    photoUrl?: string | null;
    contractType?: 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE' | null;
    currentPosition?: {
      title: string;
      department?: string;
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
            <TableHead>Contrat</TableHead>
            <TableHead>Catégorie</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="w-[140px]">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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

                <TableCell>
                  {employee.contractType ? (
                    <Badge variant={CONTRACT_TYPE_LABELS[employee.contractType]?.variant || 'outline'}>
                      {CONTRACT_TYPE_LABELS[employee.contractType]?.label || employee.contractType}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>

                <TableCell>
                  <CategoryBadge
                    employeeId={employee.id}
                    showCoefficient={false}
                    showTooltip={true}
                    size="sm"
                  />
                </TableCell>

                <TableCell>
                  <EmployeeStatusBadge status={employee.status} />
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-1">
                    <Link href={`/employees/${employee.id}`}>
                      <Button variant="default" size="sm" className="min-h-[44px] gap-2">
                        <Eye className="h-4 w-4" />
                        Voir
                      </Button>
                    </Link>
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
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
