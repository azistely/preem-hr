/**
 * Certifications Tracking Page
 *
 * Track employee certifications with expiry alerts.
 * - View all certifications
 * - Filter by status (active, expiring, expired)
 * - Add/edit certifications
 */

'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format, differenceInDays, isPast, isFuture } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Award,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  ExternalLink,
  Search,
  Clock,
  Building,
  Edit,
} from 'lucide-react';
import { toast } from 'sonner';

// Status styling
const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  expired: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  pending_renewal: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  revoked: 'bg-muted text-muted-foreground',
};

const statusLabels: Record<string, string> = {
  active: 'Active',
  expired: 'Expirée',
  pending_renewal: 'À renouveler',
  revoked: 'Révoquée',
};

// Expiry badge
function ExpiryBadge({ expiryDate, isLifetime }: { expiryDate: string | null; isLifetime: boolean }) {
  if (isLifetime) {
    return (
      <Badge variant="secondary" className="text-xs">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Permanente
      </Badge>
    );
  }

  if (!expiryDate) {
    return null;
  }

  const expiry = new Date(expiryDate);
  const daysUntilExpiry = differenceInDays(expiry, new Date());

  if (isPast(expiry)) {
    return (
      <Badge variant="destructive" className="text-xs">
        <XCircle className="h-3 w-3 mr-1" />
        Expirée
      </Badge>
    );
  }

  if (daysUntilExpiry <= 30) {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs">
        <AlertTriangle className="h-3 w-3 mr-1" />
        {daysUntilExpiry} jours restants
      </Badge>
    );
  }

  if (daysUntilExpiry <= 90) {
    return (
      <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-xs">
        <Clock className="h-3 w-3 mr-1" />
        {daysUntilExpiry} jours
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-xs">
      <Calendar className="h-3 w-3 mr-1" />
      {format(expiry, 'dd MMM yyyy', { locale: fr })}
    </Badge>
  );
}

