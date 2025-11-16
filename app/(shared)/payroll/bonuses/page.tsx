/**
 * Bonuses List Page - Variable Pay Management
 *
 * Purpose: View and manage employee bonuses/variable pay
 * Features:
 * - List all bonuses with filtering by period, employee, status
 * - Create new bonus (single or bulk)
 * - Approve/reject bonuses
 * - View bonus details
 * - Mobile-responsive design
 */

'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Filter, Download } from 'lucide-react';
import { BonusForm } from '@/features/bonuses/components/bonus-form';
import { BonusesList } from '@/features/bonuses/components/bonuses-list';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function BonusesPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Generate period options (current month + past 12 months)
  const periodOptions = Array.from({ length: 13 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return {
      value: `${year}-${month}-01`,
      label: date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    };
  });

  // Default to current month
  if (!selectedPeriod && periodOptions.length > 0) {
    setSelectedPeriod(periodOptions[0].value);
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Primes et Bonus</h1>
          <p className="text-muted-foreground">
            Gérez les primes de performance, les bonus de fête et autres rémunérations variables
          </p>
        </div>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="min-h-[44px]">
              <Plus className="mr-2 h-5 w-5" />
              Nouvelle Prime
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Créer une nouvelle prime</DialogTitle>
              <DialogDescription>
                Ajoutez une prime pour un employé. Elle sera incluse dans le prochain calcul de paie.
              </DialogDescription>
            </DialogHeader>
            <BonusForm
              onSuccess={() => {
                setIsFormOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4" />
            Filtres:
          </div>

          <div className="flex flex-col gap-4 flex-1 sm:flex-row">
            {/* Period filter */}
            <div className="flex-1 min-w-[200px]">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Sélectionner une période" />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status filter */}
            <div className="flex-1 min-w-[200px]">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="approved">Approuvées</SelectItem>
                  <SelectItem value="paid">Payées</SelectItem>
                  <SelectItem value="cancelled">Annulées</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button variant="outline" size="sm" className="min-h-[44px]">
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>
        </div>
      </Card>

      {/* Bonuses List */}
      <BonusesList
        period={selectedPeriod}
        status={selectedStatus === 'all' ? undefined : selectedStatus}
      />
    </div>
  );
}
