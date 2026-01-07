import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { requireAdmin } from './users';

/**
 * App/Tenant validators for reuse
 */
const appValidator = v.object({
  _id: v.id('apps'),
  _creationTime: v.number(),
  slug: v.string(),
  name: v.string(),
  domain: v.string(),
  description: v.optional(v.string()),
  logoUrl: v.optional(v.string()),
  isActive: v.boolean(),
  createdAt: v.number(),
});

/**
 * Get an app by its slug (used for subdomain routing).
 * This is the primary method for tenant detection.
 */
export const getAppBySlug = query({
  args: { slug: v.string() },
  returns: v.union(appValidator, v.null()),
  handler: async (ctx, args) => {
    const app = await ctx.db
      .query('apps')
      .withIndex('by_slug', q => q.eq('slug', args.slug))
      .first();

    return app;
  },
});

/**
 * Get an app by its domain (for production domain matching).
 */
export const getAppByDomain = query({
  args: { domain: v.string() },
  returns: v.union(appValidator, v.null()),
  handler: async (ctx, args) => {
    const app = await ctx.db
      .query('apps')
      .withIndex('by_domain', q => q.eq('domain', args.domain))
      .first();

    return app;
  },
});

/**
 * Get an app by its ID.
 */
export const getAppById = query({
  args: { appId: v.id('apps') },
  returns: v.union(appValidator, v.null()),
  handler: async (ctx, args) => {
    const app = await ctx.db.get(args.appId);
    return app;
  },
});

/**
 * List all active apps.
 * Admin-only function for management purposes.
 */
export const listActiveApps = query({
  args: {},
  returns: v.array(appValidator),
  handler: async ctx => {
    await requireAdmin(ctx);

    const apps = await ctx.db
      .query('apps')
      .withIndex('by_active', q => q.eq('isActive', true))
      .collect();

    return apps;
  },
});

/**
 * List all apps (active and inactive).
 * Admin-only function for management purposes.
 */
export const listAllApps = query({
  args: {},
  returns: v.array(appValidator),
  handler: async ctx => {
    await requireAdmin(ctx);

    const apps = await ctx.db.query('apps').order('desc').collect();

    return apps;
  },
});

/**
 * Create a new app/tenant.
 * Admin-only mutation.
 */
export const createApp = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    domain: v.string(),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  returns: v.id('apps'),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Check if slug already exists
    const existingBySlug = await ctx.db
      .query('apps')
      .withIndex('by_slug', q => q.eq('slug', args.slug))
      .first();

    if (existingBySlug) {
      throw new Error(`App with slug "${args.slug}" already exists`);
    }

    // Check if domain already exists
    const existingByDomain = await ctx.db
      .query('apps')
      .withIndex('by_domain', q => q.eq('domain', args.domain))
      .first();

    if (existingByDomain) {
      throw new Error(`App with domain "${args.domain}" already exists`);
    }

    const appId = await ctx.db.insert('apps', {
      slug: args.slug,
      name: args.name,
      domain: args.domain,
      description: args.description,
      logoUrl: args.logoUrl,
      isActive: args.isActive ?? true,
      createdAt: Date.now(),
    });

    return appId;
  },
});

/**
 * Update an existing app/tenant.
 * Admin-only mutation.
 */
export const updateApp = mutation({
  args: {
    appId: v.id('apps'),
    name: v.optional(v.string()),
    domain: v.optional(v.string()),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const existingApp = await ctx.db.get(args.appId);
    if (!existingApp) {
      throw new Error('App not found');
    }

    // If domain is being changed, check for conflicts
    if (args.domain && args.domain !== existingApp.domain) {
      const newDomain = args.domain;
      const existingByDomain = await ctx.db
        .query('apps')
        .withIndex('by_domain', q => q.eq('domain', newDomain))
        .first();

      if (existingByDomain) {
        throw new Error(`App with domain "${newDomain}" already exists`);
      }
    }

    const updates: Partial<{
      name: string;
      domain: string;
      description: string;
      logoUrl: string;
      isActive: boolean;
    }> = {};

    if (args.name !== undefined) updates.name = args.name;
    if (args.domain !== undefined) updates.domain = args.domain;
    if (args.description !== undefined) updates.description = args.description;
    if (args.logoUrl !== undefined) updates.logoUrl = args.logoUrl;
    if (args.isActive !== undefined) updates.isActive = args.isActive;

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.appId, updates);
    }

    return null;
  },
});

/**
 * Get the default app (ortoqbank).
 * Utility function for cases where no tenant is specified.
 */
export const getDefaultApp = query({
  args: {},
  returns: v.union(appValidator, v.null()),
  handler: async ctx => {
    const app = await ctx.db
      .query('apps')
      .withIndex('by_slug', q => q.eq('slug', 'ortoqbank'))
      .first();

    return app;
  },
});

