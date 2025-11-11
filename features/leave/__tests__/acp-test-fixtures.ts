/**
 * Test Fixtures for ACP Testing
 *
 * Provides realistic test data for ACP calculations, including:
 * - Employee profiles with various seniority levels
 * - Salary history for different scenarios
 * - Leave request patterns
 * - Expected ACP calculation results
 */

import { addMonths, subMonths, subYears } from 'date-fns';

/**
 * Test employees with different seniority levels
 */
export const testEmployees = {
  // New employee (< 6 months) - Not eligible yet
  newEmployee: {
    id: 'emp-new-001',
    tenantId: 'tenant-test-001',
    employeeNumber: 'EMP001',
    firstName: 'Marie',
    lastName: 'Kouadio',
    email: 'marie.kouadio@test.com',
    contractType: 'CDI' as const,
    status: 'active' as const,
    hireDate: subMonths(new Date(), 3).toISOString().split('T')[0], // 3 months ago
    acpPaymentActive: false,
    acpPaymentDate: null,
    countryCode: 'CI',
  },

  // Standard employee (2 years) - Eligible, no seniority bonus
  standardEmployee: {
    id: 'emp-std-002',
    tenantId: 'tenant-test-001',
    employeeNumber: 'EMP002',
    firstName: 'Kouassi',
    lastName: 'Yao',
    email: 'kouassi.yao@test.com',
    contractType: 'CDI' as const,
    status: 'active' as const,
    hireDate: subYears(new Date(), 2).toISOString().split('T')[0], // 2 years ago
    acpPaymentActive: true,
    acpPaymentDate: '2025-11-15',
    countryCode: 'CI',
  },

  // Senior employee (7 years) - Eligible with +1 bonus day
  seniorEmployee: {
    id: 'emp-sen-003',
    tenantId: 'tenant-test-001',
    employeeNumber: 'EMP003',
    firstName: 'Adjoua',
    lastName: 'Koffi',
    email: 'adjoua.koffi@test.com',
    contractType: 'CDI' as const,
    status: 'active' as const,
    hireDate: subYears(new Date(), 7).toISOString().split('T')[0], // 7 years ago
    acpPaymentActive: true,
    acpPaymentDate: '2025-11-20',
    countryCode: 'CI',
  },

  // Very senior employee (22 years) - Eligible with +5 bonus days
  verySeniorEmployee: {
    id: 'emp-vsen-004',
    tenantId: 'tenant-test-001',
    employeeNumber: 'EMP004',
    firstName: 'Ama',
    lastName: 'N\'Guessan',
    email: 'ama.nguessan@test.com',
    contractType: 'CDI' as const,
    status: 'active' as const,
    hireDate: subYears(new Date(), 22).toISOString().split('T')[0], // 22 years ago
    acpPaymentActive: true,
    acpPaymentDate: '2025-11-25',
    countryCode: 'CI',
  },

  // INTERIM employee - Not eligible
  interimEmployee: {
    id: 'emp-int-005',
    tenantId: 'tenant-test-001',
    employeeNumber: 'EMP005',
    firstName: 'Konan',
    lastName: 'Brou',
    email: 'konan.brou@test.com',
    contractType: 'INTERIM' as const,
    status: 'active' as const,
    hireDate: subYears(new Date(), 1).toISOString().split('T')[0],
    acpPaymentActive: false,
    acpPaymentDate: null,
    countryCode: 'CI',
  },

  // CDD employee - Eligible
  cddEmployee: {
    id: 'emp-cdd-006',
    tenantId: 'tenant-test-001',
    employeeNumber: 'EMP006',
    firstName: 'Aïcha',
    lastName: 'Traoré',
    email: 'aicha.traore@test.com',
    contractType: 'CDD' as const,
    status: 'active' as const,
    hireDate: subMonths(new Date(), 8).toISOString().split('T')[0], // 8 months ago
    acpPaymentActive: true,
    acpPaymentDate: '2025-11-10',
    countryCode: 'CI',
  },
};

