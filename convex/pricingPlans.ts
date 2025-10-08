import { v } from 'convex/values';

import { internalMutation, mutation, query } from './_generated/server';
import { requireAdmin } from './users';

export const getPricingPlans = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db.query('pricingPlans').order('asc').collect();
  },
});

export const savePricingPlan = mutation({
    args: {
      id: v.optional(v.id('pricingPlans')), // Se não fornecido, cria novo
      name: v.string(),
      badge: v.string(),
      originalPrice: v.optional(v.string()), // Marketing strikethrough price
      price: v.string(),
      installments: v.string(),
      installmentDetails: v.string(),
      description: v.string(),
      features: v.array(v.string()),
      buttonText: v.string(),
      // Extended fields for product identification
      productId: v.string(), // Required since schema now requires it
      category: v.optional(v.union(v.literal("year_access"), v.literal("premium_pack"), v.literal("addon"))),
      year: v.optional(v.number()),
      regularPriceNum: v.optional(v.number()),
      pixPriceNum: v.optional(v.number()),
      accessYears: v.optional(v.array(v.number())),
      isActive: v.optional(v.boolean()),
      displayOrder: v.optional(v.number()),
    },
    returns: v.id('pricingPlans'),
    handler: async (ctx, args) => {
      // Verificação de admin usando a função existente do users.ts
      await requireAdmin(ctx);
      
      const { id, ...planData } = args;
      
      if (id) {
        // Editar plano existente
        await ctx.db.patch(id, planData);
        return id;
      } else {
        // Criar novo plano
        return await ctx.db.insert('pricingPlans', planData);
      }
    },
  });
  

export const removePricingPlan = mutation({
  args: { id: v.id('pricingPlans') },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Verificação de admin usando a função existente do users.ts
    await requireAdmin(ctx);
    
    await ctx.db.delete(args.id);
    return null;
  },
});

/**
 * Get active pricing plans (products available for purchase)
 */
export const getActiveProducts = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db
      .query("pricingPlans")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
  },
});

/**
 * Get pricing plan by product ID
 */
export const getByProductId = query({
  args: { productId: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pricingPlans")
      .withIndex("by_product_id", (q) => q.eq("productId", args.productId))
      .unique();
  },
});

/**
 * Grant product access to user (internal)
 */
export const grantProductAccess = internalMutation({
  args: {
    userId: v.id("users"),
    pricingPlanId: v.id("pricingPlans"),
    productId: v.string(),
    paymentId: v.string(),
    paymentGateway: v.union(v.literal("mercadopago"), v.literal("asaas")),
    purchasePrice: v.number(),
    couponUsed: v.optional(v.string()),
    discountAmount: v.optional(v.number()),
    checkoutId: v.optional(v.string()),
  },
  returns: v.id("userProducts"),
  handler: async (ctx, args) => {
    // Get pricing plan details to calculate expiration
    const pricingPlan = await ctx.db.get(args.pricingPlanId);
    if (!pricingPlan) {
      throw new Error(`Pricing plan not found: ${args.pricingPlanId}`);
    }

    const now = Date.now();
    // Calculate expiration as December 31, 23:59:59.999 of the latest year in accessYears
    const accessExpiresAt = pricingPlan.accessYears && pricingPlan.accessYears.length > 0
      ? new Date(Math.max(...pricingPlan.accessYears), 11, 31, 23, 59, 59, 999).getTime()
      : undefined;

    // Check if user already has this product
    const existingAccess = await ctx.db
      .query("userProducts")
      .withIndex("by_user_product", (q) => 
        q.eq("userId", args.userId).eq("productId", args.productId)
      )
      .unique();

    if (existingAccess) {
      // Update existing access (extend expiration or reactivate)
      await ctx.db.patch(existingAccess._id, {
        hasAccess: true,
        accessGrantedAt: now,
        accessExpiresAt: accessExpiresAt,
        status: "active",
        paymentId: args.paymentId,
        purchasePrice: args.purchasePrice,
        paymentGateway: args.paymentGateway,
        couponUsed: args.couponUsed,
        discountAmount: args.discountAmount,
        checkoutId: args.checkoutId,
        pricingPlanId: args.pricingPlanId,
      });
      
      // Set user's active year access flag
      await ctx.db.patch(args.userId, {
        hasActiveYearAccess: true,
      });
      
      return existingAccess._id;
    } else {
      // Create new access
      const userProductId = await ctx.db.insert("userProducts", {
        userId: args.userId,
        pricingPlanId: args.pricingPlanId,
        productId: args.productId,
        purchaseDate: now,
        paymentGateway: args.paymentGateway,
        paymentId: args.paymentId,
        purchasePrice: args.purchasePrice,
        couponUsed: args.couponUsed,
        discountAmount: args.discountAmount,
        hasAccess: true,
        accessGrantedAt: now,
        accessExpiresAt,
        status: "active",
        checkoutId: args.checkoutId,
      });
      
      // Set user's active year access flag
      await ctx.db.patch(args.userId, {
        hasActiveYearAccess: true,
      });
      
      return userProductId;
    }
  },
});

/**
 * Revoke product access (for refunds/chargebacks)
 */
export const revokeProductAccess = internalMutation({
  args: {
    paymentId: v.string(),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Find all user products with this payment ID
    const userProducts = await ctx.db
      .query("userProducts")
      .withIndex("by_payment_id", (q) => q.eq("paymentId", args.paymentId))
      .collect();

    for (const userProduct of userProducts) {
      await ctx.db.patch(userProduct._id, {
        hasAccess: false,
        status: "refunded",
        notes: args.reason || "Payment refunded",
      });
    }

    console.log(`Revoked access for ${userProducts.length} products (payment: ${args.paymentId})`);
    return null;
  },
});

// Note: Default plans are now managed through the admin interface
// Admins can create and configure pricing plans via /admin/pricingPlans