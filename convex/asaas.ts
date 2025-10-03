import { v } from "convex/values";
import { api } from "./_generated/api";
import { action } from "./_generated/server";

// Asaas API Types
interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  mobilePhone?: string;
}

interface AsaasPayment {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'RECEIVED' | 'OVERDUE' | 'REFUNDED' | 'RECEIVED_IN_CASH_UNDONE' | 'CHARGEBACK_REQUESTED' | 'CHARGEBACK_DISPUTE' | 'AWAITING_CHARGEBACK_REVERSAL' | 'DUNNING_REQUESTED' | 'DUNNING_RECEIVED' | 'AWAITING_RISK_ANALYSIS';
  value: number;
  netValue?: number;
  paymentDate?: string;
  confirmedDate?: string;
  dueDate: string;
  billingType: 'PIX' | 'CREDIT_CARD';
  customer: string;
  description?: string;
  externalReference?: string;
  invoiceUrl?: string;
}

interface AsaasCreditCardData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

interface AsaasPixQrCode {
  encodedImage: string;
  payload: string;
  expirationDate: string;
}

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

  async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
  }): Promise<AsaasCustomer> {
    return this.makeRequest<AsaasCustomer>('/customers', {
      method: 'POST',
      body: JSON.stringify(customer),
    });
  }

  async createCharge(charge: {
    customer: string;
    billingType: 'PIX' | 'CREDIT_CARD';
    value: number;
    dueDate: string;
    description?: string;
    externalReference?: string;
    creditCard?: AsaasCreditCardData;
    creditCardHolderInfo?: {
      name: string;
      email: string;
      cpfCnpj: string;
      postalCode?: string;
      addressNumber?: string;
      phone?: string;
      mobilePhone?: string;
    };
    remoteIp?: string;
  }): Promise<AsaasPayment> {
    return this.makeRequest<AsaasPayment>('/payments', {
      method: 'POST',
      body: JSON.stringify(charge),
    });
  }

  async getPixQrCode(chargeId: string): Promise<AsaasPixQrCode> {
    return this.makeRequest<AsaasPixQrCode>(`/payments/${chargeId}/pixQrCode`);
  }
}


/**
 * Create AsaaS customer for transparent checkout
 */
export const createAsaasCustomer = action({
  args: {
    name: v.string(),
    email: v.string(),
    cpf: v.string(),
  },
  returns: v.object({
    customerId: v.string(),
  }),
  handler: async (ctx, args) => {
    const asaas = new AsaasClient();
    
    const customer = await asaas.createCustomer({
      name: args.name,
      email: args.email,
      cpfCnpj: args.cpf.replace(/\D/g, ''),
    });

    return {
      customerId: customer.id,
    };
  },
});

/**
 * Create PIX payment for transparent checkout
 */
export const createPixPayment = action({
  args: {
    customerId: v.string(),
    productId: v.string(),
    pendingOrderId: v.string(),
  },
  returns: v.object({
    paymentId: v.string(),
    value: v.number(),
    qrPayload: v.optional(v.string()),
    qrCodeBase64: v.optional(v.string()),
    expirationDate: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Get the pending order to get the final price (with coupons already applied)
    const pendingOrder: any = await ctx.runQuery(api.payments.getPendingOrderById, {
      orderId: args.pendingOrderId,
    });

    if (!pendingOrder) {
      throw new Error('Pending order not found');
    }

    // Use the final price from the pending order (already includes coupon and PIX discounts)
    const finalPrice = pendingOrder.finalPrice;
    
    if (finalPrice <= 0) {
      throw new Error('Invalid product price');
    }

    // Get pricing plan for description
    const pricingPlan: any = await ctx.runQuery(api.pricingPlans.getByProductId, {
      productId: args.productId,
    });

    if (!pricingPlan || !pricingPlan.isActive) {
      throw new Error('Product not found or inactive');
    }

    const asaas = new AsaasClient();
    
    // Build description with coupon info if applicable
    let description = `${pricingPlan.name} - PIX`;
    if (pendingOrder.couponCode) {
      description += ` (Cupom: ${pendingOrder.couponCode})`;
    }

    // Create PIX payment with pendingOrderId as externalReference
    const payment = await asaas.createCharge({
      customer: args.customerId,
      billingType: 'PIX',
      value: finalPrice,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
      description,
      externalReference: args.pendingOrderId, // This is the key for webhook correlation
    });

    // Get PIX QR Code
    let pixData: AsaasPixQrCode | null = null;
    try {
      pixData = await asaas.getPixQrCode(payment.id);
    } catch (error) {
      console.warn('Failed to get PIX QR code immediately, will retry:', error);
      
      // Sometimes the QR code is not immediately available, wait a bit and retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        pixData = await asaas.getPixQrCode(payment.id);
      } catch (retryError) {
        console.error('Failed to get PIX QR code after retry:', retryError);
      }
    }

    return {
      paymentId: payment.id,
      value: finalPrice,
      qrPayload: pixData?.payload,
      qrCodeBase64: pixData?.encodedImage,
      expirationDate: pixData?.expirationDate,
    };
  },
});

