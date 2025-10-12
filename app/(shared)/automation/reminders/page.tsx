/**
 * Automation Reminders Page (Task-Oriented Redirect)
 * Maps user-friendly "/automation/reminders" to "/alerts"
 * HCI Compliance: Task-oriented naming ("Rappels automatiques" instead of "Alertes")
 */

import { redirect } from 'next/navigation';

export default function AutomationRemindersPage() {
  redirect('/alerts');
}
