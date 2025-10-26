# Navigation Structure - Complete Hierarchy

## Employee Navigation (6 items)

```
📊 Tableau de bord (/employee/dashboard)

👷 Mon Travail
├─ ⏰ Pointage (/time-tracking)
└─ 📅 Demander Congé (/time-off)

💰 Ma Paie
└─ 📄 Mes Bulletins (/employee/payslips)

👤 Mon Profil
├─ 📋 Mes Informations (/employee/profile)
└─ 📁 Mes Documents (/employee/documents)
```

## Manager Navigation (7 items)

```
📊 Tableau de Bord (/manager/dashboard)

👥 Mon Équipe
├─ 👥 Liste Équipe (/manager/team)
└─ ⏰ Pointages (/manager/time-tracking)

✅ Validations
└─ ☑️ Congés à Valider (/manager/time-off/approvals)

📊 Rapports
└─ 📈 Heures Supplémentaires (/manager/reports/overtime)
```

## HR Manager Navigation (25 primary + 14 advanced = 39 items)

### Primary Navigation (25 items)

```
📊 Tableau de Bord (/admin/dashboard)

💰 Paie
├─ ▶️ Lancer la Paie (/payroll/runs/new)
├─ 📜 Cycles de Paie (/payroll/runs)
├─ 🏆 Primes et Variables (/payroll/bonuses)
└─ 🧮 Calculatrice Paie (/payroll/calculator)

👥 Employés
├─ 👥 Liste des Employés (/employees)
├─ ➕ Ajouter un Employé (/employees/new)
├─ 📄 Contrats (/contracts)
└─ 💼 Postes (/positions)

⏰ Temps et Congés
├─ ⏰ Pointages (/admin/time-tracking)
├─ 🕐 Horaires de Travail (/horaires)
├─ 📅 Demandes de Congés (/admin/time-off)
└─ 📊 Soldes de Congés (/leave/balances)

📋 Conformité
├─ 📖 Registre du Personnel (/compliance/registre-personnel)
└─ ⚠️ Suivi des CDD (/compliance/cdd)

⚡ Automatisation
├─ ⚡ Rappels Automatiques (/automation)
├─ 🔄 Flux de Travail (/workflows)
└─ 📋 Opérations en Lot (/batch-operations)

📊 Rapports
└─ 📈 Tous les Rapports (/reports)
```

### Advanced Navigation (14 items - Collapsible)

```
🔧 Plus d'options

📈 Gestion Avancée
├─ 📊 Organigramme (/positions/org-chart)
├─ 💵 Historique Salaires (/salaries)
├─ 📃 Bandes Salariales (/salaries/bands)
├─ 📤 Ajustement en Lot (/salaries/bulk-adjustment)
├─ 📍 Sites et Établissements (/settings/locations)
├─ 📍 Géolocalisation (/admin/geofencing)
├─ 📅 Jours Fériés (/admin/public-holidays)
└─ 📊 Analytique Workflows (/workflows/analytics)

⚙️ Configuration
├─ ☂️ Politiques de Congés (/admin/policies/time-off)
├─ ⏰ Règles Heures Sup (/admin/policies/overtime)
├─ 🕐 Règles d'Accumulation (/admin/policies/accrual)
├─ 📦 Composants Salaire (/settings/salary-components)
├─ 🏢 Secteurs d'Activité (/settings/sectors)
└─ 📄 Modèles de Bulletins (/settings/payslip-templates)
```

## Tenant Admin Navigation (30 primary + 17 advanced = 47 items)

### Primary Navigation (30 items)
**Inherits all 25 HR Manager items PLUS:**

```
🔐 Administration
├─ 👥 Utilisateurs (/admin/settings/users)
├─ 🛡️ Rôles et Permissions (/admin/settings/roles)
└─ 🏢 Paramètres Société (/admin/settings/company)

🔒 Sécurité et Audit
├─ 🛡️ Sécurité (/admin/settings/security)
└─ 📜 Journal d'Audit (/admin/audit-log)
```

### Advanced Navigation (17 items - Collapsible)
**Inherits all 14 HR Manager advanced items PLUS:**

```
🔧 Plus d'options

🔌 Intégrations et Données
├─ 🧮 Comptabilité (/settings/accounting)
├─ 💾 Migration Sage (/settings/data-migration)
└─ 📤 Import/Export (/admin/employees/import-export)

💳 Facturation
├─ 💵 Facturation (/admin/settings/billing)
└─ 📊 Analyse Coûts (/admin/settings/costs)
```

## Super Admin Navigation (36 primary + 17 advanced = 53 items)

### Primary Navigation (36 items)
**Inherits all 30 Tenant Admin items PLUS:**

```
🌍 Configuration Multi-Pays
├─ 🌐 Pays (/super-admin/countries)
├─ 📊 Systèmes Fiscaux (/super-admin/tax-systems)
├─ 🛡️ Sécurité Sociale (/super-admin/social-security)
└─ 📦 Types de Cotisations (/super-admin/contribution-types)

⚙️ Configuration Globale
├─ 🏢 Organisations (/super-admin/tenants)
└─ 💓 Santé du Système (/super-admin/system-health)
```

### Advanced Navigation (17 items - Collapsible)
**Same as Tenant Admin (inherits all 17 items)**

---

## Navigation Access Matrix

