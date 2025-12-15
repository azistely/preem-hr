'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Calendar, ChevronRight, ClipboardCheck, User } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useRouter } from 'next/navigation';

interface ProbationEmployee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  probationEndDate: string | null;
  isUrgent: boolean;
}

interface ProbationWidgetProps {
  urgent: number;
  upcoming: number;
  total: number;
  employees: ProbationEmployee[];
}

export function ProbationWidget({ urgent, upcoming, total, employees }: ProbationWidgetProps) {
  const router = useRouter();

  const handleEvaluate = (employeeId: string) => {
    router.push(`/performance/evaluations/new?employeeId=${employeeId}&type=probation`);
  };

  if (total === 0) {
    return null; // Don't render if no probations ending
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Périodes d'essai
            </CardTitle>
            <CardDescription>
              {total} fin{total > 1 ? 's' : ''} de période dans les 30 prochains jours
            </CardDescription>
          </div>
          {urgent > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {urgent} urgent{urgent > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {employees.slice(0, 5).map((employee) => {
          const daysRemaining = employee.probationEndDate
            ? differenceInDays(new Date(employee.probationEndDate), new Date())
            : null;

          return (
            <div
              key={employee.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                employee.isUrgent ? 'border-destructive/50 bg-destructive/5' : 'border-border'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${employee.isUrgent ? 'bg-destructive/10' : 'bg-muted'}`}>
                  <User className={`h-4 w-4 ${employee.isUrgent ? 'text-destructive' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {employee.lastName} {employee.firstName}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{employee.employeeNumber}</span>
                    {employee.probationEndDate && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(employee.probationEndDate), 'dd MMM', { locale: fr })}
                        </span>
                        {daysRemaining !== null && (
                          <Badge
                            variant={daysRemaining <= 7 ? 'destructive' : daysRemaining <= 14 ? 'secondary' : 'outline'}
                            className="text-xs"
                          >
                            {daysRemaining} jour{daysRemaining !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant={employee.isUrgent ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => handleEvaluate(employee.id)}
                className="min-h-[36px]"
              >
                Évaluer
              </Button>
            </div>
          );
        })}

        {employees.length > 5 && (
          <Button
            variant="ghost"
            className="w-full mt-2"
            onClick={() => router.push('/employees?probationStatus=in_progress')}
          >
            Voir tout ({employees.length})
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
