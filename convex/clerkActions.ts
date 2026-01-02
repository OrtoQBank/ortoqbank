"use node";

import { v } from "convex/values";

import { action } from "./_generated/server";

/**
 * Check if a Clerk user exists by email
 */
export const checkClerkUserExists = action({
  args: { email: v.string() },
  returns: v.union(
    v.object({
      id: v.string(),
      emailAddresses: v.array(v.any()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args): Promise<{
    id: string;
    emailAddresses: any[];
    firstName?: string;
    lastName?: string;
  } | null> => {
    try {
      const { clerkClient } = await import('@clerk/nextjs/server');
      const clerk = await clerkClient();
      const users = await clerk.users.getUserList({
        emailAddress: [args.email],
      });
      
      const user = users.data.length > 0 ? users.data[0] : null;
      if (!user) return null;
      
      return {
        id: user.id,
        emailAddresses: user.emailAddresses,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
      };
    } catch (error) {
      console.error('Error checking Clerk user:', error);
      return null;
    }
  },
});

/**
 * Create a Clerk invitation
 */
export const createClerkInvitation = action({
  args: {
    emailAddress: v.string(),
    publicMetadata: v.any(),
    redirectUrl: v.string(),
  },
  returns: v.object({
    id: v.string(),
    emailAddress: v.string(),
    status: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const { clerkClient } = await import('@clerk/nextjs/server');
      const clerk = await clerkClient();
      return await clerk.invitations.createInvitation(args);
    } catch (error) {
      console.error('Error creating Clerk invitation:', error);
      throw error;
    }
  },
});

/**
 * Update Clerk user metadata
 */
export const updateClerkUserMetadata = action({
  args: {
    userId: v.string(),
    metadata: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const { clerkClient } = await import('@clerk/nextjs/server');
      const clerk = await clerkClient();
      await clerk.users.updateUser(args.userId, {
        publicMetadata: args.metadata,
      });
      return null;
    } catch (error) {
      console.error('Error updating Clerk user metadata:', error);
      throw error;
    }
  },
});
