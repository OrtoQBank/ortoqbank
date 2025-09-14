'use client';

import {
  BarChart3,
  BookOpen,
  CogIcon,
  DollarSign,
  FilePlusIcon,
  FileQuestion,
  FolderCogIcon,
  Settings,
  SettingsIcon,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { HoverPrefetchLink } from '@/components/ui/hover-prefetch-link';
import { cn } from '@/lib/utils';

const navItems = [
  {
    href: '/admin',
    label: 'Usuários',
    icon: Users,
    exact: true,
    prefetch: true, // Main admin dashboard - prefetch immediately
    useHoverPrefetch: false,
  },
  {
    href: '/admin/criar-questao',
    label: 'Criar Questão',
    icon: FilePlusIcon,
    prefetch: false, // Use hover prefetch for content creation pages
    useHoverPrefetch: true,
  },
  {
    href: '/admin/gerenciar-questoes',
    label: 'Gerenciar Questões',
    icon: FolderCogIcon,
    prefetch: true, // Management pages - prefetch immediately
    useHoverPrefetch: false,
  },
  {
    href: '/admin/gerenciar-temas',
    label: 'Gerenciar Temas',
    icon: FolderCogIcon,
    prefetch: true, // Management pages - prefetch immediately
    useHoverPrefetch: false,
  },
  {
    href: '/admin/gerenciar-trilhas',
    label: 'Trilhas e Simulados',
    icon: SettingsIcon,
    prefetch: true, // Management pages - prefetch immediately
    useHoverPrefetch: false,
  },
  {
    href: '/admin/coupons',
    label: 'Cupons',
    icon: CogIcon,
    prefetch: false, // Use hover prefetch for less frequently used features
    useHoverPrefetch: true,
  },
  {
    href: '/admin/pricingPlans',
    label: 'Planos de Preços',
    icon: DollarSign,
    prefetch: false, // Use hover prefetch for less frequently used features
    useHoverPrefetch: true,
  },
];

interface AdminNavProps {
  className?: string;
}

export function AdminNav({ className }: AdminNavProps) {
  const pathname = usePathname();

  const isActive = (item: (typeof navItems)[0]) => {
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
