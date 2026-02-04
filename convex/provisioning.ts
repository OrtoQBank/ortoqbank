import { v } from 'convex/values';

import { internalMutation } from './_generated/server';

/**
 * Provision access for a user from external commerce system (ortoclub)
 * Called via HTTP endpoint from ortoclub after payment confirmed
 */
export const provisionAccess = internalMutation({
  args: {
    email: v.string(),
    clerkUserId: v.optional(v.string()),
    productName: v.string(),
    orderId: v.string(), // External order ID from ortoclub
    purchasePrice: v.number(),
    accessExpiresAt: v.optional(v.number()),
    couponUsed: v.optional(v.string()),
    discountAmount: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    userId: v.optional(v.id('users')),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    console.log(
      `🔐 Provisioning access for ${args.email}, product: ${args.productName}`,
    );

    // Find user by clerkUserId or email
    let user = args.clerkUserId
      ? await ctx.db
          .query('users')
          .withIndex('by_clerkUserId', q =>
            q.eq('clerkUserId', args.clerkUserId!),
          )
          .unique()
      : null;

    if (!user) {
      user = await ctx.db
        .query('users')
        .withIndex('by_email', q => q.eq('email', args.email))
        .unique();
    }

    if (!user) {
      // User doesn't exist yet - store pending access grant
      console.log(
        `⏳ User ${args.email} not found, storing pending access grant`,
      );

      // Check if there's already a pending access for this order
      const existingPending = await ctx.db
        .query('pendingAccessGrants')
        .withIndex('by_order_id', q => q.eq('orderId', args.orderId))
        .unique();

      if (existingPending) {
        // Update existing pending grant
        await ctx.db.patch(existingPending._id, {
          productName: args.productName,
          purchasePrice: args.purchasePrice,
          accessExpiresAt: args.accessExpiresAt,
          couponUsed: args.couponUsed,
          discountAmount: args.discountAmount,
          updatedAt: Date.now(),
        });
        console.log(
          `📝 Updated existing pending access grant for ${args.email}`,
        );
      } else {
        // Create new pending grant
        await ctx.db.insert('pendingAccessGrants', {
          email: args.email,
          productName: args.productName,
          orderId: args.orderId,
          purchasePrice: args.purchasePrice,
          accessExpiresAt: args.accessExpiresAt,
          couponUsed: args.couponUsed,
          discountAmount: args.discountAmount,
          createdAt: Date.now(),
        });
        console.log(`📝 Created pending access grant for ${args.email}`);
      }

      return {
        success: true,
        userId: undefined,
        message:
          'Pending access grant created - will be claimed when user signs up',
      };
    }

    // User exists - grant access immediately
    console.log(`✅ User found: ${user._id}, granting access`);

    // Get the app for this deployment (ortoqbank)
    const app = await ctx.db
      .query('apps')
      .withIndex('by_slug', q => q.eq('slug', 'ortoqbank'))
      .unique();

    if (!app) {
      console.error('❌ App "ortoqbank" not found in apps table');
      return {
        success: false,
        userId: user._id,
        message: 'App configuration not found',
      };
    }

    // Check existing access
    const existingAccess = await ctx.db
      .query('userAppAccess')
      .withIndex('by_user_app', q =>
        q.eq('userId', user._id).eq('appId', app._id),
      )
      .unique();

    const now = Date.now();

    if (existingAccess) {
      // Update/extend access
      const newExpiresAt = args.accessExpiresAt
        ? Math.max(args.accessExpiresAt, existingAccess.expiresAt || 0)
        : existingAccess.expiresAt;

      await ctx.db.patch(existingAccess._id, {
        hasAccess: true,
        expiresAt: newExpiresAt,
        grantedAt: now,
      });
      console.log(`📝 Updated userAppAccess for user ${user._id}`);
    } else {
      // Create new access
      await ctx.db.insert('userAppAccess', {
        userId: user._id,
        appId: app._id,
        hasAccess: true,
        role: 'user',
        grantedAt: now,
        expiresAt: args.accessExpiresAt,
      });
      console.log(`✅ Created userAppAccess for user ${user._id}`);
    }

    // Update user's active year access flag
    await ctx.db.patch(user._id, {
      hasActiveYearAccess: true,
    });

    console.log(`✅ Access granted for ${args.email} (user: ${user._id})`);

    return {
      success: true,
      userId: user._id,
      message: 'Access granted successfully',
    };
  },
});

/**
 * Claim pending access grants when a new user signs up
 * Called from Clerk webhook handler when user is created
 */
export const claimPendingGrants = internalMutation({
  args: {
    email: v.string(),
    clerkUserId: v.string(),
  },
  returns: v.object({
    claimedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    console.log(`🔍 Checking for pending access grants for ${args.email}`);

    // Find all pending grants for this email
    const pendingGrants = await ctx.db
      .query('pendingAccessGrants')
      .withIndex('by_email', q => q.eq('email', args.email))
      .collect();

    // Filter out already claimed grants
    const unclaimedGrants = pendingGrants.filter(g => !g.claimedAt);

    if (unclaimedGrants.length === 0) {
      console.log(`ℹ️ No pending access grants found for ${args.email}`);
      return { claimedCount: 0 };
    }

    console.log(
      `📦 Found ${unclaimedGrants.length} pending grant(s) for ${args.email}`,
    );

    // Find the user
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkUserId', q => q.eq('clerkUserId', args.clerkUserId))
      .unique();

    if (!user) {
      console.error(`❌ User not found for clerkUserId: ${args.clerkUserId}`);
      return { claimedCount: 0 };
    }

    // Get the app
    const app = await ctx.db
      .query('apps')
      .withIndex('by_slug', q => q.eq('slug', 'ortoqbank'))
      .unique();

    if (!app) {
      console.error('❌ App "ortoqbank" not found');
      return { claimedCount: 0 };
    }

    const now = Date.now();
    let latestExpiresAt: number | undefined;

    // Process each pending grant
    for (const grant of unclaimedGrants) {
      // Mark as claimed
      await ctx.db.patch(grant._id, {
        claimedAt: now,
        claimedByUserId: user._id,
      });

      // Track the latest expiration
      if (grant.accessExpiresAt) {
        latestExpiresAt = latestExpiresAt
          ? Math.max(latestExpiresAt, grant.accessExpiresAt)
          : grant.accessExpiresAt;
      }

      console.log(
        `✅ Claimed pending grant: ${grant.productName} for ${args.email}`,
      );
    }

    // Grant app access
    const existingAccess = await ctx.db
      .query('userAppAccess')
      .withIndex('by_user_app', q =>
        q.eq('userId', user._id).eq('appId', app._id),
      )
      .unique();

    if (existingAccess) {
      const newExpiresAt = latestExpiresAt
        ? Math.max(latestExpiresAt, existingAccess.expiresAt || 0)
        : existingAccess.expiresAt;

      await ctx.db.patch(existingAccess._id, {
        hasAccess: true,
        expiresAt: newExpiresAt,
        grantedAt: now,
      });
    } else {
      await ctx.db.insert('userAppAccess', {
        userId: user._id,
        appId: app._id,
        hasAccess: true,
        role: 'user',
        grantedAt: now,
        expiresAt: latestExpiresAt,
      });
    }

    // Update user's active year access flag
    await ctx.db.patch(user._id, {
      hasActiveYearAccess: true,
    });

    console.log(
      `✅ Claimed ${unclaimedGrants.length} pending grant(s) for ${args.email}`,
    );

    return { claimedCount: unclaimedGrants.length };
  },
});
