/**
 * Multi-Tenant Authorization Helpers
 *
 * This module provides authorization functions for tenant-aware access control.
 *
 * Role Hierarchy:
 * - admin (super admin): Global admin with access to ALL apps (users.role global role)
 * - moderator (per-app): Admin for specific app only (userAppAccess.role === 'moderator')
 * - user (per-app): Regular user with app access (userAppAccess.hasAccess === true)
 */

import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { MutationCtx, query, QueryCtx } from './_generated/server';
import { getCurrentUser } from './users';

/**
 * User's access record for a specific app
 */
export interface UserAppAccessRecord {
  _id: Id<'userAppAccess'>;
  userId: Id<'users'>;
  appId: Id<'apps'>;
  hasAccess: boolean;
  role?: 'user' | 'moderator';
  grantedAt: number;
  expiresAt?: number;
  grantedBy?: Id<'users'>;
}

/**
 * Check if a user is a super admin (global admin)
 */
export function isUserSuperAdmin(user: { role?: string } | null): boolean {
  return user?.role === 'admin';
}

/**
 * Get the user's app access record
 * Returns null if no access record exists
 */
export async function getUserAppAccess(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  appId: Id<'apps'>,
): Promise<UserAppAccessRecord | null> {
  const access = await ctx.db
    .query('userAppAccess')
    .withIndex('by_user_app', q => q.eq('userId', userId).eq('appId', appId))
    .unique();

  return access as UserAppAccessRecord | null;
}

/**
 * Check if access has expired
 */
function isAccessExpired(access: UserAppAccessRecord): boolean {
  if (!access.expiresAt) return false;
  return Date.now() > access.expiresAt;
}

/**
 * Require that the current user has access to the specified app.
 * Super admins automatically have access to all apps.
 *
 * @throws Error if user is not authenticated or doesn't have access
 * @returns The user's access record (or a synthetic one for super admins)
 */
export async function requireAppAccess(
  ctx: QueryCtx | MutationCtx,
  appId: Id<'apps'>,
): Promise<UserAppAccessRecord> {
  const user = await getCurrentUser(ctx);

  if (!user) {
    throw new Error('Unauthorized: Authentication required');
  }

  // Super admins have access to all apps
  if (isUserSuperAdmin(user)) {
    // Return a synthetic access record for super admins
    return {
      _id: 'super_admin' as unknown as Id<'userAppAccess'>,
      userId: user._id,
      appId,
      hasAccess: true,
      role: 'moderator', // Super admins have moderator privileges everywhere
      grantedAt: 0,
    };
  }

  // Check userAppAccess for regular users
  const access = await getUserAppAccess(ctx, user._id, appId);

  if (!access) {
    throw new Error('Unauthorized: No access to this app');
  }

  if (!access.hasAccess) {
    throw new Error('Unauthorized: Access to this app has been revoked');
  }

  if (isAccessExpired(access)) {
    throw new Error('Unauthorized: Access to this app has expired');
  }

  return access;
}

/**
 * Require that the current user is a moderator for the specified app.
 * Super admins automatically have moderator access to all apps.
 *
 * @throws Error if user is not a moderator or super admin
 */
export async function requireAppModerator(
  ctx: QueryCtx | MutationCtx,
  appId: Id<'apps'>,
): Promise<void> {
  const user = await getCurrentUser(ctx);

  if (!user) {
    throw new Error('Unauthorized: Authentication required');
  }

  // Super admins are moderators everywhere
  if (isUserSuperAdmin(user)) {
    return;
  }

  // Check userAppAccess for moderator role
  const access = await getUserAppAccess(ctx, user._id, appId);

  if (!access || !access.hasAccess) {
    throw new Error('Unauthorized: No access to this app');
  }

  if (isAccessExpired(access)) {
    throw new Error('Unauthorized: Access to this app has expired');
  }

  if (access.role !== 'moderator') {
    throw new Error('Unauthorized: Moderator access required');
  }
}

/**
 * Require that the current user is an editor for the specified app.
 * Backend role literal remains `moderator` for compatibility.
 */
export async function requireAppEditor(
  ctx: QueryCtx | MutationCtx,
  appId: Id<'apps'>,
): Promise<void> {
  return requireAppModerator(ctx, appId);
}

/**
 * Require that the current user is either a super admin OR a moderator for the specified app.
 * This is an alias for requireAppModerator since the logic is the same.
 *
 * @throws Error if user is not a moderator or super admin
 */
