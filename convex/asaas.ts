import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action, internalAction, internalMutation, mutation, query } from "./_generated/server";

// AsaaS API Client
class AsaasClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    // Use ASAAS_ENVIRONMENT to determine sandbox vs production
    const isProduction = process.env.ASAAS_ENVIRONMENT === 'production';
    this.baseUrl = isProduction
      ? 'https://api.asaas.com/v3'
      : 'https://api-sandbox.asaas.com/v3';
    this.apiKey = process.env.ASAAS_API_KEY!;
    
    console.log('AsaaS Environment:', isProduction ? 'production' : 'sandbox');
    console.log('AsaaS Base URL:', this.baseUrl);
    console.log('AsaaS API Key prefix:', this.apiKey?.substring(0, 10) + '...');
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'access_token': this.apiKey,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`AsaaS API Error: ${response.status} - ${errorBody}`);
    }

    return response.json();
  }

  async createCustomer(customer: {
    name: string;
    email: string;
    cpfCnpj: string;
    phone?: string;
    mobilePhone?: string;
    address?: string;
    addressNumber?: string;
    postalCode?: string;
    city?: string;
    state?: string;
  }) {
    return this.makeRequest('/customers', {
      method: 'POST',
      body: JSON.stringify(customer),
    });
  }

  async createCheckout(checkout: {
    customer?: string; // Optional - for existing customers
    customerData?: { // Optional - for new customers with pre-filled data
      name: string;
      cpfCnpj: string;
      email: string;
      phone?: string;
      address?: string;
      addressNumber?: string;
      complement?: string;
      postalCode?: string;
      province?: string;
      city?: string;
    };
    billingTypes: string[];
    chargeTypes: string[];
    items: Array<{
      name: string;
      description?: string;
      value: number;
      quantity: number;
      imageBase64: string; // Required by AsaaS API
      externalReference?: string;
    }>;
    callback: {
      successUrl: string;
      expiredUrl: string;
      cancelUrl: string;
    };
    minutesToExpire?: number;
    externalReference?: string;
  }) {
    return this.makeRequest('/checkouts', {
      method: 'POST',
      body: JSON.stringify(checkout),
    });
  }

  async createCharge(charge: {
    customer: string;
    billingType: 'CREDIT_CARD' | 'PIX';
    value: number;
    dueDate: string;
    description?: string;
    externalReference?: string;
    discount?: {
      value: number;
      dueDateLimitDays: number;
      type: 'FIXED' | 'PERCENTAGE';
    };
  }) {
    return this.makeRequest('/payments', {
      method: 'POST',
      body: JSON.stringify(charge),
    });
  }

  async getPixQrCode(chargeId: string) {
    return this.makeRequest(`/payments/${chargeId}/pixQrCode`);
  }
}

/**
 * Internal mutation para conectar usuário automaticamente após sign-up via webhook
 */
