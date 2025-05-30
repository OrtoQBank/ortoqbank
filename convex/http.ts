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
