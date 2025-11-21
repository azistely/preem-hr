import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import { TRPCReactProvider } from '@/trpc/react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import { WhatsAppSupportButton } from '@/components/whatsapp-support-button';
import { NavigationProgressBar } from '@/components/navigation/progress-bar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PREEM HR - Gestion RH & Paie Côte d\'Ivoire',
  description: 'Système complet de gestion RH: pointage, congés, paie, déclarations CNPS/CMU/ITS pour la Côte d\'Ivoire, Sénégal, Burkina Faso',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={inter.className} suppressHydrationWarning>
        <Suspense fallback={null}>
          <NavigationProgressBar />
        </Suspense>
        <TRPCReactProvider>{children}</TRPCReactProvider>
        <Toaster />
        <SonnerToaster position="top-right" richColors />
        <WhatsAppSupportButton />
      </body>
    </html>
  );
}
