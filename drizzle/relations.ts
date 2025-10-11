import { relations } from "drizzle-orm/relations";
import { employees, users, tenants, countries, taxSystems, departments, taxBrackets, positions, familyDeductionRules, socialSecuritySchemes, assignments, contributionTypes, employeeSalaries, sectorContributionOverrides, otherTaxes, payrollRuns, payrollLineItems, salaryComponentDefinitions, exportTemplates, timeEntries, timeOffPolicies, timeOffBalances, timeOffRequests, events, auditLogs, workflows, workflowInstances, workflowDefinitions, workflowExecutions, alerts, batchOperations, payrollEvents } from "./schema";

export const usersRelations = relations(users, ({one, many}) => ({
	employee: one(employees, {
		fields: [users.employeeId],
		references: [employees.id],
		relationName: "users_employeeId_employees_id"
	}),
	// usersInAuth table removed - not in current schema
	tenant: one(tenants, {
		fields: [users.tenantId],
		references: [tenants.id]
	}),
	departments_createdBy: many(departments, {
		relationName: "departments_createdBy_users_id"
	}),
	departments_updatedBy: many(departments, {
		relationName: "departments_updatedBy_users_id"
	}),
	positions_createdBy: many(positions, {
		relationName: "positions_createdBy_users_id"
	}),
	positions_updatedBy: many(positions, {
		relationName: "positions_updatedBy_users_id"
	}),
	employees_createdBy: many(employees, {
		relationName: "employees_createdBy_users_id"
	}),
	employees_updatedBy: many(employees, {
		relationName: "employees_updatedBy_users_id"
	}),
	assignments: many(assignments),
	employeeSalaries: many(employeeSalaries),
	payrollRuns_approvedBy: many(payrollRuns, {
		relationName: "payrollRuns_approvedBy_users_id"
	}),
	payrollRuns_createdBy: many(payrollRuns, {
		relationName: "payrollRuns_createdBy_users_id"
	}),
	payrollRuns_processedBy: many(payrollRuns, {
		relationName: "payrollRuns_processedBy_users_id"
	}),
	payrollRuns_updatedBy: many(payrollRuns, {
		relationName: "payrollRuns_updatedBy_users_id"
	}),
	timeEntries: many(timeEntries),
	timeOffPolicies: many(timeOffPolicies),
	timeOffRequests: many(timeOffRequests),
	events: many(events),
	auditLogs: many(auditLogs),
	workflows: many(workflows),
	workflowDefinitions: many(workflowDefinitions),
	alerts_assignee: many(alerts, {
		relationName: "alerts_assigneeId_users_id"
	}),
	alerts_dismissedBy: many(alerts, {
		relationName: "alerts_dismissedBy_users_id"
	}),
	alerts_completedBy: many(alerts, {
		relationName: "alerts_completedBy_users_id"
	}),
	batchOperations: many(batchOperations),
	payrollEvents: many(payrollEvents),
}));

export const employeesRelations = relations(employees, ({one, many}) => ({
	users: many(users, {
		relationName: "users_employeeId_employees_id"
	}),
	departments: many(departments),
	user_createdBy: one(users, {
		fields: [employees.createdBy],
		references: [users.id],
		relationName: "employees_createdBy_users_id"
	}),
	tenant: one(tenants, {
		fields: [employees.tenantId],
		references: [tenants.id]
	}),
	user_updatedBy: one(users, {
		fields: [employees.updatedBy],
		references: [users.id],
		relationName: "employees_updatedBy_users_id"
	}),
	assignments: many(assignments),
	employeeSalaries: many(employeeSalaries),
	payrollLineItems: many(payrollLineItems),
	timeEntries: many(timeEntries),
	timeOffBalances: many(timeOffBalances),
	timeOffRequests: many(timeOffRequests),
	alerts: many(alerts),
	workflowExecutions: many(workflowExecutions),
	payrollEvents: many(payrollEvents),
}));

// usersInAuth table removed - not in current schema
// export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
// 	users: many(users),
// }));

