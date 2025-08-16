'use client';

import {
  BarChart3,
  BookOpen,
  CogIcon,
  FilePlusIcon,
  FileQuestion,
  FolderCogIcon,
  Settings,
  SettingsIcon,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const navItems = [
  {
    href: '/admin',
    label: 'Usuários',
    icon: Users,
    exact: true,
    prefetch: true, // Main admin dashboard - prefetch immediately
  },
  {
    href: '/admin/criar-questao',
    label: 'Criar Questão',
    icon: FilePlusIcon,
    prefetch: null, // Use hover prefetch for content creation pages
  },
  {
    href: '/admin/gerenciar-questoes',
    label: 'Gerenciar Questões',
    icon: FolderCogIcon,
    prefetch: true, // Management pages - prefetch immediately
  },
  {
    href: '/admin/gerenciar-temas',
    label: 'Gerenciar Temas',
    icon: FolderCogIcon,
    prefetch: true, // Management pages - prefetch immediately
  },
  {
    href: '/admin/gerenciar-trilhas',
    label: 'Trilhas e Simulados',
    icon: SettingsIcon,
    prefetch: true, // Management pages - prefetch immediately
  },
  {
    href: '/admin/coupons',
    label: 'Cupons',
    icon: CogIcon,
    prefetch: null, // Use hover prefetch for less frequently used features
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
        {navItems.map(item => (
          <li key={item.href}>
            <Link
              href={item.href}
              prefetch={item.prefetch}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                isActive(item)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
