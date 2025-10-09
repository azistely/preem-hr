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
} from "lucide-react";
import { NavItem, NavSection } from "@/components/navigation/sidebar";

// Employee Navigation
export const employeeMobileNav: NavItem[] = [
  { icon: Home, label: "Accueil", href: "/employee/dashboard" },
  { icon: Clock, label: "Pointage", href: "/time-tracking" },
  { icon: Calendar, label: "Congés", href: "/time-off" },
  { icon: FileText, label: "Paies", href: "/employee/payslips" },
  { icon: User, label: "Profil", href: "/employee/profile" },
];

export const employeeDesktopSections: NavSection[] = [
  {
    title: "Principal",
    items: [
      { icon: Home, label: "Tableau de bord", href: "/employee/dashboard" },
    ],
  },
  {
    title: "Temps",
    items: [
      { icon: Clock, label: "Pointage", href: "/time-tracking" },
    ],
  },
  {
    title: "Congés",
    items: [
      { icon: Calendar, label: "Demander congé", href: "/time-off" },
    ],
  },
  {
    title: "Paie",
    items: [
      { icon: FileText, label: "Mes bulletins", href: "/employee/payslips" },
    ],
  },
  {
    title: "Profil",
    items: [
      { icon: User, label: "Mes informations", href: "/employee/profile" },
      { icon: Settings, label: "Modifier profil", href: "/employee/profile/edit" },
    ],
  },
];

// Manager Navigation
export const managerMobileNav: NavItem[] = [
  { icon: Home, label: "Accueil", href: "/manager/dashboard" },
  { icon: Users, label: "Équipe", href: "/manager/team" },
  { icon: Clock, label: "Pointages", href: "/manager/time-tracking" },
  { icon: Calendar, label: "Congés", href: "/manager/time-off/approvals" },
  { icon: BarChart, label: "Rapports", href: "/manager/reports/overtime" },
];

export const managerDesktopSections: NavSection[] = [
  {
    title: "Vue d'ensemble",
    items: [
      { icon: Home, label: "Tableau de bord", href: "/manager/dashboard" },
    ],
  },
  {
    title: "Équipe",
    items: [
      { icon: Users, label: "Mon équipe", href: "/manager/team" },
      { icon: Clock, label: "Pointages", href: "/manager/time-tracking" },
    ],
  },
  {
    title: "Approbations",
    items: [
      { icon: Calendar, label: "Congés", href: "/manager/time-off/approvals" },
    ],
  },
  {
    title: "Rapports",
    items: [
      { icon: Timer, label: "Heures sup", href: "/manager/reports/overtime" },
    ],
  },
];

// HR Manager Navigation
export const hrManagerMobileNav: NavItem[] = [
  { icon: Home, label: "Accueil", href: "/admin/dashboard" },
  { icon: Users, label: "Employés", href: "/employees" },
  { icon: DollarSign, label: "Paie", href: "/payroll/runs" },
  { icon: Clock, label: "Temps", href: "/time-tracking" },
  { icon: Settings, label: "Config", href: "/settings" },
];

export const hrManagerDesktopSections: NavSection[] = [
  {
    title: "Tableau de bord",
    items: [
      { icon: Home, label: "Tableau de bord", href: "/admin/dashboard" },
      { icon: Bell, label: "Alertes", href: "/alerts" },
    ],
  },
  {
    title: "Paie",
    items: [
      { icon: Play, label: "Lancer la paie", href: "/payroll/runs/new" },
      { icon: History, label: "Historique paies", href: "/payroll/runs" },
      { icon: Calculator, label: "Calculatrice", href: "/payroll/calculator" },
      { icon: BarChart, label: "Tableau de bord", href: "/payroll/dashboard" },
    ],
  },
  {
    title: "Employés",
    items: [
      { icon: Users, label: "Liste employés", href: "/employees" },
      { icon: UserPlus, label: "Nouvel employé", href: "/employees/new" },
      { icon: Upload, label: "Import/Export", href: "/admin/employees/import-export" },
      { icon: Briefcase, label: "Postes", href: "/positions" },
      { icon: TrendingUp, label: "Organigramme", href: "/positions/org-chart" },
      { icon: DollarSign, label: "Salaires", href: "/salaries" },
      { icon: Receipt, label: "Bandes salariales", href: "/salaries/bands" },
      { icon: Receipt, label: "Ajustements salaires", href: "/salaries/bulk-adjustment" },
      { icon: UserCheck, label: "Départs", href: "/terminations" },
    ],
  },
  {
    title: "Temps",
    items: [
      { icon: Clock, label: "Pointages", href: "/time-tracking" },
      { icon: Clock, label: "Gestion temps", href: "/admin/time-tracking" },
      { icon: MapPin, label: "Géolocalisation", href: "/admin/geofencing" },
    ],
  },
  {
    title: "Congés",
    items: [
      { icon: Umbrella, label: "Demandes congés", href: "/time-off" },
      { icon: Settings, label: "Politiques congés", href: "/admin/policies/time-off" },
      { icon: Settings, label: "Politique heures sup", href: "/admin/policies/overtime" },
      { icon: Settings, label: "Politique accumulation", href: "/admin/policies/accrual" },
      { icon: Calendar, label: "Jours fériés", href: "/admin/public-holidays" },
    ],
  },
  {
    title: "Paramètres",
    items: [
      { icon: Settings, label: "Composants salaire", href: "/settings/salary-components" },
      { icon: Building, label: "Secteurs", href: "/settings/sectors" },
    ],
  },
];

