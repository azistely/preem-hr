/**
 * Navigation System Configuration
 * HCI-Compliant Task-Oriented Navigation for Low Digital Literacy Users
 *
 * Design Principles:
 * 1. Task-oriented (group by user goals, not system features)
 * 2. Role-based filtering (show only what users need)
 * 3. Progressive disclosure (primary, advanced, contextual)
 * 4. French language throughout
 * 5. Touch-friendly (min 44px targets)
 */

import {
  Home,
  FileText,
  Clock,
  Calendar,
  User,
  Users,
  CheckSquare,
  BarChart,
  Settings,
  UserCheck,
  DollarSign,
  Play,
  History,
  Calculator,
  Receipt,
  UserPlus,
  Upload,
  Building,
  Briefcase,
  MapPin,
  Umbrella,
  TrendingUp,
  Shield,
  Sparkles,
  CalendarClock,
  BookOpen,
  AlertCircle,
  ClipboardCheck,
  Award,
  FileStack,
  ShieldCheck,
  Database,
  Zap,
  CheckCircle,
  LucideIcon,
  List,
  BarChart3,
  CalendarCheck,
} from "lucide-react";

export type UserRole = 'employee' | 'manager' | 'hr_manager' | 'tenant_admin' | 'super_admin';

export interface NavigationItem {
  id: string;
  label: string;
  href?: string;
  icon: LucideIcon;
  badge?: { count: number; variant: 'default' | 'warning' | 'destructive' };
  description?: string;
  roles?: UserRole[];
  children?: NavigationItem[];
}

export interface NavigationSection {
  id: string;
  title: string;
  items: NavigationItem[];
}

// ============================================================================
// EMPLOYEE NAVIGATION (6 items total)
// ============================================================================

export const employeeNavigation: NavigationSection[] = [
  {
    id: 'main',
    title: '',
    items: [
      {
        id: 'dashboard',
        label: 'Tableau de bord',
        href: '/employee/dashboard',
        icon: Home,
        description: 'Accueil',
      },
    ],
  },
  {
    id: 'work',
    title: 'Mon Travail',
    items: [
      {
        id: 'time-tracking',
        label: 'Pointage',
        href: '/time-tracking',
        icon: Clock,
        description: 'Enregistrer mes heures',
      },
      {
        id: 'leave-request',
        label: 'Demander Congé',
        href: '/time-off',
        icon: Calendar,
        description: 'Soumettre une demande',
      },
    ],
  },
  {
    id: 'payroll',
    title: 'Ma Paie',
    items: [
      {
        id: 'payslips',
        label: 'Mes Bulletins',
        href: '/employee/payslips',
        icon: FileText,
        description: 'Consulter mes bulletins de paie',
      },
    ],
  },
  {
    id: 'profile',
    title: 'Mon Profil',
    items: [
      {
        id: 'my-info',
        label: 'Mes Informations',
        href: '/employee/profile',
        icon: User,
        description: 'Voir mon profil',
      },
      {
        id: 'documents',
        label: 'Mes Documents',
        href: '/employee/documents',
        icon: FileStack,
        description: 'Contrats, attestations',
      },
    ],
  },
];

// ============================================================================
// MANAGER NAVIGATION (7 items total)
// ============================================================================

export const managerNavigation: NavigationSection[] = [
  {
    id: 'main',
    title: '',
    items: [
      {
        id: 'dashboard',
        label: 'Tableau de Bord',
        href: '/manager/dashboard',
        icon: Home,
        description: 'Vue d\'ensemble de mon équipe',
      },
    ],
  },
  {
    id: 'team',
    title: 'Mon Équipe',
    items: [
      {
        id: 'team-list',
        label: 'Liste Équipe',
        href: '/manager/team',
        icon: Users,
        description: 'Voir mes collaborateurs',
      },
      {
        id: 'time-tracking',
        label: 'Pointages',
        href: '/manager/time-tracking',
        icon: Clock,
        description: 'Consulter les heures travaillées',
      },
    ],
  },
  {
    id: 'approvals',
    title: 'Validations',
    items: [
      {
        id: 'leave-approvals',
        label: 'Congés à Valider',
        href: '/manager/time-off/approvals',
        icon: CheckSquare,
        description: 'Approuver les demandes',
      },
    ],
  },
  {
    id: 'reports',
    title: 'Rapports',
    items: [
      {
        id: 'overtime',
        label: 'Heures Supplémentaires',
        href: '/manager/reports/overtime',
        icon: BarChart,
        description: 'Rapport des heures sup',
      },
    ],
  },
];

