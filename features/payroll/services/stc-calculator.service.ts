/**
 * STC (Solde de Tout Compte) Calculator Service
 *
 * Comprehensive final settlement calculation for all 7 departure scenarios:
 * 1. FIN_CDD - End of fixed-term contract
 * 2. DEMISSION_CDI - Resignation from permanent contract
 * 3. DEMISSION_CDD - Resignation from fixed-term contract (before term)
 * 4. LICENCIEMENT - Dismissal by employer
 * 5. RUPTURE_CONVENTIONNELLE - Mutual agreement termination
 * 6. RETRAITE - Retirement (age ≥ 60)
 * 7. DECES - Death of employee
 *
 * Conformité: Convention Collective Interprofessionnelle Articles 34-40
 */

import { db } from '@/db';
import {
  employees,
  employeeSalaries,
  employmentContracts,
  timeOffBalances,
  tenants,
} from '@/drizzle/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { differenceInDays, differenceInMonths, subMonths, getDaysInMonth } from 'date-fns';
import { calculateSTCTaxation, type STCTaxationResult } from './stc-taxation.service';

// ====================================
// TYPE DEFINITIONS
// ====================================

export type DepartureType =
  | 'FIN_CDD'
  | 'DEMISSION_CDI'
  | 'DEMISSION_CDD'
  | 'LICENCIEMENT'
  | 'RUPTURE_CONVENTIONNELLE'
  | 'RETRAITE'
  | 'DECES';

export type NoticePeriodStatus = 'worked' | 'paid_by_employer' | 'paid_by_employee' | 'waived';

export type LicenciementType =
  | 'economique'
  | 'faute_simple'
  | 'faute_grave'
  | 'faute_lourde'
  | 'inaptitude';

export interface Beneficiary {
  name: string;
  relationship: 'spouse' | 'child' | 'parent' | 'other';
  identityDocument: string;
  bankAccount: string;
  sharePercentage: number;
}

export interface STCCalculationInput {
  employeeId: string;
  tenantId: string;
  departureType: DepartureType;
  terminationDate: Date;

  // Configuration préavis
  noticePeriodStatus: NoticePeriodStatus;

  // Spécifique licenciement
  licenciementType?: LicenciementType;

  // Spécifique rupture conventionnelle
  ruptureNegotiatedAmount?: number;

  // Spécifique décès
  beneficiaries?: Beneficiary[];
  deathCertificateUrl?: string;
}

export interface STCResult {
  // Composants salaire
  proratedSalary: number;
  vacationPayout: number;
  gratification: number;

  // Préavis
  noticePayment: number; // Positif = paiement, Négatif = déduction
  noticePeriodMonths: number;

  // Indemnités
  severancePay: number; // IL, IDR, ou indemnité rupture
  cddEndIndemnity: number; // Seulement fin CDD
  funeralExpenses: number; // Seulement décès

  // Totaux
  grossSalary: number;
  totalIndemnities: number;
  totalTaxable: number;
  totalTaxFree: number;
  netToPay: number;

  // Taxation détaillée
  taxation: STCTaxationResult;

  // Détails calcul
  calculationDetails: {
    unusedLeaveDays: number;
    yearsOfService: number;
    averageSalary12M: number;
    salaireCategoriel: number;
    monthlyGrossSalary: number;
    isCadre: boolean;
  };

  // Métadonnées
  metadata: {
    departureType: DepartureType;
    contractType: string;
    hireDate: Date;
    terminationDate: Date;
    legalMinimumSeverance?: number;
    negotiatedAmount?: number;
  };
}

// Internal types
interface EmployeeData {
  employee: any;
  contract: any;
  salary: any;
  tenant: any;
}

interface CommonComponents {
  proratedSalary: number;
  vacationPayout: number;
  gratification: number;
  unusedLeaveDays: number;
  yearsOfService: number;
  averageSalary12M: number;
  employee: any;
  contract: any;
  salary: any;
  tenant: any;
}

// ====================================
// MAIN CALCULATION FUNCTION
// ====================================

