# AsaaS Payment Gateway Integration Setup

This document outlines how to set up and use the AsaaS payment gateway integration in the OrtoQBank application.

## Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# AsaaS API Configuration
ASAAS_API_KEY=your_asaas_api_key_here
ASAAS_WEBHOOK_SECRET=your_webhook_secret_here

# Optional: Payment Gateway Selection
PAYMENT_GATEWAY=asaas  # or 'mercadopago' to use the old system
```

### Getting AsaaS API Keys

1. **Create AsaaS Account**: Sign up at [https://asaas.com](https://asaas.com)
2. **Access API Settings**: Go to Settings > API Configuration
3. **Get API Key**: Copy your API key (use sandbox key for testing)
4. **Set Webhook Secret**: Create a webhook secret for security

### Sandbox vs Production

- **Sandbox URL**: `https://api-sandbox.asaas.com/v3`
- **Production URL**: `https://api.asaas.com/v3`

The system automatically uses sandbox URLs when `NODE_ENV !== 'production'`.

## AsaaS Features Implemented

### 1. Payment Methods
- **PIX**: Instant payments with QR code generation
- **Boleto**: Traditional bank slip payments
- **Credit Card**: Direct integration with card processing
- **Multiple payment options**: Customer can choose preferred method

### 2. Customer Management
- Automatic customer creation in AsaaS
- Customer data synchronization
- Email-based customer lookup

### 3. Webhook Integration
- Real-time payment status updates
- Secure webhook verification
- Support for all AsaaS payment events

### 4. Enhanced UX Features
- In-app payment selection (no redirect required)
- Real-time payment status polling
- PIX QR code display and copy functionality
- Boleto download and viewing
- Payment confirmation notifications

## API Endpoints

### AsaaS Endpoints
- `POST /api/asaas/create-checkout` - Create payment charges
- `GET /api/asaas/create-checkout?coupon=CODE` - Validate coupon codes
- `POST /api/asaas/webhook` - Handle AsaaS webhooks
- `GET /api/asaas/payment-status?chargeId=ID` - Check payment status

### Webhook Configuration

In your AsaaS dashboard, configure webhooks to point to:
```
https://yourdomain.com/api/asaas/webhook
```

**Webhook Events Supported:**
- `PAYMENT_RECEIVED` - Payment confirmed
- `PAYMENT_CONFIRMED` - Payment processed
- `PAYMENT_OVERDUE` - Payment overdue
- `PAYMENT_DELETED` - Payment cancelled
- `PAYMENT_RESTORED` - Payment restored
- `PAYMENT_REFUNDED` - Payment refunded

## Component Usage

### Basic Usage

```tsx
import CheckoutAsaasModal from '@/components/checkout-asaas-modal';

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <CheckoutAsaasModal 
      open={isOpen} 
      onOpenChange={setIsOpen} 
    />
  );
}
```

### Using the Hook

```tsx
import useAsaas from '@/hooks/useAsaas';

function PaymentComponent() {
  const { 
    createAsaasCheckout, 
    checkoutData, 
    copyPixCode, 
    openBoleto 
  } = useAsaas();

  // Create checkout programmatically
  const handlePayment = async () => {
    const result = await createAsaasCheckout({
      userEmail: 'user@example.com',
      userName: 'João',
      userLastName: 'Silva',
      // ... other data
    });
  };
}
```

## Payment Flow

### 1. Customer Data Collection
- Customer fills out the form with personal and address information
- Optional coupon code validation
- CPF validation for Brazilian customers

### 2. Payment Method Selection
- **PIX**: Shows QR code and copy/paste code
- **Boleto**: Generates downloadable bank slip
- **Credit Card**: Redirects to AsaaS payment page

### 3. Payment Processing
- Real-time status updates via polling
- Webhook notifications for status changes
- Automatic user registration/update in Clerk

### 4. Payment Confirmation
- Success/failure notifications
- Automatic redirect to success page
- Email notifications (if configured)

## Testing

### Sandbox Testing
1. Use AsaaS sandbox credentials
2. Test all payment methods:
   - PIX: Use test QR codes
   - Boleto: Generate test boletos
   - Credit Card: Use test card numbers

### Test Data
AsaaS provides test credit card numbers and scenarios for comprehensive testing.

## Migration from MercadoPago

The AsaaS integration is designed to coexist with MercadoPago. To switch:

1. Set environment variable: `PAYMENT_GATEWAY=asaas`
2. Update frontend to use `CheckoutAsaasModal` instead of `CheckoutEmailModal`
3. Test thoroughly in sandbox environment
4. Deploy and monitor payment success rates

## Monitoring and Analytics

### Payment Tracking
- All payments include `externalReference` for tracking
- Clerk user metadata updated with payment information
- Sentry integration for error monitoring

### Key Metrics to Monitor
- Payment conversion rates by method
- Payment processing times
- Error rates and failure reasons
- Customer satisfaction scores

## Security Considerations

1. **Webhook Verification**: All webhooks are verified using HMAC-SHA256
2. **API Key Security**: Store API keys securely, never expose in frontend
3. **Rate Limiting**: Built-in rate limiting for all endpoints
4. **Data Validation**: All input data is validated before processing

## Support and Documentation

- **AsaaS Documentation**: [https://docs.asaas.com](https://docs.asaas.com)
- **AsaaS Support**: Available through their dashboard
- **Integration Issues**: Check logs in Sentry dashboard

## Troubleshooting

### Common Issues

1. **Webhook not receiving events**
   - Check webhook URL configuration in AsaaS dashboard
   - Verify webhook secret matches environment variable
   - Check network connectivity and firewall settings

2. **Payment not processing**
   - Verify API key is correct and active
   - Check if customer data is valid
   - Monitor AsaaS dashboard for API errors

3. **QR Code not displaying**
   - Ensure PIX is enabled in your AsaaS account
   - Check if charge was created successfully
   - Verify base64 image encoding

### Debugging

Enable debug logging by setting `NODE_ENV=development` and checking:
- Browser network tab for API responses
- Server logs for webhook processing
- Sentry dashboard for error tracking
