/**
 * Employee List Page
 *
 * Lists all employees with filters, search, and pagination
 * Mobile-first responsive: cards on mobile, table on desktop
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Users, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEmployees } from '@/features/employees/hooks/use-employees';
import { EmployeeCard } from '@/features/employees/components/employee-card';
import { EmployeeTable } from '@/features/employees/components/employee-table';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useDebounce } from '@/hooks/use-debounce';

export default function EmployeesPage() {
  const [status, setStatus] = useState<'active' | 'terminated' | 'suspended' | undefined>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

  const isDesktop = useMediaQuery('(min-width: 768px)');

  const { data, isLoading, error } = useEmployees({
    status,
    search: debouncedSearch,
  });

  const employees = data?.employees || [];

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Users className="h-8 w-8" />
            Employés
          </h1>
          <p className="text-muted-foreground mt-2">
            Gérez vos employés et leurs informations
          </p>
        </div>

        <Link href="/employees/new">
          <Button className="min-h-[56px] w-full md:w-auto">
            <Plus className="mr-2 h-5 w-5" />
            Embaucher un employé
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actifs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {employees.filter((e: any) => e.status === 'active').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspendus</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {employees.filter((e: any) => e.status === 'suspended').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cessés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {employees.filter((e: any) => e.status === 'terminated').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou numéro..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 min-h-[48px]"
              />
            </div>

            <Select
              value={status}
              onValueChange={(value: any) => setStatus(value === 'all' ? undefined : value)}
            >
              <SelectTrigger className="min-h-[48px]">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="active">Actifs uniquement</SelectItem>
                <SelectItem value="suspended">Suspendus uniquement</SelectItem>
                <SelectItem value="terminated">Cessés uniquement</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-center">
              Erreur lors du chargement des employés: {error.message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Employee List */}
      {!isLoading && !error && (
        <>
          {employees.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucun employé trouvé</h3>
                <p className="text-muted-foreground mb-6">
                  {searchTerm
                    ? 'Essayez de modifier votre recherche'
                    : 'Commencez par embaucher votre premier employé'}
                </p>
                {!searchTerm && (
                  <Link href="/employees/new">
                    <Button className="min-h-[56px]">
                      <Plus className="mr-2 h-5 w-5" />
                      Embaucher un employé
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Mobile: Card View */}
              {!isDesktop && (
                <div className="grid grid-cols-1 gap-4">
                  {employees.map((employee: any) => (
                    <EmployeeCard key={employee.id} employee={employee} />
                  ))}
                </div>
              )}

              {/* Desktop: Table View */}
              {isDesktop && <EmployeeTable employees={employees as any} />}

              {/* Pagination */}
              {data?.nextCursor && (
                <div className="mt-6 flex justify-center">
                  <Button variant="outline" className="min-h-[44px]">
                    Charger plus
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
