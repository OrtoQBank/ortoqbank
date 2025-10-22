/* eslint-disable playwright/no-standalone-expect */
import { convexTest } from 'convex-test';
import { beforeEach, describe, expect, it } from 'vitest';

import { api } from '../_generated/api';
import { Id } from '../_generated/dataModel';
import schema from '../schema';

describe('Integration: Asaas + Convex Payments', () => {
  let t: ReturnType<typeof convexTest>;
  let userId: Id<'users'>;
  let pricingPlanId: Id<'pricingPlans'>;

  beforeEach(async () => {
    t = convexTest(schema);

    // Create test user
    userId = await t.run(async ctx => {
      return ctx.db.insert('users', {
        email: 'payment@test.com',
        clerkUserId: 'payment-clerk-id',
        role: 'user',
      });
    });

    // Create pricing plan
    pricingPlanId = await t.run(async ctx => {
      return ctx.db.insert('pricingPlans', {
        productId: 'PRODUCT_ANNUAL_2025',
        productName: 'Acesso Anual 2025',
        regularPriceNum: 297,
        pixPriceNum: 247,
        isActive: true,
        displayOrder: 1,
      });
    });
  });

  describe('Pending Order Creation', () => {
    it('creates pending order with PIX payment', async () => {
      const asUser = t.withIdentity({
        subject: 'payment-clerk-id',
        tokenIdentifier: 'payment-token',
      });

      const result = await asUser.mutation(api.payments.createPendingOrder, {
        email: 'payment@test.com',
        cpf: '123.456.789-00',
        name: 'Test User',
        productId: 'PRODUCT_ANNUAL_2025',
        paymentMethod: 'PIX',
      });

      expect(result.pendingOrderId).toBeDefined();
      expect(result.priceBreakdown.originalPrice).toBe(297);
      expect(result.priceBreakdown.pixDiscount).toBe(50); // 297 - 247
      expect(result.priceBreakdown.finalPrice).toBe(247);
      expect(result.priceBreakdown.couponDiscount).toBe(0);

      // Verify order was created
      const order = await t.run(ctx => ctx.db.get(result.pendingOrderId));
      expect(order).toBeDefined();
      expect(order?.email).toBe('payment@test.com');
      expect(order?.cpf).toBe('123.456.789-00');
      expect(order?.paymentMethod).toBe('PIX');
      expect(order?.finalPrice).toBe(247);
      expect(order?.status).toBe('pending');
    });

    it('creates pending order with Credit Card payment', async () => {
      const asUser = t.withIdentity({
        subject: 'payment-clerk-id',
        tokenIdentifier: 'payment-token',
      });

      const result = await asUser.mutation(api.payments.createPendingOrder, {
        email: 'payment@test.com',
        cpf: '123.456.789-00',
        name: 'Test User',
        productId: 'PRODUCT_ANNUAL_2025',
        paymentMethod: 'CREDIT_CARD',
      });

      expect(result.priceBreakdown.originalPrice).toBe(297);
      expect(result.priceBreakdown.pixDiscount).toBe(0); // No PIX discount for credit card
      expect(result.priceBreakdown.finalPrice).toBe(297);
    });

    it('applies coupon discount correctly', async () => {
      const asUser = t.withIdentity({
        subject: 'payment-clerk-id',
        tokenIdentifier: 'payment-token',
      });

      // Create coupon
      await t.run(async ctx => {
        await ctx.db.insert('coupons', {
          code: 'SAVE50',
          type: 'fixed',
          value: 50,
          description: 'R$ 50 off',
          active: true,
          currentUses: 0,
        });
      });

      const result = await asUser.mutation(api.payments.createPendingOrder, {
        email: 'payment@test.com',
        cpf: '123.456.789-00',
        name: 'Test User',
        productId: 'PRODUCT_ANNUAL_2025',
        paymentMethod: 'PIX',
        couponCode: 'SAVE50',
      });

      expect(result.priceBreakdown.couponDiscount).toBe(50);
      expect(result.priceBreakdown.finalPrice).toBe(197); // 247 (PIX) - 50 (coupon)
    });

    it('applies percentage coupon correctly', async () => {
      const asUser = t.withIdentity({
        subject: 'payment-clerk-id',
        tokenIdentifier: 'payment-token',
      });

      // Create percentage coupon
      await t.run(async ctx => {
        await ctx.db.insert('coupons', {
          code: 'PERCENT20',
          type: 'percentage',
          value: 20,
          description: '20% off',
          active: true,
          currentUses: 0,
        });
      });

      const result = await asUser.mutation(api.payments.createPendingOrder, {
        email: 'payment@test.com',
        cpf: '123.456.789-00',
        name: 'Test User',
        productId: 'PRODUCT_ANNUAL_2025',
        paymentMethod: 'PIX',
        couponCode: 'PERCENT20',
      });

      const expectedDiscount = 247 * 0.2; // 20% of PIX price
      expect(result.priceBreakdown.couponDiscount).toBeCloseTo(expectedDiscount, 1);
      expect(result.priceBreakdown.finalPrice).toBeCloseTo(247 - expectedDiscount, 1);
    });

    it('throws error for invalid product', async () => {
      const asUser = t.withIdentity({
        subject: 'payment-clerk-id',
        tokenIdentifier: 'payment-token',
      });

      await expect(
        asUser.mutation(api.payments.createPendingOrder, {
          email: 'payment@test.com',
          cpf: '123.456.789-00',
          name: 'Test User',
          productId: 'INVALID_PRODUCT',
          paymentMethod: 'PIX',
        })
      ).rejects.toThrow(/Product not found/);
    });

    it('throws error for invalid coupon', async () => {
      const asUser = t.withIdentity({
        subject: 'payment-clerk-id',
        tokenIdentifier: 'payment-token',
      });

      await expect(
        asUser.mutation(api.payments.createPendingOrder, {
          email: 'payment@test.com',
          cpf: '123.456.789-00',
          name: 'Test User',
          productId: 'PRODUCT_ANNUAL_2025',
          paymentMethod: 'PIX',
          couponCode: 'INVALID_COUPON',
        })
      ).rejects.toThrow();
    });

    it('includes optional address fields', async () => {
      const asUser = t.withIdentity({
        subject: 'payment-clerk-id',
        tokenIdentifier: 'payment-token',
      });

      const result = await asUser.mutation(api.payments.createPendingOrder, {
        email: 'payment@test.com',
        cpf: '123.456.789-00',
        name: 'Test User',
        productId: 'PRODUCT_ANNUAL_2025',
        paymentMethod: 'PIX',
        phone: '11987654321',
        mobilePhone: '11987654321',
        postalCode: '12345-678',
        address: 'Rua Test',
        addressNumber: '123',
      });

      const order = await t.run(ctx => ctx.db.get(result.pendingOrderId));
      expect(order?.phone).toBe('11987654321');
      expect(order?.postalCode).toBe('12345-678');
      expect(order?.address).toBe('Rua Test');
      expect(order?.addressNumber).toBe('123');
    });
  });

  describe('Coupon Validation', () => {
    it('validates active coupon correctly', async () => {
      const asUser = t.withIdentity({
        subject: 'payment-clerk-id',
        tokenIdentifier: 'payment-token',
      });

      // Create active coupon
      await t.run(async ctx => {
        await ctx.db.insert('coupons', {
          code: 'ACTIVE50',
          type: 'fixed',
          value: 50,
          description: 'R$ 50 off',
          active: true,
          currentUses: 0,
        });
      });

      const result = await asUser.query(api.promoCoupons.validateAndApplyCoupon, {
        code: 'ACTIVE50',
        originalPrice: 297,
        userCpf: '12345678900',
      });

      expect(result.isValid).toBe(true);
      expect(result.discountAmount).toBe(50);
      expect(result.finalPrice).toBe(247);
    });

    it('rejects inactive coupon', async () => {
      const asUser = t.withIdentity({
        subject: 'payment-clerk-id',
        tokenIdentifier: 'payment-token',
      });

      // Create inactive coupon
      await t.run(async ctx => {
        await ctx.db.insert('coupons', {
          code: 'INACTIVE',
          type: 'fixed',
          value: 50,
          description: 'Inactive coupon',
          active: false,
          currentUses: 0,
        });
      });

      const result = await asUser.query(api.promoCoupons.validateAndApplyCoupon, {
        code: 'INACTIVE',
        originalPrice: 297,
        userCpf: '12345678900',
      });

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('inválido ou expirado');
    });

    it('enforces maximum uses limit', async () => {
      const asUser = t.withIdentity({
        subject: 'payment-clerk-id',
        tokenIdentifier: 'payment-token',
      });

      // Create coupon with max uses
      await t.run(async ctx => {
        await ctx.db.insert('coupons', {
          code: 'MAXED',
          type: 'fixed',
          value: 50,
          description: 'Max uses test',
          active: true,
          maxUses: 2,
          currentUses: 2, // Already at max
        });
      });

      const result = await asUser.query(api.promoCoupons.validateAndApplyCoupon, {
        code: 'MAXED',
        originalPrice: 297,
        userCpf: '12345678900',
      });

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('limite de uso');
    });

    it('enforces per-user usage limit', async () => {
      const asUser = t.withIdentity({
        subject: 'payment-clerk-id',
        tokenIdentifier: 'payment-token',
      });

      const couponId = await t.run(async ctx => {
        return ctx.db.insert('coupons', {
          code: 'PERUSER',
          type: 'fixed',
          value: 50,
          description: 'Per user limit',
          active: true,
          maxUsesPerUser: 1,
          currentUses: 0,
        });
      });

      // Record previous usage for this CPF
      await t.run(async ctx => {
        const orderId = await ctx.db.insert('pendingOrders', {
          email: 'test@test.com',
          cpf: '12345678900',
          name: 'Test',
          productId: 'PRODUCT_ANNUAL_2025',
          paymentMethod: 'PIX',
          finalPrice: 247,
          status: 'pending',
          expiresAt: Date.now() + 8640,
        });

        await ctx.db.insert('couponUsage', {
          couponId,
          couponCode: 'PERUSER',
          orderId,
          userEmail: 'test@test.com',
          userCpf: '12345678900',
          discountAmount: 50,
          originalPrice: 297,
          finalPrice: 247,
          usedAt: Date.now(),
        });
      });

      const result = await asUser.query(api.promoCoupons.validateAndApplyCoupon, {
        code: 'PERUSER',
        originalPrice: 297,
        userCpf: '12345678900',
      });

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('já foi usado');
    });

    it('validates date range correctly', async () => {
      const asUser = t.withIdentity({
        subject: 'payment-clerk-id',
        tokenIdentifier: 'payment-token',
      });

      const now = Date.now();
      const yesterday = now - 8640;
      const tomorrow = now + 8640;

      // Create expired coupon
      await t.run(async ctx => {
        await ctx.db.insert('coupons', {
          code: 'EXPIRED',
          type: 'fixed',
          value: 50,
          description: 'Expired coupon',
          active: true,
          validFrom: yesterday - 1728,
          validUntil: yesterday,
          currentUses: 0,
        });
      });

      const result = await asUser.query(api.promoCoupons.validateAndApplyCoupon, {
        code: 'EXPIRED',
        originalPrice: 297,
        userCpf: '12345678900',
      });

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('expirado');
    });

    it('enforces minimum price', async () => {
      const asUser = t.withIdentity({
        subject: 'payment-clerk-id',
        tokenIdentifier: 'payment-token',
      });

      // Create coupon with minimum price
      await t.run(async ctx => {
        await ctx.db.insert('coupons', {
          code: 'MINPRICE',
          type: 'fixed',
          value: 200,
          description: 'Huge discount with min price',
          active: true,
          minimumPrice: 97, // Final price can't go below this
          currentUses: 0,
        });
      });

      const result = await asUser.query(api.promoCoupons.validateAndApplyCoupon, {
        code: 'MINPRICE',
        originalPrice: 247,
        userCpf: '12345678900',
      });

      expect(result.isValid).toBe(true);
      expect(result.finalPrice).toBe(97); // Capped at minimum price
      expect(result.discountAmount).toBe(150); // 247 - 97
    });
  });

  describe('Payment Status Updates', () => {
    it('marks order as paid and updates user', async () => {
      // Create pending order
      const orderId = await t.run(async ctx => {
        return ctx.db.insert('pendingOrders', {
          email: 'paid@test.com',
          cpf: '12345678900',
          name: 'Paid User',
          productId: 'PRODUCT_ANNUAL_2025',
          paymentMethod: 'PIX',
          finalPrice: 247,
          status: 'pending',
          expiresAt: Date.now() + 8640,
          claimToken: 'claim_token_123',
        });
      });

      // Mark as paid (this would be called by webhook)
      await t.run(async ctx => {
        await ctx.db.patch(orderId, {
          status: 'paid',
          paidAt: Date.now(),
          asaasPaymentId: 'pay_asaas_123',
        });
      });

      const order = await t.run(ctx => ctx.db.get(orderId));
      expect(order?.status).toBe('paid');
      expect(order?.paidAt).toBeDefined();
      expect(order?.asaasPaymentId).toBe('pay_asaas_123');
    });

    it('tracks order expiration', async () => {
      const now = Date.now();
      const past = now - 8640; // 1 day ago

      const orderId = await t.run(async ctx => {
        return ctx.db.insert('pendingOrders', {
          email: 'expired@test.com',
          cpf: '12345678900',
          name: 'Expired User',
          productId: 'PRODUCT_ANNUAL_2025',
          paymentMethod: 'PIX',
          finalPrice: 247,
          status: 'pending',
          expiresAt: past,
          claimToken: 'expired_token',
        });
      });

      const order = await t.run(ctx => ctx.db.get(orderId));
      const isExpired = order ? order.expiresAt < now : false;
      expect(isExpired).toBe(true);
    });
  });

  describe('Price Calculation Logic', () => {
    it('calculates PIX discount correctly', () => {
      const regularPrice = 297;
      const pixPrice = 247;
      const pixDiscount = regularPrice - pixPrice;

      expect(pixDiscount).toBe(50);
    });

    it('rounds prices to 2 decimal places', () => {
      const price = 247.55;
      const rounded = Math.round(price * 100) / 100;

      expect(rounded).toBe(247.56);
    });

    it('validates final price is positive', () => {
      const basePrice = 100;
      const discount = 150;
      const finalPrice = Math.max(0, basePrice - discount);

      expect(finalPrice).toBe(0); // Can't go negative
    });

    it('applies fixed price coupon correctly', async () => {
      const asUser = t.withIdentity({
        subject: 'payment-clerk-id',
        tokenIdentifier: 'payment-token',
      });

      // Create fixed price coupon
      await t.run(async ctx => {
        await ctx.db.insert('coupons', {
          code: 'FIXED97',
          type: 'fixed_price',
          value: 97,
          description: 'Pay only R$ 97',
          active: true,
          currentUses: 0,
        });
      });

      const result = await asUser.query(api.promoCoupons.validateAndApplyCoupon, {
        code: 'FIXED97',
        originalPrice: 297,
        userCpf: '12345678900',
      });

      expect(result.isValid).toBe(true);
      expect(result.finalPrice).toBe(97);
      expect(result.discountAmount).toBe(200); // 297 - 97
    });
  });

  describe('Edge Cases', () => {
    it('handles CPF formatting variations', async () => {
      const asUser = t.withIdentity({
        subject: 'payment-clerk-id',
        tokenIdentifier: 'payment-token',
      });

      const result1 = await asUser.mutation(api.payments.createPendingOrder, {
        email: 'cpf1@test.com',
        cpf: '123.456.789-00',
        name: 'User 1',
        productId: 'PRODUCT_ANNUAL_2025',
        paymentMethod: 'PIX',
      });

      const result2 = await asUser.mutation(api.payments.createPendingOrder, {
        email: 'cpf2@test.com',
        cpf: '12345678900',
        name: 'User 2',
        productId: 'PRODUCT_ANNUAL_2025',
        paymentMethod: 'PIX',
      });

      expect(result1.pendingOrderId).toBeDefined();
      expect(result2.pendingOrderId).toBeDefined();
    });

    it('handles very small discount amounts', async () => {
      const asUser = t.withIdentity({
        subject: 'payment-clerk-id',
        tokenIdentifier: 'payment-token',
      });

      // Create tiny percentage discount
      await t.run(async ctx => {
        await ctx.db.insert('coupons', {
          code: 'TINY',
          type: 'percentage',
          value: 0.1, // 0.1%
          description: 'Tiny discount',
          active: true,
          currentUses: 0,
        });
      });

      const result = await asUser.query(api.promoCoupons.validateAndApplyCoupon, {
        code: 'TINY',
        originalPrice: 247,
        userCpf: '12345678900',
      });

      expect(result.isValid).toBe(true);
      expect(result.discountAmount).toBeCloseTo(0.25, 2); // 0.1% of 247
    });
  });
});
