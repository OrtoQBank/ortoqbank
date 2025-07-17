import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const testType = url.searchParams.get('type') || 'approved';
  const testError = url.searchParams.get('error') === 'true';

  try {
    // Simulate different payment scenarios
    const testPayloads = {
      approved: {
        type: 'payment',
        data: {
          id: 'test-payment-approved-123',
        },
      },
      pending: {
        type: 'payment',
        data: {
          id: 'test-payment-pending-456',
        },
      },
      rejected: {
        type: 'payment',
        data: {
          id: 'test-payment-rejected-789',
        },
      },
      unknown: {
        type: 'subscription_preapproval',
        data: {
          id: 'test-subscription-123',
        },
      },
      // Add error test scenarios
      error: {
        type: 'payment',
        data: {
          id: 'test-payment-error-trigger',
        },
      },
    };

    const payload =
      testPayloads[testType as keyof typeof testPayloads] ||
      testPayloads.approved;

    // Call our actual webhook endpoint
    const webhookUrl = new URL('/api/mercado-pago/webhook', request.url);

    const response = await fetch(webhookUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add a test header to bypass signature verification
        'x-test-webhook': 'true',
        // Add error trigger header if requested
        ...(testError && { 'x-trigger-error': 'true' }),
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (testError) {
      return NextResponse.json(
        {
          success: false,
          message: `Mercado Pago webhook error test completed (${testType})`,
          testPayload: payload,
          webhookResponse: result,
          instructions: [
            'Check Sentry dashboard for ERROR events',
            'This test intentionally triggered an error',
            'Look for exception capture in Sentry',
          ],
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Mercado Pago webhook test completed (${testType})`,
      testPayload: payload,
      webhookResponse: result,
      instructions: [
        'Check Sentry dashboard for SUCCESS and WARNING events',
        'Available test types: ?type=approved, ?type=pending, ?type=rejected, ?type=unknown',
        'Add &error=true to test error capture',
        'Look for tags: webhook.type, webhook.data_id, payment.status',
      ],
      sentryTags: {
        'webhook.source': 'mercado-pago',
        'webhook.type': payload.type,
        'webhook.data_id': payload.data.id,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to test Mercado Pago webhook',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const customPayload = await request.json();

    // Call our actual webhook endpoint with custom payload
    const webhookUrl = new URL('/api/mercado-pago/webhook', request.url);

    const response = await fetch(webhookUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-webhook': 'true',
      },
      body: JSON.stringify(customPayload),
    });

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Custom Mercado Pago webhook test completed',
      testPayload: customPayload,
      webhookResponse: result,
      instructions:
        'Check Sentry dashboard for webhook events with your custom payload',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to test custom Mercado Pago webhook',
      },
      { status: 500 },
    );
  }
}
