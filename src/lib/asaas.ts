
import { NextResponse } from 'next/server';

export interface AsaasCustomer {
  id?: string;
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  mobilePhone?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  postalCode?: string;
  city?: string;
  state?: string;
}

export interface AsaasCharge {
  customer: string; // Customer ID
  billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED';
  value: number;
  dueDate: string; // YYYY-MM-DD format
  description?: string;
  externalReference?: string;
  installmentCount?: number;
  installmentValue?: number;
  discount?: {
    value: number;
    dueDateLimitDays: number;
    type: 'FIXED' | 'PERCENTAGE';
  };
  interest?: {
    value: number;
    type: 'PERCENTAGE';
  };
  fine?: {
    value: number;
    type: 'FIXED' | 'PERCENTAGE';
  };
  postalService?: boolean;
}

export interface AsaasChargeResponse {
  object: string;
  id: string;
  dateCreated: string;
  customer: string;
  subscription?: string;
  installment?: string;
  paymentLink?: string;
  dueDate: string;
  originalDueDate: string;
  value: number;
  netValue: number;
  originalValue?: number;
  interestValue?: number;
  description: string;
  billingType: string;
  pixTransaction?: string;
  status: string;
  externalReference: string;
  confirmedDate?: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  installmentNumber?: number;
  invoiceUrl?: string;
  invoiceNumber?: string;
  bankSlipUrl?: string;
  transactionReceiptUrl?: string;
  nossoNumero?: string;
  pixQrCodeId?: string;
  pixCopyAndPaste?: string;
}

export interface AsaasPixQrCodeResponse {
  encodedImage: string;
  payload: string;
  expirationDate: string;
}

export class AsaasClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://api.asaas.com/v3'
      : 'https://api-sandbox.asaas.com/v3';
    this.apiKey = process.env.ASAAS_API_KEY!;
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
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

  async createCustomer(customer: AsaasCustomer): Promise<AsaasCustomer> {
    return this.makeRequest<AsaasCustomer>('/customers', {
      method: 'POST',
      body: JSON.stringify(customer),
    });
  }

  async getCustomer(customerId: string): Promise<AsaasCustomer> {
    return this.makeRequest<AsaasCustomer>(`/customers/${customerId}`);
  }

  async updateCustomer(customerId: string, customer: Partial<AsaasCustomer>): Promise<AsaasCustomer> {
    return this.makeRequest<AsaasCustomer>(`/customers/${customerId}`, {
      method: 'PUT',
      body: JSON.stringify(customer),
    });
  }

  async getCustomerByEmail(email: string): Promise<{ data: AsaasCustomer[] }> {
    return this.makeRequest<{ data: AsaasCustomer[] }>(`/customers?email=${encodeURIComponent(email)}`);
  }

  async createCharge(charge: AsaasCharge): Promise<AsaasChargeResponse> {
    return this.makeRequest<AsaasChargeResponse>('/payments', {
      method: 'POST',
      body: JSON.stringify(charge),
    });
  }

  async getCharge(chargeId: string): Promise<AsaasChargeResponse> {
    return this.makeRequest<AsaasChargeResponse>(`/payments/${chargeId}`);
  }

  async getPixQrCode(chargeId: string): Promise<AsaasPixQrCodeResponse> {
    return this.makeRequest<AsaasPixQrCodeResponse>(`/payments/${chargeId}/pixQrCode`);
  }

  async restoreCharge(chargeId: string): Promise<AsaasChargeResponse> {
    return this.makeRequest<AsaasChargeResponse>(`/payments/${chargeId}/restore`, {
      method: 'POST',
    });
  }

  async refundCharge(chargeId: string, value?: number, description?: string): Promise<any> {
    const body: any = {};
    if (value) body.value = value;
    if (description) body.description = description;

    return this.makeRequest(`/payments/${chargeId}/refund`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
}

export const asaasClient = new AsaasClient();

// Webhook signature verification for AsaaS
export function verifyAsaasSignature(request: Request): NextResponse | null {
  const asaasSignature = request.headers.get('asaas-signature');
  
  if (!asaasSignature) {
    return NextResponse.json(
      { error: 'Missing AsaaS signature header' },
      { status: 400 }
    );
  }

  // AsaaS uses HMAC-SHA256 for webhook verification
  const webhookSecret = process.env.ASAAS_WEBHOOK_SECRET as string;
  
  if (!webhookSecret) {
    console.error('Missing ASAAS_WEBHOOK_SECRET environment variable');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  // For AsaaS, we need to get the raw body to verify signature
  // This will be handled in the actual webhook endpoint
  return null;
}

export default asaasClient;
