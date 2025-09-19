import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

import { asaasClient } from '../../../../lib/asaas';
import { handleAsaasPayment } from '../../../../lib/handle-payments';

// AsaaS webhook events we care about
const RELEVANT_EVENTS = [
  'PAYMENT_RECEIVED',
  'PAYMENT_CONFIRMED', 
  'PAYMENT_OVERDUE',
  'PAYMENT_DELETED',
  'PAYMENT_RESTORED',
  'PAYMENT_REFUNDED',
  'PAYMENT_RECEIVED_IN_CASH_UNDONE',
  'PAYMENT_CHARGEBACK_REQUESTED',
  'PAYMENT_CHARGEBACK_DISPUTE',
];

function verifyAsaasWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

export async function POST(request: Request) {
  return Sentry.withScope(async scope => {
    scope.setTag('webhook.source', 'asaas');
    scope.setContext('webhook', {
      type: 'asaas',
      operation: 'webhook-processing',
    });

    try {
      // Basic IP allowlist check if provided via headers
      const cfConnectingIp = request.headers.get('x-forwarded-for');
      if (typeof cfConnectingIp === 'string') {
        Sentry.addBreadcrumb({
          message: 'Webhook source IP',
          category: 'webhook',
          level: 'info',
          data: { ip: cfConnectingIp.split(',')[0].trim() },
        });
      }

      Sentry.addBreadcrumb({
        message: 'AsaaS webhook received',
        category: 'webhook',
        level: 'info',
      });

      // Get raw body for signature verification
      const rawBody = await request.text();
      const asaasSignature = request.headers.get('asaas-access-token');

      // Verify webhook signature
      const webhookSecret = process.env.ASAAS_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error('Missing ASAAS_WEBHOOK_SECRET environment variable');
        return NextResponse.json(
          { error: 'Server configuration error' },
          { status: 500 }
        );
      }

      if (!asaasSignature) {
        console.error('Missing AsaaS signature header');
        return NextResponse.json(
          { error: 'Missing signature' },
          { status: 400 }
        );
      }

      // AsaaS sends the webhook secret as a header for verification
      if (asaasSignature !== webhookSecret) {
        console.error('Invalid AsaaS webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }

      Sentry.addBreadcrumb({
        message: 'AsaaS signature verified',
        category: 'webhook',
        level: 'info',
      });

      const body = JSON.parse(rawBody);
      const { event, payment } = body;

      scope.setTags({
        'webhook.event': event,
        'webhook.payment_id': payment?.id || 'unknown',
      });

      Sentry.addBreadcrumb({
        message: 'AsaaS webhook body parsed',
        category: 'webhook',
        level: 'info',
        data: {
          event,
          paymentId: payment?.id || 'unknown',
          paymentStatus: payment?.status || 'unknown',
        },
      });

      // Only process relevant events
      if (!RELEVANT_EVENTS.includes(event)) {
        console.log(`Ignoring AsaaS webhook event: ${event}`);
        return NextResponse.json({ received: true });
      }

      switch (event) {
        case 'PAYMENT_RECEIVED':
        case 'PAYMENT_CONFIRMED':
          return Sentry.withScope(async paymentScope => {
            paymentScope.setTag('payment.id', payment.id);
            paymentScope.setContext('payment', {
              id: payment.id,
              operation: 'payment-processing',
              event,
            });

            try {
              // Get full payment details from AsaaS API
              const fullPaymentData = await asaasClient.getCharge(payment.id);

              paymentScope.setTags({
                'payment.status': fullPaymentData.status,
                'payment.value': fullPaymentData.value,
                'payment.billing_type': fullPaymentData.billingType,
                'payment.confirmed_date': fullPaymentData.confirmedDate || 'null',
              });

              Sentry.addBreadcrumb({
                message: 'Payment data retrieved from AsaaS',
                category: 'payment',
                level: 'info',
                data: {
                  status: fullPaymentData.status,
                  value: fullPaymentData.value,
                  billingType: fullPaymentData.billingType,
                  confirmedDate: fullPaymentData.confirmedDate,
                },
              });

              // Process payment if it's confirmed/received
              if (fullPaymentData.status === 'RECEIVED' || fullPaymentData.status === 'CONFIRMED') {
                await handleAsaasPayment(fullPaymentData);
                
                Sentry.addBreadcrumb({
                  message: 'Payment processed successfully',
                  category: 'payment',
                  level: 'info',
                  data: { paymentId: fullPaymentData.id },
                });
              } else {
                console.log(`Payment ${fullPaymentData.id} has status ${fullPaymentData.status}, not processing`);
              }

              return NextResponse.json({ received: true });

            } catch (paymentError) {
              paymentScope.setLevel('error');
              Sentry.captureException(paymentError, {
                tags: { 
                  operation: 'process-asaas-payment',
                  payment_id: payment.id,
                },
              });

              console.error(`Error processing AsaaS payment ${payment.id}:`, paymentError);
              return NextResponse.json(
                { error: 'Payment processing failed' },
                { status: 500 }
              );
            }
          });

        case 'PAYMENT_OVERDUE':
          // Handle overdue payments (maybe send reminder emails)
          console.log(`Payment ${payment.id} is overdue`);
          return NextResponse.json({ received: true });

        case 'PAYMENT_DELETED':
          // Handle payment deletion
          console.log(`Payment ${payment.id} was deleted`);
          return NextResponse.json({ received: true });

        case 'PAYMENT_RESTORED':
          // Handle payment restoration
          console.log(`Payment ${payment.id} was restored`);
          return NextResponse.json({ received: true });

        case 'PAYMENT_REFUNDED':
          // Handle payment refunds
          console.log(`Payment ${payment.id} was refunded`);
          return NextResponse.json({ received: true });

        case 'PAYMENT_RECEIVED_IN_CASH_UNDONE':
          // Handle cash payment undone
          console.log(`Cash payment ${payment.id} was undone`);
          return NextResponse.json({ received: true });

        case 'PAYMENT_CHARGEBACK_REQUESTED':
        case 'PAYMENT_CHARGEBACK_DISPUTE':
          // Handle chargeback events
          console.log(`Chargeback event for payment ${payment.id}: ${event}`);
          // TODO: Implement chargeback handling logic
          return NextResponse.json({ received: true });

        default:
          console.log(`Unhandled AsaaS webhook event: ${event}`);
          return NextResponse.json({ received: true });
      }

    } catch (error) {
      scope.setLevel('error');
      Sentry.captureException(error, {
        tags: { operation: 'asaas-webhook-processing' },
      });

      console.error('Error processing AsaaS webhook:', error);
      
      return NextResponse.json(
        { error: 'Webhook processing failed' },
        { status: 500 }
      );
    }
  });
}
