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
  Bell,
  UserCheck,
  Timer,
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
  Download,
  Shield,
  Workflow,
  FileStack,
  Activity,
  BarChart3,
  Sparkles,
  BookOpen,
  AlertCircle,
  Zap,
  List,
  CalendarClock,
  Award,
  Package,
  ShieldCheck,
  Database,
  Globe,
  FileBarChart,
  Edit3,
  Heart,
  Wallet,
} from "lucide-react";
import { NavItem, NavSection } from "@/components/navigation/sidebar";

// Employee Navigation (SIMPLIFIED - 7 items total)
export const employeeMobileSections: NavSection[] = [
  {
    title: "",
    items: [
      { icon: Home, label: "Accueil", href: "/employee/dashboard" },
    ],
  },
  {
    title: "Mon Travail",
    items: [
      { icon: Clock, label: "Pointage", href: "/time-tracking" },
      { icon: CalendarClock, label: "Mon Planning", href: "/employee/my-schedule" },
      { icon: Calendar, label: "Demander congé", href: "/time-off" },
    ],
  },
  {
    title: "Ma Paie",
    items: [
      { icon: FileText, label: "Mes bulletins", href: "/employee/payslips" },
    ],
  },
  {
    title: "Documents",
    items: [
      { icon: FileStack, label: "Mes documents", href: "/employee/documents" },
    ],
  },
  {
    title: "Mon Profil",
    items: [
      { icon: User, label: "Mes informations", href: "/employee/profile" },
    ],
  },
];

export const employeeDesktopSections: NavSection[] = [
  {
    title: "",
    items: [
      { icon: Home, label: "Tableau de bord", href: "/employee/dashboard" },
    ],
  },
  {
    title: "Mon Travail",
    items: [
      { icon: Clock, label: "Pointage", href: "/time-tracking" },
      { icon: CalendarClock, label: "Mon Planning", href: "/employee/my-schedule" },
      { icon: Calendar, label: "Demander congé", href: "/time-off" },
    ],
  },
  {
    title: "Ma Paie",
    items: [
      { icon: FileText, label: "Mes bulletins", href: "/employee/payslips" },
    ],
  },
  {
    title: "Documents",
    items: [
      { icon: FileStack, label: "Mes documents", href: "/employee/documents" },
    ],
  },
  {
    title: "Mon Profil",
    items: [
      { icon: User, label: "Mes informations", href: "/employee/profile" },
    ],
  },
];

// Manager Navigation (SIMPLIFIED - 8 items total)
export const managerMobileSections: NavSection[] = [
  {
    title: "",
    items: [
      { icon: Home, label: "Accueil", href: "/manager/dashboard" },
    ],
  },
  {
    title: "Mon Équipe",
    items: [
      { icon: Users, label: "Liste équipe", href: "/manager/team" },
      { icon: Clock, label: "Pointages", href: "/manager/time-tracking" },
      { icon: Edit3, label: "Saisie manuelle heures", href: "/manager/time-tracking/manual-entry" },
      { icon: CalendarClock, label: "Planning des Quarts", href: "/manager/shift-planning" },
    ],
  },
  {
    title: "Approbations",
    items: [
      { icon: CheckSquare, label: "Congés à valider", href: "/manager/time-off/approvals" },
    ],
  },
  {
    title: "Rapports",
    items: [
      { icon: BarChart, label: "Heures supplémentaires", href: "/manager/reports/overtime" },
    ],
  },
  {
    title: "Documents",
    items: [
      { icon: FileStack, label: "Documents équipe", href: "/manager/documents" },
    ],
  },
];

export const managerDesktopSections: NavSection[] = [
  {
    title: "",
    items: [
      { icon: Home, label: "Tableau de bord", href: "/manager/dashboard" },
    ],
  },
  {
    title: "Mon Équipe",
    items: [
      { icon: Users, label: "Liste équipe", href: "/manager/team" },
      { icon: Clock, label: "Pointages", href: "/manager/time-tracking" },
      { icon: Edit3, label: "Saisie manuelle heures", href: "/manager/time-tracking/manual-entry" },
      { icon: CalendarClock, label: "Planning des Quarts", href: "/manager/shift-planning" },
    ],
  },
  {
    title: "Approbations",
    items: [
      { icon: CheckSquare, label: "Congés à valider", href: "/manager/time-off/approvals" },
    ],
  },
  {
    title: "Rapports",
    items: [
      { icon: BarChart, label: "Heures supplémentaires", href: "/manager/reports/overtime" },
    ],
  },
  {
    title: "Documents",
    items: [
      { icon: FileStack, label: "Documents équipe", href: "/manager/documents" },
    ],
  },
];

