/**
 * Workflow Statistics Types
 *
 * Type definitions for workflow execution statistics and results
 */

export interface WorkflowStatsResponse {
  workflow: {
    id: string;
    name: string;
    description: string | null;
    [key: string]: any;
  };
  stats: Array<{
    status: string;
    count: number;
    avgDuration: number;
  }>;
}

// Legacy interface - still used in some components
export interface WorkflowStats {
  executionCount: number;
  successRate: number;
  successCount: number;
  errorCount: number;
}

export interface WorkflowTestResult {
  success: boolean;
  conditionsPassed?: boolean;
  conditionsEvaluated?: unknown;
  actionsPreview?: unknown;
  message: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'success' | 'failed' | 'skipped';
  startedAt: Date | string;
  completedAt?: Date | string | null;
  error?: string | null;
  result?: any;
  triggeredBy?: string;
}

export interface WorkflowExecutionHistory {
  executions: WorkflowExecution[];
  total: number;
  hasMore: boolean;
}
