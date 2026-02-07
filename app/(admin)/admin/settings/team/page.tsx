/**
 * Team Management Page
 *
 * Allows tenant admin and HR managers to:
 * - View all team members (users with access)
 * - Invite new users (by email or link)
 * - Manage pending invitations
 * - Update user roles
 * - Remove user access
 *
 * Design principles:
 * - Mobile-first (works on 5" phones)
 * - Large touch targets (min 44px)
 * - Clear French messages
 * - Simple wizard for invitations
 */

'use client';

import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Link2,
  Clock,
  Check,
  XCircle,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Copy,
  Shield,
  Crown,
  Briefcase,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { api } from '@/trpc/react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { InviteWizard } from './invite-wizard';

/**
 * Role labels and colors in French
 */
const roleConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  tenant_admin: { label: 'Administrateur', color: 'bg-purple-100 text-purple-700', icon: Crown },
  hr_manager: { label: 'Gestionnaire RH', color: 'bg-blue-100 text-blue-700', icon: Shield },
  manager: { label: 'Manager', color: 'bg-green-100 text-green-700', icon: Users },
  employee: { label: 'Employe', color: 'bg-gray-100 text-gray-700', icon: Users },
};

/**
 * Invitation status badges
 */
const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  accepted: { label: 'Acceptee', color: 'bg-green-100 text-green-700', icon: Check },
  expired: { label: 'Expiree', color: 'bg-gray-100 text-gray-600', icon: Clock },
  revoked: { label: 'Annulee', color: 'bg-red-100 text-red-700', icon: XCircle },
};

/**
 * Team member card component
 */
