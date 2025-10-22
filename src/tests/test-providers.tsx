/**
 * Test Providers
 *
 * This file provides mock providers for testing React components that depend on
 * external services like Convex, Clerk, etc.
 */

import React, { ReactNode } from 'react';

/**
 * Mock Convex Provider
 *
 * Wraps components with a mock Convex client context.
 * Use this when testing components that use Convex hooks.
 */
export function MockConvexProvider({ children }: { children: ReactNode }) {
  // In a real implementation, you might use ConvexProvider with a mock client
  // For now, we just pass through children
  return <>{children}</>;
}

/**
 * Mock Clerk Provider
 *
 * Wraps components with a mock Clerk authentication context.
 * Use this when testing components that use Clerk hooks like useUser.
 */
export function MockClerkProvider({
  children,
  mockUser = { id: 'test-user', emailAddresses: [{ emailAddress: 'test@example.com' }] },
  isSignedIn = true,
  isLoaded = true,
}: {
  children: ReactNode;
  mockUser?: any;
  isSignedIn?: boolean;
  isLoaded?: boolean;
}) {
  // In a real implementation, you might use ClerkProvider with mock values
  // For now, we just pass through children
  // The actual mocking is done via vi.mock() in individual test files
  return <>{children}</>;
}

/**
 * Combined Test Providers
 *
 * Wraps components with all necessary providers for testing.
 * This is the recommended way to render components in tests.
 */
export function AllTestProviders({
  children,
  convexOptions = {},
  clerkOptions = {},
}: {
  children: ReactNode;
  convexOptions?: any;
  clerkOptions?: any;
}) {
  return (
    <MockConvexProvider {...convexOptions}>
      <MockClerkProvider {...clerkOptions}>{children}</MockClerkProvider>
    </MockConvexProvider>
  );
}

/**
 * Mock Router Context
 *
 * Provides a mock Next.js router for testing components that use useRouter.
 */
export function MockRouterProvider({ children }: { children: ReactNode }) {
  // Router is typically mocked via vi.mock('next/navigation')
  // This is just a placeholder for future enhancements
  return <>{children}</>;
}
