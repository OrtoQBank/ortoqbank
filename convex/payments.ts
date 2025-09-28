import { v } from 'convex/values';
import { api, internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import {
  internalAction,
  internalMutation,
  mutation,
  query,
} from './_generated/server';

/**
 * Create a pending order (Step 1 of checkout flow)
 * This creates the order BEFORE payment, generating a claim token
 */
export const createPendingOrder = mutation({
  args: {
    email: v.string(),
    cpf: v.string(),
    name: v.string(),
    productId: v.string(),
    paymentMethod: v.string(), // 'PIX' or 'CREDIT_CARD'
  },
  returns: v.object({
    pendingOrderId: v.id('pendingOrders'),
    claimToken: v.string(),
  }),
  handler: async (ctx, args) => {
    // Get pricing plan to determine correct price
    const pricingPlan: any = await ctx.runQuery(api.pricingPlans.getByProductId, {
      productId: args.productId,
    });

    if (!pricingPlan || !pricingPlan.isActive) {
      throw new Error('Product not found or inactive');
    }

    // Determine price based on payment method
    const pixPrice = pricingPlan.pixPriceNum || pricingPlan.regularPriceNum || 0;
    const regularPrice = pricingPlan.regularPriceNum || 0;
    const finalPrice = args.paymentMethod === 'PIX' ? pixPrice : regularPrice;

    if (finalPrice <= 0) {
      throw new Error('Invalid product price');
    }

    // Generate claim token (valid for 7 days)
    const claimToken = crypto.randomUUID();
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    // Create pending order
    const pendingOrderId = await ctx.db.insert('pendingOrders', {
      email: args.email,
      cpf: args.cpf.replace(/\D/g, ''), // Clean CPF
      name: args.name,
      productId: args.productId,
      claimToken,
      claimTokenExpiresAt: now + sevenDays,
      claimTokenUsed: false,
      status: 'pending',
      originalPrice: regularPrice,
      finalPrice,
      paymentMethod: args.paymentMethod,
      createdAt: now,
      expiresAt: now + sevenDays,
    });

    console.log(`📝 Created pending order ${pendingOrderId} with claim token ${claimToken}`);

    return {
      pendingOrderId,
      claimToken,
    };
  },
});

/**
 * Link payment to pending order (Step 2 of checkout flow)
 * Called after Asaas payment is created
 */
export const linkPaymentToOrder = mutation({
  args: {
    pendingOrderId: v.id('pendingOrders'),
    asaasCustomerId: v.string(),
    asaasPaymentId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Update the pending order with payment info
    await ctx.db.patch(args.pendingOrderId, {
      asaasCustomerId: args.asaasCustomerId,
      asaasPaymentId: args.asaasPaymentId,
    });

    console.log(`🔗 Linked payment ${args.asaasPaymentId} to order ${args.pendingOrderId}`);
    return null;
  },
});

/**
 * Process AsaaS webhook for payment events
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

    // Handle payment confirmation
    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      if (payment.status === 'RECEIVED' || payment.status === 'CONFIRMED') {
        
        // Use externalReference to find the pending order
        const pendingOrderId = payment.externalReference;
        if (!pendingOrderId) {
          console.error(`No externalReference found in payment ${payment.id}`);
          return null;
        }

        await ctx.runMutation(internal.payments.confirmPayment, {
          pendingOrderId,
          asaasPaymentId: payment.id,
        });
      }
    }

    return null;
  },
});

/**
 * Confirm payment for a pending order
 */
export const confirmPayment = internalMutation({
  args: {
    pendingOrderId: v.string(),
    asaasPaymentId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Find the pending order
    const order = await ctx.db.get(args.pendingOrderId as Id<'pendingOrders'>);
    
    if (!order) {
      console.error(`No pending order found: ${args.pendingOrderId}`);
      return null;
    }

    if (order.status === 'paid' || order.status === 'completed') {
      console.log(`Order ${args.pendingOrderId} already processed, skipping`);
      return null;
    }

    // Update order status to paid
    await ctx.db.patch(order._id, { status: 'paid' });

    console.log(`✅ Payment confirmed for order ${args.pendingOrderId}`);

    // If user already claimed this order, provision access immediately
    if (order.clerkUserId) {
      await ctx.db.patch(order._id, { status: 'provisionable' });
      console.log(`🚀 Order ${args.pendingOrderId} ready for provisioning`);
      
      // TODO: Trigger access provisioning here
    }

    return null;
  },
});

/**
 * Claim a pending order after user signup
 * This is called right after Clerk signup completes
 */
export const claimPendingOrder = mutation({
  args: {
    claimToken: v.string(),
    clerkUserId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    orderStatus: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      // Find the order by claim token
      const order = await ctx.db
        .query('pendingOrders')
        .withIndex('by_claim_token', q => q.eq('claimToken', args.claimToken))
        .unique();

      if (!order) {
        return {
          success: false,
          message: 'Token de acesso inválido ou expirado.',
        };
      }

      // Check if token is expired or already used
      if (order.claimTokenUsed || order.claimTokenExpiresAt < Date.now()) {
        return {
          success: false,
          message: 'Token de acesso expirado ou já utilizado.',
        };
      }

      // Mark token as used and link to user
      await ctx.db.patch(order._id, {
        clerkUserId: args.clerkUserId,
        claimTokenUsed: true,
      });

      console.log(`🔗 Claimed order ${order._id} for user ${args.clerkUserId}`);

      // If payment is already confirmed, provision access immediately
      if (order.status === 'paid') {
        await ctx.db.patch(order._id, { status: 'provisionable' });
        console.log(`🚀 Order ${order._id} ready for provisioning`);
        
        // TODO: Trigger access provisioning here
        
        return {
          success: true,
          message: 'Conta criada e acesso liberado! Bem-vindo ao OrtoQBank.',
          orderStatus: 'provisionable',
        };
      }

      return {
        success: true,
        message: 'Conta criada! Aguardando confirmação do pagamento.',
        orderStatus: order.status,
      };

    } catch (error) {
      console.error('Error claiming pending order:', error);
      return {
        success: false,
        message: 'Erro interno. Tente novamente.',
      };
    }
  },
});

