# AsaaS → Convex → Clerk → Next.js Integration

Complete E2E implementation for AsaaS payment processing with Convex backend and Clerk authentication.

## Architecture Overview

```
User → Next.js → Convex → AsaaS → Webhook → Convex → Clerk → User Onboarding
```

## 🗂️ Files Created

### Convex Backend

1. **Schema** (`convex/schema.ts`)
   - `pendingOrders` - Tracks checkout sessions
   - `payments` - Idempotent payment event records
   - `appUsers` - Internal user records with entitlements

2. **AsaaS Integration** (`convex/asaas.ts`)
   - `createCheckout` - Create AsaaS checkout session
   - `createPendingOrder` - Store pending order in Convex
   - `validateCoupon` - Validate discount coupons
   - `getPendingOrder` - Query order status

3. **Payment Processing** (`convex/payments.ts`)
   - `processAsaasWebhook` - Main webhook processor
   - `upsertPayment` - Idempotent payment recording
   - `provisionAccess` - Grant access and create Clerk invitations
   - `revokeAccess` - Handle refunds/chargebacks

4. **Webhook Handler** (`convex/http.ts`)
   - `/webhooks/asaas` - Secure webhook endpoint
   - Signature verification
   - Event routing to payment processor

### Frontend Components

5. **Checkout Modal** (`src/components/checkout-asaas-convex-modal.tsx`)
   - Complete checkout form
   - Real-time payment status updates
   - Multiple payment methods (PIX, Boleto, Card)
   - Convex integration with real-time queries

6. **Onboarding Page** (`src/app/(dashboard)/onboarding/page.tsx`)
   - Welcome flow for new users
   - Payment confirmation display
   - Account activation status

## 🔄 Complete Flow

### 1. Checkout Initialization
```typescript
// User clicks "Buy" → Component calls Convex
const result = await createCheckout({
  email: "user@example.com",
  firstName: "João",
  lastName: "Silva",
  // ... other customer data
});

// Creates:
// - AsaaS customer
// - AsaaS charges (main + PIX)
// - Pending order in Convex
// - Returns payment URLs and QR codes
```

### 2. Payment Processing
```typescript
// AsaaS webhook → Convex http.ts
POST /webhooks/asaas
{
  "event": "PAYMENT_RECEIVED",
  "payment": {
    "id": "pay_123",
    "status": "RECEIVED",
    "externalReference": "ortoqbank_1234567890",
    // ... payment details
  }
}

// Triggers:
// 1. Idempotent payment recording
// 2. Order status update
// 3. Access provisioning
```

### 3. Access Provisioning
```typescript
// payments.ts - provisionAccess()
// 1. Check if Clerk user exists
const clerkUser = await checkClerkUserExists(email);

if (clerkUser) {
  // Update existing user metadata
  await updateClerkUserMetadata(clerkUser.id, { paid: true });
} else {
  // Create Clerk invitation
  const invitation = await createClerkInvitation({
    emailAddress: email,
    redirectUrl: "/onboarding?order=123"
  });
}

// 2. Create/update app user
await ctx.runMutation(internal.payments.upsertAppUser, {
  email, hasAccess: true, status: 'active'
});
```

### 4. User Onboarding
```typescript
// User clicks invite link → signs up → redirected to /onboarding
// Component queries order status in real-time
const pendingOrder = useQuery(api.asaas.getPendingOrder, { checkoutId });

// Shows welcome screen with:
// - Payment confirmation
// - Account features
// - "Get Started" button
```

## 🔧 Environment Setup

### Required Environment Variables

```env
# AsaaS Configuration
ASAAS_API_KEY=your_asaas_api_key
ASAAS_WEBHOOK_SECRET=your_webhook_secret

# Clerk Configuration  
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_WEBHOOK_SECRET=your_clerk_webhook_secret

# Convex
NEXT_PUBLIC_CONVEX_URL=your_convex_url
CONVEX_DEPLOY_KEY=your_convex_deploy_key
```

