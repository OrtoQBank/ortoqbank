/* eslint-disable unicorn/prefer-string-raw */

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import {
  extractSubdomain,
  getTenantCookieOptions,
  isValidTenantSlug,
  TENANT_COOKIE_NAME,
} from '@/lib/tenant';

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/criar-teste(.*)',
  '/perfil(.*)',
  '/simulados(.*)',
  '/suporte(.*)',
  '/trilhas(.*)',
  '/testes-previos(.*)',
  '/quiz-results(.*)',
]);

const isAdminRoute = createRouteMatcher(['/admin(.*)']);

// Define webhook routes that should bypass authentication
const isWebhookRoute = createRouteMatcher(['/api/webhooks/clerk(.*)']);

export default clerkMiddleware(async (auth, request) => {
  // ==========================================================================
  // TENANT DETECTION
  // Extract subdomain from hostname and set tenant cookie
  // ==========================================================================
  const hostname = request.headers.get('host') || 'localhost:3000';
  const subdomain = extractSubdomain(hostname);

  // Determine the tenant slug
  const tenantSlug =
    subdomain && isValidTenantSlug(subdomain) ? subdomain : 'ortoqbank';

  // Get existing tenant cookie
  const existingTenantCookie = request.cookies.get(TENANT_COOKIE_NAME);

  // ==========================================================================
  // WEBHOOK ROUTES - Skip authentication
  // ==========================================================================
  if (isWebhookRoute(request)) {
    const response = NextResponse.next();

    // Set tenant cookie if changed or not present
    if (existingTenantCookie?.value !== tenantSlug) {
      const cookieOptions = getTenantCookieOptions();
      response.cookies.set(TENANT_COOKIE_NAME, tenantSlug, {
        maxAge: cookieOptions.maxAge,
        path: cookieOptions.path,
        sameSite: cookieOptions.sameSite,
        secure: cookieOptions.secure,
      });
    }

    return response;
  }

  // ==========================================================================
  // PROTECTED ROUTES - Require authentication
  // ==========================================================================
  if (isProtectedRoute(request)) await auth.protect();

  // NOTE: User-App access control is enforced at:
  // 1. Convex backend (authoritative) - via requireAppAccess/requireAppModerator in mutations
  // 2. Frontend (defense in depth) - via SessionProvider checking userAppAccess.checkMyAccess
  // Middleware cannot directly query Convex (edge runtime limitation), so we rely on
  // the above two layers. If a user accesses an app without permission, they will see
  // an access denied UI and mutations will be blocked.

  // ==========================================================================
  // ADMIN ROUTES - Additional role verification
  // ==========================================================================
  if (isAdminRoute(request)) {
    await auth.protect();

    const { sessionClaims } = await auth();
    // Check both old Clerk metadata (for existing admins) and allow through
    // The backend will do the authoritative role check using database data
    const hasClerkAdminRole = sessionClaims?.metadata?.role === 'admin';

    // For now, allow all authenticated users through
    // Backend requireAdmin() will be the final authority
    // This can be tightened later once all admins are migrated to backend roles
    if (!hasClerkAdminRole) {
      console.log(
        'Admin route accessed without Clerk admin role - backend will verify',
      );
    }
  }

  // ==========================================================================
  // SET TENANT COOKIE ON RESPONSE
  // ==========================================================================
  const response = NextResponse.next();

  // Set tenant cookie if changed or not present
  if (existingTenantCookie?.value !== tenantSlug) {
    const cookieOptions = getTenantCookieOptions();
    response.cookies.set(TENANT_COOKIE_NAME, tenantSlug, {
      maxAge: cookieOptions.maxAge,
      path: cookieOptions.path,
      sameSite: cookieOptions.sameSite,
      secure: cookieOptions.secure,
    });

    // Log tenant detection for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[Tenant] Detected tenant: ${tenantSlug} (subdomain: ${subdomain || 'none'})`,
      );
    }
  }

  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
