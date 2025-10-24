/**
 * Site Assignment Wizard Page
 *
 * HCI Principles Applied:
 * - Zero Learning Curve: 3-step wizard (Date → Location → Employees → Confirm)
 * - Error Prevention: Can't assign to past dates, can't double-assign same employee
 * - Immediate Feedback: Show "3 employés sélectionnés" as they pick
 * - Task-Oriented: "Affecter des employés" not "Create site assignment"
 * - Touch Targets: All buttons ≥44px, primary action = 56px
 * - Visual Hierarchy: Step breadcrumbs, clear progress indication
 * - Cognitive Load: One question per screen, minimal choices
 *
 * @see docs/HCI-DESIGN-PRINCIPLES.md - Wizard Pattern
 */

'use client';

import { useState } from 'react';
import { Calendar, MapPin, Users, Check, Loader2, Search, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { trpc } from '@/lib/trpc/client';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { format, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type WizardStep = 'date' | 'location' | 'employees' | 'success';

export default function SiteAssignmentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  // Wizard state
  const [step, setStep] = useState<WizardStep>('date');
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Data queries
  const { data: locations, isLoading: isLoadingLocations } = trpc.locations.list.useQuery({
    includeInactive: false,
  });

  const { data: employees, isLoading: isLoadingEmployees } = trpc.employees.list.useQuery(
    { status: 'active' },
    { enabled: step === 'employees' }
  );

  // Assignment mutation
  const assignMutation = trpc.locations.assignEmployees.useMutation({
    onSuccess: () => {
      utils.locations.getAssignmentsByDate.invalidate();
      setStep('success');
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleAssign = () => {
    if (!selectedLocationId || selectedEmployeeIds.length === 0) return;

    assignMutation.mutate({
      locationId: selectedLocationId,
      employeeIds: selectedEmployeeIds,
      assignmentDate: selectedDate,
    });
  };

  const handleReset = () => {
    setStep('date');
    setSelectedDate(startOfDay(new Date()));
    setSelectedLocationId(null);
    setSelectedEmployeeIds([]);
    setSearchQuery('');
  };

  // Filter employees by search
  const employeesList = employees?.employees || [];
  const filteredEmployees = employeesList.filter((emp: any) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      emp.firstName.toLowerCase().includes(searchLower) ||
      emp.lastName.toLowerCase().includes(searchLower) ||
      emp.employeeNumber?.toLowerCase().includes(searchLower)
    );
  });

  const selectedLocation = locations?.find((l) => l.id === selectedLocationId);

  // Breadcrumb component
  const Breadcrumb = () => (
    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
      {step !== 'date' && (
        <>
          <Calendar className="h-4 w-4" />
          <span>{format(selectedDate, 'dd MMM yyyy', { locale: fr })}</span>
        </>
      )}
      {(step === 'employees' || step === 'success') && selectedLocation && (
        <>
          <span>→</span>
          <MapPin className="h-4 w-4" />
          <span>{selectedLocation.locationName}</span>
        </>
      )}
      {step === 'success' && (
        <>
          <span>→</span>
          <Users className="h-4 w-4" />
          <span>{selectedEmployeeIds.length} employés</span>
        </>
      )}
    </div>
  );

  // ============================================================================
  // STEP 1: Date Selection
  // ============================================================================
  if (step === 'date') {
    return (
      <div className="container mx-auto py-8 max-w-md">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Affecter des employés</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">Étape 1 sur 3</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Quelle date?</h3>
              <Input
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="min-h-[48px] text-lg"
              />
              <p className="text-xs text-muted-foreground">
                Sélectionnez la date d'affectation
              </p>
            </div>

            <Button
              onClick={() => setStep('location')}
              className="w-full min-h-[56px]"
              disabled={!selectedDate}
            >
              Suivant
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // STEP 2: Location Selection
  // ============================================================================
  if (step === 'location') {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Header with breadcrumb */}
          <div className="space-y-2">
            <Breadcrumb />
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Quel site?</h2>
                <p className="text-sm text-muted-foreground">Étape 2 sur 3</p>
              </div>
            </div>
          </div>

          {/* Loading state */}
          {isLoadingLocations && (
            <Card>
              <CardContent className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">Chargement des sites...</p>
              </CardContent>
            </Card>
          )}

          {/* Location cards grid */}
          {!isLoadingLocations && locations && locations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {locations.map((location) => {
                const isSelected = selectedLocationId === location.id;
                return (
                  <Card
                    key={location.id}
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-md',
                      isSelected && 'ring-2 ring-primary shadow-md'
                    )}
                    onClick={() => setSelectedLocationId(location.id)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="font-semibold text-lg mb-1">{location.locationName}</p>
                          <p className="text-sm text-muted-foreground">{location.locationCode}</p>
                        </div>
                        {isSelected && (
                          <div className="p-1 bg-primary rounded-full">
                            <Check className="h-4 w-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>

                      {location.city && (
                        <p className="text-sm text-muted-foreground mb-2">{location.city}</p>
                      )}

                      {Number(location.transportAllowance) > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Transport: {Number(location.transportAllowance).toLocaleString('fr-FR')}{' '}
                          FCFA/jour
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {!isLoadingLocations && (!locations || locations.length === 0) && (
            <Card>
              <CardContent className="p-12 text-center">
                <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  Aucun site disponible. Veuillez créer un site d'abord.
                </p>
                <Button onClick={() => router.push('/settings/locations')}>
                  Gérer les sites
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setStep('date')}
              className="min-h-[56px]"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Précédent
            </Button>
            <Button
              onClick={() => setStep('employees')}
              disabled={!selectedLocationId}
              className="flex-1 min-h-[56px]"
            >
              Suivant
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // STEP 3: Employee Selection
  // ============================================================================
  if (step === 'employees') {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Header with breadcrumb */}
          <div className="space-y-2">
            <Breadcrumb />
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Qui affecter?</h2>
                <p className="text-sm text-muted-foreground">Étape 3 sur 3</p>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Rechercher un employé..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="min-h-[48px] pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              {/* Loading state */}
              {isLoadingEmployees && (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                  <p className="text-sm text-muted-foreground mt-2">
                    Chargement des employés...
                  </p>
                </div>
              )}

              {/* Employees list */}
              {!isLoadingEmployees && filteredEmployees && filteredEmployees.length > 0 && (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {filteredEmployees.map((employee: any) => {
                    const isSelected = selectedEmployeeIds.includes(employee.id);
                    return (
                      <div
                        key={employee.id}
                        className={cn(
                          'flex items-center gap-3 p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors',
                          isSelected && 'bg-accent border-primary'
                        )}
                        onClick={() => {
                          setSelectedEmployeeIds((prev) =>
                            prev.includes(employee.id)
                              ? prev.filter((id) => id !== employee.id)
                              : [...prev, employee.id]
                          );
                        }}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => {}}
                          className="pointer-events-none"
                        />
                        <div className="flex-1">
                          <p className="font-medium">
                            {employee.firstName} {employee.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {employee.employeeNumber || 'N/A'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty state */}
              {!isLoadingEmployees && (!filteredEmployees || filteredEmployees.length === 0) && (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {searchQuery
                      ? 'Aucun employé trouvé pour cette recherche'
                      : 'Aucun employé actif'}
                  </p>
                </div>
              )}

              {/* Selection count */}
              {selectedEmployeeIds.length > 0 && (
                <div className="mt-4 p-3 bg-primary/10 rounded-lg">
                  <p className="text-sm font-medium text-center">
                    {selectedEmployeeIds.length} employé
                    {selectedEmployeeIds.length !== 1 ? 's' : ''} sélectionné
                    {selectedEmployeeIds.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Navigation buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setStep('location')}
              className="min-h-[56px]"
              disabled={assignMutation.isPending}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Précédent
            </Button>
            <Button
              onClick={handleAssign}
              disabled={selectedEmployeeIds.length === 0 || assignMutation.isPending}
              className="flex-1 min-h-[56px]"
            >
              {assignMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Affectation...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Affecter
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // STEP 4: Success
  // ============================================================================
  if (step === 'success') {
    return (
      <div className="container mx-auto py-8 max-w-md">
        <Card>
          <CardContent className="p-12 text-center space-y-6">
            {/* Success icon */}
            <div className="flex justify-center">
              <div className="p-4 bg-green-100 rounded-full">
                <Check className="h-12 w-12 text-green-600" />
              </div>
            </div>

            {/* Success message */}
            <div>
              <h2 className="text-2xl font-bold mb-2">Affectation réussie!</h2>
              <p className="text-muted-foreground">
                {selectedEmployeeIds.length} employé
                {selectedEmployeeIds.length !== 1 ? 's' : ''} affecté
                {selectedEmployeeIds.length !== 1 ? 's' : ''} au{' '}
                <span className="font-medium">{selectedLocation?.locationName}</span>
                <br />
                le {format(selectedDate, 'dd MMMM yyyy', { locale: fr })}
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Button onClick={handleReset} className="w-full min-h-[56px]">
                Nouvelle affectation
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/employees')}
                className="w-full min-h-[44px]"
              >
                Retour aux employés
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
