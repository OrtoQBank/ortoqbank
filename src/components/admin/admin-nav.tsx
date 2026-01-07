'use client';

import {
  AlertTriangle,
  CogIcon,
  DollarSign,
  FilePlusIcon,
  FolderCogIcon,
  Home,
  SettingsIcon,
  Shield,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useSession } from '@/components/providers/SessionProvider';
import { HoverPrefetchLink } from '@/components/ui/hover-prefetch-link';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
  prefetch?: boolean;
  useHoverPrefetch?: boolean;
  superAdminOnly?: boolean;
};

// Items accessible by all admins (moderators + super admins)
const commonNavItems: NavItem[] = [
  {
    href: '/admin',
    label: 'Hub',
    icon: Home,
    exact: true,
    prefetch: true,
    useHoverPrefetch: false,
  },
  {
    href: '/admin/criar-questao',
    label: 'Criar Questão',
    icon: FilePlusIcon,
    prefetch: false,
    useHoverPrefetch: true,
  },
  {
    href: '/admin/gerenciar-questoes',
    label: 'Gerenciar Questões',
    icon: FolderCogIcon,
    prefetch: true,
    useHoverPrefetch: false,
  },
  {
    href: '/admin/gerenciar-temas',
    label: 'Gerenciar Temas',
    icon: FolderCogIcon,
    prefetch: true,
    useHoverPrefetch: false,
  },
  {
    href: '/admin/gerenciar-trilhas',
    label: 'Trilhas e Simulados',
    icon: SettingsIcon,
    prefetch: true,
    useHoverPrefetch: false,
  },
  {
    href: '/admin/reports',
    label: 'Relatórios',
    icon: AlertTriangle,
    prefetch: false,
    useHoverPrefetch: true,
  },
];

// Items only accessible by super admins
const superAdminNavItems: NavItem[] = [
  {
    href: '/admin/superadmin',
    label: 'Super Admin',
    icon: Shield,
    prefetch: false,
    useHoverPrefetch: true,
    superAdminOnly: true,
  },
  {
    href: '/admin/coupons',
    label: 'Cupons',
    icon: CogIcon,
    prefetch: false,
    useHoverPrefetch: true,
    superAdminOnly: true,
  },
  {
    href: '/admin/pricingPlans',
    label: 'Planos de Preços',
    icon: DollarSign,
    prefetch: false,
    useHoverPrefetch: true,
    superAdminOnly: true,
  },
  {
    href: '/admin/waitlist',
    label: 'Lista de Espera',
    icon: Users,
    prefetch: false,
    useHoverPrefetch: true,
    superAdminOnly: true,
  },
];

interface AdminNavProps {
  className?: string;
}

export function AdminNav({ className }: AdminNavProps) {
  const pathname = usePathname();
  const { isAdmin } = useSession();

  // Combine nav items based on user role
  const navItems = isAdmin
    ? [...commonNavItems, ...superAdminNavItems]
    : commonNavItems;

  const isActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  return (
    <nav className={cn('bg-card rounded-lg border p-1', className)}>
      <ul className="flex flex-wrap items-center gap-1">
        {navItems.map(item => {
          const linkClasses = cn(
            'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            isActive(item)
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            item.superAdminOnly && 'border-amber-200 dark:border-amber-800',
          );

          const linkContent = (
            <>
              <item.icon size={16} />
              {item.label}
            </>
          );

          return (
            <li key={item.href}>
              {item.useHoverPrefetch ? (
                <HoverPrefetchLink href={item.href} className={linkClasses}>
                  {linkContent}
                </HoverPrefetchLink>
              ) : (
                <Link
                  href={item.href}
                  prefetch={item.prefetch}
                  className={linkClasses}
                >
                  {linkContent}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