export const linkUserAfterSignup = internalMutation({
  args: { 
    clerkUserId: v.string(),
    email: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    linkedOrders: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    try {
      console.log(`🔗 Linking user ${args.email} (${args.clerkUserId}) to pending orders`);

      // 1. Find only CONFIRMED payments (strict mode)
      const confirmedOrders = await ctx.db
        .query("pendingOrders")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .filter((q) => q.eq(q.field("status"), "paid")) // Only confirmed payments
        .collect();

      if (confirmedOrders.length === 0) {
        console.log(`No confirmed payments found for ${args.email}`);
        return { 
          success: true, 
          message: 'Conta criada com sucesso! Nenhum pagamento confirmado encontrado.',
          linkedOrders: 0
        };
      }

      console.log(`Found ${confirmedOrders.length} confirmed payment(s) for ${args.email}`);

      let linkedCount = 0;

      // 2. Process each confirmed order
      for (const order of confirmedOrders) {
        try {
          // Get pricing plan for this product
          const pricingPlan: any = await ctx.runQuery(api.pricingPlans.getByProductId, {
            productId: order.productId,
          });

          if (!pricingPlan) {
            console.error(`Product not found: ${order.productId}`);
            continue;
          }

          // Create/update user record
          await ctx.runMutation(internal.payments.upsertUser, {
            email: args.email,
            clerkUserId: args.clerkUserId,
            firstName: order.customerData?.firstName || 'Cliente',
            lastName: order.customerData?.lastName || 'OrtoQBank',
            paymentId: '', // Will be set by payment webhook
            paymentGateway: 'asaas',
            paymentDate: new Date().toISOString(),
            paymentStatus: 'RECEIVED', // All orders here are confirmed
            paid: true, // All orders here are paid
            status: 'active', // Immediate access for confirmed payments
          });

          // Update order with user info
          await ctx.db.patch(order._id, {
            status: 'provisionable',
            customerData: {
              firstName: 'Cliente',
              lastName: 'OrtoQBank',
              cpf: '', // Required field
            }
          });

          linkedCount++;
          console.log(`✅ Linked order ${order._id} to user ${args.clerkUserId}`);

        } catch (error) {
          console.error(`Error processing order ${order._id}:`, error);
        }
      }

      return { 
        success: true, 
        message: `Conta criada! ${linkedCount} compra(s) vinculada(s). Acesso será liberado após confirmação do pagamento.`,
        linkedOrders: linkedCount
      };

    } catch (error) {
      console.error('Error in linkUserAfterSignup:', error);
      return { 
        success: false, 
        message: 'Erro interno. Entre em contato com o suporte.',
        linkedOrders: 0
      };
    }
  },
});

/**
 * Mutation para conectar usuário Clerk a uma compra após sign-up (fallback manual)
 */
export const linkUserToPayment = mutation({
  args: { 
    orderId: v.id("pendingOrders"),
    clerkUserId: v.string(),
    email: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      // 1. Buscar a ordem pendente
      const pendingOrder = await ctx.db.get(args.orderId);
      if (!pendingOrder) {
        return { success: false, message: 'Ordem não encontrada' };
      }

      // 2. Verificar se já foi processada
      if (pendingOrder.status === 'completed') {
        return { success: false, message: 'Ordem já foi processada' };
      }

      // 3. Buscar detalhes do produto
      const pricingPlan: any = await ctx.runQuery(api.pricingPlans.getByProductId, {
        productId: pendingOrder.productId,
      });

      if (!pricingPlan) {
        return { success: false, message: 'Produto não encontrado' };
      }

      // 4. Criar/atualizar usuário
      await ctx.runMutation(internal.payments.upsertUser, {
        email: args.email,
        clerkUserId: args.clerkUserId,
        firstName: 'Cliente',
        lastName: 'OrtoQBank',
        paymentId: '', // Will be set by webhook
        paymentGateway: 'asaas',
        paymentDate: new Date().toISOString(),
        paymentStatus: 'PENDING', // Will be updated by webhook
        paid: false, // Will be updated by webhook
        status: 'invited', // Use valid status
      });

      // 5. Atualizar ordem com dados do usuário
      await ctx.db.patch(args.orderId, {
        email: args.email,
        status: 'provisionable',
        customerData: {
          firstName: 'Cliente',
          lastName: 'OrtoQBank',
          cpf: '', // Required field
        }
      });

      return { 
        success: true, 
        message: 'Conta vinculada! O acesso será liberado após confirmação do pagamento.' 
      };

    } catch (error) {
      console.error('Erro ao vincular usuário ao pagamento:', error);
      return { 
        success: false, 
        message: 'Erro interno. Entre em contato com o suporte.' 
      };
    }
  },
});

// Constants
const REGULAR_PRICE = 39.9;
const PIX_PRICE = 34.9;
const PRODUCT_ID = "ortoqbank_2025";

