/**
 * Schedule Day Card Component
 *
 * HCI Principles Applied:
 * - Large touch targets (56px buttons)
 * - Three preset buttons: Present (8h), Partial (custom), Absent
 * - Progressive disclosure: Time picker only shows for partial days
 * - Visual status indicators with color coding
 * - Error prevention: Disable past approved days
 * - Immediate feedback: Optimistic UI updates
 */

'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Check, X, Clock, Loader2 } from 'lucide-react';
import { format, isPast, isFuture } from 'date-fns';
import { fr } from 'date-fns/locale';
import { trpc } from '@/lib/trpc/client';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import type { WorkSchedule } from '@/lib/db/schema/work-schedules';

type ScheduleDayCardProps = {
  date: Date;
  schedule?: WorkSchedule;
  employeeId: string;
  onScheduleUpdated: () => void;
};

export function ScheduleDayCard({
  date,
  schedule,
  employeeId,
  onScheduleUpdated,
}: ScheduleDayCardProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [customHours, setCustomHours] = useState<number>(
    schedule?.hoursWorked ? Number(schedule.hoursWorked) : 8
  );

  const recordDayMutation = trpc.workSchedules.recordDay.useMutation({
    onSuccess: () => {
      toast({
        title: 'Horaire enregistré',
        description: 'Votre journée a été enregistrée avec succès.',
      });
      onScheduleUpdated();
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Day info
  const dayName = format(date, 'EEEE', { locale: fr });
  const dayNumber = format(date, 'd');
  const monthName = format(date, 'MMM', { locale: fr });

  const isPresent = schedule?.isPresent || false;
  const hoursWorked = schedule?.hoursWorked ? Number(schedule.hoursWorked) : 0;
  const status = schedule?.status || 'draft';
  const scheduleType = schedule?.scheduleType || 'ABSENT';

  // Status checks
  const isApproved = status === 'approved';
  const isPending = status === 'pending';
  const isDraft = status === 'draft' || !schedule;
  const isPastDate = isPast(date) && !format(date, 'yyyy-MM-dd').includes(format(new Date(), 'yyyy-MM-dd'));
  const isFutureDate = isFuture(date);
  const isEditable = !isApproved && !isPending;

  // Handle preset actions
  const handleFullDay = () => {
    if (!isEditable) return;

    recordDayMutation.mutate({
      employeeId,
      workDate: date,
      scheduleType: 'FULL_DAY',
      hoursWorked: 8,
      isPresent: true,
      status: 'draft',
    });
  };

  const handlePartialDay = () => {
    if (!isEditable) return;
    setIsEditing(true);
  };

  const handleAbsent = () => {
    if (!isEditable) return;

    recordDayMutation.mutate({
      employeeId,
      workDate: date,
      scheduleType: 'ABSENT',
      isPresent: false,
      status: 'draft',
    });
  };

  const handleSaveCustomHours = () => {
    if (!isEditable || customHours <= 0 || customHours > 24) return;

    recordDayMutation.mutate({
      employeeId,
      workDate: date,
      scheduleType: 'PARTIAL_DAY',
      hoursWorked: customHours,
      isPresent: true,
      status: 'draft',
    });
  };

  return (
    <Card
      className={cn(
        'transition-all',
        isPresent && !isApproved && 'bg-green-50 border-green-200',
        isPresent && isApproved && 'bg-green-100 border-green-300',
        !isPresent && schedule && 'bg-gray-50 border-gray-200',
        recordDayMutation.isPending && 'opacity-60'
      )}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-medium text-muted-foreground capitalize">
              {dayName}
            </div>
            <div className="text-2xl font-bold">
              {dayNumber} {monthName}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {/* Status Badge */}
            {isApproved && (
              <Badge className="bg-green-600">
                <Check className="h-3 w-3 mr-1" />
                Approuvé
              </Badge>
            )}
            {isPending && (
              <Badge variant="secondary">
                <Clock className="h-3 w-3 mr-1" />
                En attente
              </Badge>
            )}
            {isDraft && schedule && (
              <Badge variant="outline">Brouillon</Badge>
            )}

            {/* Hours Badge */}
            {isPresent && hoursWorked > 0 && (
              <Badge variant="default" className="bg-blue-600">
                {hoursWorked}h
              </Badge>
            )}
          </div>
        </div>

        {/* Action Buttons or Custom Hours Input */}
        {isEditing ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0.5"
                max="24"
                step="0.5"
                value={customHours}
                onChange={(e) => setCustomHours(parseFloat(e.target.value) || 0)}
                className="min-h-[48px] text-lg text-center font-semibold"
                placeholder="Heures"
                autoFocus
              />
              <span className="text-lg font-medium">heures</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="min-h-[44px]"
                onClick={() => setIsEditing(false)}
              >
                Annuler
              </Button>
              <Button
                className="min-h-[44px]"
                onClick={handleSaveCustomHours}
                disabled={customHours <= 0 || customHours > 24 || recordDayMutation.isPending}
              >
                {recordDayMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Valider'
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {/* Present (Full Day) */}
            <Button
              variant={isPresent && scheduleType === 'FULL_DAY' ? 'default' : 'outline'}
              className={cn(
                'min-h-[56px] min-w-[56px] flex flex-col items-center justify-center p-2',
                isPresent && scheduleType === 'FULL_DAY' && 'bg-green-600 hover:bg-green-700'
              )}
              onClick={handleFullDay}
              disabled={!isEditable || recordDayMutation.isPending}
            >
              <Check className="h-5 w-5 mb-1" />
              <span className="text-xs font-semibold">Présent</span>
              <span className="text-xs">(8h)</span>
            </Button>

            {/* Partial Day */}
            <Button
              variant={isPresent && scheduleType === 'PARTIAL_DAY' ? 'default' : 'outline'}
              className={cn(
                'min-h-[56px] min-w-[56px] flex flex-col items-center justify-center p-2',
                isPresent && scheduleType === 'PARTIAL_DAY' && 'bg-blue-600 hover:bg-blue-700'
              )}
              onClick={handlePartialDay}
              disabled={!isEditable || recordDayMutation.isPending}
            >
              <Clock className="h-5 w-5 mb-1" />
              <span className="text-xs font-semibold">Partiel</span>
              {isPresent && scheduleType === 'PARTIAL_DAY' && (
                <span className="text-xs">({hoursWorked}h)</span>
              )}
            </Button>

            {/* Absent */}
            <Button
              variant={!isPresent && schedule ? 'default' : 'outline'}
              className={cn(
                'min-h-[56px] min-w-[56px] flex flex-col items-center justify-center p-2',
                !isPresent && schedule && 'bg-gray-600 hover:bg-gray-700'
              )}
              onClick={handleAbsent}
              disabled={!isEditable || recordDayMutation.isPending}
            >
              <X className="h-5 w-5 mb-1" />
              <span className="text-xs font-semibold">Absent</span>
            </Button>
          </div>
        )}

        {/* Helper Text */}
        {!isEditable && (
          <div className="mt-2 text-xs text-center text-muted-foreground">
            {isApproved && 'Approuvé par votre responsable'}
            {isPending && 'En attente d\'approbation'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
