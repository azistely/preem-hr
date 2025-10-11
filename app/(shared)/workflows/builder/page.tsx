"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "@/trpc/react";
import { Plus, X, Save, AlertTriangle, Workflow as WorkflowIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type WorkflowAction = {
  type: "create_alert" | "send_notification" | "create_payroll_event" | "update_employee_status";
  config: Record<string, any>;
};

type WorkflowCondition = {
  field: string;
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains" | "in";
  value: any;
};

export default function WorkflowBuilderPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState<string>("manual");
  const [conditions, setConditions] = useState<WorkflowCondition[]>([]);
  const [actions, setActions] = useState<WorkflowAction[]>([]);

  const createWorkflow = api.workflows.create.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Workflow créé",
        description: "Le workflow a été créé avec succès",
      });
      router.push(`/workflows/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addCondition = () => {
    setConditions([
      ...conditions,
      { field: "", operator: "eq", value: "" },
    ]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, updates: Partial<WorkflowCondition>) => {
    setConditions(
      conditions.map((c, i) => (i === index ? { ...c, ...updates } : c))
    );
  };

  const addAction = () => {
    setActions([
      ...actions,
      { type: "create_alert", config: {} },
    ]);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, updates: Partial<WorkflowAction>) => {
    setActions(
      actions.map((a, i) => (i === index ? { ...a, ...updates } : a))
    );
  };

  const updateActionConfig = (index: number, key: string, value: any) => {
    setActions(
      actions.map((a, i) =>
        i === index ? { ...a, config: { ...a.config, [key]: value } } : a
      )
    );
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast({
        title: "Erreur",
        description: "Le nom du workflow est requis",
        variant: "destructive",
      });
      return;
    }

    if (actions.length === 0) {
      toast({
        title: "Erreur",
        description: "Au moins une action est requise",
        variant: "destructive",
      });
      return;
    }

    createWorkflow.mutate({
      name: name.trim(),
      description: description.trim(),
      triggerType,
      triggerConfig: {},
      conditions,
      actions,
      status: "draft",
    });
  };

  return (
    <div className="container max-w-5xl py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <WorkflowIcon className="h-8 w-8" />
          Créer un workflow personnalisé
        </h1>
        <p className="text-muted-foreground mt-2">
          Définissez les déclencheurs, conditions et actions de votre workflow
        </p>
      </div>

      {/* Mobile Warning */}
      <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 lg:hidden">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-900 dark:text-yellow-100">
                Utilisation recommandée sur ordinateur
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Le créateur de workflow est optimisé pour les écrans larges. Nous recommandons
                d'utiliser un ordinateur pour une meilleure expérience.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Informations de base</CardTitle>
          <CardDescription>
            Donnez un nom et une description à votre workflow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom du workflow *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Rappel renouvellement contrat"
              className="min-h-[48px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez ce que fait ce workflow..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="trigger">Type de déclencheur</Label>
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger id="trigger" className="min-h-[48px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manuel</SelectItem>
                <SelectItem value="scheduled">Planifié</SelectItem>
                <SelectItem value="event">Événement</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Conditions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Conditions</CardTitle>
              <CardDescription>
                Définissez quand le workflow doit s'exécuter (optionnel)
              </CardDescription>
            </div>
            <Button onClick={addCondition} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {conditions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune condition. Le workflow s'exécutera toujours quand déclenché.
            </p>
          ) : (
            conditions.map((condition, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1 grid gap-2 sm:grid-cols-3">
                  <Input
                    placeholder="Champ"
                    value={condition.field}
                    onChange={(e) =>
                      updateCondition(index, { field: e.target.value })
                    }
                    className="min-h-[44px]"
                  />
                  <Select
                    value={condition.operator}
                    onValueChange={(value: any) =>
                      updateCondition(index, { operator: value })
                    }
                  >
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eq">Égal à</SelectItem>
                      <SelectItem value="ne">Différent de</SelectItem>
                      <SelectItem value="gt">Supérieur à</SelectItem>
                      <SelectItem value="gte">Supérieur ou égal</SelectItem>
                      <SelectItem value="lt">Inférieur à</SelectItem>
                      <SelectItem value="lte">Inférieur ou égal</SelectItem>
                      <SelectItem value="contains">Contient</SelectItem>
                      <SelectItem value="in">Dans</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Valeur"
                    value={condition.value}
                    onChange={(e) =>
                      updateCondition(index, { value: e.target.value })
                    }
                    className="min-h-[44px]"
                  />
                </div>
                <Button
                  onClick={() => removeCondition(index)}
                  variant="ghost"
                  size="icon"
                  className="min-h-[44px] min-w-[44px]"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Actions *</CardTitle>
              <CardDescription>
                Définissez ce que le workflow doit faire
              </CardDescription>
            </div>
            <Button onClick={addAction} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {actions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune action définie. Ajoutez au moins une action.
            </p>
          ) : (
            actions.map((action, index) => (
              <Card key={index}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">Action {index + 1}</Badge>
                    <Button
                      onClick={() => removeAction(index)}
                      variant="ghost"
                      size="sm"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Type d'action</Label>
                    <Select
                      value={action.type}
                      onValueChange={(value: any) =>
                        updateAction(index, { type: value })
                      }
                    >
                      <SelectTrigger className="min-h-[48px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="create_alert">Créer une alerte</SelectItem>
                        <SelectItem value="send_notification">
                          Envoyer une notification
                        </SelectItem>
                        <SelectItem value="create_payroll_event">
                          Créer un événement paie
                        </SelectItem>
                        <SelectItem value="update_employee_status">
                          Mettre à jour le statut employé
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {action.type === "create_alert" && (
                    <>
                      <div className="space-y-2">
                        <Label>Titre de l'alerte</Label>
                        <Input
                          value={action.config.title || ""}
                          onChange={(e) =>
                            updateActionConfig(index, "title", e.target.value)
                          }
                          placeholder="Ex: Contrat à renouveler"
                          className="min-h-[48px]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          value={action.config.description || ""}
                          onChange={(e) =>
                            updateActionConfig(index, "description", e.target.value)
                          }
                          placeholder="Détails de l'alerte..."
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Sévérité</Label>
                        <Select
                          value={action.config.severity || "info"}
                          onValueChange={(value) =>
                            updateActionConfig(index, "severity", value)
                          }
                        >
                          <SelectTrigger className="min-h-[48px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="info">Info</SelectItem>
                            <SelectItem value="warning">Avertissement</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {action.type === "send_notification" && (
                    <>
                      <div className="space-y-2">
                        <Label>Destinataire</Label>
                        <Input
                          value={action.config.recipient || ""}
                          onChange={(e) =>
                            updateActionConfig(index, "recipient", e.target.value)
                          }
                          placeholder="Email ou ID employé"
                          className="min-h-[48px]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Sujet</Label>
                        <Input
                          value={action.config.subject || ""}
                          onChange={(e) =>
                            updateActionConfig(index, "subject", e.target.value)
                          }
                          placeholder="Sujet de la notification"
                          className="min-h-[48px]"
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4 justify-end">
        <Button
          onClick={() => router.push("/workflows")}
          variant="outline"
          className="min-h-[56px]"
        >
          Annuler
        </Button>
        <Button
          onClick={handleSave}
          disabled={createWorkflow.isPending}
          className="min-h-[56px]"
        >
          <Save className="h-5 w-5 mr-2" />
          {createWorkflow.isPending ? "Création..." : "Créer le workflow"}
        </Button>
      </div>
    </div>
  );
}
