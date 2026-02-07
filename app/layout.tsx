import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import { TRPCReactProvider } from '@/trpc/react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import { WhatsAppSupportButton } from '@/components/whatsapp-support-button';
import { NavigationProgressBar } from '@/components/navigation/progress-bar';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Jamana - Gestion RH & Paie Côte d\'Ivoire',
  description: 'Système complet de gestion RH: pointage, congés, paie, déclarations CNPS/CMU/ITS pour la Côte d\'Ivoire, Sénégal, Burkina Faso',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(A, opts){
                window.Sonarly = { opts: opts, queue: [] };
                var s = document.createElement('script');
                s.src = A;
                s.async = true;
                document.head.appendChild(s);
              })("https://sonarly.dev/static/tracker.js", {
                projectKey: "Hq2mG3H8rr1A3ZjT3Sak",
                ingestPoint: "https://sonarly.dev/ingest"
              });
            `,
          }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <Suspense fallback={null}>
          <NavigationProgressBar />
        </Suspense>
        <TRPCReactProvider>{children}</TRPCReactProvider>
        <Toaster />
        <SonnerToaster position="top-right" richColors />
        <WhatsAppSupportButton />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