export default function CertificationsPage() {
  const [selectedTab, setSelectedTab] = useState<'all' | 'active' | 'expiring_soon' | 'expired'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    employeeId: '',
    certificationName: '',
    certificationCode: '',
    issuingOrganization: '',
    category: '',
    issueDate: '',
    expiryDate: '',
    isLifetime: false,
    credentialId: '',
    verificationUrl: '',
  });

  const utils = api.useUtils();

  // Fetch certifications
  const { data: certificationsData, isLoading } = api.training.certifications.list.useQuery({
    status: selectedTab !== 'all' ? selectedTab : undefined,
    limit: 100,
  });

  // Fetch employees for dropdown
  const { data: employeesData } = api.employees.list.useQuery({
    status: 'active',
    limit: 100,
  });

  // Create mutation
  const createCertification = api.training.certifications.create.useMutation({
    onSuccess: () => {
      toast.success('Certification ajoutée avec succès');
      setShowCreateDialog(false);
      resetForm();
      utils.training.certifications.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'ajout');
    },
  });

  const certifications = certificationsData?.data ?? [];
  const employees = employeesData?.employees ?? [];

  // Stats
  const totalActive = certifications.filter((c) => c.status === 'active').length;
  const expiringSoon = certifications.filter((c) => {
    if (!c.expiryDate || c.isLifetime) return false;
    const daysUntil = differenceInDays(new Date(c.expiryDate), new Date());
    return daysUntil > 0 && daysUntil <= 30;
  }).length;
  const expiredCount = certifications.filter((c) => c.status === 'expired').length;

  const resetForm = () => {
    setFormData({
      employeeId: '',
      certificationName: '',
      certificationCode: '',
      issuingOrganization: '',
      category: '',
      issueDate: '',
      expiryDate: '',
      isLifetime: false,
      credentialId: '',
      verificationUrl: '',
    });
  };

  const handleCreate = () => {
    if (!formData.employeeId || !formData.certificationName || !formData.issuingOrganization || !formData.issueDate) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    createCertification.mutate({
      employeeId: formData.employeeId,
      certificationName: formData.certificationName,
      certificationCode: formData.certificationCode || undefined,
      issuingOrganization: formData.issuingOrganization,
      category: formData.category || undefined,
      issueDate: formData.issueDate,
      expiryDate: formData.isLifetime ? undefined : formData.expiryDate || undefined,
      isLifetime: formData.isLifetime,
      credentialId: formData.credentialId || undefined,
      verificationUrl: formData.verificationUrl || undefined,
    });
  };

  // Filter certifications by search
  const filteredCertifications = certifications.filter((cert) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      cert.certificationName.toLowerCase().includes(query) ||
      cert.issuingOrganization.toLowerCase().includes(query) ||
      cert.employee?.firstName?.toLowerCase().includes(query) ||
      cert.employee?.lastName?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Certifications</h1>
          <p className="text-muted-foreground mt-1">
            Suivi des certifications et attestations
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="min-h-[48px]">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une certification
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Actives</p>
                <p className="text-2xl font-bold">{totalActive}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expirent bientôt</p>
                <p className="text-2xl font-bold">{expiringSoon}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 dark:bg-red-900 rounded-lg">
                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expirées</p>
                <p className="text-2xl font-bold">{expiredCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, certification ou organisme..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 min-h-[48px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as typeof selectedTab)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="all" className="min-h-[44px]">
            <Award className="mr-2 h-4 w-4" />
            Toutes
          </TabsTrigger>
          <TabsTrigger value="active" className="min-h-[44px]">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Actives
          </TabsTrigger>
          <TabsTrigger value="expiring_soon" className="min-h-[44px]">
            <AlertTriangle className="mr-2 h-4 w-4" />
            À expirer
          </TabsTrigger>
          <TabsTrigger value="expired" className="min-h-[44px]">
            <XCircle className="mr-2 h-4 w-4" />
            Expirées
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredCertifications.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucune certification</h3>
                <p className="text-muted-foreground mb-6">
                  {searchQuery
                    ? 'Aucune certification ne correspond à votre recherche'
                    : 'Commencez par ajouter une certification'}
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter une certification
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employé</TableHead>
                        <TableHead>Certification</TableHead>
                        <TableHead>Organisme</TableHead>
                        <TableHead>Date d'obtention</TableHead>
                        <TableHead>Expiration</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCertifications.map((cert) => (
                        <TableRow key={cert.id}>
                          <TableCell className="font-medium">
                            {cert.employee?.firstName} {cert.employee?.lastName}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{cert.certificationName}</p>
                              {cert.certificationCode && (
                                <p className="text-xs text-muted-foreground">
                                  {cert.certificationCode}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4 text-muted-foreground" />
                              <span>{cert.issuingOrganization}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(cert.issueDate), 'dd MMM yyyy', { locale: fr })}
                          </TableCell>
                          <TableCell>
                            <ExpiryBadge
                              expiryDate={cert.expiryDate}
                              isLifetime={cert.isLifetime ?? false}
                            />
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[cert.status]}>
                              {statusLabels[cert.status]}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Ajouter une certification</DialogTitle>
            <DialogDescription>
              Enregistrez une nouvelle certification pour un employé
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="employeeId">
                Employé <span className="text-destructive">*</span>
              </Label>
              <select
                id="employeeId"
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                className="w-full min-h-[48px] px-3 rounded-md border border-input bg-background"
              >
                <option value="">Sélectionner un employé</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="certificationName">
                  Nom de la certification <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="certificationName"
                  placeholder="Ex: PMP, AWS Solutions Architect"
                  value={formData.certificationName}
                  onChange={(e) => setFormData({ ...formData, certificationName: e.target.value })}
                  className="min-h-[48px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="certificationCode">Code</Label>
                <Input
                  id="certificationCode"
                  placeholder="Ex: PMP-123456"
                  value={formData.certificationCode}
                  onChange={(e) => setFormData({ ...formData, certificationCode: e.target.value })}
                  className="min-h-[48px]"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="issuingOrganization">
                  Organisme <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="issuingOrganization"
                  placeholder="Ex: PMI, AWS"
                  value={formData.issuingOrganization}
                  onChange={(e) => setFormData({ ...formData, issuingOrganization: e.target.value })}
                  className="min-h-[48px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Catégorie</Label>
                <Input
                  id="category"
                  placeholder="Ex: Gestion de projet, Cloud"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="min-h-[48px]"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="issueDate">
                  Date d'obtention <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={formData.issueDate}
                  onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                  className="min-h-[48px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiryDate">Date d'expiration</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  disabled={formData.isLifetime}
                  className="min-h-[48px]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isLifetime"
                checked={formData.isLifetime}
                onChange={(e) => setFormData({ ...formData, isLifetime: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="isLifetime" className="text-sm font-normal">
                Certification permanente (sans expiration)
              </Label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="credentialId">ID de credential</Label>
                <Input
                  id="credentialId"
                  placeholder="Numéro de certification"
                  value={formData.credentialId}
                  onChange={(e) => setFormData({ ...formData, credentialId: e.target.value })}
                  className="min-h-[48px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="verificationUrl">Lien de vérification</Label>
                <Input
                  id="verificationUrl"
                  type="url"
                  placeholder="https://..."
                  value={formData.verificationUrl}
                  onChange={(e) => setFormData({ ...formData, verificationUrl: e.target.value })}
                  className="min-h-[48px]"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                resetForm();
              }}
              className="min-h-[48px]"
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createCertification.isPending}
              className="min-h-[48px]"
            >
              {createCertification.isPending ? 'Enregistrement...' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