export const tenantsRelations = relations(tenants, ({many}) => ({
	users: many(users),
	departments: many(departments),
	positions: many(positions),
	employees: many(employees),
	assignments: many(assignments),
	employeeSalaries: many(employeeSalaries),
	payrollRuns: many(payrollRuns),
	payrollLineItems: many(payrollLineItems),
	timeEntries: many(timeEntries),
	timeOffPolicies: many(timeOffPolicies),
	timeOffBalances: many(timeOffBalances),
	timeOffRequests: many(timeOffRequests),
	events: many(events),
	auditLogs: many(auditLogs),
	workflows: many(workflows),
	workflowInstances: many(workflowInstances),
	workflowDefinitions: many(workflowDefinitions),
	workflowExecutions: many(workflowExecutions),
	alerts: many(alerts),
	batchOperations: many(batchOperations),
	payrollEvents: many(payrollEvents),
}));

export const taxSystemsRelations = relations(taxSystems, ({one, many}) => ({
	country: one(countries, {
		fields: [taxSystems.countryCode],
		references: [countries.code]
	}),
	taxBrackets: many(taxBrackets),
	familyDeductionRules: many(familyDeductionRules),
}));

export const countriesRelations = relations(countries, ({many}) => ({
	taxSystems: many(taxSystems),
	socialSecuritySchemes: many(socialSecuritySchemes),
	otherTaxes: many(otherTaxes),
	salaryComponentDefinitions: many(salaryComponentDefinitions),
	exportTemplates: many(exportTemplates),
}));

export const departmentsRelations = relations(departments, ({one, many}) => ({
	user_createdBy: one(users, {
		fields: [departments.createdBy],
		references: [users.id],
		relationName: "departments_createdBy_users_id"
	}),
	department: one(departments, {
		fields: [departments.parentDepartmentId],
		references: [departments.id],
		relationName: "departments_parentDepartmentId_departments_id"
	}),
	departments: many(departments, {
		relationName: "departments_parentDepartmentId_departments_id"
	}),
	tenant: one(tenants, {
		fields: [departments.tenantId],
		references: [tenants.id]
	}),
	user_updatedBy: one(users, {
		fields: [departments.updatedBy],
		references: [users.id],
		relationName: "departments_updatedBy_users_id"
	}),
	employee: one(employees, {
		fields: [departments.managerId],
		references: [employees.id]
	}),
	positions: many(positions),
}));

export const taxBracketsRelations = relations(taxBrackets, ({one}) => ({
	taxSystem: one(taxSystems, {
		fields: [taxBrackets.taxSystemId],
		references: [taxSystems.id]
	}),
}));

export const positionsRelations = relations(positions, ({one, many}) => ({
	user_createdBy: one(users, {
		fields: [positions.createdBy],
		references: [users.id],
		relationName: "positions_createdBy_users_id"
	}),
	department: one(departments, {
		fields: [positions.departmentId],
		references: [departments.id]
	}),
	position: one(positions, {
		fields: [positions.reportsToPositionId],
		references: [positions.id],
		relationName: "positions_reportsToPositionId_positions_id"
	}),
	positions: many(positions, {
		relationName: "positions_reportsToPositionId_positions_id"
	}),
	tenant: one(tenants, {
		fields: [positions.tenantId],
		references: [tenants.id]
	}),
	user_updatedBy: one(users, {
		fields: [positions.updatedBy],
		references: [users.id],
		relationName: "positions_updatedBy_users_id"
	}),
	assignments: many(assignments),
}));

export const familyDeductionRulesRelations = relations(familyDeductionRules, ({one}) => ({
	taxSystem: one(taxSystems, {
		fields: [familyDeductionRules.taxSystemId],
		references: [taxSystems.id]
	}),
}));

export const socialSecuritySchemesRelations = relations(socialSecuritySchemes, ({one, many}) => ({
	country: one(countries, {
		fields: [socialSecuritySchemes.countryCode],
		references: [countries.code]
	}),
	contributionTypes: many(contributionTypes),
}));

export const assignmentsRelations = relations(assignments, ({one}) => ({
	user: one(users, {
		fields: [assignments.createdBy],
		references: [users.id]
	}),
	employee: one(employees, {
		fields: [assignments.employeeId],
		references: [employees.id]
	}),
	position: one(positions, {
		fields: [assignments.positionId],
		references: [positions.id]
	}),
	tenant: one(tenants, {
		fields: [assignments.tenantId],
		references: [tenants.id]
	}),
}));

