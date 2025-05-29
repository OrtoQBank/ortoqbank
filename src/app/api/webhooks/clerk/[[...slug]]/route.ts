import type { WebhookEvent } from '@clerk/backend';
import { createClerkClient } from '@clerk/backend';
import { NextResponse } from 'next/server';
import { Webhook } from 'svix';

// Import env variables to make sure they're available
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET_2;

// Initialize the Clerk client
const clerk = CLERK_SECRET_KEY
  ? createClerkClient({ secretKey: CLERK_SECRET_KEY })
  : undefined;

// This is the main webhook handler for Clerk events
export async function POST(request: Request) {
  const pathname = new URL(request.url).pathname;
  console.log('>> Clerk webhook received at:', pathname);

  if (pathname !== '/api/webhooks/clerk') {
    console.log('>> Invalid path:', pathname);
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  try {
    // Get the request body and headers
    const payload = await request.text();
    const headersList = request.headers;

    // Extract Svix headers
    const svix_id = headersList.get('svix-id');
    const svix_timestamp = headersList.get('svix-timestamp');
    const svix_signature = headersList.get('svix-signature');

    // Log webhook receipt
    console.log(`[Clerk Webhook] Received webhook with ID: ${svix_id}`);

    // Validate headers
    if (!svix_id || !svix_timestamp || !svix_signature) {
      console.error('[Clerk Webhook] Missing required Svix headers');
      return NextResponse.json(
        { success: false, error: 'Missing required Svix headers' },
        { status: 400 },
      );
    }

    // Check for webhook secret
    if (!CLERK_WEBHOOK_SECRET) {
      console.error(
        '[Clerk Webhook] Missing CLERK_WEBHOOK_SECRET_2 environment variable',
      );
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 },
      );
    }

    // Check for Clerk API key and client
    if (!CLERK_SECRET_KEY || !clerk) {
      console.error(
        '[Clerk Webhook] Missing CLERK_SECRET_KEY environment variable',
      );
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 },
      );
    }

    // Verify webhook signature
    const svixHeaders = {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    };

    let event;
    try {
      const webhook = new Webhook(CLERK_WEBHOOK_SECRET);
      event = webhook.verify(payload, svixHeaders) as WebhookEvent;
      console.log(`[Clerk Webhook] Event verified: type=${event.type}`);
    } catch (error) {
      console.error('[Clerk Webhook] Webhook verification failed:', error);
      return NextResponse.json(
        { success: false, error: 'Invalid webhook signature' },
        { status: 400 },
      );
    }

    // Process the event based on type
    if (event.type === 'session.created') {
      const { user_id, id: newSessionId } = event.data;

      // Validate new session ID
      if (!newSessionId) {
        console.error(
          '[Clerk Webhook] Missing session ID in webhook data',
          event.data,
        );
        return NextResponse.json(
          { error: 'Invalid webhook data: missing session ID' },
          { status: 400 },
        );
      }

      console.log(
        `[Clerk Webhook] Processing session.created event for user ${user_id}, new session ${newSessionId}`,
      );

      try {
        // Verify Clerk API key permissions
        console.log(
          `[Clerk Webhook] API Key: ${CLERK_SECRET_KEY ? 'Present (partial: ' + CLERK_SECRET_KEY.slice(0, 5) + '...)' : 'Missing'}`,
        );

        // Get all user sessions using Clerk SDK
        console.log(`[Clerk Webhook] Fetching sessions for user ${user_id}`);

        // Get all active and idle sessions for the user
        let activeSessions = [];

        try {
          // First try without status filter in case there's an issue with the status parameter
          const allSessionsResponse = await clerk.sessions.getSessionList({
            userId: user_id,
          });

          console.log(
            `[Clerk Webhook] Raw sessions response:`,
            JSON.stringify(allSessionsResponse, undefined, 2).slice(0, 500) +
              '...',
          );

          // Filter manually to avoid any type issues
          activeSessions = allSessionsResponse.data.filter(
            session => session.status === 'active' || session.status === 'idle',
          );

          console.log(
            `[Clerk Webhook] Found ${activeSessions.length} active/idle sessions out of ${allSessionsResponse.data.length} total`,
          );
        } catch (sessionFetchError) {
          console.error(
            '[Clerk Webhook] Error fetching sessions:',
            sessionFetchError,
          );
          throw sessionFetchError;
        }

        // Explicitly log all session IDs and the one we're keeping
        console.log(`[Clerk Webhook] New session ID to keep: ${newSessionId}`);
        console.log(
          `[Clerk Webhook] All active session IDs: ${JSON.stringify(activeSessions.map(s => s.id))}`,
        );

        // Sessions to revoke are all active sessions except the current one from this webhook event
        const sessionsToRevoke = activeSessions.filter(
          session => session.id !== newSessionId,
        );

        console.log(
          `[Clerk Webhook] Found ${sessionsToRevoke.length} sessions to revoke out of ${activeSessions.length} active/idle sessions`,
        );
        console.log(
          `[Clerk Webhook] Sessions to revoke: ${JSON.stringify(sessionsToRevoke.map(s => s.id))}`,
        );

        let revokedCount = 0;
        let failedCount = 0;

        // Revoke all sessions except the current one
        if (sessionsToRevoke.length > 0) {
          for (const session of sessionsToRevoke) {
            console.log(
              `[Clerk Webhook] Revoking session ${session.id} (Status: ${session.status})`,
            );
            try {
              // Use the clerk.sessions.revokeSession method with detailed error logging
              const revokeResponse = await clerk.sessions.revokeSession(
                session.id,
              );
              console.log(
                `[Clerk Webhook] Revoke response:`,
                JSON.stringify(revokeResponse, undefined, 2).slice(0, 200) +
                  '...',
              );

              revokedCount++;
              console.log(
                `[Clerk Webhook] Successfully revoked session ${session.id}`,
              );
            } catch (revokeError) {
              failedCount++;
              console.error(
                `[Clerk Webhook] Error revoking session ${session.id}:`,
                revokeError,
                typeof revokeError === 'object'
                  ? JSON.stringify(revokeError)
                  : '',
              );
            }
          }

          console.log(
            `[Clerk Webhook] Enforced single session policy for user ${user_id}: Revoked ${revokedCount} sessions, Failed to revoke ${failedCount} sessions`,
          );
        } else {
          console.log(
            `[Clerk Webhook] No other active sessions to revoke for user ${user_id}`,
          );
        }
      } catch (error) {
        console.error(
          '[Clerk Webhook] Error processing session.created event:',
          error,
          typeof error === 'object' ? JSON.stringify(error) : '',
        );

        // Still return success to acknowledge the webhook
        return NextResponse.json(
          {
            received: true,
            error: 'Error processing webhook but acknowledged',
          },
          { status: 200 },
        );
      }
    } else {
      console.log(`[Clerk Webhook] Skipping event of type: ${event.type}`);
    }

    // Always return success to acknowledge webhook receipt
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('[Clerk Webhook] Error handling webhook:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 },
    );
  }
}
