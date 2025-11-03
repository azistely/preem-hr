import { relations } from "drizzle-orm/relations";
import { tenants, salaryBands, sectorConfigurations, employees, users, departments, taxSystems, taxBrackets, familyDeductionRules, countries, positions, overtimeRules, timeOffPolicyTemplates, socialSecuritySchemes, employeeTerminations, dataMigrations, historicalPayrollData, assignments, contributionTypes, overtimeRates, leaveAccrualRules, salaryComponentFormulaVersions, sectorContributionOverrides, jobSearchDays, employeeSalaries, otherTaxes, salaryComponentTemplates, complianceRules, payrollLineItems, payrollRuns, conventionCollectives, bankingProfessionalLevels, bankingSeniorityBonuses, salaryComponentDefinitions, payslips, geofenceConfigurations, geofenceEmployeeAssignments, exportTemplates, tenantSalaryComponentActivations, publicHolidays, timeOffPolicies, salaryReviews, workSchedules, auditLogs, geofenceConfigs, events, workflows, workflowInstances, bulkSalaryAdjustments, bulkAdjustmentItems, payslipTemplates, workflowDefinitions, batchOperations, workflowExecutions, alerts, payrollEvents, employeeBonuses, employeeImportStaging, employeeRegisterEntries, generatedDocuments, accountingAccounts, employeeCategoryCoefficients, glExports, timeOffBalances, timeOffRequests, employeeSiteAssignments, locations, bonuses, cityTransportMinimums, variablePayInputs, employmentContracts, contractComplianceAlerts, dailyHoursEntries, timeEntries, contractRenewalHistory, employeeDependents, benefitPlans, employeeBenefitEnrollments, employeeBenefitEnrollmentHistory } from "./schema";

export const salaryBandsRelations = relations(salaryBands, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [salaryBands.tenantId],
		references: [tenants.id]
	}),
	positions: many(positions),
}));

export const tenantsRelations = relations(tenants, ({one, many}) => ({
	salaryBands: many(salaryBands),
	sectorConfiguration: one(sectorConfigurations, {
		fields: [tenants.countryCode],
		references: [sectorConfigurations.countryCode]
	}),
	users: many(users),
	departments: many(departments),
	positions: many(positions),
	employeeTerminations: many(employeeTerminations),
	historicalPayrollData: many(historicalPayrollData),
	assignments: many(assignments),
	jobSearchDays: many(jobSearchDays),
	employeeSalaries: many(employeeSalaries),
	payrollLineItems: many(payrollLineItems),
	payrollRuns: many(payrollRuns),
	dataMigrations: many(dataMigrations),
	payslips: many(payslips),
	geofenceConfigurations: many(geofenceConfigurations),
	tenantSalaryComponentActivations: many(tenantSalaryComponentActivations),
	timeOffPolicies: many(timeOffPolicies),
	salaryReviews: many(salaryReviews),
	workSchedules: many(workSchedules),
	auditLogs: many(auditLogs),
	geofenceConfigs: many(geofenceConfigs),
	events: many(events),
	workflows: many(workflows),
	workflowInstances: many(workflowInstances),
	bulkSalaryAdjustments: many(bulkSalaryAdjustments),
	payslipTemplates: many(payslipTemplates),
	workflowDefinitions: many(workflowDefinitions),
	batchOperations: many(batchOperations),
	workflowExecutions: many(workflowExecutions),
	alerts: many(alerts),
	payrollEvents: many(payrollEvents),
	employeeBonuses: many(employeeBonuses),
	employeeRegisterEntries: many(employeeRegisterEntries),
	generatedDocuments: many(generatedDocuments),
	accountingAccounts: many(accountingAccounts),
	glExports: many(glExports),
	timeOffBalances: many(timeOffBalances),
	timeOffRequests: many(timeOffRequests),
	bonuses: many(bonuses),
	variablePayInputs: many(variablePayInputs),
	contractComplianceAlerts: many(contractComplianceAlerts),
	dailyHoursEntries: many(dailyHoursEntries),
	timeEntries: many(timeEntries),
	employeeDependents: many(employeeDependents),
	benefitPlans: many(benefitPlans),
	employeeBenefitEnrollments: many(employeeBenefitEnrollments),
	employmentContracts: many(employmentContracts),
	employees: many(employees),
	locations: many(locations),
}));

