'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';

import NavAdmin from './nav-admin';
import NavFooter from './nav-footer';
import NavLogo from './nav-logo';
import NavMain from './nav-main';
import NavSecondary from './nav-secondary';
import NavThird from './nav-third';
import NavUser from './nav-user';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <NavLogo />
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
        <NavSecondary />
        <NavThird />
      </SidebarContent>
      <SidebarFooter>
        <NavAdmin />
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
