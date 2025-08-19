/* eslint-disable playwright/no-standalone-expect */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '../route';

const createMockRequest = (body: any) => {
  return new NextRequest('http://localhost:3000/api/mercado-pago/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
};

const createPaymentWebhookBody = (paymentId: string) => ({
  type: 'payment',
  data: { id: paymentId },
});

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: vi.fn(),
  setTag: vi.fn(),
  captureMessage: vi.fn(),
  captureException: vi.fn(),
  withScope: vi.fn(callback => callback({})),
}));

// Mock mercadopago
const mockPaymentGet = vi.fn();
vi.mock('mercadopago', () => ({
  Payment: vi.fn().mockImplementation(() => ({
    get: mockPaymentGet,
  })),
}));

// Mock handle payments
vi.mock('@/lib/handle-payments', () => ({
  handleMercadoPagoPayment: vi.fn(),
}));

// Mock mercado-pago lib
vi.mock('@/lib/mercado-pago', () => ({
  default: {},
  verifyMercadoPagoSignature: vi.fn(() => null), // Return null for valid signature
}));

describe('Mercado Pago Webhook - Approval Logic', () => {
  let mockHandleMercadoPagoPayment: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    console.log = vi.fn(); // Mock console.log

    // Reset the payment mock
    mockPaymentGet.mockReset();

    // Get the mocked function
    const { handleMercadoPagoPayment } = await import('@/lib/handle-payments');
    mockHandleMercadoPagoPayment = handleMercadoPagoPayment;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Date Approved Validation (The Fix)', () => {
    it('should APPROVE payment when date_approved has a valid date string', async () => {
      // Arrange
      const paymentData = {
        id: '12345',
        status: 'pending',
        date_approved: '2023-12-01T10:00:00.000Z', // Valid date
      };
      mockPaymentGet.mockResolvedValue(paymentData);

      const request = createMockRequest(createPaymentWebhookBody('12345'));

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(mockHandleMercadoPagoPayment).toHaveBeenCalledWith(paymentData);
    });

    it('should REJECT payment when date_approved is null', async () => {
      // Arrange
      const paymentData = {
        id: '12345',
        status: 'pending',
        date_approved: null, // Explicitly null
      };
      mockPaymentGet.mockResolvedValue(paymentData);

      const request = createMockRequest(createPaymentWebhookBody('12345'));

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(mockHandleMercadoPagoPayment).not.toHaveBeenCalled();
    });

    it('should REJECT payment when date_approved is undefined', async () => {
      // Arrange
      const paymentData = {
        id: '12345',
        status: 'pending',
        // date_approved is undefined (not present)
      };
      mockPaymentGet.mockResolvedValue(paymentData);

      const request = createMockRequest(createPaymentWebhookBody('12345'));

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(mockHandleMercadoPagoPayment).not.toHaveBeenCalled();
    });

    it('should APPROVE payment when status is approved (even if date_approved is null)', async () => {
      // Arrange
      const paymentData = {
        id: '12345',
        status: 'approved', // Credit card payment
        date_approved: null, // PIX date might be null for card payments
      };
      mockPaymentGet.mockResolvedValue(paymentData);

      const request = createMockRequest(createPaymentWebhookBody('12345'));

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(mockHandleMercadoPagoPayment).toHaveBeenCalledWith(paymentData);
    });

    it('should REJECT payment when both status is not approved AND date_approved is null', async () => {
      // Arrange
      const paymentData = {
        id: '12345',
        status: 'pending',
        date_approved: null,
      };
      mockPaymentGet.mockResolvedValue(paymentData);

      const request = createMockRequest(createPaymentWebhookBody('12345'));

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(mockHandleMercadoPagoPayment).not.toHaveBeenCalled();
    });

    it('should REJECT payment when both status is not approved AND date_approved is undefined', async () => {
      // Arrange
      const paymentData = {
        id: '12345',
        status: 'rejected',
        // date_approved is undefined
      };
      mockPaymentGet.mockResolvedValue(paymentData);

      const request = createMockRequest(createPaymentWebhookBody('12345'));

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(mockHandleMercadoPagoPayment).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string date_approved', async () => {
      // Arrange
      const paymentData = {
        id: '12345',
        status: 'pending',
        date_approved: '', // Empty string
      };
      mockPaymentGet.mockResolvedValue(paymentData);

      const request = createMockRequest(createPaymentWebhookBody('12345'));

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(mockHandleMercadoPagoPayment).not.toHaveBeenCalled();
    });

    it('should handle boolean false for date_approved', async () => {
      // Arrange
      const paymentData = {
        id: '12345',
        status: 'pending',
        date_approved: false, // Boolean false
      };
      mockPaymentGet.mockResolvedValue(paymentData);

      const request = createMockRequest(createPaymentWebhookBody('12345'));

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(mockHandleMercadoPagoPayment).not.toHaveBeenCalled();
    });
  });
});
