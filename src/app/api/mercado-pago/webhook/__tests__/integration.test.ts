/* eslint-disable playwright/no-standalone-expect */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '../route';

// Mock the entire mercadopago module
vi.mock('mercadopago', () => ({
  Payment: vi.fn(),
}));

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: vi.fn(),
  setTag: vi.fn(),
  captureMessage: vi.fn(),
  captureException: vi.fn(),
  withScope: vi.fn(callback => callback({})),
}));

// Mock handle payments
const mockHandleMercadoPagoPayment = vi.fn();
vi.mock('@/lib/handle-payments', () => ({
  handleMercadoPagoPayment: mockHandleMercadoPagoPayment,
}));

// Mock signature verification (simulate valid signature)
vi.mock('@/lib/mercado-pago', () => ({
  default: {},
  verifyMercadoPagoSignature: vi.fn(() => null), // null = valid signature
}));

const createWebhookRequest = (
  body: any,
  headers: Record<string, string> = {},
) => {
  return new NextRequest('http://localhost:3000/api/mercado-pago/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
};

describe('Webhook Integration Tests - No Real Payments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test with realistic Mercado Pago webhook payloads
  describe('Realistic Payment Scenarios', () => {
    it('should handle approved PIX payment correctly', async () => {
      // Arrange - Mock realistic PIX payment response
      const { Payment } = await import('mercadopago');
      const mockPaymentInstance = {
        get: vi.fn().mockResolvedValue({
          id: 1_234_567_890,
          status: 'approved',
          status_detail: 'accredited',
          date_approved: '2023-12-01T14:30:00.000-04:00',
          date_created: '2023-12-01T14:25:00.000-04:00',
          payment_method_id: 'pix',
          payment_type_id: 'bank_transfer',
          transaction_amount: 29.9,
          currency_id: 'BRL',
          payer: {
            id: 987_654_321,
            email: 'test@example.com',
          },
          external_reference: 'test-123',
          metadata: {
            user_email: 'test@example.com',
            final_price: 29.9,
          },
        }),
      };
      (Payment as any).mockImplementation(() => mockPaymentInstance);

      const webhookBody = {
        type: 'payment',
        data: { id: 1_234_567_890 },
        date_created: '2023-12-01T14:30:01.000-04:00',
        user_id: 'your-mercado-pago-user-id',
      };

      const request = createWebhookRequest(webhookBody);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(mockPaymentInstance.get).toHaveBeenCalledWith({
        id: 1_234_567_890,
      });
      expect(mockHandleMercadoPagoPayment).toHaveBeenCalledTimes(1);

      const responseData = await response.json();
      expect(responseData.received).toBe(true);
    });

    it('should handle pending PIX payment correctly', async () => {
      // Arrange - Mock pending PIX payment (common scenario)
      const { Payment } = await import('mercadopago');
      const mockPaymentInstance = {
        get: vi.fn().mockResolvedValue({
          id: 1_234_567_891,
          status: 'pending',
          status_detail: 'pending_waiting_payment',
          date_approved: null, // PIX not paid yet
          date_created: '2023-12-01T14:25:00.000-04:00',
          payment_method_id: 'pix',
          payment_type_id: 'bank_transfer',
          transaction_amount: 29.9,
          currency_id: 'BRL',
          external_reference: 'test-124',
        }),
      };
      (Payment as any).mockImplementation(() => mockPaymentInstance);

      const webhookBody = {
        type: 'payment',
        data: { id: 1_234_567_891 },
      };

      const request = createWebhookRequest(webhookBody);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(mockHandleMercadoPagoPayment).not.toHaveBeenCalled(); // Should NOT process pending payments
    });

    it('should handle approved credit card payment correctly', async () => {
      // Arrange - Mock credit card payment
      const { Payment } = await import('mercadopago');
      const mockPaymentInstance = {
        get: vi.fn().mockResolvedValue({
          id: 1_234_567_892,
          status: 'approved',
          status_detail: 'accredited',
          date_approved: '2023-12-01T14:30:00.000-04:00',
          date_created: '2023-12-01T14:30:00.000-04:00',
          payment_method_id: 'visa',
          payment_type_id: 'credit_card',
          transaction_amount: 29.9,
          currency_id: 'BRL',
          card: {
            last_four_digits: '1234',
          },
          external_reference: 'test-125',
        }),
      };
      (Payment as any).mockImplementation(() => mockPaymentInstance);

      const webhookBody = {
        type: 'payment',
        data: { id: 1_234_567_892 },
      };

      const request = createWebhookRequest(webhookBody);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(mockHandleMercadoPagoPayment).toHaveBeenCalledTimes(1);
    });

    it('should handle malformed payment data gracefully', async () => {
      // Arrange - Mock API error or malformed response
      const { Payment } = await import('mercadopago');
      const mockPaymentInstance = {
        get: vi.fn().mockResolvedValue({
          id: 1_234_567_893,
          status: undefined, // Malformed - missing status
          date_approved: undefined, // Malformed - missing date_approved
          // Missing other required fields
        }),
      };
      (Payment as any).mockImplementation(() => mockPaymentInstance);

      const webhookBody = {
        type: 'payment',
        data: { id: 1_234_567_893 },
      };

      const request = createWebhookRequest(webhookBody);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(mockHandleMercadoPagoPayment).not.toHaveBeenCalled(); // Should not process malformed data
    });
  });

  describe('Error Scenarios', () => {
    it('should handle Mercado Pago API errors gracefully', async () => {
      // Arrange - Mock API failure
      const { Payment } = await import('mercadopago');
      const mockPaymentInstance = {
        get: vi.fn().mockRejectedValue(new Error('Payment not found')),
      };
      (Payment as any).mockImplementation(() => mockPaymentInstance);

      const webhookBody = {
        type: 'payment',
        data: { id: 'invalid-id' },
      };

      const request = createWebhookRequest(webhookBody);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(500);
      expect(mockHandleMercadoPagoPayment).not.toHaveBeenCalled();

      const responseData = await response.json();
      expect(responseData.error).toBe('Payment processing failed');
    });

    it('should handle non-payment webhook types', async () => {
      // Arrange - Test other webhook types (chargebacks, etc.)
      const webhookBody = {
        type: 'chargeback',
        data: { id: 'chargeback-123' },
      };

      const request = createWebhookRequest(webhookBody);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(mockHandleMercadoPagoPayment).not.toHaveBeenCalled();
    });
  });
});