// Tenant Admin Navigation (extends HR Manager with admin settings)
export const adminMobileNav: NavItem[] = [
  { icon: Home, label: "Accueil", href: "/admin/settings/dashboard" },
  { icon: Users, label: "Employés", href: "/employees" },
  { icon: DollarSign, label: "Paie", href: "/payroll/runs" },
  { icon: Users, label: "Utilisateurs", href: "/admin/settings/users" },
  { icon: Settings, label: "Paramètres", href: "/admin/settings/company" },
];

export const adminDesktopSections: NavSection[] = [
  {
    title: "Administration",
    items: [
      { icon: Home, label: "Tableau de bord admin", href: "/admin/settings/dashboard" },
      { icon: Home, label: "Tableau de bord RH", href: "/admin/dashboard" },
      { icon: Bell, label: "Alertes", href: "/alerts" },
    ],
  },
  {
    title: "Paie",
    items: [
      { icon: Play, label: "Lancer la paie", href: "/payroll/runs/new" },
      { icon: History, label: "Historique paies", href: "/payroll/runs" },
      { icon: Calculator, label: "Calculatrice", href: "/payroll/calculator" },
      { icon: BarChart, label: "Tableau de bord", href: "/payroll/dashboard" },
    ],
  },
  {
    title: "Employés",
    items: [
      { icon: Users, label: "Liste employés", href: "/employees" },
      { icon: UserPlus, label: "Nouvel employé", href: "/employees/new" },
      { icon: Upload, label: "Import/Export", href: "/admin/employees/import-export" },
      { icon: Briefcase, label: "Postes", href: "/positions" },
      { icon: TrendingUp, label: "Organigramme", href: "/positions/org-chart" },
      { icon: DollarSign, label: "Salaires", href: "/salaries" },
      { icon: Receipt, label: "Bandes salariales", href: "/salaries/bands" },
      { icon: Receipt, label: "Ajustements salaires", href: "/salaries/bulk-adjustment" },
      { icon: UserCheck, label: "Départs", href: "/terminations" },
    ],
  },
  {
    title: "Temps",
    items: [
      { icon: Clock, label: "Pointages", href: "/time-tracking" },
      { icon: Clock, label: "Gestion temps", href: "/admin/time-tracking" },
      { icon: MapPin, label: "Géolocalisation", href: "/admin/geofencing" },
    ],
  },
  {
    title: "Congés",
    items: [
      { icon: Umbrella, label: "Demandes congés", href: "/time-off" },
      { icon: Settings, label: "Politiques congés", href: "/admin/policies/time-off" },
      { icon: Settings, label: "Politique heures sup", href: "/admin/policies/overtime" },
      { icon: Settings, label: "Politique accumulation", href: "/admin/policies/accrual" },
      { icon: Calendar, label: "Jours fériés", href: "/admin/public-holidays" },
    ],
  },
  {
    title: "Paramètres",
    items: [
      { icon: Settings, label: "Composants salaire", href: "/settings/salary-components" },
      { icon: Building, label: "Secteurs", href: "/settings/sectors" },
    ],
  },
  {
    title: "Gestion",
    items: [
      { icon: Users, label: "Utilisateurs", href: "/admin/settings/users" },
      { icon: Shield, label: "Rôles & Permissions", href: "/admin/settings/roles" },
      { icon: Building, label: "Paramètres société", href: "/admin/settings/company" },
    ],
  },
  {
    title: "Facturation",
    items: [
      { icon: DollarSign, label: "Facturation", href: "/admin/settings/billing" },
      { icon: BarChart, label: "Analyse coûts", href: "/admin/settings/costs" },
    ],
  },
  {
    title: "Sécurité",
    items: [
      { icon: Shield, label: "Sécurité", href: "/admin/settings/security" },
      { icon: History, label: "Journal d'audit", href: "/admin/audit-log" },
    ],
  },
  {
    title: "Intégrations",
    items: [
      { icon: Settings, label: "Intégrations", href: "/admin/settings/integrations" },
    ],
  },
];

// Helper function to get navigation based on role
export function getNavigationByRole(role: string) {
  switch (role) {
    case "employee":
      return {
        mobile: employeeMobileNav,
        desktop: employeeDesktopSections,
      };
    case "manager":
      return {
        mobile: managerMobileNav,
        desktop: managerDesktopSections,
      };
    case "hr_manager":
      return {
        mobile: hrManagerMobileNav,
        desktop: hrManagerDesktopSections,
      };
    case "tenant_admin":
    case "super_admin":
      return {
        mobile: adminMobileNav,
        desktop: adminDesktopSections,
      };
    default:
      return {
        mobile: employeeMobileNav,
        desktop: employeeDesktopSections,
      };
  }
}
