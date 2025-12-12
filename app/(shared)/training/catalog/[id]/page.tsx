/**
 * Course Detail Page
 *
 * Shows detailed information about a training course.
 * - Course description and metadata
 * - Upcoming sessions
 * - Request training button
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Calendar,
  MapPin,
  Users,
  Monitor,
  Building,
  Award,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  FileText,
} from 'lucide-react';

// Modality config
const modalityConfig: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  in_person: { icon: Building, label: 'Présentiel' },
  virtual: { icon: Monitor, label: 'En ligne' },
  e_learning: { icon: Monitor, label: 'E-learning' },
  blended: { icon: Monitor, label: 'Mixte' },
  on_the_job: { icon: Users, label: 'Sur le terrain' },
};

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  // Fetch course details
  const { data: course, isLoading } = api.training.courses.getById.useQuery(
    { id: courseId },
    { enabled: !!courseId }
  );

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="container max-w-4xl mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Formation non trouvée</h3>
            <p className="text-muted-foreground mb-6">
              Cette formation n'existe pas ou n'est plus disponible.
            </p>
            <Button onClick={() => router.push('/training/catalog')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour au catalogue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ModalityIcon = modalityConfig[course.modality]?.icon || Monitor;
  const modalityLabel = modalityConfig[course.modality]?.label || course.modality;

  return (
    <div className="container max-w-4xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/training/catalog')}
          className="-ml-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour au catalogue
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">{course.name}</h1>
              {course.isMandatory && (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Obligatoire
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">{course.code}</p>
          </div>

          <Button
            onClick={() => router.push(`/training/requests/new?courseId=${course.id}`)}
            className="min-h-[48px]"
          >
            <FileText className="mr-2 h-4 w-4" />
            Demander cette formation
          </Button>
        </div>
      </div>

      {/* Quick Info */}
      <div className="flex flex-wrap gap-3">
        <Badge variant="outline" className="text-sm py-1.5 px-3">
          <Clock className="h-4 w-4 mr-2" />
          {course.durationHours} heures
        </Badge>
        <Badge variant="outline" className="text-sm py-1.5 px-3">
          <ModalityIcon className="h-4 w-4 mr-2" />
          {modalityLabel}
        </Badge>
        <Badge variant="secondary" className="text-sm py-1.5 px-3">
          {course.category}
        </Badge>
        {course.grantsCertification && (
          <Badge variant="outline" className="text-sm py-1.5 px-3">
            <Award className="h-4 w-4 mr-2" />
            Certifiante
          </Badge>
        )}
        {course.isExternal && (
          <Badge variant="outline" className="text-sm py-1.5 px-3">
            <ExternalLink className="h-4 w-4 mr-2" />
            Formation externe
          </Badge>
        )}
      </div>

      {/* Description */}
      {(course.description || course.shortDescription) && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">
              {course.description || course.shortDescription}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Details Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Provider */}
        {course.provider && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Building className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Prestataire</p>
                  <p className="font-medium">{course.provider}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cost */}
        {course.costPerParticipant && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Award className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Coût par participant</p>
                  <p className="font-medium">
                    {parseInt(course.costPerParticipant).toLocaleString('fr-FR')}{' '}
                    {course.currency}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Certification */}
        {course.grantsCertification && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Award className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Certification</p>
                  <p className="font-medium">
                    {course.certificationValidityMonths
                      ? `Valide ${course.certificationValidityMonths} mois`
                      : 'Incluse'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mandatory Recurrence */}
        {course.isMandatory && course.mandatoryRecurrenceMonths && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Récurrence</p>
                  <p className="font-medium">
                    Tous les {course.mandatoryRecurrenceMonths} mois
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Upcoming Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Sessions à venir</CardTitle>
          <CardDescription>
            Sessions planifiées pour cette formation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {course.upcomingSessions && course.upcomingSessions.length > 0 ? (
            <div className="space-y-3">
              {course.upcomingSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {format(new Date(session.startDate), 'EEEE d MMMM yyyy', {
                          locale: fr,
                        })}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {session.startTime && (
                          <>
                            <Clock className="h-3 w-3" />
                            <span>{session.startTime}</span>
                          </>
                        )}
                        {session.location && (
                          <>
                            <span>•</span>
                            <MapPin className="h-3 w-3" />
                            <span>{session.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {session.maxParticipants && (
                    <Badge variant="outline">
                      <Users className="h-3 w-3 mr-1" />
                      Max {session.maxParticipants}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Aucune session planifiée pour le moment</p>
              <p className="text-sm mt-1">
                Faites une demande pour être notifié des prochaines sessions
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CTA */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">Intéressé par cette formation?</h3>
              <p className="text-sm text-muted-foreground">
                Soumettez une demande pour être inscrit à une prochaine session
              </p>
            </div>
            <Button
              onClick={() => router.push(`/training/requests/new?courseId=${course.id}`)}
              className="min-h-[48px]"
            >
              <FileText className="mr-2 h-4 w-4" />
              Demander cette formation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
