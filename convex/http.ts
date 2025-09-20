import type { WebhookEvent } from '@clerk/backend';
import { httpRouter } from 'convex/server';
import { Webhook } from 'svix';

import { internal } from './_generated/api';
import { httpAction } from './_generated/server';

const http = httpRouter();

http.route({
  path: '/clerk-users-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const event = await validateRequest(request);
    if (!event) {
      return new Response('Error occured', { status: 400 });
    }
    switch (event.type) {
      case 'user.created': // intentional fallthrough
      case 'user.updated': {
        try {
          // Prepare the data for Convex by ensuring proper types
          const userData = {
            ...event.data,
            termsAccepted: false, // Always set default value for termsAccepted on webhook events
            public_metadata: {
              ...event.data.public_metadata,
              // Convert payment ID to string if it exists
              paymentId: event.data.public_metadata?.paymentId?.toString(),
            },
          };

          await ctx.runMutation(internal.users.upsertFromClerk, {
            data: userData,
          });
        } catch (error) {
          console.error('Error upserting user from Clerk', error);
        }

        break;
      }

      case 'user.deleted': {
        const clerkUserId = event.data.id!;
        await ctx.runMutation(internal.users.deleteFromClerk, { clerkUserId });
        break;
      }

      default: {
        console.log('Ignored Clerk webhook event', event.type);
      }
    }

    return new Response(undefined, { status: 200 });
  }),
});

// AsaaS webhook handler
http.route({
  path: '/webhooks/asaas',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      // Verify AsaaS webhook signature
      const rawBody = await request.text();
      const asaasSignature = request.headers.get('asaas-access-token');
      
      if (!asaasSignature) {
        console.error('Missing AsaaS signature header');
        return new Response('Missing signature', { status: 400 });
      }

      const webhookSecret = process.env.ASAAS_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error('Missing ASAAS_WEBHOOK_SECRET environment variable');
        return new Response('Server configuration error', { status: 500 });
      }

      // AsaaS sends the webhook secret as a header for verification
      if (asaasSignature !== webhookSecret) {
        console.error('Invalid AsaaS webhook signature');
        return new Response('Invalid signature', { status: 401 });
      }

      const body = JSON.parse(rawBody);
      const { event, payment } = body;

      console.log(`AsaaS webhook received: ${event} for payment ${payment?.id}`);

      // Only process payment events that grant access
      const RELEVANT_EVENTS = [
        'PAYMENT_RECEIVED',
        'PAYMENT_CONFIRMED',
        'PAYMENT_OVERDUE',
        'PAYMENT_DELETED', 
        'PAYMENT_REFUNDED',
      ];

      if (!RELEVANT_EVENTS.includes(event)) {
        console.log(`Ignoring AsaaS webhook event: ${event}`);
        return new Response('Event ignored', { status: 200 });
      }

      // Process the payment webhook
      await ctx.runAction(internal.payments.processAsaasWebhook, {
        event,
        payment,
        rawWebhookData: body,
      });

      return new Response('OK', { status: 200 });

    } catch (error) {
      console.error('Error processing AsaaS webhook:', error);
      return new Response('Webhook processing failed', { status: 500 });
    }
  }),
});

async function validateRequest(
  req: Request,
): Promise<WebhookEvent | undefined> {
  const payloadString = await req.text();
  const svixHeaders = {
    'svix-id': req.headers.get('svix-id')!,
    'svix-timestamp': req.headers.get('svix-timestamp')!,
    'svix-signature': req.headers.get('svix-signature')!,
  };
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  try {
    return wh.verify(payloadString, svixHeaders) as unknown as WebhookEvent;
  } catch (error) {
    console.error('Error verifying webhook event', error);
    return undefined;
  }
}

export default http;
