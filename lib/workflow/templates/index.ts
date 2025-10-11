/**
 * Workflow Templates Registry
 *
 * All production-ready workflow templates
 */

import { monthlyPayrollTemplate } from './monthly-payroll';
import { leaveApprovalTemplate } from './leave-approval';
import { contractRenewalTemplate } from './contract-renewal';
import { salaryIncreaseTemplate } from './salary-increase';
import { documentExpiryReminderTemplate } from './document-expiry-reminder';
import { performanceReviewTemplate } from './performance-review';
import { newHireWelcomeTemplate } from './new-hire-welcome';
import { emergencyContactUpdateTemplate } from './emergency-contact-update';

// Import existing templates
import { onboardingChecklistTemplate } from './onboarding-checklist';
import { offboardingChecklistTemplate } from './offboarding-checklist';

export const workflowTemplates = {
  // Payroll & Compensation
  'monthly-payroll': monthlyPayrollTemplate,
  'salary-increase': salaryIncreaseTemplate,

  // Time & Leave
  'leave-approval': leaveApprovalTemplate,

  // Contracts
  'contract-renewal': contractRenewalTemplate,

  // Onboarding & Offboarding
  'onboarding-checklist': onboardingChecklistTemplate,
  'offboarding-checklist': offboardingChecklistTemplate,
  'new-hire-welcome': newHireWelcomeTemplate,

  // Performance
  'performance-review': performanceReviewTemplate,

  // Compliance
  'document-expiry-reminder': documentExpiryReminderTemplate,
  'emergency-contact-update': emergencyContactUpdateTemplate,
};

export const workflowTemplateCategories = {
  payroll: ['monthly-payroll'],
  time_off: ['leave-approval'],
  contracts: ['contract-renewal'],
  onboarding: ['onboarding-checklist', 'new-hire-welcome'],
  offboarding: ['offboarding-checklist'],
  compensation: ['salary-increase'],
  performance: ['performance-review'],
  compliance: ['document-expiry-reminder', 'emergency-contact-update'],
};

export type WorkflowTemplateKey = keyof typeof workflowTemplates;
export type WorkflowTemplateCategoryKey = keyof typeof workflowTemplateCategories;
