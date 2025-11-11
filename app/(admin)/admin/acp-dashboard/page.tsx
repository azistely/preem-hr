/**
 * ACP Dashboard
 *
 * Central hub for managing ACP (Allocations de Congés Payés) across all employees
 * Following HCI principles:
 * - Summary cards for quick overview
 * - Filterable employee table
 * - Bulk actions for efficiency
 * - Mobile-responsive
 */

'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Wallet,
  Users,
  TrendingUp,
  Search,
  Loader2,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { VirtualizedACPTable } from '@/components/admin/virtualized-acp-table';

type ContractTypeFilter = 'all' | 'CDI' | 'CDD' | 'INTERIM';

const contractTypeLabels: Record<ContractTypeFilter, string> = {
  all: 'Tous les contrats',
  CDI: 'CDI uniquement',
  CDD: 'CDD uniquement',
  INTERIM: 'Intérim uniquement',
};

export default function ACPDashboardPage() {
  const [contractTypeFilter, setContractTypeFilter] = useState<ContractTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch dashboard data
  const {
    data: dashboardData,
    isLoading,
    refetch,
  } = api.acp.getDashboardData.useQuery({
    contractType: contractTypeFilter,
    search: searchQuery || undefined,
  });

  // Calculate summary stats
  const totalEmployees = dashboardData?.length || 0;
  const employeesWithPayments = dashboardData?.filter((d) => d.latestPayment)?.length || 0;
  const totalACPPaid = dashboardData?.reduce((sum, d) => sum + (d.totalPaid || 0), 0) || 0;
  const averageACPPerEmployee = totalEmployees > 0 ? totalACPPaid / totalEmployees : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' FCFA';
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Tableau de bord ACP</h1>
        <p className="text-muted-foreground">
          Vue d'ensemble des Allocations de Congés Payés pour tous les employés
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Employees */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Employés éligibles</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEmployees}</div>
            <p className="text-xs text-muted-foreground">
              CDI + CDD actifs
            </p>
          </CardContent>
        </Card>

        {/* Employees with Payments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avec paiements</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employeesWithPayments}</div>
            <p className="text-xs text-muted-foreground">
              {totalEmployees > 0
                ? `${((employeesWithPayments / totalEmployees) * 100).toFixed(0)}% du total`
                : '0% du total'}
            </p>
          </CardContent>
        </Card>

        {/* Total ACP Paid */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total payé</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalACPPaid)}</div>
            <p className="text-xs text-muted-foreground">
              Tous les paiements historiques
            </p>
          </CardContent>
        </Card>

        {/* Average per Employee */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Moyenne par employé</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(averageACPPerEmployee)}</div>
            <p className="text-xs text-muted-foreground">
              ACP moyen versé
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un employé..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 min-h-[44px]"
                />
              </div>
            </div>

            {/* Contract Type Filter */}
            <div className="md:w-64">
              <Select
                value={contractTypeFilter}
                onValueChange={(value) => setContractTypeFilter(value as ContractTypeFilter)}
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(contractTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee Table */}
      <Card>
        <CardHeader>
          <CardTitle>Employés ({totalEmployees})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && dashboardData && dashboardData.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucun employé trouvé</p>
            </div>
          )}

          {!isLoading && dashboardData && dashboardData.length > 0 && (
            <>
              {/* Use virtualized table for 50+ employees, regular table for smaller lists */}
              {dashboardData.length >= 50 ? (
                <VirtualizedACPTable data={dashboardData} isLoading={isLoading} />
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employé</TableHead>
                        <TableHead>Contrat</TableHead>
                        <TableHead>Dernier paiement</TableHead>
                        <TableHead>Total payé</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboardData.map((item) => (
                        <TableRow key={item.employee.id}>
                          {/* Employee */}
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback>
                                  {getInitials(
                                    item.employee.firstName,
                                    item.employee.lastName
                                  )}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">
                                  {item.employee.firstName} {item.employee.lastName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {item.employee.email}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          {/* Contract Type */}
                          <TableCell>
                            <Badge variant="outline">{item.employee.contractType}</Badge>
                          </TableCell>

                          {/* Latest Payment */}
                          <TableCell>
                            {item.latestPayment ? (
                              <div>
                                <p className="font-medium">
                                  {formatCurrency(Number(item.latestPayment.acpAmount))}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(item.latestPayment.createdAt), 'PPP', {
                                    locale: fr,
                                  })}
                                </p>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Aucun paiement</span>
                            )}
                          </TableCell>

                          {/* Total Paid */}
                          <TableCell>
                            <span className="font-medium">
                              {formatCurrency(item.totalPaid || 0)}
                            </span>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            <Link href={`/employees/${item.employee.id}?tab=time`}>
                              <Button variant="ghost" size="sm" className="min-h-[44px]">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
