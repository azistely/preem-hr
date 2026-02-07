"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
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

interface WorkflowChartsProps {
  statusData: { name: string; value: number; color: string }[];
  executionData: { name: string; value: number; color: string }[];
  categoryChartData: { name: string; value: unknown }[];
  topWorkflows: { name: string; executions: number; success: number; errors: number }[];
}

export function WorkflowCharts({
  statusData,
  executionData,
  categoryChartData,
  topWorkflows,
}: WorkflowChartsProps) {
  return (
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
            <CardTitle>Résultats d&apos;exécution</CardTitle>
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
  );
}