/**
 * Check payment status for processing page
 */
export const checkPaymentStatus = query({
  args: {
    pendingOrderId: v.string(),
  },
  returns: v.object({
    status: v.union(v.literal('pending'), v.literal('confirmed'), v.literal('failed')),
    claimToken: v.optional(v.string()),
    orderDetails: v.optional(v.object({
      email: v.string(),
      productId: v.string(),
      finalPrice: v.number(),
    })),
  }),
  handler: async (ctx, args) => {
    try {
      // Find the order by ID
      const order = await ctx.db.get(args.pendingOrderId as Id<'pendingOrders'>);

      if (!order) {
        return { status: 'failed' as const };
      }

      if (order.status === 'paid' || order.status === 'provisionable' || order.status === 'completed') {
        return {
          status: 'confirmed' as const,
          claimToken: order.claimToken,
          orderDetails: {
            email: order.email,
            productId: order.productId,
            finalPrice: order.finalPrice,
          },
        };
      }

      return { status: 'pending' as const };
    } catch (error) {
      console.error('Error checking payment status:', error);
      return { status: 'failed' as const };
    }
  },
});

/**
 * Validate a claim token (for signup page)
 */
export const validateClaimToken = query({
  args: {
    claimToken: v.string(),
  },
  returns: v.object({
    isValid: v.boolean(),
    orderDetails: v.optional(v.object({
      email: v.string(),
      name: v.string(),
      productId: v.string(),
      finalPrice: v.number(),
      status: v.string(),
    })),
  }),
  handler: async (ctx, args) => {
    try {
      // Find the order by claim token
      const order = await ctx.db
        .query('pendingOrders')
        .withIndex('by_claim_token', q => q.eq('claimToken', args.claimToken))
        .unique();

      if (!order) {
        return { isValid: false };
      }

      // Check if token is expired or used
      if (order.claimTokenUsed || order.claimTokenExpiresAt < Date.now()) {
        return { isValid: false };
      }

      return {
        isValid: true,
        orderDetails: {
          email: order.email,
          name: order.name,
          productId: order.productId,
          finalPrice: order.finalPrice,
          status: order.status,
        },
      };
    } catch (error) {
      console.error('Error validating claim token:', error);
      return { isValid: false };
    }
  },
});