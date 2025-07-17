import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  return Sentry.withScope(async scope => {
    scope.setTag('test.source', 'sentry-integration-test');
    scope.setContext('test', {
      type: 'integration-test',
      operation: 'test-sentry-logging',
    });

    try {
      Sentry.addBreadcrumb({
        message: 'Test endpoint called',
        category: 'test',
        level: 'info',
      });

      Sentry.addBreadcrumb({
        message: 'Testing Sentry integration',
        category: 'test',
        level: 'info',
        data: {
          timestamp: new Date().toISOString(),
          testId: Math.random().toString(36).slice(7),
        },
      });

      // Add a query parameter to test error capture
      const url = new URL(request.url);
      const testError = url.searchParams.get('error');

      if (testError === 'true') {
        Sentry.addBreadcrumb({
          message: 'About to trigger test error',
          category: 'test',
          level: 'warning',
        });

        throw new Error('This is a test error to verify Sentry integration!');
      }

      Sentry.addBreadcrumb({
        message: 'Test completed successfully',
        category: 'test',
        level: 'info',
      });

      return NextResponse.json({
        success: true,
        message: 'Sentry integration test completed successfully!',
        instructions:
          'Check your Sentry dashboard for breadcrumbs and tags. To test error capture, add ?error=true to the URL.',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          operation: 'sentry-integration-test',
          testType: 'error-capture',
        },
      });

      return NextResponse.json(
        {
          success: false,
          message: 'Test error captured by Sentry!',
          error: error instanceof Error ? error.message : 'Unknown error',
          instructions:
            'Check your Sentry dashboard for the captured exception.',
        },
        { status: 500 },
      );
    }
  });
}

export async function POST(request: Request) {
  return Sentry.withScope(async scope => {
    scope.setTag('test.method', 'POST');
    scope.setTag('test.source', 'webhook-simulation');

    try {
      const body = await request.json();

      Sentry.addBreadcrumb({
        message: 'Simulating webhook processing',
        category: 'webhook-test',
        level: 'info',
        data: body,
      });

      scope.setTags({
        'test.type': body.type || 'unknown',
        'test.data_id': body.data?.id || 'unknown',
      });

      Sentry.addBreadcrumb({
        message: 'Webhook simulation completed',
        category: 'webhook-test',
        level: 'info',
      });

      return NextResponse.json({
        success: true,
        message: 'Webhook simulation logged to Sentry successfully!',
        received: body,
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          operation: 'webhook-simulation-test',
        },
      });

      return NextResponse.json(
        {
          success: false,
          message: 'Webhook simulation error captured by Sentry!',
        },
        { status: 500 },
      );
    }
  });
}
