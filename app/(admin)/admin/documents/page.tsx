/**
 * Admin Documents Management Page
 * Epic: Document Management System
 *
 * Tenant admins can:
 * - View all documents across the organization
 * - Approve/reject documents requiring approval
 * - Upload documents for any employee
 * - Configure document categories (future)
 * - Manage document retention policies (future)
 *
 * Following HCI principles:
 * - Clear visual hierarchy with status badges
 * - Comprehensive filtering options
 * - Progressive disclosure for advanced features
 */

'use client';

import { useState } from 'react';
import { FileText, CheckCircle, XCircle, Clock, Upload, Settings, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DocumentList, DocumentCategoryDialog } from '@/components/documents';
import { api } from '@/trpc/react';

export default function AdminDocumentsPage() {
  const [activeTab, setActiveTab] = useState<'pending' | 'all' | 'analytics'>('pending');
  const [configDialogOpen, setConfigDialogOpen] = useState(false);

  // Fetch pending documents count for badge
  const { data: pendingCount } = api.documents.getPendingCount.useQuery();

  return (
    <div className="container mx-auto max-w-7xl py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Gestion des Documents</h1>
            <p className="text-muted-foreground mt-2">
              Administration complète des documents de l'organisation
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="min-h-[44px]"
              onClick={() => setConfigDialogOpen(true)}
            >
              <Settings className="mr-2 h-4 w-4" />
              Configurer
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En attente</p>
                <p className="text-2xl font-bold">{pendingCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Approuvés ce mois</p>
                <p className="text-2xl font-bold">-</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Refusés ce mois</p>
                <p className="text-2xl font-bold">-</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total documents</p>
                <p className="text-2xl font-bold">-</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 md:w-[600px]">
          <TabsTrigger value="pending" className="min-h-[44px]">
            <Clock className="mr-2 h-4 w-4" />
            En attente
            {pendingCount && pendingCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" className="min-h-[44px]">
            <FileText className="mr-2 h-4 w-4" />
            Tous les documents
          </TabsTrigger>
          <TabsTrigger value="analytics" className="min-h-[44px]">
            <BarChart3 className="mr-2 h-4 w-4" />
            Statistiques
          </TabsTrigger>
        </TabsList>

        {/* Pending Documents Tab */}
        <TabsContent value="pending" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Documents en attente d'approbation</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentList showActions={true} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Documents Tab */}
        <TabsContent value="all" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tous les documents de l'organisation</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentList showActions={true} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Statistiques des documents</CardTitle>
            </CardHeader>
            <CardContent className="py-12">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Les statistiques détaillées seront bientôt disponibles
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Configuration Dialog */}
      <DocumentCategoryDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
      />
    </div>
  );
}