export async function requireAdminOrModerator(
  ctx: QueryCtx | MutationCtx,
  appId: Id<'apps'>,
): Promise<void> {
  return requireAppModerator(ctx, appId);
}

/**
 * Require super admin access (global admin).
 * Use this for operations that should only be performed by super admins,
 * like creating new apps or managing global settings.
 *
 * @throws Error if user is not a super admin
 */
export async function requireSuperAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<void> {
  const user = await getCurrentUser(ctx);

  if (!user) {
    throw new Error('Unauthorized: Authentication required');
  }

  if (!isUserSuperAdmin(user)) {
    throw new Error('Unauthorized: Super admin access required');
  }
}

/**
 * Check if the current user has access to an app (without throwing)
 * Returns access details or null if no access
 */
export async function checkAppAccess(
  ctx: QueryCtx | MutationCtx,
  appId: Id<'apps'>,
): Promise<{
  hasAccess: boolean;
  isModerator: boolean;
  isSuperAdmin: boolean;
  access: UserAppAccessRecord | null;
}> {
  const user = await getCurrentUser(ctx);

  if (!user) {
    return {
      hasAccess: false,
      isModerator: false,
      isSuperAdmin: false,
      access: null,
    };
  }

  const isSuperAdmin = isUserSuperAdmin(user);

  // Super admins have full access
  if (isSuperAdmin) {
    return {
      hasAccess: true,
      isModerator: true,
      isSuperAdmin: true,
      access: null,
    };
  }

  // Check userAppAccess for regular users
  const access = await getUserAppAccess(ctx, user._id, appId);

  if (!access || !access.hasAccess || isAccessExpired(access)) {
    return {
      hasAccess: false,
      isModerator: false,
      isSuperAdmin: false,
      access: null,
    };
  }

  return {
    hasAccess: true,
    isModerator: access.role === 'moderator',
    isSuperAdmin: false,
    access,
  };
}

/**
 * Verify tenant access for queries that accept optional tenantId.
 *
 * - If tenantId is provided, verifies the user has access
 * - If tenantId is undefined, throws an error (tenantId is now required)
 *
 * @throws Error if tenantId is missing or user doesn't have access
 */
export async function verifyTenantAccess(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<'apps'> | undefined,
): Promise<void> {
  if (!tenantId) {
    throw new Error(
      'Unauthorized: tenantId is required for tenant-scoped operations',
    );
  }

  await requireAppAccess(ctx, tenantId);
}

/**
 * Query to check if current user has access to specified app
 * Used by frontend to determine what to show
 */
export const checkCurrentUserAppAccess = query({
  args: {
    appId: v.id('apps'),
  },
  returns: v.object({
    hasAccess: v.boolean(),
    isModerator: v.boolean(),
    isSuperAdmin: v.boolean(),
    expiresAt: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const result = await checkAppAccess(ctx, args.appId);

    return {
      hasAccess: result.hasAccess,
      isModerator: result.isModerator,
      isSuperAdmin: result.isSuperAdmin,
      expiresAt: result.access?.expiresAt,
    };
  },
});

/**
 * Query to get current user's role for an app
 * Returns 'admin' for super admins, 'moderator' for app moderators, 'user' for regular users, null if no access
 */
export const getCurrentUserAppRole = query({
  args: {
    appId: v.id('apps'),
  },
  returns: v.union(
    v.literal('admin'),
    v.literal('moderator'),
    v.literal('user'),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const result = await checkAppAccess(ctx, args.appId);

    if (!result.hasAccess) {
      return null;
    }

    if (result.isSuperAdmin) {
      return 'admin';
    }

    if (result.isModerator) {
      return 'moderator';
    }

    return 'user';
  },
});

/**
 * Query to get current user's role for an app by tenant slug.
 * Useful for frontend providers that resolve tenant from URL/cookie slug.
 */
export const getCurrentUserAppRoleBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.union(
    v.literal('admin'),
    v.literal('moderator'),
    v.literal('user'),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const app = await ctx.db
      .query('apps')
      .withIndex('by_slug', q => q.eq('slug', args.slug))
      .unique();

    if (!app) {
      return null;
    }

    const result = await checkAppAccess(ctx, app._id);

    if (!result.hasAccess) {
      return null;
    }

    if (result.isSuperAdmin) {
      return 'admin';
    }

    if (result.isModerator) {
      return 'moderator';
    }

    return 'user';
  },
});

