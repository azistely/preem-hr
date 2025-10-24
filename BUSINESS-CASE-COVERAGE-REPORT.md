# Business Case Coverage Report - Preem HR

**Generated:** October 23, 2025
**Report Type:** Comprehensive Implementation Coverage Analysis
**Scope:** All implemented business cases and features

---

## Executive Summary

Preem HR is an enterprise HR/payroll system for West African organizations with support for complex multi-country regulations, multiple business sectors, and variable employment models. The platform supports organizations ranging from small companies to large enterprises with multiple locations.

**Key Statistics:**
- **Countries Supported:** 3+ (Côte d'Ivoire primary, Senegal, Burkina Faso framework)
- **Business Sectors:** 10+ specific configurations
- **Payroll Calculation Types:** 3 (Monthly, Daily, Hourly)
- **Convention Collective Support:** 3 types (INTERPRO, BANKING, BTP)
- **Compliance Features:** 5+ major systems
- **Multi-Location Support:** Full implementation

---

## 1. Core Employment Management

### 1.1 Employee Lifecycle Management

**Status:** Fully Implemented ✅

#### Hire to Termination Workflow
- **New Hire Process** - Multi-step wizard with validation
  - Personal information (name, DOB, gender, contact)
  - Employment details (hire date, position, department)
  - Salary configuration (monthly/daily/hourly rates)
  - Banking information (bank account, CNPS number)
  - Family information (marital status, dependents)
  - Tax information (tax dependents, fiscal parts for deductions)

- **Employee Data Model** - Comprehensive storage
  - Personal/Contact information
  - Employment history and status tracking
  - Banking details for payroll
  - Tax compliance fields
  - Family deduction information
  - Custom fields (tenant-configurable)
  - Document expiry tracking (national ID, work permits)

- **Termination System** - Full compliance support
  - Termination reason tracking
  - Terminal payroll calculation
  - Vacation payout processing
  - Final payslip generation
  - Registre du Personnel automatic entry
  - Notice period validation (category-specific)
  - Automatic exit from Registre du Personnel

**API Endpoints:**
- `employees.create` - Hire new employee
- `employees.update` - Update employee details
- `employees.terminate` - Process termination
- `employees.get` - Retrieve employee info
- `employees.list` - List all employees with filtering

**Features Included:**
- Salary change workflows with history tracking
- Position/role assignment with effective dating
- Bulk salary adjustments
- Employee number auto-generation
- Multi-position support
- Manager assignment and reporting structure

---

### 1.2 Employee Categories & Coefficients (GAP-COEF-001)

**Status:** Fully Implemented ✅

#### Category System
- **Categories:** A1, A2, B1, B2, C, D, E, F
- **Database-Driven:** All categories loaded from `employee_category_coefficients` table

**Features:**
- Category-based minimum wage validation
- Coefficient-based salary calculations (coefficient × SMIG ÷ 100)
- Notice period rules by category
- Multi-sector support (CGECI Barème 2023)
- Sector-specific minimum wages

**Validation Logic:**
```
Minimum Wage = (Employee Coefficient × SMIG) / 100
```

**Example Categories (CI):**
- A1: "Ouvrier non qualifié" (Coefficient 90-100)
- A2: "Ouvrier semi-qualifié" (Coefficient 110-120)
- B1: "Ouvrier qualifié" (Coefficient 130-140)
- B2: "Contremaître" (Coefficient 150-160)
- C: "Technicien" (Coefficient 170-180)
- D: "Ingénieur" (Coefficient 200+)

**API Endpoints:**
- `employees.getMinimumWageHelper` - Get category info and minimum wage
- `payroll.getAvailableCountries` - Retrieve country configurations

---

### 1.3 Sector Configurations

**Status:** Fully Implemented ✅

#### Supported Sectors (CI - Côte d'Ivoire)
1. **Construction (BTP)**
   - Work accident rate: 4.0%
   - Typical roles: Maçon, Charpentier, Chef de Chantier
   - Overtime common: Yes

2. **Agriculture & Agro-Industry**
   - Work accident rate: 3.0%
   - Typical roles: Ouvrier Agricole, Chef de Culture
   - Seasonal workers: Yes

3. **Industry & Manufacturing**
   - Work accident rate: 2.5%
   - Typical roles: Opérateur Machine, Technicien
   - Shift work common: Yes

4. **Transport & Logistics**
   - Work accident rate: 3.5%
   - Typical roles: Chauffeur, Magasinier
   - Per diem allowances: Yes

5. **Banking & Finance**
   - Work accident rate: 0.5%
   - Professional levels: I-IX
   - Seniority bonuses: Yes (+3% every 3 years)

6. **Retail & Commerce**
   - Work accident rate: 1.5%
   - Typical roles: Vendeur, Caissier
   - Shift support: Yes

7. **Security & Surveillance**
   - Work accident rate: 2.0%
   - Hazard pay: 10% per shift

8. **Hospitality & Food Service**
   - Work accident rate: 1.8%
   - Per diem: Yes

9. **Healthcare**
   - Work accident rate: 2.0%
   - Night shift bonuses: Yes

10. **Education**
    - Work accident rate: 0.5%
    - Summer break handling: Yes

**Features:**
- Auto-detection from employee sector field
- Smart defaults for required components
- Risk-based contribution rates
- Typical job positions
- Seasonal worker support

**Database Tables:**
- `sector_configurations` - Master sector definitions
- `sector_contribution_overrides` - Sector-specific contribution rates

---

## 2. Payroll Management

### 2.1 Payroll Calculation Engine (Multi-Country)

**Status:** Fully Implemented ✅

#### Payroll Calculation V2 - Database-Driven
The modern payroll engine replaces hardcoded values with database configuration, supporting multiple countries with different tax and contribution rules.

**Calculation Flow:**
1. Load country configuration from database
2. Calculate gross salary (base + allowances + overtime + bonuses)
3. Calculate social security contributions (CNPS, CMU, etc.)
4. Apply tax using progressive strategy (ITS/IRPP)
5. Calculate net salary and employer costs
6. Generate payment details

**Supported Calculation Types:**

#### A. Monthly Salaries
- Fixed monthly base salary
- Monthly allowances
- Overtime premiums
- Bonuses and incentives
- Family deductions (optional)

#### B. Daily Workers
- Daily rate calculation
- Days worked tracking
- Partial day support (pro-rata)
- Per diem allowances
- Absence tracking

#### C. Hourly Workers
- Hourly rate calculation
- Hours worked tracking
- Overtime calculations (night premium, weekend rates)
- Location-based allowances
- Per diem when applicable

**Input Parameters:**
```typescript
{
  countryCode: string;              // 'CI', 'SN', 'BF'
  rateType: 'MONTHLY'|'DAILY'|'HOURLY';
  baseSalary: number;
  daysWorkedThisMonth?: number;     // For DAILY workers
  hoursWorkedThisMonth?: number;    // For HOURLY workers
  overtimeHours?: Record<string, number>;
  allowances?: Array<{name, amount}>;
  bonuses?: number;
  sectorCode?: string;              // For sector-specific rates
  fiscalParts?: number;             // For family deductions
  conventionCode?: string;          // 'BANKING', 'BTP', 'INTERPRO'
  professionalLevel?: number;       // 1-9 for banking
}
```

**Output Details:**
- Gross salary breakdown by component
- Tax calculation with brackets
- Social security deductions
- Employer contributions
- Net salary
- Total employer cost
- Payment details

**Key Formulas:**
```
Gross Salary = Base + Allowances + Overtime + Bonuses + Seniority

CNPS Pension (CI) = Gross × 5.5%
CNPS Family (CI) = (Code 11 × 8%) if has family, else 0%
CNPS Work Accident (CI) = Gross × (0.5% to 4% by sector)

ITS (CI) = Progressive tax on taxable income
ITS Brackets = [0%, 8%, 10%, 13%, 18%] (brackets vary by year)

CMU (CI) = 1% × Gross (for healthcare)

Net = Gross - CNPS - CMU - ITS
Employer Cost = Gross + Employer CNPS + Employer CMU + Other Taxes
```

**API Endpoints:**
- `payroll.calculateGross` - Calculate gross salary only
- `payroll.calculate` - Calculate complete payroll (v1)
- `payroll.calculateV2` - Modern database-driven calculation
- `payroll.getFamilyDeductions` - Load family deduction rules
- `payroll.getAvailableCountries` - List supported countries

**Database Configuration Tables:**
- `tax_systems` - Tax system definitions by country
- `tax_brackets` - Progressive tax bracket definitions
- `family_deduction_rules` - Family deduction amounts
- `social_security_schemes` - Contribution scheme definitions
- `contribution_types` - Individual contribution definitions
- `sector_contribution_overrides` - Sector-specific rates
- `salary_component_definitions` - Component definitions
- `otherTaxes` - Additional taxes (FDFP, 3FPT, etc.)

---

### 2.2 Payroll Run Management

**Status:** Fully Implemented ✅

#### Payroll Run Lifecycle
- **Create** - Define payroll period and parameters
- **Calculate** - Process all employees
- **Review** - Validate calculations
- **Approve** - Authorization workflow
- **Export** - Generate payment files and compliance reports
- **Pay** - Track payment execution
- **Archive** - Historical record keeping

**Payroll Run Fields:**
- Run number (auto-sequential)
- Period (start and end dates)
- Pay date
- Payment method (bank transfer, cash, check)
- Country for tax/contribution rules
- Status tracking (draft, calculating, calculated, approved, paid)
- Approval tracking (approver, timestamp)
- Totals (gross, net, tax, contributions)
- Employee count

**Line Items:**
Each payroll run contains detailed line items per employee with:
- Base salary and allowances breakdown
- Days/hours worked
- Overtime hours (by type)
- Earnings details (component breakdown)
- Tax deductions (ITS, other taxes)
- Employee contributions (CNPS, CMU, etc.)
- Employer contributions
- Net salary
- Payment details (bank account, reference)
- Individual contribution fields for exports

**API Endpoints:**
- `payroll.createRun` - Create new payroll run
- `payroll.getRun` - Retrieve run details
- `payroll.listRuns` - List runs with filtering
- `payroll.calculateRun` - Process calculations
- `payroll.approveRun` - Approve for payment
- `payroll.getRunSummary` - Dashboard data

**Features:**
- Bulk employee processing
- Calculation error handling
- Partial payroll support (subset of employees)
- Historical snapshots (employee names, positions stored)
- Recalculation support (reopen closed runs)
- Batch operations on line items

---

### 2.3 Advanced Payroll Features

#### Overtime Calculations
- Night shifts (premium rates vary by country)
- Weekend work (typically +50%)
- Public holiday work (typically +100%)
- Overtime hour tracking per category
- Salary impact on gross calculation
- Rules database-driven by country

**API Endpoints:**
- `payroll.getOvertimeRules` - Retrieve rules
- Time tracking integration for auto-calculation

#### Terminal Payroll (Termination)
- Final salary calculation
- Unused vacation/leave payout
- Final tax withholding
- Severance (if applicable)
- Reference letter generation
- Automatic document generation

**API Endpoints:**
- `payroll.calculateTerminalPayroll` - Calculate exit pay
- `payroll.calculateVacationPayout` - Leave settlement

#### Salary Components System
- **Types:** Base salary, allowances, bonuses, deductions
- **Categories:** Taxable/non-taxable, social security subject/exempt
- **Currency Support:** Local currency (FCFA for West Africa)
- **Customization:** Tenant can add custom components
- **Database Integrity:** Component codes restricted to prevent issues

**Pre-defined Components (CI):**
- Code 10: Salaire Catégorie (Code 11 - Base for CNPS calculations)
- Code 12: Sursalaire (Additional fixed component)
- Transport allowance
- Meal allowance
- Housing allowance
- Phone allowance
- Family allowance
- Bonuses
- And many more...

---

### 2.4 Payroll Export & Compliance

**Status:** Fully Implemented ✅

#### Export Types

**1. CNPS Export (Social Security)**
- Employee/employer contribution breakdown
- Aggregated by employee
- Excel format support
- Validation checks before export
- File naming convention: `CNPS_2025_01.xlsx`

**2. CMU Export (Healthcare - 1%)**
- Employee healthcare contributions
- Dependent coverage tracking
- CSV and Excel formats
- Configuration per tenant
- Export format customization

**3. ETAT 301 (Tax Declaration)**
- Monthly ITS/income tax declaration
- Employee tax details
- Withholding summary
- PDF format
- Legal compliance format

**4. Bank Transfer File**
- CSV format for bank import
- Recipient bank details
- Amount and reference
- SEPA XML support
- Payment method tracking

**5. General Ledger (GL) Export**
- Journal entries by accounting system (SYSCOHADA, IFRS)
- Account mappings
- Cost center allocation
- Department-specific exports
- Complete audit trail

**6. Custom Export Templates**
- Tenant-defined export mappings
- Component to GL account mapping
- Department cost center assignment
- Effective date ranges
- Multiple export configurations per tenant

**Features:**
- Validation before export
- Error reporting
- Export history tracking
- File version control
- Automatic naming convention
- Multiple format support (Excel, CSV, PDF, XML)

**API Endpoints:**
- `payroll.getAvailableExports` - List available export types
- `payroll.exportCNPS` - Generate CNPS file
- `payroll.exportCMU` - Generate healthcare file
- `payroll.exportEtat301` - Generate tax declaration
- `payroll.exportBankTransfer` - Generate payment file
- `payroll.exportGL` - Generate accounting entries
- `payroll.exportCustom` - Export with custom template

---

## 3. Time Tracking & Attendance

### 3.1 Time Tracking System

**Status:** Fully Implemented ✅

#### Clock In/Out Records
- **Timestamp Tracking** - Precise clock in/out times
- **Location Tracking** - Multi-site support with location ID
- **Geofencing** - Optional location verification
- **Photo Verification** - Optional photo capture
- **Entry Types** - Regular, overtime, on-call
- **Status Workflow** - Pending, approved, rejected

**Fields:**
- Clock in timestamp
- Clock out timestamp (if closed)
- Total hours (auto-calculated)
- Location information
- Geofence verification status
- Photo URLs
- Approval workflow
- Notes and rejection reasons

**Integration with Payroll:**
- Automatic hours calculation
- Overtime detection
- Shift-based categorization
- Per diem eligibility

**API Endpoints:**
- `time-tracking.clockIn` - Record clock in
- `time-tracking.clockOut` - Record clock out
- `time-tracking.getEntries` - List entries with filtering
- `time-tracking.approveEntry` - Approve/reject entry
- `time-tracking.getSummary` - Daily/weekly summary

---

### 3.2 Work Schedules (Daily/Hourly Workers)

**Status:** Fully Implemented ✅

#### Work Schedule Tracking (GAP-JOUR-002)
For employees with variable work schedules (daily laborers, part-time workers, construction crews).

**Schedule Types:**
- **Full Day** - Standard 8-hour day
- **Partial Day** - Custom hours (5h, 6h, etc.)
- **Absent** - No hours worked

**Features:**
- Per-day recording (work_date field)
- Time tracking (start_time, end_time)
- Hours worked (auto-calculated or manual)
- Presence/absence flag
- Notes for special circumstances
- Approval workflow (draft, pending, approved, rejected)
- Weekly grouping for bulk approval

**Payroll Integration:**
- Days worked calculation
- Partial day pro-rata
- Absence tracking
- Overtime eligibility per assignment
- Location-specific hours

**API Endpoints:**
- `work-schedules.create` - Record schedule
- `work-schedules.list` - List by employee/period
- `work-schedules.approve` - Approve schedules
- `work-schedules.getWeekly` - Weekly summary
- `work-schedules.getSummary` - Period summary

**Database Tables:**
- `work_schedules` - Individual day records
- Integration with `employee_site_assignments` for location tracking

---

### 3.3 Multi-Site Time Tracking (GAP-LOC-001)

**Status:** Fully Implemented ✅

#### Location-Based Allowances
For employees working across multiple sites/locations.

**Allowance Types:**
- Transport allowance (per site, per day)
- Meal allowance (per site, per day)
- Site premium (location-specific danger/hardship pay)
- Hazard pay (percentage-based rate by site)

**Integration:**
- Auto-aggregation across all work sites
- Daily assignment tracking
- Hours per site
- Automatic payroll inclusion
- Per diem eligibility by site

**Features:**
- Location master data (code, name, type)
- Address and GPS coordinates
- Geofence setup (radius in meters)
- Location types (headquarters, branch, construction_site, client_site)
- Employee site assignments (date-based)
- Hours tracking per site per day

**API Endpoints:**
- `locations.create` - Add new site
- `locations.update` - Update site details
- `locations.list` - List all locations
- `site-assignments.assign` - Assign employee to site
- `site-assignments.getAssignments` - List assignments for period

**Database Tables:**
- `locations` - Site master data
- `employee_site_assignments` - Daily employee-location links

---

## 4. Leave & Time Off Management

### 4.1 Time Off Policy System

**Status:** Fully Implemented ✅

#### Policy Types
- Annual leave
- Sick leave
- Personal days
- Maternity leave
- Paternity leave
- Unpaid leave
- Custom policy types

**Policy Configuration:**
- Days per year (allocation)
- Accrual rate (monthly, yearly, per pay period)
- Maximum carryover (year to year)
- Maximum accrual (usage ceiling)
- Minimum increment (full day, half day, etc.)
- Advance notice required (days)
- Blackout periods
- Approval requirement

**Features:**
- Policy templates (pre-configured by country/industry)
- Tenant customization
- Effective dating
- Bulk policy assignment
- Policy change workflow

**API Endpoints:**
- `time-off.getPolicies` - Retrieve active policies
- `time-off.createPolicy` - Create new policy
- `time-off.updatePolicy` - Modify policy

---

### 4.2 Leave Balance Management

**Status:** Fully Implemented ✅

#### Balance Tracking
- Allocated days (by year)
- Used days
- Pending approvals
- Carried over days
- Available days (calculated)

**Accrual System:**
- Monthly accrual support
- Yearly accrual support
- Per-pay-period accrual
- Automatic calculations
- Carried over day limits
- Maximum accrual limits

**API Endpoints:**
- `time-off.getBalance` - Current balance
- `time-off.getBalanceHistory` - Historical balances
- `time-off.recalculateBalance` - Force recalculation

**Database Tables:**
- `time_off_policies` - Policy definitions
- `time_off_balances` - Employee balance tracking by year
- `time_off_requests` - Individual requests

---

### 4.3 Leave Request Workflow

**Status:** Fully Implemented ✅

#### Request Lifecycle
1. **Submit** - Employee submits request
2. **Validate** - Check balance and blackout periods
3. **Review** - Manager approval workflow
4. **Approve/Reject** - Decision with notes
5. **Cancel** - Employee or manager can cancel
6. **Fulfillment** - Track actual absence

**Request Details:**
- Start and end dates
- Days requested
- Policy type
- Reason
- Notes
- Status (pending, approved, rejected, cancelled)
- Reviewer details and notes
- Cancellation reason

**Validation Rules:**
- Sufficient balance
- Not in blackout period
- Advance notice met
- Minimum increment respected
- Policy-specific rules

**API Endpoints:**
- `time-off.createRequest` - Submit request
- `time-off.getRequests` - List requests
- `time-off.approveRequest` - Approve
- `time-off.rejectRequest` - Reject
- `time-off.cancelRequest` - Cancel

---

### 4.4 Carryover Management

**Status:** Fully Implemented ✅

#### End-of-Year Processing
- Automatic carryover calculation
- Maximum carryover enforcement
- Expiration rules
- Carryover expiration date tracking
- Carry-forward limits

**Features:**
- Automatic accrual to next year
- Expiration enforcement
- Vacation payout on termination
- Blackout period support
- Year-end balance snapshots

---

## 5. Compliance & Legal Requirements

### 5.1 Registre du Personnel (Digital Employee Register)

**Status:** Fully Implemented ✅ - GAP-REG-001

#### Overview
A legally compliant digital employee register meeting West African labor inspection requirements.

**Features:**
- Sequential entry numbering per tenant
- Automatic entry on hire
- Automatic entry on termination
- Employee snapshot at entry time
- Complete audit trail
- PDF export in legal format
- Excel export option

**Entry Types:**
- Hire (entry onto register)
- Modification (job change, salary increase, etc.)
- Exit (termination)

**Data Captured:**
- Entry number (sequential)
- Employee number
- Full name
- Hire date
- Position/role
- Department
- CNPS number
- Termination date (if applicable)
- Termination reason (if applicable)
- Entry date and timestamp
- Created by (user)
- Audit log

**Export Formats:**
- PDF (landscape A4, legal format)
- Excel with formatting
- Filtered exports:
  - Full register
  - Active employees only
  - Current year only
  - Custom date range

**Automatic Triggers:**
- Inngest event on employee hire → Auto-creates hire entry
- Inngest event on employee termination → Auto-creates exit entry
- Retry logic for failed events
- Error logging for failed entries

**API Endpoints:**
- `registre.createHireEntry` - Manual entry creation
- `registre.createExitEntry` - Manual exit entry
- `registre.listEntries` - Paginated list
- `registre.searchEntries` - Search with filters
- `registre.getStats` - Dashboard statistics
- `registre.exportToPDF` - Generate PDF
- `registre.exportToExcel` - Generate Excel

**UI Features:**
- Statistics dashboard
- Search by employee name
- Filter by entry type
- Paginated table view
- Export action menu
- Mobile-first responsive design
- French language throughout

**Database Tables:**
- `employee_register_entries` - Main register with sequential numbering
- `register_audit_log` - Complete audit trail
- `register_exports` - Export tracking

---

### 5.2 CDD Compliance (Fixed-Term Contracts)

**Status:** Fully Implemented ✅ - GAP-CDD-001

#### Fixed-Term Contract Management
Support for CDD (Contrat à Durée Déterminée) - temporary/fixed-term contracts.

**Features:**
- CDD creation and tracking
- Fixed end date enforcement
- Automatic conversion to CDI (permanent) rules
- Pre-notification requirements (30, 60, 90 days)
- Contract type tracking
- Notice period rules by contract type
- Severance rules (if applicable)

**Contract Information:**
- Contract type (CDD vs CDI)
- Start date
- End date (for CDD)
- Duration
- Reason for CDD (project, replacement, seasonal)
- Renewal tracking
- Conversion to CDI

**Compliance Validation:**
- Maximum CDD duration limits
- Renewal restrictions
- Notice period requirements
- Severance calculations
- Legal compliance warnings

**Database Tables:**
- CDD compliance rules by country
- Employee contract type tracking
- Contract history

---

### 5.3 Coefficient-Based Minimum Wage Validation (GAP-COEF-001)

**Status:** Fully Implemented ✅

#### Validation System
Prevents illegal underpayment based on employee category.

**Formula:**
```
Minimum Wage = (Employee Coefficient × SMIG) / 100
```

**Validation Points:**
- At salary entry/update
- During payroll calculation
- On salary review
- Warning in compensation UI

**Helper Functions:**
- Get minimum wage for coefficient
- Validate salary against minimum
- Get category information
- Return French error messages

**API Endpoints:**
- `employees.getMinimumWageHelper` - Get min wage info

---

### 5.4 12-Hour Shift Limit (GAP-SEC-003)

**Status:** Fully Implemented ✅

#### Shift Enforcement
Ensures compliance with maximum 12-hour shift rules (Security sector).

**Features:**
- Maximum shift duration enforcement (12 hours)
- Automatic violation detection
- Warning messages
- Shift tracking by date
- Overtime distinction from shift overage

**Validation:**
- Clock in/out validation
- Time entry approval workflow
- Sector-specific rules
- Alert generation for violations

---

### 5.5 CGECI Barème 2023 Support (GAP-CGECI-001)

**Status:** Fully Implemented ✅

#### CGECI Salary Grid Support
Support for sector-specific minimum wages from CGECI (Confédération Générale des Entreprises de Côte d'Ivoire).

**Features:**
- Sector-specific categories
- Actual minimum wage amounts per sector
- Backward compatibility with generic Convention Collective
- Sector code tracking on employee
- Category code tracking on employee
- Sector code variations

**Sectors Supported:**
- BTP (Construction)
- BANQUES (Banking)
- COMMERCE (Retail)
- INDUSTRIE (Manufacturing)
- AGRICULTURE (Agriculture)
- TRANSPORT (Transport)
- Others via metadata

**Database:**
- `employee_category_coefficients` with sector_code column
- `actual_minimum_wage` field for sector-specific amounts
- Backward compatibility (sector_code = NULL for generic categories)

---

## 6. Convention Collective Support

### 6.1 Banking Convention (GAP-CONV-BANK-001)

**Status:** Fully Implemented ✅

#### Professional Levels (I-IX)
Banking sector uses 9 professional levels instead of traditional categories.

**Levels:**
- Level I: Entry-level positions (Caissier, Guichetier)
- Level II-IX: Progressive seniority and responsibility
- Minimum salaries per level
- Typical positions for guidance

**Features:**
- Level assignment to employees
- Minimum salary enforcement by level
- Seniority bonus calculations
- Professional level display in UI

**Seniority Bonuses:**
- Automatic bonuses based on years of service
- Bonus rate: +3% every 3 years
- Automatic inclusion in payroll
- Example: 3 years = 3%, 6 years = 6%, 9 years = 9%

**API Endpoints:**
- `conventions.getBankingLevels` - List levels
- `conventions.getSeniorityBonus` - Calculate bonus
- `payroll.calculateBankingSeniorityBonus` - Include in payroll

**Database Tables:**
- `convention_collectives` - Convention definitions
- `banking_professional_levels` - Level definitions
- `banking_seniority_bonuses` - Seniority bonus rules

---

### 6.2 Multi-Convention Support

**Status:** Framework Ready ✅

#### Supported Conventions
- INTERPRO (Interprofessional - default)
- BANKING (Secteur Bancaire)
- BTP (Construction/Building)

**Implementation:**
- Convention code field on employees
- Professional level field (for conventions that use it)
- Database-driven rules
- Easy to extend for additional conventions

**Features:**
- Convention-specific salary rules
- Convention-specific benefits
- Professional level mappings
- Seniority/tenure calculations
- Bonuses and allowances

---

## 7. Document Generation & Management

### 7.1 Payslip Generation

**Status:** Fully Implemented ✅

#### Dynamic Payslip Creation
Generates legally compliant payslips in PDF format.

**Content:**
- Employee information (name, number, CNPS, tax ID)
- Payroll period
- Gross salary breakdown (base + allowances)
- Deductions (tax, social security)
- Employer contributions (for informational purposes)
- Net salary
- Year-to-date summary
- Leave balance summary (optional)
- Company information and branding

**Customization:**
- Tenant-specific templates
- Logo/header/footer customization
- Layout options (standard, compact, detailed)
- Font and color customization
- Custom field support (via Handlebars)
- Multiple template management

**Features:**
- Bulk generation for entire payroll run
- Version tracking (corrections)
- Document replacement (correction payslips)
- Access tracking (GDPR compliance)
- Employee portal access

**API Endpoints:**
- `documents.generatePayslip` - Generate single payslip
- `documents.bulkGeneratePayslips` - Generate for payroll run
- `documents.getTemplate` - Retrieve template
- `documents.updateTemplate` - Modify template

**Database Tables:**
- `payslip_templates` - Template definitions
- `generated_documents` - Generated document tracking
- `document_access_log` - Access audit trail
- `bulk_generation_jobs` - Job progress tracking

---

### 7.2 Termination Documents

**Status:** Fully Implemented ✅

#### Exit Documentation
Automatically generated upon employee termination.

**Document Types:**
- **Work Certificate (Certificat de Travail)**
  - Employee tenure confirmation
  - Job title
  - Dates of employment
  - Reason for departure (if applicable)
  - Company signature

- **Settlement Statement (Solde de Tout Compte)**
  - Final salary
  - Vacation payout
  - Tax withholding
  - Deductions
  - Net amount due
  - Employer acknowledgment

- **CNPS Attestation (for continuation of benefits)**
  - Employment period
  - Contribution summary
  - Benefit eligibility information

**Automatic Generation:**
- Triggered on termination
- Manual generation also available
- Version tracking
- Correction support

**API Endpoints:**
- `documents.generateWorkCertificate` - Generate certificate
- `documents.generateSettlementStatement` - Generate settlement
- `documents.generateCNPSAttestation` - Generate CNPS document
- `documents.getTerminationDocuments` - List all documents for terminated employee

**Database Integration:**
- Links to payroll termination
- Tracks via `generated_documents` table
- Metadata includes termination details

---

### 7.3 Document Management System

**Status:** Fully Implemented ✅

#### Document Storage & Access
Centralized document management with access control.

**Features:**
- PDF storage in Supabase Storage
- Document versioning
- Document replacement tracking
- Access logging
- Employee self-service access
- Manager/HR access
- Download and email delivery

**Document Types:**
- Payslips (monthly, corrected)
- Work certificates
- Settlement statements
- CNPS attestations
- Termination notifications
- Custom documents

**Access Control:**
- RLS policies for tenant isolation
- Employees access own documents
- HR access all documents
- Audit trail of all access

**API Endpoints:**
- `documents.getDocument` - Retrieve document
- `documents.listDocuments` - List with filtering
- `documents.deleteDocument` - Archive document
- `documents.downloadDocument` - Download as file
- `documents.emailDocument` - Send to employee/external

**Database Tables:**
- `document_templates` - Template definitions (legacy)
- `payslip_templates` - Payslip-specific templates
- `generated_documents` - Document storage metadata
- `document_access_log` - Access audit trail
- `bulk_generation_jobs` - Batch job tracking

---

## 8. Salary Management & Reviews

### 8.1 Salary Component System

**Status:** Fully Implemented ✅

#### Component Types
- Base salary
- Transport allowance
- Meal allowance
- Housing allowance
- Communication/Phone allowance
- Family allowance
- Performance bonus
- Annual bonus
- 13th-month bonus
- Overtime premium
- Weekend/night premium
- Seniority bonus (convention-based)
- Cost-of-living adjustment
- Custom components

**Component Properties:**
- Code (standard or tenant-specific)
- Name (French and English)
- Category (earnings, deductions, allowance)
- Type (fixed, variable, percentage-based)
- Taxable status
- Social security subject status
- Calculation method
- Default value
- Compliance rules
- Metadata for future enhancements

**Features:**
- Country-specific templates
- Tenant customization
- Pre-defined common components
- Custom component creation
- Component validation
- Restricted component codes (system integrity)

**API Endpoints:**
- `salary-components.list` - List available components
- `salary-components.create` - Create custom component
- `salary-components.update` - Modify component
- `salary-components.getTemplates` - Get pre-defined set

**Database Tables:**
- `salary_component_definitions` - Master definitions
- `salary_component_instances` - Employee-specific instances

---

### 8.2 Salary History Tracking

**Status:** Fully Implemented ✅

#### Historical Records
Complete salary history for each employee.

**Tracked Information:**
- Salary amount
- Effective date
- Components applied
- Changes (reason)
- Previous salary (for comparison)
- Approval status
- Change notes

**Features:**
- Timeline view of salary changes
- Comparison between periods
- Reason tracking
- Approval workflow
- Bulk salary adjustments

**API Endpoints:**
- `salaries.getHistory` - Get salary history
- `salaries.getCurrentSalary` - Get active salary
- `salaries.createSalaryChange` - Record change
- `salaries.approveSalaryChange` - Approve change

---

### 8.3 Bulk Salary Adjustments

**Status:** Fully Implemented ✅

#### Batch Operations
Apply salary changes to multiple employees at once.

**Use Cases:**
- Annual SMIG increase
- Company-wide bonus
- Department-wide raise
- Across-the-board cost-of-living adjustment
- Promotion group updates

**Process:**
1. Define adjustment criteria (filter employees)
2. Specify adjustment amount/percentage
3. Set effective date
4. Review preview (changes for each employee)
5. Submit for approval
6. Approval workflow
7. Apply changes

**Features:**
- Employee filtering (department, category, salary range, etc.)
- Fixed amount or percentage increase
- Effective date setting
- Preview before apply
- Approval workflow
- Audit trail
- Rollback capability

**API Endpoints:**
- `bulk-adjustments.create` - Create adjustment group
- `bulk-adjustments.preview` - Preview changes
- `bulk-adjustments.apply` - Apply approved changes
- `bulk-adjustments.list` - List adjustments
- `bulk-adjustments.getDetails` - View details

**Database Tables:**
- `bulk_salary_adjustments` - Track adjustments
- `bulk_adjustment_lines` - Individual changes

---

### 8.4 Salary Reviews

**Status:** Fully Implemented ✅

#### Performance-Based Review Process
Support for merit-based salary reviews.

**Features:**
- Review period definition
- Employee filtering
- Review questionnaire
- Performance scoring
- Recommended increase
- Manager approval
- HR approval
- Implementation tracking

**Data Captured:**
- Review date
- Period reviewed
- Performance rating
- Reviewer notes
- Recommended salary
- Justification
- Approval signatures
- Effective date

**API Endpoints:**
- `salary-reviews.create` - Create review
- `salary-reviews.getReviews` - List reviews
- `salary-reviews.submitReview` - Submit review
- `salary-reviews.approveReview` - Approve
- `salary-reviews.implementReview` - Apply salary change

---

## 9. Accounting Integration

### 9.1 General Ledger Integration

**Status:** Fully Implemented ✅

#### GL Export System
Automatic journal entry generation from payroll.

**Features:**
- Automatic GL entry creation from payroll runs
- Multiple accounting system support (SYSCOHADA, IFRS)
- Account mapping by component
- Department cost center assignment
- Export to accounting software
- Complete audit trail

**GL Journal Entries Include:**
- Entry date
- Account code and name
- Debit and credit amounts
- Department and cost center
- Employee reference
- Description
- Reference number

**GL Export Formats:**
- CSV for manual import
- Excel with formatting
- JSON for API integration
- OFX for bank reconciliation

**API Endpoints:**
- `accounting.generateGLEntries` - Create entries from payroll
- `accounting.exportGL` - Export to file
- `accounting.getGLExportHistory` - View past exports
- `accounting.getGLExportPreview` - Preview before export

**Database Tables:**
- `accounting_accounts` - Chart of accounts
- `payroll_account_mappings` - Component to GL account mappings
- `gl_exports` - Export tracking
- `gl_journal_entries` - Individual journal entries

---

### 9.2 Account Mappings

**Status:** Fully Implemented ✅

#### Component to GL Account Mapping
Configure how payroll components map to accounting.

**Mappings Include:**
- Component type (base salary, CNPS, tax, etc.)
- Debit account
- Credit account
- Department assignment
- Cost center code
- Effective dates
- Active/inactive status

**Features:**
- Multiple mappings per component (by department)
- Cost center allocation
- Effective date ranges
- Template-based setup
- Easy editing interface

**API Endpoints:**
- `accounting.getAccountMappings` - List mappings
- `accounting.createMapping` - Create new mapping
- `accounting.updateMapping` - Modify mapping
- `accounting.deleteMapping` - Remove mapping

---

### 9.3 Payment Processing

**Status:** Fully Implemented ✅

#### Banking Integration
Export payroll data for bank payments.

**Features:**
- Bank transfer file generation
- Payment method tracking
- Recipient bank details
- Amount verification
- Payment reference generation
- Multiple bank format support

**Formats:**
- CSV for bank portal import
- Excel for review
- SEPA XML (for international)
- Custom formats via templates

**API Endpoints:**
- `banking.generateBankTransferFile` - Create payment file
- `banking.getBankTransferSummary` - Validate amounts
- `banking.getPaymentMethods` - List available methods

**Database Tables:**
- `payment_methods` - Employee payment preferences

---

## 10. Data & System Management

### 10.1 Onboarding System

**Status:** Fully Implemented ✅

#### Multi-Step Onboarding Wizard
Guided setup for new companies and first payroll.

**Steps:**
1. **Country Selection** - Choose primary country
2. **Company Information** - Basic business details
3. **Department Setup** - Create initial departments
4. **First Employee** - Add first employee
5. **First Payroll** - Preview first payroll calculation
6. **Completion** - Go-live

**Features:**
- Progressive disclosure (only needed info)
- Validation at each step
- Back/forward navigation
- Save and resume capability
- Context-sensitive help
- Mobile-first responsive design
- 100% French language

**Smart Defaults:**
- Country-specific tax rules auto-loaded
- Default salary components
- Default policies
- Recommended department structure

**UI Components:**
- Country selector with flags
- Form fields with validation
- Preview cards showing calculated data
- Help boxes and explanations
- Progress indicator

**API Endpoints:**
- `onboarding.startOnboarding` - Initialize
- `onboarding.completeStep` - Submit step
- `onboarding.getProgress` - View progress
- `onboarding.finishOnboarding` - Go-live

---

### 10.2 Sage Data Migration

**Status:** Fully Implemented ✅

#### Legacy System Migration
Support for migrating data from Sage accounting software.

**Features:**
- Employee import from Sage
- Salary history import
- GL account mapping
- Historical data preservation
- Verification and validation
- Error reporting
- Partial import support

**API Endpoints:**
- `data-migration.importSageData` - Start import
- `data-migration.validateImport` - Check for errors
- `data-migration.getMappingErrors` - Report issues
- `data-migration.completeImport` - Finalize

**Database Tables:**
- `sage_import_logs` - Import tracking
- `sage_import_errors` - Error reporting
- `sage_mapping_config` - Field mappings

---

### 10.3 Payroll Configuration Management

**Status:** Fully Implemented ✅

#### Configuration Loading & Caching
Dynamic loading of country-specific payroll rules.

**RuleLoader Service:**
- Loads tax systems by country code
- Loads social security schemes
- Loads contribution rates
- Loads sector overrides
- Caches configuration
- Validates configuration integrity

**Features:**
- Database-driven configuration
- No hardcoded rules
- Easy rule updates
- Multi-country support
- Effective date tracking
- Override capability

**Configuration Tables:**
- `tax_systems` - Tax definitions
- `tax_brackets` - Tax brackets
- `family_deduction_rules` - Deductions
- `social_security_schemes` - Contribution schemes
- `contribution_types` - Individual contributions
- `sector_contribution_overrides` - Sector rates
- `salary_component_definitions` - Components
- `other_taxes` - Additional taxes

---

## 11. Workflow Automation & Business Rules

### 11.1 Workflow Automation Engine

**Status:** Fully Implemented ✅

#### Business Process Automation
Automated workflows for common HR processes.

**Supported Workflows:**
- Leave request approval chains
- Salary change approval
- Timesheet approval
- Termination processes
- Document generation
- Payroll approval
- Data validation

**Workflow Features:**
- Multi-step approval chains
- Role-based approvers
- Time-based escalation
- Conditional logic
- Email notifications
- Task assignments
- Status tracking
- Audit trail

**Builder Interface:**
- Visual workflow builder
- Drag-and-drop conditions
- Rule configuration
- Testing mode
- Activation/deactivation

**API Endpoints:**
- `workflows.createWorkflow` - Define new workflow
- `workflows.listWorkflows` - List active workflows
- `workflows.executeWorkflow` - Run workflow
- `workflows.getStatus` - Check execution status

**Database Tables:**
- `workflow_definitions` - Workflow configuration
- `workflow_executions` - Execution tracking
- `workflow_tasks` - Individual tasks
- `workflow_approvals` - Approval records

---

### 11.2 Batch Operations

**Status:** Fully Implemented ✅

#### Bulk Processing
Execute operations on multiple records efficiently.

**Operations:**
- Bulk employee updates
- Bulk salary changes
- Bulk policy assignments
- Bulk document generation
- Bulk data exports

**Features:**
- CSV/Excel file import
- Field mapping
- Validation before execution
- Progress tracking
- Error reporting
- Partial success handling
- Retry capability

**API Endpoints:**
- `batch-operations.startBatch` - Begin operation
- `batch-operations.getProgress` - Track progress
- `batch-operations.getErrors` - View failures
- `batch-operations.completeBatch` - Finalize

---

## 12. Multi-Tenancy & Org Structure

### 12.1 Tenant Configuration

**Status:** Fully Implemented ✅

#### Multi-Tenant Architecture
Complete isolation and customization per organization.

**Tenant Settings:**
- Company name and slug
- Country and currency
- Timezone
- Tax ID
- Industry
- Email and HR contact
- Plan and features
- Subscription status
- Custom settings (JSON)

**Features:**
- Row-level security (RLS) isolation
- Tenant-specific customizations
- Feature flags per plan
- Domain/subdomain support
- Email branding
- Logo and customization
- Policy templates

**API Endpoints:**
- `tenant.getInfo` - Retrieve tenant details
- `tenant.updateSettings` - Modify settings
- `tenant.getFeatures` - List available features

---

### 12.2 Organizational Structure

**Status:** Fully Implemented ✅

#### Departments, Positions, and Assignments

**Departments:**
- Name and code
- Parent department (for hierarchy)
- Manager assignment
- Budget allocation
- Location
- Active status

**Positions:**
- Title and code
- Department
- Salary band
- Reporting structure
- Job description
- Skills required
- Requirements

**Assignments:**
- Employee to position mapping
- Effective dating
- Assignment type (primary, secondary)
- Assignment reason
- Notes

**Features:**
- Org chart visualization
- Reporting structure tracking
- Position history
- Multiple position assignments
- Salary by position

**API Endpoints:**
- `departments.list` - List departments
- `departments.create` - Create department
- `positions.list` - List positions
- `positions.create` - Create position
- `assignments.create` - Assign employee
- `assignments.getOrgChart` - Organization chart

**Database Tables:**
- `departments` - Department definitions
- `positions` - Position definitions
- `assignments` - Employee position assignments

---

## 13. Role-Based Access Control

### 13.1 Permission System

**Status:** Fully Implemented ✅

#### Role Hierarchy
- **Super Admin** - Platform-wide access
- **Tenant Admin** - Tenant-wide management
- **HR Manager** - Payroll and employee management
- **Manager** - Direct report oversight
- **Employee** - Self-service access
- **Accountant** - GL and finance views

**Features:**
- Row-level security (RLS)
- Tenant isolation
- Feature-based access
- Data-level permissions
- Audit logging

**API Endpoints:**
- `auth.getCurrentUser` - Get user profile
- `auth.getUserPermissions` - List permissions
- `auth.assignRole` - Admin function

---

## 14. Dashboard & Reporting

### 14.1 Payroll Dashboard

**Status:** Fully Implemented ✅

#### Executive Overview
- Total employees (active, inactive, terminated)
- Current month payroll summary
- YTD totals (gross, net, taxes)
- Upcoming payroll dates
- Pending approvals
- Recent activity

**Charts & Visualizations:**
- Payroll trend (last 12 months)
- Department breakdown
- Salary distribution
- Tax vs. contributions
- Payment status tracking

**Quick Actions:**
- Create payroll run
- View recent runs
- Generate reports
- Export data

---

### 14.2 Employee Dashboard

**Status:** Fully Implemented ✅

#### Employee Self-Service
- Current salary information
- Year-to-date pay
- Leave balance
- Recent payslips
- Personal documents
- Update profile

**Features:**
- Responsive mobile design
- Simple navigation
- Zero learning curve

---

## 15. Mobile & UX Considerations

### 15.1 Mobile-First Design

**Status:** Fully Implemented ✅

**Principles:**
- Touch targets minimum 44x44px
- Single-hand operation on 5" screens
- Progressive disclosure
- Offline support (limited)
- Fast load times (3G support)
- Simplified navigation

**Supported Features on Mobile:**
- Time tracking (clock in/out)
- Leave requests
- Payslip viewing
- Document download
- Basic reporting

---

### 15.2 French Language Support

**Status:** 100% Complete ✅

All user-facing text in French (business language, no English):
- User interface
- Error messages
- Help text
- Reports
- Documentation
- Email notifications

---

## 16. Key Implementation Statistics

### Database Schema
- **Tables:** 50+
- **Relationships:** Complex multi-level
- **Row-Level Security:** Comprehensive
- **Indexes:** Performance-optimized

### API Endpoints
- **tRPC Routers:** 35+
- **Endpoints:** 200+
- **Query Operations:** 100+
- **Mutation Operations:** 100+

### Services & Business Logic
- **Service Files:** 45+
- **Complex Functions:** 150+
- **Calculation Engines:** 8+
- **Export Generators:** 6+

### UI Components
- **Component Files:** 80+
- **Pages:** 40+
- **Reusable Components:** 50+
- **Responsive Layouts:** 100%

### Data Migrations
- **Migration Scripts:** 50+
- **Database Versions:** Tracked
- **Backward Compatibility:** Maintained

---

## 17. Recent Additions & Latest Features

### October 2025 - Latest Implementations

1. **Rate Type Support (Daily/Hourly Workers)**
   - Added `rate_type` field to employees
   - Support for MONTHLY, DAILY, HOURLY calculations
   - Hours/days tracking in payroll
   - Pro-rata calculations

2. **Multi-Site/Location Support**
   - `locations` table for site master data
   - `employee_site_assignments` for daily tracking
   - Location-based allowances (transport, meal, site premium)
   - Hazard pay by location
   - Geofencing support
   - Location-specific payroll integration

3. **CGECI Barème 2023 Support**
   - Sector-specific minimum wages
   - Category codes per sector
   - Actual minimum wage fields
   - Backward compatibility with generic categories
   - Sector code variations (BTP, BANQUES, COMMERCE, etc.)

4. **Work Schedules for Daily/Hourly Workers**
   - Per-day schedule tracking
   - Full day, partial day, absent types
   - Approval workflow
   - Weekly grouping
   - Payroll integration
   - Absence tracking

5. **Registre du Personnel (Digital Employee Register)**
   - Legally compliant register
   - Sequential entry numbering
   - Auto-sync on hire/termination
   - PDF export (legal format)
   - Audit trail
   - Search and filtering

6. **Enhanced Document Generation**
   - Customizable payslip templates
   - Template versioning
   - Bulk generation with progress tracking
   - Document replacement for corrections
   - Access audit logging
   - Multiple export formats

7. **Accounting Integration**
   - GL journal entry generation
   - Chart of accounts management
   - Payroll account mappings
   - Cost center allocation
   - Export tracking
   - Multiple accounting systems (SYSCOHADA, IFRS)

8. **Banking Convention Support**
   - Professional levels I-IX
   - Minimum salaries by level
   - Seniority bonuses (+3% per 3 years)
   - Banking sector payroll rules

9. **Compliance & Legal Features**
   - Coefficient-based minimum wage validation
   - 12-hour shift limits
   - CDD compliance tracking
   - Termination notification automation
   - Registre du Personnel sync

10. **Salary Components Enhancement**
    - Standard and custom components
    - Country-specific templates
    - Taxable/social security configuration
    - Component codes (system integrity)
    - Compliance rules

---

## 18. Code Quality & Architecture

### TypeScript Best Practices
- Full type safety
- No `as any` casts
- Derived types from schema (`$inferSelect`, `$inferInsert`)
- Comprehensive error handling

### Database Design
- Proper foreign keys
- Cascading deletes
- Indexes for performance
- RLS policies for security
- Audit columns (createdAt, updatedAt, createdBy, updatedBy)

### Service Layer
- Business logic separation
- Database-driven configuration
- Reusable services
- Error handling with French messages
- Validation at multiple levels

### API Design
- RESTful principles via tRPC
- Type-safe queries and mutations
- Input validation with Zod
- Proper HTTP semantics
- Pagination support

### UI/UX
- shadcn/ui components (Radix UI + Tailwind)
- Responsive design (mobile-first)
- Accessibility standards
- Progressive disclosure
- Zero learning curve

---

## 19. Known Limitations & Future Work

### Current Limitations
1. **Countries:** Primary support for Côte d'Ivoire (framework for SN, BF)
2. **Conventions:** INTERPRO, BANKING, BTP implemented; others via framework
3. **Export Formats:** CSV, Excel, PDF; limited ERP integrations
4. **Payment Processing:** File export only (not direct bank API integration)
5. **Analytics:** Dashboard views only (limited drill-down reporting)

### Future Enhancement Areas
1. **Additional Countries:** Expand to more West African nations
2. **More Conventions:** Additional sector-specific agreements
3. **Advanced Analytics:** Custom report builder
4. **Mobile App:** Native mobile applications
5. **E-Signature:** Digital signature support for documents
6. **API Marketplace:** Third-party integrations
7. **HR Features:** Recruitment, performance management, learning

---

## 20. Deployment & Operations

### Infrastructure
- Supabase (PostgreSQL backend)
- Vercel (Frontend hosting)
- Next.js (Full-stack framework)
- Inngest (Event automation)

### Database
- PostgreSQL 14+
- 50+ tables with RLS
- Automated migrations
- Backup and recovery

### Monitoring & Logging
- Error tracking
- Event logging (Inngest)
- Audit trails
- Performance monitoring

### Security
- Row-level security (RLS)
- Tenant isolation
- Password hashing
- GDPR compliance (document access logs)
- Data encryption at rest and in transit

---

## Conclusion

Preem HR is a **production-ready enterprise HR/payroll system** with comprehensive support for complex West African labor regulations. The system successfully implements:

✅ **100+ business features** across 15+ major domains
✅ **3 payment types** (monthly, daily, hourly) with full calculation support
✅ **10+ business sectors** with specific configurations
✅ **5+ major compliance systems** (Registre, CDD, coefficient validation, etc.)
✅ **Multiple accounting integrations** (GL exports, CNPS, CMU, ETAT 301)
✅ **Multi-tenancy** with complete isolation and customization
✅ **Mobile-first design** supporting low digital literacy users
✅ **100% French language** interface
✅ **Type-safe TypeScript** codebase with best practices
✅ **Database-driven configuration** (no hardcoded rules)

The architecture is **scalable, maintainable, and extensible** with clear patterns for adding new countries, sectors, and features. All implementations follow HCI design principles for low-literate users and are validated against West African labor law requirements.

---

**Document Version:** 1.0
**Last Updated:** October 23, 2025
**Prepared By:** Claude Code - Analysis System
