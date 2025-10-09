"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Bell, Mail, FileText, Edit, ChevronDown, AlertCircle } from "lucide-react";

interface WorkflowAction {
  type: string;
  config: Record<string, any>;
}

interface ActionConfiguratorProps {
  actions: WorkflowAction[];
  onChange: (actions: WorkflowAction[]) => void;
}

const ACTION_OPTIONS = [
  {
    type: "create_alert",
    icon: Bell,
    label: "Créer une alerte pour le responsable RH",
    description: "Génère une alerte dans le tableau de bord RH",
    defaultConfig: {
      severity: "warning",
      message: "",
    },
  },
  {
    type: "send_notification",
    icon: Mail,
    label: "Envoyer une notification par email",
    description: "Envoie un email au responsable ou à l'employé",
    defaultConfig: {
      recipient: "manager",
      subject: "",
      message: "",
    },
  },
  {
    type: "create_payroll_event",
    icon: FileText,
    label: "Créer un événement de paie",
    description: "Enregistre un événement pour le calcul de la paie",
    defaultConfig: {
      eventType: "adjustment",
      description: "",
    },
  },
  {
    type: "update_employee_status",
    icon: Edit,
    label: "Mettre à jour le statut de l'employé",
    description: "Change le statut de l'employé dans le système",
    defaultConfig: {
      status: "",
    },
  },
];

