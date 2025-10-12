/**
 * Automation Rules Page (Task-Oriented Redirect)
 * Maps user-friendly "/automation/rules" to "/workflows"
 * HCI Compliance: Task-oriented naming ("Règles intelligentes" instead of "Workflows")
 */

import { redirect } from 'next/navigation';

export default function AutomationRulesPage() {
  redirect('/workflows');
}
