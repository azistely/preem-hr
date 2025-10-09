/**
 * Manager Team Roster Page (P0-4)
 *
 * Task-oriented design: "Voir mon équipe"
 * Following HCI principles:
 * - Zero learning curve (familiar table + cards view)
 * - Smart defaults (active employees only, sortable)
 * - Progressive disclosure (summary → contact details)
 * - Mobile-first (responsive cards on small screens)
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Calendar,
  Loader2,
  Users,
  ChevronDown,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useCurrentEmployee } from '@/hooks/use-current-employee';

export default function ManagerTeamRosterPage() {
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  // Get current manager's employee record
  const { employeeId: managerId, isLoading: managerLoading } = useCurrentEmployee();

  // Fetch team members (employees reporting to this manager)
  const { data: teamMembers, isLoading: teamLoading } = trpc.employees.getTeamMembers.useQuery(
    { managerId: managerId || '' },
    { enabled: !!managerId }
  );

  const isLoading = managerLoading || teamLoading;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-600">Actif</Badge>;
      case 'terminated':
        return <Badge variant="destructive">Terminé</Badge>;
      case 'suspended':
        return <Badge variant="secondary">Suspendu</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto max-w-7xl py-8 px-4">
      {/* Header - Level 1: Essential */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Mon équipe</h1>
        <p className="text-muted-foreground mt-2">
          {teamMembers?.length || 0} employé{teamMembers && teamMembers.length > 1 ? 's' : ''} sous votre responsabilité
        </p>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Chargement de l'équipe...</span>
            </div>
          </CardContent>
        </Card>
      ) : !teamMembers || teamMembers.length === 0 ? (
        /* Empty State */
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-semibold">Aucun membre d'équipe</p>
              <p className="text-sm text-muted-foreground mt-2">
                Aucun employé ne vous est assigné pour le moment
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Team Members List */
        <div className="space-y-4">
          {teamMembers.map((employee) => {
            const isExpanded = expandedEmployee === employee.id;

            return (
              <Card key={employee.id} className={isExpanded ? 'border-primary' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-lg">
                          {employee.firstName} {employee.lastName}
                        </CardTitle>
                        {getStatusBadge(employee.status)}
                      </div>
                      <CardDescription>
                        {(employee as any).position || 'Poste non défini'} • #{employee.employeeNumber}
                      </CardDescription>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        Coeff. {employee.coefficient}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Depuis {format(new Date(employee.hireDate), 'MMM yyyy', { locale: fr })}
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {/* Quick Contact - Always Visible */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${employee.email}`} className="text-sm hover:underline">
                        {employee.email}
                      </a>
                    </div>
                    {employee.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${employee.phone}`} className="text-sm hover:underline">
                          {employee.phone}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Progressive Disclosure - Level 2: Detailed Info */}
                  <Collapsible
                    open={isExpanded}
                    onOpenChange={() => setExpandedEmployee(isExpanded ? null : employee.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full min-h-[44px]">
                        {isExpanded ? 'Masquer les détails' : 'Voir les détails'}
                        <ChevronDown
                          className={`ml-2 h-4 w-4 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </Button>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="mt-4">
                      <div className="space-y-4">
                        {/* Personal Information */}
                        <div>
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Informations personnelles
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6">
                            {employee.dateOfBirth && (
                              <div>
                                <p className="text-xs text-muted-foreground">Date de naissance</p>
                                <p className="text-sm font-semibold">
                                  {format(new Date(employee.dateOfBirth), 'dd MMM yyyy', { locale: fr })}
                                </p>
                              </div>
                            )}
                            {employee.gender && (
                              <div>
                                <p className="text-xs text-muted-foreground">Genre</p>
                                <p className="text-sm font-semibold">
                                  {employee.gender === 'male' ? 'Masculin' :
                                   employee.gender === 'female' ? 'Féminin' : 'Autre'}
                                </p>
                              </div>
                            )}
                            {employee.nationalId && (
                              <div>
                                <p className="text-xs text-muted-foreground">Pièce d'identité</p>
                                <p className="text-sm font-semibold font-mono">{employee.nationalId}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Employment Details */}
                        <div className="pt-3 border-t">
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <Briefcase className="h-4 w-4" />
                            Détails d'emploi
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6">
                            <div>
                              <p className="text-xs text-muted-foreground">Date d'embauche</p>
                              <p className="text-sm font-semibold">
                                {format(new Date(employee.hireDate), 'dd MMMM yyyy', { locale: fr })}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Secteur</p>
                              <p className="text-sm font-semibold">
                                {(employee as any).sector || 'Non défini'}
                              </p>
                            </div>
                            {employee.cnpsNumber && (
                              <div>
                                <p className="text-xs text-muted-foreground">Numéro CNPS</p>
                                <p className="text-sm font-semibold font-mono">{employee.cnpsNumber}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs text-muted-foreground">Personnes à charge</p>
                              <p className="text-sm font-semibold">{employee.taxDependents || 0}</p>
                            </div>
                          </div>
                        </div>

                        {/* Address */}
                        {(employee.addressLine1 || employee.city) && (
                          <div className="pt-3 border-t">
                            <h4 className="font-semibold mb-3">Adresse</h4>
                            <div className="pl-6">
                              <p className="text-sm">
                                {employee.addressLine1}
                                {employee.addressLine2 && <>, {employee.addressLine2}</>}
                                <br />
                                {employee.city} {employee.postalCode}
                                {employee.countryCode && <>, {employee.countryCode}</>}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Termination Info (if applicable) */}
                        {employee.terminationDate && (
                          <div className="pt-3 border-t">
                            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                              <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                Cessation: {format(new Date(employee.terminationDate), 'dd MMM yyyy', { locale: fr })}
                              </p>
                              {employee.terminationReason && (
                                <p className="text-sm text-destructive/80 mt-1">
                                  Raison: {employee.terminationReason}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