export const contributionTypesRelations = relations(contributionTypes, ({one, many}) => ({
	socialSecurityScheme: one(socialSecuritySchemes, {
		fields: [contributionTypes.schemeId],
		references: [socialSecuritySchemes.id]
	}),
	sectorContributionOverrides: many(sectorContributionOverrides),
}));

export const employeeSalariesRelations = relations(employeeSalaries, ({one}) => ({
	user: one(users, {
		fields: [employeeSalaries.createdBy],
		references: [users.id]
	}),
	employee: one(employees, {
		fields: [employeeSalaries.employeeId],
		references: [employees.id]
	}),
	tenant: one(tenants, {
		fields: [employeeSalaries.tenantId],
		references: [tenants.id]
	}),
}));

export const sectorContributionOverridesRelations = relations(sectorContributionOverrides, ({one}) => ({
	contributionType: one(contributionTypes, {
		fields: [sectorContributionOverrides.contributionTypeId],
		references: [contributionTypes.id]
	}),
}));

export const otherTaxesRelations = relations(otherTaxes, ({one}) => ({
	country: one(countries, {
		fields: [otherTaxes.countryCode],
		references: [countries.code]
	}),
}));

export const payrollRunsRelations = relations(payrollRuns, ({one, many}) => ({
	user_approvedBy: one(users, {
		fields: [payrollRuns.approvedBy],
		references: [users.id],
		relationName: "payrollRuns_approvedBy_users_id"
	}),
	user_createdBy: one(users, {
		fields: [payrollRuns.createdBy],
		references: [users.id],
		relationName: "payrollRuns_createdBy_users_id"
	}),
	user_processedBy: one(users, {
		fields: [payrollRuns.processedBy],
		references: [users.id],
		relationName: "payrollRuns_processedBy_users_id"
	}),
	tenant: one(tenants, {
		fields: [payrollRuns.tenantId],
		references: [tenants.id]
	}),
	user_updatedBy: one(users, {
		fields: [payrollRuns.updatedBy],
		references: [users.id],
		relationName: "payrollRuns_updatedBy_users_id"
	}),
	payrollLineItems: many(payrollLineItems),
	payrollEvents: many(payrollEvents),
}));

export const payrollLineItemsRelations = relations(payrollLineItems, ({one}) => ({
	employee: one(employees, {
		fields: [payrollLineItems.employeeId],
		references: [employees.id]
	}),
	payrollRun: one(payrollRuns, {
		fields: [payrollLineItems.payrollRunId],
		references: [payrollRuns.id]
	}),
	tenant: one(tenants, {
		fields: [payrollLineItems.tenantId],
		references: [tenants.id]
	}),
}));

export const salaryComponentDefinitionsRelations = relations(salaryComponentDefinitions, ({one}) => ({
	country: one(countries, {
		fields: [salaryComponentDefinitions.countryCode],
		references: [countries.code]
	}),
}));

export const exportTemplatesRelations = relations(exportTemplates, ({one}) => ({
	country: one(countries, {
		fields: [exportTemplates.countryCode],
		references: [countries.code]
	}),
}));

export const timeEntriesRelations = relations(timeEntries, ({one}) => ({
	user: one(users, {
		fields: [timeEntries.approvedBy],
		references: [users.id]
	}),
	employee: one(employees, {
		fields: [timeEntries.employeeId],
		references: [employees.id]
	}),
	tenant: one(tenants, {
		fields: [timeEntries.tenantId],
		references: [tenants.id]
	}),
}));

export const timeOffPoliciesRelations = relations(timeOffPolicies, ({one, many}) => ({
	user: one(users, {
		fields: [timeOffPolicies.createdBy],
		references: [users.id]
	}),
	tenant: one(tenants, {
		fields: [timeOffPolicies.tenantId],
		references: [tenants.id]
	}),
	timeOffBalances: many(timeOffBalances),
	timeOffRequests: many(timeOffRequests),
}));

export const timeOffBalancesRelations = relations(timeOffBalances, ({one}) => ({
	employee: one(employees, {
		fields: [timeOffBalances.employeeId],
		references: [employees.id]
	}),
	timeOffPolicy: one(timeOffPolicies, {
		fields: [timeOffBalances.policyId],
		references: [timeOffPolicies.id]
	}),
	tenant: one(tenants, {
		fields: [timeOffBalances.tenantId],
		references: [tenants.id]
	}),
}));

