import { v } from 'convex/values';

import { Doc } from './_generated/dataModel';
import { mutation } from './_generated/server';
import { getCurrentUser } from './users';

export const acceptTermsInClerk = mutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    const user: Doc<'users'> | null | undefined = await getCurrentUser(ctx);

    if (!user) return null;

    await ctx.db.patch(user?._id, { termsAccepted: true });
  },
});
