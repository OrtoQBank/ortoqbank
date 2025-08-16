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
  prefetch?: boolean | null; // Add prefetch control
}

const items: MenuItem[] = [
  { title: 'Meu Perfil', url: '/perfil', icon: UserCircleIcon, prefetch: true },
  { title: 'Trilhas', url: '/trilhas', icon: BookOpenIcon, prefetch: true },
  { title: 'Simulados', url: '/simulados', icon: FileTextIcon, prefetch: true },
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
                prefetch={item.prefetch}
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
