'use client';

import { SignInButton, useAuth } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { useTenant } from '@/components/providers/TenantProvider';
import { Button } from '@/components/ui/button';

export default function Header() {
  const { config, data } = useTenant();
  const { isLoaded } = useAuth();

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
          {isLoaded ? (
            <SignInButton forceRedirectUrl="/criar-teste" >
              <Button
                className="min-h-[44px] cursor-pointer rounded-full border border-white px-4 py-2 text-sm font-medium transition-colors hover:bg-white active:bg-white/90"
                style={
                  {
                    '--hover-text-color': config.branding.primaryColor,
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation',
                  } as React.CSSProperties
                }
              >
                Entrar
              </Button>
            </SignInButton>
          ) : (
            <Button
              disabled
              className="min-h-[44px] rounded-full border border-white px-4 py-2 text-sm font-medium"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              Entrar
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