export async function calculateSTC(input: STCCalculationInput): Promise<STCResult> {
  console.log('[STC Calculator] Starting calculation for:', input.departureType);
  console.log('[STC Calculator] Employee ID:', input.employeeId);
  console.log('[STC Calculator] Termination date:', input.terminationDate);

  try {
    // 1. Récupérer données employé
    console.log('[STC Calculator] Fetching employee data...');
    const employeeData = await fetchEmployeeData(input.employeeId, input.tenantId);
    console.log('[STC Calculator] Employee data fetched successfully');

    // 2. Valider éligibilité selon type départ
    console.log('[STC Calculator] Validating departure type...');
    validateDepartureType(input.departureType, employeeData, input);
    console.log('[STC Calculator] Departure type validated');

    // 3. Calculer composants communs
    console.log('[STC Calculator] Calculating common components...');
    const commonComponents = await calculateCommonComponents(
      employeeData,
      input.terminationDate
    );
    console.log('[STC Calculator] Common components calculated:', {
      yearsOfService: commonComponents.yearsOfService,
      averageSalary12M: commonComponents.averageSalary12M,
      proratedSalary: commonComponents.proratedSalary,
    });

  // 4. Calculer selon type de départ
  let specificComponents: Partial<STCResult>;

  switch (input.departureType) {
    case 'FIN_CDD':
      specificComponents = await calculateFinCDD(employeeData, commonComponents, input);
      break;

    case 'DEMISSION_CDI':
      specificComponents = await calculateDemissionCDI(employeeData, commonComponents, input);
      break;

    case 'DEMISSION_CDD':
      specificComponents = await calculateDemissionCDD(employeeData, commonComponents, input);
      break;

    case 'LICENCIEMENT':
      specificComponents = await calculateLicenciement(employeeData, commonComponents, input);
      break;

    case 'RUPTURE_CONVENTIONNELLE':
      specificComponents = await calculateRuptureConventionnelle(employeeData, commonComponents, input);
      break;

    case 'RETRAITE':
      specificComponents = await calculateRetraite(employeeData, commonComponents, input);
      break;

    case 'DECES':
      specificComponents = await calculateDeces(employeeData, commonComponents, input);
      break;

    default:
      throw new Error(`Type de départ non supporté: ${input.departureType}`);
  }

    // 5. Combiner et retourner
    console.log('[STC Calculator] Combining components...');
    const result = combineSTCComponents(commonComponents, specificComponents, input);
    console.log('[STC Calculator] Calculation complete successfully');
    return result;
  } catch (error: any) {
    console.error('[STC Calculator] ERROR:', error.message);
    console.error('[STC Calculator] Stack:', error.stack);
    throw error;
  }
}

// ====================================
// COMMON COMPONENTS CALCULATOR
// ====================================

async function calculateCommonComponents(
  employeeData: EmployeeData,
  terminationDate: Date
): Promise<CommonComponents> {
  const { employee, contract, salary, tenant } = employeeData;

  // 1. Salaire prorata
  const periodStart = new Date(terminationDate.getFullYear(), terminationDate.getMonth(), 1);
  const proratedSalary = calculateProratedSalary(
    salary.totalBaseSalary,
    periodStart,
    terminationDate
  );

  // 2. Congés payés
  const unusedLeaveDays = await getUnusedLeaveDays(employee.id, tenant.id);
  const vacationPayout = calculateVacationPayout(salary.totalBaseSalary, unusedLeaveDays);

  // 3. Gratification
  const gratification = calculateGratification(
    salary.salaireCategoriel,
    new Date(employee.hireDate),
    terminationDate,
    0.75 // Minimum légal
  );

  // 4. Années ancienneté
  const yearsOfService = calculateYearsOfService(new Date(employee.hireDate), terminationDate);

  // 5. Salaire moyen 12 mois
  const averageSalary12M = await calculateAverageSalary12Months(
    employee.id,
    tenant.id,
    terminationDate
  );

  return {
    proratedSalary,
    vacationPayout,
    gratification,
    unusedLeaveDays,
    yearsOfService,
    averageSalary12M,
    employee,
    contract,
    salary,
    tenant
  };
}

// ====================================
// DEPARTURE TYPE SPECIFIC CALCULATIONS
// ====================================

