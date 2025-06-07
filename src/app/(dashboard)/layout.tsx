import AccessCheck from '@/components/AccessCheck';
import { AdminClassWrapper } from '@/components/AdminClassWrapper';
import { MobileBottomNav } from '@/components/nav/mobile-bottom-nav';
import { SessionProvider } from '@/components/providers/SessionProvider';
import { TermsProvider } from '@/components/providers/TermsProvider';
import { AppSidebar } from '@/components/sidebar/app-sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { checkRole, checkTermsAccepted } from '@/utils/roles'; // Adjust path if necessary

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAdmin = await checkRole('admin');
  const termsAccepted = await checkTermsAccepted();

  return (
    <SidebarProvider>
      <SessionProvider initialData={{ isAdmin, termsAccepted }}>
        {/* Session monitoring to detect revoked sessions */}

        {/* Sidebar visible only on md and larger screens */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        <AdminClassWrapper>
          {/* Sidebar trigger visible only on md and larger screens */}
          <div className="hidden md:block">
            <SidebarTrigger />
          </div>
          {/* Add padding-bottom for mobile nav, remove for desktop */}
          <div className="mx-auto max-w-5xl px-2 pb-20 md:px-10 md:py-0">
            <AccessCheck>
              <TermsProvider>{children}</TermsProvider>
            </AccessCheck>
          </div>
        </AdminClassWrapper>
        {/* Mobile bottom nav visible only on screens smaller than md */}
        <MobileBottomNav />
      </SessionProvider>
    </SidebarProvider>
  );
}
