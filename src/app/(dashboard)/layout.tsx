'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { MobileBottomNav } from '@/components/nav/mobile-bottom-nav';
import OnboardingOverlay from '@/components/onboarding/OnboardingOverlay';
import { SessionProvider } from '@/components/providers/SessionProvider';
import { TermsProvider } from '@/components/providers/TermsProvider';
import { AppSidebar } from '@/components/sidebar/app-sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasRedirected, setHasRedirected] = useState(false);
  const { isLoading, isAuthenticated, user } = useCurrentUser();

  // Track if we've already initiated redirect to prevent multiple calls
  const redirectInitiatedRef = useRef(false);

  // Check if user should see onboarding (simplified without URL params)
  useEffect(() => {
    const hasCompletedOnboarding = user?.onboardingCompleted;
    let timerId: NodeJS.Timeout | undefined;

    // Only show onboarding if explicitly marked as false (not undefined or loading)
    if (isAuthenticated && user && hasCompletedOnboarding === false) {
      // Small delay to ensure sidebar is rendered
      timerId = setTimeout(() => setShowOnboarding(true), 500);
    }
    // Note: we only set showOnboarding to true via timeout, never synchronously set to false
    // The false state is handled by the onComplete callback or initial state

    // Cleanup: cancel pending timer when effect re-runs or component unmounts
    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [user?.onboardingCompleted, isAuthenticated, user]);

  // Redirect to sign-in if not authenticated using Next.js navigation
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !redirectInitiatedRef.current) {
      redirectInitiatedRef.current = true;
      // Use setTimeout to avoid synchronous setState
      setTimeout(() => setHasRedirected(true), 0);
      router.replace('/sign-in');
    }
  }, [isLoading, isAuthenticated, router]);

  // Show loading while user is being stored
  if (isLoading) {
    return (
      <div className="from-brand-blue/10 flex min-h-screen items-center justify-center bg-gradient-to-br to-indigo-100">
        <div className="text-center">
          <div className="border-brand-blue mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Show loading placeholder while redirecting to sign-in
  if (!isAuthenticated || hasRedirected) {
    return null;
  }

  return (
    <SidebarProvider>
      <SessionProvider>
        {/* Sidebar visible only on md and larger screens */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>

        <main className="via-brand-blue/10 min-h-screen w-full bg-gradient-to-b from-slate-50 to-indigo-100">
          {/* Sidebar trigger visible only on md and larger screens */}
          <div className="hidden md:block">
            <SidebarTrigger />
          </div>

          {/* Add padding-bottom for mobile nav, remove for desktop */}
          <div className="mx-auto max-w-5xl px-2 pt-4 pb-20 md:px-6 md:py-6">
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
