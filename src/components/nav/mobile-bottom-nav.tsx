'use client';

import { GraduationCap, LayoutGrid, Menu, Settings, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

// Define the main navigation items (excluding Home/Menu trigger)
const navItems = [
  // { href: '/', label: 'Início', icon: Home }, // Removed Home
  { href: '/trilhas', label: 'Trilhas', icon: LayoutGrid, prefetch: true },
  {
    href: '/simulados',
    label: 'Simulados',
    icon: GraduationCap,
    prefetch: true,
  },
  { href: '/perfil', label: 'Perfil', icon: User, prefetch: true },
  // Add more items if necessary
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar(); // Get the toggle function

  return (
    <div className="bg-background fixed right-0 bottom-0 left-0 z-50 flex h-16 items-center justify-around border-t md:hidden">
      {/* Sidebar Trigger Button */}
      <Button
        variant="ghost"
        className="text-muted-foreground hover:text-primary flex h-full flex-col items-center justify-center gap-1 rounded-none px-2 text-xs"
        onClick={toggleSidebar} // Use the toggle function from the context
      >
        <Menu className="h-5 w-5" />
        <span>Menu</span>
      </Button>

      {/* Mapped Navigation Items */}
      {navItems.map(item => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={item.prefetch}
            passHref
          >
            <Button
              variant="ghost"
              className={cn(
                'flex h-full flex-col items-center justify-center gap-1 rounded-none px-2 text-xs',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-primary',
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Button>
          </Link>
        );
      })}
    </div>
  );
}