async function calculateFinCDD(
  employeeData: EmployeeData,
  common: CommonComponents,
  input: STCCalculationInput
): Promise<Partial<STCResult>> {
  const { contract } = employeeData;

  // Vérifier que c'est bien un contrat à durée déterminée (CDD, CDDTI, INTERIM)
  const validFixedTermContracts = ['CDD', 'CDDTI', 'INTERIM'];
  if (!validFixedTermContracts.includes(contract.contractType)) {
    throw new Error(`FIN_CDD requis un contrat CDD (type actuel: ${contract.contractType})`);
  }

  // Calculer indemnité 3%
  const totalGrossSalaryPaid = await calculateTotalGrossSalaryDuringContract(
    employeeData.employee.id,
    employeeData.tenant.id,
    new Date(contract.startDate),
    input.terminationDate
  );

  const cddEndIndemnity = totalGrossSalaryPaid * 0.03;

  return {
    noticePayment: 0, // Pas de préavis pour fin naturelle CDD
    noticePeriodMonths: 0,
    severancePay: 0, // Pas d'IL pour CDD
    cddEndIndemnity,
    funeralExpenses: 0
  };
}

async function calculateDemissionCDI(
  employeeData: EmployeeData,
  common: CommonComponents,
  input: STCCalculationInput
): Promise<Partial<STCResult>> {
  const { employee, salary } = employeeData;
  const { yearsOfService } = common;

  // Calculer préavis
  const isCadre = employee.employmentClassification === 'cadre';
  const noticePeriodMonths = getNoticePeriodMonths(yearsOfService, isCadre);

  let noticePayment = 0;

  if (input.noticePeriodStatus === 'paid_by_employee') {
    // Déduction (montant négatif)
    noticePayment = -(salary.totalBaseSalary * noticePeriodMonths);
  }
  // Si 'worked' ou 'waived': noticePayment = 0

  return {
    noticePayment,
    noticePeriodMonths,
    severancePay: 0, // Pas d'IL pour démission
    cddEndIndemnity: 0,
    funeralExpenses: 0
  };
}

async function calculateDemissionCDD(
  employeeData: EmployeeData,
  common: CommonComponents,
  input: STCCalculationInput
): Promise<Partial<STCResult>> {
  const { contract, salary } = employeeData;

  // Vérifier que c'est bien un contrat à durée déterminée (CDD, CDDTI, INTERIM)
  const validFixedTermContracts = ['CDD', 'CDDTI', 'INTERIM'];
  if (!validFixedTermContracts.includes(contract.contractType)) {
    throw new Error(`DEMISSION_CDD requis un contrat CDD (type actuel: ${contract.contractType})`);
  }

  // Calculer pénalité = salaire restant jusqu'au terme
  const daysRemaining = differenceInDays(new Date(contract.endDate!), input.terminationDate);
  const dailySalary = salary.totalBaseSalary / 30;
  const penaltyAmount = dailySalary * Math.max(0, daysRemaining);

  return {
    noticePayment: -penaltyAmount, // Déduction importante
    noticePeriodMonths: daysRemaining / 30,
    severancePay: 0,
    cddEndIndemnity: 0, // Pas d'indemnité si démission anticipée
    funeralExpenses: 0
  };
}

async function calculateLicenciement(
  employeeData: EmployeeData,
  common: CommonComponents,
  input: STCCalculationInput
): Promise<Partial<STCResult>> {
  const { employee, salary } = employeeData;
  const { yearsOfService, averageSalary12M } = common;

  // Déterminer multiplicateurs selon type licenciement
  let noticeMultiplier = 1;
  let severanceMultiplier = 1;

  switch (input.licenciementType) {
    case 'faute_grave':
      noticeMultiplier = 0;
      break;
    case 'faute_lourde':
      noticeMultiplier = 0;
      severanceMultiplier = 0;
      break;
    case 'inaptitude':
      noticeMultiplier = 2;
      severanceMultiplier = 2;
      break;
    // economique, faute_simple: multiplicateurs = 1
  }

  // Préavis (seulement si non effectué)
  const isCadre = employee.employmentClassification === 'cadre';
  const noticePeriodMonths = getNoticePeriodMonths(yearsOfService, isCadre);

  let noticePayment = 0;
  if (input.noticePeriodStatus === 'paid_by_employer') {
    noticePayment = salary.totalBaseSalary * noticePeriodMonths * noticeMultiplier;
  }

  // Indemnité de licenciement
  const severancePay = calculateSeverancePay(averageSalary12M, yearsOfService) * severanceMultiplier;

  return {
    noticePayment,
    noticePeriodMonths,
    severancePay,
    cddEndIndemnity: 0,
    funeralExpenses: 0
  };
}

