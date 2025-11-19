/**
 * Central Contract Management Page
 *
 * Unified view for all contract types (CDI, CDD, CDDTI, INTERIM, STAGE)
 * with compliance monitoring and bulk operations.
 *
 * Features:
 * - Summary cards (total contracts, by type, expiring soon)
 * - Compliance alerts (CDD 2-year limit, CDDTI 12-month limit)
 * - Filterable contracts table
 * - Quick actions (create, renew, convert, terminate)
 *
 * @see docs/CENTRAL-CONTRACT-MANAGEMENT-SYSTEM.md
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Filter, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/trpc/react';
import { ContractSummaryCards } from './components/contract-summary-cards';
import { ComplianceAlertsSection } from './components/compliance-alerts-section';
import { ContractsTable } from './components/contracts-table';
import { ContractQuickStats } from './components/contract-quick-stats';
import { toast } from 'sonner';

export default function ContractsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const utils = api.useUtils();

  // Trigger manual alert generation
  const generateAlerts = api.compliance.generateAllComplianceAlerts.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setRefreshKey((prev) => prev + 1);
      utils.compliance.getActiveAlerts.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <div className="container py-8 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Contrats</h1>
        <p className="text-muted-foreground">
          Gérez tous les contrats de travail de votre entreprise
        </p>
      </div>

      {/* Summary Cards */}
      <ContractSummaryCards key={`summary-${refreshKey}`} />

      {/* Action Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/contracts/new">
            <Button
              size="lg"
              className="min-h-[56px]"
            >
              <Plus className="mr-2 h-5 w-5" />
              Nouveau contrat
            </Button>
          </Link>

          <Button variant="outline" size="lg" className="min-h-[48px]">
            <Filter className="mr-2 h-4 w-4" />
            Filtrer
          </Button>

          <Button variant="outline" size="lg" className="min-h-[48px]">
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="min-h-[48px]"
            onClick={() => generateAlerts.mutate()}
            disabled={generateAlerts.isPending}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${generateAlerts.isPending ? 'animate-spin' : ''}`}
            />
            Actualiser alertes
          </Button>
        </div>

        <div className="w-full md:w-[300px]">
          <Input
            placeholder="Rechercher un employé ou N° contrat..."
            className="min-h-[48px]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Compliance Alerts Section */}
      <ComplianceAlertsSection key={`alerts-${refreshKey}`} />

      {/* Contracts Table */}
      <ContractsTable searchQuery={searchQuery} key={`table-${refreshKey}`} />

      {/* Quick Stats Footer */}
      <ContractQuickStats key={`stats-${refreshKey}`} />
    </div>
  );
}
