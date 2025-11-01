"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Zap, Filter, Target, Calendar, DollarSign, UserPlus, Plane, Bell, Mail, FileText, Edit } from "lucide-react";

interface WorkflowPreviewProps {
  name: string;
  description?: string;
  triggerType: string;
  triggerConfig: Record<string, any>;
  conditions: any[];
  actions: any[];
}

const TRIGGER_LABELS: Record<string, { label: string; icon: any }> = {
  contract_expiry: { label: "Quand un contrat approche de sa fin", icon: Calendar },
  salary_change: { label: "Quand un salaire est modifié", icon: DollarSign },
  employee_hired: { label: "Quand un nouvel employé est embauché", icon: UserPlus },
  leave_approved: { label: "Quand un congé est approuvé", icon: Plane },
};

// Note: employee.contractType is a UI label for workflow conditions.
// Actual contract data is retrieved via JOIN with employment_contracts table
// using employee.currentContractId FK. See employee.service.ts:getEmployeeById
const FIELD_LABELS: Record<string, string> = {
  "employee.baseSalary": "Salaire de base",
  "employee.department": "Département",
  "employee.contractType": "Type de contrat", // Display label only - data comes from employment_contracts table
  "employee.position": "Poste",
  "employee.sector": "Secteur d'activité",
  "salary.changePercentage": "Pourcentage d'augmentation",
  "leave.daysCount": "Nombre de jours de congé",
  "leave.type": "Type de congé",
};

const OPERATOR_LABELS: Record<string, string> = {
  eq: "est égal à",
  ne: "est différent de",
  gt: "est supérieur à",
  gte: "est supérieur ou égal à",
  lt: "est inférieur à",
  lte: "est inférieur ou égal à",
  contains: "contient",
  in: "est parmi",
};

const ACTION_LABELS: Record<string, { label: string; icon: any }> = {
  create_alert: { label: "Créer une alerte", icon: Bell },
  send_notification: { label: "Envoyer une notification", icon: Mail },
  create_payroll_event: { label: "Créer un événement de paie", icon: FileText },
  update_employee_status: { label: "Mettre à jour le statut", icon: Edit },
};

const SEVERITY_LABELS: Record<string, string> = {
  info: "ℹ️ Information",
  warning: "⚠️ Avertissement",
  urgent: "🚨 Urgent",
};

const RECIPIENT_LABELS: Record<string, string> = {
  manager: "Responsable RH",
  employee: "Employé concerné",
  both: "Les deux",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  adjustment: "Ajustement",
  bonus: "Prime",
  deduction: "Déduction",
  termination: "Sortie",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  on_leave: "En congé",
  suspended: "Suspendu",
  terminated: "Terminé",
};

export function WorkflowPreview({
  name,
  description,
  triggerType,
  triggerConfig,
  conditions,
  actions,
}: WorkflowPreviewProps) {
  const triggerInfo = TRIGGER_LABELS[triggerType];
  const TriggerIcon = triggerInfo?.icon || Zap;

  return (
    <div className="space-y-6">
      {/* Workflow Name & Description */}
      <div>
        <h3 className="text-2xl font-bold">{name}</h3>
        {description && (
          <p className="text-muted-foreground mt-2">{description}</p>
        )}
      </div>

      <Separator />

      {/* Trigger Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TriggerIcon className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-lg">Déclencheur</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <Zap className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-blue-900">
                {triggerInfo?.label || triggerType}
              </p>
              {triggerType === "contract_expiry" && triggerConfig.days_before && (
                <p className="text-sm text-blue-700 mt-1">
                  {triggerConfig.days_before} jours avant l'expiration du contrat
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conditions Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Filter className="h-5 w-5 text-orange-600" />
            </div>
            <CardTitle className="text-lg">Conditions</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {conditions.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Aucune condition - le workflow s'exécutera à chaque fois
            </p>
          ) : (
            <div className="space-y-3">
              {conditions.map((condition, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg"
                >
                  <Filter className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-orange-900">
                      <span className="font-medium">Si</span>{" "}
                      <span className="font-semibold">
                        {FIELD_LABELS[condition.field] || condition.field}
                      </span>{" "}
                      <span className="font-medium">
                        {OPERATOR_LABELS[condition.operator] || condition.operator}
                      </span>{" "}
                      <span className="font-semibold">{condition.value}</span>
                    </p>
                  </div>
                </div>
              ))}
              {conditions.length > 1 && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Toutes les conditions doivent être remplies (logique ET)
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Target className="h-5 w-5 text-green-600" />
            </div>
            <CardTitle className="text-lg">Actions</CardTitle>
            <Badge variant="secondary">{actions.length} action{actions.length > 1 ? "s" : ""}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {actions.length === 0 ? (
            <p className="text-sm text-destructive font-medium">
              ⚠️ Aucune action configurée
            </p>
          ) : (
            <div className="space-y-3">
              {actions.map((action, index) => {
                const actionInfo = ACTION_LABELS[action.type];
                const ActionIcon = actionInfo?.icon || Target;

                return (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <ActionIcon className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-green-900">
                        {index + 1}. {actionInfo?.label || action.type}
                      </p>

                      {/* Action-specific details */}
                      {action.type === "create_alert" && (
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-green-700">
                            <span className="font-medium">Gravité:</span>{" "}
                            {SEVERITY_LABELS[action.config.severity] || action.config.severity}
                          </p>
                          {action.config.message && (
                            <p className="text-sm text-green-700">
                              <span className="font-medium">Message:</span> {action.config.message}
                            </p>
                          )}
                        </div>
                      )}

                      {action.type === "send_notification" && (
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-green-700">
                            <span className="font-medium">Destinataire:</span>{" "}
                            {RECIPIENT_LABELS[action.config.recipient] || action.config.recipient}
                          </p>
                          {action.config.subject && (
                            <p className="text-sm text-green-700">
                              <span className="font-medium">Sujet:</span> {action.config.subject}
                            </p>
                          )}
                          {action.config.message && (
                            <p className="text-sm text-green-700 line-clamp-2">
                              <span className="font-medium">Message:</span> {action.config.message}
                            </p>
                          )}
                        </div>
                      )}

                      {action.type === "create_payroll_event" && (
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-green-700">
                            <span className="font-medium">Type:</span>{" "}
                            {EVENT_TYPE_LABELS[action.config.eventType] || action.config.eventType}
                          </p>
                          {action.config.description && (
                            <p className="text-sm text-green-700">
                              <span className="font-medium">Description:</span> {action.config.description}
                            </p>
                          )}
                        </div>
                      )}

                      {action.type === "update_employee_status" && (
                        <div className="mt-2">
                          <p className="text-sm text-green-700">
                            <span className="font-medium">Nouveau statut:</span>{" "}
                            {STATUS_LABELS[action.config.status] || action.config.status}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Résumé:</span> Ce workflow sera
          déclenché {triggerInfo?.label?.toLowerCase() || "automatiquement"}
          {conditions.length > 0 && (
            <>, uniquement si {conditions.length} condition{conditions.length > 1 ? "s sont" : " est"} remplie{conditions.length > 1 ? "s" : ""}</>
          )}
          . Il exécutera {actions.length} action{actions.length > 1 ? "s" : ""} automatiquement.
        </p>
      </div>
    </div>
  );
}