// ============================================================================
// HR MANAGER NAVIGATION (Primary + Advanced)
// ============================================================================

export const hrManagerNavigation: NavigationSection[] = [
  {
    id: 'main',
    title: '',
    items: [
      {
        id: 'dashboard',
        label: 'Tableau de Bord',
        href: '/admin/dashboard',
        icon: Home,
        description: 'Vue d\'ensemble RH',
      },
    ],
  },
  {
    id: 'payroll',
    title: 'Paie',
    items: [
      {
        id: 'payroll-new',
        label: 'Lancer la Paie',
        href: '/payroll/runs/new',
        icon: Play,
        description: 'Créer un nouveau cycle de paie',
      },
      {
        id: 'payroll-history',
        label: 'Cycles de Paie',
        href: '/payroll/runs',
        icon: History,
        description: 'Historique des paies',
      },
      {
        id: 'bonuses',
        label: 'Primes et Variables',
        href: '/payroll/bonuses',
        icon: Award,
        description: 'Gestion des primes et bonus',
      },
      {
        id: 'payroll-calculator',
        label: 'Calculatrice Paie',
        href: '/payroll/calculator',
        icon: Calculator,
        description: 'Simuler un calcul de paie',
      },
    ],
  },
  {
    id: 'employees',
    title: 'Employés',
    items: [
      {
        id: 'employees-list',
        label: 'Liste des Employés',
        href: '/employees',
        icon: Users,
        description: 'Tous les employés',
      },
      {
        id: 'employees-new',
        label: 'Ajouter un Employé',
        href: '/employees/new',
        icon: UserPlus,
        description: 'Nouvel employé',
      },
      {
        id: 'contracts',
        label: 'Contrats',
        href: '/contracts',
        icon: FileText,
        description: 'Gestion des contrats',
      },
      {
        id: 'positions',
        label: 'Postes',
        href: '/positions',
        icon: Briefcase,
        description: 'Définition des postes',
      },
    ],
  },
  {
    id: 'time-leave',
    title: 'Temps et Congés',
    items: [
      {
        id: 'time-entries',
        label: 'Pointages',
        href: '/admin/time-tracking',
        icon: Clock,
        description: 'Approbations pointages',
      },
      {
        id: 'work-schedules',
        label: 'Horaires de Travail',
        href: '/horaires',
        icon: CalendarClock,
        description: 'Planification des horaires',
      },
      {
        id: 'leave-requests',
        label: 'Demandes de Congés',
        href: '/admin/time-off',
        icon: CalendarCheck,
        description: 'Gérer les demandes',
      },
      {
        id: 'leave-balances',
        label: 'Soldes de Congés',
        href: '/leave/balances',
        icon: BarChart3,
        description: 'Consulter les soldes',
      },
    ],
  },
  {
    id: 'compliance',
    title: 'Conformité',
    items: [
      {
        id: 'registre-personnel',
        label: 'Registre du Personnel',
        href: '/compliance/registre',
        icon: BookOpen,
        description: 'Registre obligatoire des employés',
      },
      {
        id: 'cdd-tracking',
        label: 'Suivi des CDD',
        href: '/compliance/cdd',
        icon: AlertCircle,
        description: 'Contrôle des contrats à durée déterminée',
      },
      {
        id: 'declarations',
        label: 'Déclarations Sociales',
        href: '/compliance/declarations',
        icon: FileText,
        description: 'Export CNPS/IPRES',
      },
      {
        id: 'inspection',
        label: 'Inspection du Travail',
        href: '/compliance/inspection',
        icon: ClipboardCheck,
        description: 'Documents pour inspection',
      },
    ],
  },
  {
    id: 'automation',
    title: 'Automatisation',
    items: [
      {
        id: 'automation-hub',
        label: 'Rappels Automatiques',
        href: '/automation',
        icon: Zap,
        description: 'Automatiser les tâches répétitives',
      },
    ],
  },
  {
    id: 'reports',
    title: 'Rapports',
    items: [
      {
        id: 'reports-main',
        label: 'Tous les Rapports',
        href: '/reports',
        icon: BarChart,
        description: 'Analyses et statistiques',
      },
    ],
  },
];

