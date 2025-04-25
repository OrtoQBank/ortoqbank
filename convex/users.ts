import { UserJSON } from '@clerk/backend';
import { v, type Validator } from 'convex/values';

import {
  internalMutation,
  internalQuery,
  query,
  type QueryCtx as QueryContext,
} from './_generated/server';

export const current = query({
  args: {},
  handler: async context => {
    return await getCurrentUser(context);
  },
});

export const getUserByClerkId = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return await userByClerkUserId(ctx, args.clerkUserId);
  },
});

export const upsertFromClerk = internalMutation({
  args: {
    data: v.any(),
  }, // no runtime validation, trust Clerk
  async handler(context, { data }) {
    // Extract any payment data from Clerk's public metadata
    const publicMetadata = data.public_metadata || {};
    const isPaidFromClerk = publicMetadata.paid === true;

    // Get existing user to preserve payment data if it exists
    const existingUser = await userByClerkUserId(context, data.id);

    // Base user data to update or insert
    const userData = {
      firstName: data.first_name || undefined,
      lastName: data.last_name || undefined,
      email: data.email_addresses?.[0]?.email_address,
      clerkUserId: data.id,
      imageUrl: data.image_url,
    };

    if (existingUser !== null) {
      // Update existing user, preserving payment data if it exists
      // and not overriding with new payment data from Clerk
      const paymentData = isPaidFromClerk
        ? {
            paid: true,
            paymentId: publicMetadata.paymentId,
            testeId: publicMetadata.testeId,
            paymentDate: publicMetadata.paymentDate,
            paymentStatus: publicMetadata.paymentStatus,
          }
        : {
            // Keep existing payment data if it exists
            paid: existingUser.paid,
            paymentId: existingUser.paymentId,
            testeId: existingUser.testeId,
            paymentDate: existingUser.paymentDate,
            paymentStatus: existingUser.paymentStatus,
          };

      return await context.db.patch(existingUser._id, {
        ...userData,
        ...paymentData,
      });
    }

    // Create new user with payment data if it exists in Clerk
    if (isPaidFromClerk) {
      return await context.db.insert('users', {
        ...userData,
        paid: true,
        paymentId: publicMetadata.paymentId,
        testeId: publicMetadata.testeId,
        paymentDate: publicMetadata.paymentDate,
        paymentStatus: publicMetadata.paymentStatus,
      });
    }

    // Create new user without payment data
    return await context.db.insert('users', userData);
  },
});

export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  async handler(context, { clerkUserId }) {
    const user = await userByClerkUserId(context, clerkUserId);

    if (user === null) {
      console.warn(
        `Can't delete user, there is none for Clerk user ID: ${clerkUserId}`,
      );
    } else {
      await context.db.delete(user._id);
    }
  },
});

export async function getCurrentUserOrThrow(context: QueryContext) {
  const userRecord = await getCurrentUser(context);
  if (!userRecord) throw new Error("Can't get current user");
  return userRecord;
}

export async function getCurrentUser(context: QueryContext) {
  const identity = await context.auth.getUserIdentity();
  if (identity === null) {
    return;
  }
  return await userByClerkUserId(context, identity.subject);
}

async function userByClerkUserId(context: QueryContext, clerkUserId: string) {
  return await context.db
    .query('users')
    .withIndex('by_clerkUserId', q => q.eq('clerkUserId', clerkUserId))
    .unique();
}

// Add this function to check if a user has paid access
export const checkUserPaid = query({
  args: {},
  returns: v.boolean(),
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    const user = await userByClerkUserId(ctx, identity.subject);
    if (!user) {
      return false;
    }

    return user.paid === true;
  },
});

// You can also add this function to get user payment details
export const getUserPaymentDetails = query({
  args: {},
  returns: v.object({
    paid: v.optional(v.boolean()),
    paymentId: v.optional(v.string()),
    testeId: v.optional(v.string()),
    paymentDate: v.optional(v.string()),
    paymentStatus: v.optional(v.string()),
  }),
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { paid: false };
    }

    const user = await userByClerkUserId(ctx, identity.subject);
    if (!user) {
      return { paid: false };
    }

    return {
      paid: user.paid,
      paymentId: user.paymentId,
      testeId: user.testeId,
      paymentDate: user.paymentDate,
      paymentStatus: user.paymentStatus,
    };
  },
});
