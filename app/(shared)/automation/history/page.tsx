/**
 * Automation History Page (Task-Oriented Redirect)
 * Maps user-friendly "/automation/history" to "/events"
 * HCI Compliance: Task-oriented naming ("Suivi d'activité" instead of "Événements")
 */

import { redirect } from 'next/navigation';

export default function AutomationHistoryPage() {
  redirect('/events');
}
