// app/api/mercado-pago/webhook/route.ts

import * as Sentry from '@sentry/nextjs';
import { Payment } from 'mercadopago';
import { NextResponse } from 'next/server';

import { handleMercadoPagoPayment } from '@/lib/handle-payments';
import mpClient, { verifyMercadoPagoSignature } from '@/lib/mercado-pago';

export async function POST(request: Request) {
  try {
    // Log webhook receipt to Sentry
    Sentry.addBreadcrumb({
      message: 'Mercado Pago webhook received',
      category: 'webhook',
      level: 'info',
      data: { url: request.url },
    });

    // Verify webhook signature
    const signatureError = verifyMercadoPagoSignature(request);
    if (signatureError) {
      Sentry.captureMessage('Mercado Pago webhook signature invalid', {
        level: 'warning',
        tags: {
          operation: 'webhook-signature-invalid',
          source: 'mercado-pago',
        },
        extra: {
          headers: Object.fromEntries(request.headers.entries()),
        },
      });
      return signatureError; // Returns the error response from verification function
    }

    // Log successful signature verification
    Sentry.addBreadcrumb({
      message: 'Webhook signature verified successfully',
      category: 'webhook',
      level: 'info',
    });

    const body = await request.json();
    const { type, data } = body;

    console.log('Webhook body:', { type, data });

    // Track webhook type in Sentry
    Sentry.setTag('webhook.type', type);
    Sentry.setTag('webhook.data_id', data?.id || 'unknown');

    switch (type) {
      case 'payment': {
        try {
          // Handle real payments
          const payment = new Payment(mpClient);
          const paymentData = await payment.get({ id: data.id });

          console.log('Payment data:', {
            id: paymentData.id,
            status: paymentData.status,
            date_approved: paymentData.date_approved,
          });

          // Track payment details in Sentry
          Sentry.setTag('payment.id', paymentData.id);
          Sentry.setTag('payment.status', paymentData.status || 'unknown');
          Sentry.addBreadcrumb({
            message: 'Payment data retrieved',
            category: 'payment',
            level: 'info',
            data: {
              paymentId: paymentData.id,
              status: paymentData.status,
              dateApproved: paymentData.date_approved,
            },
          });

          if (
            paymentData.status === 'approved' || // Pagamento por cartão OU
            paymentData.date_approved != null // Pagamento por Pix
          ) {
            console.log('Payment approved, processing...');
            await handleMercadoPagoPayment(paymentData);
            console.log('Payment processed successfully');

            // Log successful payment processing
            Sentry.captureMessage('Payment processed successfully', {
              level: 'info',
              tags: {
                operation: 'payment-success',
                paymentId: paymentData.id,
                status: paymentData.status,
              },
            });
          } else {
            console.log('Payment not approved, skipping processing');

            // Log non-approved payment for monitoring
            Sentry.captureMessage('Payment not approved', {
              level: 'warning',
              tags: {
                operation: 'payment-not-approved',
                paymentId: paymentData.id,
                status: paymentData.status,
              },
              extra: {
                paymentDetails: {
                  id: paymentData.id,
                  status: paymentData.status,
                  dateApproved: paymentData.date_approved,
                },
              },
            });
          }

          return NextResponse.json({ received: true }, { status: 200 });
        } catch (error) {
          console.error('Error processing payment:', error);

          // Critical error - capture in Sentry
          Sentry.captureException(error, {
            tags: {
              operation: 'payment-processing',
              paymentId: data.id,
            },
            extra: {
              webhookData: { type, data },
            },
          });

          return NextResponse.json(
            { error: 'Payment processing failed' },
            { status: 500 },
          );
        }
      }
      default: {
        console.log('Unhandled event type:', type);
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Error handling webhook:', error);

    // Critical webhook error - capture in Sentry
    Sentry.captureException(error, {
      tags: {
        operation: 'webhook-processing',
        source: 'mercado-pago',
      },
      extra: {
        url: request.url,
        headers: Object.fromEntries(request.headers.entries()),
        requestId: request.headers.get('x-request-id') ?? undefined,
      },
    });

    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 },
    );
  }
}
