/* eslint-disable unicorn/prefer-string-raw */
/* eslint-disable unicorn/no-await-expression-member */
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

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
const isWebhookRoute = createRouteMatcher([
  '/api/mercado-pago/webhook(.*)',
  '/api/webhooks/clerk(.*)', // ✅ Add this
]);

export default clerkMiddleware(async (auth, request) => {
  // Skip authentication for webhook routes
  if (isWebhookRoute(request)) return NextResponse.next();

  if (isProtectedRoute(request)) await auth.protect();
  if (
    isAdminRoute(request) &&
    (await auth()).sessionClaims?.metadata?.role !== 'admin'
  ) {
    const url = new URL('/', request.url);
    return NextResponse.redirect(url);
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
