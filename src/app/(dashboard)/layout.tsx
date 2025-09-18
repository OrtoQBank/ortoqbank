import { MobileBottomNav } from '@/components/nav/mobile-bottom-nav';
import { SessionProvider } from '@/components/providers/SessionProvider';
import { TermsProvider } from '@/components/providers/TermsProvider';
import { AppSidebar } from '@/components/sidebar/app-sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <SessionProvider>
        {/* Sidebar visible only on md and larger screens */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        
        <main className="w-full bg-gradient-to-b from-slate-50 via-blue-50 to-indigo-100 min-h-screen">
          {/* Sidebar trigger visible only on md and larger screens */}
          <div className="hidden md:block">
            <SidebarTrigger />
          </div>
          
          {/* Add padding-bottom for mobile nav, remove for desktop */}
          <div className="mx-auto max-w-5xl px-2 pb-20 pt-4 md:px-6 md:py-6">
            <TermsProvider>{children}</TermsProvider>
          </div>
        </main>
        
        {/* Mobile bottom nav visible only on screens smaller than md */}
        <MobileBottomNav />
      </SessionProvider>
    </SidebarProvider>
  );
}
