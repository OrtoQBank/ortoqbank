import { v } from 'convex/values';

import { mutation } from './_generated/server';

export const createWaitlistEntry = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    whatsapp: v.string(),
    instagram: v.optional(v.string()),
    residencyLevel: v.union(
      v.literal("R1"),
      v.literal("R2"),
      v.literal("R3"),
      v.literal("Já concluí")
    ),
    subspecialty: v.union(
      v.literal("Pediátrica"),
      v.literal("Tumor"),
      v.literal("Quadril"),
      v.literal("Joelho"),
      v.literal("Ombro e Cotovelo"),
      v.literal("Mão"),
      v.literal("Coluna"),
      v.literal("Pé e Tornozelo")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check if email already exists
    const existingEntry = await ctx.db
      .query('waitlist')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first();

    if (existingEntry) {
      throw new Error('Este e-mail já está cadastrado na lista de espera.');
    }

    // Create the waitlist entry
    await ctx.db.insert('waitlist', {
      name: args.name,
      email: args.email,
      whatsapp: args.whatsapp,
      instagram: args.instagram,
      residencyLevel: args.residencyLevel,
      subspecialty: args.subspecialty,
    });

    return null;
  },
});

