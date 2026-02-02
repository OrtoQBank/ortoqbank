import { useConvexAuth, useQuery } from 'convex/react';

import { api } from '../../convex/_generated/api';

/**
 * Hook to get the current authenticated user from Convex.
 *
 * Returns:
 * - isLoading: true while auth or user query is in progress
 * - isAuthenticated: true only when user is authenticated AND exists in Convex
 * - userNotFound: true when authenticated in Clerk but user doesn't exist in Convex DB
 * - user: the user object or null/undefined
 *
 * Query states:
 * - undefined = query still loading
 * - null = query complete, user not found in database
 * - object = query complete, user found
 */
export function useCurrentUser() {
  const { isLoading: authLoading, isAuthenticated: clerkAuthenticated } =
    useConvexAuth();
  const user = useQuery(api.users.current);

  // Query is loading if auth is loading OR if authenticated but query hasn't returned yet
  const isLoading = authLoading || (clerkAuthenticated && user === undefined);

  // User is authenticated only when Clerk says so AND user exists in Convex
  const isAuthenticated =
    clerkAuthenticated && user !== null && user !== undefined;

  // User not found: authenticated in Clerk but user doesn't exist in Convex database
  // This happens when:
  // 1. User just signed up and Clerk webhook hasn't synced yet
  // 2. User was deleted from Convex but still has Clerk session
  const userNotFound = clerkAuthenticated && !authLoading && user === null;

  return {
    isLoading,
    isAuthenticated,
    userNotFound,
    user,
  };
}
