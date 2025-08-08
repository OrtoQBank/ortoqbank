import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('coupons'),
      _creationTime: v.number(),
      code: v.string(),
      type: v.union(
        v.literal('percentage'),
        v.literal('fixed'),
        v.literal('fixed_price'),
      ),
      value: v.number(),
      description: v.string(),
      active: v.boolean(),
      validFrom: v.optional(v.number()),
      validUntil: v.optional(v.number()),
    }),
  ),
  handler: async ctx => {
    return await ctx.db.query('coupons').order('desc').collect();
  },
});

export const getByCode = query({
  args: { code: v.string() },
  returns: v.union(
    v.object({
      _id: v.id('coupons'),
      _creationTime: v.number(),
      code: v.string(),
      type: v.union(
        v.literal('percentage'),
        v.literal('fixed'),
        v.literal('fixed_price'),
      ),
      value: v.number(),
      description: v.string(),
      active: v.boolean(),
      validFrom: v.optional(v.number()),
      validUntil: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const code = args.code.toUpperCase();
    const byCode = await ctx.db
      .query('coupons')
      .withIndex('by_code', q => q.eq('code', code))
      .unique();
    return byCode ?? null;
  },
});

export const create = mutation({
  args: {
    code: v.string(),
    type: v.union(
      v.literal('percentage'),
      v.literal('fixed'),
      v.literal('fixed_price'),
    ),
    value: v.number(),
    description: v.string(),
    active: v.boolean(),
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),
  },
  returns: v.id('coupons'),
  handler: async (ctx, args) => {
    const code = args.code.toUpperCase();
    // Ensure uniqueness
    const existing = await ctx.db
      .query('coupons')
      .withIndex('by_code', q => q.eq('code', code))
      .unique();
    if (existing) {
      throw new Error('Coupon code already exists');
    }
    return await ctx.db.insert('coupons', { ...args, code });
  },
});

export const update = mutation({
  args: {
    id: v.id('coupons'),
    code: v.optional(v.string()),
    type: v.optional(
      v.union(
        v.literal('percentage'),
        v.literal('fixed'),
        v.literal('fixed_price'),
      ),
    ),
    value: v.optional(v.number()),
    description: v.optional(v.string()),
    active: v.optional(v.boolean()),
    validFrom: v.optional(v.union(v.number(), v.null())),
    validUntil: v.optional(v.union(v.number(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    const updates: Record<string, any> = { ...rest };
    if (updates.code) updates.code = updates.code.toUpperCase();
    // Normalize nulls to undefined to clear fields
    if (updates.validFrom === null) updates.validFrom = undefined;
    if (updates.validUntil === null) updates.validUntil = undefined;
    await ctx.db.patch(id, updates);
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id('coupons') },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return null;
  },
});
