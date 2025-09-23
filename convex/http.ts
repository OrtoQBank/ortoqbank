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

          // For new users, try to link any confirmed payments (strict mode)
          if (event.type === 'user.created' && event.data.email_addresses?.[0]?.email_address) {
            try {
              console.log(`🔗 New user created: ${event.data.email_addresses[0].email_address}`);
              
              const result = await ctx.runMutation(internal.asaas.linkUserAfterSignup, {
                clerkUserId: event.data.id,
                email: event.data.email_addresses[0].email_address,
              });
              
              console.log(`✅ Linked ${result.linkedOrders} confirmed payment(s) to new user`);
            } catch (linkError) {
              console.error('Error linking user after signup:', linkError);
              // Don't fail the whole webhook if linking fails
            }
          }
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
      // Get webhook body
      const rawBody = await request.text();
      
      // For development/testing, we'll be more lenient with webhook authentication
      const asaasSignature = request.headers.get('asaas-access-token') || 
                           request.headers.get('authorization') ||
                           request.headers.get('x-asaas-signature');
      
      const webhookSecret = process.env.ASAAS_WEBHOOK_SECRET;
      
      // Log headers for debugging
      console.log('AsaaS Webhook Headers:', {
        'asaas-access-token': request.headers.get('asaas-access-token'),
        'authorization': request.headers.get('authorization'),
        'x-asaas-signature': request.headers.get('x-asaas-signature'),
        'content-type': request.headers.get('content-type'),
      });

      // Skip authentication for sandbox testing if no token configured
      if (webhookSecret && webhookSecret !== 'your-secret-key-here') {
        if (!asaasSignature) {
          console.error('Missing AsaaS authentication header');
          return new Response('Missing authentication', { status: 400 });
        }

        if (asaasSignature !== webhookSecret) {
          console.error('Invalid AsaaS webhook signature');
          return new Response('Invalid signature', { status: 401 });
        }
      } else {
        console.log('⚠️ Webhook authentication disabled for testing');
      }

      const body = JSON.parse(rawBody);
      const { event, payment, checkout } = body;

      console.log(`AsaaS webhook received: ${event}`, {
        paymentId: payment?.id,
        checkoutId: checkout?.id,
      });

      // Only process Checkout events (hosted checkout API)
      const RELEVANT_EVENTS = [
        'CHECKOUT_PAID',      // Payment successful
        'CHECKOUT_CANCELED',  // User cancelled
        'CHECKOUT_EXPIRED',   // Checkout expired
      ];

      if (!RELEVANT_EVENTS.includes(event)) {
        console.log(`Ignoring AsaaS webhook event: ${event}`);
        return new Response('Event ignored', { status: 200 });
      }

      // Process checkout webhook
      await ctx.runAction(internal.payments.processAsaasCheckoutWebhook, {
        event,
        checkout,
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
