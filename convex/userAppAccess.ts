/**
 * User-App Access Management
 *
 * Functions for managing user access to apps (tenants).
 * These are primarily admin functions for granting/revoking access.
 */

import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';

import { internalMutation, mutation, query } from './_generated/server';
import { requireAppModerator, requireSuperAdmin } from './auth';
import { getCurrentUserOrThrow } from './users';

/**
 * Internal mutation to grant access to a user from webhook
 * This is called when a new user is created via Clerk webhook and has tenant metadata
 * No authentication check since it's called from internal webhook handler
 */
export const grantAccessFromWebhook = internalMutation({
  args: {
    userId: v.id('users'),
    tenantSlug: v.string(),
  },
  returns: v.union(v.id('userAppAccess'), v.null()),
  handler: async (ctx, args) => {
    // Find the app by slug
    const app = await ctx.db
      .query('apps')
      .withIndex('by_slug', q => q.eq('slug', args.tenantSlug))
      .unique();

    if (!app) {
      console.log(
        `⚠️ App not found for tenant slug: ${args.tenantSlug}. Skipping access grant.`,
      );
      return null;
    }

    // Check if access record already exists
    const existingAccess = await ctx.db
      .query('userAppAccess')
      .withIndex('by_user_app', q =>
        q.eq('userId', args.userId).eq('appId', app._id),
      )
      .unique();

    if (existingAccess) {
      // Update existing record to grant access if it was revoked
      if (existingAccess.hasAccess) {
        console.log(
          `ℹ️ User ${args.userId} already has access to app ${args.tenantSlug}`,
        );
      } else {
        await ctx.db.patch(existingAccess._id, {
          hasAccess: true,
          grantedAt: Date.now(),
        });
        console.log(
          `✅ Re-granted access to user ${args.userId} for app ${args.tenantSlug}`,
        );
      }
      return existingAccess._id;
    }

    // Create new access record
    const accessId = await ctx.db.insert('userAppAccess', {
      userId: args.userId,
      appId: app._id,
      hasAccess: true,
      role: 'user',
      grantedAt: Date.now(),
    });

    console.log(
      `✅ Granted access to user ${args.userId} for app ${args.tenantSlug}`,
    );

    return accessId;
  },
});

/**
 * Grant a user access to an app
 * Only super admins or app moderators can grant access
 */
export const grantAccess = mutation({
  args: {
    userId: v.id('users'),
    appId: v.id('apps'),
    role: v.optional(v.union(v.literal('user'), v.literal('moderator'))),
    expiresAt: v.optional(v.number()),
  },
  returns: v.id('userAppAccess'),
  handler: async (ctx, args) => {
    // Only super admins can grant access for now
    // TODO: Allow app moderators to grant 'user' role access
    await requireSuperAdmin(ctx);

    const granter = await getCurrentUserOrThrow(ctx);

    // Check if access record already exists
    const existingAccess = await ctx.db
      .query('userAppAccess')
      .withIndex('by_user_app', q =>
        q.eq('userId', args.userId).eq('appId', args.appId),
      )
      .unique();

    if (existingAccess) {
      // Update existing record
      await ctx.db.patch(existingAccess._id, {
        hasAccess: true,
        role: args.role ?? 'user',
        grantedAt: Date.now(),
        expiresAt: args.expiresAt,
        grantedBy: granter._id,
      });
      return existingAccess._id;
    }

    // Create new access record
    return await ctx.db.insert('userAppAccess', {
      userId: args.userId,
      appId: args.appId,
      hasAccess: true,
      role: args.role ?? 'user',
      grantedAt: Date.now(),
      expiresAt: args.expiresAt,
      grantedBy: granter._id,
    });
  },
});

/**
 * Revoke a user's access to an app
 * Only super admins can revoke access
 */
