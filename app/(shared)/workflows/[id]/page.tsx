"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  MoreVertical,
  Play,
  Pause,
  Edit,
  Trash2,
  Eye,
  BarChart,
  TestTube,
} from "lucide-react";
import { WorkflowPreview } from "@/components/workflow/workflow-preview";
import { WorkflowExecutionLog } from "@/components/workflow/workflow-execution-log";
import type { WorkflowStatsResponse, WorkflowTestResult } from "@/features/workflows/types/workflow-stats";

export default function WorkflowDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { id } = use(params);
  const { data: workflow, isLoading } = api.workflows.getById.useQuery({ id });
  const { data: statsData } = api.workflows.getStats.useQuery({ id });
  const { data: executions } = api.workflows.getExecutionHistory.useQuery({
    workflowId: id,
    limit: 10,
  });

  // Transform stats array into computed metrics
  const stats = statsData ? {
    executionCount: statsData.stats.reduce((sum, s) => sum + s.count, 0),
    successCount: statsData.stats.find(s => s.status === 'success')?.count || 0,
    errorCount: statsData.stats.find(s => s.status === 'failed')?.count || 0,
    get successRate() {
      return this.executionCount > 0 ? Math.round((this.successCount / this.executionCount) * 100) : 0;
    }
  } : null;

  const utils = api.useUtils();

  const activateMutation = api.workflows.activate.useMutation({
    onSuccess: () => {
      toast.success("Workflow activé");
      utils.workflows.getById.invalidate({ id });
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const pauseMutation = api.workflows.pause.useMutation({
    onSuccess: () => {
      toast.success("Workflow mis en pause");
      utils.workflows.getById.invalidate({ id });
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const deleteMutation = api.workflows.delete.useMutation({
    onSuccess: () => {
      toast.success("Workflow supprimé");
      router.push("/workflows");
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const testMutation = api.workflows.testWorkflow.useMutation({
    onSuccess: (result) => {
      // Result is of type WorkflowTestResult
      toast.success(`Test réussi: ${result.message}`);
    },
    onError: (error) => {
      toast.error(`Erreur lors du test: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="container py-8">
        <p className="text-center text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Workflow non trouvé</p>
            <Button onClick={() => router.push("/workflows")} className="mt-4">
              Retour à la liste
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = {
    draft: { variant: "secondary" as const, label: "Brouillon" },
    active: { variant: "default" as const, label: "Actif" },
    paused: { variant: "outline" as const, label: "En pause" },
    archived: { variant: "outline" as const, label: "Archivé" },
  };

  const status = statusConfig[workflow.status as keyof typeof statusConfig];

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{workflow.name}</h1>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            {workflow.description && (
              <p className="text-muted-foreground mt-2">{workflow.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {workflow.status === "draft" && (
            <Button
              onClick={() => activateMutation.mutate({ id: workflow.id })}
              disabled={activateMutation.isPending}
              className="min-h-[44px]"
            >
              <Play className="h-4 w-4 mr-2" />
              Activer
            </Button>
          )}

          {workflow.status === "active" && (
            <Button
              variant="outline"
              onClick={() => pauseMutation.mutate({ id: workflow.id })}
              disabled={pauseMutation.isPending}
              className="min-h-[44px]"
            >
              <Pause className="h-4 w-4 mr-2" />
              Mettre en pause
            </Button>
          )}

          {workflow.status === "paused" && (
            <Button
              onClick={() => activateMutation.mutate({ id: workflow.id })}
              disabled={activateMutation.isPending}
              className="min-h-[44px]"
            >
              <Play className="h-4 w-4 mr-2" />
              Reprendre
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="min-h-[44px] min-w-[44px]">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/workflows/${workflow.id}?edit=true`)}>
                <Edit className="h-4 w-4 mr-2" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => testMutation.mutate({ workflowId: workflow.id })}>
                <TestTube className="h-4 w-4 mr-2" />
                Tester
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/workflows/${workflow.id}/history`)}>
                <Eye className="h-4 w-4 mr-2" />
                Historique complet
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Statistics */}
      {stats && workflow.status !== "draft" && (
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

      {/* Workflow Configuration */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Configuration du workflow</CardTitle>
          <CardDescription>
            Déclencheurs, conditions et actions configurés
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkflowPreview
            name={workflow.name}
            description={workflow.description || undefined}
            triggerType={workflow.triggerType}
            triggerConfig={workflow.triggerConfig as Record<string, any>}
            conditions={(workflow.conditions as any[]) || []}
            actions={(workflow.actions as any[]) || []}
          />
        </CardContent>
      </Card>

      {/* Recent Executions */}
      {workflow.status !== "draft" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Exécutions récentes</CardTitle>
                <CardDescription>Les 10 dernières exécutions du workflow</CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push(`/workflows/${workflow.id}/history`)}
              >
                <BarChart className="h-4 w-4 mr-2" />
                Voir tout l'historique
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <WorkflowExecutionLog executions={(executions?.executions || []).map(exec => ({
              ...exec,
              actionsExecuted: exec.actionsExecuted as any[]
            })) as any} />
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le workflow "{workflow.name}" et tout son historique
              d'exécution seront supprimés définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate({ id: workflow.id })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Oui, supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
