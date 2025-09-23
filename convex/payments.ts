import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";

/**
 * Process AsaaS webhook - the main entry point for payment events
 */
export const processAsaasWebhook = internalAction({
  args: {
    event: v.string(),
    payment: v.any(),
    rawWebhookData: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { event, payment } = args;

    console.log(`Processing AsaaS webhook: ${event} for payment ${payment.id}`);

    // First, record the payment event idempotently
    const paymentRecord = await ctx.runMutation(internal.payments.upsertPayment, {
      asaasPaymentId: payment.id,
      asaasEventId: args.rawWebhookData.id || `${payment.id}_${event}_${Date.now()}`,
      status: payment.status,
      paymentMethod: payment.billingType,
      value: payment.value,
      netValue: payment.netValue,
      paymentDate: payment.paymentDate,
      confirmedDate: payment.confirmedDate,
      externalReference: payment.externalReference,
      rawWebhookData: args.rawWebhookData,
    });

    if (!paymentRecord.isNew) {
      console.log(`Payment event ${payment.id} already processed, skipping`);
      return null;
    }

    // Handle different payment events
    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        if (payment.status === 'RECEIVED' || payment.status === 'CONFIRMED') {
          // Payment successful - mark order as paid and allow sign-up
          await ctx.runAction(internal.payments.confirmPaymentAndAllowSignup, {
            checkoutId: payment.externalReference.replace('-pix', ''), // Remove PIX suffix if present
            paymentId: payment.id,
          });
        }
        break;

      case 'PAYMENT_OVERDUE':
        // Mark order as failed if payment is overdue
        await ctx.runMutation(internal.payments.markOrderFailed, {
          checkoutId: payment.externalReference,
          reason: 'Payment overdue',
        });
        break;

      case 'PAYMENT_DELETED':
        // Mark order as failed if payment is deleted
        await ctx.runMutation(internal.payments.markOrderFailed, {
          checkoutId: payment.externalReference,
          reason: 'Payment deleted',
        });
        break;

      case 'PAYMENT_REFUNDED':
        // Revoke access if payment is refunded
        await ctx.runAction(internal.payments.revokeAccess, {
          paymentId: payment.id,
        });
        break;

      default:
        console.log(`Unhandled payment event: ${event}`);
    }

    return null;
  },
});

/**
 * Upsert payment record - idempotent
 */
