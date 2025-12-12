/**
 * Training Requests List Page
 *
 * Shows training requests:
 * - Employees see their own requests
 * - Managers see requests to approve
 * - HR sees all requests
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Plus,
  FileText,
  Users,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Inbox,
} from 'lucide-react';

// Status badge styling
const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  manager_approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  hr_approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  scheduled: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  cancelled: 'bg-muted text-muted-foreground',
};

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  submitted: 'En attente',
  manager_approved: 'Approuvé manager',
  hr_approved: 'Approuvé RH',
  scheduled: 'Planifié',
  rejected: 'Rejeté',
  cancelled: 'Annulé',
};

const urgencyLabels: Record<string, string> = {
  low: 'Faible',
  normal: 'Normal',
  high: 'Élevé',
  urgent: 'Urgent',
};

const urgencyColors: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  normal: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  high: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export default function TrainingRequestsPage() {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState('my');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch my requests
  const { data: myRequestsData, isLoading: myRequestsLoading } =
    api.training.requests.list.useQuery({
      myRequests: true,
      status:
        statusFilter !== 'all'
          ? (statusFilter as
              | 'draft'
              | 'submitted'
              | 'manager_approved'
              | 'hr_approved'
              | 'scheduled'
              | 'rejected'
              | 'cancelled')
          : undefined,
      limit: 50,
    });

  // Fetch all requests (for HR/managers)
  const { data: allRequestsData, isLoading: allRequestsLoading } =
    api.training.requests.list.useQuery({
      status:
        statusFilter !== 'all'
          ? (statusFilter as
              | 'draft'
              | 'submitted'
              | 'manager_approved'
              | 'hr_approved'
              | 'scheduled'
              | 'rejected'
              | 'cancelled')
          : undefined,
      limit: 50,
    });

  const myRequests = myRequestsData?.data ?? [];
  const allRequests = allRequestsData?.data ?? [];

  // Count pending requests that need action
  const pendingCount = allRequests.filter(
    (r) => r.status === 'submitted' || r.status === 'manager_approved'
  ).length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Demandes de formation</h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos demandes de formation
          </p>
        </div>
        <Button
          onClick={() => router.push('/training/requests/new')}
          className="min-h-[48px]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle demande
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="my" className="min-h-[44px]">
            <FileText className="mr-2 h-4 w-4" />
            Mes demandes
          </TabsTrigger>
          <TabsTrigger value="all" className="min-h-[44px]">
            <Users className="mr-2 h-4 w-4" />
            Toutes les demandes
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Status Filter */}
        <div className="mt-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px] min-h-[48px]">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="submitted">En attente</SelectItem>
              <SelectItem value="manager_approved">Approuvé manager</SelectItem>
              <SelectItem value="hr_approved">Approuvé RH</SelectItem>
              <SelectItem value="scheduled">Planifié</SelectItem>
              <SelectItem value="rejected">Rejeté</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* My Requests Tab */}
        <TabsContent value="my" className="space-y-4 mt-4">
          {myRequestsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : myRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucune demande</h3>
                <p className="text-muted-foreground mb-6">
                  Vous n'avez pas encore fait de demande de formation
                </p>
                <Button onClick={() => router.push('/training/requests/new')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Faire une demande
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {myRequests.map((request) => (
                <Card
                  key={request.id}
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {request.course?.name ?? request.customCourseName}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{request.referenceNumber}</span>
                            <span>•</span>
                            <span>
                              {format(
                                new Date(request.createdAt),
                                'dd MMM yyyy',
                                { locale: fr }
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={urgencyColors[request.urgency]}>
                          <Clock className="h-3 w-3 mr-1" />
                          {urgencyLabels[request.urgency]}
                        </Badge>
                        <Badge className={statusColors[request.status]}>
                          {statusLabels[request.status]}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* All Requests Tab */}
        <TabsContent value="all" className="space-y-4 mt-4">
          {allRequestsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : allRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucune demande</h3>
                <p className="text-muted-foreground">
                  {statusFilter !== 'all'
                    ? 'Essayez de modifier vos filtres'
                    : 'Aucune demande de formation à afficher'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {allRequests.map((request) => (
                <Card
                  key={request.id}
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-muted rounded-lg">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {request.course?.name ?? request.customCourseName}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>
                              {request.employee?.firstName}{' '}
                              {request.employee?.lastName}
                            </span>
                            <span>•</span>
                            <span>{request.referenceNumber}</span>
                            <span>•</span>
                            <span>
                              {format(
                                new Date(request.createdAt),
                                'dd MMM yyyy',
                                { locale: fr }
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={urgencyColors[request.urgency]}>
                          <Clock className="h-3 w-3 mr-1" />
                          {urgencyLabels[request.urgency]}
                        </Badge>
                        <Badge className={statusColors[request.status]}>
                          {statusLabels[request.status]}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination info */}
          {allRequestsData && allRequestsData.total > 0 && (
            <p className="text-sm text-muted-foreground text-center">
              {allRequests.length} sur {allRequestsData.total} demandes
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
