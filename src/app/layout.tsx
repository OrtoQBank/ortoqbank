import './globals.css';

import { GoogleTagManager } from '@next/third-parties/google';
import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import NextTopLoader from 'nextjs-toploader';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

import ErrorBoundary from '@/components/error-boundary';
import { PostHogProvider } from '@/components/PostHogProvider';
import { ErrorLogger } from '@/components/providers/error-logger';
import { Toaster } from '@/components/ui/toaster';

import ConvexClientProvider from './convex-client-provider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const sifonn = localFont({
  src: './fonts/sifonn-pro.otf',
  variable: '--font-sifonn',
});

export const metadata: Metadata = {
  title: 'OrtoQBank - Preparação para TEOT | Banco de Questões de Ortopedia',
  description:
    'OrtoQBank - Preparatório para o TEOT l Curso TEOT. 1° lugar TEOT. Conheça nossa plataforma e garanta sua aprovação na prova da SBOT! Feito por especialistas da USP.',
  keywords:
    'TEOT, ortopedia, questões, simulados, preparação, residência médica, ortopedista',
  authors: [{ name: 'OrtoQBank' }],
  openGraph: {
    title: 'OrtoQBank - Preparação para TEOT',
    description:
      'OrtoQBank - Preparatório para o TEOT l Curso TEOT. 1° lugar TEOT. Conheça nossa plataforma e garanta sua aprovação na prova da SBOT! Feito por especialistas da USP.',
    type: 'website',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OrtoQBank - Preparação para TEOT',
    description:
      'OrtoQBank - Preparatório para o TEOT l Curso TEOT. 1° lugar TEOT. Conheça nossa plataforma e garanta sua aprovação na prova da SBOT! Feito por especialistas da USP.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  return (
    <html lang="pt-BR">
      {gtmId && <GoogleTagManager gtmId={gtmId} />}
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${sifonn.variable} antialiased`}
      >
        <ErrorLogger />
        <ErrorBoundary>
          <PostHogProvider>
            <ConvexClientProvider>
              <NuqsAdapter>
                <NextTopLoader />
                {children}
                <Analytics />
                <Toaster />
              </NuqsAdapter>
            </ConvexClientProvider>
          </PostHogProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