### AsaaS Webhook Configuration

In your AsaaS dashboard, set webhook URL to:
```
https://your-app.convex.site/webhooks/asaas
```

**Events to enable:**
- `PAYMENT_RECEIVED`
- `PAYMENT_CONFIRMED` 
- `PAYMENT_OVERDUE`
- `PAYMENT_DELETED`
- `PAYMENT_REFUNDED`

## 🎯 Key Features

### ✅ Idempotency
- All webhook events are processed idempotently
- Prevents duplicate processing
- Uses AsaaS event IDs for deduplication

### ✅ Real-time Updates
- Frontend polls payment status every 5 seconds
- Automatic redirect on payment confirmation
- No manual refresh required

### ✅ Multiple Payment Methods
- **PIX**: QR code display, copy/download functionality
- **Boleto**: Direct boleto generation and download
- **Credit Card**: Redirect to AsaaS hosted checkout

### ✅ Error Handling
- Comprehensive error logging with Sentry
- Graceful fallbacks for failed operations
- Retry mechanisms for transient failures

### ✅ Security
- Webhook signature verification
- Rate limiting on all endpoints
- Input validation and sanitization

## 🚀 Integration Steps

### 1. Update Pricing Component
```tsx
// src/app/components/pricing-client.tsx
import CheckoutAsaasConvexModal from '@/components/checkout-asaas-convex-modal';

export function PricingClient({ plans }) {
  const [showCheckout, setShowCheckout] = useState(false);
  
  return (
    <div>
      <Button onClick={() => setShowCheckout(true)}>
        Comprar Agora
      </Button>
      
      <CheckoutAsaasConvexModal 
        open={showCheckout}
        onOpenChange={setShowCheckout}
      />
    </div>
  );
}
```

### 2. Deploy Convex Functions
```bash
npx convex deploy
```

### 3. Configure AsaaS Webhooks
- Set webhook URL in AsaaS dashboard
- Test with sandbox payments

### 4. Test Complete Flow
1. Create checkout → should create pending order
2. Make test payment → should trigger webhook
3. Check user provisioning → should create Clerk invitation
4. Complete sign-up → should redirect to onboarding

## 📊 Monitoring

### Key Metrics
- Payment conversion rates by method
- Webhook processing times
- Order completion rates
- User activation rates

### Error Tracking
- Sentry integration for error monitoring
- Webhook failure alerts
- Payment processing errors

### Database Queries
```typescript
// Monitor pending orders
const pendingOrders = await ctx.db
  .query("pendingOrders")
  .withIndex("by_status", q => q.eq("status", "pending"))
  .collect();

// Track successful payments
const successfulPayments = await ctx.db
  .query("payments")
  .filter(q => q.eq(q.field("status"), "RECEIVED"))
  .collect();
```

## 🔄 Lifecycle Management

### Order Expiration
```typescript
// TODO: Add cron job to expire old pending orders
// convex/crons.ts
export default cronJobs();
crons.interval("cleanup expired orders", 
  { hours: 24 }, 
  internal.payments.cleanupExpiredOrders, 
  {}
);
```

### Refund Handling
```typescript
// Automatic access revocation on refunds
// Already implemented in processAsaasWebhook
case 'PAYMENT_REFUNDED':
  await ctx.runAction(internal.payments.revokeAccess, {
    paymentId: payment.id,
  });
```

### Subscription Management
```typescript
// Future: Add subscription renewal logic
// Track access expiration dates
// Send renewal reminders
```

## 🎉 Benefits Over Previous Implementation

1. **Better Architecture**: Convex handles all business logic
2. **Real-time Updates**: No polling external APIs
3. **Idempotency**: Reliable webhook processing
4. **Better UX**: In-app payment flow, no redirects
5. **Scalability**: Convex auto-scales backend
6. **Type Safety**: Full TypeScript integration
7. **Monitoring**: Built-in observability with Convex dashboard

The implementation provides a robust, scalable payment system that follows best practices for webhook processing, user management, and real-time updates.
