# 🚨 CRITICAL SECURITY FIXES REQUIRED

## Summary
Your payment system has **good fundamentals** (server-side pricing). 

**Status Update:**
- ✅ **1 CRITICAL issue FIXED** (Webhook authentication)
- 🟡 **2 HIGH priority issues** remain (Coupon tracking, Rate limiting)

---

## ✅ ~~CRITICAL FIX #1: Enable Webhook Authentication~~ **FIXED**

### ~~Current Vulnerability~~ **RESOLVED**
~~Webhook authentication was disabled for testing environments.~~

**Status: FIXED ✅**
- Webhook authentication now **always required** for both sandbox and production
- No bypass logic remains
- Returns 401 for missing or invalid signatures
- Returns 500 if `ASAAS_WEBHOOK_SECRET` not configured

### Current Implementation (Fixed)

```typescript
// convex/http.ts - AsaaS webhook handler (FIXED)
const webhookSecret = process.env.ASAAS_WEBHOOK_SECRET;

// ALWAYS require webhook secret to be configured
if (!webhookSecret) {
  console.error('ASAAS_WEBHOOK_SECRET environment variable not configured');
  return new Response('Server configuration error', { status: 500 });
}

// ALWAYS require authentication header
if (!asaasSignature) {
  console.error('Missing AsaaS authentication header');
  return new Response('Unauthorized - Missing authentication', { status: 401 });
}

// ALWAYS validate signature
if (asaasSignature !== webhookSecret) {
  console.error('Invalid AsaaS webhook signature');
  return new Response('Unauthorized - Invalid signature', { status: 401 });
}

console.log('✅ Webhook authentication successful');
```

### Required Environment Variable
Make sure this is set in your Convex environment:
```bash
ASAAS_WEBHOOK_SECRET="your-webhook-secret-from-asaas"
```

**To get your webhook secret:**
1. Log in to Asaas dashboard (sandbox or production)
2. Go to Settings → Webhooks
3. Copy your webhook access token
4. Set it as `ASAAS_WEBHOOK_SECRET` in Convex environment variables

---

## 🟡 HIGH PRIORITY FIX #2: Fix Coupon Usage Tracking

### Current Vulnerability
Coupons are marked as "used" when order is created, NOT when payment is confirmed.

### Problems
1. User creates order → Coupon usage incremented
2. User abandons payment → Coupon stays "used"
3. Limited coupons can be exhausted without any payments

### Attack Example
```
Coupon: BLACKFRIDAY (maxUses: 100)
1. Attacker creates 100 pending orders
2. Attacker pays for none
3. Real customers can't use coupon (shows as exhausted)
```

### Fix Option A: Move tracking to payment confirmation

**File:** `convex/payments.ts`

**Remove** coupon tracking from `createPendingOrder` (lines 117-146):
```typescript
// ❌ DELETE THIS SECTION from createPendingOrder
if (appliedCouponCode) {
  const coupon = await ctx.db.query('coupons')...
  await ctx.db.insert('couponUsage', {...});
  await ctx.db.patch(coupon._id, {
    currentUses: currentUses + 1,  // ❌ Too early!
  });
}
```

**Add** to `confirmPayment` mutation (after line 305):
```typescript
export const confirmPayment = internalMutation({
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.pendingOrderId);
    
    // ... existing code ...
    
    // ✅ ADD: Track coupon usage AFTER payment confirmed
    if (order.couponCode) {
      const coupon = await ctx.db
        .query('coupons')
        .withIndex('by_code', q => q.eq('code', order.couponCode))
        .unique();
      
      if (coupon) {
        // Record usage
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
        
        // Increment counter
        await ctx.db.patch(coupon._id, {
          currentUses: (coupon.currentUses || 0) + 1,
        });
        
        console.log(`📊 Confirmed coupon usage: ${order.couponCode}`);
      }
    }
    
    // ... rest of existing code ...
  }
});
```

---

## 🟡 HIGH PRIORITY FIX #3: Add Rate Limiting

### Current Vulnerability
No limit on how many pending orders can be created.

### Risk
- Database flooding
- Coupon exhaustion attacks
- Email spam (if notifications are added)

### Fix
Add rate limiting to `createPendingOrder`:

