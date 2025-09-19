# AsaaS Integration Example

Here's how to integrate the new AsaaS checkout system into your existing components:

## 1. Update Pricing Component

```tsx
// src/app/components/pricing-client.tsx
import { useState } from 'react';
import CheckoutAsaasModal from '@/components/checkout-asaas-modal';

export function PricingClient({ plans }) {
  const [showAsaasCheckout, setShowAsaasCheckout] = useState(false);
  
  return (
    <div>
      {/* Your existing pricing UI */}
      
      <Button 
        onClick={() => setShowAsaasCheckout(true)}
        className="w-full"
      >
        Comprar com AsaaS
      </Button>
      
      <CheckoutAsaasModal 
        open={showAsaasCheckout}
        onOpenChange={setShowAsaasCheckout}
      />
    </div>
  );
}
```

## 2. Environment Variables Setup

Add these to your `.env.local`:

```env
# AsaaS Configuration (Sandbox)
ASAAS_API_KEY=your_sandbox_api_key_here
ASAAS_WEBHOOK_SECRET=your_webhook_secret_here

# Optional: Payment Gateway Selection
PAYMENT_GATEWAY=asaas
```

## 3. Package Dependencies

The AsaaS integration uses existing dependencies, but make sure you have:

```json
{
  "dependencies": {
    "uuid": "^11.1.0",
    "@radix-ui/react-tabs": "^1.1.12",
    // ... other existing dependencies
  }
}
```

## 4. Testing the Integration

### Local Development
1. Set up AsaaS sandbox account
2. Configure webhook URL: `https://yourdomain.com/api/asaas/webhook`
3. Test all payment methods:
   - PIX (instant)
   - Boleto (traditional)
   - Credit Card (redirect)

### Sandbox Testing URLs
- AsaaS Dashboard: https://sandbox.asaas.com
- API Documentation: https://docs.asaas.com

## 5. Switching from MercadoPago

To switch from MercadoPago to AsaaS:

### Option A: Environment Variable Switch
```env
PAYMENT_GATEWAY=asaas  # Switch to AsaaS
# PAYMENT_GATEWAY=mercadopago  # Fallback to MercadoPago
```

### Option B: Component Replacement
Replace `CheckoutEmailModal` with `CheckoutAsaasModal` in your components:

```tsx
// Before
import CheckoutEmailModal from '@/components/checkout-email-modal';

// After  
import CheckoutAsaasModal from '@/components/checkout-asaas-modal';
```

## 6. Key Differences from MercadoPago

| Feature | MercadoPago | AsaaS |
|---------|-------------|-------|
| **Checkout Flow** | Redirect to hosted page | In-app payment selection |
| **PIX** | Redirect for QR code | Direct QR code display |
| **Boleto** | Generated via redirect | Direct boleto generation |
| **Real-time Updates** | Webhook only | Webhook + polling |
| **Customer Management** | Basic | Full CRUD operations |

## 7. Enhanced Features with AsaaS

1. **Better UX**: No redirects, everything in-app
2. **PIX Optimization**: QR code copy/download, instant feedback
3. **Payment Polling**: Real-time status updates every 5 seconds
4. **Multiple Payment Methods**: All options in one place
5. **Customer Persistence**: Better customer data management

## 8. Monitoring & Analytics

Monitor key metrics:
- Payment conversion rates by method
- Payment completion times  
- Error rates and types
- Customer satisfaction

Use existing Sentry integration for error tracking and PostHog for analytics.

## 9. Production Deployment

1. Update environment variables with production AsaaS keys
2. Configure production webhook URLs
3. Test webhook delivery
4. Monitor payment success rates
5. Set up alerting for payment failures

## 10. Rollback Strategy

If needed to rollback to MercadoPago:
1. Change `PAYMENT_GATEWAY=mercadopago`
2. Or revert component imports
3. Monitor payment flows
4. Investigate AsaaS issues offline

The AsaaS integration is designed to coexist with MercadoPago, making rollback seamless.
