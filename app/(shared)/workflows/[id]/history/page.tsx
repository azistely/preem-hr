"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/trpc/react";
import { ArrowLeft, History } from "lucide-react";
import { WorkflowExecutionLog } from "@/components/workflow/workflow-execution-log";

export default function WorkflowHistoryPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<"all" | "running" | "success" | "failed" | "skipped">("all");
  const [limit, setLimit] = useState(50);

  const { data: workflow } = api.workflows.getById.useQuery({ id: params.id });

  const { data: executionsData, isLoading } = api.workflows.getExecutionHistory.useQuery({
    workflowId: params.id,
    status: statusFilter === "all" ? undefined : statusFilter,
    limit,
    offset: 0,
  });

  const { data: stats } = api.workflows.getStats.useQuery({ id: params.id });

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <History className="h-6 w-6" />
            <h1 className="text-3xl font-bold">Historique d'exécution</h1>
          </div>
          {workflow && (
            <p className="text-muted-foreground mt-2">
              Workflow: {workflow.name}
            </p>
          )}
        </div>
      </div>

      {/* Statistics Summary */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total d'exécutions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.executionCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Taux de succès
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {stats.successRate}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Succès
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.successCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Échecs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{stats.errorCount}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-full sm:w-[200px] min-h-[44px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="success">Succès</SelectItem>
            <SelectItem value="failed">Échecs</SelectItem>
            <SelectItem value="running">En cours</SelectItem>
            <SelectItem value="skipped">Ignorés</SelectItem>
          </SelectContent>
        </Select>

        <Select value={limit.toString()} onValueChange={(v) => setLimit(parseInt(v))}>
          <SelectTrigger className="w-full sm:w-[200px] min-h-[44px]">
            <SelectValue placeholder="Nombre de résultats" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25 résultats</SelectItem>
            <SelectItem value="50">50 résultats</SelectItem>
            <SelectItem value="100">100 résultats</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Execution Log */}
      <Card>
        <CardHeader>
          <CardTitle>Historique complet</CardTitle>
          <CardDescription>
            {executionsData?.total || 0} exécution{(executionsData?.total || 0) > 1 ? "s" : ""} au total
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkflowExecutionLog
            executions={executionsData?.executions || []}
            isLoading={isLoading}
          />

          {executionsData && executionsData.hasMore && (
            <div className="mt-6 text-center">
              <Button
                variant="outline"
                onClick={() => setLimit(limit + 50)}
                className="min-h-[44px]"
              >
                Charger plus de résultats
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
