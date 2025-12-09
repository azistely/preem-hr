'use client';

/**
 * HR Pending Document Requests Dashboard
 *
 * Shows all pending document requests for HR to process.
 * HCI Principles: Clear overview, quick actions, urgency indicators
 */

import { useState } from 'react';
import { trpc as api } from '@/lib/trpc/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clock,
  User,
  FileText,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  FileStack,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ApprovalModal } from './approval-modal';
import { DocumentTypeLabels } from '@/lib/db/schema/document-requests';

export function PendingRequestsDashboard() {
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  // Get pending approvals
  const { data: pendingData, isLoading, refetch } =
    api.documentRequests.getPendingApprovals.useQuery();

  // Get statistics
  const { data: stats } = api.documentRequests.getStatistics.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const pending = pendingData ?? [];

  // Group by document type for stats
  const typeBreakdown = pending.reduce<Record<string, number>>(
    (acc, req) => {
      acc[req.documentType] = (acc[req.documentType] || 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>En attente de traitement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{pending.length}</span>
              <span className="text-muted-foreground">demande(s)</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Documents traités ce mois</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-green-600">
                {stats?.readyThisMonth ?? 0}
              </span>
              <span className="text-muted-foreground">document(s)</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Types de documents demandés</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {Object.entries(typeBreakdown).slice(0, 3).map(([type, count]) => (
                <Badge key={type} variant="secondary" className="text-xs">
                  {DocumentTypeLabels[type]?.split(' ')[0] || type} ({count})
                </Badge>
              ))}
              {Object.keys(typeBreakdown).length === 0 && (
                <span className="text-sm text-muted-foreground">-</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileStack className="h-5 w-5" />
            Demandes en attente
          </CardTitle>
          <CardDescription>
            {pending.length === 0
              ? 'Aucune demande en attente'
              : `${pending.length} demande(s) à traiter`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Toutes les demandes sont traitées
              </h3>
              <p className="text-muted-foreground">
                Aucune demande de document en attente
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((request) => {
                // Calculate days waiting
                const submittedDate = new Date(request.submittedAt);
                const daysWaiting = Math.floor(
                  (Date.now() - submittedDate.getTime()) / (1000 * 60 * 60 * 24)
                );
                const isUrgent = daysWaiting > 3;

                return (
                  <div
                    key={request.id}
                    className={`p-4 border-2 rounded-lg hover:bg-muted/50 transition-colors ${
                      isUrgent ? 'border-orange-300 bg-orange-50' : 'border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-lg">
                              {request.employeeName}
                            </span>
                            <Badge variant="outline">{request.employeeNumber}</Badge>
                          </div>
                          {isUrgent && (
                            <Badge
                              variant="destructive"
                              className="flex items-center gap-1"
                            >
                              <Clock className="h-3 w-3" />
                              Urgent ({daysWaiting}j)
                            </Badge>
                          )}
                        </div>

                        {/* Request Info */}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <span className="font-medium">
                              {DocumentTypeLabels[request.documentType] ||
                                request.documentType}
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            Demandé{' '}
                            {formatDistanceToNow(submittedDate, {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </span>
                        </div>

                        {/* Notes */}
                        {request.requestNotes && (
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-xs font-semibold text-muted-foreground mb-1">
                              Note de l'employé:
                            </p>
                            <p className="text-sm line-clamp-2">{request.requestNotes}</p>
                          </div>
                        )}

                        {/* On behalf indicator */}
                        {request.requestedOnBehalfOf && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <AlertCircle className="h-4 w-4" />
                            <span>Demande faite par un manager</span>
                          </div>
                        )}
                      </div>

                      {/* Action Button */}
                      <div className="flex-shrink-0">
                        <Button
                          onClick={() => setSelectedRequestId(request.id)}
                          size="lg"
                          className="min-h-[56px]"
                        >
                          Traiter
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Modal */}
      {selectedRequestId && (
        <ApprovalModal
          requestId={selectedRequestId}
          open={true}
          onOpenChange={(open) => {
            if (!open) setSelectedRequestId(null);
          }}
          onSuccess={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
}
