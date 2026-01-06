import { FileClockIcon, type LucideIcon, PenSquareIcon } from 'lucide-react';
import Link from 'next/link';

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '../ui/sidebar';

interface MenuItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

const items: MenuItem[] = [
  { title: 'Criar Teste', url: '/criar-teste', icon: PenSquareIcon },
  { title: 'Testes Prévios', url: '/testes-previos', icon: FileClockIcon },
];

export default function NavSecondary() {
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Personalizado</SidebarGroupLabel>
      <SidebarMenu>
        {items.map(item => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild>
              <Link
                href={item.url}
                className="flex items-center gap-3 py-5"
                onClick={() => setOpenMobile(false)}
                data-sidebar={item.url.replace('/', '')}
              >
                <item.icon className="size-5" />
                <span className="text-base">{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
