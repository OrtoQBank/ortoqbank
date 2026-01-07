/**
 * Migration: Grant existing users access to their apps
 *
 * This migration populates the userAppAccess table for existing users.
 * It grants access to the default 'ortoqbank' app for all users who have:
 * - Paid access (user.paid === true)
 * - Or are admins (user.role === 'admin')
 *
 * Run this migration once after deploying the multi-tenant authorization system.
 *
 * Usage:
 * npx convex run migrations/grantExistingUsersAppAccess:run
 */

import { v } from 'convex/values';

import { internal } from '../_generated/api';
import { internalAction, internalMutation } from '../_generated/server';

/**
 * Internal mutation to grant a single user access to an app
 */
export const _grantUserAccess = internalMutation({
  args: {
    userId: v.id('users'),
    appId: v.id('apps'),
    role: v.union(v.literal('user'), v.literal('moderator')),
  },
  returns: v.union(v.id('userAppAccess'), v.null()),
  handler: async (ctx, args) => {
    // Check if access already exists
    const existing = await ctx.db
      .query('userAppAccess')
      .withIndex('by_user_app', q =>
        q.eq('userId', args.userId).eq('appId', args.appId),
      )
      .unique();

    if (existing) {
      // Update existing record if not already active
      if (!existing.hasAccess) {
        await ctx.db.patch(existing._id, {
          hasAccess: true,
          role: args.role,
          grantedAt: Date.now(),
        });
      }
      return existing._id;
    }

    // Create new access record
    return await ctx.db.insert('userAppAccess', {
      userId: args.userId,
      appId: args.appId,
      hasAccess: true,
      role: args.role,
      grantedAt: Date.now(),
    });
  },
});

/**
 * Main migration action
 * Processes users in batches to avoid timeouts
 */
export const run = internalAction({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    granted: v.number(),
    skipped: v.number(),
    hasMore: v.boolean(),
    nextCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;

    // Get the default app (ortoqbank)
    const defaultApp = await ctx.runQuery(internal.migrations.grantExistingUsersAppAccess._getDefaultApp, {});
    if (!defaultApp) {
      throw new Error('Default app (ortoqbank) not found. Please create it first.');
    }

    // Get batch of users
    const result = await ctx.runQuery(
      internal.migrations.grantExistingUsersAppAccess._getUserBatch,
      { cursor: args.cursor, limit: batchSize },
    );

    let granted = 0;
    let skipped = 0;

    // Process each user
    for (const user of result.users) {
      // Determine role: admins become moderators, others are users
      const role = user.role === 'admin' ? 'moderator' : 'user';

      // Only grant access to paid users or admins
      if (user.paid || user.role === 'admin') {
        await ctx.runMutation(
          internal.migrations.grantExistingUsersAppAccess._grantUserAccess,
          {
            userId: user._id,
            appId: defaultApp._id,
            role,
          },
        );
        granted++;
      } else {
        skipped++;
      }
    }

    console.log(
      `Migration batch: processed=${result.users.length}, granted=${granted}, skipped=${skipped}`,
    );

    return {
      processed: result.users.length,
      granted,
      skipped,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    };
  },
});

/**
 * Helper query to get the default app
 */
export const _getDefaultApp = internalMutation({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id('apps'),
      slug: v.string(),
    }),
    v.null(),
  ),
  handler: async ctx => {
    const app = await ctx.db
      .query('apps')
      .withIndex('by_slug', q => q.eq('slug', 'ortoqbank'))
      .first();
    return app ? { _id: app._id, slug: app.slug } : null;
  },
});

/**
 * Helper query to get a batch of users
 */
export const _getUserBatch = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    limit: v.number(),
  },
  returns: v.object({
    users: v.array(
      v.object({
        _id: v.id('users'),
        paid: v.optional(v.boolean()),
        role: v.optional(v.string()),
      }),
    ),
    hasMore: v.boolean(),
    nextCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Get users, ordered by creation time for consistent pagination
    let query = ctx.db.query('users').order('asc');

    // Apply cursor if provided (skip to the cursor position)
    // Note: For simplicity, we'll use a basic approach
    const allUsers = await query.collect();

    // Find cursor index if provided
    let startIndex = 0;
    if (args.cursor) {
      const cursorIndex = allUsers.findIndex(u => u._id === args.cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    // Get batch
    const batch = allUsers.slice(startIndex, startIndex + args.limit);
    const hasMore = startIndex + args.limit < allUsers.length;
    const nextCursor = batch.length > 0 ? batch[batch.length - 1]._id : undefined;

    return {
      users: batch.map(u => ({
        _id: u._id,
        paid: u.paid,
        role: u.role,
      })),
      hasMore,
      nextCursor,
    };
  },
});

/**
 * Run the full migration (calls run repeatedly until done)
 */
export const runAll = internalAction({
  args: {},
  returns: v.object({
    totalProcessed: v.number(),
    totalGranted: v.number(),
    totalSkipped: v.number(),
  }),
  handler: async ctx => {
    let totalProcessed = 0;
    let totalGranted = 0;
    let totalSkipped = 0;
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const result = await ctx.runAction(
        internal.migrations.grantExistingUsersAppAccess.run,
        { cursor, batchSize: 100 },
      );

      totalProcessed += result.processed;
      totalGranted += result.granted;
      totalSkipped += result.skipped;
      hasMore = result.hasMore;
      cursor = result.nextCursor;
    }

    console.log(
      `Migration complete: totalProcessed=${totalProcessed}, totalGranted=${totalGranted}, totalSkipped=${totalSkipped}`,
    );

    return {
      totalProcessed,
      totalGranted,
      totalSkipped,
    };
  },
});

