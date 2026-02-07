/**
 * Time-Off Management Page
 *
 * Request and manage time-off (vacation, sick leave, etc.)
 * Following HCI principles: mobile-first, French, progressive disclosure
 */

'use client';

import { useState } from 'react';
import { TimeOffRequestForm } from '@/features/time-off/components/time-off-request-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, CheckCircle, XCircle, Plus } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useCurrentEmployee } from '@/hooks/use-current-employee';
import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CardListSkeleton } from '@/components/skeletons';
import type { TimeOffPolicy, TimeOffBalance, TimeOffRequest } from '@/features/time-off/types/time-off';

export default function TimeOffPage() {
  const [showRequestForm, setShowRequestForm] = useState(false);

  // Get current employee from auth context
  const { employeeId, employee, isLoading: loadingEmployee } = useCurrentEmployee();

  // Fetch balances
  const { data: balances, isLoading: loadingBalances } =
    trpc.timeOff.getAllBalances.useQuery({
      employeeId: employeeId || '',
    }, {
      enabled: !!employeeId,
    });

  // Fetch employee's requests
  const { data: requests, isLoading: loadingRequests } =
    trpc.timeOff.getEmployeeRequests.useQuery({
      employeeId: employeeId || '',
    }, {
      enabled: !!employeeId,
    });

  // Fetch policies
  const { data: policies } = trpc.timeOff.getPolicies.useQuery();

  // Show loading state while fetching employee
  if (loadingEmployee || !employeeId) {
    return (
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const getPolicyName = (policyId: string) => {
    const policy = policies?.find((p) => p.id === policyId);
    return policy?.name || 'Inconnu';
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return 'Date invalide';

    // Handle string dates from database
    const dateObj = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;

    // Check if date is valid
    if (!dateObj || isNaN(dateObj.getTime())) return 'Date invalide';

    return dateObj.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Congés</h1>
          <p className="text-muted-foreground mt-2">
            Gérez vos demandes de congés
          </p>
        </div>

        <Dialog open={showRequestForm} onOpenChange={setShowRequestForm}>
          <DialogTrigger asChild>
            <Button className="min-h-[44px]">
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle demande
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Demander un congé</DialogTitle>
              <DialogDescription>
                Remplissez le formulaire pour soumettre votre demande
              </DialogDescription>
            </DialogHeader>
            <TimeOffRequestForm
              employeeId={employeeId}
              onSuccess={() => setShowRequestForm(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Balances */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        {loadingBalances ? (
          <>
            {Array.from({ length: 3 }, (_, i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-1" />
                  <Skeleton className="h-3 w-28" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : balances && balances.length > 0 ? (
          balances.map((balance) => {
            const policy = balance.timeOffPolicy as unknown as TimeOffPolicy;
            return (
            <Card key={balance.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  {policy?.name || 'Inconnu'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">
                  {Number(balance.balance).toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  jours disponibles
                </p>

                {Number(balance.pending) > 0 && (
                  <p className="text-xs text-orange-600 mt-2">
                    {Number(balance.pending).toFixed(1)} jours en attente
                  </p>
                )}

                {Number(balance.used) > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {Number(balance.used).toFixed(1)} jours utilisés
                  </p>
                )}
              </CardContent>
            </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                Aucun solde de congés disponible
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Mes demandes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending">En attente</TabsTrigger>
              <TabsTrigger value="approved">Approuvées</TabsTrigger>
              <TabsTrigger value="rejected">Rejetées</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4">
              {loadingRequests ? (
                <CardListSkeleton count={2} />
              ) : requests && requests.filter((r) => r.status === 'pending').length > 0 ? (
                <div className="space-y-3">
                  {requests
                    .filter((r) => r.status === 'pending')
                    .map((request) => {
                      const requestPolicy = request.timeOffPolicy as unknown as TimeOffPolicy;
                      return (
                      <div
                        key={request.id}
                        className="flex items-start justify-between p-4 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium">
                            {requestPolicy?.name || 'Inconnu'}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {formatDate(request.startDate)} -{' '}
                            {formatDate(request.endDate)}
                          </p>
                          <p className="text-sm font-semibold mt-2">
                            {Number(request.totalDays)} jour
                            {Number(request.totalDays) > 1 ? 's' : ''}
                          </p>
                          {request.reason && (
                            <p className="text-xs text-muted-foreground mt-2">
                              {request.reason}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary">
                          <Clock className="mr-1 h-3 w-3" />
                          En attente
                        </Badge>
                      </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune demande en attente
                </p>
              )}
            </TabsContent>

            <TabsContent value="approved" className="mt-4">
              {requests && requests.filter((r) => r.status === 'approved').length > 0 ? (
                <div className="space-y-3">
                  {requests
                    .filter((r) => r.status === 'approved')
                    .map((request) => {
                      const requestPolicy = request.timeOffPolicy as unknown as TimeOffPolicy;
                      return (
                      <div
                        key={request.id}
                        className="flex items-start justify-between p-4 border rounded-lg bg-green-50 border-green-200"
                      >
                        <div className="flex-1">
                          <p className="font-medium">
                            {requestPolicy?.name || 'Inconnu'}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {formatDate(request.startDate)} -{' '}
                            {formatDate(request.endDate)}
                          </p>
                          <p className="text-sm font-semibold mt-2">
                            {Number(request.totalDays)} jour
                            {Number(request.totalDays) > 1 ? 's' : ''}
                          </p>
                          {request.reviewNotes && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Note: {request.reviewNotes}
                            </p>
                          )}
                        </div>
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Approuvé
                        </Badge>
                      </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune demande approuvée
                </p>
              )}
            </TabsContent>

            <TabsContent value="rejected" className="mt-4">
              {requests && requests.filter((r) => r.status === 'rejected').length > 0 ? (
                <div className="space-y-3">
                  {requests
                    .filter((r) => r.status === 'rejected')
                    .map((request) => {
                      const requestPolicy = request.timeOffPolicy as unknown as TimeOffPolicy;
                      return (
                      <div
                        key={request.id}
                        className="flex items-start justify-between p-4 border rounded-lg bg-red-50 border-red-200"
                      >
                        <div className="flex-1">
                          <p className="font-medium">
                            {requestPolicy?.name || 'Inconnu'}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {formatDate(request.startDate)} -{' '}
                            {formatDate(request.endDate)}
                          </p>
                          <p className="text-sm font-semibold mt-2">
                            {Number(request.totalDays)} jour
                            {Number(request.totalDays) > 1 ? 's' : ''}
                          </p>
                          {request.reviewNotes && (
                            <p className="text-xs text-red-700 mt-2">
                              Raison: {request.reviewNotes}
                            </p>
                          )}
                        </div>
                        <Badge variant="destructive">
                          <XCircle className="mr-1 h-3 w-3" />
                          Rejeté
                        </Badge>
                      </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune demande rejetée
                </p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
