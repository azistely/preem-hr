/**
 * Assignment History Timeline
 *
 * Visual timeline of position assignments for an employee
 * Following HCI principles:
 * - Visual timeline (clear chronology)
 * - Progressive disclosure
 * - Mobile-responsive
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Briefcase, Circle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Position {
  id: string;
  title: string;
  department?: string | null;
}

interface Assignment {
  id: string;
  positionId: string;
  assignmentType: 'primary' | 'secondary' | 'temporary';
  effectiveFrom: string;
  effectiveTo: string | null;
  assignmentReason?: string | null;
  notes?: string | null;
  position?: Position;
}

interface AssignmentHistoryTimelineProps {
  assignments: Assignment[];
}

export function AssignmentHistoryTimeline({ assignments }: AssignmentHistoryTimelineProps) {
  if (!assignments || assignments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Aucun historique d'affectation</p>
        </CardContent>
      </Card>
    );
  }

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      primary: 'Principal',
      secondary: 'Secondaire',
      temporary: 'Temporaire',
    };
    return types[type] || type;
  };

  const getTypeVariant = (type: string): 'default' | 'secondary' | 'outline' => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      primary: 'default',
      secondary: 'secondary',
      temporary: 'outline',
    };
    return variants[type] || 'secondary';
  };

  const getReasonLabel = (reason: string | null | undefined) => {
    if (!reason) return null;

    const reasons: Record<string, string> = {
      hire: 'Embauche',
      promotion: 'Promotion',
      transfer: 'Transfert',
      demotion: 'Rétrogradation',
      restructuring: 'Restructuration',
      other: 'Autre',
    };
    return reasons[reason] || reason;
  };

  const getReasonVariant = (reason: string | null | undefined): 'default' | 'secondary' | 'outline' | 'destructive' => {
    if (!reason) return 'secondary';

    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      hire: 'default',
      promotion: 'default',
      transfer: 'secondary',
      demotion: 'outline',
      restructuring: 'secondary',
      other: 'secondary',
    };
    return variants[reason] || 'secondary';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Historique des affectations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {assignments.map((assignment, index) => {
          const isCurrentAssignment = assignment.effectiveTo === null;
          const isMostRecent = index === 0;

          // Calculate duration
          const startDate = new Date(assignment.effectiveFrom);
          const endDate = assignment.effectiveTo
            ? new Date(assignment.effectiveTo)
            : new Date();
          const durationDays = differenceInDays(endDate, startDate);

          return (
            <div key={assignment.id} className="relative">
              {/* Timeline Line */}
              {!isMostRecent && (
                <div className="absolute left-[23px] top-12 bottom-0 w-0.5 bg-border" />
              )}

              <div className="flex gap-4">
                {/* Timeline Dot */}
                <div className="flex-shrink-0 pt-1">
                  <div
                    className={`h-12 w-12 rounded-full flex items-center justify-center ${
                      isCurrentAssignment
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Circle className={`h-6 w-6 ${isCurrentAssignment ? 'fill-current' : ''}`} />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 pb-6">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-xl font-bold">
                          {assignment.position?.title || 'Poste inconnu'}
                        </h3>
                        {isCurrentAssignment && (
                          <Badge variant="default" className="text-xs">
                            Actuel
                          </Badge>
                        )}
                        <Badge variant={getTypeVariant(assignment.assignmentType)} className="text-xs">
                          {getTypeLabel(assignment.assignmentType)}
                        </Badge>
                      </div>
                      {assignment.position?.department && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {assignment.position.department}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {format(startDate, 'd MMMM yyyy', { locale: fr })}
                        {assignment.effectiveTo && (
                          <>
                            {' → '}
                            {format(new Date(assignment.effectiveTo), 'd MMMM yyyy', {
                              locale: fr,
                            })}
                            <span className="ml-2 text-xs">
                              ({Math.floor(durationDays / 30)} mois)
                            </span>
                          </>
                        )}
                        {isCurrentAssignment && (
                          <span className="ml-2 text-xs">
                            (depuis {Math.floor(durationDays / 30)} mois)
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Reason Badge */}
                    {assignment.assignmentReason && (
                      <Badge variant={getReasonVariant(assignment.assignmentReason)}>
                        {getReasonLabel(assignment.assignmentReason)}
                      </Badge>
                    )}
                  </div>

                  {/* Notes */}
                  {assignment.notes && (
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <Separator className="mb-2" />
                      <p className="text-sm text-muted-foreground italic">
                        "{assignment.notes}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
