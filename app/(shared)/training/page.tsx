/**
 * Training Dashboard
 *
 * Main dashboard for training and competencies module.
 * Shows:
 * - Training calendar (upcoming sessions)
 * - My enrollments
 * - Certification status (expiring soon)
 * - Training requests status
 * - Quick actions
 *
 * Adapts based on user role:
 * - Employee: My trainings, my certifications
 * - Manager: Team trainings, approve requests
 * - HR: All trainings, manage catalog, plans
 */

'use client';

import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import {
  GraduationCap,
  Calendar,
  Clock,
  Award,
  BookOpen,
  Users,
  FileText,
  Plus,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Send,
  Building,
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

// Status colors for enrollments
const enrollmentStatusColors: Record<string, string> = {
  enrolled: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-green-100 text-green-800',
  in_progress: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-gray-100 text-gray-800',
};

const enrollmentStatusLabels: Record<string, string> = {
  enrolled: 'Inscrit',
  confirmed: 'Confirmé',
  in_progress: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé',
  no_show: 'Absent',
};

// Request status colors
const requestStatusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-800',
  submitted: 'bg-blue-100 text-blue-800',
  manager_approved: 'bg-amber-100 text-amber-800',
  hr_approved: 'bg-purple-100 text-purple-800',
  scheduled: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const requestStatusLabels: Record<string, string> = {
  draft: 'Brouillon',
  submitted: 'Soumise',
  manager_approved: 'Approuvée (Manager)',
  hr_approved: 'Approuvée (RH)',
  scheduled: 'Planifiée',
  completed: 'Terminée',
  rejected: 'Refusée',
  cancelled: 'Annulée',
};

// Modality icons
const modalityIcons: Record<string, React.ReactNode> = {
  in_person: <Building className="h-4 w-4" />,
  online: <BookOpen className="h-4 w-4" />,
  hybrid: <Users className="h-4 w-4" />,
  self_paced: <Clock className="h-4 w-4" />,
};

const modalityLabels: Record<string, string> = {
  in_person: 'Présentiel',
  online: 'En ligne',
  hybrid: 'Hybride',
  self_paced: 'Auto-formation',
};

export default function TrainingDashboard() {
  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = api.training.dashboard.stats.useQuery();

  // Fetch upcoming sessions from dashboard
  const { data: upcomingSessions, isLoading: sessionsLoading } = api.training.dashboard.upcomingSessions.useQuery({
    limit: 5,
  });

  // Fetch my enrollments (use list with current employee filter)
  const { data: enrollmentsData, isLoading: enrollmentsLoading } = api.training.enrollments.list.useQuery({
    limit: 5,
  });
  const myEnrollments = enrollmentsData?.data ?? [];

  // Fetch my training requests (use list)
  const { data: requestsData, isLoading: requestsLoading } = api.training.requests.list.useQuery({
    limit: 5,
  });
  const myRequests = requestsData?.data ?? [];

  // Fetch expiring certifications
  const { data: certificationsData, isLoading: certsLoading } = api.training.certifications.getExpiringSoon.useQuery({
    days: 90,
  });
  const certifications = certificationsData ?? [];

  const isLoading = statsLoading || sessionsLoading || enrollmentsLoading || requestsLoading || certsLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Formation & Développement</h1>
          <p className="text-muted-foreground">
            Formations, certifications et développement des compétences
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/training/catalog">
              <BookOpen className="mr-2 h-4 w-4" />
              Catalogue
            </Link>
          </Button>
          <Button asChild>
            <Link href="/training/requests/new">
              <Plus className="mr-2 h-4 w-4" />
              Demande de formation
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Formations à venir</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.upcomingSessions ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Sessions planifiées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mes inscriptions</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{myEnrollments.length ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Formations en cours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Certifications</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.expiringCertifications ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Certifications valides
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Demandes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.pendingRequests ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              En attente d&apos;approbation
            </p>
          </CardContent>
        </Card>
      </div>

      {/* eslint-disable @typescript-eslint/no-explicit-any */}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Sessions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Prochaines sessions</CardTitle>
              <CardDescription>Sessions de formation à venir</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/training/sessions">
                Voir tout
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : upcomingSessions && upcomingSessions.length > 0 ? (
              <div className="space-y-4">
                {upcomingSessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/training/sessions/${session.id}`}
                    className="block rounded-lg border p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="font-medium">{session.sessionCode}</div>
                        <div className="text-sm text-muted-foreground">
                          {session.instructorName && (
                            <span>Formateur: {session.instructorName}</span>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className="gap-1">
                        {modalityIcons[session.course?.modality || 'in_person']}
                        {modalityLabels[session.course?.modality || 'in_person']}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                      {session.startDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{format(new Date(session.startDate), 'dd MMM yyyy', { locale: fr })}</span>
                        </div>
                      )}
                      {session.location && (
                        <div className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          <span>{session.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span>{session.enrollmentCount ?? 0}/{session.maxParticipants ?? '∞'}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Aucune session à venir</p>
                <Button variant="link" asChild className="mt-2">
                  <Link href="/training/catalog">Parcourir le catalogue</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Enrollments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Mes formations</CardTitle>
              <CardDescription>Formations auxquelles vous êtes inscrit</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/training/history">
                Historique
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {enrollmentsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : myEnrollments && myEnrollments.length > 0 ? (
              <div className="space-y-3">
                {myEnrollments.map((enrollment) => (
                  <div
                    key={enrollment.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <GraduationCap className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">Session #{enrollment.sessionId?.slice(0, 8)}</div>
                        <div className="text-sm text-muted-foreground">
                          {enrollment.createdAt && format(new Date(enrollment.createdAt), 'dd MMM yyyy', { locale: fr })}
                        </div>
                      </div>
                    </div>
                    <Badge className={enrollmentStatusColors[enrollment.status] || 'bg-slate-100'}>
                      {enrollmentStatusLabels[enrollment.status] || enrollment.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <GraduationCap className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Aucune inscription active</p>
                <Button variant="link" asChild className="mt-2">
                  <Link href="/training/catalog">Découvrir les formations</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Training Requests */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Mes demandes</CardTitle>
              <CardDescription>Statut de vos demandes de formation</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/training/requests">
                Voir tout
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {requestsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : myRequests && myRequests.length > 0 ? (
              <div className="space-y-3">
                {myRequests.map((request) => (
                  <Link
                    key={request.id}
                    href={`/training/requests/${request.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        request.status === 'scheduled' || request.status === 'completed' ? 'bg-green-100' :
                        request.status === 'rejected' ? 'bg-red-100' : 'bg-blue-100'
                      }`}>
                        {request.status === 'scheduled' || request.status === 'completed' ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : request.status === 'rejected' ? (
                          <AlertTriangle className="h-5 w-5 text-red-600" />
                        ) : (
                          <Send className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium">
                          {request.customCourseName || 'Formation demandée'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {request.createdAt && formatDistanceToNow(new Date(request.createdAt), { addSuffix: true, locale: fr })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={requestStatusColors[request.status] || 'bg-slate-100'}>
                        {requestStatusLabels[request.status] || request.status}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Aucune demande en cours</p>
                <Button variant="link" asChild className="mt-2">
                  <Link href="/training/requests/new">Faire une demande</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Certifications */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Certifications</CardTitle>
              <CardDescription>À renouveler prochainement</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/training/certifications">
                Voir tout
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {certsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : certifications && certifications.length > 0 ? (
              <div className="space-y-3">
                {certifications.map((cert) => {
                  const daysUntilExpiry = cert.expiryDate
                    ? differenceInDays(new Date(cert.expiryDate), new Date())
                    : null;
                  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 30;
                  const isExpired = daysUntilExpiry !== null && daysUntilExpiry < 0;

                  return (
                    <div
                      key={cert.id}
                      className={`rounded-lg border p-3 ${isExpired ? 'border-red-200 bg-red-50' : isExpiringSoon ? 'border-amber-200 bg-amber-50' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                            isExpired ? 'bg-red-100' : isExpiringSoon ? 'bg-amber-100' : 'bg-green-100'
                          }`}>
                            <Award className={`h-5 w-5 ${
                              isExpired ? 'text-red-600' : isExpiringSoon ? 'text-amber-600' : 'text-green-600'
                            }`} />
                          </div>
                          <div>
                            <div className="font-medium">{cert.certificationName}</div>
                            <div className="text-sm text-muted-foreground">
                              {cert.issuingOrganization && `Délivré par ${cert.issuingOrganization}`}
                            </div>
                          </div>
                        </div>
                        {cert.expiryDate && (
                          <Badge variant={isExpired ? 'destructive' : isExpiringSoon ? 'default' : 'outline'}>
                            {isExpired ? 'Expiré' :
                             daysUntilExpiry !== null && daysUntilExpiry <= 30 ? `${daysUntilExpiry}j restants` :
                             format(new Date(cert.expiryDate), 'dd MMM yyyy', { locale: fr })}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Award className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Aucune certification à renouveler</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Vos certifications valides apparaîtront ici
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions rapides</CardTitle>
          <CardDescription>Gérer vos formations et compétences</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
              <Link href="/training/requests/new">
                <Plus className="h-5 w-5" />
                <span>Demander une formation</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
              <Link href="/training/catalog">
                <BookOpen className="h-5 w-5" />
                <span>Parcourir le catalogue</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
              <Link href="/training/certifications">
                <Award className="h-5 w-5" />
                <span>Mes certifications</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
              <Link href="/training/history">
                <GraduationCap className="h-5 w-5" />
                <span>Historique formations</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