/**
 * Salary history patterns for different scenarios
 */
export function generateSalaryHistory(
  employeeId: string,
  monthsBack: number,
  monthlySalary: number
) {
  const history = [];
  const now = new Date('2025-11-01'); // Fixed date for consistency

  for (let i = 0; i < monthsBack; i++) {
    const periodStart = subMonths(now, i + 1);
    const periodEnd = subMonths(now, i);

    history.push({
      employeeId,
      tenantId: 'tenant-test-001',
      periodStart: periodStart.toISOString().split('T')[0],
      periodEnd: periodEnd.toISOString().split('T')[0],
      grossSalary: monthlySalary,
      grossTaxableSalary: monthlySalary,
      netSalary: Math.round(monthlySalary * 0.73), // ~73% after deductions
      cnpsEmployee: Math.round(monthlySalary * 0.063),
      cnpsEmployer: Math.round(monthlySalary * 0.038),
      its: Math.round(monthlySalary * 0.15),
      cmuEmployee: 1000,
      cmuEmployer: 1000,
      status: 'completed' as const,
    });
  }

  return history;
}

/**
 * Leave request patterns
 */
export const leavePatterns = {
  // Standard 2-week annual leave
  standardLeave: (employeeId: string) => ({
    id: `leave-std-${employeeId}`,
    employeeId,
    tenantId: 'tenant-test-001',
    policyId: 'policy-annual-001',
    startDate: '2025-11-04',
    endDate: '2025-11-15',
    totalDays: 10, // Working days (excluding weekends)
    status: 'approved' as const,
    isDeductibleForAcp: true,
    acpPaidAt: null,
    acpAmount: null,
  }),

  // Short leave (3 days)
  shortLeave: (employeeId: string) => ({
    id: `leave-short-${employeeId}`,
    employeeId,
    tenantId: 'tenant-test-001',
    policyId: 'policy-annual-001',
    startDate: '2025-11-11',
    endDate: '2025-11-13',
    totalDays: 3,
    status: 'approved' as const,
    isDeductibleForAcp: true,
    acpPaidAt: null,
    acpAmount: null,
  }),

  // Extended leave (1 month)
  extendedLeave: (employeeId: string) => ({
    id: `leave-ext-${employeeId}`,
    employeeId,
    tenantId: 'tenant-test-001',
    policyId: 'policy-annual-001',
    startDate: '2025-11-01',
    endDate: '2025-11-29',
    totalDays: 22, // ~22 working days in a month
    status: 'approved' as const,
    isDeductibleForAcp: true,
    acpPaidAt: null,
    acpAmount: null,
  }),

  // Non-deductible leave (permission)
  nonDeductibleLeave: (employeeId: string) => ({
    id: `leave-nd-${employeeId}`,
    employeeId,
    tenantId: 'tenant-test-001',
    policyId: 'policy-permission-001',
    startDate: '2025-11-18',
    endDate: '2025-11-19',
    totalDays: 2,
    status: 'approved' as const,
    isDeductibleForAcp: false, // Non-deductible
    acpPaidAt: null,
    acpAmount: null,
  }),

  // Already paid ACP leave
  paidACPLeave: (employeeId: string) => ({
    id: `leave-paid-${employeeId}`,
    employeeId,
    tenantId: 'tenant-test-001',
    policyId: 'policy-annual-001',
    startDate: '2025-10-01',
    endDate: '2025-10-14',
    totalDays: 10,
    status: 'approved' as const,
    isDeductibleForAcp: true,
    acpPaidAt: new Date('2025-10-31').toISOString(),
    acpAmount: 205210, // Already paid
  }),
};

/**
 * Expected ACP calculation results for test scenarios
 */
