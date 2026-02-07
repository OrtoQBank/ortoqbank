'use client';

import {
  AlertTriangle,
  CogIcon,
  DollarSign,
  FilePlusIcon,
  FolderCogIcon,
  SettingsIcon,
  Shield,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import { useSession } from '@/components/providers/SessionProvider';

const commonCards = [
  {
    href: '/admin/criar-questao',
    label: 'Criar Questão',
    description: 'Adicionar novas questões ao banco',
    icon: FilePlusIcon,
  },
  {
    href: '/admin/gerenciar-questoes',
    label: 'Gerenciar Questões',
    description: 'Editar, revisar e organizar questões',
    icon: FolderCogIcon,
  },
  {
    href: '/admin/gerenciar-temas',
    label: 'Gerenciar Temas',
    description: 'Organizar temas, subtemas e grupos',
    icon: FolderCogIcon,
  },
  {
    href: '/admin/gerenciar-trilhas',
    label: 'Trilhas e Simulados',
    description: 'Configurar trilhas e simulados predefinidos',
    icon: SettingsIcon,
  },
  {
    href: '/admin/reports',
    label: 'Relatórios',
    description: 'Visualizar relatórios e métricas',
    icon: AlertTriangle,
  },
];

const superAdminCards = [
  {
    href: '/admin/superadmin',
    label: 'Super Admin',
    description: 'Gerenciar usuários e permissões globais',
    icon: Shield,
  },
  {
    href: '/admin/coupons',
    label: 'Cupons',
    description: 'Criar e gerenciar cupons de desconto',
    icon: CogIcon,
  },
  {
    href: '/admin/pricingPlans',
    label: 'Planos de Preços',
    description: 'Configurar planos e preços',
    icon: DollarSign,
  },
  {
    href: '/admin/waitlist',
    label: 'Lista de Espera',
    description: 'Gerenciar lista de espera de usuários',
    icon: Users,
  },
];

export default function AdminPage() {
  const { isAdmin } = useSession();

  const cards = isAdmin ? [...commonCards, ...superAdminCards] : commonCards;

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Selecione uma das opções abaixo para gerenciar o sistema.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(card => (
          <Link
            key={card.href}
            href={card.href}
            className="bg-card hover:border-primary/40 group rounded-lg border p-5 transition-colors hover:shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary rounded-md p-2">
                <card.icon size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="group-hover:text-primary text-sm font-semibold transition-colors">
                  {card.label}
                </h3>
                <p className="text-muted-foreground mt-1 text-xs">
                  {card.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
