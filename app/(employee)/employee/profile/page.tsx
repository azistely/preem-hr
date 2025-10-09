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
              {(employee as any).firstName} {(employee as any).lastName}
            </h1>
            <p className="text-muted-foreground mt-2">
              {(employee as any).preferredName && `(${(employee as any).preferredName}) • `}
              Employé #{(employee as any).employeeNumber}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge((employee as any).status)}
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
                  <p className="font-semibold">{(employee as any).email}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Téléphone</p>
                  <p className="font-semibold">{(employee as any).phone || 'Non renseigné'}</p>
                </div>
              </div>

              {(employee as any).dateOfBirth && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Date de naissance</p>
                    <p className="font-semibold">
                      {format(new Date((employee as any).dateOfBirth), 'dd MMMM yyyy', { locale: fr })}
                    </p>
                  </div>
                </div>
              )}

              {(employee as any).gender && (
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Genre</p>
                    <p className="font-semibold">
                      {(employee as any).gender === 'male' ? 'Masculin' :
                       (employee as any).gender === 'female' ? 'Féminin' :
                       (employee as any).gender === 'other' ? 'Autre' : 'Non spécifié'}
                    </p>
                  </div>
                </div>
              )}

              {((employee as any).addressLine1 || (employee as any).city) && (
                <div className="flex items-start gap-3 md:col-span-2">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Adresse</p>
                    <p className="font-semibold">
                      {(employee as any).addressLine1}
                      {(employee as any).addressLine2 && <>, {(employee as any).addressLine2}</>}
                      <br />
                      {(employee as any).city} {(employee as any).postalCode}
                      {(employee as any).countryCode && <>, {(employee as any).countryCode}</>}
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
                    {format(new Date((employee as any).hireDate), 'dd MMMM yyyy', { locale: fr })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Coefficient</p>
                  <p className="font-semibold">{(employee as any).coefficient}</p>
                </div>
              </div>

              {(employee as any).terminationDate && (
                <div className="flex items-start gap-3 md:col-span-2">
                  <Calendar className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Date de cessation</p>
                    <p className="font-semibold text-destructive">
                      {format(new Date((employee as any).terminationDate), 'dd MMMM yyyy', { locale: fr })}
                      {(employee as any).terminationReason && ` - ${(employee as any).terminationReason}`}
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
              {(employee as any).bankName && (
                <div className="flex items-start gap-3">
                  <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Banque</p>
                    <p className="font-semibold">{(employee as any).bankName}</p>
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

              {(employee as any).cnpsNumber && (
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Numéro CNPS</p>
                    <p className="font-semibold font-mono">{(employee as any).cnpsNumber}</p>
                  </div>
                </div>
              )}

              {(employee as any).taxNumber && (
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Numéro fiscal</p>
                    <p className="font-semibold font-mono">{(employee as any).taxNumber}</p>
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
                  <p className="font-semibold">{(employee as any).taxDependents || 0}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