export const expectedResults = {
  // Standard employee: 300k salary, 10 days leave, 6 months history
  standardScenario: {
    employeeId: testEmployees.standardEmployee.id,
    acpPaymentDate: new Date('2025-11-15'),
    salaryHistory: generateSalaryHistory(
      testEmployees.standardEmployee.id,
      6,
      300000
    ),
    leaveRequests: [leavePatterns.standardLeave(testEmployees.standardEmployee.id)],
    expectedResult: {
      acpAmount: 205210, // ~10 days × 20,521 FCFA/day
      leaveDaysTakenCalendar: 10,
      dailyAverageSalary: 20521, // 1,800,000 / (6 * 30 - 10)
      numberOfMonths: 6,
      totalGrossTaxableSalary: 1800000, // 6 × 300k
      totalPaidDays: 170, // 6 × 30 - 10
      seniorityBonusDays: 0, // Only 2 years
      warnings: [],
    },
  },

  // Senior employee: 500k salary, 10 days leave, +1 seniority bonus
  seniorScenario: {
    employeeId: testEmployees.seniorEmployee.id,
    acpPaymentDate: new Date('2025-11-20'),
    salaryHistory: generateSalaryHistory(
      testEmployees.seniorEmployee.id,
      12,
      500000
    ),
    leaveRequests: [leavePatterns.standardLeave(testEmployees.seniorEmployee.id)],
    expectedResult: {
      acpAmount: 375000, // ~11 days (10 + 1 bonus) × 34,091 FCFA/day
      leaveDaysTakenCalendar: 10,
      dailyAverageSalary: 34091, // 6,000,000 / (12 * 30 - 10) ≈ 34,091
      numberOfMonths: 12,
      totalGrossTaxableSalary: 6000000, // 12 × 500k
      totalPaidDays: 350, // 12 × 30 - 10
      seniorityBonusDays: 1, // 7 years → +1 day
      warnings: [],
    },
  },

  // Very senior employee: 800k salary, +5 seniority bonus
  verySeniorScenario: {
    employeeId: testEmployees.verySeniorEmployee.id,
    acpPaymentDate: new Date('2025-11-25'),
    salaryHistory: generateSalaryHistory(
      testEmployees.verySeniorEmployee.id,
      12,
      800000
    ),
    leaveRequests: [
      leavePatterns.extendedLeave(testEmployees.verySeniorEmployee.id),
    ],
    expectedResult: {
      acpAmount: 1540000, // ~27 days (22 + 5 bonus) × 57,037 FCFA/day
      leaveDaysTakenCalendar: 22,
      dailyAverageSalary: 57037, // 9,600,000 / (12 * 30 - 22) ≈ 57,037
      numberOfMonths: 12,
      totalGrossTaxableSalary: 9600000, // 12 × 800k
      totalPaidDays: 338, // 12 × 30 - 22
      seniorityBonusDays: 5, // 22 years → +5 days
      warnings: [],
    },
  },

  // New employee: Insufficient history
  newEmployeeScenario: {
    employeeId: testEmployees.newEmployee.id,
    acpPaymentDate: new Date('2025-11-30'),
    salaryHistory: generateSalaryHistory(testEmployees.newEmployee.id, 3, 250000),
    leaveRequests: [leavePatterns.shortLeave(testEmployees.newEmployee.id)],
    expectedResult: {
      acpAmount: 0, // Not eligible yet (< 6 months)
      leaveDaysTakenCalendar: 3,
      dailyAverageSalary: 0,
      numberOfMonths: 3,
      totalGrossTaxableSalary: 750000,
      totalPaidDays: 87,
      seniorityBonusDays: 0,
      warnings: [
        {
          type: 'insufficient_salary_history',
          message: 'Historique de salaire insuffisant (< 6 mois)',
        },
      ],
    },
  },

  // INTERIM employee: Not eligible
  interimScenario: {
    employeeId: testEmployees.interimEmployee.id,
    acpPaymentDate: new Date('2025-11-30'),
    salaryHistory: generateSalaryHistory(
      testEmployees.interimEmployee.id,
      12,
      350000
    ),
    leaveRequests: [leavePatterns.standardLeave(testEmployees.interimEmployee.id)],
    expectedResult: {
      acpAmount: 0,
      leaveDaysTakenCalendar: 10,
      dailyAverageSalary: 0,
      numberOfMonths: 12,
      totalGrossTaxableSalary: 4200000,
      totalPaidDays: 350,
      seniorityBonusDays: 0,
      warnings: [
        {
          type: 'not_eligible',
          message: 'Type de contrat non éligible (INTERIM)',
        },
      ],
    },
  },

  // No leave taken: ACP = 0
  noLeaveScenario: {
    employeeId: testEmployees.standardEmployee.id,
    acpPaymentDate: new Date('2025-11-30'),
    salaryHistory: generateSalaryHistory(
      testEmployees.standardEmployee.id,
      6,
      300000
    ),
    leaveRequests: [], // No leave
    expectedResult: {
      acpAmount: 0,
      leaveDaysTakenCalendar: 0,
      dailyAverageSalary: 20689, // 1,800,000 / (6 * 30)
      numberOfMonths: 6,
      totalGrossTaxableSalary: 1800000,
      totalPaidDays: 180,
      seniorityBonusDays: 0,
      warnings: [],
    },
  },

  // Mixed leave types (deductible + non-deductible)
  mixedLeaveScenario: {
    employeeId: testEmployees.standardEmployee.id,
    acpPaymentDate: new Date('2025-11-30'),
    salaryHistory: generateSalaryHistory(
      testEmployees.standardEmployee.id,
      6,
      300000
    ),
    leaveRequests: [
      leavePatterns.standardLeave(testEmployees.standardEmployee.id), // 10 days deductible
      leavePatterns.nonDeductibleLeave(testEmployees.standardEmployee.id), // 2 days non-deductible
    ],
    expectedResult: {
      acpAmount: 205210, // Only 10 deductible days count
      leaveDaysTakenCalendar: 10, // Only deductible days
      dailyAverageSalary: 20521, // 1,800,000 / (6 * 30 - 10)
      numberOfMonths: 6,
      totalGrossTaxableSalary: 1800000,
      totalPaidDays: 170, // 180 - 10 (non-deductible not subtracted)
      seniorityBonusDays: 0,
      warnings: [],
    },
  },
};

