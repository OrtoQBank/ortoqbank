import { v } from 'convex/values';

import { api, internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import {
  internalAction,
  internalMutation,
  mutation,
  query
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
    couponCode: v.optional(v.string()), // Optional coupon code
    // Address fields (required for new orders, enforced at application level)
    phone: v.optional(v.string()),
    mobilePhone: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    address: v.optional(v.string()),
    addressNumber: v.optional(v.string()), // Defaults to "SN" if not provided
  },
  returns: v.object({
    pendingOrderId: v.id('pendingOrders'),
    priceBreakdown: v.object({
      originalPrice: v.number(),
      couponDiscount: v.number(),
      pixDiscount: v.number(),
      finalPrice: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    // Get pricing plan to determine correct price
    const pricingPlan: any = await ctx.runQuery(api.pricingPlans.getByProductId, {
      productId: args.productId,
    });

    if (!pricingPlan || !pricingPlan.isActive) {
      console.error(args);
      throw new Error('Product not found or inactive');
    }

    // Base prices from the pricing plan (set by admin)
    const regularPrice = pricingPlan.regularPriceNum || 0;
    const pixPrice = pricingPlan.pixPriceNum || pricingPlan.regularPriceNum || 0;

    if (regularPrice <= 0 || pixPrice <= 0) {
      throw new Error('Invalid product price');
    }

    // Determine which base price to use based on payment method
    const basePrice = args.paymentMethod === 'PIX' ? pixPrice : regularPrice;
    let finalPrice = basePrice;
    let couponDiscount = 0;
    let appliedCouponCode: string | undefined;

    // Apply coupon if provided (applies to the selected payment method's price)
    if (args.couponCode && args.couponCode.trim()) {
      // Validate coupon with user CPF for usage tracking
      const couponResult: any = await ctx.runQuery(api.promoCoupons.validateAndApplyCoupon, {
        code: args.couponCode,
        originalPrice: basePrice,
        userCpf: args.cpf.replaceAll(/\D/g, ''),
      });

      if (couponResult.isValid) {
        finalPrice = couponResult.finalPrice;
        couponDiscount = couponResult.discountAmount;
        appliedCouponCode = args.couponCode.toUpperCase();
        console.log(`✅ Applied coupon ${appliedCouponCode}: -R$ ${couponDiscount}`);
      } else {
        throw new Error(couponResult.errorMessage || 'Cupom inválido');
      }
    }

    // Calculate PIX savings (difference between regular and PIX price)
    const pixDiscount = args.paymentMethod === 'PIX' ? (regularPrice - pixPrice) : 0;

    // Round to 2 decimal places
    finalPrice = Math.round(finalPrice * 100) / 100;
    couponDiscount = Math.round(couponDiscount * 100) / 100;

    if (finalPrice <= 0) {
      throw new Error('Invalid final price');
    }

    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    // Create pending order
    const pendingOrderId = await ctx.db.insert('pendingOrders', {
      email: args.email,
      cpf: args.cpf.replaceAll(/\D/g, ''), // Clean CPF
      name: args.name,
      productId: args.productId,
      status: 'pending',
      originalPrice: regularPrice,
      finalPrice,
      couponCode: appliedCouponCode,
      couponDiscount,
      pixDiscount,
      paymentMethod: args.paymentMethod,
      // Address info (for invoice generation)
      phone: args.phone,
      mobilePhone: args.mobilePhone,
      postalCode: args.postalCode?.replace(/\D/g, ''), // Clean CEP
      address: args.address,
      addressNumber: args.addressNumber || 'SN', // Default to "SN" (Sem Número) if not provided
      createdAt: now,
      expiresAt: now + sevenDays,
    });

    console.log(`📝 Created pending order ${pendingOrderId}`);
    console.log(`💰 Price breakdown: Method=${args.paymentMethod}, Base R$ ${basePrice}, Coupon R$ ${couponDiscount}, Final R$ ${finalPrice}`);

    return {
      pendingOrderId,
      priceBreakdown: {
        originalPrice: regularPrice,
        couponDiscount,
        pixDiscount,
        finalPrice,
      },
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
    asaasPaymentId: v.string(),
    installmentCount: v.optional(v.number()), // Number of credit card installments
    pixData: v.optional(v.object({
      qrPayload: v.optional(v.string()),
      qrCodeBase64: v.optional(v.string()),
      expirationDate: v.optional(v.string()),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Update the pending order with payment info
    await ctx.db.patch(args.pendingOrderId, {
      asaasPaymentId: args.asaasPaymentId,
      installmentCount: args.installmentCount,
      pixData: args.pixData,
    });

    console.log(`🔗 Linked payment ${args.asaasPaymentId} to order ${args.pendingOrderId}`);
    if (args.installmentCount && args.installmentCount > 1) {
      console.log(`💳 Installment payment: ${args.installmentCount}x`);
    }
    if (args.pixData) {
      console.log(`📱 Stored PIX QR code data`);
    }
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
    if ((event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') && (payment.status === 'RECEIVED' || payment.status === 'CONFIRMED')) {

        // Use externalReference to find the pending order
        const pendingOrderId = payment.externalReference;
        if (!pendingOrderId) {
          console.error(`No externalReference found in payment ${payment.id}`);
          return null;
        }

        // SECURITY: Verify payment amount matches order amount
        const pendingOrder: any = await ctx.runQuery(api.payments.getPendingOrderById, {
          orderId: pendingOrderId,
        });

        if (!pendingOrder) {
          console.error(`Order not found: ${pendingOrderId}`);
          return null;
        }

        // Check if payment amount matches expected amount (with small tolerance for rounding)
        const tolerance = 0.02; // 2 cents tolerance

        // IMPORTANT: Asaas creates SEPARATE payment records for each installment
        // So for a 2x payment, we receive 2 separate webhooks with individual installment amounts
        const installmentNumber = (payment as any).installmentNumber;
        const installmentGroupId = (payment as any).installment;
        const isInstallmentPayment = !!installmentNumber && !!installmentGroupId;

        console.log(`💰 Payment verification:`, {
          paymentId: payment.id,
          paymentValue: payment.value,
          installmentNumber,
          installmentGroupId,
          isInstallmentPayment,
          expectedOrderAmount: pendingOrder.finalPrice,
          orderInstallmentCount: (pendingOrder as any).installmentCount,
        });

        if (isInstallmentPayment) {
          // Verify installment amount if we have the installment count stored
          const storedInstallmentCount = (pendingOrder as any).installmentCount;
          if (storedInstallmentCount && storedInstallmentCount > 1) {
            const expectedInstallmentValue = pendingOrder.finalPrice / storedInstallmentCount;
            const actualInstallmentValue = payment.value || 0;

            // Allow small rounding differences (Asaas may round differently)
            if (Math.abs(actualInstallmentValue - expectedInstallmentValue) > tolerance) {
              console.error(`🚨 SECURITY ALERT: Installment amount mismatch!`, {
                orderId: pendingOrderId,
                paymentId: payment.id,
                orderTotal: pendingOrder.finalPrice,
                installmentCount: storedInstallmentCount,
                expectedPerInstallment: expectedInstallmentValue,
                actualPerInstallment: actualInstallmentValue,
                difference: actualInstallmentValue - expectedInstallmentValue,
              });

              // Don't process - this is a potential fraud attempt
              return null;
            }

            console.log(`✅ Installment ${installmentNumber}/${storedInstallmentCount} verified: R$ ${actualInstallmentValue}`);
          } else {
            // No stored installment count - log warning but proceed (trust Asaas)
            console.log(`⚠️ Processing installment ${installmentNumber} without stored installment count (installment group: ${installmentGroupId})`);
            console.log(`   Payment value: R$ ${payment.value} (this is 1 installment)`);
            console.log(`   Expected order total: R$ ${pendingOrder.finalPrice}`);
          }

          // For installment payments, only CONFIRM THE ORDER on the FIRST installment
          // But we still need to generate invoices for ALL installments
          if (installmentNumber !== 1) {
            console.log(`📄 Processing installment ${installmentNumber} - generating invoice only (order already confirmed)`);

            // Generate invoice for this installment (non-blocking)
            await ctx.scheduler.runAfter(0, internal.invoices.generateInvoice, {
              orderId: pendingOrder._id,
              asaasPaymentId: payment.id,
              installmentNumber,
              installmentValue: payment.value || 0,
              totalInstallments: storedInstallmentCount || installmentNumber,
            });

            console.log(`✅ Scheduled invoice generation for installment ${installmentNumber}`);
            return null; // Don't confirm order again
          }

          console.log(`✅ Processing first installment - will confirm order and generate invoice`);
        } else {
          // For single payments, verify the amount exactly
          const paidAmount = payment.value || payment.totalValue || 0;
          const expectedAmount = pendingOrder.finalPrice;

          if (Math.abs(paidAmount - expectedAmount) > tolerance) {
            console.error(`🚨 SECURITY ALERT: Payment amount mismatch!`, {
              orderId: pendingOrderId,
              paymentId: payment.id,
              expected: expectedAmount,
              paid: paidAmount,
              difference: paidAmount - expectedAmount,
            });

            // Don't process the payment - this is a potential fraud attempt
            return null;
          }

          console.log(`✅ Payment amount verified: R$ ${paidAmount} matches order R$ ${expectedAmount}`);
        }

        const order = await ctx.runMutation(internal.payments.confirmPayment, {
          pendingOrderId,
          asaasPaymentId: payment.id,
        });

        // Send Clerk invitation email
        if (order) {
          try {
            await ctx.runAction(internal.payments.sendClerkInvitation, {
              email: order.email,
              orderId: pendingOrderId,
              customerName: order.name,
            });
            console.log(`📧 Sent Clerk invitation to ${order.email}`);
          } catch (emailError) {
            console.error('Failed to send Clerk invitation:', emailError);
            // Don't fail the whole process if email fails
          }
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
  returns: v.union(
    v.object({
      email: v.string(),
      name: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Find the pending order
    const order = await ctx.db.get(args.pendingOrderId as Id<'pendingOrders'>);

    if (!order) {
      console.error(`No pending order found: ${args.pendingOrderId}`);
      return null;
    }

    if (order.status === 'paid' || order.status === 'provisioned' || order.status === 'completed') {
      console.log(`Order ${args.pendingOrderId} already processed, skipping`);
      return {
        email: order.email,
        name: order.name,
      };
    }

    // Update order status to paid with timestamp
    await ctx.db.patch(order._id, {
      status: 'paid',
      paidAt: Date.now(),
      asaasPaymentId: args.asaasPaymentId,
      externalReference: args.pendingOrderId, // Store order ID as external reference
    });

    console.log(`✅ Payment confirmed for order ${args.pendingOrderId}`);

    // Trigger invoice generation (non-blocking)
    // For installment payments, this generates the invoice for the FIRST installment
    // Subsequent installments are handled directly in processAsaasWebhook
    const installmentCount = order.installmentCount || 1;
    const installmentValue = installmentCount > 1 ? (order.finalPrice / installmentCount) : order.finalPrice;

    await ctx.scheduler.runAfter(0, internal.invoices.generateInvoice, {
      orderId: order._id,
      asaasPaymentId: args.asaasPaymentId,
      installmentNumber: 1, // This is the first installment
      installmentValue,
      totalInstallments: installmentCount,
    });

    // Track coupon usage NOW (after payment confirmed)
    if (order.couponCode) {
      const couponCode = order.couponCode;
      const coupon = await ctx.db
        .query('coupons')
        .withIndex('by_code', q => q.eq('code', couponCode))
        .unique();

      if (coupon) {
        // Create usage record (payment is confirmed)
        await ctx.db.insert('couponUsage', {
          couponId: coupon._id,
          couponCode: order.couponCode,
          orderId: order._id,
          userEmail: order.email,
          userCpf: order.cpf,
          discountAmount: order.couponDiscount || 0,
          originalPrice: order.originalPrice,
          finalPrice: order.finalPrice,
          usedAt: Date.now(),
        });

        // Increment usage counter
        const currentUses = coupon.currentUses || 0;
        await ctx.db.patch(coupon._id, {
          currentUses: currentUses + 1,
        });

        console.log(`📊 Confirmed coupon usage: ${order.couponCode} (${currentUses + 1}/${coupon.maxUses || '∞'})`);
      }
    }

    // Trigger idempotent provisioning (will only provision if user is also claimed)
    await ctx.runMutation(internal.payments.maybeProvisionAccess, {
      orderId: order._id,
    });

    // Return order data for email invitation
    return {
      email: order.email,
      name: order.name,
    };
  },
});

/**
 * Idempotent function to provision access when both payment and user are ready
 * Can be called multiple times safely - order of events doesn't matter
 */
export const maybeProvisionAccess = internalMutation({
  args: {
    orderId: v.id('pendingOrders'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);

    if (!order) {
      console.error(`Order not found: ${args.orderId}`);
      return null;
    }

    // Check if already completed
    if (order.status === 'completed') {
      console.log(`Order ${args.orderId} already completed, skipping`);
      return null;
    }

    // Check if we have both payment confirmation and user
    const hasPayment = order.status === 'paid';
    const hasUser = !!order.userId;

    console.log(`🔍 Checking provisioning readiness for order ${args.orderId}:`, {
      status: order.status,
      hasPayment,
      hasUser,
      userId: order.userId,
      paidAt: order.paidAt,
    });

    if (!hasPayment || !hasUser) {
      console.log(`⏸️ Order ${args.orderId} not ready for provisioning:`, {
        hasPayment,
        hasUser,
        status: order.status,
        userId: order.userId,
      });
      return null;
    }

    // Provision access
    try {
      console.log(`🚀 Provisioning access for order ${args.orderId}`);

      // Update order status
      await ctx.db.patch(args.orderId, {
        status: 'provisioned',
        provisionedAt: Date.now(),
      });

      // TODO: Add actual access provisioning logic here
      // - Create user in users table if needed
      // - Grant product access
      // - Send welcome email
      // - etc.

      // Mark as completed
      await ctx.db.patch(args.orderId, {
        status: 'completed',
      });

      console.log(`✅ Successfully provisioned access for order ${args.orderId}`);

    } catch (error) {
      console.error(`Error provisioning access for order ${args.orderId}:`, error);
      // Don't throw - let it retry later
    }

    return null;
  },
});


/**
 * Claim order by email (called from Clerk webhook)
 */
export const claimOrderByEmail = mutation({
  args: {
    email: v.string(),
    clerkUserId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // Find paid order with matching email
    const paidOrder = await ctx.db
      .query("pendingOrders")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) => q.eq(q.field("status"), "paid"))
      .first();

    if (!paidOrder) {
      return {
        success: true,
        message: 'No paid orders found for this email.'
      };
    }

    // Update order with user info
    await ctx.db.patch(paidOrder._id, {
      userId: args.clerkUserId,
      accountEmail: args.email,
    });

    // Trigger provisioning
    await ctx.runMutation(internal.payments.maybeProvisionAccess, {
      orderId: paidOrder._id,
    });

    return {
      success: true,
      message: 'Order claimed successfully!'
    };
  },
});

/**
 * Send Clerk invitation email with automatic retry logic
 */
export const sendClerkInvitation = internalAction({
  args: {
    email: v.string(),
    orderId: v.string(),
    customerName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Import retrier
    const { retrier } = await import('./retrier');

    // Create pending invitation record
    const invitationId = await ctx.runMutation(internal.payments.createEmailInvitation, {
      orderId: args.orderId as Id<'pendingOrders'>,
      email: args.email,
      customerName: args.customerName,
    });

    console.log(`📧 Starting email invitation for ${args.email} (order: ${args.orderId})`);

    // Run with retrier - this will automatically retry on failure
    try {
      await retrier.run(
        ctx,
        internal.payments.sendClerkInvitationAttempt,
        {
          email: args.email,
          orderId: args.orderId,
          customerName: args.customerName,
          invitationId,
          attemptNumber: 1,
        },
        {
          initialBackoffMs: 1000,
          base: 2,
          maxFailures: 3,
        }
      );
    } catch (error) {
      // This only happens if all retries fail
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to send invitation after all retries: ${errorMessage}`);

      await ctx.runMutation(internal.payments.updateEmailInvitationFailure, {
        invitationId,
        errorMessage: 'Failed after all retry attempts',
        errorDetails: errorMessage,
        retryCount: 3,
      });
    }

    return null;
  },
});

/**
 * Internal action that makes the actual Clerk API call (used by retrier)
 */
export const sendClerkInvitationAttempt = internalAction({
  args: {
    email: v.string(),
    orderId: v.string(),
    customerName: v.string(),
    invitationId: v.id('emailInvitations'),
    attemptNumber: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

    if (!CLERK_SECRET_KEY) {
      throw new Error('CLERK_SECRET_KEY not configured');
    }

    console.log(`📤 Attempt ${args.attemptNumber}: Sending Clerk invitation to ${args.email}`);

    const response = await fetch('https://api.clerk.com/v1/invitations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_address: args.email,
        public_metadata: {
          orderId: args.orderId,
          customerName: args.customerName,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Attempt ${args.attemptNumber} failed:`, error);
      throw new Error(`Clerk API error: ${response.status} - ${error}`);
    }

    const invitation = await response.json();
    console.log(`✅ Attempt ${args.attemptNumber} succeeded: Invitation ${invitation.id} sent to ${args.email}`);

    // Update success status
    await ctx.runMutation(internal.payments.updateEmailInvitationSuccess, {
      invitationId: args.invitationId,
      clerkInvitationId: invitation.id,
      retryCount: args.attemptNumber - 1,
    });

    return null;
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
    orderDetails: v.optional(v.object({
      email: v.string(),
      productId: v.string(),
      finalPrice: v.number(),
    })),
    pixData: v.optional(v.object({
      qrPayload: v.optional(v.string()),
      qrCodeBase64: v.optional(v.string()),
      expirationDate: v.optional(v.string()),
    })),
  }),
  handler: async (ctx, args) => {
    try {
      // Find the order by ID
      const order = await ctx.db.get(args.pendingOrderId as Id<'pendingOrders'>);

      if (!order) {
        return { status: 'failed' as const };
      }

      if (order.status === 'paid' || order.status === 'provisioned' || order.status === 'completed') {
        return {
          status: 'confirmed' as const,
          orderDetails: {
            email: order.email,
            productId: order.productId,
            finalPrice: order.finalPrice,
          },
          pixData: order.pixData,
        };
      }

      return {
        status: 'pending' as const,
        orderDetails: {
          email: order.email,
          productId: order.productId,
          finalPrice: order.finalPrice,
        },
        pixData: order.pixData,
      };
    } catch (error) {
      console.error('Error checking payment status:', error);
      return { status: 'failed' as const };
    }
  },
});

/**
 * Get pending order by ID (for Asaas payment creation)
 */
export const getPendingOrderById = query({
  args: {
    orderId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id('pendingOrders'),
      email: v.string(),
      cpf: v.string(),
      name: v.string(),
      productId: v.string(),
      finalPrice: v.number(),
      originalPrice: v.number(),
      couponCode: v.optional(v.string()),
      couponDiscount: v.optional(v.number()),
      pixDiscount: v.optional(v.number()),
      paymentMethod: v.string(),
      status: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    try {
      const order = await ctx.db.get(args.orderId as Id<'pendingOrders'>);
      if (!order) {
        return null;
      }
      return {
        _id: order._id,
        email: order.email,
        cpf: order.cpf,
        name: order.name,
        productId: order.productId,
        finalPrice: order.finalPrice,
        originalPrice: order.originalPrice,
        couponCode: order.couponCode,
        couponDiscount: order.couponDiscount,
        pixDiscount: order.pixDiscount,
        paymentMethod: order.paymentMethod,
        status: order.status,
      };
    } catch (error) {
      console.error('Error getting pending order:', error);
      return null;
    }
  },
});

/**
 * Create email invitation tracking record
 */
export const createEmailInvitation = internalMutation({
  args: {
    orderId: v.id('pendingOrders'),
    email: v.string(),
    customerName: v.string(),
    retrierRunId: v.optional(v.string()),
  },
  returns: v.id('emailInvitations'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('emailInvitations', {
      orderId: args.orderId,
      email: args.email,
      customerName: args.customerName,
      status: 'pending',
      retrierRunId: args.retrierRunId,
      retryCount: 0,
      createdAt: Date.now(),
    });
  },
});

/**
 * Update email invitation to success status
 */
export const updateEmailInvitationSuccess = internalMutation({
  args: {
    invitationId: v.id('emailInvitations'),
    clerkInvitationId: v.string(),
    retryCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invitationId, {
      status: 'sent',
      clerkInvitationId: args.clerkInvitationId,
      sentAt: Date.now(),
      retryCount: args.retryCount,
    });
    return null;
  },
});

/**
 * Update email invitation to failure status
 */
export const updateEmailInvitationFailure = internalMutation({
  args: {
    invitationId: v.id('emailInvitations'),
    errorMessage: v.string(),
    errorDetails: v.optional(v.string()),
    retryCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invitationId, {
      status: 'failed',
      errorMessage: args.errorMessage,
      errorDetails: args.errorDetails,
      retryCount: args.retryCount,
    });
    return null;
  },
});

/**
 * Update email invitation to accepted status
 */
export const updateEmailInvitationAccepted = internalMutation({
  args: { invitationId: v.id('emailInvitations') },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invitationId, {
      status: 'accepted',
      acceptedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Find email invitation by email for status update
 */
export const findSentInvitationByEmail = query({
  args: { email: v.string() },
  returns: v.union(
    v.object({
      _id: v.id('emailInvitations'),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query('emailInvitations')
      .withIndex('by_email', q => q.eq('email', args.email))
      .filter(q => q.eq(q.field('status'), 'sent'))
      .first();

    if (!invitation) {
      return null;
    }

    return {
      _id: invitation._id,
    };
  },
});