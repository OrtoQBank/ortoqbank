import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('coupons'),
      _creationTime: v.number(),
      // Multi-tenancy
      tenantId: v.optional(v.id('apps')),
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
      maxUses: v.optional(v.number()),
      maxUsesPerUser: v.optional(v.number()),
      currentUses: v.optional(v.number()),
      minimumPrice: v.optional(v.number()),
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
      // Multi-tenancy
      tenantId: v.optional(v.id('apps')),
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
      maxUses: v.optional(v.number()),
      maxUsesPerUser: v.optional(v.number()),
      currentUses: v.optional(v.number()),
      minimumPrice: v.optional(v.number()),
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

    // Get default tenant for multi-tenancy
    const defaultApp = await ctx.db
      .query('apps')
      .withIndex('by_slug', (q) => q.eq('slug', 'ortoqbank'))
      .first();

    return await ctx.db.insert('coupons', { ...args, code, tenantId: defaultApp?._id });
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

/**
 * Validate and apply coupon to a price
 * Returns the final price after applying coupon discount
 * Note: This is for UI preview only. Server must re-validate on order creation.
 */
export const validateAndApplyCoupon = query({
  args: {
    code: v.string(),
    originalPrice: v.number(),
    userCpf: v.optional(v.string()), // For checking per-user limits
  },
  returns: v.union(
    v.object({
      isValid: v.boolean(),
      finalPrice: v.number(),
      discountAmount: v.number(),
      couponDescription: v.string(),
      coupon: v.object({
        _id: v.id('coupons'),
        code: v.string(),
        type: v.union(
          v.literal('percentage'),
          v.literal('fixed'),
          v.literal('fixed_price'),
        ),
        value: v.number(),
        description: v.string(),
      }),
    }),
    v.object({
      isValid: v.boolean(),
      errorMessage: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const code = args.code.toUpperCase().trim();
    
    if (!code) {
      return {
        isValid: false,
        errorMessage: 'Código de cupom inválido',
      };
    }

    // Find the coupon
    const coupon = await ctx.db
      .query('coupons')
      .withIndex('by_code', q => q.eq('code', code))
      .unique();

    if (!coupon) {
      return {
        isValid: false,
        errorMessage: 'Cupom não encontrado',
      };
    }

    // Check if coupon is active
    if (!coupon.active) {
      return {
        isValid: false,
        errorMessage: 'Cupom inativo',
      };
    }

    // Check if coupon is within valid date range
    const now = Date.now();
    if (coupon.validFrom !== undefined && now < coupon.validFrom) {
      return {
        isValid: false,
        errorMessage: 'Cupom ainda não está válido',
      };
    }
    if (coupon.validUntil !== undefined && now > coupon.validUntil) {
      return {
        isValid: false,
        errorMessage: 'Cupom expirado',
      };
    }

    // Track usage limits for analytics (but don't block)
    // Log usage stats for monitoring
    if (coupon.maxUses !== undefined) {
      const currentUses = coupon.currentUses || 0;
      console.log(`Coupon ${code} usage: ${currentUses}/${coupon.maxUses} (tracking only)`);
    }

    // Track per-user usage for analytics (but don't block)
    if (coupon.maxUsesPerUser !== undefined && args.userCpf) {
      const cleanCpf = args.userCpf.replaceAll(/\D/g, '');
      const userUsageCount = await ctx.db
        .query('couponUsage')
        .withIndex('by_coupon_user', q => 
          q.eq('couponCode', code).eq('userCpf', cleanCpf)
        )
        .collect();
      
      console.log(`Coupon ${code} user usage (CPF: ${cleanCpf}): ${userUsageCount.length}/${coupon.maxUsesPerUser} (tracking only)`);
    }

    // Calculate discount
    let finalPrice: number;

    if (coupon.type === 'fixed_price') {
      finalPrice = coupon.value;
    } else if (coupon.type === 'percentage') {
      const discountAmount = (args.originalPrice * coupon.value) / 100;
      finalPrice = args.originalPrice - discountAmount;
    } else {
      // fixed discount
      finalPrice = args.originalPrice - coupon.value;
    }

    // Apply minimum price protection if it benefits the customer
    if (coupon.minimumPrice !== undefined && finalPrice < coupon.minimumPrice) {
      finalPrice = coupon.minimumPrice;
    }

    // Clamp finalPrice to valid range [0, originalPrice]
    // This prevents negative prices and prices exceeding the original
    finalPrice = Math.max(0, Math.min(finalPrice, args.originalPrice));

    // Derive discount amount from clamped final price
    let discountAmount = args.originalPrice - finalPrice;

    // Ensure discount is within valid bounds
    discountAmount = Math.max(0, Math.min(discountAmount, args.originalPrice));

    return {
      isValid: true,
      finalPrice: Math.round(finalPrice * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      couponDescription: coupon.description,
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        description: coupon.description,
      },
    };
  },
});
