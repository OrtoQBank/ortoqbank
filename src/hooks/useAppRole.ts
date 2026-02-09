'use client';

import { useQuery } from 'convex/react';

import { useTenant } from '@/components/providers/TenantProvider';

import { api } from '../../convex/_generated/api';

type AppRole = 'admin' | 'moderator' | 'user' | null;

interface AppRoleResult {
  /** True if user has global admin role (users.role === 'admin') */
  isAdmin: boolean;
  /** True if user is admin OR tenant-level moderator (editor) */
  isEditor: boolean;
  /** The resolved role for the current tenant: admin > moderator > user > null */
  userRole: AppRole;
  /** Whether role data is still loading */
  isLoading: boolean;
}

/**
 * Hook for RBAC / permission checks.
 *
 * Combines:
 * - Global role from users.role (admin or not)
 * - Tenant-scoped role from userAppAccess (moderator/user) resolved via URL slug
 *
 * Usage:
 * ```tsx
 * const { isAdmin, isEditor, userRole, isLoading } = useAppRole();
 * ```
 */
export function useAppRole(): AppRoleResult {
  const { slug } = useTenant();

  // Global role: only 'admin' or null
  const globalRole = useQuery(api.users.getCurrentUserRole);

  // Tenant-scoped role: 'admin' | 'moderator' | 'user' | null
  const tenantRole = useQuery(api.auth.getCurrentUserAppRoleBySlug, { slug });

  const isAdmin = globalRole === 'admin';
  const userRole: AppRole = isAdmin ? 'admin' : (tenantRole ?? null);
  const isEditor = isAdmin || userRole === 'moderator';
  const isLoading = globalRole === undefined || tenantRole === undefined;

  return { isAdmin, isEditor, userRole, isLoading };
}
