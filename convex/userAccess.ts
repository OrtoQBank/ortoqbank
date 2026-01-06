import { v } from 'convex/values';

import { query } from './_generated/server';

/**
 * Get comprehensive user access information
 */
export const getUserAccess = query({
  args: { userId: v.id('users') },
  returns: v.object({
    hasAnyAccess: v.boolean(),
    products: v.array(
      v.object({
        productId: v.string(),
        productName: v.string(),
        category: v.optional(v.string()),
        year: v.optional(v.number()),
        hasAccess: v.boolean(),
        accessExpiresAt: v.optional(v.number()),
        status: v.string(),
        isExpired: v.boolean(),
        daysUntilExpiration: v.optional(v.number()),
      }),
    ),
    activeProducts: v.array(v.string()),
    expiredProducts: v.array(v.string()),
    premiumAccess: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Get all user products
    const userProducts = await ctx.db
      .query('userProducts')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .collect();

    const now = Date.now();
    const products = [];
    const activeProducts = [];
    const expiredProducts = [];
    let hasAnyAccess = false;
    let premiumAccess = false;

    for (const userProduct of userProducts) {
      // Get pricing plan details
      const pricingPlan = await ctx.db.get(userProduct.pricingPlanId);

      if (pricingPlan) {
        const isExpired = userProduct.accessExpiresAt
          ? userProduct.accessExpiresAt < now
          : false;

        const hasAccess =
          userProduct.hasAccess &&
          userProduct.status === 'active' &&
          !isExpired;

        const daysUntilExpiration = userProduct.accessExpiresAt
          ? Math.ceil(
              (userProduct.accessExpiresAt - now) / (24 * 60 * 60 * 1000),
            )
          : undefined;

        products.push({
          productId: userProduct.productId,
          productName: pricingPlan.name,
          category: pricingPlan.category,
          year: pricingPlan.year,
          hasAccess,
          accessExpiresAt: userProduct.accessExpiresAt,
          status: userProduct.status,
          isExpired,
          daysUntilExpiration,
        });

        if (hasAccess) {
          hasAnyAccess = true;
          activeProducts.push(userProduct.productId);

          if (pricingPlan.category === 'premium_pack') {
            premiumAccess = true;
          }
        } else if (isExpired) {
          expiredProducts.push(userProduct.productId);
        }
      }
    }

    return {
      hasAnyAccess,
      products,
      activeProducts,
      expiredProducts,
      premiumAccess,
    };
  },
});

/**
 * Check if user has access to specific content/year
 */
export const checkUserAccessToYear = query({
  args: {
    userId: v.id('users'),
    year: v.number(),
  },
  returns: v.object({
    hasAccess: v.boolean(),
    accessType: v.optional(v.string()), // "year_access", "premium_pack"
    expiresAt: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    // First, check if user has the active year access flag
    const user = await ctx.db.get(args.userId);
    if (!user || !user.hasActiveYearAccess) {
      return {
        hasAccess: false,
      };
    }

    // Check for premium pack access (lifetime access to all years)
    const premiumAccess = await ctx.db
      .query('userProducts')
      .withIndex('by_user_product', q =>
        q.eq('userId', args.userId).eq('productId', 'premium_pack'),
      )
      .unique();

    if (
      premiumAccess &&
      premiumAccess.status === 'active' &&
      premiumAccess.hasAccess
    ) {
      return {
        hasAccess: true,
        accessType: 'premium_pack',
      };
    }

    // Check for year-specific access by looking at all user's products
    // Use index for status, then filter hasAccess in-memory (per Convex guidelines)
    const allUserProducts = await ctx.db
      .query('userProducts')
      .withIndex('by_user_status', q =>
        q.eq('userId', args.userId).eq('status', 'active'),
      )
      .collect();

    const userProducts = allUserProducts.filter(up => up.hasAccess === true);

    for (const userProduct of userProducts) {
      const pricingPlan = await ctx.db.get(userProduct.pricingPlanId);

      if (
        pricingPlan &&
        pricingPlan.accessYears &&
        pricingPlan.accessYears.includes(args.year)
      ) {
        return {
          hasAccess: true,
          accessType: 'year_access',
          expiresAt: userProduct.accessExpiresAt,
        };
      }
    }

    return {
      hasAccess: false,
    };
  },
});

/**
 * Check if user has active year access (simple flag check)
 */
export const checkUserHasActiveAccess = query({
  args: { userId: v.id('users') },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user?.hasActiveYearAccess === true;
  },
});

/**
 * Get user's subscription summary for dashboard
 */
export const getUserSubscriptionSummary = query({
  args: { userId: v.id('users') },
  returns: v.object({
    totalProducts: v.number(),
    activeProducts: v.number(),
    expiredProducts: v.number(),
    nextExpiration: v.optional(
      v.object({
        productName: v.string(),
        expiresAt: v.number(),
        daysRemaining: v.number(),
      }),
    ),
    hasPremium: v.boolean(),
    totalSpent: v.number(),
  }),
  handler: async (ctx, args) => {
    const userProducts = await ctx.db
      .query('userProducts')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .collect();

    const now = Date.now();
    let totalProducts = userProducts.length;
    let activeProducts = 0;
    let expiredProducts = 0;
    let hasPremium = false;
    let totalSpent = 0;
    let nextExpiration: any = null;

    for (const userProduct of userProducts) {
      totalSpent += userProduct.purchasePrice;

      const isExpired = userProduct.accessExpiresAt
        ? userProduct.accessExpiresAt < now
        : false;

      const hasAccess =
        userProduct.hasAccess && userProduct.status === 'active' && !isExpired;

      if (hasAccess) {
        activeProducts++;

        if (userProduct.productId === 'premium_pack') {
          hasPremium = true;
        }

        // Check for next expiration
        if (
          userProduct.accessExpiresAt &&
          (!nextExpiration ||
            userProduct.accessExpiresAt < nextExpiration.expiresAt)
        ) {
          const pricingPlan = await ctx.db.get(userProduct.pricingPlanId);

          if (pricingPlan) {
            nextExpiration = {
              productName: pricingPlan.name,
              expiresAt: userProduct.accessExpiresAt,
              daysRemaining: Math.ceil(
                (userProduct.accessExpiresAt - now) / (24 * 60 * 60 * 1000),
              ),
            };
          }
        }
      } else if (isExpired) {
        expiredProducts++;
      }
    }

    return {
      totalProducts,
      activeProducts,
      expiredProducts,
      nextExpiration,
      hasPremium,
      totalSpent,
    };
  },
});

/**
 * Get user products with pricing plan details
 */
export const getUserProducts = query({
  args: { userId: v.id('users') },
  returns: v.array(
    v.object({
      _id: v.id('userProducts'),
      productId: v.string(),
      productName: v.string(),
      category: v.optional(v.string()),
      year: v.optional(v.number()),
      hasAccess: v.boolean(),
      accessGrantedAt: v.number(),
      accessExpiresAt: v.optional(v.number()),
      status: v.string(),
      purchaseDate: v.number(),
      purchasePrice: v.number(),
      paymentGateway: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const userProducts = await ctx.db
      .query('userProducts')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .collect();

    // Enrich with pricing plan details
    const enrichedProducts = [];
    for (const userProduct of userProducts) {
      const pricingPlan = await ctx.db.get(userProduct.pricingPlanId);

      if (pricingPlan) {
        enrichedProducts.push({
          _id: userProduct._id,
          productId: userProduct.productId,
          productName: pricingPlan.name,
          category: pricingPlan.category,
          year: pricingPlan.year,
          hasAccess: userProduct.hasAccess,
          accessGrantedAt: userProduct.accessGrantedAt,
          accessExpiresAt: userProduct.accessExpiresAt,
          status: userProduct.status,
          purchaseDate: userProduct.purchaseDate,
          purchasePrice: userProduct.purchasePrice,
          paymentGateway: userProduct.paymentGateway,
        });
      }
    }

    return enrichedProducts;
  },
});

/**
 * Check if user has access to a specific product
 */
export const userHasAccess = query({
  args: {
    userId: v.id('users'),
    productId: v.string(),
  },
  returns: v.object({
    hasAccess: v.boolean(),
    expiresAt: v.optional(v.number()),
    status: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const userProduct = await ctx.db
      .query('userProducts')
      .withIndex('by_user_product', q =>
        q.eq('userId', args.userId).eq('productId', args.productId),
      )
      .unique();

    if (!userProduct || userProduct.status !== 'active') {
      return { hasAccess: false };
    }

    // Check if access has expired
    const now = Date.now();
    const hasExpired =
      userProduct.accessExpiresAt && userProduct.accessExpiresAt < now;

    return {
      hasAccess: userProduct.hasAccess && !hasExpired,
      expiresAt: userProduct.accessExpiresAt,
      status: userProduct.status,
    };
  },
});
