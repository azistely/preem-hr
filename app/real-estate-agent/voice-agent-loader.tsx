'use client';

import dynamic from 'next/dynamic';

const VoiceAgent = dynamic(
  () => import('@/components/real-estate-agent/voice-agent'),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-600 border-t-emerald-400" />
      </div>
    ),
  }
);

export function VoiceAgentLoader() {
  return <VoiceAgent />;
}
