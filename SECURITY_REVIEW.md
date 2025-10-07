# Security Review - Payment System

## Executive Summary
Overall security posture: **MODERATE RISK**
- ✅ Price calculation is server-side (GOOD)
- ✅ Payment amount verification in webhook (GOOD)
- ⚠️ Webhook authentication disabled for testing (CRITICAL)
- ⚠️ Coupon usage race condition (MEDIUM)
- ⚠️ No rate limiting on checkout (MEDIUM)

---

## Critical Vulnerabilities

### 🔴 CRITICAL: Webhook Authentication Disabled
**File:** `convex/http.ts:102-114`

**Issue:**
```typescript
// Skip authentication for sandbox testing if no token configured
if (webhookSecret && webhookSecret !== 'your-secret-key-here') {
  // Authentication logic
} else {
  console.log('⚠️ Webhook authentication disabled for testing');
}
```

**Risk:** Anyone can send fake payment confirmation webhooks to your endpoint, granting free access.

**Attack Scenario:**
1. Attacker creates a pending order with $0.01 or legitimate price
2. Attacker sends fake webhook with `PAYMENT_CONFIRMED` event
3. System grants access without actual payment

**Fix:**
```typescript
// ALWAYS require authentication in production
if (!webhookSecret || webhookSecret === 'your-secret-key-here') {
  throw new Error('ASAAS_WEBHOOK_SECRET must be configured');
}

if (!asaasSignature) {
  console.error('Missing AsaaS authentication header');
  return new Response('Missing authentication', { status: 401 });
}

if (asaasSignature !== webhookSecret) {
  console.error('Invalid AsaaS webhook signature');
  return new Response('Invalid signature', { status: 401 });
}
```

---

## Medium Vulnerabilities

### 🟡 MEDIUM: Coupon Usage Race Condition
**File:** `convex/payments.ts:117-146`

**Issue:** Coupon usage is tracked when order is created (before payment), not when payment is confirmed.

**Current Flow:**
1. User creates pending order → Coupon usage incremented ✓
2. User doesn't pay → Coupon usage never decremented ❌
3. Coupon appears "used" but no payment received

**Attack Scenarios:**

**Scenario A - Exhaust Coupon Limits:**
1. Attacker creates 100 pending orders with limited coupon (maxUses: 100)
2. Attacker never completes any payments
3. Legitimate users can't use the coupon (it appears exhausted)

**Scenario B - Per-User Limit Bypass:**
1. Limited coupon: `maxUsesPerUser: 1`
2. Attacker creates pending order with coupon
3. Attacker abandons payment
4. Attacker can't use coupon again (tracked as used)
5. But attacker could use different CPF/email to bypass

**Current Code:**
```typescript
// In createPendingOrder - BEFORE payment confirmed
if (appliedCouponCode) {
  await ctx.db.insert('couponUsage', { /* ... */ });
  await ctx.db.patch(coupon._id, {
    currentUses: currentUses + 1,  // ❌ Incremented too early
  });
}
```

**Recommended Fixes:**

**Option 1: Track usage on payment confirmation**
```typescript
// In confirmPayment mutation (AFTER webhook confirms payment)
export const confirmPayment = internalMutation({
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.pendingOrderId);
    
    // Track coupon usage HERE (after payment confirmed)
    if (order.couponCode) {
      const coupon = await ctx.db.query('coupons')
        .withIndex('by_code', q => q.eq('code', order.couponCode))
        .unique();
      
      if (coupon) {
        await ctx.db.insert('couponUsage', {
          couponId: coupon._id,
          couponCode: order.couponCode,
          orderId: order._id,
          userEmail: order.email,
          userCpf: order.cpf,
          discountAmount: order.couponDiscount,
          originalPrice: order.originalPrice,
          finalPrice: order.finalPrice,
          usedAt: Date.now(),
        });
        
        await ctx.db.patch(coupon._id, {
          currentUses: (coupon.currentUses || 0) + 1,
        });
      }
    }
    
    // ... rest of confirmation logic
  }
});
```

