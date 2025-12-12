/**
 * Training Session Detail Page
 *
 * View session details and manage enrollments.
 * - Session info (course, dates, location, instructor)
 * - Enrolled participants list
 * - Enrollment management
 */

'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Video,
  Users,
  GraduationCap,
  Mail,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';

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

// Enrollment status
const enrollmentStatusColors: Record<string, string> = {
  enrolled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  attended: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  no_show: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  cancelled: 'bg-muted text-muted-foreground',
};

const enrollmentStatusLabels: Record<string, string> = {
  enrolled: 'Inscrit',
  attended: 'Présent',
  completed: 'Terminé',
  no_show: 'Absent',
  cancelled: 'Annulé',
};

const completionStatusLabels: Record<string, string> = {
  not_started: 'Non commencé',
  in_progress: 'En cours',
  completed: 'Terminé',
  failed: 'Échoué',
};

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const utils = api.useUtils();

  // Fetch session details
  const { data: session, isLoading, error } = api.training.sessions.getById.useQuery({
    id: sessionId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h3 className="text-lg font-medium mb-2">Session non trouvée</h3>
            <p className="text-muted-foreground mb-6">
              Cette session n'existe pas ou vous n'avez pas accès.
            </p>
            <Button onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const enrollments = session.enrollments ?? [];
  const isFull = session.maxParticipants && enrollments.length >= session.maxParticipants;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">
              {session.name || session.course?.name || 'Session'}
            </h1>
            <Badge className={statusColors[session.status]}>
              {statusLabels[session.status]}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {session.course?.code} • {session.sessionCode}
          </p>
        </div>
      </div>

      {/* Session details */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informations de la session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Course link */}
            {session.course && (
              <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                <BookOpen className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Formation</p>
                  <Link
                    href={`/training/catalog/${session.course.id}`}
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {session.course.name}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="flex items-start gap-4">
              <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Dates</p>
                <p className="text-muted-foreground">
                  {format(new Date(session.startDate), 'EEEE dd MMMM yyyy', { locale: fr })}
                  {session.endDate !== session.startDate && (
                    <>
                      {' au '}
                      {format(new Date(session.endDate), 'EEEE dd MMMM yyyy', { locale: fr })}
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Time */}
            {(session.startTime || session.endTime) && (
              <div className="flex items-start gap-4">
                <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Horaires</p>
                  <p className="text-muted-foreground">
                    {session.startTime && format(new Date(`2000-01-01T${session.startTime}`), 'HH:mm')}
                    {session.endTime && ` - ${format(new Date(`2000-01-01T${session.endTime}`), 'HH:mm')}`}
                  </p>
                </div>
              </div>
            )}

            {/* Location */}
            {session.location && (
              <div className="flex items-start gap-4">
                <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Lieu</p>
                  <p className="text-muted-foreground">{session.location}</p>
                </div>
              </div>
            )}

            {/* Virtual meeting */}
            {session.isVirtual && (
              <div className="flex items-start gap-4">
                <Video className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Session virtuelle</p>
                  {session.virtualMeetingUrl ? (
                    <a
                      href={session.virtualMeetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Rejoindre la réunion
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <p className="text-muted-foreground">Lien non disponible</p>
                  )}
                </div>
              </div>
            )}

            {/* Instructor */}
            {session.instructorName && (
              <div className="flex items-start gap-4">
                <GraduationCap className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Formateur</p>
                  <p className="text-muted-foreground">{session.instructorName}</p>
                  {session.instructorEmail && (
                    <a
                      href={`mailto:${session.instructorEmail}`}
                      className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <Mail className="h-3 w-3" />
                      {session.instructorEmail}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {session.notes && (
              <>
                <Separator />
                <div>
                  <p className="font-medium mb-2">Notes</p>
                  <p className="text-muted-foreground whitespace-pre-wrap">{session.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Capacity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Participants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {enrollments.length}
                    {session.maxParticipants && ` / ${session.maxParticipants}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isFull ? 'Session complète' : 'Places disponibles'}
                  </p>
                </div>
              </div>

              {session.minParticipants && session.minParticipants > 1 && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Minimum requis: {session.minParticipants} participants
                    {enrollments.length < (session.minParticipants ?? 0) && (
                      <Badge variant="destructive" className="ml-2">
                        {(session.minParticipants ?? 0) - enrollments.length} manquants
                      </Badge>
                    )}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Registration deadline */}
          {session.registrationDeadline && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Date limite d'inscription</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-medium">
                  {format(new Date(session.registrationDeadline), 'dd MMMM yyyy', { locale: fr })}
                </p>
                {new Date(session.registrationDeadline) < new Date() && (
                  <Badge variant="secondary" className="mt-2">
                    Inscriptions closes
                  </Badge>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Enrollments table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des participants ({enrollments.length})</CardTitle>
          <CardDescription>
            Employés inscrits à cette session
          </CardDescription>
        </CardHeader>
        <CardContent>
          {enrollments.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Aucun participant inscrit</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employé</TableHead>
                    <TableHead>Matricule</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Progression</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrollments.map((enrollment) => (
                    <TableRow key={enrollment.id}>
                      <TableCell className="font-medium">
                        {enrollment.employee?.firstName} {enrollment.employee?.lastName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {enrollment.employee?.employeeNumber}
                      </TableCell>
                      <TableCell>
                        <Badge className={enrollmentStatusColors[enrollment.status || 'enrolled']}>
                          {enrollmentStatusLabels[enrollment.status || 'enrolled']}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {completionStatusLabels[enrollment.completionStatus || 'not_started']}
                        </span>
                      </TableCell>
                      <TableCell>
                        {enrollment.completionScore !== null && enrollment.completionScore !== undefined ? (
                          <span className="font-medium">
                            {parseFloat(enrollment.completionScore).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
