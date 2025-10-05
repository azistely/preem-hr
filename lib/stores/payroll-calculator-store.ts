/**
 * Payroll Calculator Store
 *
 * Zustand store with persist middleware for payroll calculator state
 * Demonstrates best practices: persist, devtools, TypeScript typing
 */

import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';

export interface PayrollCalculatorState {
  // Form values
  baseSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  mealAllowance: number;
  hasFamily: boolean;
  sector: 'services' | 'construction' | 'agriculture' | 'other';

  // Calculated results (cached)
  lastCalculation: {
    grossSalary: number;
    cnpsEmployee: number;
    cmuEmployee: number;
    its: number;
    netSalary: number;
    timestamp: number;
  } | null;

  // Actions
  setBaseSalary: (value: number) => void;
  setHousingAllowance: (value: number) => void;
  setTransportAllowance: (value: number) => void;
  setMealAllowance: (value: number) => void;
  setHasFamily: (value: boolean) => void;
  setSector: (sector: 'services' | 'construction' | 'agriculture' | 'other') => void;
  setLastCalculation: (calculation: NonNullable<PayrollCalculatorState['lastCalculation']>) => void;
  reset: () => void;
}

const initialState = {
  baseSalary: 75000, // SMIG minimum
  housingAllowance: 0,
  transportAllowance: 0,
  mealAllowance: 0,
  hasFamily: false,
  sector: 'services' as const,
  lastCalculation: null,
};

export const usePayrollCalculatorStore = create<PayrollCalculatorState>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        setBaseSalary: (value) =>
          set({ baseSalary: value }, false, 'payroll/setBaseSalary'),

        setHousingAllowance: (value) =>
          set({ housingAllowance: value }, false, 'payroll/setHousingAllowance'),

        setTransportAllowance: (value) =>
          set({ transportAllowance: value }, false, 'payroll/setTransportAllowance'),

        setMealAllowance: (value) =>
          set({ mealAllowance: value }, false, 'payroll/setMealAllowance'),

        setHasFamily: (value) =>
          set({ hasFamily: value }, false, 'payroll/setHasFamily'),

        setSector: (sector) =>
          set({ sector }, false, 'payroll/setSector'),

        setLastCalculation: (calculation) =>
          set({ lastCalculation: calculation }, false, 'payroll/setLastCalculation'),

        reset: () =>
          set(initialState, false, 'payroll/reset'),
      }),
      {
        name: 'payroll-calculator-storage',
        storage: createJSONStorage(() => localStorage),
        // Optionally, you can specify which fields to persist
        partialize: (state) => ({
          baseSalary: state.baseSalary,
          housingAllowance: state.housingAllowance,
          transportAllowance: state.transportAllowance,
          mealAllowance: state.mealAllowance,
          hasFamily: state.hasFamily,
          sector: state.sector,
          // Don't persist lastCalculation (recalculate on load)
        }),
      }
    ),
    {
      name: 'PayrollCalculatorStore',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);
