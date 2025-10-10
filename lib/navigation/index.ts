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
} from "lucide-react";
import { NavItem, NavSection } from "@/components/navigation/sidebar";

// Employee Navigation (SIMPLIFIED - 6 items total)
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
    title: "Mon Profil",
    items: [
      { icon: User, label: "Mes informations", href: "/employee/profile" },
    ],
  },
];

// Manager Navigation (SIMPLIFIED - 7 items total)
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
];

// HR Manager Navigation (STREAMLINED - 14 visible + 7 collapsible)
export const hrManagerMobileSections: NavSection[] = [
  {
    title: "",
    items: [
      { icon: Home, label: "Accueil", href: "/admin/dashboard" },
      { icon: Bell, label: "Alertes", href: "/alerts" },
      { icon: Workflow, label: "Workflows", href: "/workflows" },
    ],
  },
  {
    title: "Paie",
    items: [
      { icon: Play, label: "Lancer la paie", href: "/payroll/runs/new" },
      { icon: History, label: "Historique paies", href: "/payroll/runs" },
      { icon: Calculator, label: "Calculatrice", href: "/payroll/calculator" },
    ],
  },
  {
    title: "Employés",
    items: [
      { icon: Users, label: "Liste employés", href: "/employees" },
      { icon: UserPlus, label: "Nouvel employé", href: "/employees/new" },
      { icon: Upload, label: "Import/Export", href: "/admin/employees/import-export" },
      { icon: Briefcase, label: "Postes", href: "/positions" },
    ],
  },
  {
    title: "Temps & Congés",
    items: [
      { icon: Clock, label: "Pointages", href: "/time-tracking" },
      { icon: Umbrella, label: "Demandes congés", href: "/time-off" },
      { icon: Settings, label: "Politiques congés", href: "/admin/policies/time-off" },
    ],
  },
];

// Advanced features (collapsible)
export const hrManagerAdvancedSections: NavSection[] = [
  {
    title: "Gestion avancée",
    items: [
      { icon: TrendingUp, label: "Organigramme", href: "/positions/org-chart" },
      { icon: DollarSign, label: "Salaires", href: "/salaries" },
      { icon: Receipt, label: "Bandes salariales", href: "/salaries/bands" },
      { icon: MapPin, label: "Géolocalisation", href: "/admin/geofencing" },
      { icon: Calendar, label: "Jours fériés", href: "/admin/public-holidays" },
      { icon: Settings, label: "Composants salaire", href: "/settings/salary-components" },
      { icon: Building, label: "Secteurs", href: "/settings/sectors" },
    ],
  },
];

export const hrManagerDesktopSections: NavSection[] = [
  {
    title: "",
    items: [
      { icon: Home, label: "Tableau de bord", href: "/admin/dashboard" },
      { icon: Bell, label: "Alertes", href: "/alerts" },
      { icon: Workflow, label: "Workflows", href: "/workflows" },
    ],
  },
  {
    title: "Paie",
    items: [
      { icon: Play, label: "Lancer la paie", href: "/payroll/runs/new" },
      { icon: History, label: "Historique paies", href: "/payroll/runs" },
      { icon: Calculator, label: "Calculatrice paie", href: "/payroll/calculator" },
    ],
  },
  {
    title: "Employés",
    items: [
      { icon: Users, label: "Liste employés", href: "/employees" },
      { icon: UserPlus, label: "Nouvel employé", href: "/employees/new" },
      { icon: Upload, label: "Import/Export", href: "/admin/employees/import-export" },
      { icon: Briefcase, label: "Postes", href: "/positions" },
    ],
  },
  {
    title: "Temps & Congés",
    items: [
      { icon: Clock, label: "Pointages", href: "/time-tracking" },
      { icon: Umbrella, label: "Demandes congés", href: "/time-off" },
      { icon: Settings, label: "Politiques congés", href: "/admin/policies/time-off" },
    ],
  },
];

// Tenant Admin Navigation (DRASTICALLY SIMPLIFIED)
// Strategy: Same as HR Manager + Admin-specific sections
export const adminMobileSections: NavSection[] = [
  ...hrManagerMobileSections,
  {
    title: "Administration",
    items: [
      { icon: Users, label: "Utilisateurs", href: "/admin/settings/users" },
      { icon: Building, label: "Paramètres société", href: "/admin/settings/company" },
    ],
  },
];

// Admin-only desktop sections (to be added to HR Manager sections)
export const adminOnlySections: NavSection[] = [
  {
    title: "Administration",
    items: [
      { icon: Users, label: "Utilisateurs", href: "/admin/settings/users" },
      { icon: Shield, label: "Rôles & Permissions", href: "/admin/settings/roles" },
      { icon: Building, label: "Paramètres société", href: "/admin/settings/company" },
    ],
  },
  {
    title: "Sécurité & Audit",
    items: [
      { icon: Shield, label: "Sécurité", href: "/admin/settings/security" },
      { icon: History, label: "Journal d'audit", href: "/admin/audit-log" },
    ],
  },
];

// Admin advanced features (collapsible)
export const adminAdvancedSections: NavSection[] = [
  {
    title: "Facturation & Intégrations",
    items: [
      { icon: DollarSign, label: "Facturation", href: "/admin/settings/billing" },
      { icon: BarChart, label: "Analyse coûts", href: "/admin/settings/costs" },
      { icon: Settings, label: "Intégrations", href: "/admin/settings/integrations" },
    ],
  },
];

export const adminDesktopSections: NavSection[] = [
  ...hrManagerDesktopSections,
  ...adminOnlySections,
];

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
    case "super_admin":
      return {
        mobile: adminMobileSections,
        desktop: adminDesktopSections,
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
