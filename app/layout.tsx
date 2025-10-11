import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { TRPCReactProvider } from '@/trpc/react';
import { Toaster } from '@/components/ui/toaster';
import { WhatsAppSupportButton } from '@/components/whatsapp-support-button';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PREEM HR - Gestion de Paie Côte d\'Ivoire',
  description: 'Système de gestion de paie pour la Côte d\'Ivoire',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={inter.className} suppressHydrationWarning>
        <TRPCReactProvider>{children}</TRPCReactProvider>
        <Toaster />
        <WhatsAppSupportButton />
      </body>
    </html>
  );
}
