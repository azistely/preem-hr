/**
 * Extended Model Types
 *
 * These types extend the base Drizzle-inferred types to include relations
 * loaded via .with() in queries. Drizzle's TypeScript inference doesn't
 * automatically include relation types, so we define them manually here.
 */

import type { InferSelectModel } from 'drizzle-orm';
import {
  timeOffBalances,
  timeOffRequests,
  timeOffPolicies,
  timeEntries,
  employees,
  geofenceConfigurations,
  geofenceEmployeeAssignments,
} from '@/drizzle/schema';

// Infer types from schema tables
export type TimeOffBalance = InferSelectModel<typeof timeOffBalances>;
export type TimeOffRequest = InferSelectModel<typeof timeOffRequests>;
export type TimeOffPolicy = InferSelectModel<typeof timeOffPolicies>;
export type TimeEntry = InferSelectModel<typeof timeEntries>;
export type Employee = InferSelectModel<typeof employees>;
export type GeofenceConfiguration = InferSelectModel<typeof geofenceConfigurations>;
export type GeofenceEmployeeAssignment = InferSelectModel<typeof geofenceEmployeeAssignments>;

// Time-Off with Relations
export type TimeOffBalanceWithPolicy = TimeOffBalance & {
  timeOffPolicy: TimeOffPolicy;
};

export type TimeOffRequestWithPolicy = TimeOffRequest & {
  timeOffPolicy: TimeOffPolicy;
};

export type TimeOffRequestWithEmployee = TimeOffRequest & {
  employee: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'photoUrl'>;
};

export type TimeOffRequestWithRelations = TimeOffRequest & {
  timeOffPolicy: TimeOffPolicy;
  employee: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'photoUrl'>;
};

export type TimeOffRequestWithBalanceAndRelations = TimeOffRequestWithRelations & {
  balance: TimeOffBalance | null;
};

// Time Tracking with Relations
export type TimeEntryWithEmployee = TimeEntry & {
  employee: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'photoUrl'>;
};

// Geofencing with Relations
export type GeofenceConfigurationWithAssignments = GeofenceConfiguration & {
  employeeAssignments: Array<
    GeofenceEmployeeAssignment & {
      employee: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'employeeNumber'>;
    }
  >;
};
