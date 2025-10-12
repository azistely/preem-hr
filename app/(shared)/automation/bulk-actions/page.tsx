/**
 * Automation Bulk Actions Page (Task-Oriented Redirect)
 * Maps user-friendly "/automation/bulk-actions" to "/batch-operations"
 * HCI Compliance: Task-oriented naming ("Actions groupées" instead of "Opérations groupées")
 */

import { redirect } from 'next/navigation';

export default function AutomationBulkActionsPage() {
  redirect('/batch-operations');
}
