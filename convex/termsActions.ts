'use node';

import { v } from 'convex/values';

import { api } from './_generated/api';
import { action } from './_generated/server';

export const acceptTermsInClerk = action({
  args: {},
  returns: v.null(),
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('User not authenticated');
    }

    try {
      // Import clerkClient here to avoid issues with server-side imports
      const clerkBackend = await import('@clerk/backend');
      const clerkClient = clerkBackend.createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY!,
      });

      // Update Clerk metadata to mark terms as accepted
      await clerkClient.users.updateUserMetadata(identity.subject, {
        privateMetadata: {
          termsAccepted: true,
        },
      });

      // Also update our local database
      await ctx.runMutation(api.users.setTermsAccepted, { accepted: true });

      return null;
    } catch (error) {
      console.error('Error updating terms acceptance in Clerk:', error);
      throw new Error('Failed to update terms acceptance');
    }
  },
});
