// app/api/mercado-pago/webhook/route.ts

import * as Sentry from '@sentry/nextjs';
import { Payment } from 'mercadopago';
import { NextResponse } from 'next/server';

import { handleMercadoPagoPayment } from '@/lib/handle-payments';
import mpClient, { verifyMercadoPagoSignature } from '@/lib/mercado-pago';

export async function POST(request: Request) {
  return Sentry.withScope(async scope => {
    scope.setTag('webhook.source', 'mercado-pago');
    scope.setContext('webhook', {
      type: 'mercado-pago',
      operation: 'webhook-processing',
    });

    try {
      // Basic allowlist for Mercado Pago IP ranges if provided via headers (best-effort)
      const cfConnectingIp = (request.headers as any).get?.('x-forwarded-for');
      if (typeof cfConnectingIp === 'string') {
        Sentry.addBreadcrumb({
          message: 'Webhook source IP',
          category: 'webhook',
          level: 'info',
          data: { ip: cfConnectingIp.split(',')[0].trim() },
        });
      }

      Sentry.addBreadcrumb({
        message: 'Webhook received',
        category: 'webhook',
        level: 'info',
      });

      // Verify Mercado Pago signature and short-circuit on failure
      const sigError = verifyMercadoPagoSignature(request);
      if (sigError) {
        return sigError;
      }

      Sentry.addBreadcrumb({
        message: 'Signature verified',
        category: 'webhook',
        level: 'info',
      });

      const body = await request.json();
      const { type, data } = body;

      scope.setTags({
        'webhook.type': type,
        'webhook.data_id': data?.id || 'unknown',
      });

      Sentry.addBreadcrumb({
        message: 'Webhook body parsed',
        category: 'webhook',
        level: 'info',
        data: {
          type,
          dataId: data?.id || 'unknown',
        },
      });

      switch (type) {
        case 'payment': {
          return Sentry.withScope(async paymentScope => {
            paymentScope.setTag('payment.id', data.id);
            paymentScope.setContext('payment', {
              id: data.id,
              operation: 'payment-processing',
            });

            try {
              // Handle real payments
              const payment = new Payment(mpClient);
              const paymentData = await payment.get({ id: data.id });

              paymentScope.setTags({
                'payment.status': paymentData.status || 'unknown',
                'payment.date_approved': paymentData.date_approved || 'null',
              });

              Sentry.addBreadcrumb({
                message: 'Payment data retrieved',
                category: 'payment',
                level: 'info',
                data: {
                  status: paymentData.status,
                  dateApproved: paymentData.date_approved,
                },
              });

              if (
                paymentData.status === 'approved' || // Pagamento por cartão OU
                paymentData.date_approved !== null // Pagamento por Pix
              ) {
                Sentry.addBreadcrumb({
                  message: 'Payment approved, processing...',
                  category: 'payment',
                  level: 'info',
                });

                // Basic sanity checks: currency and amount vs metadata
                try {
                  const expectedAmount = (paymentData.metadata as any)
                    ?.final_price;
                  const currency = (paymentData as any)?.currency_id;
                  if (
                    typeof expectedAmount === 'number' &&
                    typeof (paymentData as any)?.transaction_amount ===
                      'number' &&
                    (paymentData as any).transaction_amount !== expectedAmount
                  ) {
                    Sentry.captureMessage('Payment amount mismatch', {
                      level: 'warning',
                      tags: { operation: 'payment-amount-mismatch' },
                      extra: {
                        expectedAmount,
                        paidAmount: (paymentData as any).transaction_amount,
                        paymentId: paymentData.id,
                      },
                    });
                    return NextResponse.json(
                      { error: 'Invalid amount' },
                      { status: 400 },
                    );
                  }
                  if (currency && currency !== 'BRL') {
                    Sentry.captureMessage('Unexpected currency', {
                      level: 'warning',
                      tags: { operation: 'payment-currency-mismatch' },
                      extra: {
                        currency,
                        paymentId: paymentData.id,
                      },
                    });
                    return NextResponse.json(
                      { error: 'Invalid currency' },
                      { status: 400 },
                    );
                  }
                } catch (error) {
                  Sentry.captureException(error, {
                    tags: { operation: 'payment-sanity-check' },
                  });
                  return NextResponse.json(
                    { error: 'Internal validation error' },
                    { status: 500 },
                  );
                }

                await handleMercadoPagoPayment(paymentData);

                Sentry.addBreadcrumb({
                  message: 'Payment processed successfully',
                  category: 'payment',
                  level: 'info',
                });

                // Capture successful payment processing
                Sentry.captureMessage('Payment processed successfully', {
                  level: 'info',
                  tags: {
                    operation: 'payment-success',
                    paymentId: data.id,
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
              } else {
                Sentry.addBreadcrumb({
                  message: 'Payment not approved, skipping processing',
                  category: 'payment',
                  level: 'info',
                });

                // Capture non-approved payment
                Sentry.captureMessage('Payment not approved', {
                  level: 'warning',
                  tags: {
                    operation: 'payment-not-approved',
                    paymentId: data.id,
                    status: paymentData.status,
                  },
                  extra: {
                    paymentDetails: {
                      id: paymentData.id,
                      status: paymentData.status,
                      dateApproved: paymentData.date_approved,
                      reason: 'Payment status not approved',
                    },
                  },
                });
              }

              return NextResponse.json({ received: true }, { status: 200 });
            } catch (error) {
              Sentry.captureException(error, {
                tags: {
                  operation: 'payment-processing',
                  paymentId: data.id,
                },
              });
              throw error;
            }
          });
        }
        // case "subscription_preapproval": Eventos de assinatura
        //   console.log("Subscription preapproval event");
        //   console.log(data);
        //   break;
        default: {
          Sentry.addBreadcrumb({
            message: 'Unhandled event type',
            category: 'webhook',
            level: 'warning',
            data: { type },
          });
          console.log('Unhandled event type:', type);
        }
      }

      // Capture successful webhook completion
      Sentry.captureMessage('Webhook processed successfully', {
        level: 'info',
        tags: {
          operation: 'webhook-success',
          webhookType: type,
          dataId: data?.id || 'unknown',
        },
      });

      return NextResponse.json({ received: true }, { status: 200 });
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          operation: 'webhook-processing',
          source: 'mercado-pago',
        },
      });

      console.error('Error handling webhook:', error);
      return NextResponse.json(
        { error: 'Webhook handler failed' },
        { status: 500 },
      );
    }
  });
}
