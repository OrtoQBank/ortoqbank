'use client';

import { SignInButton } from '@clerk/nextjs';
import Image from 'next/image';
import Link from 'next/link';

import { useTenant } from '@/components/providers/TenantProvider';
import { Button } from '@/components/ui/button';

export default function Header() {
  const { config, data } = useTenant();

  // Use logo from database if available, otherwise fall back to static config or default
  const logoSrc = data?.logoUrl || '/logo-transparente.png';

  return (
    <header
      className="sticky top-0 z-50 text-white"
      style={{ backgroundColor: config.branding.primaryColor }}
    >
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-end space-x-2">
          <Image
            src={logoSrc}
            alt={`${config.branding.name} Logo`}
            width={40}
            height={40}
            className="rounded-sm"
          />
          <span className="font-sifonn translate-y-1 text-2xl font-bold">
            {config.branding.name}
          </span>
        </Link>
        <div className="flex items-center gap-8">
          <SignInButton forceRedirectUrl="/criar-teste">
            <Button
              className="translate-y-1 rounded-full border border-white px-4 py-1.5 text-sm font-medium transition-colors hover:bg-white"
              style={
                {
                  '--hover-text-color': config.branding.primaryColor,
                } as React.CSSProperties
              }
            >
              Entrar
            </Button>
          </SignInButton>
        </div>
      </div>
    </header>
  );
}