async function calculateRuptureConventionnelle(
  employeeData: EmployeeData,
  common: CommonComponents,
  input: STCCalculationInput
): Promise<Partial<STCResult>> {
  const { employee, salary } = employeeData;
  const { yearsOfService, averageSalary12M } = common;

  // Calculer minimum légal
  const legalMinimumSeverance = calculateSeverancePay(averageSalary12M, yearsOfService);

  // Utiliser montant négocié OU minimum légal
  const ruptureIndemnity = Math.max(
    input.ruptureNegotiatedAmount || 0,
    legalMinimumSeverance
  );

  // Préavis: optionnel (peut être 0)
  const isCadre = employee.employmentClassification === 'cadre';
  const noticePeriodMonths = getNoticePeriodMonths(yearsOfService, isCadre);

  let noticePayment = 0;
  if (input.noticePeriodStatus === 'paid_by_employer') {
    noticePayment = salary.totalBaseSalary * noticePeriodMonths;
  }

  return {
    noticePayment,
    noticePeriodMonths,
    severancePay: ruptureIndemnity,
    cddEndIndemnity: 0,
    funeralExpenses: 0,
    metadata: {
      legalMinimumSeverance,
      negotiatedAmount: input.ruptureNegotiatedAmount || ruptureIndemnity
    } as any
  };
}

async function calculateRetraite(
  employeeData: EmployeeData,
  common: CommonComponents,
  input: STCCalculationInput
): Promise<Partial<STCResult>> {
  const { employee, salary } = employeeData;
  const { yearsOfService, averageSalary12M } = common;

  // Vérifier âge >= 60 ans
  const age = calculateAge(new Date(employee.dateOfBirth!), input.terminationDate);
  if (age < 60) {
    throw new Error(`Âge insuffisant pour départ retraite. Âge: ${age} ans (minimum: 60 ans)`);
  }

  // Préavis: toujours payé par employeur
  const isCadre = employee.employmentClassification === 'cadre';
  const noticePeriodMonths = getNoticePeriodMonths(yearsOfService, isCadre);
  const noticePayment = salary.totalBaseSalary * noticePeriodMonths;

  // Indemnité de départ retraite (même calcul que IL)
  const retirementIndemnity = calculateSeverancePay(averageSalary12M, yearsOfService);

  return {
    noticePayment,
    noticePeriodMonths,
    severancePay: retirementIndemnity, // Nommé "IDR" dans documents
    cddEndIndemnity: 0,
    funeralExpenses: 0
  };
}

async function calculateDeces(
  employeeData: EmployeeData,
  common: CommonComponents,
  input: STCCalculationInput
): Promise<Partial<STCResult>> {
  const { employee, salary, tenant } = employeeData;
  const { yearsOfService, averageSalary12M } = common;

  // Vérifier certificat décès
  if (!input.deathCertificateUrl) {
    throw new Error('Certificat de décès obligatoire');
  }

  // Vérifier bénéficiaires
  if (!input.beneficiaries || input.beneficiaries.length === 0) {
    throw new Error('Au moins un bénéficiaire requis');
  }

  const totalShares = input.beneficiaries.reduce((sum, b) => sum + b.sharePercentage, 0);
  if (Math.abs(totalShares - 100) > 0.01) {
    throw new Error(`Total des parts doit égaler 100% (actuel: ${totalShares}%)`);
  }

  // Préavis: payé aux ayants droit
  const isCadre = employee.employmentClassification === 'cadre';
  const noticePeriodMonths = getNoticePeriodMonths(yearsOfService, isCadre);
  const noticePayment = salary.totalBaseSalary * noticePeriodMonths;

  // Indemnité de décès (= IL si > 1 an ancienneté)
  const deathIndemnity = yearsOfService >= 1
    ? calculateSeverancePay(averageSalary12M, yearsOfService)
    : 0;

  // Frais funéraires
  const smig = tenant.countryCode === 'CI' ? 75000 : 60000; // CI vs autres
  const funeralExpenses = calculateFuneralExpenses(yearsOfService, smig);

  return {
    noticePayment,
    noticePeriodMonths,
    severancePay: deathIndemnity,
    cddEndIndemnity: 0,
    funeralExpenses
  };
}

// ====================================
// UTILITY FUNCTIONS
// ====================================

function calculateProratedSalary(
  monthlyGrossSalary: number,
  periodStart: Date,
  periodEnd: Date
): number {
  const totalDaysInMonth = getDaysInMonth(periodEnd);
  const workedDays = differenceInDays(periodEnd, periodStart) + 1;
  return (workedDays / totalDaysInMonth) * monthlyGrossSalary;
}

