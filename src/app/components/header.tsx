import { SignInButton } from '@clerk/nextjs';
import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-[#2096f4] text-white">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-end space-x-2">
          <Image
            src="/logo-transparente.png"
            alt="OrtoQBank Logo"
            width={40}
            height={40}
            className="rounded-sm"
          />
          <span className="font-sifonn translate-y-1 text-2xl font-bold">
            OrtoQBank
          </span>
        </Link>
        <div className="flex items-center gap-8">
          <SignInButton forceRedirectUrl="/criar-teste">
            <Button className="translate-y-1 rounded-full border border-white px-4 py-1.5 text-sm font-medium transition-colors hover:bg-white hover:text-[#2096f4]">
              Entrar
            </Button>
          </SignInButton>
        </div>
      </div>
    </header>
  );
}