| Feature Category | Employee | Manager | HR Manager | Tenant Admin | Super Admin |
|-----------------|----------|---------|------------|--------------|-------------|
| **Core Features** |
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Time Tracking | ✅ | ✅ | ✅ | ✅ | ✅ |
| Leave Requests | ✅ | ✅ | ✅ | ✅ | ✅ |
| Payslips | ✅ | ❌ | ✅ | ✅ | ✅ |
| Profile | ✅ | ❌ | ❌ | ❌ | ❌ |
| Documents | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Management** |
| Team Management | ❌ | ✅ | ✅ | ✅ | ✅ |
| Approvals | ❌ | ✅ | ✅ | ✅ | ✅ |
| Reports | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Payroll** |
| Run Payroll | ❌ | ❌ | ✅ | ✅ | ✅ |
| Payroll History | ❌ | ❌ | ✅ | ✅ | ✅ |
| Bonuses & Variables | ❌ | ❌ | ✅ | ✅ | ✅ |
| Payroll Calculator | ❌ | ❌ | ✅ | ✅ | ✅ |
| **HR Management** |
| Employee Management | ❌ | ❌ | ✅ | ✅ | ✅ |
| Contracts | ❌ | ❌ | ✅ | ✅ | ✅ |
| Positions | ❌ | ❌ | ✅ | ✅ | ✅ |
| Work Schedules | ❌ | ❌ | ✅ | ✅ | ✅ |
| Leave Balances | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Compliance** |
| Employee Register | ❌ | ❌ | ✅ | ✅ | ✅ |
| CDD Tracking | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Automation** |
| Automatic Reminders | ❌ | ❌ | ✅ | ✅ | ✅ |
| Workflows | ❌ | ❌ | ✅ | ✅ | ✅ |
| Batch Operations | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Advanced HR** |
| Org Chart | ❌ | ❌ | 🔧 | 🔧 | 🔧 |
| Salary History | ❌ | ❌ | 🔧 | 🔧 | 🔧 |
| Salary Bands | ❌ | ❌ | 🔧 | 🔧 | 🔧 |
| Bulk Adjustment | ❌ | ❌ | 🔧 | 🔧 | 🔧 |
| Locations | ❌ | ❌ | 🔧 | 🔧 | 🔧 |
| Geofencing | ❌ | ❌ | 🔧 | 🔧 | 🔧 |
| Public Holidays | ❌ | ❌ | 🔧 | 🔧 | 🔧 |
| Workflow Analytics | ❌ | ❌ | 🔧 | 🔧 | 🔧 |
| **Configuration** |
| Leave Policies | ❌ | ❌ | 🔧 | 🔧 | 🔧 |
| Overtime Rules | ❌ | ❌ | 🔧 | 🔧 | 🔧 |
| Accrual Rules | ❌ | ❌ | 🔧 | 🔧 | 🔧 |
| Salary Components | ❌ | ❌ | 🔧 | 🔧 | 🔧 |
| Sectors | ❌ | ❌ | 🔧 | 🔧 | 🔧 |
| Payslip Templates | ❌ | ❌ | 🔧 | 🔧 | 🔧 |
| **Administration** |
| User Management | ❌ | ❌ | ❌ | ✅ | ✅ |
| Roles & Permissions | ❌ | ❌ | ❌ | ✅ | ✅ |
| Company Settings | ❌ | ❌ | ❌ | ✅ | ✅ |
| Security Settings | ❌ | ❌ | ❌ | ✅ | ✅ |
| Audit Log | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Integrations** |
| Accounting | ❌ | ❌ | ❌ | 🔧 | 🔧 |
| Sage Migration | ❌ | ❌ | ❌ | 🔧 | 🔧 |
| Import/Export | ❌ | ❌ | ❌ | 🔧 | 🔧 |
| Billing | ❌ | ❌ | ❌ | 🔧 | 🔧 |
| Cost Analysis | ❌ | ❌ | ❌ | 🔧 | 🔧 |
| **Multi-Country** |
| Countries | ❌ | ❌ | ❌ | ❌ | ✅ |
| Tax Systems | ❌ | ❌ | ❌ | ❌ | ✅ |
| Social Security | ❌ | ❌ | ❌ | ❌ | ✅ |
| Contribution Types | ❌ | ❌ | ❌ | ❌ | ✅ |
| Tenant Management | ❌ | ❌ | ❌ | ❌ | ✅ |
| System Health | ❌ | ❌ | ❌ | ❌ | ✅ |

**Legend:**
- ✅ = Available in primary navigation
- 🔧 = Available in advanced navigation (collapsible)
- ❌ = Not accessible

---

## Key Navigation Principles

### 1. Progressive Disclosure
- Primary navigation: Essential, frequently-used features
- Advanced navigation: Powerful but infrequently-used features (collapsible)

### 2. Role-Based Filtering
- Each role sees only what they need
- Features automatically hidden if not authorized
- Clear separation between roles

### 3. Task-Oriented Grouping
Sections organized by user goals:
- **Paie** → "Pay my employees"
- **Employés** → "Manage my workforce"
- **Temps & Congés** → "Track time and leave"
- **Conformité** → "Stay legally compliant"
- **Automatisation** → "Automate repetitive tasks"

### 4. HCI Compliance
- All labels in French
- Touch-friendly (min 44px targets)
- Clear icons from Lucide React
- Descriptive helper text
- Mobile-first design

### 5. Scalability
- Easy to add new items
- Clean hierarchy (max 3 levels)
- Collapsible sections prevent overflow
- Search enabled for admin roles
