"use client";

import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle, XCircle, Clock, ChevronDown, AlertCircle, User } from "lucide-react";

interface ExecutionLog {
  id: string;
  workflowId: string;
  status: "running" | "success" | "failed" | "skipped";
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  actionsExecuted?: any[];
  errorMessage?: string;
  executionLog?: any[];
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface WorkflowExecutionLogProps {
  executions: ExecutionLog[];
  isLoading?: boolean;
}

const STATUS_CONFIG = {
  success: {
    icon: CheckCircle,
    variant: "default" as const,
    label: "Succès",
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  failed: {
    icon: XCircle,
    variant: "destructive" as const,
    label: "Échec",
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
  running: {
    icon: Clock,
    variant: "secondary" as const,
    label: "En cours",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  skipped: {
    icon: AlertCircle,
    variant: "outline" as const,
    label: "Ignoré",
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
  },
};

export function WorkflowExecutionLog({ executions, isLoading }: WorkflowExecutionLogProps) {
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Chargement de l'historique...</p>
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Aucune exécution pour le moment</p>
          <p className="text-sm text-muted-foreground mt-1">
            L'historique apparaîtra ici lorsque le workflow sera déclenché
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {executions.map((execution) => {
        const config = STATUS_CONFIG[execution.status];
        const Icon = config.icon;

        return (
          <Card key={execution.id} className={`${config.borderColor} border-l-4`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`p-2 ${config.bgColor} rounded-lg flex-shrink-0`}>
                    <Icon className={`h-5 w-5 ${config.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={config.variant}>{config.label}</Badge>
                      {execution.employee && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>
                            {execution.employee.firstName} {execution.employee.lastName}
                          </span>
                        </div>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground mt-2">
                      Démarré{" "}
                      {formatDistanceToNow(new Date(execution.startedAt), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </p>

                    {execution.completedAt && execution.durationMs && (
                      <p className="text-sm text-muted-foreground">
                        Durée: {(execution.durationMs / 1000).toFixed(2)}s
                      </p>
                    )}

                    {execution.errorMessage && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm font-medium text-red-900">Erreur</p>
                        <p className="text-sm text-red-700 mt-1">{execution.errorMessage}</p>
                      </div>
                    )}

                    {execution.actionsExecuted && execution.actionsExecuted.length > 0 && (
                      <Collapsible className="mt-3">
                        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                          <ChevronDown className="h-4 w-4" />
                          Voir les {execution.actionsExecuted.length} action{execution.actionsExecuted.length > 1 ? "s" : ""} exécutée{execution.actionsExecuted.length > 1 ? "s" : ""}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3 space-y-2">
                          {execution.actionsExecuted.map((action: any, index: number) => (
                            <div
                              key={index}
                              className="p-3 bg-muted rounded-lg flex items-start gap-3"
                            >
                              {action.success ? (
                                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{action.type}</p>
                                {action.result && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {typeof action.result === "string"
                                      ? action.result
                                      : JSON.stringify(action.result)}
                                  </p>
                                )}
                                {action.error && (
                                  <p className="text-sm text-red-600 mt-1">{action.error}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {execution.executionLog && execution.executionLog.length > 0 && (
                      <Collapsible className="mt-3">
                        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                          <ChevronDown className="h-4 w-4" />
                          Voir les logs détaillés
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                          <div className="p-3 bg-muted rounded-lg font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
                            {execution.executionLog.map((log: any, index: number) => (
                              <div key={index} className="flex gap-2">
                                <span className="text-muted-foreground">
                                  {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                                <span className={log.level === "error" ? "text-red-600" : ""}>
                                  {log.message}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