// HR Manager Advanced Features (Collapsible)
export const hrManagerAdvancedNavigation: NavigationSection[] = [
  {
    id: 'advanced-hr',
    title: 'Gestion Avancée',
    items: [
      {
        id: 'org-chart',
        label: 'Organigramme',
        href: '/positions/org-chart',
        icon: TrendingUp,
        description: 'Structure hiérarchique',
      },
      {
        id: 'salaries',
        label: 'Historique Salaires',
        href: '/salaries',
        icon: DollarSign,
        description: 'Évolution des salaires',
      },
      {
        id: 'salary-bands',
        label: 'Bandes Salariales',
        href: '/salaries/bands',
        icon: Receipt,
        description: 'Fourchettes par poste',
      },
      {
        id: 'locations',
        label: 'Sites et Établissements',
        href: '/settings/locations',
        icon: MapPin,
        description: 'Gestion des sites',
      },
      {
        id: 'geofencing',
        label: 'Géolocalisation',
        href: '/admin/geofencing',
        icon: MapPin,
        description: 'Zones de pointage',
      },
      {
        id: 'public-holidays',
        label: 'Jours Fériés',
        href: '/admin/public-holidays',
        icon: Calendar,
        description: 'Calendrier des jours fériés',
      },
    ],
  },
  {
    id: 'advanced-config',
    title: 'Configuration',
    items: [
      {
        id: 'leave-policies',
        label: 'Politiques de Congés',
        href: '/admin/policies/time-off',
        icon: Umbrella,
        description: 'Règles de congés',
      },
      {
        id: 'salary-components',
        label: 'Composants Salaire',
        href: '/settings/salary-components',
        icon: Settings,
        description: 'Éléments de paie',
      },
      {
        id: 'sectors',
        label: 'Secteurs d\'Activité',
        href: '/settings/sectors',
        icon: Building,
        description: 'Définition des secteurs',
      },
      {
        id: 'templates',
        label: 'Modèles de Documents',
        href: '/settings/templates',
        icon: FileText,
        description: 'Certificats, attestations',
      },
    ],
  },
];

// ============================================================================
// ADMIN NAVIGATION (HR Manager + Admin-specific)
// ============================================================================

export const adminOnlyNavigation: NavigationSection[] = [
  {
    id: 'administration',
    title: 'Administration',
    items: [
      {
        id: 'users',
        label: 'Utilisateurs',
        href: '/admin/settings/users',
        icon: Users,
        description: 'Gestion des utilisateurs',
      },
      {
        id: 'roles',
        label: 'Rôles et Permissions',
        href: '/admin/settings/roles',
        icon: ShieldCheck,
        description: 'Contrôle d\'accès',
      },
      {
        id: 'company',
        label: 'Paramètres Société',
        href: '/admin/settings/company',
        icon: Building,
        description: 'Informations entreprise',
      },
    ],
  },
  {
    id: 'security',
    title: 'Sécurité et Audit',
    items: [
      {
        id: 'security',
        label: 'Sécurité',
        href: '/admin/settings/security',
        icon: Shield,
        description: 'Paramètres de sécurité',
      },
      {
        id: 'audit-log',
        label: 'Journal d\'Audit',
        href: '/admin/audit-log',
        icon: History,
        description: 'Traçabilité des actions',
      },
    ],
  },
];

