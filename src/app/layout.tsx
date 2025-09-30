import './globals.css';

import ErrorBoundary from '@/components/error-boundary';
import { PostHogProvider } from '@/components/PostHogProvider';
import { ErrorLogger } from '@/components/providers/error-logger';
import { Toaster } from '@/components/ui/toaster';
import { GoogleTagManager } from '@next/third-parties/google';
import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import Script from 'next/script';
import NextTopLoader from 'nextjs-toploader';

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
  description: 'Banco de questões de ortopedia para estudantes se prepararem para o TEOT. Trilhas de estudo, simulados completos e testes personalizados. Planos a partir de R$ 97.',
  keywords: 'TEOT, ortopedia, questões, simulados, preparação, residência médica, ortopedista',
  authors: [{ name: 'OrtoQBank' }],
  openGraph: {
    title: 'OrtoQBank - Preparação para TEOT',
    description: 'Banco de questões de ortopedia para estudantes se prepararem para o TEOT. Planos a partir de R$ 97.',
    type: 'website',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OrtoQBank - Preparação para TEOT',
    description: 'Banco de questões de ortopedia para estudantes se prepararem para o TEOT. Planos a partir de R$ 97.',
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
  return (
    <html lang="pt-BR">
      <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID!} />
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${sifonn.variable} antialiased`}
      >
        <ErrorLogger />
        <ErrorBoundary>
          <PostHogProvider>
            <ConvexClientProvider>
              <NextTopLoader />
              {children}
              <Analytics />
              <Toaster />
            </ConvexClientProvider>
          </PostHogProvider>
        </ErrorBoundary>

        {/* Facebook Pixel */}
        <Script
          id="facebook-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '1038461214913312');
              fbq('track', 'PageView');
            `,
          }}
        />
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src="https://www.facebook.com/tr?id=1038461214913312&ev=PageView&noscript=1"
            alt="Facebook Pixel"
          />
        </noscript>
      </body>
    </html>
  );
}
