'use client';

/**
 * Active Advances List
 *
 * Shows all salary advances currently being repaid
 * HCI Principles: Clear status, repayment progress, employee context
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  User,
  Calendar,
  TrendingUp,
  Search,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/date';

export function ActiveAdvancesList() {
  const [searchQuery, setSearchQuery] = useState('');

  // Get approved and active advances (limited to 100 by backend)
  // Approved = waiting for disbursement, Active = being repaid
  const { data: advances, isLoading } = api.salaryAdvances.list.useQuery({
    status: ['approved', 'active'],
    limit: 100,
  });

  const filteredAdvances = advances?.advances.filter(advance => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      advance.employeeName?.toLowerCase().includes(search) ||
      advance.employeeNumber?.toLowerCase().includes(search)
    );
  }) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom ou matricule..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle>Avances Approuvées et Actives</CardTitle>
          <CardDescription>
            {filteredAdvances.length === 0
              ? 'Aucune avance approuvée ou active'
              : `${filteredAdvances.length} avance(s)`}
            {filteredAdvances.length >= 100 && (
              <span className="text-orange-600 block mt-1">
                (Affichage limité aux 100 premières - utilisez la recherche)
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredAdvances.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>Aucune avance approuvée ou active</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAdvances.map((advance) => {
                const isApproved = advance.status === 'approved';
                const isActive = advance.status === 'active';
                const approvedAmount = Number(advance.approvedAmount || 0);
                const totalRepaid = Number(advance.totalRepaid || 0);
                const remainingBalance = Number(advance.remainingBalance || 0);
                const progressPercent = approvedAmount > 0
                  ? ((totalRepaid / approvedAmount) * 100).toFixed(1)
                  : '0';

                return (
                  <div
                    key={advance.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{advance.employeeName}</span>
                          <Badge variant="outline">{advance.employeeNumber}</Badge>
                        </div>
                        {isApproved && (
                          <Badge variant="secondary" className="flex items-center gap-1 bg-blue-100 text-blue-700">
                            <CheckCircle2 className="h-3 w-3" />
                            Approuvée - À débourser
                          </Badge>
                        )}
                        {isActive && (
                          <Badge variant="default" className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            En cours
                          </Badge>
                        )}
                      </div>

                      {/* Approved - Waiting for disbursement */}
                      {isApproved && (
                        <>
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-start gap-2">
                              <Clock className="h-4 w-4 text-blue-600 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-blue-900 mb-1">
                                  En attente de débours
                                </p>
                                <p className="text-xs text-blue-700">
                                  Cette avance sera déboursée lors du prochain traitement de paie
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-primary/10 rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Montant approuvé</p>
                              <p className="text-lg font-bold text-primary">
                                {formatCurrency(approvedAmount, 'FCFA')}
                              </p>
                            </div>
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Remboursement</p>
                              <p className="text-lg font-semibold">{advance.repaymentMonths} mois</p>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Active - Being repaid */}
                      {isActive && (
                        <>
                          {/* Progress Bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Progrès de remboursement</span>
                              <span className="font-semibold">{progressPercent}%</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </div>

                          {/* Financial Details */}
                          <div className="grid grid-cols-3 gap-3">
                            <div className="p-3 bg-primary/10 rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Montant total</p>
                              <p className="text-lg font-bold text-primary">
                                {formatCurrency(approvedAmount, 'FCFA')}
                              </p>
                            </div>
                            <div className="p-3 bg-green-50 rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Remboursé</p>
                              <p className="text-lg font-bold text-green-700">
                                {formatCurrency(totalRepaid, 'FCFA')}
                              </p>
                            </div>
                            <div className="p-3 bg-orange-50 rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Restant</p>
                              <p className="text-lg font-bold text-orange-700">
                                {formatCurrency(remainingBalance, 'FCFA')}
                              </p>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Timing Info */}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {advance.approvedAt && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>Approuvée le {formatDate(new Date(advance.approvedAt), 'dd MMM yyyy')}</span>
                          </div>
                        )}
                        <div>
                          {advance.repaymentMonths} mois
                        </div>
                        {advance.monthlyDeduction && (
                          <div className="font-semibold">
                            {formatCurrency(Number(advance.monthlyDeduction), 'FCFA')}/mois
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