/**
 * Create Credit Card payment for transparent checkout
 */
export const createCreditCardPayment = action({
  args: {
    customerId: v.string(),
    productId: v.string(),
    pendingOrderId: v.string(),
    creditCard: v.object({
      holderName: v.string(),
      number: v.string(),
      expiryMonth: v.string(),
      expiryYear: v.string(),
      ccv: v.string(),
    }),
    creditCardHolderInfo: v.object({
      name: v.string(),
      email: v.string(),
      cpfCnpj: v.string(),
      postalCode: v.optional(v.string()),
      addressNumber: v.optional(v.string()),
      phone: v.optional(v.string()),
      mobilePhone: v.optional(v.string()),
    }),
    remoteIp: v.optional(v.string()),
  },
  returns: v.object({
    paymentId: v.string(),
    value: v.number(),
    status: v.string(),
    creditCardToken: v.optional(v.string()),
    invoiceUrl: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Get the pending order to get the final price (with coupons already applied)
    const pendingOrder: any = await ctx.runQuery(api.payments.getPendingOrderById, {
      orderId: args.pendingOrderId,
    });

    if (!pendingOrder) {
      throw new Error('Pending order not found');
    }

    // Use the final price from the pending order (already includes coupon discount, but not PIX)
    const finalPrice = pendingOrder.finalPrice;
    
    if (finalPrice <= 0) {
      throw new Error('Invalid product price');
    }

    // Get pricing plan for description
    const pricingPlan: any = await ctx.runQuery(api.pricingPlans.getByProductId, {
      productId: args.productId,
    });

    if (!pricingPlan || !pricingPlan.isActive) {
      throw new Error('Product not found or inactive');
    }

    const asaas = new AsaasClient();
    
    // Build description with coupon info if applicable
    let description = `${pricingPlan.name} - Cartão de Crédito`;
    if (pendingOrder.couponCode) {
      description += ` (Cupom: ${pendingOrder.couponCode})`;
    }
    
    // Create Credit Card payment with immediate processing
    const payment = await asaas.createCharge({
      customer: args.customerId,
      billingType: 'CREDIT_CARD',
      value: finalPrice,
      dueDate: new Date().toISOString().split('T')[0], // Today (immediate processing)
      description,
      externalReference: args.pendingOrderId, // This is the key for webhook correlation
      creditCard: args.creditCard,
      creditCardHolderInfo: args.creditCardHolderInfo,
      ...(args.remoteIp && { remoteIp: args.remoteIp }),
    });

    return {
      paymentId: payment.id,
      value: finalPrice,
      status: payment.status,
      creditCardToken: (payment as any).creditCardToken,
      invoiceUrl: payment.invoiceUrl,
    };
  },
});

/**
 * Get payment status from AsaaS
 */
export const getPaymentStatus = action({
  args: {
    paymentId: v.string(),
  },
  returns: v.object({
    status: v.string(),
    paymentId: v.string(),
    value: v.number(),
    paymentDate: v.optional(v.string()),
    confirmedDate: v.optional(v.string()),
    dueDate: v.string(),
    asaasStatus: v.string(),
  }),
  handler: async (ctx, args) => {
    const asaas = new AsaasClient();
    
    const payment = await asaas.makeRequest<AsaasPayment>(`/payments/${args.paymentId}`);

    // Map AsaaS status to our status
    let status = 'pending';
    switch (payment.status) {
      case 'CONFIRMED':
      case 'RECEIVED':
        status = 'confirmed';
        break;
      case 'PENDING':
        status = 'pending';
        break;
      case 'OVERDUE':
        status = 'expired';
        break;
      case 'REFUNDED':
      case 'RECEIVED_IN_CASH_UNDONE':
      case 'CHARGEBACK_REQUESTED':
      case 'CHARGEBACK_DISPUTE':
      case 'AWAITING_CHARGEBACK_REVERSAL':
      case 'DUNNING_REQUESTED':
      case 'DUNNING_RECEIVED':
      case 'AWAITING_RISK_ANALYSIS':
        status = 'failed';
        break;
      default:
        status = 'pending';
    }

    return {
      status,
      paymentId: payment.id,
      value: payment.value,
      paymentDate: payment.paymentDate,
      confirmedDate: payment.confirmedDate,
      dueDate: payment.dueDate,
      asaasStatus: payment.status,
    };
  },
});

