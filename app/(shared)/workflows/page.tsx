"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { api } from "@/trpc/react";
import { Plus, Search, Workflow as WorkflowIcon } from "lucide-react";
import { WorkflowListItem } from "@/components/workflow/workflow-list-item";
import { WorkflowTemplateCard } from "@/components/workflow/workflow-template-card";

export default function WorkflowsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"draft" | "active" | "paused" | "archived" | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: workflowsData, isLoading } = api.workflows.list.useQuery({
    status: status === "all" ? undefined : status,
    limit: 50,
    offset: 0,
  });

  const { data: templates } = api.workflows.getTemplates.useQuery({});

  const filteredWorkflows = workflowsData?.workflows.filter((workflow) => {
    const matchesSearch =
      searchQuery === "" ||
      workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      workflow.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      categoryFilter === "all" || workflow.templateCategory === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const hasWorkflows = (workflowsData?.total || 0) > 0;

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <WorkflowIcon className="h-8 w-8" />
            Workflows automatisés
          </h1>
          <p className="text-muted-foreground mt-2">
            Créez des workflows pour automatiser vos tâches RH répétitives
          </p>
        </div>
        <Button
          onClick={() => router.push("/workflows/new")}
          size="lg"
          className="min-h-[56px]"
        >
          <Plus className="h-5 w-5 mr-2" />
          Créer un workflow
        </Button>
      </div>

      {/* Empty State - Show Templates */}
      {!hasWorkflows && !isLoading ? (
        <div className="space-y-8">
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Démarrez avec un modèle</CardTitle>
              <CardDescription>
                Choisissez un workflow pré-configuré pour automatiser vos tâches courantes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {templates?.map((template) => (
                  <WorkflowTemplateCard
                    key={template.id}
                    id={template.id}
                    name={template.name}
                    description={template.description || ""}
                    category={template.templateCategory || "other"}
                    triggerType={template.triggerType}
                    actionCount={(template.actions as any[])?.length || 0}
                    onSelect={(id) => router.push(`/workflows/new?template=${id}`)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              Ou créez un workflow personnalisé depuis le début
            </p>
            <Button
              variant="outline"
              onClick={() => router.push("/workflows/new")}
              className="min-h-[44px]"
            >
              Créer un workflow personnalisé
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un workflow..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 min-h-[44px]"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[200px] min-h-[44px]">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                <SelectItem value="contract_management">Gestion des contrats</SelectItem>
                <SelectItem value="payroll">Paie</SelectItem>
                <SelectItem value="onboarding">Onboarding</SelectItem>
                <SelectItem value="offboarding">Offboarding</SelectItem>
                <SelectItem value="other">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabs */}
          <Tabs value={status} onValueChange={(v) => setStatus(v as any)}>
            <TabsList className="mb-6">
              <TabsTrigger value="all">Tous</TabsTrigger>
              <TabsTrigger value="active">Actifs</TabsTrigger>
              <TabsTrigger value="draft">Brouillons</TabsTrigger>
              <TabsTrigger value="paused">En pause</TabsTrigger>
              <TabsTrigger value="archived">Archivés</TabsTrigger>
            </TabsList>

            <TabsContent value={status}>
              {isLoading ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Chargement des workflows...</p>
                </div>
              ) : filteredWorkflows && filteredWorkflows.length > 0 ? (
                <div className="space-y-4">
                  {filteredWorkflows.map((workflow) => (
                    <WorkflowListItem
                      key={workflow.id}
                      workflow={workflow}
                      onView={(id) => router.push(`/workflows/${id}`)}
                      onEdit={(id) => router.push(`/workflows/${id}?edit=true`)}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <WorkflowIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">
                      {searchQuery || categoryFilter !== "all"
                        ? "Aucun workflow trouvé avec ces filtres"
                        : `Aucun workflow ${status === "all" ? "" : status}`}
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
