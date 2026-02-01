'use client';

import { useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { MobileBottomNav } from '@/components/nav/mobile-bottom-nav';
import OnboardingOverlay from '@/components/onboarding/OnboardingOverlay';
import { SessionProvider } from '@/components/providers/SessionProvider';
import { useTenant } from '@/components/providers/TenantProvider';
import { TermsProvider } from '@/components/providers/TermsProvider';
import { AppSidebar } from '@/components/sidebar/app-sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { useCurrentUser } from '@/hooks/useCurrentUser';

import { api } from '../../../convex/_generated/api';

// TODO: TEMPORARY - Remove this after fixing auth/access issues
const SKIP_ACCESS_CHECK = true;

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasRedirected, setHasRedirected] = useState(false);
  const { isLoading, isAuthenticated, user } = useCurrentUser();
  const { tenantId, isLoading: isTenantLoading } = useTenant();

  // Query access status from Convex (not using useTenantQuery since this query
  // takes appId directly, not tenantId - and we're already passing tenantId as appId)
  const accessData = useQuery(
    api.auth.checkCurrentUserAppAccess,
    tenantId ? { appId: tenantId } : 'skip',
  );

  // Build access object compatible with the old interface
  const rawAccess = {
    hasAccess: accessData?.hasAccess ?? false,
    isModerator: accessData?.isModerator ?? false,
    isSuperAdmin: accessData?.isSuperAdmin ?? false,
    expiresAt: accessData?.expiresAt,
    isLoading: isTenantLoading || (tenantId !== null && accessData === undefined),
  };

  // TEMPORARY: Bypass access check for testing
  const access = SKIP_ACCESS_CHECK
    ? { ...rawAccess, hasAccess: true, isLoading: false }
    : rawAccess;

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

  // Redirect to homepage if user doesn't have access to this app
  useEffect(() => {
    // Only check once access data is loaded and user is authenticated
    if (
      isAuthenticated &&
      !access.isLoading &&
      !access.hasAccess &&
      !redirectInitiatedRef.current
    ) {
      redirectInitiatedRef.current = true;
      setTimeout(() => setHasRedirected(true), 0);
      router.replace('/?access=denied&reason=no_app_access');
    }
  }, [isAuthenticated, access.isLoading, access.hasAccess, router]);

  // Show loading while user or access data is being loaded
  if (isLoading || (isAuthenticated && access.isLoading)) {
    return (
      <div className="from-brand-blue/10 flex min-h-screen items-center justify-center bg-gradient-to-br to-indigo-100">
        <div className="text-center">
          <div className="border-brand-blue mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Show loading placeholder while redirecting to sign-in or access denied
  if (!isAuthenticated || hasRedirected || !access.hasAccess) {
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
