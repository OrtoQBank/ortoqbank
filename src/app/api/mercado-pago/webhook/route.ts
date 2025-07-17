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
      Sentry.addBreadcrumb({
        message: 'Webhook received',
        category: 'webhook',
        level: 'info',
      });

      // Skip signature verification for test requests
      const isTestRequest = request.headers.get('x-test-webhook') === 'true';
      const triggerError = request.headers.get('x-trigger-error') === 'true';

      if (isTestRequest) {
        Sentry.addBreadcrumb({
          message: 'Test webhook - skipping signature verification',
          category: 'webhook',
          level: 'info',
        });
      } else {
        verifyMercadoPagoSignature(request);
      }

      Sentry.addBreadcrumb({
        message: 'Signature verified',
        category: 'webhook',
        level: 'info',
      });

      // Test error trigger
      if (triggerError) {
        Sentry.addBreadcrumb({
          message: 'Triggering test error',
          category: 'webhook',
          level: 'warning',
        });
        throw new Error('Test error triggered for Sentry verification!');
      }

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
              // Handle test payment IDs differently
              if (data.id.startsWith('test-payment-')) {
                const testStatus = data.id.includes('approved')
                  ? 'approved'
                  : data.id.includes('pending')
                    ? 'pending'
                    : 'rejected';

                paymentScope.setTags({
                  'payment.status': testStatus,
                  'payment.date_approved':
                    testStatus === 'approved'
                      ? new Date().toISOString()
                      : 'null',
                });

                Sentry.addBreadcrumb({
                  message: 'Test payment data processed',
                  category: 'payment',
                  level: 'info',
                  data: { testPaymentId: data.id, mockStatus: testStatus },
                });

                if (testStatus === 'approved') {
                  Sentry.addBreadcrumb({
                    message:
                      'Test payment approved (skipping actual processing)',
                    category: 'payment',
                    level: 'info',
                  });

                  // Capture successful test payment
                  Sentry.captureMessage('Test payment processed successfully', {
                    level: 'info',
                    tags: {
                      operation: 'test-payment-success',
                      paymentId: data.id,
                      status: testStatus,
                    },
                    extra: {
                      paymentDetails: {
                        id: data.id,
                        status: testStatus,
                        isTest: true,
                      },
                    },
                  });
                } else {
                  Sentry.addBreadcrumb({
                    message: 'Test payment not approved (skipping processing)',
                    category: 'payment',
                    level: 'info',
                  });

                  // Capture non-approved test payment
                  Sentry.captureMessage('Test payment not approved', {
                    level: 'warning',
                    tags: {
                      operation: 'test-payment-not-approved',
                      paymentId: data.id,
                      status: testStatus,
                    },
                    extra: {
                      paymentDetails: {
                        id: data.id,
                        status: testStatus,
                        isTest: true,
                        reason: 'Payment status not approved',
                      },
                    },
                  });
                }
              } else {
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

                  await handleMercadoPagoPayment(paymentData);

                  Sentry.addBreadcrumb({
                    message: 'Payment processed successfully',
                    category: 'payment',
                    level: 'info',
                  });

                  // Capture successful payment processing
                  Sentry.captureMessage('Real payment processed successfully', {
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
                        isTest: false,
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
                        isTest: false,
                        reason: 'Payment status not approved',
                      },
                    },
                  });
                }
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
