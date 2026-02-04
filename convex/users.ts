import { v } from 'convex/values';

import {
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
  query,
  type QueryCtx as QueryContext,
} from './_generated/server';

export const current = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id('users'),
      _creationTime: v.number(),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      email: v.string(),
      imageUrl: v.optional(v.string()),
      clerkUserId: v.string(),
      paid: v.optional(v.boolean()),
      paymentId: v.optional(v.union(v.string(), v.number())),
      testeId: v.optional(v.string()),
      paymentDate: v.optional(v.string()),
      paymentStatus: v.optional(v.string()),
      termsAccepted: v.optional(v.boolean()),
      onboardingCompleted: v.optional(v.boolean()),
      role: v.optional(v.string()),
      status: v.optional(
        v.union(
          v.literal('invited'),
          v.literal('active'),
          v.literal('suspended'),
          v.literal('expired'),
        ),
      ),
      hasActiveYearAccess: v.optional(v.boolean()),
    }),
    v.null(),
  ),
  handler: async context => {
    return await getCurrentUser(context);
  },
});

export const getUserByClerkId = internalQuery({
  args: { clerkUserId: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await userByClerkUserId(ctx, args.clerkUserId);
  },
});

export const upsertFromClerk = internalMutation({
  args: {
    data: v.any(),
  }, // no runtime validation, trust Clerk
  returns: v.union(v.id('users'), v.null()),
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
      termsAccepted: data.termsAccepted,
    };

    if (existingUser !== null) {
      // Update existing user, preserving payment data if it exists
      // and not overriding with new payment data from Clerk
      const paymentData = isPaidFromClerk
        ? {
            paid: true,
            paymentId: publicMetadata.paymentId?.toString(),

            paymentDate: publicMetadata.paymentDate,
            paymentStatus: publicMetadata.paymentStatus,
          }
        : {
            // Keep existing payment data if it exists
            paid: existingUser.paid,
            paymentId: existingUser.paymentId,
            paymentDate: existingUser.paymentDate,
            paymentStatus: existingUser.paymentStatus,
          };

      await context.db.patch(existingUser._id, {
        ...userData,
        ...paymentData,
      });
      return existingUser._id;
    }

    // Create new user with payment data if it exists in Clerk
    if (isPaidFromClerk) {
      return await context.db.insert('users', {
        ...userData,
        paid: true,
        paymentId: publicMetadata.paymentId?.toString(),

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
  returns: v.null(),
  async handler(context, { clerkUserId }) {
    const user = await userByClerkUserId(context, clerkUserId);

    if (user === null) {
      console.warn(
        `Can't delete user, there is none for Clerk user ID: ${clerkUserId}`,
      );
    } else {
      await context.db.delete(user._id);
    }
    return null;
  },
});

/**
 * Safe version - returns user or null (no throwing)
 * Use this for queries that should gracefully handle unauthenticated users
 */
export async function getCurrentUser(context: QueryContext) {
  const identity = await context.auth.getUserIdentity();
  if (identity === null) {
    console.log(
      '[DEBUG:users.getCurrentUser] No identity found (not authenticated)',
    );
    return null;
  }
  console.log(
    `[DEBUG:users.getCurrentUser] Looking up user with clerkUserId: ${identity.subject}`,
  );
  const user = await userByClerkUserId(context, identity.subject);
  if (user) {
    console.log(
      `[DEBUG:users.getCurrentUser] User FOUND - { _id: "${user._id}", email: "${user.email}" }`,
    );
  } else {
    console.log(
      `[DEBUG:users.getCurrentUser] User NOT FOUND for clerkUserId: ${identity.subject}`,
    );
  }
  return user;
}

/**
 * Protected version - throws if no user
 * Use this for mutations and queries that require authentication
 */
export async function getCurrentUserOrThrow(context: QueryContext) {
  const userRecord = await getCurrentUser(context);
  if (!userRecord) throw new Error("Can't get current user");
  return userRecord;
}

async function userByClerkUserId(context: QueryContext, clerkUserId: string) {
  return await context.db
    .query('users')
    .withIndex('by_clerkUserId', q => q.eq('clerkUserId', clerkUserId))
    .unique();
}

/**
 * Require super admin access (global admin).
 * Use this for operations that should only be performed by super admins,
 * like creating new apps or managing global settings.
 *
 * @deprecated Use requireSuperAdmin from './auth' instead for new code
 * @throws Error if user is not a super admin
 */
export async function requireAdmin(
  context: QueryContext | MutationCtx,
): Promise<void> {
  const user = await getCurrentUser(context);
  if (!user) {
    throw new Error('Unauthorized: Authentication required');
  }

  if (user.role !== 'admin') {
    throw new Error('Unauthorized: Super admin access required');
  }
}

// Função para obter o papel do usuário atual
export const getCurrentUserRole = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async ctx => {
    const user = await getCurrentUser(ctx);
    return user?.role || null;
  },
});