**Option 2: Use "pending" and "confirmed" states**
```typescript
// couponUsage schema update:
couponUsage: defineTable({
  // ... existing fields
  status: v.union(v.literal('pending'), v.literal('confirmed')),
}),

// Count only confirmed uses:
const confirmedUses = await ctx.db
  .query('couponUsage')
  .withIndex('by_coupon_status', q => 
    q.eq('couponCode', code).eq('status', 'confirmed')
  )
  .collect();
```

---

### 🟡 MEDIUM: No Rate Limiting on Order Creation
**File:** `convex/payments.ts:15-159`

**Issue:** No rate limiting on `createPendingOrder` mutation.

**Attack Scenarios:**
1. **Database flooding:** Create thousands of pending orders
2. **Coupon exhaustion:** Rapidly exhaust coupon limits
3. **Email spam:** If order creation triggers emails

**Fix:**
```typescript
export const createPendingOrder = mutation({
  handler: async (ctx, args) => {
    // Rate limit: max 3 pending orders per email in last hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentOrders = await ctx.db
      .query('pendingOrders')
      .withIndex('by_email', q => q.eq('email', args.email))
      .filter(q => q.gt(q.field('createdAt'), oneHourAgo))
      .collect();
    
    if (recentOrders.length >= 3) {
      throw new Error('Muitas tentativas. Aguarde antes de tentar novamente.');
    }
    
    // ... rest of logic
  }
});
```

---

### 🟡 MEDIUM: Multiple Pending Orders with Same Coupon
**File:** `convex/payments.ts`

**Issue:** User can create multiple pending orders using the same coupon code before completing any payment.

**Attack Scenario:**
1. User creates Order A with 50% off coupon
2. User creates Order B with same 50% off coupon
3. User completes payment for Order B (gets discount)
4. Order A remains pending with coupon tracked but unused

**Fix:**
```typescript
// In createPendingOrder, check for existing pending orders with this coupon
if (args.couponCode) {
  const existingPendingOrder = await ctx.db
    .query('pendingOrders')
    .withIndex('by_email', q => q.eq('email', args.email))
    .filter(q => 
      q.and(
        q.eq(q.field('couponCode'), args.couponCode.toUpperCase()),
        q.eq(q.field('status'), 'pending')
      )
    )
    .first();
  
  if (existingPendingOrder) {
    throw new Error('Você já tem um pedido pendente com este cupom. Complete ou cancele o pedido anterior.');
  }
}
```

---

## Good Security Practices ✅

### ✅ Server-Side Price Calculation
**File:** `convex/payments.ts:34-86`

**Good:**
- Prices are fetched from database on server
- Client cannot manipulate prices
- Coupon discounts calculated server-side

```typescript
// ✅ GOOD: Prices come from database, not client
const pricingPlan = await ctx.runQuery(api.pricingPlans.getByProductId, {
  productId: args.productId,
});
const regularPrice = pricingPlan.regularPriceNum || 0;
const pixPrice = pricingPlan.pixPriceNum || regularPrice;
```

---

### ✅ Payment Amount Verification
**File:** `convex/payments.ts:217-243`

**Good:**
- Webhook verifies paid amount matches expected amount
- 2 cent tolerance for rounding
- Logs security alerts for mismatches

```typescript
// ✅ GOOD: Amount verification
const tolerance = 0.02;
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
  return null; // ✅ Don't process mismatched payments
}
```

---

### ✅ Coupon Validation
**File:** `convex/promoCoupons.ts:161-281`

**Good:**
- Server-side validation
- Checks: active status, date range, usage limits, per-user limits
- Minimum price protection
- Prevents negative prices

```typescript
// ✅ GOOD: Comprehensive validation
// - Active check
// - Date range check  
// - Max uses check
// - Per-user limits check
// - Minimum price protection
finalPrice = Math.max(finalPrice, 0); // ✅ No negative prices
if (coupon.minimumPrice !== undefined && finalPrice < coupon.minimumPrice) {
  finalPrice = coupon.minimumPrice; // ✅ Price floor
}
```

---

### ✅ Secure Token Generation
**File:** `convex/payments.ts:90`

**Good:**
- Uses crypto.randomUUID() for claim tokens
- Not guessable
- 7-day expiration
- One-time use enforcement