// Helper function to calculate discounted price
function calculateDiscountedPrice(
  originalPrice: number,
  coupon?: any,
): {
  finalPrice: number;
  discountAmount: number;
  discountDescription: string;
} {
  if (!coupon) {
    return {
      finalPrice: originalPrice,
      discountAmount: 0,
      discountDescription: '',
    };
  }

  let discountAmount = 0;
  let discountDescription = '';

  switch (coupon.type) {
    case 'percentage':
      discountAmount = (originalPrice * coupon.value) / 100;
      discountDescription = `${coupon.value}% de desconto`;
      break;
    case 'fixed':
      discountAmount = coupon.value;
      discountDescription = `R$ ${coupon.value.toFixed(2)} de desconto`;
      break;
    case 'fixed_price':
      discountAmount = originalPrice - coupon.value;
      discountDescription = `Preço promocional R$ ${coupon.value.toFixed(2)}`;
      break;
  }

  return {
    finalPrice: Math.max(0, originalPrice - discountAmount),
    discountAmount,
    discountDescription,
  };
}

/**
 * Create AsaaS Hosted Checkout - Following AsaaS best practices
 */
export const createHostedCheckout = action({
  args: {
    productId: v.string(),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    cpf: v.string(),
    phone: v.optional(v.string()),
    address: v.optional(v.object({
      street: v.string(),
      number: v.string(),
      zipcode: v.string(),
      city: v.string(),
      state: v.string(),
    })),
  },
  returns: v.object({
    success: v.boolean(),
    checkoutId: v.string(),
    checkoutUrl: v.string(),
    expiresAt: v.string(),
    productName: v.string(),
    originalPrice: v.number(),
    pixPrice: v.number(),
  }),
  handler: async (ctx, args) => {
    // Get pricing plan details
    const pricingPlan: any = await ctx.runQuery(api.pricingPlans.getByProductId, {
      productId: args.productId,
    });

    if (!pricingPlan || !pricingPlan.isActive) {
      throw new Error('Product not found or inactive');
    }

    const regularPrice = pricingPlan.regularPriceNum || 0;
    const pixPrice = pricingPlan.pixPriceNum || 0;
    const asaas = new AsaasClient();

    // 1. Create customer (following best practice of reusing customers)
    const customerData = {
      name: `${args.firstName} ${args.lastName}`,
      email: args.email,
      cpfCnpj: args.cpf,
      phone: args.phone,
      mobilePhone: args.phone,
      externalReference: `customer_${args.email}`,
      ...(args.address && {
        postalCode: args.address.zipcode,
        address: args.address.street,
        addressNumber: args.address.number,
        city: args.address.city,
        state: args.address.state,
        country: 'Brasil',
      }),
    };

    const customer: any = await asaas.createCustomer(customerData);

    // 2. Create hosted checkout with all required fields (best practices)
    const checkoutData = {
      customer: customer.id,
      // Required: Support multiple payment methods
      billingTypes: ['CREDIT_CARD', 'PIX' , 'UNDEFINED'],
      chargeTypes: ['DETACHED'], // For flexible payment options
      // Required: Items with clear name and description
      items: [
        {
          name: pricingPlan.name,
          description: pricingPlan.description || `Acesso ao ${pricingPlan.name}`,
          value: regularPrice,
          quantity: 1,
          imageBase64: "", // Required by AsaaS API - empty string for no image
        }
      ],
      // Required: Callback URLs
      callback: {
        successUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/payment/success?order={CHECKOUT_ID}`,
        expiredUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/payment/expired`,
        cancelUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/payment/cancel`,
      },
      // Strategic expiration (24 hours)
      minutesToExpire: 60 * 24,
      externalReference: `${args.productId}_checkout_${Date.now()}`,
    };

    const checkout: any = await asaas.createCheckout(checkoutData);

    // 3. Store pending order in Convex
    await ctx.runMutation(internal.asaas.createPendingOrder, {
      checkoutId: checkout.id,
      email: args.email,
      productId: args.productId,
      originalPrice: regularPrice,
      finalPrice: regularPrice,
      pixPrice: pixPrice,
      couponCode: undefined,
      discountAmount: 0,
      customerData: {
        firstName: args.firstName,
        lastName: args.lastName,
        cpf: args.cpf,
        phone: args.phone,
        address: args.address,
      },
      asaasCustomerId: customer.id,
      asaasChargeId: checkout.id,
      asaasPixChargeId: '', // Will be filled when payment is made
    });

    return {
      success: true,
      checkoutId: checkout.id,
      checkoutUrl: checkout.url,
      expiresAt: checkout.expiresAt,
      productName: pricingPlan.name,
      originalPrice: regularPrice,
      pixPrice: pixPrice,
    };
  },
});

/**
 * ✅ PADRÃO RECOMENDADO CONVEX: Mutation que captura intenção e agenda action
 * 
 * Esta mutation:
 * 1. Captura a intenção do usuário no database
 * 2. Agenda a action para processar o checkout AsaaS
 * 3. Cliente pode monitorar o progresso via subscription
 */
export const initiateCheckout = mutation({
  args: {
    productId: v.string(),
    email: v.optional(v.string()), // Optional for zero-friction checkout
  },
  returns: v.object({
    success: v.boolean(),
    checkoutRequestId: v.id("pendingOrders"),
    status: v.string(),
  }),
  handler: async (ctx, args) => {
    // 1. Validar produto
    const pricingPlan: any = await ctx.runQuery(api.pricingPlans.getByProductId, {
      productId: args.productId,
    });

    if (!pricingPlan || !pricingPlan.isActive) {
      throw new Error(`Product not found or inactive: ${args.productId}`);
    }

    // 2. Criar pedido pendente no database (captura intenção)
    // Generate temporary email if none provided (zero-friction checkout)
    const email = args.email || `temp_${Date.now()}@checkout.temp`;
    
    const checkoutRequestId = await ctx.db.insert("pendingOrders", {
      checkoutId: `temp_${Date.now()}`, // Será atualizado pela action
      email: email,
      productId: args.productId,
      originalPrice: pricingPlan.regularPriceNum || 0,
      finalPrice: pricingPlan.regularPriceNum || 0,
      pixPrice: pricingPlan.pixPriceNum || 0,
      couponCode: undefined,
      discountAmount: 0,
      asaasCustomerId: '', // Será preenchido pela action
      asaasChargeId: '', // Será preenchido pela action
      asaasPixChargeId: '',
      status: 'creating', // Status inicial
      createdAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 horas
    });

    // 3. Agenda action para processar checkout na AsaaS
    await ctx.scheduler.runAfter(0, internal.asaas.processCheckoutCreation, {
      checkoutRequestId,
      productId: args.productId,
      email: email,
    });

    return {
      success: true,
      checkoutRequestId,
      status: 'creating',
    };
  },
});

/**
 * Action agendada para processar criação do checkout na AsaaS
 */
export const processCheckoutCreation = internalAction({
  args: {
    checkoutRequestId: v.id("pendingOrders"),
    productId: v.string(),
    email: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    try {
      // Buscar detalhes do produto
      const pricingPlan: any = await ctx.runQuery(api.pricingPlans.getByProductId, {
        productId: args.productId,
      });

      if (!pricingPlan) {
        throw new Error(`Product not found: ${args.productId}`);
      }

      const asaas = new AsaasClient();

      // Skip customer creation for lowest friction - let customer enter data on checkout page
      // Criar checkout hospedado na AsaaS
      // AsaaS Checkout API structure based on official documentation
      const checkoutData = {
        // Required fields according to AsaaS docs
        billingTypes: ['CREDIT_CARD', 'PIX'],
        chargeTypes: ['DETACHED'],
        items: [
          {
            name: pricingPlan.name,
            description: pricingPlan.description || `Acesso ao ${pricingPlan.name}`,
            value: 10.00,
            quantity: 1,
            imageBase64: "", // Required by AsaaS API - empty string for no image
          }
        ],
          callback: {
            successUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/payment/processing?order=${args.checkoutRequestId}`,
            expiredUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/payment/expired`,
            cancelUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/payment/cancel`,
          },
        minutesToExpire: 1440, // 24 hours in minutes
        externalReference: args.checkoutRequestId, // Use the actual order ID
      };

      const checkout: any = await asaas.createCheckout(checkoutData);

      // Atualizar pendingOrder com dados do checkout
      await ctx.runMutation(internal.asaas.updatePendingOrderWithCheckout, {
        checkoutRequestId: args.checkoutRequestId,
        checkoutId: checkout.id,
        checkoutUrl: checkout.link, // AsaaS returns URL in 'link' field
        asaasCustomerId: '', // No customer created - lowest friction
        status: 'ready',
      });

      console.log('✅ Checkout criado com sucesso:', {
        checkoutRequestId: args.checkoutRequestId,
        checkoutId: checkout.id,
        checkoutUrl: checkout.link,
      });

    } catch (error) {
      console.error('Erro ao processar checkout:', error);
      
      // Atualizar status como erro
      await ctx.runMutation(internal.asaas.updatePendingOrderStatus, {
        checkoutRequestId: args.checkoutRequestId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return null;
  },
});

/**
 * Mutation para atualizar pendingOrder com dados do checkout
 */
export const updatePendingOrderWithCheckout = internalMutation({
  args: {
    checkoutRequestId: v.id("pendingOrders"),
    checkoutId: v.string(),
    checkoutUrl: v.string(),
    asaasCustomerId: v.string(),
    status: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.checkoutRequestId, {
      checkoutId: args.checkoutId,
      asaasCustomerId: args.asaasCustomerId,
      asaasChargeId: args.checkoutId,
      status: args.status as "creating" | "ready" | "pending" | "paid" | "provisionable" | "completed" | "failed",
      checkoutUrl: args.checkoutUrl,
    });
    return null;
  },
});

/**
 * Mutation para atualizar status do pedido
 */
export const updatePendingOrderStatus = internalMutation({
  args: {
    checkoutRequestId: v.id("pendingOrders"),
    status: v.string(),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updateData: any = {
      status: args.status,
    };
    
    if (args.error) {
      updateData.errorMessage = args.error;
    }

    await ctx.db.patch(args.checkoutRequestId, updateData);
    return null;
  },
});

/**
 * Query para monitorar status do checkout
 */
export const getCheckoutStatus = query({
  args: {
    checkoutRequestId: v.id("pendingOrders"),
  },
  returns: v.union(
    v.null(),
    v.object({
      status: v.string(),
      checkoutUrl: v.optional(v.string()),
      error: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.checkoutRequestId);
    
    if (!order) {
      return null;
    }

    return {
      status: order.status,
      checkoutUrl: order.checkoutUrl,
      error: order.errorMessage,
    };
  },
});

/**
 * Create AsaaS checkout - Direct charges (Legacy method)
 */
export const createCheckout = action({
  args: {
    productId: v.string(), // Which product to purchase
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    cpf: v.string(),
    phone: v.optional(v.string()),
    address: v.optional(v.object({
      street: v.string(),
      number: v.string(),
      zipcode: v.string(),
      city: v.string(),
      state: v.string(),
    })),
    couponCode: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    checkoutId: v.string(),
    chargeId: v.string(),
    pixChargeId: v.string(),
    customerId: v.string(),
    // Payment URLs
    invoiceUrl: v.optional(v.string()),
    bankSlipUrl: v.optional(v.string()),
    // PIX data
    pixQrCode: v.optional(v.string()),
    pixCopyPaste: v.optional(v.string()),
    pixExpirationDate: v.optional(v.string()),
    // Pricing info
    originalPrice: v.number(),
    regularPrice: v.number(),
    pixPrice: v.number(),
    couponApplied: v.optional(v.string()),
    discountAmount: v.number(),
    discountDescription: v.string(),
  }),
  handler: async (ctx, args): Promise<{
    success: boolean;
    checkoutId: string;
    chargeId: string;
    pixChargeId: string;
    customerId: string;
    invoiceUrl: string;
    bankSlipUrl?: string;
    pixQrCode?: string;
    pixCopyPaste?: string;
    pixExpirationDate?: string;
    originalPrice: number;
    regularPrice: number;
    pixPrice: number;
    couponApplied?: string;
    discountAmount: number;
    discountDescription: string;
  }> => {
    // Get pricing plan details
    const pricingPlan: any = await ctx.runQuery(api.pricingPlans.getByProductId, {
      productId: args.productId,
    });

    if (!pricingPlan || !pricingPlan.isActive) {
      throw new Error('Product not found or inactive');
    }

    // TODO: Add coupon validation later if needed
    // For now, use direct pricing from the plan
    const regularPrice = pricingPlan.regularPriceNum || 0;
    const pixPrice = pricingPlan.pixPriceNum || 0;

    const asaas = new AsaasClient();

    // Create or get customer
    const customerData = {
      name: `${args.firstName} ${args.lastName}`,
      email: args.email,
      cpfCnpj: args.cpf.replace(/\D/g, ''),
      ...(args.phone && {
        phone: args.phone.replace(/\D/g, ''),
        mobilePhone: args.phone.replace(/\D/g, ''),
      }),
      ...(args.address && {
        address: args.address.street,
        addressNumber: args.address.number,
        postalCode: args.address.zipcode.replace(/\D/g, ''),
        city: args.address.city,
        state: args.address.state,
      }),
    };

    const customer: any = await asaas.createCustomer(customerData);

    // Create description
    let description = pricingPlan.name;

    // Calculate due date
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    // Create main charge (CREDIT_CARD default)
    const chargeData = {
      customer: customer.id,
      billingType: 'CREDIT_CARD' as const,
      value: regularPrice,
      dueDate: dueDateStr,
      description,
      externalReference: `${args.productId}_${Date.now()}`,
    };

    const charge: any = await asaas.createCharge(chargeData);

    // Create PIX charge
    const pixChargeData = {
      customer: customer.id,
      billingType: 'PIX' as const,
      value: pixPrice,
      dueDate: dueDateStr,
      description: description + ' - PIX',
      externalReference: `${charge.externalReference}-pix`,
    };

    const pixCharge: any = await asaas.createCharge(pixChargeData);

    // Get PIX QR code
    let pixQrCode: any = {};
    try {
      pixQrCode = await asaas.getPixQrCode(pixCharge.id);
    } catch (error) {
      console.warn('Failed to generate PIX QR code:', error);
    }

    // Store pending order in Convex
    await ctx.runMutation(internal.asaas.createPendingOrder, {
      checkoutId: charge.externalReference,
      email: args.email,
      productId: args.productId,
      originalPrice: pricingPlan.regularPriceNum || 0,
      finalPrice: regularPrice,
      pixPrice: pixPrice,
      couponCode: args.couponCode,
      discountAmount: 0,
      customerData: {
        firstName: args.firstName,
        lastName: args.lastName,
        cpf: args.cpf,
        phone: args.phone,
        address: args.address,
      },
      asaasCustomerId: customer.id,
      asaasChargeId: charge.id,
      asaasPixChargeId: pixCharge.id,
    });

    return {
      success: true,
      checkoutId: charge.externalReference,
      chargeId: charge.id,
      pixChargeId: pixCharge.id,
      customerId: customer.id,
      // Payment URLs
      invoiceUrl: charge.invoiceUrl,
      bankSlipUrl: charge.bankSlipUrl,
      // PIX data
      pixQrCode: pixQrCode?.encodedImage,
      pixCopyPaste: pixQrCode?.payload,
      pixExpirationDate: pixQrCode?.expirationDate,
      // Pricing info
      originalPrice: pricingPlan.regularPriceNum || 0,
      regularPrice: regularPrice,
      pixPrice: pixPrice,
      couponApplied: args.couponCode?.toUpperCase(),
      discountAmount: 0,
      discountDescription: 'No discount applied',
    };
  },
});

/**
 * Create pending order (internal)
 */
export const createPendingOrder = internalMutation({
  args: {
    checkoutId: v.string(),
    email: v.string(),
    productId: v.string(),
    originalPrice: v.number(),
    finalPrice: v.number(),
    pixPrice: v.number(),
    couponCode: v.optional(v.string()),
    discountAmount: v.optional(v.number()),
    customerData: v.object({
      firstName: v.string(),
      lastName: v.string(),
      cpf: v.string(),
      phone: v.optional(v.string()),
      address: v.optional(v.object({
        street: v.string(),
        number: v.string(),
        zipcode: v.string(),
        city: v.string(),
        state: v.string(),
      })),
    }),
    asaasCustomerId: v.string(),
    asaasChargeId: v.string(),
    asaasPixChargeId: v.string(),
  },
  returns: v.id("pendingOrders"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("pendingOrders", {
      checkoutId: args.checkoutId,
      email: args.email,
      productId: args.productId,
      originalPrice: args.originalPrice,
      finalPrice: args.finalPrice,
      pixPrice: args.pixPrice,
      couponCode: args.couponCode,
      discountAmount: args.discountAmount,
      customerData: args.customerData,
      asaasCustomerId: args.asaasCustomerId,
      asaasChargeId: args.asaasChargeId,
      asaasPixChargeId: args.asaasPixChargeId,
      status: "pending",
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours from now
    });
  },
});

/**
 * Create pending order - public mutation (duplicate, keeping for backwards compatibility)
 */
export const createPendingOrderPublic = mutation({
  args: {
    checkoutId: v.string(),
    email: v.string(),
    productId: v.string(),
    originalPrice: v.number(),
    finalPrice: v.number(),
    pixPrice: v.number(),
    couponCode: v.optional(v.string()),
    discountAmount: v.number(),
    customerData: v.object({
      firstName: v.string(),
      lastName: v.string(),
      cpf: v.string(),
      phone: v.optional(v.string()),
      address: v.optional(v.object({
        street: v.string(),
        number: v.string(),
        zipcode: v.string(),
        city: v.string(),
        state: v.string(),
      })),
    }),
    asaasCustomerId: v.string(),
    asaasChargeId: v.string(),
    asaasPixChargeId: v.string(),
  },
  returns: v.id("pendingOrders"),
  handler: async (ctx, args) => {
    // Check if order already exists
    const existingOrder = await ctx.db
      .query("pendingOrders")
      .withIndex("by_checkout_id", (q) => q.eq("checkoutId", args.checkoutId))
      .unique();

    if (existingOrder) {
      throw new Error("Order already exists");
    }

    // Create expiration time (24 hours from now)
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000);

    return await ctx.db.insert("pendingOrders", {
      checkoutId: args.checkoutId,
      email: args.email,
      productId: args.productId,
      status: "pending",
      originalPrice: args.originalPrice,
      finalPrice: args.finalPrice,
      pixPrice: args.pixPrice,
      couponCode: args.couponCode,
      discountAmount: args.discountAmount,
      customerData: args.customerData,
      asaasCustomerId: args.asaasCustomerId,
      asaasChargeId: args.asaasChargeId,
      asaasPixChargeId: args.asaasPixChargeId,
      expiresAt,
    });
  },
});

/**
 * Get pending order by checkout ID
 */
export const getPendingOrder = query({
  args: { checkoutId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pendingOrders")
      .withIndex("by_checkout_id", (q) => q.eq("checkoutId", args.checkoutId))
      .unique();
  },
});

// TODO: Implement coupon validation later
// For now, coupon functionality is disabled