export const upsertPayment = internalMutation({
  args: {
    asaasPaymentId: v.string(),
    asaasEventId: v.string(),
    status: v.string(),
    paymentMethod: v.optional(v.string()),
    value: v.number(),
    netValue: v.optional(v.number()),
    paymentDate: v.optional(v.string()),
    confirmedDate: v.optional(v.string()),
    externalReference: v.string(),
    rawWebhookData: v.any(),
  },
  returns: v.object({
    paymentId: v.id("payments"),
    isNew: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Check if this event was already processed
    const existingPayment = await ctx.db
      .query("payments")
      .withIndex("by_asaas_event_id", (q) => q.eq("asaasEventId", args.asaasEventId))
      .unique();

    if (existingPayment) {
      return {
        paymentId: existingPayment._id,
        isNew: false,
      };
    }

    // Extract checkout ID (remove PIX suffix if present)
    const checkoutId = args.externalReference.replace('-pix', '');

    // Create new payment record
    const paymentId = await ctx.db.insert("payments", {
      asaasPaymentId: args.asaasPaymentId,
      asaasEventId: args.asaasEventId,
      checkoutId,
      status: args.status,
      paymentMethod: args.paymentMethod,
      value: args.value,
      netValue: args.netValue,
      paymentDate: args.paymentDate,
      confirmedDate: args.confirmedDate,
      rawWebhookData: args.rawWebhookData,
      processedAt: Date.now(),
    });

    return {
      paymentId,
      isNew: true,
    };
  },
});

/**
 * Confirm payment and enable sign-up (strict payment-first flow)
 */
export const confirmPaymentAndAllowSignup = internalAction({
  args: {
    checkoutId: v.string(),
    paymentId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    console.log(`✅ Payment confirmed for checkout ${args.checkoutId} - enabling sign-up`);

    // Get the pending order - try by checkoutId first, then by AsaaS checkout ID
    let pendingOrder = await ctx.runQuery(internal.payments.getPendingOrderInternal, {
      checkoutId: args.checkoutId,
    });
    
    // If not found and looks like AsaaS ID, try finding by asaasChargeId
    if (!pendingOrder && args.checkoutId.includes('-')) {
      console.log('Order not found by checkoutId, trying by asaasChargeId:', args.checkoutId);
      pendingOrder = await ctx.runQuery(internal.payments.getPendingOrderByAsaasId, {
        asaasChargeId: args.checkoutId,
      });
    }

    if (!pendingOrder) {
      console.error(`No pending order found for checkout ${args.checkoutId}`);
      return null;
    }

    if (pendingOrder.status === 'completed') {
      console.log(`Order ${args.checkoutId} already completed, skipping`);
      return null;
    }

    // Mark order as paid and ready for sign-up
    await ctx.runMutation(internal.payments.updateOrderStatus, {
      checkoutId: args.checkoutId,
      status: 'paid',
    });

    console.log(`🔐 Payment confirmed - user can now sign up for order ${args.checkoutId}`);
    return null;
  },
});

/**
 * Provision access after successful payment (legacy - still used for existing Clerk users)
 */
export const provisionAccess = internalAction({
  args: {
    checkoutId: v.string(),
    paymentId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    console.log(`Provisioning access for checkout ${args.checkoutId}`);

    // Get the pending order
    const pendingOrder = await ctx.runQuery(internal.payments.getPendingOrderInternal, {
      checkoutId: args.checkoutId,
    });

    if (!pendingOrder) {
      console.error(`No pending order found for checkout ${args.checkoutId}`);
      return null;
    }

    if (pendingOrder.status === 'completed') {
      console.log(`Order ${args.checkoutId} already completed, skipping`);
      return null;
    }

    // Mark order as paid
    await ctx.runMutation(internal.payments.updateOrderStatus, {
      checkoutId: args.checkoutId,
      status: 'paid',
    });

    // Check if user already exists in Clerk
    const clerkUser = await ctx.runAction(api.clerkActions.checkClerkUserExists, {
      email: pendingOrder.email,
    });

    if (clerkUser) {
      console.log(`Clerk user exists for ${pendingOrder.email}, updating metadata`);
      
      // Update Clerk user metadata
      await ctx.runAction(api.clerkActions.updateClerkUserMetadata, {
        userId: clerkUser.id,
        metadata: {
        paid: true,
        paymentId: args.paymentId,
        paymentGateway: 'asaas',
        paymentDate: new Date().toISOString(),
        productId: pendingOrder.productId,
        },
      });

      // Update user record with payment info
      await ctx.runMutation(internal.payments.upsertUser, {
        email: pendingOrder.email,
        clerkUserId: clerkUser.id,
        firstName: pendingOrder.customerData?.firstName || 'Cliente',
        lastName: pendingOrder.customerData?.lastName || 'AsaaS',
        paymentId: args.paymentId,
        paymentGateway: 'asaas',
        paymentDate: new Date().toISOString(),
        paymentStatus: 'RECEIVED',
        paid: true,
        status: 'active',
      });

      // Get pricing plan for this product
      const pricingPlan = await ctx.runQuery(api.pricingPlans.getByProductId, {
        productId: pendingOrder.productId,
      });

      if (pricingPlan) {
        // Grant product access
        await ctx.runMutation(internal.pricingPlans.grantProductAccess, {
          userId: (await ctx.runQuery(internal.users.getUserByClerkId, { clerkUserId: clerkUser.id }))!._id,
          pricingPlanId: pricingPlan._id,
          productId: pendingOrder.productId,
          paymentId: args.paymentId,
          paymentGateway: 'asaas',
          purchasePrice: pendingOrder.finalPrice,
          couponUsed: pendingOrder.couponCode,
          discountAmount: pendingOrder.discountAmount,
          checkoutId: args.checkoutId,
        });
      }

      // Mark order as completed
      await ctx.runMutation(internal.payments.updateOrderStatus, {
        checkoutId: args.checkoutId,
        status: 'completed',
        clerkUserId: clerkUser.id,
      });

    } else {
      console.log(`Creating Clerk invitation for ${pendingOrder.email}`);
      
      // Create Clerk invitation
      const invitation = await ctx.runAction(api.clerkActions.createClerkInvitation, {
        emailAddress: pendingOrder.email,
        publicMetadata: {
          paid: true,
          paymentId: args.paymentId,
          paymentGateway: 'asaas',
          paymentDate: new Date().toISOString(),
          productId: pendingOrder.productId,
          firstName: pendingOrder.customerData?.firstName || 'Cliente',
          lastName: pendingOrder.customerData?.lastName || 'AsaaS',
        },
        redirectUrl: `${process.env.NEXT_PUBLIC_CONVEX_SITE_URL}/onboarding?order=${args.checkoutId}`,
      });

      // Create user record in invited state (will be updated when they sign up)
      const userId = await ctx.runMutation(internal.payments.upsertUser, {
        email: pendingOrder.email,
        firstName: pendingOrder.customerData?.firstName || 'Cliente',
        lastName: pendingOrder.customerData?.lastName || 'AsaaS',
        paymentId: args.paymentId,
        paymentGateway: 'asaas',
        paymentDate: new Date().toISOString(),
        paymentStatus: 'RECEIVED',
        paid: true,
        status: 'invited',
      });

      // Get pricing plan for this product
      const pricingPlan = await ctx.runQuery(api.pricingPlans.getByProductId, {
        productId: pendingOrder.productId,
      });

      if (pricingPlan) {
        // Grant product access for invited user
        await ctx.runMutation(internal.pricingPlans.grantProductAccess, {
          userId,
          pricingPlanId: pricingPlan._id,
          productId: pendingOrder.productId,
          paymentId: args.paymentId,
          paymentGateway: 'asaas',
          purchasePrice: pendingOrder.finalPrice,
          couponUsed: pendingOrder.couponCode,
          discountAmount: pendingOrder.discountAmount,
          checkoutId: args.checkoutId,
        });
      }

      // Update order with invitation info
      await ctx.runMutation(internal.payments.updateOrderStatus, {
        checkoutId: args.checkoutId,
        status: 'provisionable',
        inviteId: invitation.id,
        inviteSentAt: Date.now(),
      });
    }

    console.log(`Access provisioned for checkout ${args.checkoutId}`);
    return null;
  },
});

/**
 * Revoke access (for refunds/chargebacks)
 */
export const revokeAccess = internalAction({
  args: {
    paymentId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    console.log(`Revoking access for payment ${args.paymentId}`);

    // Revoke product access for this payment
    await ctx.runMutation(internal.pricingPlans.revokeProductAccess, {
      paymentId: args.paymentId,
      reason: 'Payment refunded',
    });

    // Find user by payment ID to update their status
    const user = await ctx.runQuery(internal.payments.getUserByPaymentId, {
      paymentId: args.paymentId,
    });

    if (user && user.clerkUserId) {
      // Update Clerk user metadata
      await ctx.runAction(api.clerkActions.updateClerkUserMetadata, {
        userId: user.clerkUserId,
        metadata: {
          suspended: true,
          suspendedAt: new Date().toISOString(),
          suspendedReason: 'Payment refunded',
        },
      });
    }

    console.log(`Access revoked for payment ${args.paymentId}`);
    return null;
  },
});

// Helper mutations and queries

export const getPendingOrderInternal = internalQuery({
  args: { checkoutId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pendingOrders")
      .withIndex("by_checkout_id", (q) => q.eq("checkoutId", args.checkoutId))
      .unique();
  },
});

export const getPendingOrderByAsaasId = internalQuery({
  args: { asaasChargeId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pendingOrders")
      .withIndex("by_asaas_charge", (q) => q.eq("asaasChargeId", args.asaasChargeId))
      .unique();
  },
});

export const updateOrderStatus = internalMutation({
  args: {
    checkoutId: v.string(),
    status: v.string(),
    clerkUserId: v.optional(v.string()),
    inviteId: v.optional(v.string()),
    inviteSentAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("pendingOrders")
      .withIndex("by_checkout_id", (q) => q.eq("checkoutId", args.checkoutId))
      .unique();

    if (!order) {
      throw new Error(`Order not found: ${args.checkoutId}`);
    }

    const updates: any = { status: args.status };
    if (args.clerkUserId) updates.clerkUserId = args.clerkUserId;
    if (args.inviteId) updates.inviteId = args.inviteId;
    if (args.inviteSentAt) updates.inviteSentAt = args.inviteSentAt;

    await ctx.db.patch(order._id, updates);
  },
});

export const markOrderFailed = internalMutation({
  args: {
    checkoutId: v.string(),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("pendingOrders")
      .withIndex("by_checkout_id", (q) => q.eq("checkoutId", args.checkoutId))
      .unique();

    if (order && order.status !== 'completed') {
      await ctx.db.patch(order._id, { 
        status: 'failed',
      });
      console.log(`Order ${args.checkoutId} marked as failed: ${args.reason}`);
    }
  },
});

export const upsertUser = internalMutation({
  args: {
    email: v.string(),
    clerkUserId: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    paymentId: v.optional(v.union(v.string(), v.number())),
    paymentGateway: v.optional(v.union(v.literal("mercadopago"), v.literal("asaas"))),
    paymentDate: v.optional(v.string()),
    paymentStatus: v.optional(v.string()),
    paid: v.optional(v.boolean()),
    status: v.optional(v.union(v.literal("invited"), v.literal("active"), v.literal("suspended"), v.literal("expired"))),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    // Check if user already exists by email or clerkUserId
    let existingUser;
    
    if (args.clerkUserId) {
      existingUser = await ctx.db
        .query("users")
        .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId!))
        .unique();
    }
    
    if (!existingUser && args.email) {
      existingUser = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .unique();
    }

    if (existingUser) {
      // Update existing user
      const updates: any = {};
      if (args.clerkUserId) updates.clerkUserId = args.clerkUserId;
      if (args.firstName) updates.firstName = args.firstName;
      if (args.lastName) updates.lastName = args.lastName;
      if (args.paymentId) updates.paymentId = args.paymentId;
      if (args.paymentDate) updates.paymentDate = args.paymentDate;
      if (args.paymentStatus) updates.paymentStatus = args.paymentStatus;
      if (args.paid !== undefined) updates.paid = args.paid;
      if (args.status) updates.status = args.status;
      
      await ctx.db.patch(existingUser._id, updates);
      return existingUser._id;
    } else {
      // Create new user (this will mainly happen for invited users before they sign up)
      return await ctx.db.insert("users", {
        email: args.email,
        clerkUserId: args.clerkUserId || "",
        firstName: args.firstName,
        lastName: args.lastName,
        paymentId: args.paymentId,
        paymentDate: args.paymentDate,
        paymentStatus: args.paymentStatus,
        paid: args.paid,
        status: args.status as "invited" | "active" | "suspended" | "expired" | undefined,
      });
    }
  },
});