function calculateVacationPayout(
  monthlyGrossSalary: number,
  unusedLeaveDays: number
): number {
  const dailySalary = monthlyGrossSalary / 30;
  return dailySalary * unusedLeaveDays;
}

function calculateGratification(
  salaireCategoriel: number,
  hireDate: Date,
  terminationDate: Date,
  rate: number = 0.75
): number {
  const monthsWorked = differenceInMonths(terminationDate, hireDate);
  const prorata = monthsWorked / 12;
  return salaireCategoriel * rate * prorata;
}

function calculateSeverancePay(
  averageSalary12M: number,
  yearsOfService: number
): number {
  if (yearsOfService < 1) return 0;

  let tranche1 = 0, tranche2 = 0, tranche3 = 0;

  // Tranche 1: 0-5 ans → 30%
  const years0to5 = Math.min(yearsOfService, 5);
  tranche1 = averageSalary12M * years0to5 * 0.30;

  // Tranche 2: 6-10 ans → 35%
  if (yearsOfService > 5) {
    const years6to10 = Math.min(yearsOfService - 5, 5);
    tranche2 = averageSalary12M * years6to10 * 0.35;
  }

  // Tranche 3: 11+ ans → 40%
  if (yearsOfService > 10) {
    const years11plus = yearsOfService - 10;
    tranche3 = averageSalary12M * years11plus * 0.40;
  }

  return tranche1 + tranche2 + tranche3;
}

function calculateFuneralExpenses(
  yearsOfService: number,
  smig: number = 75000
): number {
  if (yearsOfService <= 5) return smig * 3;
  if (yearsOfService <= 10) return smig * 4;
  return smig * 6;
}

function getNoticePeriodMonths(
  yearsOfService: number,
  isCadre: boolean
): number {
  if (isCadre) {
    if (yearsOfService < 0.5) return 1;
    if (yearsOfService < 2) return 2;
    return 3;
  } else {
    if (yearsOfService < 0.5) return 0.5; // 15 jours
    if (yearsOfService < 2) return 1;
    if (yearsOfService < 5) return 2;
    return 3;
  }
}

function calculateYearsOfService(hireDate: Date, terminationDate: Date): number {
  const totalDays = differenceInDays(terminationDate, hireDate);
  return totalDays / 365.25;
}

function calculateAge(dateOfBirth: Date, referenceDate: Date): number {
  return Math.floor(differenceInDays(referenceDate, dateOfBirth) / 365.25);
}

// ====================================
// DATA FETCHING FUNCTIONS
// ====================================

async function fetchEmployeeData(employeeId: string, tenantId: string): Promise<EmployeeData> {
  // Fetch employee
  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)))
    .limit(1);

  if (!employee) {
    throw new Error('Employé non trouvé');
  }

  // Fetch current contract (most recent active contract)
  const [contract] = await db
    .select()
    .from(employmentContracts)
    .where(
      and(
        eq(employmentContracts.employeeId, employeeId),
        eq(employmentContracts.tenantId, tenantId),
        eq(employmentContracts.isActive, true)
      )
    )
    .orderBy(desc(employmentContracts.startDate)) // ← Fix: Order by start date to get most recent active contract
    .limit(1);

  if (!contract) {
    throw new Error('Contrat actif non trouvé');
  }

  // Fetch current salary
  const [salary] = await db
    .select()
    .from(employeeSalaries)
    .where(
      and(
        eq(employeeSalaries.employeeId, employeeId),
        eq(employeeSalaries.tenantId, tenantId)
      )
    )
    .orderBy(desc(employeeSalaries.effectiveFrom))
    .limit(1);

  if (!salary) {
    throw new Error('Salaire non trouvé');
  }

  // Fetch tenant
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new Error('Tenant non trouvé');
  }

  // Extract salary components
  const { extractBaseSalaryAmounts, getSalaireCategoriel, calculateBaseSalaryTotal } = await import('@/lib/salary-components/base-salary-loader');

  const salaryComponents = salary.components as Array<{ code: string; amount: number }> || [];
  const totalBaseSalary = await calculateBaseSalaryTotal(salaryComponents, tenant.countryCode);
  const salaireCategoriel = await getSalaireCategoriel(salaryComponents, tenant.countryCode);

  return {
    employee,
    contract,
    salary: {
      ...salary,
      totalBaseSalary,
      salaireCategoriel
    },
    tenant
  };
}

