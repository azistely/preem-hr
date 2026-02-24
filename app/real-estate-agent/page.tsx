import type { Metadata } from 'next';
import { VoiceAgentLoader } from './voice-agent-loader';

export const metadata: Metadata = {
  title: 'Jamana Immobilier - Conseillère IA',
  description:
    'Parlez avec Sophie, votre conseillère immobilière IA chez Jamana Immobilier. Trouvez votre bien idéal et prenez rendez-vous.',
};

export default function RealEstateAgentPage() {
  return <VoiceAgentLoader />;
}