export const getUserByPaymentId = internalQuery({
  args: { paymentId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      email: v.string(),
      clerkUserId: v.string(),
      hasAccess: v.optional(v.boolean()),
      status: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("paymentId"), args.paymentId))
      .unique();
  },
});

export const updateUserStatus = internalMutation({
  args: {
    userId: v.id("users"),
    status: v.optional(v.union(v.literal("invited"), v.literal("active"), v.literal("suspended"), v.literal("expired"))),
    hasAccess: v.optional(v.boolean()),
    paid: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: any = {};
    if (args.status) updates.status = args.status;
    if (args.hasAccess !== undefined) updates.hasAccess = args.hasAccess;
    if (args.paid !== undefined) updates.paid = args.paid;
    
    await ctx.db.patch(args.userId, updates);
  },
});

/**
 * Process AsaaS Checkout webhook events
 */
export const processAsaasCheckoutWebhook = internalAction({
  args: {
    event: v.string(),
    checkout: v.any(),
    rawWebhookData: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { event, checkout } = args;
    
    console.log(`Processing AsaaS checkout webhook: ${event}`, {
      checkoutId: checkout.id,
      status: checkout.status,
      externalReference: checkout.externalReference,
    });

    // Handle different checkout events
    switch (event) {
      case 'CHECKOUT_PAID':
        // Try to find the order by multiple methods (backward compatibility)
        let checkoutId = checkout.externalReference || checkout.id;
        
        // If externalReference has old format (checkout_X_timestamp), try to find by AsaaS checkout ID
        if (checkoutId?.startsWith('checkout_')) {
          console.log('Old format externalReference detected, using AsaaS checkout ID:', checkout.id);
          checkoutId = checkout.id;
        }
        
        await ctx.runAction(internal.payments.confirmPaymentAndAllowSignup, {
          checkoutId: checkoutId,
          paymentId: checkout.paymentId || checkout.id,
        });
        break;

      case 'CHECKOUT_CANCELED':
      case 'CHECKOUT_EXPIRED':
        // Mark order as failed
        await ctx.runMutation(internal.payments.markOrderFailed, {
          checkoutId: checkout.externalReference || checkout.id,
          reason: event === 'CHECKOUT_CANCELED' ? 'Checkout cancelled' : 'Checkout expired',
        });
        break;

      default:
        console.log(`Unhandled checkout event: ${event}`);
    }

    return null;
  },
});