export const timeOffRequestsRelations = relations(timeOffRequests, ({one}) => ({
	employee: one(employees, {
		fields: [timeOffRequests.employeeId],
		references: [employees.id]
	}),
	timeOffPolicy: one(timeOffPolicies, {
		fields: [timeOffRequests.policyId],
		references: [timeOffPolicies.id]
	}),
	user: one(users, {
		fields: [timeOffRequests.reviewedBy],
		references: [users.id]
	}),
	tenant: one(tenants, {
		fields: [timeOffRequests.tenantId],
		references: [tenants.id]
	}),
}));

export const eventsRelations = relations(events, ({one}) => ({
	user: one(users, {
		fields: [events.createdBy],
		references: [users.id]
	}),
	tenant: one(tenants, {
		fields: [events.tenantId],
		references: [tenants.id]
	}),
}));

export const auditLogsRelations = relations(auditLogs, ({one}) => ({
	tenant: one(tenants, {
		fields: [auditLogs.tenantId],
		references: [tenants.id]
	}),
	user: one(users, {
		fields: [auditLogs.userId],
		references: [users.id]
	}),
}));

export const workflowsRelations = relations(workflows, ({one, many}) => ({
	user: one(users, {
		fields: [workflows.createdBy],
		references: [users.id]
	}),
	tenant: one(tenants, {
		fields: [workflows.tenantId],
		references: [tenants.id]
	}),
	workflowInstances: many(workflowInstances),
}));

export const workflowInstancesRelations = relations(workflowInstances, ({one}) => ({
	tenant: one(tenants, {
		fields: [workflowInstances.tenantId],
		references: [tenants.id]
	}),
	workflow: one(workflows, {
		fields: [workflowInstances.workflowId],
		references: [workflows.id]
	}),
}));

export const workflowDefinitionsRelations = relations(workflowDefinitions, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [workflowDefinitions.tenantId],
		references: [tenants.id]
	}),
	createdByUser: one(users, {
		fields: [workflowDefinitions.createdBy],
		references: [users.id]
	}),
	workflowExecutions: many(workflowExecutions),
}));

export const workflowExecutionsRelations = relations(workflowExecutions, ({one}) => ({
	tenant: one(tenants, {
		fields: [workflowExecutions.tenantId],
		references: [tenants.id]
	}),
	workflowDefinition: one(workflowDefinitions, {
		fields: [workflowExecutions.workflowId],
		references: [workflowDefinitions.id]
	}),
	employee: one(employees, {
		fields: [workflowExecutions.employeeId],
		references: [employees.id]
	}),
}));

export const alertsRelations = relations(alerts, ({one}) => ({
	tenant: one(tenants, {
		fields: [alerts.tenantId],
		references: [tenants.id]
	}),
	assignee: one(users, {
		fields: [alerts.assigneeId],
		references: [users.id],
		relationName: "alerts_assigneeId_users_id"
	}),
	employee: one(employees, {
		fields: [alerts.employeeId],
		references: [employees.id]
	}),
	dismissedByUser: one(users, {
		fields: [alerts.dismissedBy],
		references: [users.id],
		relationName: "alerts_dismissedBy_users_id"
	}),
	completedByUser: one(users, {
		fields: [alerts.completedBy],
		references: [users.id],
		relationName: "alerts_completedBy_users_id"
	}),
}));

export const batchOperationsRelations = relations(batchOperations, ({one}) => ({
	tenant: one(tenants, {
		fields: [batchOperations.tenantId],
		references: [tenants.id]
	}),
	startedByUser: one(users, {
		fields: [batchOperations.startedBy],
		references: [users.id]
	}),
}));

export const payrollEventsRelations = relations(payrollEvents, ({one}) => ({
	tenant: one(tenants, {
		fields: [payrollEvents.tenantId],
		references: [tenants.id]
	}),
	employee: one(employees, {
		fields: [payrollEvents.employeeId],
		references: [employees.id]
	}),
	payrollRun: one(payrollRuns, {
		fields: [payrollEvents.payrollRunId],
		references: [payrollRuns.id]
	}),
	createdByUser: one(users, {
		fields: [payrollEvents.createdBy],
		references: [users.id]
	}),
}));