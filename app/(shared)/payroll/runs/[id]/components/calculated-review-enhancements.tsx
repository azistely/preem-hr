'use client';

/**
 * Calculated Payroll Review Enhancements
 *
 * Adds validation, comparison, and verification features to the payroll review page
 * when status is 'calculated' or 'processing'
 */

import { useState } from 'react';
import { usePayrollReview } from '../hooks/use-payroll-review';
import {
  ValidationAlertCard,
  ComparisonToggle,
  QuickApprovalBanner,
  EnhancedSummaryCard,
} from '@/features/payroll/components/review/calculated';

interface CalculatedReviewEnhancementsProps {
  runId: string;
  userId: string | undefined;
  status: string;
  totalEmployees: number;
  totalNet?: number;
  onViewEmployeeDetails?: (employeeId: string) => void;
  onApprove?: () => void;
}

export function CalculatedReviewEnhancements({
  runId,
  userId,
  status,
  totalEmployees,
  totalNet,
  onViewEmployeeDetails,
  onApprove,
}: CalculatedReviewEnhancementsProps) {
  // Only show for calculated/processing status
  if (status !== 'calculated' && status !== 'processing') {
    return null;
  }

  const {
    comparisonMode,
    setComparisonMode,
    validationResult,
    previousPayroll,
    verificationCounts,
    markEmployeeVerified,
    markAllVerified,
    recalculateEmployee,
    isMarkingVerified,
    isMarkingAllVerified,
    isRecalculating,
    isLoadingValidation,
  } = usePayrollReview(runId, userId, totalEmployees);

  const handleMarkVerified = async (employeeId: string) => {
    await markEmployeeVerified(employeeId);
  };

  const handleRecalculate = async (employeeId: string) => {
    await recalculateEmployee(employeeId);
  };

  const handleViewDetails = (employeeId: string) => {
    onViewEmployeeDetails?.(employeeId);
  };

  const handleApproveVerified = async () => {
    // Only approve if no flagged issues
    if (verificationCounts.flagged === 0) {
      onApprove?.();
    }
  };

  const previousTotalNet = previousPayroll?.run.totalNet
    ? Number(previousPayroll.run.totalNet)
    : undefined;

  return (
    <div className="space-y-6">
      {/* Comparison Toggle */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Révision des Calculs</h2>
        <ComparisonToggle
          enabled={comparisonMode}
          onToggle={setComparisonMode}
          disabled={!previousPayroll}
        />
      </div>

      {/* Enhanced Summary */}
      <EnhancedSummaryCard
        totalEmployees={totalEmployees}
        verifiedCount={verificationCounts.verified}
        flaggedCount={verificationCounts.flagged}
        unverifiedCount={verificationCounts.unverified}
        totalNet={totalNet}
        previousNet={previousTotalNet}
      />

      {/* Validation Alerts */}
      {validationResult && (
        <ValidationAlertCard
          runId={runId}
          issues={validationResult.issues}
          onViewDetails={handleViewDetails}
          onRecalculate={handleRecalculate}
          onMarkVerified={handleMarkVerified}
        />
      )}

      {/* Quick Approval Banner */}
      <QuickApprovalBanner
        totalEmployees={totalEmployees}
        verifiedCount={verificationCounts.verified}
        flaggedCount={verificationCounts.flagged}
        unverifiedCount={verificationCounts.unverified}
        autoOkCount={verificationCounts.autoOk}
        onMarkAllVerified={markAllVerified}
        onApproveVerified={handleApproveVerified}
        isLoading={isMarkingAllVerified || isRecalculating}
      />
    </div>
  );
}
