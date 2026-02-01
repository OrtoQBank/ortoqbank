'use client';

import {
  AlertTriangle,
  ArrowRight,
  FilePlusIcon,
  FolderCogIcon,
  SettingsIcon,
} from 'lucide-react';
import Link from 'next/link';

import { useTenant } from '@/components/providers/TenantProvider';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const hubItems = [
  {
    href: '/admin/criar-questao',
    title: 'Criar Questão',
    description: 'Adicione novas questões ao banco de questões',
    icon: FilePlusIcon,
  },
  {
    href: '/admin/gerenciar-questoes',
    title: 'Gerenciar Questões',
    description: 'Edite, visualize e organize as questões existentes',
    icon: FolderCogIcon,
  },
  {
    href: '/admin/gerenciar-temas',
    title: 'Gerenciar Temas',
    description: 'Configure temas, subtemas e taxonomia',
    icon: FolderCogIcon,
  },
  {
    href: '/admin/gerenciar-trilhas',
    title: 'Trilhas e Simulados',
    description: 'Crie e gerencie trilhas de estudo e simulados',
    icon: SettingsIcon,
  },
  {
    href: '/admin/reports',
    title: 'Relatórios',
    description: 'Visualize relatórios e questões reportadas',
    icon: AlertTriangle,
  },
];

export default function AdminHub() {
  const { data: tenantData } = useTenant();

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-gradient-to-r from-blue-50 to-indigo-50 p-6 dark:from-blue-950/20 dark:to-indigo-950/20">
        <h2 className="text-xl font-semibold">
          Bem-vindo à Área de Administração
        </h2>
        <p className="text-muted-foreground mt-1">
          {tenantData?.name
            ? `Gerenciando: ${tenantData.name}`
            : 'Selecione uma funcionalidade abaixo para começar'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {hubItems.map(item => (
          <Link key={item.href} href={item.href} className="group">
            <Card className="h-full transition-all hover:border-primary/50 hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="bg-primary/10 text-primary rounded-lg p-2">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="text-muted-foreground h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <CardTitle className="mt-3 text-lg">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{item.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
