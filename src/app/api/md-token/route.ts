import { auth } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  // Verify user authentication
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use read-only token for frontend access instead of read-write token
  const token = process.env.MOTHERDUCK_READ_SCALING_TOKEN;
  if (!token) {
    console.error(
      'MOTHERDUCK_READ_SCALING_TOKEN environment variable is not set',
    );
    return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
  }

  // The token provided to the frontend permits eventually consistent read-only access to data in the MotherDuck account.
  // This is safer than exposing the read-write MOTHERDUCK_TOKEN to the frontend.
  // To generate short-lived tokens for use in the frontend, see the
  // MotherDuck API documentation: https://api.motherduck.com/docs/
  return NextResponse.json({ mdToken: token });
}
