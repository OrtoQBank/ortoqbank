import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { requireAppModerator } from './auth';

export const createWaitlistEntry = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    whatsapp: v.string(),
    instagram: v.optional(v.string()),
    residencyLevel: v.union(
      v.literal('R1'),
      v.literal('R2'),
      v.literal('R3'),
      v.literal('Já concluí'),
    ),
    subspecialty: v.union(
      v.literal('Pediátrica'),
      v.literal('Tumor'),
      v.literal('Quadril'),
      v.literal('Joelho'),
      v.literal('Ombro e Cotovelo'),
      v.literal('Mão'),
      v.literal('Coluna'),
      v.literal('Pé e Tornozelo'),
    ),
  },
  returns: v.union(v.id('waitlist'), v.literal('email_already_exists')),
  handler: async (ctx, args) => {
    // Check if email already exists
    const existingEntry = await ctx.db
      .query('waitlist')
      .withIndex('by_email', q => q.eq('email', args.email))
      .first();

    if (existingEntry) {
      return 'email_already_exists';
    }

    // Get default tenant for multi-tenancy
    const defaultApp = await ctx.db
      .query('apps')
      .withIndex('by_slug', q => q.eq('slug', 'ortoqbank'))
      .first();

    // Create the waitlist entry
    const entryId = await ctx.db.insert('waitlist', {
      name: args.name,
      email: args.email,
      whatsapp: args.whatsapp,
      instagram: args.instagram,
      residencyLevel: args.residencyLevel,
      subspecialty: args.subspecialty,
      // Multi-tenancy
      tenantId: defaultApp?._id,
    });

    return entryId;
  },
});

export const list = query({
  args: { tenantId: v.optional(v.id('apps')) },
  returns: v.array(
    v.object({
      _id: v.id('waitlist'),
      _creationTime: v.number(),
      // Multi-tenancy
      tenantId: v.optional(v.id('apps')),
      name: v.string(),
      email: v.string(),
      whatsapp: v.string(),
      instagram: v.optional(v.string()),
      residencyLevel: v.union(
        v.literal('R1'),
        v.literal('R2'),
        v.literal('R3'),
        v.literal('Já concluí'),
      ),
      subspecialty: v.union(
        v.literal('Pediátrica'),
        v.literal('Tumor'),
        v.literal('Quadril'),
        v.literal('Joelho'),
        v.literal('Ombro e Cotovelo'),
        v.literal('Mão'),
        v.literal('Coluna'),
        v.literal('Pé e Tornozelo'),
      ),
    }),
  ),
  handler: async (ctx, { tenantId }) => {
    // Require moderator access to list waitlist entries
    if (tenantId) {
      await requireAppModerator(ctx, tenantId);
      return await ctx.db
        .query('waitlist')
        .withIndex('by_tenant', q => q.eq('tenantId', tenantId))
        .collect();
    }
    // If no tenantId provided, return empty - should always filter by tenant
    return [];
  },
});