// HR Manager Navigation (STREAMLINED - 12 visible + 7 collapsible)
// HCI-COMPLIANT: Consolidated automation into single task-oriented entry point
export const hrManagerMobileSections: NavSection[] = [
  {
    title: "",
    items: [
      { icon: Home, label: "Accueil", href: "/admin/dashboard" },
    ],
  },
  {
    title: "Paie",
    items: [
      { icon: Play, label: "Lancer la paie", href: "/payroll/runs/new" },
      { icon: History, label: "Historique paies", href: "/payroll/runs" },
      { icon: Award, label: "Primes et variables", href: "/payroll/variable-inputs" },
      { icon: Calculator, label: "Calculatrice", href: "/payroll/calculator" },
      { icon: FileText, label: "Déclaration CNPS", href: "/payroll/cnps-declaration" },
    ],
  },
  {
    title: "Employés",
    items: [
      { icon: Users, label: "Liste employés", href: "/employees" },
      { icon: UserPlus, label: "Nouvel employé", href: "/employees/new" },
      { icon: Briefcase, label: "Postes", href: "/positions" },
      { icon: Heart, label: "Avantages sociaux", href: "/admin/benefits" },
    ],
  },
  {
    title: "Temps & Congés",
    items: [
      { icon: Clock, label: "Approbations pointages", href: "/admin/time-tracking" },
      { icon: Edit3, label: "Saisie manuelle heures", href: "/manager/time-tracking/manual-entry" },
      { icon: Upload, label: "Importer depuis appareil", href: "/admin/time-tracking/import" },
      { icon: CalendarClock, label: "Horaires de travail", href: "/horaires" },
      { icon: Calendar, label: "Planning des Quarts", href: "/admin/shift-planning" },
      { icon: Calendar, label: "Demandes de congé", href: "/admin/time-off" },
      { icon: Wallet, label: "Tableau de bord ACP", href: "/admin/acp-dashboard" },
    ],
  },
  {
    title: "Conformité",
    items: [
      { icon: BookOpen, label: "Registre du personnel", href: "/compliance/registre-personnel" },
      { icon: AlertCircle, label: "Suivi des CDD", href: "/compliance/cdd" },
    ],
  },
  {
    title: "Documents",
    items: [
      { icon: FileStack, label: "Gestion des documents", href: "/admin/documents" },
    ],
  },
  {
    title: "Automatisation",
    items: [
      { icon: Zap, label: "Rappels automatiques", href: "/automation" },
      { icon: Workflow, label: "Flux de travail", href: "/workflows" },
      { icon: List, label: "Opérations en lot", href: "/batch-operations" },
    ],
  },
];

// Advanced features (collapsible) - HCI COMPLIANT
export const hrManagerAdvancedSections: NavSection[] = [
  {
    title: "Gérer les Salaires",
    items: [
      { icon: DollarSign, label: "Historique Salaires", href: "/salaries" },
      { icon: Receipt, label: "Fourchettes par Poste", href: "/salaries/bands" },
      { icon: Upload, label: "Ajuster Plusieurs Salaires", href: "/salaries/bulk-adjustment" },
    ],
  },
  {
    title: "Sites et Équipes",
    items: [
      { icon: TrendingUp, label: "Organigramme", href: "/positions/org-chart" },
      { icon: MapPin, label: "Zones de Pointage", href: "/admin/geofencing" },
    ],
  },
  {
    title: "Calendrier et Congés",
    items: [
      { icon: Calendar, label: "Jours Fériés", href: "/admin/public-holidays" },
      { icon: Umbrella, label: "Règles de Congés", href: "/admin/policies/time-off" },
      { icon: CalendarClock, label: "Accumulation de Congés", href: "/admin/policies/accrual" },
    ],
  },
  {
    title: "Paramètres de Paie",
    items: [
      { icon: Clock, label: "Heures Supplémentaires", href: "/admin/policies/overtime" },
      { icon: BarChart3, label: "Suivi des Automatisations", href: "/workflows/analytics" },
    ],
  },
];