// Função para verificar se o usuário atual tem um papel específico
export const hasRole = query({
  args: { role: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    return user?.role === args.role;
  },
});

// Função para definir o papel de um usuário (apenas admins podem usar)
export const setUserRole = mutation({
  args: {
    userId: v.id('users'),
    role: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Verifica se o usuário atual é admin
    await requireAdmin(ctx);

    // Atualiza o papel do usuário
    await ctx.db.patch(args.userId, { role: args.role });
    return null;
  },
});

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
    paymentId: v.optional(v.union(v.string(), v.number())),
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
      paymentDate: user.paymentDate,
      paymentStatus: user.paymentStatus,
    };
  },
});

export const getTermsAccepted = query({
  args: {},
  returns: v.boolean(),
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    const user = await userByClerkUserId(ctx, identity.subject);
    return user?.termsAccepted === true;
  },
});

export const setTermsAccepted = mutation({
  args: { accepted: v.boolean() },
  returns: v.null(),
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await userByClerkUserId(ctx, identity.subject);
    if (!user) return null;
    await ctx.db.patch(user._id, { termsAccepted: args.accepted });
    return null;
  },
});

export const completeOnboarding = mutation({
  args: {},
  returns: v.null(),
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await userByClerkUserId(ctx, identity.subject);
    if (!user) return null;
    await ctx.db.patch(user._id, { onboardingCompleted: true });
    return null;
  },
});

// Query for admin to get all users with their roles (for admin interface)
export const getAllUsersForAdmin = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id('users'),
      _creationTime: v.number(),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      email: v.string(),
      imageUrl: v.optional(v.string()),
      clerkUserId: v.string(),
      paid: v.optional(v.boolean()),
      paymentId: v.optional(v.union(v.string(), v.number())),
      testeId: v.optional(v.string()),
      paymentDate: v.optional(v.string()),
      paymentStatus: v.optional(v.string()),
      termsAccepted: v.optional(v.boolean()),
      onboardingCompleted: v.optional(v.boolean()),
      role: v.optional(v.string()),
      status: v.optional(
        v.union(
          v.literal('invited'),
          v.literal('active'),
          v.literal('suspended'),
          v.literal('expired'),
        ),
      ),
      hasActiveYearAccess: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx, args) => {
    // Verify admin access
    await requireAdmin(ctx);

    const limit = args.limit || 50; // Default limit

    return await ctx.db.query('users').order('desc').take(limit);
  },
});

// Query for admin to search users by email/name with their roles
export const searchUsersForAdmin = query({
  args: {
    searchQuery: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id('users'),
      _creationTime: v.number(),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      email: v.string(),
      imageUrl: v.optional(v.string()),
      clerkUserId: v.string(),
      paid: v.optional(v.boolean()),
      paymentId: v.optional(v.union(v.string(), v.number())),
      testeId: v.optional(v.string()),
      paymentDate: v.optional(v.string()),
      paymentStatus: v.optional(v.string()),
      termsAccepted: v.optional(v.boolean()),
      onboardingCompleted: v.optional(v.boolean()),
      role: v.optional(v.string()),
      status: v.optional(
        v.union(
          v.literal('invited'),
          v.literal('active'),
          v.literal('suspended'),
          v.literal('expired'),
        ),
      ),
      hasActiveYearAccess: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx, args) => {
    // Verify admin access
    await requireAdmin(ctx);

    const limit = args.limit || 50; // Default limit
    const query = args.searchQuery.toLowerCase();

    // Get all users and filter by email/name in memory
    // For better performance, consider adding search indexes in the future
    const allUsers = await ctx.db.query('users').order('desc').collect();

    const filteredUsers = allUsers.filter(user => {
      const email = user.email?.toLowerCase() || '';
      const firstName = user.firstName?.toLowerCase() || '';
      const lastName = user.lastName?.toLowerCase() || '';
      const fullName = `${firstName} ${lastName}`.trim();

      return (
        email.includes(query) ||
        firstName.includes(query) ||
        lastName.includes(query) ||
        fullName.includes(query)
      );
    });

    return filteredUsers.slice(0, limit);
  },
});