/**
 * Côte d'Ivoire ACP Configuration
 */
export const ciACPConfig = {
  id: 'acp-config-ci-001',
  countryCode: 'CI',
  daysPerMonthFactor: 2.2,
  includesBaseSalary: true,
  includesTaxableAllowances: true,
  includesBonuses: false,
  includesOvertimePay: false,
  referencePeriodType: 'last_leave_or_hire' as const,
  minimumMonthsHistory: 6,
  notes:
    'Convention Collective Interprofessionnelle Article 46 - Côte d\'Ivoire',
};

/**
 * Helper to create complete test dataset
 */
export function createCompleteTestDataset(scenarioName: keyof typeof expectedResults) {
  const scenario = expectedResults[scenarioName];
  const employee =
    testEmployees[
      Object.keys(testEmployees).find((key) =>
        key.includes(scenario.employeeId.split('-')[1])
      ) as keyof typeof testEmployees
    ] || testEmployees.standardEmployee;

  return {
    employee,
    salaryHistory: scenario.salaryHistory,
    leaveRequests: scenario.leaveRequests,
    acpConfig: ciACPConfig,
    expectedResult: scenario.expectedResult,
  };
}

/**
 * Mock tRPC context for testing
 */
export function createMockContext(userId: string, tenantId: string, role: string) {
  return {
    user: {
      id: userId,
      tenantId,
      email: `${role}@test.com`,
      role,
      employeeId: role === 'employee' ? `emp-${userId}` : null,
    },
  };
}
