/**
 * Employee Profile Page (P0-3)
 *
 * Task-oriented design: "Consulter mon profil"
 * Following HCI principles:
 * - Zero learning curve (familiar profile card layout)
 * - Smart defaults (all fields pre-populated)
 * - Progressive disclosure (contact → job → bank info)
 * - Mobile-first (responsive sections)
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  DollarSign,
  Building,
  CreditCard,
  FileText,
  Loader2,
  Edit,
} from 'lucide-react';
import { useCurrentEmployee } from '@/hooks/use-current-employee';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useRouter } from 'next/navigation';

export default function EmployeeProfilePage() {
  const { employee, isLoading } = useCurrentEmployee();
  const router = useRouter();

  const formatCurrency = (amount: number | string | null) => {
    if (!amount) return 'Non défini';
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('fr-FR').format(numAmount) + ' FCFA';
  };

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

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Chargement du profil...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-semibold">Profil introuvable</p>
              <p className="text-sm text-muted-foreground mt-2">
                Aucun profil employé associé à votre compte
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      {/* Header - Level 1: Essential */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {employee.firstName} {employee.lastName}
            </h1>
            <p className="text-muted-foreground mt-2">
              {employee.preferredName && `(${employee.preferredName}) • `}
              Employé #{employee.employeeNumber}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(employee.status)}
            <Button
              onClick={() => router.push('/employee/profile/edit')}
              className="min-h-[44px]"
            >
              <Edit className="mr-2 h-4 w-4" />
              Modifier mon profil
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Personal Information - Level 1 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informations personnelles
            </CardTitle>
            <CardDescription>Vos informations de contact et personnelles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-semibold">{employee.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Téléphone</p>
                  <p className="font-semibold">{employee.phone || 'Non renseigné'}</p>
                </div>
              </div>

              {employee.dateOfBirth && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Date de naissance</p>
                    <p className="font-semibold">
                      {format(new Date(employee.dateOfBirth), 'dd MMMM yyyy', { locale: fr })}
                    </p>
                  </div>
                </div>
              )}

              {employee.gender && (
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Genre</p>
                    <p className="font-semibold">
                      {employee.gender === 'male' ? 'Masculin' :
                       employee.gender === 'female' ? 'Féminin' :
                       employee.gender === 'other' ? 'Autre' : 'Non spécifié'}
                    </p>
                  </div>
                </div>
              )}

              {(employee.addressLine1 || employee.city) && (
                <div className="flex items-start gap-3 md:col-span-2">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Adresse</p>
                    <p className="font-semibold">
                      {employee.addressLine1}
                      {employee.addressLine2 && <>, {employee.addressLine2}</>}
                      <br />
                      {employee.city} {employee.postalCode}
                      {employee.countryCode && <>, {employee.countryCode}</>}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Employment Information - Level 1 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Informations professionnelles
            </CardTitle>
            <CardDescription>Votre poste et informations d'emploi</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Poste</p>
                  <p className="font-semibold">{(employee as any).position || 'Non défini'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Secteur</p>
                  <p className="font-semibold">{(employee as any).sector || 'Non défini'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Date d'embauche</p>
                  <p className="font-semibold">
                    {format(new Date(employee.hireDate), 'dd MMMM yyyy', { locale: fr })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Coefficient</p>
                  <p className="font-semibold">{employee.coefficient}</p>
                </div>
              </div>

              {employee.terminationDate && (
                <div className="flex items-start gap-3 md:col-span-2">
                  <Calendar className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Date de cessation</p>
                    <p className="font-semibold text-destructive">
                      {format(new Date(employee.terminationDate), 'dd MMMM yyyy', { locale: fr })}
                      {employee.terminationReason && ` - ${employee.terminationReason}`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tax & Banking - Level 2: Progressive Disclosure */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Informations bancaires et fiscales
            </CardTitle>
            <CardDescription>Informations pour la paie</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {employee.bankName && (
                <div className="flex items-start gap-3">
                  <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Banque</p>
                    <p className="font-semibold">{employee.bankName}</p>
                  </div>
                </div>
              )}

              {employee.bankAccount && (
                <div className="flex items-start gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Compte bancaire</p>
                    <p className="font-semibold font-mono">{employee.bankAccount}</p>
                  </div>
                </div>
              )}

              {employee.cnpsNumber && (
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Numéro CNPS</p>
                    <p className="font-semibold font-mono">{employee.cnpsNumber}</p>
                  </div>
                </div>
              )}

              {employee.taxNumber && (
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Numéro fiscal</p>
                    <p className="font-semibold font-mono">{employee.taxNumber}</p>
                  </div>
                </div>
              )}

              {employee.nationalId && (
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Pièce d'identité</p>
                    <p className="font-semibold font-mono">{employee.nationalId}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Personnes à charge fiscales</p>
                  <p className="font-semibold">{employee.taxDependents || 0}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