export const sectorConfigurationsRelations = relations(sectorConfigurations, ({one, many}) => ({
	tenants: many(tenants),
	country: one(countries, {
		fields: [sectorConfigurations.countryCode],
		references: [countries.code]
	}),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	employee: one(employees, {
		fields: [users.employeeId],
		references: [employees.id],
		relationName: "users_employeeId_employees_id"
	}),
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
	assignments: many(assignments),
	jobSearchDays_approvedBy: many(jobSearchDays, {
		relationName: "jobSearchDays_approvedBy_users_id"
	}),
	jobSearchDays_createdBy: many(jobSearchDays, {
		relationName: "jobSearchDays_createdBy_users_id"
	}),
	jobSearchDays_updatedBy: many(jobSearchDays, {
		relationName: "jobSearchDays_updatedBy_users_id"
	}),
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
	dataMigrations: many(dataMigrations),
	payslips: many(payslips),
	tenantSalaryComponentActivations: many(tenantSalaryComponentActivations),
	timeOffPolicies: many(timeOffPolicies),
	salaryReviews_requestedBy: many(salaryReviews, {
		relationName: "salaryReviews_requestedBy_users_id"
	}),
	salaryReviews_reviewedBy: many(salaryReviews, {
		relationName: "salaryReviews_reviewedBy_users_id"
	}),
	workSchedules_approvedBy: many(workSchedules, {
		relationName: "workSchedules_approvedBy_users_id"
	}),
	workSchedules_createdBy: many(workSchedules, {
		relationName: "workSchedules_createdBy_users_id"
	}),
	workSchedules_updatedBy: many(workSchedules, {
		relationName: "workSchedules_updatedBy_users_id"
	}),
	auditLogs: many(auditLogs),
	geofenceConfigs: many(geofenceConfigs),
	events: many(events),
	workflows: many(workflows),
	bulkSalaryAdjustments_approvedBy: many(bulkSalaryAdjustments, {
		relationName: "bulkSalaryAdjustments_approvedBy_users_id"
	}),
	bulkSalaryAdjustments_createdBy: many(bulkSalaryAdjustments, {
		relationName: "bulkSalaryAdjustments_createdBy_users_id"
	}),
	workflowDefinitions: many(workflowDefinitions),
	batchOperations: many(batchOperations),
	alerts_assigneeId: many(alerts, {
		relationName: "alerts_assigneeId_users_id"
	}),
	alerts_completedBy: many(alerts, {
		relationName: "alerts_completedBy_users_id"
	}),
	alerts_dismissedBy: many(alerts, {
		relationName: "alerts_dismissedBy_users_id"
	}),
	payrollEvents: many(payrollEvents),
	employeeBonuses_approvedBy: many(employeeBonuses, {
		relationName: "employeeBonuses_approvedBy_users_id"
	}),
	employeeBonuses_requestedBy: many(employeeBonuses, {
		relationName: "employeeBonuses_requestedBy_users_id"
	}),
	employeeRegisterEntries: many(employeeRegisterEntries),
	generatedDocuments: many(generatedDocuments),
	glExports: many(glExports),
	timeOffRequests: many(timeOffRequests),
	bonuses_approvedBy: many(bonuses, {
		relationName: "bonuses_approvedBy_users_id"
	}),
	bonuses_createdBy: many(bonuses, {
		relationName: "bonuses_createdBy_users_id"
	}),
	variablePayInputs: many(variablePayInputs),
	contractComplianceAlerts: many(contractComplianceAlerts),
	dailyHoursEntries_approvedBy: many(dailyHoursEntries, {
		relationName: "dailyHoursEntries_approvedBy_users_id"
	}),
	dailyHoursEntries_createdBy: many(dailyHoursEntries, {
		relationName: "dailyHoursEntries_createdBy_users_id"
	}),
	timeEntries: many(timeEntries),
	contractRenewalHistories: many(contractRenewalHistory),
	benefitPlans_createdBy: many(benefitPlans, {
		relationName: "benefitPlans_createdBy_users_id"
	}),
	benefitPlans_updatedBy: many(benefitPlans, {
		relationName: "benefitPlans_updatedBy_users_id"
	}),
	employeeBenefitEnrollments_createdBy: many(employeeBenefitEnrollments, {
		relationName: "employeeBenefitEnrollments_createdBy_users_id"
	}),
	employeeBenefitEnrollments_updatedBy: many(employeeBenefitEnrollments, {
		relationName: "employeeBenefitEnrollments_updatedBy_users_id"
	}),
	employmentContracts: many(employmentContracts),
	employeeBenefitEnrollmentHistories: many(employeeBenefitEnrollmentHistory),
	employees_createdBy: many(employees, {
		relationName: "employees_createdBy_users_id"
	}),
	employees_updatedBy: many(employees, {
		relationName: "employees_updatedBy_users_id"
	}),
	employeeTerminations_createdBy: many(employeeTerminations, {
		relationName: "employeeTerminations_createdBy_users_id"
	}),
	employeeTerminations_updatedBy: many(employeeTerminations, {
		relationName: "employeeTerminations_updatedBy_users_id"
	}),
	salaryComponentFormulaVersions: many(salaryComponentFormulaVersions),
}));

