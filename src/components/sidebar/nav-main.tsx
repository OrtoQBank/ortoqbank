import {
  BookOpenIcon,
  FileTextIcon,
  type LucideIcon,
  UserCircleIcon,
} from 'lucide-react';
import Link from 'next/link';

import {
  SidebarGroup,
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
  { title: 'Meu Perfil', url: '/perfil', icon: UserCircleIcon },
  { title: 'Trilhas', url: '/trilhas', icon: BookOpenIcon },
  { title: 'Simulados', url: '/simulados', icon: FileTextIcon },
];

export default function NavMain() {
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map(item => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild>
              <Link
                href={item.url}
                className="flex items-center gap-3 py-5"
                onClick={() => setOpenMobile(false)}
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
