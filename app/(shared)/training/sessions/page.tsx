/**
 * Training Sessions Page
 *
 * View and manage scheduled training sessions.
 * - Calendar view of upcoming sessions
 * - Filter by status, course, date range
 * - Session enrollment management
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { format, isBefore, isAfter, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Video,
  GraduationCap,
  ChevronRight,
  ChevronLeft,
  Monitor,
  Briefcase,
  BookOpen,
} from 'lucide-react';

// Status styling
const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  in_progress: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const statusLabels: Record<string, string> = {
  scheduled: 'Planifiée',
  in_progress: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée',
};

const modalityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  in_person: Briefcase,
  virtual: Video,
  e_learning: Monitor,
  blended: BookOpen,
  on_the_job: Users,
};

const modalityLabels: Record<string, string> = {
  in_person: 'Présentiel',
  virtual: 'Virtuel',
  e_learning: 'E-learning',
  blended: 'Mixte',
  on_the_job: 'Sur le terrain',
};

// Session card component
function SessionCard({
  session,
}: {
  session: {
    id: string;
    sessionCode: string;
    name: string | null;
    startDate: string;
    endDate: string;
    startTime: string | null;
    endTime: string | null;
    location: string | null;
    isVirtual: boolean;
    instructorName: string | null;
    maxParticipants: number | null;
    status: string;
    enrollmentCount: number;
    course?: {
      id: string;
      code: string;
      name: string;
      modality: string;
    } | null;
  };
}) {
  const modality = session.course?.modality || 'in_person';
  const ModalityIcon = modalityIcons[modality] || GraduationCap;

  const isUpcoming = isAfter(new Date(session.startDate), new Date());
  const isFull = session.maxParticipants && session.enrollmentCount >= session.maxParticipants;

  return (
    <Link href={`/training/sessions/${session.id}`}>
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-lg flex-shrink-0">
              <ModalityIcon className="h-6 w-6 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <h3 className="font-medium truncate">
                    {session.name || session.course?.name || 'Session'}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {session.course?.code} • {session.sessionCode}
                  </p>
                </div>
                <Badge className={statusColors[session.status]}>
                  {statusLabels[session.status]}
                </Badge>
              </div>

              {/* Date and time */}
              <div className="space-y-1 text-sm text-muted-foreground mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {format(new Date(session.startDate), 'dd MMM yyyy', { locale: fr })}
                    {session.endDate !== session.startDate && (
                      <> au {format(new Date(session.endDate), 'dd MMM yyyy', { locale: fr })}</>
                    )}
                  </span>
                </div>

                {(session.startTime || session.endTime) && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {session.startTime && format(new Date(`2000-01-01T${session.startTime}`), 'HH:mm')}
                      {session.endTime && ` - ${format(new Date(`2000-01-01T${session.endTime}`), 'HH:mm')}`}
                    </span>
                  </div>
                )}

                {session.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="truncate">{session.location}</span>
                  </div>
                )}

                {session.isVirtual && (
                  <div className="flex items-center gap-2">
                    <Video className="h-3.5 w-3.5" />
                    <span>Session virtuelle</span>
                  </div>
                )}

                {session.instructorName && (
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-3.5 w-3.5" />
                    <span className="truncate">{session.instructorName}</span>
                  </div>
                )}
              </div>

              {/* Enrollment info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4" />
                  <span>
                    {session.enrollmentCount}
                    {session.maxParticipants && ` / ${session.maxParticipants}`}
                    {' participants'}
                  </span>
                </div>

                {isFull && isUpcoming && session.status === 'scheduled' && (
                  <Badge variant="secondary" className="text-xs">
                    Complet
                  </Badge>
                )}
              </div>
            </div>

            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 self-center" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function SessionsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Date range for current month view
  const dateFrom = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const dateTo = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  // Fetch sessions
  const { data: sessionsData, isLoading } = api.training.sessions.list.useQuery({
    status: statusFilter !== 'all'
      ? statusFilter as 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
      : undefined,
    dateFrom,
    dateTo,
    limit: 100,
  });

  // Fetch dashboard stats
  const { data: dashboardStats } = api.training.dashboard.stats.useQuery();

  const sessions = sessionsData?.data ?? [];

  // Group sessions by week
  const sessionsByDate = sessions.reduce((acc, session) => {
    const dateKey = session.startDate;
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(session);
    return acc;
  }, {} as Record<string, typeof sessions>);

  const sortedDates = Object.keys(sessionsByDate).sort();

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth((prev) => addMonths(prev, direction === 'next' ? 1 : -1));
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Sessions de formation</h1>
          <p className="text-muted-foreground mt-1">
            Calendrier et gestion des sessions
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ce mois</p>
                <p className="text-2xl font-bold">{sessions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Planifiées</p>
                <p className="text-2xl font-bold">
                  {sessions.filter((s) => s.status === 'scheduled').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inscrits</p>
                <p className="text-2xl font-bold">
                  {sessions.reduce((acc, s) => acc + s.enrollmentCount, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <GraduationCap className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Terminées</p>
                <p className="text-2xl font-bold">
                  {sessions.filter((s) => s.status === 'completed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Month navigation */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="w-[180px] text-center font-medium">
                {format(currentMonth, 'MMMM yyyy', { locale: fr })}
              </div>
              <Button variant="outline" size="icon" onClick={() => navigateMonth('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px] min-h-[48px]">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="scheduled">Planifiée</SelectItem>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="completed">Terminée</SelectItem>
                <SelectItem value="cancelled">Annulée</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => setCurrentMonth(new Date())}
              className="min-h-[48px]"
            >
              Aujourd'hui
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sessions list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Aucune session</h3>
            <p className="text-muted-foreground mb-6">
              Aucune session de formation prévue pour {format(currentMonth, 'MMMM yyyy', { locale: fr })}
            </p>
            <Button variant="outline" onClick={() => navigateMonth('next')}>
              Voir le mois suivant
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 sticky top-0 bg-background py-2">
                {format(new Date(date), 'EEEE dd MMMM yyyy', { locale: fr })}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sessionsByDate[date].map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
