---
name: Fix Clerk Invitation 404
overview: Use URL query parameters to pass tenant info through sign-up flow without storing on user.
todos:
  - id: update-invitation-redirect
    content: Update ortoqbank payments.ts to set redirect_url with tenant domain as query param
    status: pending
  - id: install-clerk-ortoclub
    content: Install @clerk/nextjs in ortoclub repo
    status: pending
  - id: create-signup-page
    content: Create /sign-up page in ortoclub that reads URL params and redirects after sign-up
    status: pending
  - id: cleanup-ortoqbank-auth
    content: Remove the sign-up/sign-in pages created in ortoqbank repo (not needed)
    status: pending
isProject: false
---

# Fix Clerk Invitation 404 - URL Params Approach

## Architecture

```mermaid
flowchart LR
    subgraph ortoqbank [ortoqbank Convex]
        INV[Create Invitation]
    end

    subgraph ortoclub [ortoclub.com]
        SIGNUP["/sign-up?domain=maoqbank.ortoclub.com"]
    end

    subgraph tenants [Tenant Apps]
        MAO[maoqbank.ortoclub.com]
        ORTO[ortoqbank.ortoclub.com]
        SBCJ[sbcjqbank.ortoclub.com]
    end

    INV -->|"redirect_url with ?domain="| SIGNUP
    SIGNUP -->|"read URL param, redirect"| MAO
    SIGNUP -->|"read URL param, redirect"| ORTO
    SIGNUP -->|"read URL param, redirect"| SBCJ
```

## Problem

- Clerk invitations redirect to tenant domain's `/sign-up` which returns 404
- Users might have multiple tenants (products) - need to redirect to the specific one they just purchased
- Don't want to store tenant data on user object

## Solution: URL Query Parameters

Pass tenant domain in the invitation's `redirect_url`. The sign-up page reads URL params and redirects after sign-up completes. No data stored on user.

### Part 1: Update Invitation Creation in ortoqbank

**File: `c:\dev\ortoqbank\convex\payments.ts` (lines 796-827)**

Change the invitation logic to include tenant domain as URL query parameter:

```typescript
// Get order to find tenantId for redirect URL
const order = await ctx.runQuery(api.payments.getPendingOrderById, {
  orderId: args.orderId,
});

// Build redirect URL with tenant info as query params
const baseUrl = process.env.AUTH_BASE_URL || "https://ortoclub.com";
let redirectUrl = `${baseUrl}/sign-up`;

if (order?.tenantId) {
  const app = await ctx.runQuery(api.apps.getAppById, {
    appId: order.tenantId,
  });
  if (app && app.domain) {
    // Pass tenant domain as URL parameter (no user metadata needed)
    redirectUrl = `${baseUrl}/sign-up?domain=${encodeURIComponent(app.domain)}`;
    console.log(`📍 Invitation redirect: ${redirectUrl}`);
  }
}

const response = await fetch("https://api.clerk.com/v1/invitations", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${CLERK_SECRET_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email_address: args.email,
    redirect_url: redirectUrl,
    public_metadata: {
      orderId: args.orderId,
      customerName: args.customerName,
    },
  }),
});
```

### Part 2: Install Clerk in ortoclub

```bash
cd c:\dev\ortoclub
npm install @clerk/nextjs @clerk/localizations
```

**File: `c:\dev\ortoclub\app\providers.tsx**`

```typescript
"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      localization={ptBR}
    >
      <NuqsAdapter>
        <ConvexProvider client={convex}>{children}</ConvexProvider>
      </NuqsAdapter>
    </ClerkProvider>
  );
}
```

### Part 3: Create Sign-Up Page in ortoclub

**File: `c:\dev\ortoclub\app\sign-up\[[...sign-up]]\page.tsx**`

```typescript
"use client";

import { SignUp, useUser } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

function SignUpContent() {
  const searchParams = useSearchParams();
  const { isSignedIn } = useUser();

  // Get tenant domain from URL parameter
  const domain = searchParams.get("domain");

  useEffect(() => {
    if (isSignedIn && domain) {
      // User just completed sign-up, redirect to their tenant
      window.location.href = `https://${domain}/perfil`;
    } else if (isSignedIn && !domain) {
      // Fallback if no domain specified
      window.location.href = "https://ortoqbank.ortoclub.com/perfil";
    }
  }, [isSignedIn, domain]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
      <SignUp
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-xl",
          },
        }}
      />
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      }
    >
      <SignUpContent />
    </Suspense>
  );
}
```

### Part 4: Environment Variables

**ortoclub `.env.local`:**

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_c3VubnktZ2FubmV0LTk2LmNsZXJrLmFjY291bnRzLmRldiQ
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

**ortoqbank Convex env (for local dev):**

```
AUTH_BASE_URL=https://your-ngrok.io
```

### Part 5: Cleanup ortoqbank

Remove the sign-up/sign-in pages accidentally created:

- `c:\dev\ortoqbank\src\app\(auth)\sign-up\` - DELETE
- `c:\dev\ortoqbank\src\app\(auth)\sign-in\` - DELETE

## Flow After Implementation

```mermaid
sequenceDiagram
    participant U as User
    participant C as Clerk API
    participant S as ortoclub.com/sign-up
    participant T as Tenant App

    Note over C: redirect_url includes ?domain=
    U->>S: Clicks invite, lands on /sign-up?domain=maoqbank.ortoclub.com
    S->>U: Shows SignUp form with Clerk ticket
    U->>S: Completes registration
    Note over S: isSignedIn becomes true
    S->>S: Read domain from URL params
    S->>T: window.location.href to tenant/perfil
    T->>U: User lands on purchased product
```

## Benefits

- **No data stored on user** - Tenant info passed via URL only
- **Simple flow** - URL params preserved through sign-up
- **Multi-tenant aware** - Each purchase has its own redirect URL
- **No database lookups in callback** - Domain already in URL