export function ActionConfigurator({ actions, onChange }: ActionConfiguratorProps) {
  const [expandedActions, setExpandedActions] = useState<string[]>([]);

  const isActionEnabled = (actionType: string) => {
    return actions.some((a) => a.type === actionType);
  };

  const getActionConfig = (actionType: string) => {
    return actions.find((a) => a.type === actionType)?.config || {};
  };

  const toggleAction = (actionType: string) => {
    if (isActionEnabled(actionType)) {
      // Remove action
      onChange(actions.filter((a) => a.type !== actionType));
      setExpandedActions(expandedActions.filter((t) => t !== actionType));
    } else {
      // Add action with default config
      const actionOption = ACTION_OPTIONS.find((opt) => opt.type === actionType);
      if (actionOption) {
        onChange([...actions, { type: actionType, config: actionOption.defaultConfig }]);
        setExpandedActions([...expandedActions, actionType]);
      }
    }
  };

  const updateActionConfig = (actionType: string, configUpdates: Record<string, any>) => {
    onChange(
      actions.map((action) =>
        action.type === actionType
          ? { ...action, config: { ...action.config, ...configUpdates } }
          : action
      )
    );
  };

  const toggleExpanded = (actionType: string) => {
    if (expandedActions.includes(actionType)) {
      setExpandedActions(expandedActions.filter((t) => t !== actionType));
    } else {
      setExpandedActions([...expandedActions, actionType]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-blue-900">Choisissez au moins une action</p>
          <p className="text-sm text-blue-700 mt-1">
            Les actions seront exécutées dans l'ordre lorsque le workflow se déclenche
          </p>
        </div>
      </div>

      {ACTION_OPTIONS.map((option) => {
        const Icon = option.icon;
        const enabled = isActionEnabled(option.type);
        const config = getActionConfig(option.type);
        const isExpanded = expandedActions.includes(option.type);

        return (
          <Card
            key={option.type}
            className={enabled ? "border-primary bg-primary/5" : ""}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id={option.type}
                  checked={enabled}
                  onCheckedChange={() => toggleAction(option.type)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <Icon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <Label
                        htmlFor={option.type}
                        className="text-base font-medium cursor-pointer"
                      >
                        {option.label}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {option.description}
                      </p>
                    </div>
                  </div>

                  {/* Configuration Section */}
                  {enabled && (
                    <Collapsible
                      open={isExpanded}
                      onOpenChange={() => toggleExpanded(option.type)}
                      className="mt-4"
                    >
                      <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                        Configurer cette action
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-4 space-y-4">
                        {/* create_alert configuration */}
                        {option.type === "create_alert" && (
                          <>
                            <div>
                              <Label className="text-sm mb-2 block">Gravité</Label>
                              <Select
                                value={config.severity || "warning"}
                                onValueChange={(value) =>
                                  updateActionConfig(option.type, { severity: value })
                                }
                              >
                                <SelectTrigger className="min-h-[44px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="info">ℹ️ Information</SelectItem>
                                  <SelectItem value="warning">⚠️ Avertissement</SelectItem>
                                  <SelectItem value="urgent">🚨 Urgent</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-sm mb-2 block">
                                Message personnalisé (optionnel)
                              </Label>
                              <Textarea
                                value={config.message || ""}
                                onChange={(e) =>
                                  updateActionConfig(option.type, { message: e.target.value })
                                }
                                placeholder="Laissez vide pour utiliser le message par défaut"
                                className="min-h-[80px]"
                              />
                            </div>
                          </>
                        )}

                        {/* send_notification configuration */}
                        {option.type === "send_notification" && (
                          <>
                            <div>
                              <Label className="text-sm mb-2 block">Destinataire</Label>
                              <Select
                                value={config.recipient || "manager"}
                                onValueChange={(value) =>
                                  updateActionConfig(option.type, { recipient: value })
                                }
                              >
                                <SelectTrigger className="min-h-[44px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="manager">Responsable RH</SelectItem>
                                  <SelectItem value="employee">Employé concerné</SelectItem>
                                  <SelectItem value="both">Les deux</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-sm mb-2 block">Sujet de l'email</Label>
                              <Input
                                value={config.subject || ""}
                                onChange={(e) =>
                                  updateActionConfig(option.type, { subject: e.target.value })
                                }
                                placeholder="Ex: Rappel - Contrat arrivant à expiration"
                                className="min-h-[44px]"
                              />
                            </div>
                            <div>
                              <Label className="text-sm mb-2 block">Message</Label>
                              <Textarea
                                value={config.message || ""}
                                onChange={(e) =>
                                  updateActionConfig(option.type, { message: e.target.value })
                                }
                                placeholder="Contenu du message..."
                                className="min-h-[100px]"
                              />
                            </div>
                          </>
                        )}

                        {/* create_payroll_event configuration */}
                        {option.type === "create_payroll_event" && (
                          <>
                            <div>
                              <Label className="text-sm mb-2 block">Type d'événement</Label>
                              <Select
                                value={config.eventType || "adjustment"}
                                onValueChange={(value) =>
                                  updateActionConfig(option.type, { eventType: value })
                                }
                              >
                                <SelectTrigger className="min-h-[44px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="adjustment">Ajustement</SelectItem>
                                  <SelectItem value="bonus">Prime</SelectItem>
                                  <SelectItem value="deduction">Déduction</SelectItem>
                                  <SelectItem value="termination">Sortie</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-sm mb-2 block">Description</Label>
                              <Textarea
                                value={config.description || ""}
                                onChange={(e) =>
                                  updateActionConfig(option.type, { description: e.target.value })
                                }
                                placeholder="Décrivez l'événement..."
                                className="min-h-[80px]"
                              />
                            </div>
                          </>
                        )}

                        {/* update_employee_status configuration */}
                        {option.type === "update_employee_status" && (
                          <div>
                            <Label className="text-sm mb-2 block">Nouveau statut</Label>
                            <Select
                              value={config.status || ""}
                              onValueChange={(value) =>
                                updateActionConfig(option.type, { status: value })
                              }
                            >
                              <SelectTrigger className="min-h-[44px]">
                                <SelectValue placeholder="Sélectionnez un statut" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Actif</SelectItem>
                                <SelectItem value="on_leave">En congé</SelectItem>
                                <SelectItem value="suspended">Suspendu</SelectItem>
                                <SelectItem value="terminated">Terminé</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {actions.length === 0 && (
        <div className="p-6 text-center border-2 border-dashed border-destructive/30 rounded-lg bg-destructive/5">
          <p className="text-sm font-medium text-destructive">
            Vous devez sélectionner au moins une action
          </p>
        </div>
      )}
    </div>
  );
}
