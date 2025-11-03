'use client';

/**
 * Quick Approval Banner Component
 *
 * Shows verification statistics and provides bulk actions for approval workflow
 */

import { CheckCircle, AlertCircle, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface QuickApprovalBannerProps {
  totalEmployees: number;
  verifiedCount: number;
  flaggedCount: number;
  unverifiedCount: number;
  autoOkCount?: number;
  onMarkAllVerified?: () => void;
  onApproveVerified?: () => void;
  isLoading?: boolean;
}

export function QuickApprovalBanner({
  totalEmployees,
  verifiedCount,
  flaggedCount,
  unverifiedCount,
  autoOkCount = 0,
  onMarkAllVerified,
  onApproveVerified,
  isLoading = false,
}: QuickApprovalBannerProps) {
  const readyToApprove = verifiedCount + autoOkCount;

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-blue-600" />
          Statut de Révision
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Vérifiés</p>
              <p className="text-lg font-bold text-green-700">{verifiedCount}</p>
            </div>
          </div>

          {autoOkCount > 0 && (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">Auto-vérifiés</p>
                <p className="text-lg font-bold text-blue-700">{autoOkCount}</p>
              </div>
            </div>
          )}

          {flaggedCount > 0 && (
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-xs text-muted-foreground">À vérifier</p>
                <p className="text-lg font-bold text-orange-700">{flaggedCount}</p>
              </div>
            </div>
          )}

          {unverifiedCount > 0 && (
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-gray-600" />
              <div>
                <p className="text-xs text-muted-foreground">Non vérifiés</p>
                <p className="text-lg font-bold text-gray-700">{unverifiedCount}</p>
              </div>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progression</span>
            <span className="font-medium">
              {readyToApprove} / {totalEmployees} prêt{readyToApprove > 1 ? 's' : ''}
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-600 transition-all duration-300"
              style={{ width: `${(readyToApprove / totalEmployees) * 100}%` }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {onMarkAllVerified && unverifiedCount > 0 && (
            <Button
              variant="outline"
              size="default"
              onClick={onMarkAllVerified}
              disabled={isLoading}
              className="min-h-[48px] flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Chargement...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Marquer tout comme vérifié
                </>
              )}
            </Button>
          )}

          {onApproveVerified && readyToApprove > 0 && (
            <Button
              size="default"
              onClick={onApproveVerified}
              disabled={isLoading || flaggedCount > 0}
              className="min-h-[48px] flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Chargement...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approuver les {readyToApprove} vérifiés
                </>
              )}
            </Button>
          )}
        </div>

        {/* Warning if flagged items */}
        {flaggedCount > 0 && (
          <div className="bg-orange-100 border border-orange-200 rounded-lg p-3">
            <p className="text-sm text-orange-900">
              <AlertCircle className="h-4 w-4 inline mr-1" />
              {flaggedCount} employé{flaggedCount > 1 ? 's ont' : ' a'} des alertes à vérifier avant l'approbation
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
