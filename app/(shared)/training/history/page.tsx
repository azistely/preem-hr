/**
 * Training History Page
 *
 * Shows complete training history for the current user:
 * - Completed courses
 * - Attendance records
 * - Certificates earned
 * - Filter by year, status, category
 *
 * HCI Principles:
 * - Clean timeline view of completed training
 * - Filterable and searchable
 * - Export capability
 */

'use client';

import { useState, useMemo } from 'react';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import Link from 'next/link';
import {
  GraduationCap,
  Calendar,
  Clock,
  Award,
  CheckCircle,
  XCircle,
  Search,
  Download,
  ChevronLeft,
  BookOpen,
  User,
  Building,
  Trophy,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Status configurations
const completionStatusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  completed: { label: 'Terminé', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-4 w-4" /> },
  passed: { label: 'Réussi', color: 'bg-green-100 text-green-800', icon: <Trophy className="h-4 w-4" /> },
  failed: { label: 'Échoué', color: 'bg-red-100 text-red-800', icon: <XCircle className="h-4 w-4" /> },
  attended: { label: 'Participé', color: 'bg-blue-100 text-blue-800', icon: <User className="h-4 w-4" /> },
  no_show: { label: 'Absent', color: 'bg-gray-100 text-gray-800', icon: <AlertTriangle className="h-4 w-4" /> },
  cancelled: { label: 'Annulé', color: 'bg-slate-100 text-slate-800', icon: <XCircle className="h-4 w-4" /> },
  pending: { label: 'En attente', color: 'bg-amber-100 text-amber-800', icon: <Clock className="h-4 w-4" /> },
};

// Modality labels
const modalityLabels: Record<string, string> = {
  in_person: 'Présentiel',
  virtual: 'En ligne',
  e_learning: 'E-learning',
  blended: 'Mixte',
  on_the_job: 'Sur le terrain',
};

// Year options for filter
const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

export default function TrainingHistoryPage() {
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch completed enrollments
  const { data: enrollmentsData, isLoading: enrollmentsLoading } = api.training.enrollments.list.useQuery({
    limit: 100,
  });

  // Fetch certifications
  const { data: certificationsData, isLoading: certificationsLoading } = api.training.certifications.list.useQuery({
    limit: 100,
  });

  const allEnrollments = enrollmentsData?.data ?? [];
  const certifications = certificationsData?.data ?? [];

  // Filter enrollments to show completed/attended/no_show (historical)
  const historicalEnrollments = useMemo(() => {
    return allEnrollments.filter(e =>
      ['completed', 'attended', 'no_show', 'cancelled'].includes(e.status)
    );
  }, [allEnrollments]);

  // Apply filters
  const filteredEnrollments = useMemo(() => {
    let result = historicalEnrollments;

    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(e =>
        e.course?.name?.toLowerCase().includes(searchLower) ||
        e.employee?.firstName?.toLowerCase().includes(searchLower) ||
        e.employee?.lastName?.toLowerCase().includes(searchLower)
      );
    }

    if (yearFilter !== 'all') {
      const year = parseInt(yearFilter);
      result = result.filter(e => {
        if (e.completedAt) {
          return new Date(e.completedAt).getFullYear() === year;
        }
        if (e.session?.startDate) {
          return new Date(e.session.startDate).getFullYear() === year;
        }
        return false;
      });
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'passed' || statusFilter === 'failed') {
        result = result.filter(e => e.completionStatus === statusFilter);
      } else {
        result = result.filter(e => e.status === statusFilter);
      }
    }

    return result;
  }, [historicalEnrollments, search, yearFilter, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const completed = historicalEnrollments.filter(e => e.status === 'completed').length;
    const passed = historicalEnrollments.filter(e => e.completionStatus === 'passed').length;
    const totalHours = historicalEnrollments.reduce((acc, e) => acc + (e.attendancePercentage ?? 100), 0);
    const avgHours = historicalEnrollments.length > 0 ? Math.round(totalHours / historicalEnrollments.length) : 0;

    return {
      total: historicalEnrollments.length,
      completed,
      passed,
      certificates: certifications.length,
      avgAttendance: avgHours,
    };
  }, [historicalEnrollments, certifications]);

  const isLoading = enrollmentsLoading || certificationsLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/training">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Historique de formation</h1>
          <p className="text-muted-foreground">
            Votre parcours de formation et certifications obtenues
          </p>
        </div>
        <Button variant="outline" disabled>
          <Download className="mr-2 h-4 w-4" />
          Exporter
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Formations suivies</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.total}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Formations terminées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Réussites</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.passed}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Formations validées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Certifications</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.certificates}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Certifications obtenues
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assiduité moyenne</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.avgAttendance}%</div>
            )}
            <p className="text-xs text-muted-foreground">
              Taux de présence
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Trainings vs Certifications */}
      <Tabs defaultValue="trainings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trainings" className="gap-2">
            <GraduationCap className="h-4 w-4" />
            Formations ({stats.total})
          </TabsTrigger>
          <TabsTrigger value="certifications" className="gap-2">
            <Award className="h-4 w-4" />
            Certifications ({stats.certificates})
          </TabsTrigger>
        </TabsList>

        {/* Trainings Tab */}
        <TabsContent value="trainings" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher une formation..."
                    className="min-h-[48px] pl-10"
                  />
                </div>

                <Select value={yearFilter} onValueChange={setYearFilter}>
                  <SelectTrigger className="min-h-[48px] w-full sm:w-[150px]">
                    <SelectValue placeholder="Année" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les années</SelectItem>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="min-h-[48px] w-full sm:w-[180px]">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="completed">Terminé</SelectItem>
                    <SelectItem value="passed">Réussi</SelectItem>
                    <SelectItem value="failed">Échoué</SelectItem>
                    <SelectItem value="attended">Participé</SelectItem>
                    <SelectItem value="no_show">Absent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Training History Table */}
          <Card>
            <CardHeader>
              <CardTitle>Historique des formations</CardTitle>
              <CardDescription>
                {filteredEnrollments.length} formation{filteredEnrollments.length !== 1 ? 's' : ''} trouvée{filteredEnrollments.length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredEnrollments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <GraduationCap className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Aucune formation trouvée</h3>
                  <p className="text-muted-foreground max-w-sm">
                    {search || yearFilter !== 'all' || statusFilter !== 'all'
                      ? 'Essayez de modifier vos filtres de recherche'
                      : 'Votre historique de formation apparaîtra ici une fois que vous aurez terminé des formations'}
                  </p>
                  <Button variant="link" asChild className="mt-4">
                    <Link href="/training/catalog">Découvrir le catalogue</Link>
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Formation</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Modalité</TableHead>
                        <TableHead>Assiduité</TableHead>
                        <TableHead>Résultat</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEnrollments.map((enrollment) => {
                        const statusConfig = completionStatusConfig[enrollment.completionStatus ?? enrollment.status] ||
                          completionStatusConfig[enrollment.status] ||
                          { label: enrollment.status, color: 'bg-slate-100 text-slate-800', icon: null };

                        return (
                          <TableRow key={enrollment.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                  <BookOpen className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <div className="font-medium">
                                    {enrollment.course?.name ?? `Session #${enrollment.sessionId?.slice(0, 8)}`}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {enrollment.session?.startDate &&
                                      format(new Date(enrollment.session.startDate), 'MMMM yyyy', { locale: fr })}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {enrollment.completedAt ? (
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span>{format(new Date(enrollment.completedAt), 'dd/MM/yyyy', { locale: fr })}</span>
                                </div>
                              ) : enrollment.session?.endDate ? (
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span>{format(new Date(enrollment.session.endDate), 'dd/MM/yyyy', { locale: fr })}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Building className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">Présentiel</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {enrollment.attendancePercentage !== null && enrollment.attendancePercentage !== undefined ? (
                                <Badge variant={enrollment.attendancePercentage >= 80 ? 'default' : 'secondary'}>
                                  {enrollment.attendancePercentage}%
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={`gap-1 ${statusConfig.color}`}>
                                {statusConfig.icon}
                                {statusConfig.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {enrollment.completionScore ? (
                                <span className="font-medium">{enrollment.completionScore}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Certifications Tab */}
        <TabsContent value="certifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Certifications obtenues</CardTitle>
              <CardDescription>
                Toutes vos certifications et qualifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              {certificationsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : certifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Award className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Aucune certification</h3>
                  <p className="text-muted-foreground max-w-sm">
                    Vos certifications obtenues apparaîtront ici
                  </p>
                  <Button variant="link" asChild className="mt-4">
                    <Link href="/training/catalog">Découvrir les formations certifiantes</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {certifications.map((cert) => {
                    const isExpired = cert.expiryDate && new Date(cert.expiryDate) < new Date();
                    const isExpiringSoon = cert.expiryDate &&
                      !isExpired &&
                      new Date(cert.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                    return (
                      <Card
                        key={cert.id}
                        className={`
                          ${isExpired ? 'border-red-200 bg-red-50' : ''}
                          ${isExpiringSoon ? 'border-amber-200 bg-amber-50' : ''}
                        `}
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-start gap-4">
                            <div className={`
                              flex h-12 w-12 items-center justify-center rounded-full
                              ${isExpired ? 'bg-red-100' : isExpiringSoon ? 'bg-amber-100' : 'bg-green-100'}
                            `}>
                              <Award className={`h-6 w-6 ${
                                isExpired ? 'text-red-600' : isExpiringSoon ? 'text-amber-600' : 'text-green-600'
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold truncate">{cert.certificationName}</h4>
                              {cert.issuingOrganization && (
                                <p className="text-sm text-muted-foreground truncate">
                                  {cert.issuingOrganization}
                                </p>
                              )}
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {cert.issueDate && (
                                  <Badge variant="outline" className="text-xs">
                                    <Calendar className="mr-1 h-3 w-3" />
                                    {format(new Date(cert.issueDate), 'MMM yyyy', { locale: fr })}
                                  </Badge>
                                )}
                                {cert.expiryDate && (
                                  <Badge
                                    variant={isExpired ? 'destructive' : isExpiringSoon ? 'default' : 'secondary'}
                                    className="text-xs"
                                  >
                                    {isExpired ? 'Expiré' :
                                     isExpiringSoon ? 'Expire bientôt' :
                                     `Valide jusqu'au ${format(new Date(cert.expiryDate), 'MMM yyyy', { locale: fr })}`}
                                  </Badge>
                                )}
                                {cert.isLifetime && (
                                  <Badge variant="secondary" className="text-xs">
                                    <CheckCircle className="mr-1 h-3 w-3" />
                                    Permanent
                                  </Badge>
                                )}
                              </div>
                              {cert.credentialId && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  ID: {cert.credentialId}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