async function getUnusedLeaveDays(employeeId: string, tenantId: string): Promise<number> {
  const [balance] = await db
    .select()
    .from(timeOffBalances)
    .where(
      and(
        eq(timeOffBalances.employeeId, employeeId),
        eq(timeOffBalances.tenantId, tenantId)
      )
    )
    .limit(1);

  return balance?.balance ? parseFloat(balance.balance.toString()) : 0;
}

async function calculateAverageSalary12Months(
  employeeId: string,
  tenantId: string,
  terminationDate: Date
): Promise<number> {
  console.log('[STC Calculator] Calculating 12-month average salary...');
  const date12MonthsAgo = subMonths(terminationDate, 12);

  // Get all salary records in the last 12 months
  const salaryRecords = await db
    .select()
    .from(employeeSalaries)
    .where(
      and(
        eq(employeeSalaries.employeeId, employeeId),
        eq(employeeSalaries.tenantId, tenantId)
      )
    )
    .orderBy(desc(employeeSalaries.effectiveFrom));

  console.log('[STC Calculator] Found', salaryRecords.length, 'salary records');

  if (salaryRecords.length === 0) {
    throw new Error('Aucun historique de salaire trouvé pour cet employé');
  }

  const { calculateBaseSalaryTotal } = await import('@/lib/salary-components/base-salary-loader');
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const countryCode = tenant?.countryCode || 'CI';

  // Calculate monthly salaries for the 12-month period
  const monthlySalaries: number[] = [];

  for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
    const monthDate = subMonths(terminationDate, monthOffset);

    // Find the applicable salary record for this month
    const applicableSalary = salaryRecords.find(record => {
      const effectiveDate = new Date(record.effectiveFrom);
      const effectiveToDate = record.effectiveTo ? new Date(record.effectiveTo) : null;

      // Salary applies if it started before/on this month AND (has no end date OR ends after this month)
      return effectiveDate <= monthDate &&
             (effectiveToDate === null || effectiveToDate > monthDate);
    });

    if (applicableSalary) {
      const salaryComponents = applicableSalary.components as Array<{ code: string; amount: number }> || [];
      const totalSalary = await calculateBaseSalaryTotal(salaryComponents, countryCode);
      monthlySalaries.push(totalSalary);
    }
  }

  console.log('[STC Calculator] Monthly salaries found:', monthlySalaries.length, 'months');

  if (monthlySalaries.length === 0) {
    // Use current salary as fallback
    console.log('[STC Calculator] No monthly salaries found, using current salary as fallback');
    const currentSalary = salaryRecords[0];
    const salaryComponents = currentSalary.components as Array<{ code: string; amount: number }> || [];
    const fallbackSalary = await calculateBaseSalaryTotal(salaryComponents, countryCode);
    console.log('[STC Calculator] Fallback salary:', fallbackSalary);
    return fallbackSalary;
  }

  // Calculate average
  const sum = monthlySalaries.reduce((total, s) => total + s, 0);
  const average = sum / monthlySalaries.length;
  console.log('[STC Calculator] Average 12-month salary:', average);
  return average;
}

async function calculateTotalGrossSalaryDuringContract(
  employeeId: string,
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  // Get all salary records
  const salaryRecords = await db
    .select()
    .from(employeeSalaries)
    .where(
      and(
        eq(employeeSalaries.employeeId, employeeId),
        eq(employeeSalaries.tenantId, tenantId)
      )
    )
    .orderBy(desc(employeeSalaries.effectiveFrom));

  if (salaryRecords.length === 0) {
    return 0;
  }

  const { calculateBaseSalaryTotal } = await import('@/lib/salary-components/base-salary-loader');
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const countryCode = tenant?.countryCode || 'CI';

  // Calculate total salary for each month in the contract period
  const monthsDiff = differenceInMonths(endDate, startDate) + 1; // +1 to include both start and end months
  let totalGrossSalary = 0;

  for (let monthOffset = 0; monthOffset < monthsDiff; monthOffset++) {
    const monthDate = new Date(startDate);
    monthDate.setMonth(monthDate.getMonth() + monthOffset);

    // Find the applicable salary record for this month
    const applicableSalary = salaryRecords.find(record => {
      const effectiveDate = new Date(record.effectiveFrom);
      const effectiveToDate = record.effectiveTo ? new Date(record.effectiveTo) : null;

      // Salary applies if it started before/on this month AND (has no end date OR ends after this month)
      return effectiveDate <= monthDate &&
             (effectiveToDate === null || effectiveToDate > monthDate);
    });

    if (applicableSalary) {
      const salaryComponents = applicableSalary.components as Array<{ code: string; amount: number }> || [];
      const monthlySalary = await calculateBaseSalaryTotal(salaryComponents, countryCode);
      totalGrossSalary += monthlySalary;
    }
  }

  return totalGrossSalary;
}

