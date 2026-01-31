/**
 * Tenant Access Control Helpers
 *
 * Simplified wrappers around the core auth functions for common tenant access patterns.
 * Use these in protected Convex functions that require tenant authorization.
 *
 * Usage:
 * ```typescript
 * import { requireTenantAccess, requireTenantModerator } from './lib/accessControl';
 *
 * export const protectedMutation = mutation({
 *   args: { tenantId: v.id('apps'), ... },
 *   handler: async (ctx, args) => {
 *     const { user, access } = await requireTenantAccess(ctx, args.tenantId);
 *     // user is authenticated and has access to this tenant
 *   },
 * });
 * ```
 */

import type { Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import {
  checkAppAccess,
  requireAppAccess,
  requireAppModerator,
  requireSuperAdmin,
  type UserAppAccessRecord,
} from '../auth';
import { getCurrentUserOrThrow } from '../users';

/**
 * Result of a tenant access check
 */
export interface TenantAccessResult {
  /** The authenticated user */
  user: {
    _id: Id<'users'>;
    email: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  };
  /** The user's access record (null for super admins) */
  access: UserAppAccessRecord | null;
  /** Whether the user is a super admin */
  isSuperAdmin: boolean;
  /** Whether the user is a moderator for this tenant */
  isModerator: boolean;
}

/**
 * Require that the current user has access to the specified tenant.
 * Use this in mutations/queries that need tenant-level authorization.
 *
 * @throws Error if user is not authenticated or doesn't have access
 * @returns User and access information
 */
export async function requireTenantAccess(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<'apps'>,
): Promise<TenantAccessResult> {
  // This will throw if no access
  const accessRecord = await requireAppAccess(ctx, tenantId);
  const user = await getCurrentUserOrThrow(ctx);

  const isSuperAdmin = user.role === 'admin';

  return {
    user: {
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
    access: isSuperAdmin ? null : accessRecord,
    isSuperAdmin,
    isModerator: isSuperAdmin || accessRecord.role === 'moderator',
  };
}

/**
 * Require that the current user is a moderator for the specified tenant.
 * Use this in mutations/queries that need moderator-level authorization.
 *
 * @throws Error if user is not a moderator or super admin
 * @returns User information
 */
export async function requireTenantModerator(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<'apps'>,
): Promise<{ user: TenantAccessResult['user'] }> {
  // This will throw if not moderator
  await requireAppModerator(ctx, tenantId);
  const user = await getCurrentUserOrThrow(ctx);

  return {
    user: {
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
  };
}

/**
 * Check tenant access without throwing.
 * Use this when you need to conditionally handle access (e.g., show different UI).
 *
 * @returns Access check result with hasAccess boolean
 */
export async function checkTenantAccess(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<'apps'>,
): Promise<{
  hasAccess: boolean;
  isModerator: boolean;
  isSuperAdmin: boolean;
  access: UserAppAccessRecord | null;
}> {
  return checkAppAccess(ctx, tenantId);
}

/**
 * Require tenant access with optional tenantId.
 * Use during migration when tenantId is still optional in some functions.
 *
 * - If tenantId is provided, verifies access and returns user info
 * - If tenantId is undefined, just returns user info (backward compatibility)
 *
 * @throws Error if user is not authenticated or (when tenantId provided) doesn't have access
 */
export async function requireTenantAccessOptional(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<'apps'> | undefined,
): Promise<TenantAccessResult | { user: TenantAccessResult['user'] }> {
  const user = await getCurrentUserOrThrow(ctx);

  if (!tenantId) {
    // Backward compatibility: just return user without access check
    return {
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  return requireTenantAccess(ctx, tenantId);
}

// Re-export core functions for convenience
export { requireSuperAdmin };