```typescript
export const createPendingOrder = mutation({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    // ✅ ADD: Rate limit check
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentPendingOrders = await ctx.db
      .query('pendingOrders')
      .withIndex('by_email', q => q.eq('email', args.email))
      .filter(q => 
        q.and(
          q.gt(q.field('createdAt'), oneHourAgo),
          q.eq(q.field('status'), 'pending')
        )
      )
      .collect();
    
    if (recentPendingOrders.length >= 3) {
      throw new Error('Você já tem pedidos pendentes. Complete ou aguarde antes de criar um novo.');
    }
    
    // If user has pending order with same coupon, prevent duplicate
    if (args.couponCode) {
      const pendingWithCoupon = recentPendingOrders.find(
        order => order.couponCode?.toUpperCase() === args.couponCode.toUpperCase()
      );
      
      if (pendingWithCoupon) {
        throw new Error('Você já tem um pedido pendente com este cupom. Complete o pedido anterior primeiro.');
      }
    }
    
    // ... rest of existing code ...
  }
});
```

---

## ✅ What's Already Secure

Good news! These critical areas are already properly secured:

### ✅ Server-Side Pricing
The frontend **does not** send prices to the backend. All prices are calculated server-side:

```typescript
// ✅ GOOD: Frontend only sends productId and couponCode
await createPendingOrder({
  email: data.email,
  cpf: data.cpf,
  name: data.name,
  productId: planId,           // ✅ ID, not price
  paymentMethod: data.paymentMethod,
  couponCode: appliedCoupon ? couponCode : undefined,  // ✅ Code, not amount
  // ❌ NO price sent from client
});

// Backend fetches real price from database
const pricingPlan = await ctx.runQuery(api.pricingPlans.getByProductId, {
  productId: args.productId,
});
const regularPrice = pricingPlan.regularPriceNum;  // ✅ From database
```

### ✅ Payment Amount Verification
Webhook verifies the amount paid matches expected amount:

```typescript
// ✅ GOOD: Amount verification
const tolerance = 0.02;
const paidAmount = payment.value || payment.totalValue || 0;
const expectedAmount = pendingOrder.finalPrice;

if (Math.abs(paidAmount - expectedAmount) > tolerance) {
  console.error(`🚨 SECURITY ALERT: Payment amount mismatch!`);
  return null;  // ✅ Reject mismatched payments
}
```

### ✅ Secure Token Generation
```typescript
// ✅ GOOD: Cryptographically secure
const claimToken = crypto.randomUUID();
```

---

## Testing After Fixes

After implementing these fixes, test:

1. **Webhook Security:**
   ```bash
   # Should REJECT without proper authentication
   curl -X POST https://your-domain.convex.site/webhooks/asaas \
     -H "Content-Type: application/json" \
     -d '{"event":"PAYMENT_CONFIRMED","payment":{"id":"test"}}'
   ```

2. **Coupon Limit:**
   - Create coupon with `maxUses: 2`
   - Create 2 orders and pay for both
   - Try 3rd order → Should reject as "Cupom esgotado"
   - Verify coupon is only counted after payment, not on order creation

3. **Rate Limiting:**
   - Create 3 pending orders rapidly
   - Try 4th order → Should reject
   - Wait 1 hour or complete one order
   - Should allow new order

---

## Deployment Checklist

Before going to production:

- [x] ~~Set `ASAAS_WEBHOOK_SECRET` environment variable~~ **DONE**
- [x] ~~Remove/disable webhook authentication bypass code~~ **DONE**
- [ ] Move coupon usage tracking to post-payment
- [ ] Add rate limiting to order creation
- [ ] Test webhook authentication (should reject invalid signatures)
- [ ] Test coupon usage limits after fix
- [ ] Test rate limiting after fix
- [ ] Set `ASAAS_ENVIRONMENT=production`
- [ ] Monitor webhook logs for authentication failures
- [ ] Set up alerts for payment amount mismatches

---

## Estimated Implementation Time

- ~~Fix #1 (Webhook Auth)~~ ✅ **COMPLETED**
- Fix #2 (Coupon Tracking): **30 minutes**
- Fix #3 (Rate Limiting): **20 minutes**
- Testing: **30 minutes**

**Remaining: ~80 minutes**
