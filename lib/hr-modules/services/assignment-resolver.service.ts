/**
 * Assignment Resolver Service
 * Utility functions for workflow step assignee resolution
 *
 * Note: Database operations are handled in the tRPC router (server/routers/hr-workflows.ts)
 * This service provides pure utility functions for assignee resolution logic.
 */

import type { WorkflowAssignmentRole } from '@/lib/db/schema/hr-workflows';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Employee data for assignee resolution
 */
export interface EmployeeData {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  jobTitle?: string | null;
  division?: string | null;
  service?: string | null;
  section?: string | null;
  reportingManagerId?: string | null;
  status: string;
  hireDate: string;
}

/**
 * Assignee resolution result
 */
export interface AssigneeResolutionResult {
  resolved: boolean;
  employeeId?: string;
  employeeName?: string;
  email?: string;
  department?: string;
  jobTitle?: string;
  error?: string;
}

/**
 * Peer selection criteria
 */
export interface PeerSelectionCriteria {
  sameDepartment?: boolean;
  sameTeam?: boolean;
  excludeManagers?: boolean;
  maxPeers?: number;
  minTenureMonths?: number;
}

// ============================================================================
// ROLE LABELS & ICONS
// ============================================================================

/**
 * French labels for assignment roles
 */
export const AssignmentRoleLabels: Record<WorkflowAssignmentRole, string> = {
  employee: 'Collaborateur',
  manager: 'Manager direct',
  skip_level_manager: 'N+2',
  hr_manager: 'Responsable RH',
  hr_admin: 'Admin RH',
  peer: 'Collègue',
  custom: 'Personnalisé',
};

/**
 * Get label for assignment role
 */
export function getAssignmentRoleLabel(role: WorkflowAssignmentRole): string {
  return AssignmentRoleLabels[role] ?? role;
}

/**
 * Icons for assignment roles
 */
export const AssignmentRoleIcons: Record<WorkflowAssignmentRole, string> = {
  employee: 'User',
  manager: 'UserCheck',
  skip_level_manager: 'Users',
  hr_manager: 'Briefcase',
  hr_admin: 'Shield',
  peer: 'Users',
  custom: 'UserCog',
};

/**
 * Get icon for assignment role
 */
export function getAssignmentRoleIcon(role: WorkflowAssignmentRole): string {
  return AssignmentRoleIcons[role] ?? 'User';
}

// ============================================================================
// ASSIGNEE RESOLUTION HELPERS
// ============================================================================

/**
 * Build assignee result from employee data
 */
export function buildAssigneeResult(employee: EmployeeData): AssigneeResolutionResult {
  return {
    resolved: true,
    employeeId: employee.id,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    email: employee.email ?? undefined,
    department: employee.division ?? employee.service ?? employee.section ?? undefined,
    jobTitle: employee.jobTitle ?? undefined,
  };
}

/**
 * Build error result
 */
export function buildErrorResult(error: string): AssigneeResolutionResult {
  return {
    resolved: false,
    error,
  };
}

/**
 * Check if employee is active
 */
export function isEmployeeActive(employee: EmployeeData): boolean {
  return employee.status === 'active';
}

/**
 * Check if employee can be assigned (active and not terminated)
 */
export function canBeAssigned(employee: EmployeeData): boolean {
  return employee.status === 'active';
}

// ============================================================================
// PEER SELECTION HELPERS
// ============================================================================

/**
 * Filter potential peers based on criteria
 */
export function filterPotentialPeers(
  candidates: EmployeeData[],
  subjectEmployee: EmployeeData,
  criteria: PeerSelectionCriteria
): EmployeeData[] {
  const {
    sameDepartment = true,
    excludeManagers = true,
    maxPeers = 10,
    minTenureMonths = 3,
  } = criteria;

  const now = new Date();
  const minStartDate = new Date(now);
  minStartDate.setMonth(minStartDate.getMonth() - minTenureMonths);

  return candidates
    .filter((candidate) => {
      // Exclude self
      if (candidate.id === subjectEmployee.id) return false;

      // Must be active
      if (!canBeAssigned(candidate)) return false;

      // Check department match if required
      if (sameDepartment) {
        const subjectDept = subjectEmployee.division ?? subjectEmployee.service;
        const candidateDept = candidate.division ?? candidate.service;
        if (subjectDept && candidateDept && subjectDept !== candidateDept) {
          return false;
        }
      }

      // Exclude the subject's manager if required
      if (excludeManagers && subjectEmployee.reportingManagerId === candidate.id) {
        return false;
      }

      // Check tenure
      if (minTenureMonths > 0) {
        const hireDate = new Date(candidate.hireDate);
        if (hireDate > minStartDate) return false;
      }

      return true;
    })
    .slice(0, maxPeers);
}

/**
 * Validate peer selection
 */
