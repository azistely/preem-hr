/**
 * Day Detail Panel
 *
 * Shows all leave requests for a specific day
 * Following HCI principles:
 * - Clear date header
 * - Grouped by status
 * - Employee avatars for quick identification
 * - Mobile-responsive
 */

'use client';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, Users, CheckCircle, Clock } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LeaveRequest {
  id: string;
  employee: {
    firstName: string;
    lastName: string;
  };
  startDate: string;
  endDate: string;
  status: string;
  policy: {
    name: string;
    policyType: string;
  };
}

interface DayDetailPanelProps {
  date: Date | null;
  requests: LeaveRequest[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DayDetailPanel({
  date,
  requests,
  open,
  onOpenChange,
}: DayDetailPanelProps) {
  if (!date) return null;

  // Group by status
  const approvedRequests = requests.filter((r) => r.status === 'approved');
  const pendingRequests = requests.filter((r) => r.status === 'pending');

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`;
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${format(start, 'd MMM', { locale: fr })} - ${format(end, 'd MMM yyyy', { locale: fr })}`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {format(date, 'EEEE d MMMM yyyy', { locale: fr })}
          </SheetTitle>
          <SheetDescription>
            {requests.length} employé{requests.length > 1 ? 's' : ''} en congé ce jour
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6">
          <div className="space-y-6">
            {/* Approved leaves */}
            {approvedRequests.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <h3 className="font-semibold text-sm">
                    Approuvés ({approvedRequests.length})
                  </h3>
                </div>

                <div className="space-y-3">
                  {approvedRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-green-50 border-green-200"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-green-600 text-white">
                          {getInitials(
                            request.employee.firstName,
                            request.employee.lastName
                          )}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">
                          {request.employee.firstName} {request.employee.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {request.policy.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDateRange(request.startDate, request.endDate)}
                        </p>
                      </div>

                      <Badge variant="default" className="bg-green-600 text-xs">
                        Approuvé
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {approvedRequests.length > 0 && pendingRequests.length > 0 && (
              <Separator />
            )}

            {/* Pending leaves */}
            {pendingRequests.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <h3 className="font-semibold text-sm">
                    En attente ({pendingRequests.length})
                  </h3>
                </div>

                <div className="space-y-3">
                  {pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-amber-50 border-amber-200"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-amber-600 text-white">
                          {getInitials(
                            request.employee.firstName,
                            request.employee.lastName
                          )}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">
                          {request.employee.firstName} {request.employee.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {request.policy.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDateRange(request.startDate, request.endDate)}
                        </p>
                      </div>

                      <Badge
                        variant="outline"
                        className="border-amber-600 text-amber-700 text-xs"
                      >
                        En attente
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {requests.length === 0 && (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun congé ce jour</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
