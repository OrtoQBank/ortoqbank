'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { MobileBottomNav } from '@/components/nav/mobile-bottom-nav';
import OnboardingOverlay from '@/components/onboarding/OnboardingOverlay';
import { SessionProvider } from '@/components/providers/SessionProvider';
import { TermsProvider } from '@/components/providers/TermsProvider';
import { AppSidebar } from '@/components/sidebar/app-sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { isLoading, isAuthenticated, user } = useCurrentUser();
  
  // Check if user should see onboarding (simplified without URL params)
  useEffect(() => {
    const hasCompletedOnboarding = user?.onboardingCompleted;
    let timerId: NodeJS.Timeout | undefined;
    
    // Only show onboarding if explicitly marked as false (not undefined or loading)
    if (isAuthenticated && user && hasCompletedOnboarding === false) {
      // Small delay to ensure sidebar is rendered
      timerId = setTimeout(() => setShowOnboarding(true), 500);
    } else {
      // Hide onboarding in all other cases
      setShowOnboarding(false);
    }
    
    // Cleanup: cancel pending timer when effect re-runs or component unmounts
    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [user?.onboardingCompleted, isAuthenticated]);

  // Redirect to sign-in if not authenticated using Next.js navigation
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setIsRedirecting(true);
      router.replace('/sign-in');
    }
  }, [isLoading, isAuthenticated, router]);

  // Show loading while user is being stored
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-blue/10 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Show loading placeholder while redirecting to sign-in
  if (!isAuthenticated || isRedirecting) {
    return null;
  }

  return (
    <SidebarProvider>
      <SessionProvider>
        {/* Sidebar visible only on md and larger screens */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        
        <main className="w-full bg-gradient-to-b from-slate-50 via-brand-blue/10 to-indigo-100 min-h-screen">
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
        
        {/* Onboarding overlay */}
        {showOnboarding && (
          <OnboardingOverlay onComplete={() => setShowOnboarding(false)} />
        )}
      </SessionProvider>
    </SidebarProvider>
  );
}