```typescript
// ✅ GOOD: Cryptographically secure token
const claimToken = crypto.randomUUID();
const sevenDays = 7 * 24 * 60 * 60 * 1000;
```

---

### ✅ External Reference Tracking
**File:** `convex/asaas.ts:210`

**Good:**
- Pending order ID stored as external reference in payment gateway
- Enables correlation between webhook and order
- Prevents order/payment mismatch

```typescript
// ✅ GOOD: Correlation ID
externalReference: args.pendingOrderId,
```

---

## Additional Security Recommendations

### 🔵 Add Order Expiration Cleanup
**Current:** Expired pending orders remain in database forever

**Recommendation:**
```typescript
// Create a cron job to clean up expired pending orders
export const cleanupExpiredOrders = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const expiredOrders = await ctx.db
      .query('pendingOrders')
      .withIndex('by_status', q => q.eq('status', 'pending'))
      .filter(q => q.lt(q.field('expiresAt'), now))
      .collect();
    
    for (const order of expiredOrders) {
      // Decrement coupon usage if coupon was applied
      if (order.couponCode) {
        const coupon = await ctx.db
          .query('coupons')
          .withIndex('by_code', q => q.eq('code', order.couponCode))
          .unique();
        
        if (coupon && coupon.currentUses > 0) {
          await ctx.db.patch(coupon._id, {
            currentUses: coupon.currentUses - 1,
          });
        }
      }
      
      // Mark order as failed
      await ctx.db.patch(order._id, {
        status: 'failed',
      });
    }
  }
});
```

---

### 🔵 Add Request Signing
**Current:** Webhook relies only on shared secret

**Recommendation:** Implement HMAC signature verification
```typescript
import crypto from 'crypto';

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

---

### 🔵 Add IP Allowlist for Webhooks
**Recommendation:** Only accept webhooks from Asaas IP ranges

```typescript
const ASAAS_IP_RANGES = [
  '54.207.82.28',
  '52.5.103.149',
  // Add all Asaas webhook IPs
];

function isValidAsaasIP(ip: string): boolean {
  return ASAAS_IP_RANGES.includes(ip);
}
```

---

### 🔵 Add Logging and Monitoring
**Recommendation:** Implement comprehensive audit logging

```typescript
// Log all payment-related events
await ctx.db.insert('auditLog', {
  event: 'order_created',
  userId: order.userId,
  email: order.email,
  orderId: order._id,
  amount: order.finalPrice,
  couponUsed: order.couponCode,
  ipAddress: request.headers.get('x-forwarded-for'),
  userAgent: request.headers.get('user-agent'),
  timestamp: Date.now(),
});
```

---

## Priority Action Items

1. **🔴 URGENT:** Enable webhook authentication in production
2. **🟡 HIGH:** Move coupon usage tracking to post-payment
3. **🟡 HIGH:** Add rate limiting to order creation
4. **🟡 MEDIUM:** Prevent multiple pending orders with same coupon
5. **🔵 LOW:** Add cron job for expired order cleanup
6. **🔵 LOW:** Implement HMAC signature verification
7. **🔵 LOW:** Add IP allowlist for webhooks

---

## Testing Checklist

- [ ] Test webhook with invalid signature (should reject)
- [ ] Test webhook without authentication (should reject)
- [ ] Test payment amount mismatch (should reject)
- [ ] Test expired coupon (should reject)
- [ ] Test exhausted coupon (should reject)
- [ ] Test per-user coupon limit (should reject after limit)
- [ ] Test negative price scenarios (should floor at 0)
- [ ] Test rate limiting (should block after threshold)
- [ ] Test claim token expiration (should reject after 7 days)
- [ ] Test claim token reuse (should reject second use)

---

## Environment Variables to Secure

Ensure these are set in production:
```bash
ASAAS_WEBHOOK_SECRET=<strong-random-secret>  # ⚠️ MUST NOT be 'your-secret-key-here'
ASAAS_API_KEY=<production-api-key>
ASAAS_ENVIRONMENT=production
CLERK_WEBHOOK_SECRET=<clerk-webhook-secret>
```
