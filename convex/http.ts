import type { WebhookEvent } from '@clerk/backend';
import { httpRouter } from 'convex/server';
import { Webhook } from 'svix';

import { internal } from './_generated/api';
import { httpAction } from './_generated/server';

const http = httpRouter();

// =============================================================================
// CLERK USERS WEBHOOK
// =============================================================================

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
          const userData = {
            ...event.data,
            termsAccepted: false,
            public_metadata: {
              ...event.data.public_metadata,
              paymentId: event.data.public_metadata?.paymentId?.toString(),
            },
          };

          const userId = await ctx.runMutation(internal.users.upsertFromClerk, {
            data: userData,
          });

          // On user creation, activate any pending provisioned access
          if (
            event.type === 'user.created' &&
            event.data.email_addresses?.[0]?.email_address
          ) {
            try {
              const email = event.data.email_addresses[0].email_address;
              console.log(`New user created: ${email}`);

              // Grant tenant access if tenant metadata is present
              const tenantSlug =
                event.data.public_metadata?.tenant ||
                event.data.public_metadata?.tenantSlug;

              if (tenantSlug && userId) {
                try {
                  await ctx.runMutation(
                    internal.userAppAccess.grantAccessFromWebhook,
                    {
                      userId: userId,
                      tenantSlug: tenantSlug as string,
                    },
                  );
                  console.log(
                    `Granted tenant access for ${email} to tenant: ${tenantSlug}`,
                  );
                } catch (tenantError) {
                  console.error('Error granting tenant access:', tenantError);
                }
              }

              // Activate any pending provisioned access from ortoclub
              if (userId) {
                await ctx.runMutation(
                  internal.provisioning.activatePendingAccess,
                  {
                    email,
                    userId,
                  },
                );
              }
            } catch (provisionError) {
              console.error(
                'Error activating provisioned access:',
                provisionError,
              );
              // Don't fail the webhook if this fails
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

// =============================================================================
// PROVISION ACCESS (from ortoclub central hub)
// =============================================================================

http.route({
  path: '/api/provision-access',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const authHeader = request.headers.get('Authorization');
    const expected = process.env.PROVISION_SECRET;

    if (!expected || authHeader !== `Bearer ${expected}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      const body = await request.json();
      if (!body?.tenantSlug || typeof body.tenantSlug !== 'string') {
        return new Response('Missing tenantSlug', { status: 400 });
      }

      await ctx.runMutation(internal.provisioning.provisionAccessFromHub, {
        email: body.email,
        clerkUserId: body.clerkUserId,
        tenantSlug: body.tenantSlug,
        productName: body.productName,
        orderId: body.orderId,
        purchasePrice: body.purchasePrice,
        accessExpiresAt: body.accessExpiresAt,
        couponUsed: body.couponUsed,
        discountAmount: body.discountAmount,
      });

      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Provision access error:', error);
      return new Response('Provisioning failed', { status: 500 });
    }
  }),
});

// =============================================================================
// Helpers
// =============================================================================

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