export const adminAdvancedNavigation: NavigationSection[] = [
  {
    id: 'integrations',
    title: 'Intégrations et Données',
    items: [
      {
        id: 'accounting',
        label: 'Comptabilité',
        href: '/settings/accounting',
        icon: Calculator,
        description: 'Configuration exports comptables',
      },
      {
        id: 'data-migration',
        label: 'Migration Sage',
        href: '/settings/data-migration',
        icon: Database,
        description: 'Import depuis Sage Paie',
      },
      {
        id: 'import-export',
        label: 'Import/Export',
        href: '/admin/employees/import-export',
        icon: Upload,
        description: 'Import en masse',
      },
    ],
  },
  {
    id: 'billing',
    title: 'Facturation',
    items: [
      {
        id: 'billing',
        label: 'Facturation',
        href: '/admin/settings/billing',
        icon: DollarSign,
        description: 'Gestion facturation',
      },
      {
        id: 'costs',
        label: 'Analyse Coûts',
        href: '/admin/settings/costs',
        icon: BarChart,
        description: 'Analyse des coûts',
      },
    ],
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get navigation configuration for a specific role
 */
export function getNavigationByRole(role: UserRole): {
  primary: NavigationSection[];
  advanced: NavigationSection[];
} {
  switch (role) {
    case 'employee':
      return {
        primary: employeeNavigation,
        advanced: [],
      };

    case 'manager':
      return {
        primary: managerNavigation,
        advanced: [],
      };

    case 'hr_manager':
      return {
        primary: hrManagerNavigation,
        advanced: hrManagerAdvancedNavigation,
      };

    case 'tenant_admin':
    case 'super_admin':
      return {
        primary: [
          ...hrManagerNavigation,
          ...adminOnlyNavigation,
        ],
        advanced: [
          ...hrManagerAdvancedNavigation,
          ...adminAdvancedNavigation,
        ],
      };

    default:
      return {
        primary: employeeNavigation,
        advanced: [],
      };
  }
}

/**
 * Flatten navigation sections to simple items (for sidebar compatibility)
 */
export function flattenNavigation(sections: NavigationSection[]): {
  icon: LucideIcon;
  label: string;
  href: string;
  badge?: string | number;
}[] {
  return sections.flatMap(section =>
    section.items
      .filter(item => item.href)
      .map(item => ({
        icon: item.icon,
        label: item.label,
        href: item.href!,
        badge: item.badge?.count,
      }))
  );
}

/**
 * Convert new navigation format to legacy sidebar format
 */
export function convertToLegacySidebarFormat(sections: NavigationSection[]): {
  title: string;
  items: {
    icon: LucideIcon;
    label: string;
    href: string;
    badge?: string | number;
  }[];
}[] {
  return sections.map(section => ({
    title: section.title,
    items: section.items
      .filter(item => item.href)
      .map(item => ({
        icon: item.icon,
        label: item.label,
        href: item.href!,
        badge: item.badge?.count,
      })),
  }));
}

/**
 * Get quick actions for dashboard based on role
 */
export function getDashboardQuickActions(role: UserRole): {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  variant?: 'primary' | 'warning' | 'default' | 'destructive';
  badge?: number;
}[] {
  switch (role) {
    case 'employee':
      return [
        {
          icon: Clock,
          title: 'Pointer l\'Arrivée',
          description: 'Enregistrer mon heure d\'arrivée',
          href: '/time-tracking',
          variant: 'primary',
        },
        {
          icon: Calendar,
          title: 'Demander un Congé',
          description: 'Solde: 15 jours',
          href: '/time-off',
        },
        {
          icon: FileText,
          title: 'Mes Bulletins',
          description: 'Consulter mes bulletins de paie',
          href: '/employee/payslips',
        },
      ];

    case 'manager':
      return [
        {
          icon: CheckSquare,
          title: 'Valider les Pointages',
          description: '5 employés cette semaine',
          href: '/manager/time-tracking',
          badge: 5,
        },
        {
          icon: Calendar,
          title: 'Approuver les Congés',
          description: '3 demandes en attente',
          href: '/manager/time-off/approvals',
          badge: 3,
          variant: 'warning',
        },
        {
          icon: BarChart,
          title: 'Rapport Heures Sup',
          description: 'Vue hebdomadaire',
          href: '/manager/reports/overtime',
        },
      ];

    case 'hr_manager':
    case 'tenant_admin':
    case 'super_admin':
      return [
        {
          icon: Play,
          title: 'Lancer la Paie',
          description: 'Octobre 2025',
          href: '/payroll/runs/new',
          variant: 'primary',
        },
        {
          icon: CheckCircle,
          title: 'Validations',
          description: '12 en attente',
          href: '/admin/time-off',
          badge: 12,
          variant: 'warning',
        },
        {
          icon: UserPlus,
          title: 'Ajouter Employé',
          description: 'Nouveau recrutement',
          href: '/employees/new',
        },
        {
          icon: BookOpen,
          title: 'Registre du Personnel',
          description: 'Conformité légale',
          href: '/compliance/registre',
        },
      ];

    default:
      return [];
  }
}
