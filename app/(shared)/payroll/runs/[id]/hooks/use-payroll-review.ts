/**
 * Payroll Review Hook
 *
 * Manages state and logic for the enhanced payroll review interface
 */

'use client';

import { useState, useEffect } from 'react';
import { api } from '@/trpc/react';

export function usePayrollReview(
  runId: string,
  userId: string | undefined,
  totalEmployees: number = 0
) {
  const [comparisonMode, setComparisonMode] = useState(false);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);

  // Fetch validation issues
  const {
    data: validationResult,
    isLoading: isLoadingValidation,
    refetch: refetchValidation,
  } = api.payrollReview.validatePayrollCalculations.useQuery(
    { runId },
    { enabled: !!runId }
  );

  // Fetch previous payroll for comparison
  const {
    data: previousPayroll,
    isLoading: isLoadingPrevious,
  } = api.payrollReview.getPreviousPayroll.useQuery(
    { currentRunId: runId },
    { enabled: comparisonMode && !!runId }
  );

  // Fetch verification status
  const {
    data: verificationStatuses,
    refetch: refetchVerification,
  } = api.payrollReview.getVerificationStatus.useQuery(
    { runId },
    { enabled: !!runId }
  );

  // Mark employee as verified mutation
  const markVerifiedMutation = api.payrollReview.markEmployeeVerified.useMutation({
    onSuccess: () => {
      refetchVerification();
      refetchValidation();
    },
  });

  // Mark all verified mutation
  const markAllVerifiedMutation = api.payrollReview.markAllVerified.useMutation({
    onSuccess: () => {
      refetchVerification();
    },
  });

  // Recalculate employee mutation
  const recalculateEmployeeMutation = api.payrollReview.recalculateEmployee.useMutation({
    onSuccess: () => {
      // Refetch the main payroll run data
      refetchValidation();
    },
  });

  // Helper functions
  const markEmployeeVerified = async (employeeId: string, notes?: string) => {
    if (!userId) return;

    await markVerifiedMutation.mutateAsync({
      runId,
      employeeId,
      verifiedBy: userId,
      notes,
    });
  };

  const markAllVerified = async () => {
    if (!userId) return;

    await markAllVerifiedMutation.mutateAsync({
      runId,
      verifiedBy: userId,
    });
  };

  const recalculateEmployee = async (employeeId: string) => {
    await recalculateEmployeeMutation.mutateAsync({
      runId,
      employeeId,
    });
  };

  // Calculate verification counts
  const verified = verificationStatuses?.filter((s) => s.status === 'verified').length || 0;
  const flagged = verificationStatuses?.filter((s) => s.status === 'flagged').length || 0;
  const autoOk = verificationStatuses?.filter((s) => s.status === 'auto_ok').length || 0;

  // Employees with no status record are considered "unverified"
  const employeesWithStatus = verificationStatuses?.length || 0;
  const unverified = Math.max(0, totalEmployees - employeesWithStatus);

  const verificationCounts = {
    verified,
    flagged,
    unverified,
    autoOk,
  };

  return {
    // State
    comparisonMode,
    setComparisonMode,
    expandedEmployeeId,
    setExpandedEmployeeId,

    // Data
    validationResult,
    previousPayroll,
    verificationStatuses,
    verificationCounts,

    // Loading states
    isLoadingValidation,
    isLoadingPrevious,

    // Actions
    markEmployeeVerified,
    markAllVerified,
    recalculateEmployee,

    // Mutation states
    isMarkingVerified: markVerifiedMutation.isPending,
    isMarkingAllVerified: markAllVerifiedMutation.isPending,
    isRecalculating: recalculateEmployeeMutation.isPending,

    // Refetch
    refetchValidation,
    refetchVerification,
  };
}
