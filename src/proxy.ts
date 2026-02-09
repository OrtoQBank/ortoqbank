/* eslint-disable unicorn/prefer-string-raw */

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import {
  getTenantCookieOptions,
  isValidTenantSlug,
  resolveTenant,
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
  const subdomain = resolveTenant(hostname);
  const pathname = request.nextUrl.pathname;

  // DEBUG: Log raw hostname and subdomain extraction
  console.log(`[DEBUG:Proxy] Request received - { pathname: "${pathname}", hostname: "${hostname}" }`);
  console.log(`[DEBUG:Proxy] Subdomain extraction - { subdomain: "${subdomain || 'null'}" }`);

  // Determine the tenant slug
  const isSubdomainValid = subdomain ? isValidTenantSlug(subdomain) : false;
  const tenantSlug =
    subdomain && isSubdomainValid ? subdomain : 'ortoqbank';

  // DEBUG: Log tenant slug determination
  console.log(`[DEBUG:Proxy] Tenant slug determination - { subdomain: "${subdomain || 'null'}", isSubdomainValid: ${isSubdomainValid}, finalSlug: "${tenantSlug}" }`);

  // Get existing tenant cookie
  const existingTenantCookie = request.cookies.get(TENANT_COOKIE_NAME);

  // DEBUG: Log cookie state
  console.log(`[DEBUG:Proxy] Cookie state - { existingCookie: "${existingTenantCookie?.value || 'null'}", newSlug: "${tenantSlug}", willSetCookie: ${existingTenantCookie?.value !== tenantSlug} }`);

  // DEBUG: Log route type detection
  const routeIsProtected = isProtectedRoute(request);
  const routeIsAdmin = isAdminRoute(request);
  const routeIsWebhook = isWebhookRoute(request);
  console.log(`[DEBUG:Proxy] Route type - { isProtected: ${routeIsProtected}, isAdmin: ${routeIsAdmin}, isWebhook: ${routeIsWebhook} }`);

  // ==========================================================================
  // WEBHOOK ROUTES - Skip authentication
  // ==========================================================================
  if (routeIsWebhook) {
    console.log(`[DEBUG:Proxy] Webhook route - skipping auth`);
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
  // MAINTENANCE MODE - Redirect non-admins to maintenance page
  // ==========================================================================
  const isMaintenanceMode =
    process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true';
  const isMaintenanceRoute = request.nextUrl.pathname === '/maintenance';

  if (isMaintenanceMode && isProtectedRoute(request) && !isMaintenanceRoute) {
    const { sessionClaims } = await auth();
    const isAdmin = sessionClaims?.metadata?.role === 'admin';

    if (!isAdmin) {
      return NextResponse.redirect(new URL('/maintenance', request.url));
    }
  }

  // ==========================================================================
  // PROTECTED ROUTES - Require authentication
  // ==========================================================================
  if (routeIsProtected) {
    console.log(`[DEBUG:Proxy] Protected route - requiring auth`);
    await auth.protect();
    console.log(`[DEBUG:Proxy] Protected route - auth passed`);
  }

  // NOTE: User-App access control is enforced at:
  // 1. Convex backend (authoritative) - via requireAppAccess/requireAppModerator in mutations
  // 2. Frontend (defense in depth) - via SessionProvider + auth.checkCurrentUserAppAccess
  // Middleware cannot directly query Convex (edge runtime limitation), so we rely on
  // the above two layers. If a user accesses an app without permission, they will see
  // an access denied UI and mutations will be blocked.

  // ==========================================================================
  // ADMIN ROUTES - Require authentication + defense-in-depth role check
  // ==========================================================================
  if (routeIsAdmin) {
    console.log(`[DEBUG:Proxy] Admin route - requiring auth`);
    await auth.protect();

    const { sessionClaims } = await auth();
    const hasClerkAdminRole = sessionClaims?.metadata?.role === 'admin';

    console.log(`[DEBUG:Proxy] Admin route - { hasClerkAdminRole: ${hasClerkAdminRole} }`);

    // NOTE: Middleware cannot query Convex to check per-tenant moderator roles
    // (edge runtime limitation). Authorization is enforced in two layers:
    //   1. Frontend: Admin layout checks useAppRole().isEditor and redirects non-editors
    //   2. Backend (authoritative): All admin mutations use requireAppModerator/requireSuperAdmin
    // Clerk metadata only tracks super admins, not per-tenant moderators, so we
    // cannot fully enforce editor access here. Authentication is sufficient at this layer.
    if (!hasClerkAdminRole) {
      console.log(
        '[DEBUG:Proxy] Admin route accessed without Clerk admin role - frontend layout and backend will verify editor access',
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

    console.log(`[DEBUG:Proxy] Setting new tenant cookie - { cookieName: "${TENANT_COOKIE_NAME}", value: "${tenantSlug}", options: ${JSON.stringify(cookieOptions)} }`);
  }

  console.log(`[DEBUG:Proxy] Request complete - { pathname: "${pathname}", tenantSlug: "${tenantSlug}" }`);
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
