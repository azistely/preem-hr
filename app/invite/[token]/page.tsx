/**
 * Invitation Acceptance Page
 *
 * Public page for accepting team invitations.
 *
 * Flow:
 * 1. Validate token and show invitation details
 * 2. If user exists: Login then accept
 * 3. If new user: Create account then accept
 *
 * Design principles:
 * - Mobile-first (works on 5" phones)
 * - Large touch targets (min 44px)
 * - Clear messages in French
 * - Loading states for all actions
 */

import { InviteAcceptForm } from './invite-accept-form';

interface PageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function InviteAcceptPage({ params }: PageProps) {
  const resolvedParams = await params;
  const { token } = resolvedParams;

  return (
    <div className="min-h-screen bg-gradient-to-br from-preem-teal-50 via-white to-preem-navy-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <InviteAcceptForm token={token} />
      </div>
    </div>
  );
}
