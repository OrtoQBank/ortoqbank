import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { internalMutation } from './_generated/server';
import type { MutationCtx } from './_generated/server';

// ──────────────────────────────────────────────────────
// Provisioning from Ortoclub Hub
// ──────────────────────────────────────────────────────

/**
 * Receive a provisioning request from the ortoclub central hub.
 * Creates a provisionedAccess record and grants access immediately
 * if the user already exists, otherwise waits for Clerk signup.
 */
export const provisionAccessFromHub = internalMutation({
  args: {
    email: v.string(),
    clerkUserId: v.optional(v.string()),
    productName: v.string(),
    orderId: v.string(),
    purchasePrice: v.number(),
    accessExpiresAt: v.optional(v.number()),
    couponUsed: v.optional(v.string()),
    discountAmount: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Idempotency: skip if this order was already provisioned
    const existing = await ctx.db
      .query('provisionedAccess')
      .withIndex('by_sourceOrderId', q =>
        q.eq('sourceOrderId', args.orderId),
      )
      .unique();

    if (existing) {
      console.log(
        `Provision request already exists for order ${args.orderId}, skipping`,
      );
      return null;
    }

    // Insert provisioned access record
    const provisionId = await ctx.db.insert('provisionedAccess', {
      email: args.email,
      productName: args.productName,
      sourceOrderId: args.orderId,
      purchasePrice: args.purchasePrice,
      accessExpiresAt: args.accessExpiresAt,
      status: 'pending_user',
      provisionedAt: Date.now(),
    });

    console.log(
      `Created provisionedAccess ${provisionId} for ${args.email} (order: ${args.orderId})`,
    );

    // Try to find existing user by email
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q: any) => q.eq('email', args.email))
      .unique();

    if (user) {
      console.log(
        `User ${user._id} already exists for ${args.email}, granting access immediately`,
      );
      await activateAccess(ctx, provisionId, user._id, args.accessExpiresAt);
    } else {
      console.log(
        `User not found for ${args.email}, access will be granted on signup`,
      );
    }

    return null;
  },
});

/**
 * Activate pending provisioned access for a user who just signed up.
 * Called from the Clerk webhook handler after user creation.
 */
export const activatePendingAccess = internalMutation({
  args: {
    email: v.string(),
    userId: v.id('users'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Find all pending provisions for this email
    const pendingRecords = await ctx.db
      .query('provisionedAccess')
      .withIndex('by_email', (q: any) => q.eq('email', args.email))
      .collect();

    const pending = pendingRecords.filter(
      (r: any) => r.status === 'pending_user',
    );

    if (pending.length === 0) {
      return null;
    }

    console.log(
      `Activating ${pending.length} pending provision(s) for ${args.email}`,
    );

    for (const record of pending) {
      await activateAccess(
        ctx,
        record._id,
        args.userId,
        record.accessExpiresAt,
      );
    }

    return null;
  },
});

// ──────────────────────────────────────────────────────
// Internal Helpers
// ──────────────────────────────────────────────────────

/**
 * Grant access by upserting userAppAccess and updating the provision record.
 * Resolves the primary app automatically.
 */
async function activateAccess(
  ctx: MutationCtx,
  provisionId: Id<'provisionedAccess'>,
  userId: Id<'users'>,
  accessExpiresAt?: number,
) {
  // Resolve primary app (first active app)
  const app = await ctx.db
    .query('apps')
    .withIndex('by_active', (q: any) => q.eq('isActive', true))
    .first();

  if (!app) {
    console.error('No active app found, cannot grant access');
    return;
  }

  // Upsert userAppAccess
  const existingAccess = await ctx.db
    .query('userAppAccess')
    .withIndex('by_user_app', q => q.eq('userId', userId).eq('appId', app._id))
    .unique();

  if (existingAccess) {
    const newExpiry = accessExpiresAt ?? existingAccess.expiresAt;
    const currentExpiry = existingAccess.expiresAt ?? 0;
    await ctx.db.patch(existingAccess._id, {
      hasAccess: true,
      expiresAt: newExpiry ? Math.max(currentExpiry, newExpiry) : undefined,
    });
    console.log(`Updated userAppAccess for user ${userId} to app ${app.name}`);
  } else {
    await ctx.db.insert('userAppAccess', {
      userId,
      appId: app._id,
      hasAccess: true,
      role: 'user',
      grantedAt: Date.now(),
      expiresAt: accessExpiresAt,
    });
    console.log(`Created userAppAccess for user ${userId} to app ${app.name}`);
  }

  // Set user's active year access flag
  await ctx.db.patch(userId, {
    hasActiveYearAccess: true,
  });

  // Update provision record
  await ctx.db.patch(provisionId, {
    userId,
    status: 'active' as const,
    activatedAt: Date.now(),
  });

  console.log(`Activated access for user ${userId} in app ${app.name}`);
}