export function validatePeerSelection(
  selectedPeerIds: string[],
  subjectEmployeeId: string,
  validEmployeeIds: Set<string>
): { valid: boolean; invalidPeers: string[]; errors: string[] } {
  const errors: string[] = [];
  const invalidPeers: string[] = [];

  for (const peerId of selectedPeerIds) {
    // Can't select yourself
    if (peerId === subjectEmployeeId) {
      invalidPeers.push(peerId);
      errors.push('Impossible de se sélectionner soi-même comme pair');
      continue;
    }

    // Must be a valid employee
    if (!validEmployeeIds.has(peerId)) {
      invalidPeers.push(peerId);
      errors.push(`L'employé ${peerId} n'existe pas ou est inactif`);
    }
  }

  return {
    valid: invalidPeers.length === 0,
    invalidPeers,
    errors,
  };
}

// ============================================================================
// HIERARCHY HELPERS
// ============================================================================

/**
 * Build management chain from employee to top
 * Call this repeatedly with manager lookups in your router/service
 */
export function getManagerChainRoles(depth: number): WorkflowAssignmentRole[] {
  const roles: WorkflowAssignmentRole[] = [];
  if (depth >= 1) roles.push('manager');
  if (depth >= 2) roles.push('skip_level_manager');
  // Beyond N+2, we just have more skip levels (not standard roles)
  return roles;
}

/**
 * Check if an employee is in the management chain
 */
export function isInManagementChain(
  employeeId: string,
  managementChainIds: string[]
): boolean {
  return managementChainIds.includes(employeeId);
}

// ============================================================================
// HR ROLE DETECTION HELPERS
// ============================================================================

/**
 * Check if job title suggests HR role
 */
export function isHrJobTitle(jobTitle: string | null | undefined): boolean {
  if (!jobTitle) return false;
  const normalized = jobTitle.toLowerCase();
  return (
    normalized.includes('rh') ||
    normalized.includes('ressources humaines') ||
    normalized.includes('hr') ||
    normalized.includes('human resources') ||
    normalized.includes('drh') ||
    normalized.includes('directeur des ressources')
  );
}

/**
 * Check if department suggests HR department
 */
export function isHrDepartment(department: string | null | undefined): boolean {
  if (!department) return false;
  const normalized = department.toLowerCase();
  return (
    normalized.includes('rh') ||
    normalized.includes('ressources humaines') ||
    normalized.includes('hr') ||
    normalized.includes('human resources')
  );
}

/**
 * Score how likely an employee is to be an HR manager (higher = more likely)
 */
export function getHrLikelihoodScore(employee: EmployeeData): number {
  let score = 0;

  // Check job title
  if (isHrJobTitle(employee.jobTitle)) {
    score += 10;
    if (employee.jobTitle?.toLowerCase().includes('directeur')) score += 5;
    if (employee.jobTitle?.toLowerCase().includes('responsable')) score += 3;
    if (employee.jobTitle?.toLowerCase().includes('manager')) score += 3;
  }

  // Check department
  if (isHrDepartment(employee.division) || isHrDepartment(employee.service)) {
    score += 5;
  }

  return score;
}

/**
 * Sort employees by HR likelihood
 */
export function sortByHrLikelihood(employees: EmployeeData[]): EmployeeData[] {
  return [...employees].sort((a, b) => {
    const scoreA = getHrLikelihoodScore(a);
    const scoreB = getHrLikelihoodScore(b);
    return scoreB - scoreA; // Higher score first
  });
}

// ============================================================================
// DELEGATION HELPERS
// ============================================================================

/**
 * Check if step can be delegated
 */
export function canDelegateStep(
  stepType: string,
  allowDelegation?: boolean
): boolean {
  // Approval steps typically support delegation
  if (stepType === 'approval' && allowDelegation !== false) {
    return true;
  }
  // Review steps can sometimes be delegated
  if (stepType === 'review' && allowDelegation === true) {
    return true;
  }
  return false;
}

/**
 * Get valid delegation targets based on role
 */
export function getValidDelegationRoles(
  currentRole: WorkflowAssignmentRole
): WorkflowAssignmentRole[] {
  switch (currentRole) {
    case 'manager':
      return ['skip_level_manager', 'hr_manager', 'peer'];
    case 'skip_level_manager':
      return ['hr_manager'];
    case 'hr_manager':
      return ['hr_admin'];
    case 'hr_admin':
      return []; // HR admin cannot delegate
    default:
      return [];
  }
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Format assignee display name
 */
export function formatAssigneeName(result: AssigneeResolutionResult): string {
  if (!result.resolved) return 'Non assigné';
  return result.employeeName ?? 'Inconnu';
}

/**
 * Format assignee with role
 */
export function formatAssigneeWithRole(
  result: AssigneeResolutionResult,
  role: WorkflowAssignmentRole
): string {
  const name = formatAssigneeName(result);
  const roleLabel = getAssignmentRoleLabel(role);
  return `${name} (${roleLabel})`;
}

/**
 * Get assignee avatar initials
 */
export function getAssigneeInitials(result: AssigneeResolutionResult): string {
  if (!result.resolved || !result.employeeName) return '?';
  const parts = result.employeeName.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return result.employeeName.substring(0, 2).toUpperCase();
}
