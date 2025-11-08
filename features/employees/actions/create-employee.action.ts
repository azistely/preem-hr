/**
 * Server Action: Create Employee with Base Salary Components
 *
 * This server action handles building Code 11 (base salary components)
 * before creating an employee, ensuring components array is complete.
 */

'use server';

import { buildBaseSalaryComponents } from '@/lib/salary-components/base-salary-loader';

export interface CreateEmployeeWithComponentsInput {
  // Employee data
  firstName: string;
  lastName: string;
  preferredName?: string;
  email: string;
  phone: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  nationalId?: string;

  // Employment
  hireDate: Date;
  positionId: string;
  coefficient: number;
  rateType: 'MONTHLY' | 'DAILY' | 'HOURLY';
  primaryLocationId: string;

  // Salary
  baseSalary: number;
  baseComponents?: Record<string, number>;
  components: Array<{
    code: string;
    name: string;
    amount: number;
    sourceType: 'standard' | 'custom' | 'template' | 'calculated' | 'import';
    metadata?: Record<string, any>;
  }>;

  // Banking
  bankName?: string;
  bankAccount?: string;

  // Tax
  taxDependents: number;
}

/**
 * Build complete components array (base + allowances)
 *
 * This function is called on the server to build Code 11 (Salaire categoriel)
 * and merge it with allowances before creating the employee.
 */
export async function buildEmployeeComponents(
  baseSalary: number,
  baseComponents: Record<string, number> | undefined,
  allowanceComponents: CreateEmployeeWithComponentsInput['components'],
  countryCode: string = 'CI'
): Promise<CreateEmployeeWithComponentsInput['components']> {
  // Build base salary component instances (Code 11, etc.) with proper metadata
  let baseComponentsArray: CreateEmployeeWithComponentsInput['components'] = [];

  if (baseComponents && Object.keys(baseComponents).length > 0) {
    // NEW: User filled in base components (Code 11, 12, etc.)
    const built = await buildBaseSalaryComponents(baseComponents, countryCode);
    baseComponentsArray = built.map(c => ({
      code: c.code,
      name: c.name,
      amount: c.amount,
      sourceType: c.sourceType as 'standard' | 'custom' | 'template' | 'calculated' | 'import',
      metadata: c.metadata,
    }));
  } else if (baseSalary > 0) {
    // LEGACY: User filled in single baseSalary field - create Code 11
    const built = await buildBaseSalaryComponents({ '11': baseSalary }, countryCode);
    baseComponentsArray = built.map(c => ({
      code: c.code,
      name: c.name,
      amount: c.amount,
      sourceType: c.sourceType as 'standard' | 'custom' | 'template' | 'calculated' | 'import',
      metadata: c.metadata,
    }));
  }

  // Merge base components + allowances (transport, housing, etc.)
  return [...baseComponentsArray, ...allowanceComponents];
}
