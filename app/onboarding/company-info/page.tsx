/**
 * Onboarding: Company Information (Redirect)
 *
 * This step has been consolidated into Q1 Step 1.
 * This page now redirects to Q1 for users who may have bookmarked the old URL.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingCompanyInfoRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to Q1 where company info is now collected
    router.replace('/onboarding/q1');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Redirection...</p>
    </div>
  );
}
