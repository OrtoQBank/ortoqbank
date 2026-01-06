import type { WebhookEvent } from '@clerk/backend';
import { httpRouter } from 'convex/server';
import { Webhook } from 'svix';

import { api, internal } from './_generated/api';
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

          // Handle claim token from invitation metadata or find by email
          if (
            event.type === 'user.created' &&
            event.data.email_addresses?.[0]?.email_address
          ) {
            try {
              const email = event.data.email_addresses[0].email_address;
              console.log(`🔗 New user created: ${email}`);

              // Try to find and claim any paid orders for this email
              const result = await ctx.runMutation(
                api.payments.claimOrderByEmail,
                {
                  email: email,
                  clerkUserId: event.data.id,
                },
              );

              console.log(`✅ Claim result:`, result);

              // Try to update email invitation status to accepted
              try {
                const invitation = await ctx.runQuery(
                  api.payments.findSentInvitationByEmail,
                  {
                    email: email,
                  },
                );

                if (invitation) {
                  await ctx.runMutation(
                    internal.payments.updateEmailInvitationAccepted,
                    {
                      invitationId: invitation._id,
                    },
                  );
                  console.log(
                    `✅ Updated invitation status to accepted for ${email}`,
                  );
                }
              } catch (invitationError) {
                console.error(
                  'Error updating invitation status:',
                  invitationError,
                );
                // Don't fail the webhook if this fails
              }
            } catch (linkError) {
              console.error('Error claiming order with token:', linkError);
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

      // Validate webhook authentication (required for both sandbox and production)
      const asaasSignature =
        request.headers.get('asaas-access-token') ||
        request.headers.get('authorization') ||
        request.headers.get('x-asaas-signature');

      const webhookSecret = process.env.ASAAS_WEBHOOK_SECRET;

      // Log headers for debugging
      console.log('AsaaS Webhook Headers:', {
        'asaas-access-token': request.headers.get('asaas-access-token'),
        authorization: request.headers.get('authorization'),
        'x-asaas-signature': request.headers.get('x-asaas-signature'),
        'content-type': request.headers.get('content-type'),
      });

      // ALWAYS require webhook secret to be configured
      if (!webhookSecret) {
        console.error(
          'ASAAS_WEBHOOK_SECRET environment variable not configured',
        );
        return new Response('Server configuration error', { status: 500 });
      }

      // ALWAYS require authentication header
      if (!asaasSignature) {
        console.error('Missing AsaaS authentication header');
        return new Response('Unauthorized - Missing authentication', {
          status: 401,
        });
      }

      // ALWAYS validate signature
      if (asaasSignature !== webhookSecret) {
        console.error('Invalid AsaaS webhook signature');
        return new Response('Unauthorized - Invalid signature', {
          status: 401,
        });
      }

      console.log('✅ Webhook authentication successful');

      const body = JSON.parse(rawBody);
      const { event, payment, checkout } = body;

      console.log(`AsaaS webhook received: ${event}`, {
        paymentId: payment?.id,
        checkoutId: checkout?.id,
      });

      // Log the full webhook payload for debugging
      console.log('Full AsaaS webhook payload:', JSON.stringify(body, null, 2));

      // Process Asaas webhook events with switch case structure
      switch (event) {
        case 'PAYMENT_CONFIRMED': // intentional fallthrough
        case 'PAYMENT_RECEIVED': {
          try {
            console.log(
              `Processing ${event} event - payment with customer data`,
            );
            await ctx.runAction(internal.payments.processAsaasWebhook, {
              event,
              payment,
              rawWebhookData: body,
            });
          } catch (error) {
            console.error(`Error processing ${event}:`, error);
          }
          break;
        }

        default: {
          console.log(`Ignoring AsaaS webhook event: ${event}`);
          return new Response('Event ignored', { status: 200 });
        }
      }

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