function validateDepartureType(
  departureType: DepartureType,
  employeeData: EmployeeData,
  input: STCCalculationInput
): void {
  const { contract, employee } = employeeData;

  switch (departureType) {
    case 'FIN_CDD':
    case 'DEMISSION_CDD':
      // Accept all fixed-term contract types (CDD, CDDTI, INTERIM)
      const validFixedTermContracts = ['CDD', 'CDDTI', 'INTERIM'];
      if (!validFixedTermContracts.includes(contract.contractType)) {
        throw new Error(`${departureType} requis un contrat CDD (type actuel: ${contract.contractType})`);
      }
      break;

    case 'DEMISSION_CDI':
    case 'RUPTURE_CONVENTIONNELLE':
      if (contract.contractType !== 'CDI') {
        throw new Error(`${departureType} requis un contrat CDI (type actuel: ${contract.contractType})`);
      }
      break;

    case 'RETRAITE':
      const age = calculateAge(new Date(employee.dateOfBirth!), input.terminationDate);
      if (age < 60) {
        throw new Error(`Retraite requis âge ≥ 60 ans (âge actuel: ${age} ans)`);
      }
      break;

    case 'DECES':
      if (!input.deathCertificateUrl) {
        throw new Error('Certificat de décès obligatoire pour type DECES');
      }
      if (!input.beneficiaries || input.beneficiaries.length === 0) {
        throw new Error('Au moins un bénéficiaire requis pour type DECES');
      }
      break;
  }
}

function combineSTCComponents(
  common: CommonComponents,
  specific: Partial<STCResult>,
  input: STCCalculationInput
): STCResult {
  const {
    proratedSalary,
    vacationPayout,
    gratification,
    unusedLeaveDays,
    yearsOfService,
    averageSalary12M,
    employee,
    contract,
    salary
  } = common;

  const {
    noticePayment = 0,
    noticePeriodMonths = 0,
    severancePay = 0,
    cddEndIndemnity = 0,
    funeralExpenses = 0,
    metadata = {}
  } = specific;

  // Calculate totals
  const grossSalary = proratedSalary + vacationPayout + gratification;
  const totalIndemnities = Math.abs(severancePay) + cddEndIndemnity + funeralExpenses;

  // Calculate taxation using taxation service
  const taxation = calculateSTCTaxation({
    salary: proratedSalary,
    vacationPayout: vacationPayout,
    gratification: gratification,
    noticePayment: noticePayment,
    severancePay: severancePay,
    cddEndIndemnity: cddEndIndemnity,
    funeralExpenses: funeralExpenses,
    employeeCNPSRate: 0.063, // Standard 6.3%
    tenantCountryCode: 'CI', // Default to Côte d'Ivoire (can be extended)
  });

  // Use taxation result for totals
  const totalTaxable = taxation.totalTaxableAmount;
  const totalTaxFree = taxation.totalNonTaxableAmount;
  const netToPay = taxation.estimatedNetPayable;

  return {
    proratedSalary,
    vacationPayout,
    gratification,
    noticePayment,
    noticePeriodMonths,
    severancePay,
    cddEndIndemnity,
    funeralExpenses,
    grossSalary,
    totalIndemnities,
    totalTaxable,
    totalTaxFree,
    netToPay,
    taxation,
    calculationDetails: {
      unusedLeaveDays,
      yearsOfService,
      averageSalary12M,
      salaireCategoriel: salary.salaireCategoriel,
      monthlyGrossSalary: salary.totalBaseSalary,
      isCadre: employee.employmentClassification === 'cadre'
    },
    metadata: {
      departureType: input.departureType,
      contractType: contract.contractType,
      hireDate: new Date(employee.hireDate),
      terminationDate: input.terminationDate,
      ...metadata
    }
  };
}