function TeamMemberCard({
  member,
  onRemove,
}: {
  member: {
    id: string;
    name: string;
    email: string | null;
    role: string;
    avatarUrl?: string | null;
    status: string;
    lastLoginAt?: Date | null;
    employeeId?: string | null;
    joinedAt?: Date | null;
  };
  onRemove?: () => void;
}) {
  const roleInfo = roleConfig[member.role] || roleConfig.employee;
  const RoleIcon = roleInfo.icon;
  const initials = member.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={member.avatarUrl || undefined} alt={member.name} />
          <AvatarFallback className="bg-preem-teal/10 text-preem-teal font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{member.name}</span>
            {member.employeeId && (
              <Badge variant="outline" className="text-xs">
                Employe lie
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{member.email || 'Email non defini'}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge className={`${roleInfo.color} flex items-center gap-1`}>
          <RoleIcon className="h-3 w-3" />
          {roleInfo.label}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled>
              Modifier le role
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onRemove}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Retirer l'acces
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/**
 * Invitation card component
 */
function InvitationCard({
  invitation,
  onResend,
  onRevoke,
  onCopyLink,
  isResending,
}: {
  invitation: {
    id: string;
    email: string | null; // Email can be null for link-only invites
    role: string;
    status: string;
    expiresAt: Date;
    createdAt: Date;
    inviterName: string;
    emailSentAt?: Date | null;
    emailResentCount: number;
  };
  onResend: () => void;
  onRevoke: () => void;
  onCopyLink: () => void;
  isResending?: boolean;
}) {
  const roleInfo = roleConfig[invitation.role] || roleConfig.employee;
  const statusInfo = statusConfig[invitation.status] || statusConfig.pending;
  const StatusIcon = statusInfo.icon;
  const isPending = invitation.status === 'pending';
  const isExpired = new Date() > new Date(invitation.expiresAt);
  const hasEmail = !!invitation.email;

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium">
            {invitation.email || 'Invitation par lien'}
          </span>
          {!hasEmail && (
            <Badge variant="outline" className="text-xs">
              <Link2 className="mr-1 h-3 w-3" />
              Lien seulement
            </Badge>
          )}
          <Badge className={statusInfo.color}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {statusInfo.label}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className={`${roleInfo.color} px-2 py-0.5 rounded text-xs`}>
            {roleInfo.label}
          </span>
          <span>Invite par {invitation.inviterName}</span>
          {isPending && !isExpired && (
            <span>
              Expire le{' '}
              {new Date(invitation.expiresAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
              })}
            </span>
          )}
        </div>
      </div>
      {isPending && !isExpired && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCopyLink}
            className="min-h-[36px]"
          >
            <Link2 className="mr-1 h-4 w-4" />
            Copier
          </Button>
          {/* Only show resend button if invitation has email */}
          {hasEmail && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResend}
              disabled={isResending || invitation.emailResentCount >= 3}
              className="min-h-[36px]"
            >
              {isResending ? (
                <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-1 h-4 w-4" />
              )}
              Renvoyer
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onRevoke}
            className="min-h-[36px] text-destructive hover:text-destructive"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Loading skeleton
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

/**
 * Employee card for inviting existing employees
 */
function EmployeeInviteCard({
  employee,
  onInvite,
  hasPendingInvite,
}: {
  employee: {
    id: string;
    name: string;
    email: string | null;
    jobTitle: string | null;
    employeeNumber: string | null;
  };
  onInvite: () => void;
  hasPendingInvite: boolean;
}) {
  const initials = employee.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarFallback className="bg-amber-100 text-amber-700 font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{employee.name}</span>
            {employee.employeeNumber && (
              <Badge variant="outline" className="text-xs">
                {employee.employeeNumber}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {employee.jobTitle && <span>{employee.jobTitle}</span>}
            {employee.jobTitle && employee.email && <span>•</span>}
            {employee.email && <span>{employee.email}</span>}
            {!employee.email && !employee.jobTitle && <span>Pas d'email configure</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {hasPendingInvite ? (
          <Badge className="bg-yellow-100 text-yellow-700">
            <Clock className="mr-1 h-3 w-3" />
            Invitation en cours
          </Badge>
        ) : (
          <Button
            onClick={onInvite}
            size="sm"
            className="min-h-[36px] bg-preem-teal hover:bg-preem-teal-700"
          >
            <UserPlus className="mr-1 h-4 w-4" />
            Inviter
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Main Team Management Page
 */
export default function TeamManagementPage() {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<{
    id: string;
    email: string | null;
  } | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState('');

  // Fetch team members
  const {
    data: teamData,
    isLoading: teamLoading,
    refetch: refetchTeam,
  } = api.invitations.getTeamMembers.useQuery({ status: 'all' });

  // Fetch invitations
  const {
    data: invitationsData,
    isLoading: invitationsLoading,
    refetch: refetchInvitations,
  } = api.invitations.list.useQuery({ status: 'all' });

  // Fetch employees without user accounts
  const {
    data: employeesData,
    isLoading: employeesLoading,
  } = api.invitations.getInvitableEmployees.useQuery({
    search: employeeSearch || undefined,
    limit: 50,
  });

  // Resend invitation mutation
  const resendMutation = api.invitations.resend.useMutation({
    onSuccess: () => {
      toast.success('Email renvoye avec succes');
      setResendingId(null);
      refetchInvitations();
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || 'Erreur lors du renvoi');
      setResendingId(null);
    },
  });

  // Revoke invitation mutation
  const revokeMutation = api.invitations.revoke.useMutation({
    onSuccess: () => {
      toast.success('Invitation annulee');
      refetchInvitations();
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || 'Erreur lors de l\'annulation');
    },
  });

  // Utils for imperative query calls
  const utils = api.useUtils();

  const handleResend = (invitationId: string) => {
    setResendingId(invitationId);
    resendMutation.mutate({ invitationId });
  };

  const handleRevoke = (invitationId: string) => {
    revokeMutation.mutate({ invitationId });
  };

  const handleCopyLink = async (invitationId: string) => {
    try {
      const data = await utils.invitations.getInviteLink.fetch({ invitationId });
      await navigator.clipboard.writeText(data.inviteUrl);
      toast.success('Lien copie !');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la copie';
      toast.error(message);
    }
  };

  const handleInviteSuccess = () => {
    setInviteDialogOpen(false);
    setSelectedEmployee(null);
    refetchInvitations();
  };

  const handleInviteEmployee = (employee: { id: string; email: string | null }) => {
    setSelectedEmployee(employee);
    setInviteDialogOpen(true);
  };

  const members = teamData?.members || [];
  const invitations = invitationsData?.invitations || [];
  const pendingInvitations = invitations.filter((inv) => inv.status === 'pending');
  const invitableEmployees = employeesData || [];

  // Get employee IDs with pending invitations
  const employeeIdsWithPendingInvites = new Set(
    pendingInvitations
      .filter((inv) => inv.employeeId)
      .map((inv) => inv.employeeId)
  );

  return (
    <div className="min-h-screen p-4 pb-20 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Gestion de l'equipe</h1>
            <p className="text-muted-foreground">
              Gerez les utilisateurs qui ont acces a votre espace Jamana
            </p>
          </div>
          <Dialog
            open={inviteDialogOpen}
            onOpenChange={(open) => {
              setInviteDialogOpen(open);
              if (!open) setSelectedEmployee(null);
            }}
          >
            <DialogTrigger asChild>
              <Button className="min-h-[44px] bg-preem-teal hover:bg-preem-teal-700">
                <UserPlus className="mr-2 h-5 w-5" />
                Inviter un utilisateur
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Inviter un utilisateur</DialogTitle>
                <DialogDescription>
                  {selectedEmployee
                    ? 'Creez un compte utilisateur pour cet employe.'
                    : 'Envoyez une invitation par email ou partagez un lien d\'invitation.'}
                </DialogDescription>
              </DialogHeader>
              <InviteWizard
                onSuccess={handleInviteSuccess}
                onCancel={() => setInviteDialogOpen(false)}
                prefilledEmail={selectedEmployee?.email || undefined}
                prefilledEmployeeId={selectedEmployee?.id}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{members.length}</div>
            <p className="text-sm text-muted-foreground">Utilisateurs actifs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{pendingInvitations.length}</div>
            <p className="text-sm text-muted-foreground">Invitations en cours</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {members.filter((m) => m.role === 'tenant_admin').length}
            </div>
            <p className="text-sm text-muted-foreground">Administrateurs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {members.filter((m) => m.employeeId).length}
            </div>
            <p className="text-sm text-muted-foreground">Employes lies</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="members" className="flex-1 sm:flex-none">
            <Users className="mr-2 h-4 w-4" />
            Utilisateurs ({members.length})
          </TabsTrigger>
          <TabsTrigger value="invitations" className="flex-1 sm:flex-none">
            <Mail className="mr-2 h-4 w-4" />
            Invitations ({pendingInvitations.length})
          </TabsTrigger>
          <TabsTrigger value="employees" className="flex-1 sm:flex-none">
            <Briefcase className="mr-2 h-4 w-4" />
            Employes ({invitableEmployees.length})
          </TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Utilisateurs avec acces</CardTitle>
              <CardDescription>
                Personnes qui peuvent se connecter a votre espace Jamana
              </CardDescription>
            </CardHeader>
            <CardContent>
              {teamLoading ? (
                <LoadingSkeleton />
              ) : members.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>Aucun utilisateur pour le moment</p>
                  <Button
                    variant="link"
                    onClick={() => setInviteDialogOpen(true)}
                    className="mt-2"
                  >
                    Invitez votre premier utilisateur
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => (
                    <TeamMemberCard
                      key={member.id}
                      member={member}
                      onRemove={() => {
                        // TODO: Implement remove user access
                        toast.info('Fonctionnalite a venir');
                      }}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invitations Tab */}
        <TabsContent value="invitations">
          <Card>
            <CardHeader>
              <CardTitle>Invitations</CardTitle>
              <CardDescription>
                Invitations envoyees pour rejoindre votre equipe
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invitationsLoading ? (
                <LoadingSkeleton />
              ) : invitations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>Aucune invitation</p>
                  <Button
                    variant="link"
                    onClick={() => setInviteDialogOpen(true)}
                    className="mt-2"
                  >
                    Envoyez votre premiere invitation
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {invitations.map((invitation) => (
                    <InvitationCard
                      key={invitation.id}
                      invitation={invitation}
                      onResend={() => handleResend(invitation.id)}
                      onRevoke={() => handleRevoke(invitation.id)}
                      onCopyLink={() => handleCopyLink(invitation.id)}
                      isResending={resendingId === invitation.id}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Employees Tab */}
        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <CardTitle>Employes sans compte utilisateur</CardTitle>
              <CardDescription>
                Ces employes sont enregistres mais n'ont pas encore de compte pour se connecter
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un employe..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    className="pl-10 min-h-[44px]"
                  />
                </div>
              </div>

              {employeesLoading ? (
                <LoadingSkeleton />
              ) : invitableEmployees.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Briefcase className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>
                    {employeeSearch
                      ? 'Aucun employe trouve'
                      : 'Tous les employes ont deja un compte utilisateur'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invitableEmployees.map((employee) => (
                    <EmployeeInviteCard
                      key={employee.id}
                      employee={employee}
                      onInvite={() => handleInviteEmployee({ id: employee.id, email: employee.email })}
                      hasPendingInvite={employeeIdsWithPendingInvites.has(employee.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