export const employeesRelations = relations(employees, ({one, many}) => ({
	users: many(users, {
		relationName: "users_employeeId_employees_id"
	}),
	departments: many(departments),
	employeeTerminations: many(employeeTerminations, {
		relationName: "employeeTerminations_employeeId_employees_id"
	}),
	assignments: many(assignments),
	jobSearchDays: many(jobSearchDays),
	employeeSalaries: many(employeeSalaries),
	payrollLineItems: many(payrollLineItems),
	payslips: many(payslips),
	geofenceEmployeeAssignments: many(geofenceEmployeeAssignments),
	salaryReviews: many(salaryReviews),
	workSchedules: many(workSchedules),
	bulkAdjustmentItems: many(bulkAdjustmentItems),
	workflowExecutions: many(workflowExecutions),
	alerts: many(alerts),
	payrollEvents: many(payrollEvents),
	employeeBonuses: many(employeeBonuses),
	employeeImportStagings: many(employeeImportStaging),
	employeeRegisterEntries: many(employeeRegisterEntries),
	generatedDocuments: many(generatedDocuments),
	timeOffBalances: many(timeOffBalances),
	timeOffRequests: many(timeOffRequests),
	employeeSiteAssignments: many(employeeSiteAssignments),
	bonuses: many(bonuses),
	variablePayInputs: many(variablePayInputs),
	contractComplianceAlerts: many(contractComplianceAlerts),
	dailyHoursEntries: many(dailyHoursEntries),
	timeEntries: many(timeEntries),
	employeeDependents: many(employeeDependents),
	employeeBenefitEnrollments: many(employeeBenefitEnrollments),
	employmentContracts: many(employmentContracts, {
		relationName: "employmentContracts_employeeId_employees_id"
	}),
	user_createdBy: one(users, {
		fields: [employees.createdBy],
		references: [users.id],
		relationName: "employees_createdBy_users_id"
	}),
	employmentContract: one(employmentContracts, {
		fields: [employees.currentContractId],
		references: [employmentContracts.id],
		relationName: "employees_currentContractId_employmentContracts_id"
	}),
	location: one(locations, {
		fields: [employees.primaryLocationId],
		references: [locations.id]
	}),
	employee: one(employees, {
		fields: [employees.reportingManagerId],
		references: [employees.id],
		relationName: "employees_reportingManagerId_employees_id"
	}),
	employees: many(employees, {
		relationName: "employees_reportingManagerId_employees_id"
	}),
	tenant: one(tenants, {
		fields: [employees.tenantId],
		references: [tenants.id]
	}),
	employeeTermination: one(employeeTerminations, {
		fields: [employees.terminationId],
		references: [employeeTerminations.id],
		relationName: "employees_terminationId_employeeTerminations_id"
	}),
	user_updatedBy: one(users, {
		fields: [employees.updatedBy],
		references: [users.id],
		relationName: "employees_updatedBy_users_id"
	}),
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

export const taxSystemsRelations = relations(taxSystems, ({one, many}) => ({
	taxBrackets: many(taxBrackets),
	familyDeductionRules: many(familyDeductionRules),
	country: one(countries, {
		fields: [taxSystems.countryCode],
		references: [countries.code]
	}),
}));

export const familyDeductionRulesRelations = relations(familyDeductionRules, ({one}) => ({
	taxSystem: one(taxSystems, {
		fields: [familyDeductionRules.taxSystemId],
		references: [taxSystems.id]
	}),
}));

export const countriesRelations = relations(countries, ({many}) => ({
	sectorConfigurations: many(sectorConfigurations),
	overtimeRules: many(overtimeRules),
	timeOffPolicyTemplates: many(timeOffPolicyTemplates),
	socialSecuritySchemes: many(socialSecuritySchemes),
	overtimeRates: many(overtimeRates),
	leaveAccrualRules: many(leaveAccrualRules),
	taxSystems: many(taxSystems),
	otherTaxes: many(otherTaxes),
	salaryComponentTemplates: many(salaryComponentTemplates),
	complianceRules: many(complianceRules),
	conventionCollectives: many(conventionCollectives),
	salaryComponentDefinitions: many(salaryComponentDefinitions),
	exportTemplates: many(exportTemplates),
	publicHolidays: many(publicHolidays),
	employeeCategoryCoefficients: many(employeeCategoryCoefficients),
	cityTransportMinimums: many(cityTransportMinimums),
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
	salaryBand: one(salaryBands, {
		fields: [positions.salaryBandId],
		references: [salaryBands.id]
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

export const overtimeRulesRelations = relations(overtimeRules, ({one}) => ({
	country: one(countries, {
		fields: [overtimeRules.countryCode],
		references: [countries.code]
	}),
}));

export const timeOffPolicyTemplatesRelations = relations(timeOffPolicyTemplates, ({one, many}) => ({
	country: one(countries, {
		fields: [timeOffPolicyTemplates.countryCode],
		references: [countries.code]
	}),
	timeOffPolicies: many(timeOffPolicies),
}));

export const socialSecuritySchemesRelations = relations(socialSecuritySchemes, ({one, many}) => ({
	country: one(countries, {
		fields: [socialSecuritySchemes.countryCode],
		references: [countries.code]
	}),
	contributionTypes: many(contributionTypes),
}));

export const employeeTerminationsRelations = relations(employeeTerminations, ({one, many}) => ({
	users_createdBy: one(users, {
		fields: [employeeTerminations.createdBy],
		references: [users.id],
		relationName: "employeeTerminations_createdBy_users_id"
	}),
	employee: one(employees, {
		fields: [employeeTerminations.employeeId],
		references: [employees.id],
		relationName: "employeeTerminations_employeeId_employees_id"
	}),
	tenant: one(tenants, {
		fields: [employeeTerminations.tenantId],
		references: [tenants.id]
	}),
	users_updatedBy: one(users, {
		fields: [employeeTerminations.updatedBy],
		references: [users.id],
		relationName: "employeeTerminations_updatedBy_users_id"
	}),
	jobSearchDays: many(jobSearchDays),
	employees: many(employees, {
		relationName: "employees_terminationId_employeeTerminations_id"
	}),
}));

export const historicalPayrollDataRelations = relations(historicalPayrollData, ({one}) => ({
	dataMigration: one(dataMigrations, {
		fields: [historicalPayrollData.migrationId],
		references: [dataMigrations.id]
	}),
	tenant: one(tenants, {
		fields: [historicalPayrollData.tenantId],
		references: [tenants.id]
	}),
}));

export const dataMigrationsRelations = relations(dataMigrations, ({one, many}) => ({
	historicalPayrollData: many(historicalPayrollData),
	user: one(users, {
		fields: [dataMigrations.migratedBy],
		references: [users.id]
	}),
	tenant: one(tenants, {
		fields: [dataMigrations.tenantId],
		references: [tenants.id]
	}),
	employeeImportStagings: many(employeeImportStaging),
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

export const overtimeRatesRelations = relations(overtimeRates, ({one}) => ({
	country: one(countries, {
		fields: [overtimeRates.countryCode],
		references: [countries.code]
	}),
}));

export const leaveAccrualRulesRelations = relations(leaveAccrualRules, ({one}) => ({
	country: one(countries, {
		fields: [leaveAccrualRules.countryCode],
		references: [countries.code]
	}),
}));

export const salaryComponentFormulaVersionsRelations = relations(salaryComponentFormulaVersions, ({one}) => ({
	users: one(users, {
		fields: [salaryComponentFormulaVersions.changedBy],
		references: [users.id]
	}),
}));

export const sectorContributionOverridesRelations = relations(sectorContributionOverrides, ({one}) => ({
	contributionType: one(contributionTypes, {
		fields: [sectorContributionOverrides.contributionTypeId],
		references: [contributionTypes.id]
	}),
}));

export const jobSearchDaysRelations = relations(jobSearchDays, ({one}) => ({
	user_approvedBy: one(users, {
		fields: [jobSearchDays.approvedBy],
		references: [users.id],
		relationName: "jobSearchDays_approvedBy_users_id"
	}),
	user_createdBy: one(users, {
		fields: [jobSearchDays.createdBy],
		references: [users.id],
		relationName: "jobSearchDays_createdBy_users_id"
	}),
	employee: one(employees, {
		fields: [jobSearchDays.employeeId],
		references: [employees.id]
	}),
	tenant: one(tenants, {
		fields: [jobSearchDays.tenantId],
		references: [tenants.id]
	}),
	employeeTermination: one(employeeTerminations, {
		fields: [jobSearchDays.terminationId],
		references: [employeeTerminations.id]
	}),
	user_updatedBy: one(users, {
		fields: [jobSearchDays.updatedBy],
		references: [users.id],
		relationName: "jobSearchDays_updatedBy_users_id"
	}),
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

export const otherTaxesRelations = relations(otherTaxes, ({one}) => ({
	country: one(countries, {
		fields: [otherTaxes.countryCode],
		references: [countries.code]
	}),
}));

export const salaryComponentTemplatesRelations = relations(salaryComponentTemplates, ({one}) => ({
	country: one(countries, {
		fields: [salaryComponentTemplates.countryCode],
		references: [countries.code]
	}),
}));

export const complianceRulesRelations = relations(complianceRules, ({one}) => ({
	country: one(countries, {
		fields: [complianceRules.countryCode],
		references: [countries.code]
	}),
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

export const payrollRunsRelations = relations(payrollRuns, ({one, many}) => ({
	payrollLineItems: many(payrollLineItems),
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
	payrollEvents: many(payrollEvents),
	generatedDocuments: many(generatedDocuments),
	glExports: many(glExports),
}));

export const bankingProfessionalLevelsRelations = relations(bankingProfessionalLevels, ({one}) => ({
	conventionCollective: one(conventionCollectives, {
		fields: [bankingProfessionalLevels.conventionId],
		references: [conventionCollectives.id]
	}),
}));

export const conventionCollectivesRelations = relations(conventionCollectives, ({one, many}) => ({
	bankingProfessionalLevels: many(bankingProfessionalLevels),
	bankingSeniorityBonuses: many(bankingSeniorityBonuses),
	country: one(countries, {
		fields: [conventionCollectives.countryCode],
		references: [countries.code]
	}),
}));

export const bankingSeniorityBonusesRelations = relations(bankingSeniorityBonuses, ({one}) => ({
	conventionCollective: one(conventionCollectives, {
		fields: [bankingSeniorityBonuses.conventionId],
		references: [conventionCollectives.id]
	}),
}));

export const salaryComponentDefinitionsRelations = relations(salaryComponentDefinitions, ({one, many}) => ({
	country: one(countries, {
		fields: [salaryComponentDefinitions.countryCode],
		references: [countries.code]
	}),
	tenantSalaryComponentActivations: many(tenantSalaryComponentActivations),
	benefitPlans: many(benefitPlans),
}));

export const payslipsRelations = relations(payslips, ({one}) => ({
	employee: one(employees, {
		fields: [payslips.employeeId],
		references: [employees.id]
	}),
	user: one(users, {
		fields: [payslips.finalizedBy],
		references: [users.id]
	}),
	tenant: one(tenants, {
		fields: [payslips.tenantId],
		references: [tenants.id]
	}),
}));

export const geofenceConfigurationsRelations = relations(geofenceConfigurations, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [geofenceConfigurations.tenantId],
		references: [tenants.id]
	}),
	geofenceEmployeeAssignments: many(geofenceEmployeeAssignments),
}));

export const geofenceEmployeeAssignmentsRelations = relations(geofenceEmployeeAssignments, ({one}) => ({
	employee: one(employees, {
		fields: [geofenceEmployeeAssignments.employeeId],
		references: [employees.id]
	}),
	geofenceConfiguration: one(geofenceConfigurations, {
		fields: [geofenceEmployeeAssignments.geofenceId],
		references: [geofenceConfigurations.id]
	}),
}));

export const exportTemplatesRelations = relations(exportTemplates, ({one}) => ({
	country: one(countries, {
		fields: [exportTemplates.countryCode],
		references: [countries.code]
	}),
}));

export const tenantSalaryComponentActivationsRelations = relations(tenantSalaryComponentActivations, ({one}) => ({
	user: one(users, {
		fields: [tenantSalaryComponentActivations.createdBy],
		references: [users.id]
	}),
	salaryComponentDefinition: one(salaryComponentDefinitions, {
		fields: [tenantSalaryComponentActivations.countryCode],
		references: [salaryComponentDefinitions.countryCode]
	}),
	tenant: one(tenants, {
		fields: [tenantSalaryComponentActivations.tenantId],
		references: [tenants.id]
	}),
}));

export const publicHolidaysRelations = relations(publicHolidays, ({one}) => ({
	country: one(countries, {
		fields: [publicHolidays.countryCode],
		references: [countries.code]
	}),
}));

export const timeOffPoliciesRelations = relations(timeOffPolicies, ({one, many}) => ({
	user: one(users, {
		fields: [timeOffPolicies.createdBy],
		references: [users.id]
	}),
	timeOffPolicyTemplate: one(timeOffPolicyTemplates, {
		fields: [timeOffPolicies.templateId],
		references: [timeOffPolicyTemplates.id]
	}),
	tenant: one(tenants, {
		fields: [timeOffPolicies.tenantId],
		references: [tenants.id]
	}),
	timeOffBalances: many(timeOffBalances),
	timeOffRequests: many(timeOffRequests),
}));

export const salaryReviewsRelations = relations(salaryReviews, ({one}) => ({
	employee: one(employees, {
		fields: [salaryReviews.employeeId],
		references: [employees.id]
	}),
	user_requestedBy: one(users, {
		fields: [salaryReviews.requestedBy],
		references: [users.id],
		relationName: "salaryReviews_requestedBy_users_id"
	}),
	user_reviewedBy: one(users, {
		fields: [salaryReviews.reviewedBy],
		references: [users.id],
		relationName: "salaryReviews_reviewedBy_users_id"
	}),
	tenant: one(tenants, {
		fields: [salaryReviews.tenantId],
		references: [tenants.id]
	}),
}));

export const workSchedulesRelations = relations(workSchedules, ({one}) => ({
	user_approvedBy: one(users, {
		fields: [workSchedules.approvedBy],
		references: [users.id],
		relationName: "workSchedules_approvedBy_users_id"
	}),
	user_createdBy: one(users, {
		fields: [workSchedules.createdBy],
		references: [users.id],
		relationName: "workSchedules_createdBy_users_id"
	}),
	employee: one(employees, {
		fields: [workSchedules.employeeId],
		references: [employees.id]
	}),
	tenant: one(tenants, {
		fields: [workSchedules.tenantId],
		references: [tenants.id]
	}),
	user_updatedBy: one(users, {
		fields: [workSchedules.updatedBy],
		references: [users.id],
		relationName: "workSchedules_updatedBy_users_id"
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

export const geofenceConfigsRelations = relations(geofenceConfigs, ({one}) => ({
	user: one(users, {
		fields: [geofenceConfigs.createdBy],
		references: [users.id]
	}),
	tenant: one(tenants, {
		fields: [geofenceConfigs.tenantId],
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

export const bulkSalaryAdjustmentsRelations = relations(bulkSalaryAdjustments, ({one, many}) => ({
	user_approvedBy: one(users, {
		fields: [bulkSalaryAdjustments.approvedBy],
		references: [users.id],
		relationName: "bulkSalaryAdjustments_approvedBy_users_id"
	}),
	user_createdBy: one(users, {
		fields: [bulkSalaryAdjustments.createdBy],
		references: [users.id],
		relationName: "bulkSalaryAdjustments_createdBy_users_id"
	}),
	tenant: one(tenants, {
		fields: [bulkSalaryAdjustments.tenantId],
		references: [tenants.id]
	}),
	bulkAdjustmentItems: many(bulkAdjustmentItems),
}));

export const bulkAdjustmentItemsRelations = relations(bulkAdjustmentItems, ({one}) => ({
	bulkSalaryAdjustment: one(bulkSalaryAdjustments, {
		fields: [bulkAdjustmentItems.adjustmentId],
		references: [bulkSalaryAdjustments.id]
	}),
	employee: one(employees, {
		fields: [bulkAdjustmentItems.employeeId],
		references: [employees.id]
	}),
}));

export const payslipTemplatesRelations = relations(payslipTemplates, ({one}) => ({
	tenant: one(tenants, {
		fields: [payslipTemplates.tenantId],
		references: [tenants.id]
	}),
}));

export const workflowDefinitionsRelations = relations(workflowDefinitions, ({one, many}) => ({
	user: one(users, {
		fields: [workflowDefinitions.createdBy],
		references: [users.id]
	}),
	tenant: one(tenants, {
		fields: [workflowDefinitions.tenantId],
		references: [tenants.id]
	}),
	workflowExecutions: many(workflowExecutions),
}));

export const batchOperationsRelations = relations(batchOperations, ({one}) => ({
	user: one(users, {
		fields: [batchOperations.startedBy],
		references: [users.id]
	}),
	tenant: one(tenants, {
		fields: [batchOperations.tenantId],
		references: [tenants.id]
	}),
}));

export const workflowExecutionsRelations = relations(workflowExecutions, ({one}) => ({
	employee: one(employees, {
		fields: [workflowExecutions.employeeId],
		references: [employees.id]
	}),
	tenant: one(tenants, {
		fields: [workflowExecutions.tenantId],
		references: [tenants.id]
	}),
	workflowDefinition: one(workflowDefinitions, {
		fields: [workflowExecutions.workflowId],
		references: [workflowDefinitions.id]
	}),
}));

export const alertsRelations = relations(alerts, ({one}) => ({
	user_assigneeId: one(users, {
		fields: [alerts.assigneeId],
		references: [users.id],
		relationName: "alerts_assigneeId_users_id"
	}),
	user_completedBy: one(users, {
		fields: [alerts.completedBy],
		references: [users.id],
		relationName: "alerts_completedBy_users_id"
	}),
	user_dismissedBy: one(users, {
		fields: [alerts.dismissedBy],
		references: [users.id],
		relationName: "alerts_dismissedBy_users_id"
	}),
	employee: one(employees, {
		fields: [alerts.employeeId],
		references: [employees.id]
	}),
	tenant: one(tenants, {
		fields: [alerts.tenantId],
		references: [tenants.id]
	}),
}));

export const payrollEventsRelations = relations(payrollEvents, ({one}) => ({
	user: one(users, {
		fields: [payrollEvents.createdBy],
		references: [users.id]
	}),
	employee: one(employees, {
		fields: [payrollEvents.employeeId],
		references: [employees.id]
	}),
	payrollRun: one(payrollRuns, {
		fields: [payrollEvents.payrollRunId],
		references: [payrollRuns.id]
	}),
	tenant: one(tenants, {
		fields: [payrollEvents.tenantId],
		references: [tenants.id]
	}),
}));

export const employeeBonusesRelations = relations(employeeBonuses, ({one}) => ({
	user_approvedBy: one(users, {
		fields: [employeeBonuses.approvedBy],
		references: [users.id],
		relationName: "employeeBonuses_approvedBy_users_id"
	}),
	employee: one(employees, {
		fields: [employeeBonuses.employeeId],
		references: [employees.id]
	}),
	user_requestedBy: one(users, {
		fields: [employeeBonuses.requestedBy],
		references: [users.id],
		relationName: "employeeBonuses_requestedBy_users_id"
	}),
	tenant: one(tenants, {
		fields: [employeeBonuses.tenantId],
		references: [tenants.id]
	}),
}));

export const employeeImportStagingRelations = relations(employeeImportStaging, ({one}) => ({
	employee: one(employees, {
		fields: [employeeImportStaging.importedEmployeeId],
		references: [employees.id]
	}),
	dataMigration: one(dataMigrations, {
		fields: [employeeImportStaging.migrationId],
		references: [dataMigrations.id]
	}),
}));

export const employeeRegisterEntriesRelations = relations(employeeRegisterEntries, ({one}) => ({
	employee: one(employees, {
		fields: [employeeRegisterEntries.employeeId],
		references: [employees.id]
	}),
	user: one(users, {
		fields: [employeeRegisterEntries.registeredBy],
		references: [users.id]
	}),
	tenant: one(tenants, {
		fields: [employeeRegisterEntries.tenantId],
		references: [tenants.id]
	}),
}));

export const generatedDocumentsRelations = relations(generatedDocuments, ({one}) => ({
	employee: one(employees, {
		fields: [generatedDocuments.employeeId],
		references: [employees.id]
	}),
	user: one(users, {
		fields: [generatedDocuments.generatedBy],
		references: [users.id]
	}),
	payrollRun: one(payrollRuns, {
		fields: [generatedDocuments.payrollRunId],
		references: [payrollRuns.id]
	}),
	tenant: one(tenants, {
		fields: [generatedDocuments.tenantId],
		references: [tenants.id]
	}),
}));

export const accountingAccountsRelations = relations(accountingAccounts, ({one}) => ({
	tenant: one(tenants, {
		fields: [accountingAccounts.tenantId],
		references: [tenants.id]
	}),
}));

export const employeeCategoryCoefficientsRelations = relations(employeeCategoryCoefficients, ({one}) => ({
	country: one(countries, {
		fields: [employeeCategoryCoefficients.countryCode],
		references: [countries.code]
	}),
}));

export const glExportsRelations = relations(glExports, ({one}) => ({
	user: one(users, {
		fields: [glExports.exportedBy],
		references: [users.id]
	}),
	payrollRun: one(payrollRuns, {
		fields: [glExports.payrollRunId],
		references: [payrollRuns.id]
	}),
	tenant: one(tenants, {
		fields: [glExports.tenantId],
		references: [tenants.id]
	}),
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

export const employeeSiteAssignmentsRelations = relations(employeeSiteAssignments, ({one}) => ({
	employee: one(employees, {
		fields: [employeeSiteAssignments.employeeId],
		references: [employees.id]
	}),
	location: one(locations, {
		fields: [employeeSiteAssignments.locationId],
		references: [locations.id]
	}),
}));

export const locationsRelations = relations(locations, ({one, many}) => ({
	employeeSiteAssignments: many(employeeSiteAssignments),
	timeEntries: many(timeEntries),
	employees: many(employees),
	tenant: one(tenants, {
		fields: [locations.tenantId],
		references: [tenants.id]
	}),
}));

export const bonusesRelations = relations(bonuses, ({one}) => ({
	user_approvedBy: one(users, {
		fields: [bonuses.approvedBy],
		references: [users.id],
		relationName: "bonuses_approvedBy_users_id"
	}),
	user_createdBy: one(users, {
		fields: [bonuses.createdBy],
		references: [users.id],
		relationName: "bonuses_createdBy_users_id"
	}),
	employee: one(employees, {
		fields: [bonuses.employeeId],
		references: [employees.id]
	}),
	tenant: one(tenants, {
		fields: [bonuses.tenantId],
		references: [tenants.id]
	}),
}));

export const cityTransportMinimumsRelations = relations(cityTransportMinimums, ({one}) => ({
	country: one(countries, {
		fields: [cityTransportMinimums.countryCode],
		references: [countries.code]
	}),
}));

export const variablePayInputsRelations = relations(variablePayInputs, ({one}) => ({
	user: one(users, {
		fields: [variablePayInputs.createdBy],
		references: [users.id]
	}),
	employee: one(employees, {
		fields: [variablePayInputs.employeeId],
		references: [employees.id]
	}),
	tenant: one(tenants, {
		fields: [variablePayInputs.tenantId],
		references: [tenants.id]
	}),
}));

export const contractComplianceAlertsRelations = relations(contractComplianceAlerts, ({one}) => ({
	employmentContract: one(employmentContracts, {
		fields: [contractComplianceAlerts.contractId],
		references: [employmentContracts.id]
	}),
	user: one(users, {
		fields: [contractComplianceAlerts.dismissedBy],
		references: [users.id]
	}),
	employee: one(employees, {
		fields: [contractComplianceAlerts.employeeId],
		references: [employees.id]
	}),
	tenant: one(tenants, {
		fields: [contractComplianceAlerts.tenantId],
		references: [tenants.id]
	}),
}));

export const employmentContractsRelations = relations(employmentContracts, ({one, many}) => ({
	contractComplianceAlerts: many(contractComplianceAlerts),
	contractRenewalHistories_originalContractId: many(contractRenewalHistory, {
		relationName: "contractRenewalHistory_originalContractId_employmentContracts_id"
	}),
	contractRenewalHistories_renewalContractId: many(contractRenewalHistory, {
		relationName: "contractRenewalHistory_renewalContractId_employmentContracts_id"
	}),
	user: one(users, {
		fields: [employmentContracts.createdBy],
		references: [users.id]
	}),
	employee: one(employees, {
		fields: [employmentContracts.employeeId],
		references: [employees.id],
		relationName: "employmentContracts_employeeId_employees_id"
	}),
	employmentContract_originalContractId: one(employmentContracts, {
		fields: [employmentContracts.originalContractId],
		references: [employmentContracts.id],
		relationName: "employmentContracts_originalContractId_employmentContracts_id"
	}),
	employmentContracts_originalContractId: many(employmentContracts, {
		relationName: "employmentContracts_originalContractId_employmentContracts_id"
	}),
	employmentContract_replacesContractId: one(employmentContracts, {
		fields: [employmentContracts.replacesContractId],
		references: [employmentContracts.id],
		relationName: "employmentContracts_replacesContractId_employmentContracts_id"
	}),
	employmentContracts_replacesContractId: many(employmentContracts, {
		relationName: "employmentContracts_replacesContractId_employmentContracts_id"
	}),
	tenant: one(tenants, {
		fields: [employmentContracts.tenantId],
		references: [tenants.id]
	}),
	employees: many(employees, {
		relationName: "employees_currentContractId_employmentContracts_id"
	}),
}));

export const dailyHoursEntriesRelations = relations(dailyHoursEntries, ({one}) => ({
	user_approvedBy: one(users, {
		fields: [dailyHoursEntries.approvedBy],
		references: [users.id],
		relationName: "dailyHoursEntries_approvedBy_users_id"
	}),
	user_createdBy: one(users, {
		fields: [dailyHoursEntries.createdBy],
		references: [users.id],
		relationName: "dailyHoursEntries_createdBy_users_id"
	}),
	employee: one(employees, {
		fields: [dailyHoursEntries.employeeId],
		references: [employees.id]
	}),
	tenant: one(tenants, {
		fields: [dailyHoursEntries.tenantId],
		references: [tenants.id]
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
	location: one(locations, {
		fields: [timeEntries.locationId],
		references: [locations.id]
	}),
	tenant: one(tenants, {
		fields: [timeEntries.tenantId],
		references: [tenants.id]
	}),
}));

export const contractRenewalHistoryRelations = relations(contractRenewalHistory, ({one}) => ({
	employmentContract_originalContractId: one(employmentContracts, {
		fields: [contractRenewalHistory.originalContractId],
		references: [employmentContracts.id],
		relationName: "contractRenewalHistory_originalContractId_employmentContracts_id"
	}),
	employmentContract_renewalContractId: one(employmentContracts, {
		fields: [contractRenewalHistory.renewalContractId],
		references: [employmentContracts.id],
		relationName: "contractRenewalHistory_renewalContractId_employmentContracts_id"
	}),
	user: one(users, {
		fields: [contractRenewalHistory.renewedBy],
		references: [users.id]
	}),
}));

export const employeeDependentsRelations = relations(employeeDependents, ({one}) => ({
	employee: one(employees, {
		fields: [employeeDependents.employeeId],
		references: [employees.id]
	}),
	tenant: one(tenants, {
		fields: [employeeDependents.tenantId],
		references: [tenants.id]
	}),
}));

export const benefitPlansRelations = relations(benefitPlans, ({one, many}) => ({
	user_createdBy: one(users, {
		fields: [benefitPlans.createdBy],
		references: [users.id],
		relationName: "benefitPlans_createdBy_users_id"
	}),
	salaryComponentDefinition: one(salaryComponentDefinitions, {
		fields: [benefitPlans.linksToSalaryComponentId],
		references: [salaryComponentDefinitions.id]
	}),
	tenant: one(tenants, {
		fields: [benefitPlans.tenantId],
		references: [tenants.id]
	}),
	user_updatedBy: one(users, {
		fields: [benefitPlans.updatedBy],
		references: [users.id],
		relationName: "benefitPlans_updatedBy_users_id"
	}),
	employeeBenefitEnrollments: many(employeeBenefitEnrollments),
}));

export const employeeBenefitEnrollmentsRelations = relations(employeeBenefitEnrollments, ({one, many}) => ({
	benefitPlan: one(benefitPlans, {
		fields: [employeeBenefitEnrollments.benefitPlanId],
		references: [benefitPlans.id]
	}),
	user_createdBy: one(users, {
		fields: [employeeBenefitEnrollments.createdBy],
		references: [users.id],
		relationName: "employeeBenefitEnrollments_createdBy_users_id"
	}),
	employee: one(employees, {
		fields: [employeeBenefitEnrollments.employeeId],
		references: [employees.id]
	}),
	tenant: one(tenants, {
		fields: [employeeBenefitEnrollments.tenantId],
		references: [tenants.id]
	}),
	user_updatedBy: one(users, {
		fields: [employeeBenefitEnrollments.updatedBy],
		references: [users.id],
		relationName: "employeeBenefitEnrollments_updatedBy_users_id"
	}),
	employeeBenefitEnrollmentHistories: many(employeeBenefitEnrollmentHistory),
}));

export const employeeBenefitEnrollmentHistoryRelations = relations(employeeBenefitEnrollmentHistory, ({one}) => ({
	user: one(users, {
		fields: [employeeBenefitEnrollmentHistory.changedBy],
		references: [users.id]
	}),
	employeeBenefitEnrollment: one(employeeBenefitEnrollments, {
		fields: [employeeBenefitEnrollmentHistory.enrollmentId],
		references: [employeeBenefitEnrollments.id]
	}),
}));