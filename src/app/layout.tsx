import './globals.css';

import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import NextTopLoader from 'nextjs-toploader';

import { PostHogProvider } from '@/components/PostHogProvider';
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
  title: 'OrtoQBank',
  description: 'Banco de questões de ortopedia para estudantes',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${sifonn.variable} antialiased`}
      >
        <PostHogProvider>
          <ConvexClientProvider>
            <NextTopLoader />
            {children}
            <Analytics />
            <Toaster />
          </ConvexClientProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
