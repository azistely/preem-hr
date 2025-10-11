"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/trpc/react";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = {
  success: "#22c55e",
  failed: "#ef4444",
  skipped: "#f59e0b",
  running: "#3b82f6",
};

export default function WorkflowAnalyticsPage() {
  const { data: workflowsData } = api.workflows.list.useQuery({
    limit: 100,
    offset: 0,
  });

  // Calculate aggregate statistics
  const stats = {
    total: workflowsData?.total || 0,
    active: workflowsData?.workflows.filter((w: any) => w.status === "active").length || 0,
    draft: workflowsData?.workflows.filter((w: any) => w.status === "draft").length || 0,
    paused: workflowsData?.workflows.filter((w: any) => w.status === "paused").length || 0,
    totalExecutions: workflowsData?.workflows.reduce((sum: number, w: any) => sum + (w.executionCount || 0), 0) || 0,
    totalSuccess: workflowsData?.workflows.reduce((sum: number, w: any) => sum + (w.successCount || 0), 0) || 0,
    totalErrors: workflowsData?.workflows.reduce((sum: number, w: any) => sum + (w.errorCount || 0), 0) || 0,
  };

  const successRate = stats.totalExecutions > 0
    ? ((stats.totalSuccess / stats.totalExecutions) * 100).toFixed(1)
    : "0";

  // Status distribution for pie chart
  const statusData = [
    { name: "Actifs", value: stats.active, color: COLORS.success },
    { name: "Brouillons", value: stats.draft, color: "#94a3b8" },
    { name: "En pause", value: stats.paused, color: COLORS.skipped },
  ].filter(item => item.value > 0);

  // Execution results for pie chart
  const executionData = [
    { name: "Succès", value: stats.totalSuccess, color: COLORS.success },
    { name: "Échecs", value: stats.totalErrors, color: COLORS.failed },
  ].filter(item => item.value > 0);

  // Top workflows by execution count
  const topWorkflows = [...(workflowsData?.workflows || [])]
    .sort((a: any, b: any) => (b.executionCount || 0) - (a.executionCount || 0))
    .slice(0, 10)
    .map((w: any) => ({
      name: w.name.length > 30 ? w.name.substring(0, 30) + "..." : w.name,
      executions: w.executionCount || 0,
      success: w.successCount || 0,
      errors: w.errorCount || 0,
    }));

  // Template category distribution
  const categoryData = workflowsData?.workflows.reduce((acc: any, w: any) => {
    const cat = w.templateCategory || "autre";
    if (!acc[cat]) acc[cat] = 0;
    acc[cat]++;
    return acc;
  }, {});

  const categoryChartData = Object.entries(categoryData || {}).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  return (
    <div className="container py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <BarChart3 className="h-8 w-8" />
          Analytiques des Workflows
        </h1>
        <p className="text-muted-foreground mt-2">
          Statistiques et performances de vos workflows automatisés
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Workflows</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.active} actifs, {stats.draft} brouillons
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exécutions totales</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalExecutions}</div>
            <p className="text-xs text-muted-foreground">
              Toutes les exécutions confondues
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de réussite</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{successRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalSuccess} succès sur {stats.totalExecutions}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Échecs</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.totalErrors}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalExecutions > 0 ? ((stats.totalErrors / stats.totalExecutions) * 100).toFixed(1) : 0}% d'échecs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="status" className="space-y-4">
        <TabsList>
          <TabsTrigger value="status">Statuts</TabsTrigger>
          <TabsTrigger value="executions">Exécutions</TabsTrigger>
          <TabsTrigger value="categories">Catégories</TabsTrigger>
          <TabsTrigger value="top">Top 10</TabsTrigger>
        </TabsList>

        {/* Status Distribution */}
        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Distribution des statuts</CardTitle>
              <CardDescription>
                Répartition des workflows par statut
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  Aucune donnée disponible
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Execution Results */}
        <TabsContent value="executions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Résultats d'exécution</CardTitle>
              <CardDescription>
                Répartition succès vs échecs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {executionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={executionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {executionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  Aucune exécution enregistrée
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Category Distribution */}
        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workflows par catégorie</CardTitle>
              <CardDescription>
                Distribution des workflows selon leur catégorie
              </CardDescription>
            </CardHeader>
            <CardContent>
              {categoryChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  Aucune donnée disponible
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Workflows */}
        <TabsContent value="top" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top 10 workflows</CardTitle>
              <CardDescription>
                Workflows les plus exécutés
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topWorkflows.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={topWorkflows} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="success" name="Succès" fill={COLORS.success} />
                    <Bar dataKey="errors" name="Échecs" fill={COLORS.failed} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                  Aucun workflow avec des exécutions
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Insights */}
      {stats.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Insights et recommandations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.draft > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                <Activity className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    {stats.draft} workflow(s) en brouillon
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Activez vos workflows brouillons pour commencer à automatiser vos processus
                  </p>
                </div>
              </div>
            )}

            {stats.totalErrors > 0 && stats.totalExecutions > 0 && (stats.totalErrors / stats.totalExecutions) > 0.1 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900 dark:text-red-100">
                    Taux d'échec élevé ({((stats.totalErrors / stats.totalExecutions) * 100).toFixed(1)}%)
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Vérifiez les logs d'exécution pour identifier et corriger les problèmes
                  </p>
                </div>
              </div>
            )}

            {stats.totalSuccess > 50 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">
                    Excellent taux de réussite !
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Vos workflows fonctionnent bien. Envisagez d'en créer d'autres pour automatiser plus de tâches.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
