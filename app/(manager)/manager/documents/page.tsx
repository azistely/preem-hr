/**
 * HR Documents Approval Page
 * Epic: Document Management System
 *
 * HR managers can:
 * - View all pending documents requiring approval
 * - Approve/reject documents with reasons
 * - Filter by category and status
 * - Upload documents for employees
 * - View all documents across the organization
 *
 * Following HCI principles:
 * - Clear visual hierarchy with status badges
 * - One-tap approve/reject actions
 * - Progressive disclosure for document details
 */

'use client';

import { useState } from 'react';
import { FileText, CheckCircle, XCircle, Clock, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DocumentList } from '@/components/documents';
import { api } from '@/trpc/react';

export default function HRDocumentsPage() {
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');

  // Fetch pending documents count for badge
  const { data: pendingCount } = api.documents.getPendingCount.useQuery();

  return (
    <div className="container mx-auto max-w-7xl py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Gestion des Documents</h1>
        <p className="text-muted-foreground mt-2">
          Approuver et gérer les documents téléchargés par les employés
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
                <p className="text-sm text-muted-foreground">Approuvés aujourd'hui</p>
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
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'all')} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
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
              <CardTitle>Tous les documents</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentList showActions={true} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