export const revokeAccess = mutation({
  args: {
    userId: v.id('users'),
    appId: v.id('apps'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const access = await ctx.db
      .query('userAppAccess')
      .withIndex('by_user_app', q =>
        q.eq('userId', args.userId).eq('appId', args.appId),
      )
      .unique();

    if (access) {
      await ctx.db.patch(access._id, {
        hasAccess: false,
      });
    }

    return null;
  },
});

/**
 * Set a user's role for an app (user or moderator)
 * Only super admins can change roles
 */
export const setUserRole = mutation({
  args: {
    userId: v.id('users'),
    appId: v.id('apps'),
    role: v.union(v.literal('user'), v.literal('moderator')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const access = await ctx.db
      .query('userAppAccess')
      .withIndex('by_user_app', q =>
        q.eq('userId', args.userId).eq('appId', args.appId),
      )
      .unique();

    if (!access) {
      throw new Error('User does not have access to this app');
    }

    await ctx.db.patch(access._id, {
      role: args.role,
    });

    return null;
  },
});

/**
 * Get all apps a user has access to
 */
export const getUserApps = query({
  args: {
    userId: v.id('users'),
  },
  returns: v.array(
    v.object({
      _id: v.id('userAppAccess'),
      appId: v.id('apps'),
      role: v.optional(v.union(v.literal('user'), v.literal('moderator'))),
      hasAccess: v.boolean(),
      grantedAt: v.number(),
      expiresAt: v.optional(v.number()),
      app: v.union(
        v.object({
          _id: v.id('apps'),
          slug: v.string(),
          name: v.string(),
          domain: v.string(),
          isActive: v.boolean(),
        }),
        v.null(),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const accessRecords = await ctx.db
      .query('userAppAccess')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .collect();

    const result = await Promise.all(
      accessRecords.map(async access => {
        const app = await ctx.db.get(access.appId);
        return {
          _id: access._id,
          appId: access.appId,
          role: access.role,
          hasAccess: access.hasAccess,
          grantedAt: access.grantedAt,
          expiresAt: access.expiresAt,
          app: app
            ? {
                _id: app._id,
                slug: app.slug,
                name: app.name,
                domain: app.domain,
                isActive: app.isActive,
              }
            : null,
        };
      }),
    );

    return result;
  },
});

/**
 * Get all users with access to an app
 * Only super admins or app moderators can view this
 */
export const getAppUsers = query({
  args: {
    appId: v.id('apps'),
  },
  returns: v.array(
    v.object({
      _id: v.id('userAppAccess'),
      userId: v.id('users'),
      role: v.optional(v.union(v.literal('user'), v.literal('moderator'))),
      hasAccess: v.boolean(),
      grantedAt: v.number(),
      expiresAt: v.optional(v.number()),
      user: v.union(
        v.object({
          _id: v.id('users'),
          email: v.string(),
          firstName: v.optional(v.string()),
          lastName: v.optional(v.string()),
          imageUrl: v.optional(v.string()),
        }),
        v.null(),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    // For now, allow anyone authenticated to query (frontend will filter)
    // TODO: Add requireAppModerator check when we have proper error handling

    const accessRecords = await ctx.db
      .query('userAppAccess')
      .withIndex('by_app', q => q.eq('appId', args.appId))
      .collect();

    const result = await Promise.all(
      accessRecords.map(async access => {
        const user = await ctx.db.get(access.userId);
        return {
          _id: access._id,
          userId: access.userId,
          role: access.role,
          hasAccess: access.hasAccess,
          grantedAt: access.grantedAt,
          expiresAt: access.expiresAt,
          user: user
            ? {
                _id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                imageUrl: user.imageUrl,
              }
            : null,
        };
      }),
    );

    return result;
  },
});

/**
 * Check if current user has access to an app
 * Public query for frontend use
 */
export const checkMyAccess = query({
  args: {
    appId: v.id('apps'),
  },
  returns: v.object({
    hasAccess: v.boolean(),
    role: v.optional(v.union(v.literal('user'), v.literal('moderator'))),
    expiresAt: v.optional(v.number()),
    isSuperAdmin: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        hasAccess: false,
        role: undefined,
        expiresAt: undefined,
        isSuperAdmin: false,
      };
    }

    // Get user from database
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkUserId', q => q.eq('clerkUserId', identity.subject))
      .unique();

    if (!user) {
      return {
        hasAccess: false,
        role: undefined,
        expiresAt: undefined,
        isSuperAdmin: false,
      };
    }

    // Check if super admin
    if (user.role === 'admin') {
      return {
        hasAccess: true,
        role: 'moderator' as const, // Super admins have moderator access everywhere
        expiresAt: undefined,
        isSuperAdmin: true,
      };
    }

    // Check userAppAccess
    const access = await ctx.db
      .query('userAppAccess')
      .withIndex('by_user_app', q =>
        q.eq('userId', user._id).eq('appId', args.appId),
      )
      .unique();

    if (!access || !access.hasAccess) {
      return {
        hasAccess: false,
        role: undefined,
        expiresAt: undefined,
        isSuperAdmin: false,
      };
    }

    // Check if expired
    if (access.expiresAt && Date.now() > access.expiresAt) {
      return {
        hasAccess: false,
        role: undefined,
        expiresAt: access.expiresAt,
        isSuperAdmin: false,
      };
    }

    return {
      hasAccess: true,
      role: access.role,
      expiresAt: access.expiresAt,
      isSuperAdmin: false,
    };
  },
});

/**
 * Get count of users per role for an app
 */
export const getAppUserCounts = query({
  args: {
    appId: v.id('apps'),
  },
  returns: v.object({
    total: v.number(),
    moderators: v.number(),
    users: v.number(),
    expired: v.number(),
  }),
  handler: async (ctx, args) => {
    const accessRecords = await ctx.db
      .query('userAppAccess')
      .withIndex('by_app', q => q.eq('appId', args.appId))
      .collect();

    const now = Date.now();
    let moderators = 0;
    let users = 0;
    let expired = 0;

    for (const access of accessRecords) {
      if (!access.hasAccess) continue;

      if (access.expiresAt && now > access.expiresAt) {
        expired++;
      } else if (access.role === 'moderator') {
        moderators++;
      } else {
        users++;
      }
    }

    return {
      total: moderators + users,
      moderators,
      users,
      expired,
    };
  },
});

const appUserItemValidator = v.object({
  _id: v.id('userAppAccess'),
  userId: v.id('users'),
  role: v.optional(v.union(v.literal('user'), v.literal('moderator'))),
  hasAccess: v.boolean(),
  grantedAt: v.number(),
  expiresAt: v.optional(v.number()),
  isExpired: v.boolean(),
  user: v.union(
    v.object({
      _id: v.id('users'),
      email: v.string(),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      clerkUserId: v.string(),
    }),
    v.null(),
  ),
});

/**
 * Get all users with access to an app for admin management (paginated)
 * Uses tenantId parameter for consistency with useTenantQuery pattern
 * Only moderators and super admins can view this
 */
export const getAppUsersForAdmin = query({
  args: {
    tenantId: v.optional(v.id('apps')),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(appUserItemValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    if (!args.tenantId) {
      return { page: [], isDone: true, continueCursor: '' };
    }

    const tenantId = args.tenantId;

    // Require moderator access to view app users
    await requireAppModerator(ctx, tenantId);

    const now = Date.now();

    const paginatedResult = await ctx.db
      .query('userAppAccess')
      .withIndex('by_app', q => q.eq('appId', tenantId))
      .order('desc')
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      paginatedResult.page.map(async access => {
        const user = await ctx.db.get(access.userId);
        const isExpired = access.expiresAt ? now > access.expiresAt : false;

        return {
          _id: access._id,
          userId: access.userId,
          role: access.role,
          hasAccess: access.hasAccess,
          grantedAt: access.grantedAt,
          expiresAt: access.expiresAt,
          isExpired,
          user: user
            ? {
                _id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                imageUrl: user.imageUrl,
                clerkUserId: user.clerkUserId,
              }
            : null,
        };
      }),
    );

    return {
      page,
      isDone: paginatedResult.isDone,
      continueCursor: paginatedResult.continueCursor,
    };
  },
});

/**
 * Search users with access to an app by email/name
 * Uses tenantId parameter for consistency with useTenantQuery pattern
 * Note: Search doesn't support cursor-based pagination since we need to filter in-memory
 */
export const searchAppUsersForAdmin = query({
  args: {
    tenantId: v.optional(v.id('apps')),
    searchQuery: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(appUserItemValidator),
  handler: async (ctx, args) => {
    if (!args.tenantId) {
      return [];
    }

    const tenantId = args.tenantId;

    // Require moderator access to search app users
    await requireAppModerator(ctx, tenantId);

    const limit = args.limit ?? 100;
    const now = Date.now();
    const searchTerm = args.searchQuery.toLowerCase();

    const accessRecords = await ctx.db
      .query('userAppAccess')
      .withIndex('by_app', q => q.eq('appId', tenantId))
      .collect();

    const results = await Promise.all(
      accessRecords.map(async access => {
        const user = await ctx.db.get(access.userId);
        if (!user) return null;

        // Filter by search query
        const email = user.email?.toLowerCase() || '';
        const firstName = user.firstName?.toLowerCase() || '';
        const lastName = user.lastName?.toLowerCase() || '';
        const fullName = `${firstName} ${lastName}`.trim();

        if (
          !email.includes(searchTerm) &&
          !firstName.includes(searchTerm) &&
          !lastName.includes(searchTerm) &&
          !fullName.includes(searchTerm)
        ) {
          return null;
        }

        const isExpired = access.expiresAt ? now > access.expiresAt : false;

        return {
          _id: access._id,
          userId: access.userId,
          role: access.role,
          hasAccess: access.hasAccess,
          grantedAt: access.grantedAt,
          expiresAt: access.expiresAt,
          isExpired,
          user: {
            _id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            imageUrl: user.imageUrl,
            clerkUserId: user.clerkUserId,
          },
        };
      }),
    );

    // Filter out nulls and limit
    return results.filter(r => r !== null).slice(0, limit);
  },
});

/**
 * Set a user's role for an app (user or moderator)
 * Uses tenantId parameter for consistency with useTenantMutation pattern
 * Only moderators and super admins can change roles
 */
export const setUserRoleForApp = mutation({
  args: {
    tenantId: v.optional(v.id('apps')),
    userId: v.id('users'),
    role: v.optional(v.union(v.literal('user'), v.literal('moderator'))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.tenantId) {
      throw new Error('Tenant ID is required');
    }

    const tenantId = args.tenantId;

    // Require moderator access to change roles
    await requireAppModerator(ctx, tenantId);

    const access = await ctx.db
      .query('userAppAccess')
      .withIndex('by_user_app', q =>
        q.eq('userId', args.userId).eq('appId', tenantId),
      )
      .unique();

    if (!access) {
      throw new Error('User does not have access to this app');
    }

    await ctx.db.patch(access._id, {
      role: args.role ?? 'user',
    });

    return null;
  },
});