export const hrManagerDesktopSections: NavSection[] = [
  {
    title: "",
    items: [
      { icon: Home, label: "Tableau de bord", href: "/admin/dashboard" },
    ],
  },
  {
    title: "Paie",
    items: [
      { icon: Play, label: "Lancer la paie", href: "/payroll/runs/new" },
      { icon: History, label: "Historique paies", href: "/payroll/runs" },
      { icon: Award, label: "Primes et variables", href: "/payroll/variable-inputs" },
      { icon: Calculator, label: "Calculatrice paie", href: "/payroll/calculator" },
      { icon: FileText, label: "Déclaration CNPS", href: "/payroll/cnps-declaration" },
    ],
  },
  {
    title: "Employés",
    items: [
      { icon: Users, label: "Liste employés", href: "/employees" },
      { icon: UserPlus, label: "Nouvel employé", href: "/employees/new" },
      { icon: Briefcase, label: "Postes", href: "/positions" },
      { icon: Heart, label: "Avantages sociaux", href: "/admin/benefits" },
    ],
  },
  {
    title: "Temps & Congés",
    items: [
      { icon: Clock, label: "Approbations pointages", href: "/admin/time-tracking" },
      { icon: Edit3, label: "Saisie manuelle heures", href: "/manager/time-tracking/manual-entry" },
      { icon: Upload, label: "Importer depuis appareil", href: "/admin/time-tracking/import" },
      { icon: CalendarClock, label: "Horaires de travail", href: "/horaires" },
      { icon: Calendar, label: "Planning des Quarts", href: "/admin/shift-planning" },
      { icon: Calendar, label: "Demandes de congé", href: "/admin/time-off" },
      { icon: Wallet, label: "Tableau de bord ACP", href: "/admin/acp-dashboard" },
    ],
  },
  {
    title: "Conformité",
    items: [
      { icon: BookOpen, label: "Registre du personnel", href: "/compliance/registre-personnel" },
      { icon: AlertCircle, label: "Suivi des CDD", href: "/compliance/cdd" },
    ],
  },
  {
    title: "Documents",
    items: [
      { icon: FileStack, label: "Gestion des documents", href: "/admin/documents" },
    ],
  },
  {
    title: "Automatisation",
    items: [
      { icon: Zap, label: "Rappels automatiques", href: "/automation" },
      { icon: Workflow, label: "Flux de travail", href: "/workflows" },
      { icon: List, label: "Opérations en lot", href: "/batch-operations" },
    ],
  },
];

// Tenant Admin Navigation (STREAMLINED - HCI COMPLIANT)
// Strategy: HR Manager sections as PRIMARY (admin features in "Plus d'Options")
export const adminMobileSections: NavSection[] = hrManagerMobileSections;

// Admin advanced features (collapsible) - HCI COMPLIANT
// Only include pages that actually exist
export const adminAdvancedSections: NavSection[] = [
  {
    title: "Paramètres",
    items: [
      { icon: Building, label: "Informations Société", href: "/admin/settings/company" },
      { icon: DollarSign, label: "Configuration Paie", href: "/settings/payroll" },
    ],
  },
  {
    title: "Données et Gestion",
    items: [
      { icon: Calculator, label: "Export Comptable", href: "/settings/accounting" },
      { icon: Database, label: "Importer depuis Sage", href: "/settings/data-migration" },
      { icon: Upload, label: "Import/Export Excel", href: "/admin/employees/import-export" },
    ],
  },
];

// Super Admin only sections (multi-country configuration)
export const superAdminOnlySections: NavSection[] = [
  {
    title: "Configuration Multi-Pays",
    items: [
      { icon: Globe, label: "Pays", href: "/super-admin/countries" },
      { icon: FileBarChart, label: "Systèmes fiscaux", href: "/super-admin/tax-systems" },
      { icon: Shield, label: "Sécurité sociale", href: "/super-admin/social-security" },
      { icon: Package, label: "Types de cotisations", href: "/super-admin/contribution-types" },
    ],
  },
  {
    title: "Configuration Globale",
    items: [
      { icon: Building, label: "Organisations", href: "/super-admin/tenants" },
      { icon: Activity, label: "Santé du système", href: "/super-admin/system-health" },
    ],
  },
];

// Admin Desktop: HR Manager sections only (admin features are in "Plus d'Options")
export const adminDesktopSections: NavSection[] = hrManagerDesktopSections;

// Helper function to get navigation based on role
export function getNavigationByRole(role: string) {
  switch (role) {
    case "employee":
      return {
        mobile: employeeMobileSections,
        desktop: employeeDesktopSections,
        advanced: [] as NavSection[],
      };
    case "manager":
      return {
        mobile: managerMobileSections,
        desktop: managerDesktopSections,
        advanced: [] as NavSection[],
      };
    case "hr_manager":
      return {
        mobile: hrManagerMobileSections,
        desktop: hrManagerDesktopSections,
        advanced: hrManagerAdvancedSections,
      };
    case "admin": // Used by admin layout
    case "tenant_admin":
      return {
        mobile: adminMobileSections,
        desktop: adminDesktopSections,
        advanced: [...hrManagerAdvancedSections, ...adminAdvancedSections],
      };
    case "super_admin":
      return {
        mobile: [...adminMobileSections, ...superAdminOnlySections],
        desktop: [...adminDesktopSections, ...superAdminOnlySections],
        advanced: [...hrManagerAdvancedSections, ...adminAdvancedSections],
      };
    default:
      return {
        mobile: employeeMobileSections,
        desktop: employeeDesktopSections,
        advanced: [] as NavSection[],
      };
  }
}
