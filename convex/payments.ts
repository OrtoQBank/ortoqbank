import { v } from 'convex/values';
import { api, internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import {
  internalAction,
  internalMutation,
  internalQuery,
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
    couponCode: v.optional(v.string()), // Optional coupon code
  },
  returns: v.object({
    pendingOrderId: v.id('pendingOrders'),
    claimToken: v.string(),
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
        userCpf: args.cpf.replace(/\D/g, ''),
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
      couponCode: appliedCouponCode,
      couponDiscount,
      pixDiscount,
      paymentMethod: args.paymentMethod,
      createdAt: now,
      expiresAt: now + sevenDays,
    });

    console.log(`📝 Created pending order ${pendingOrderId} with claim token ${claimToken}`);
    console.log(`💰 Price breakdown: Method=${args.paymentMethod}, Base R$ ${basePrice}, Coupon R$ ${couponDiscount}, Final R$ ${finalPrice}`);

    return {
      pendingOrderId,
      claimToken,
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
      pixData: args.pixData,
    });

    console.log(`🔗 Linked payment ${args.asaasPaymentId} to order ${args.pendingOrderId}`);
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
    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      if (payment.status === 'RECEIVED' || payment.status === 'CONFIRMED') {
        
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

        const order = await ctx.runMutation(internal.payments.confirmPayment, {
          pendingOrderId,
          asaasPaymentId: payment.id,
        });

        // Send Clerk invitation email as backup
        if (order) {
          try {
            await ctx.runAction(internal.payments.sendClerkInvitation, {
              email: order.email,
              claimToken: order.claimToken,
              customerName: order.name,
            });
            console.log(`📧 Sent Clerk invitation to ${order.email}`);
          } catch (emailError) {
            console.error('Failed to send Clerk invitation:', emailError);
            // Don't fail the whole process if email fails
          }
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
      claimToken: v.string(),
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
        claimToken: order.claimToken,
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
    await ctx.scheduler.runAfter(0, internal.payments.generateInvoice, {
      orderId: order._id,
      asaasPaymentId: args.asaasPaymentId,
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
      claimToken: order.claimToken,
      name: order.name,
    };
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
    accountEmail: v.optional(v.string()), // Email from Clerk account
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
        userId: args.clerkUserId, // Updated field name
        accountEmail: args.accountEmail, // Store Clerk account email
        claimTokenUsed: true,
      });

      console.log(`🔗 Claimed order ${order._id} for user ${args.clerkUserId}`);
      console.log(`📧 Contact email: ${order.email}, Account email: ${args.accountEmail}`);

      // Trigger idempotent provisioning
      await ctx.runMutation(internal.payments.maybeProvisionAccess, {
        orderId: order._id,
      });

      return {
        success: true,
        message: order.status === 'paid' 
          ? 'Conta criada e acesso liberado! Bem-vindo ao OrtoQBank.'
          : 'Conta criada! Aguardando confirmação do pagamento.',
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

    // Check if we have both payment confirmation and user claim
    const hasPayment = order.status === 'paid';
    const hasUser = order.userId && order.claimTokenUsed;

    console.log(`🔍 Checking provisioning readiness for order ${args.orderId}:`, {
      status: order.status,
      hasPayment,
      hasUser,
      userId: order.userId,
      claimTokenUsed: order.claimTokenUsed,
      paidAt: order.paidAt,
    });

    if (!hasPayment || !hasUser) {
      console.log(`⏸️ Order ${args.orderId} not ready for provisioning:`, {
        hasPayment,
        hasUser,
        status: order.status,
        userId: order.userId,
        claimTokenUsed: order.claimTokenUsed,
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
      claimTokenUsed: true,
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
 * Send Clerk invitation email with claim token
 */
export const sendClerkInvitation = internalAction({
  args: {
    email: v.string(),
    claimToken: v.string(),
    customerName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
    
    if (!CLERK_SECRET_KEY) {
      console.error('CLERK_SECRET_KEY not configured');
      return null;
    }

    try {
      const signupUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sign-up?claim=${args.claimToken}`;
      
      const response = await fetch('https://api.clerk.com/v1/invitations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_address: args.email,
          redirect_url: signupUrl,
          public_metadata: {
            claimToken: args.claimToken,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Failed to send Clerk invitation:', error);
        return null;
      }

      const invitation = await response.json();
      console.log(`✅ Sent Clerk invitation to ${args.email}:`, invitation.id);
      
    } catch (error) {
      console.error('Error sending Clerk invitation:', error);
    }

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
    claimToken: v.optional(v.string()),
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
          claimToken: order.claimToken,
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
 * Create invoice record and trigger Asaas invoice generation
 */
export const generateInvoice = internalMutation({
  args: {
    orderId: v.id('pendingOrders'),
    asaasPaymentId: v.string(),
  },
  returns: v.union(v.id('invoices'), v.null()),
  handler: async (ctx, args) => {
    // Check if invoice already exists
    const existingInvoice = await ctx.db
      .query('invoices')
      .withIndex('by_order', q => q.eq('orderId', args.orderId))
      .first();
    
    if (existingInvoice) {
      console.log(`Invoice already exists for order ${args.orderId}`);
      return existingInvoice._id;
    }
    
    // Get order details
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      console.error(`Order not found: ${args.orderId}`);
      return null;
    }
    
    // Create invoice record
    const invoiceId = await ctx.db.insert('invoices', {
      orderId: args.orderId,
      asaasPaymentId: args.asaasPaymentId,
      status: 'pending',
      municipalServiceId: '', // Will be set during processing
      serviceDescription: 'Acesso à plataforma OrtoQBank',
      value: order.finalPrice,
      customerName: order.name,
      customerEmail: order.email,
      customerCpfCnpj: order.cpf,
      createdAt: Date.now(),
    });
    
    console.log(`📄 Created invoice record ${invoiceId} for order ${args.orderId}`);
    
    // Schedule async invoice generation
    await ctx.scheduler.runAfter(0, internal.payments.processInvoiceGeneration, {
      invoiceId,
    });
    
    return invoiceId;
  },
});

/**
 * Process invoice generation with Asaas (async, non-blocking)
 * 
 * NOTE: Invoice generation requires:
 * 1. Invoice/NF-e features enabled on your Asaas account
 * 2. Valid municipal service code for your municipality
 * 3. Proper account configuration with Asaas (certificate, etc.)
 * 
 * If these are not available, the invoice will be marked as failed
 * but payment processing will NOT be affected.
 */
export const processInvoiceGeneration = internalAction({
  args: {
    invoiceId: v.id('invoices'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      // Get invoice record
      const invoice: any = await ctx.runQuery(internal.payments.getInvoiceById, {
        invoiceId: args.invoiceId,
      });
      
      if (!invoice) {
        console.error(`Invoice not found: ${args.invoiceId}`);
        return null;
      }
      
      console.log(`📄 Processing invoice generation for order ${invoice.orderId}`);
      
      // Get fiscal service ID from Asaas
      // For software/digital content services, use: "02964 | 1.09"
      const serviceDescription = process.env.ASAAS_FISCAL_SERVICE || '02964 | 1.09';
      
      const fiscalService = await ctx.runAction(api.asaas.getFiscalServiceId, {
        serviceDescription,
      });
      
      if (!fiscalService) {
        const errorMsg = `Fiscal service not found for: ${serviceDescription}. Check your Asaas fiscal configuration.`;
        console.error(`⚠️ ${errorMsg}`);
        
        await ctx.runMutation(internal.payments.updateInvoiceError, {
          invoiceId: args.invoiceId,
          errorMessage: errorMsg,
        });
        
        // Detailed admin alert for fiscal service configuration error
        console.error(`🚨 ADMIN ALERT: Invoice generation failed - Fiscal service not found`, {
          invoiceId: args.invoiceId,
          orderId: invoice.orderId,
          serviceDescription,
          error: errorMsg,
          severity: 'high',
          category: 'configuration_error',
          troubleshooting: {
            step1: 'Verify ASAAS_FISCAL_SERVICE env var is set correctly (default: "02964 | 1.09")',
            step2: 'Check fiscal service exists in Asaas: GET /fiscalInfo/services?description=<service>',
            step3: 'Ensure fiscal info is complete in Asaas dashboard',
            step4: 'Verify invoice features are enabled in your Asaas account settings',
            note: 'This is a configuration error - payment processing is working correctly'
          }
        });
        
        return null;
      }
      
      console.log(`📋 Using fiscal service: ${fiscalService.serviceId} - ${fiscalService.description}`);
      
      // Update invoice status to processing
      await ctx.runMutation(internal.payments.updateInvoiceServiceId, {
        invoiceId: args.invoiceId,
        municipalServiceId: fiscalService.serviceId,
      });
      
      // Schedule invoice with Asaas
      const result = await ctx.runAction(api.asaas.scheduleInvoice, {
        asaasPaymentId: invoice.asaasPaymentId,
        serviceDescription: invoice.serviceDescription,
        municipalServiceId: fiscalService.serviceId,
        observations: `Pedido: ${invoice.orderId}`,
      });
      
      // Update invoice record with success
      await ctx.runMutation(internal.payments.updateInvoiceSuccess, {
        invoiceId: args.invoiceId,
        asaasInvoiceId: result.invoiceId,
      });
      
      console.log(`✅ Invoice generated successfully: ${result.invoiceId}`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Invoice generation failed for ${args.invoiceId}:`, errorMessage);
      
      // Update invoice record with error (non-blocking)
      await ctx.runMutation(internal.payments.updateInvoiceError, {
        invoiceId: args.invoiceId,
        errorMessage,
      });
      
      // Detailed admin alert
      console.error(`🚨 ADMIN ALERT: Invoice generation failed`, {
        invoiceId: args.invoiceId,
        orderId: (await ctx.runQuery(internal.payments.getInvoiceById, {
          invoiceId: args.invoiceId,
        }))?.orderId,
        error: errorMessage,
        troubleshooting: {
          step1: 'Verify invoice features are enabled in your Asaas account settings',
          step2: 'Check fiscal service description in ASAAS_FISCAL_SERVICE env var (default: "02964 | 1.09")',
          step3: 'Ensure digital certificate is uploaded if required by your municipality',
          step4: 'Verify fiscal info is complete in Asaas dashboard',
          step5: 'Test endpoint: GET /fiscalInfo/services?description=02964%20%7C%201.09',
          note: 'Payment has been processed successfully - only invoice generation failed'
        }
      });
    }
    
    return null;
  },
});

// Helper queries and mutations for invoice processing
export const getInvoiceById = internalQuery({
  args: { invoiceId: v.id('invoices') },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.invoiceId);
  },
});

export const updateInvoiceServiceId = internalMutation({
  args: {
    invoiceId: v.id('invoices'),
    municipalServiceId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invoiceId, {
      municipalServiceId: args.municipalServiceId,
      status: 'processing',
    });
    return null;
  },
});

export const updateInvoiceSuccess = internalMutation({
  args: {
    invoiceId: v.id('invoices'),
    asaasInvoiceId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invoiceId, {
      asaasInvoiceId: args.asaasInvoiceId,
      status: 'issued',
      issuedAt: Date.now(),
    });
    return null;
  },
});

export const updateInvoiceError = internalMutation({
  args: {
    invoiceId: v.id('invoices'),
    errorMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invoiceId, {
      status: 'failed',
      errorMessage: args.errorMessage,
    });
    return null;
  },
});

/**
 * Get invoice status for an order (for admin dashboard)
 */
export const getInvoiceForOrder = query({
  args: {
    orderId: v.id('pendingOrders'),
  },
  returns: v.union(
    v.object({
      _id: v.id('invoices'),
      status: v.string(),
      asaasInvoiceId: v.optional(v.string()),
      invoiceUrl: v.optional(v.string()),
      errorMessage: v.optional(v.string()),
      createdAt: v.number(),
      issuedAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const invoice = await ctx.db
      .query('invoices')
      .withIndex('by_order', q => q.eq('orderId', args.orderId))
      .first();
    
    if (!invoice) {
      return null;
    }
    
    return {
      _id: invoice._id,
      status: invoice.status,
      asaasInvoiceId: invoice.asaasInvoiceId,
      invoiceUrl: invoice.invoiceUrl,
      errorMessage: invoice.errorMessage,
      createdAt: invoice.createdAt,
      issuedAt: invoice.issuedAt,
    };
  },
});