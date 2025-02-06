import {
  BadgePlusIcon,
  BookOpenIcon,
  FileClockIcon,
  FileTextIcon,
  HeadsetIcon,
  type LucideIcon,
  PenSquareIcon,
  SettingsIcon,
  UserCircleIcon,
} from 'lucide-react';
import Link from 'next/link';

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '../ui/sidebar';

interface MenuItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

const items: MenuItem[] = [
  {
    title: 'Criar Questão',
    url: '/criar-questao',
    icon: BadgePlusIcon,
  },
  {
    title: 'Gerenciar Questões',
    url: '/gerenciar-questoes',
    icon: SettingsIcon,
  },
  {
    title: 'Criar Tema',
    url: '/criar-tema',
    icon: BadgePlusIcon,
  },

  {
    title: 'Gerenciar Temas',
    url: '/gerenciar-temas',
    icon: SettingsIcon,
  },
];

export default function NavAdmin() {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Admin</SidebarGroupLabel>
      <SidebarMenu>
        {items.map(item => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild>
              <Link href={item.url} className="flex items-center gap-3 py-5">
                <item.icon className="size-5" />
                <span className="text-xs">{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
