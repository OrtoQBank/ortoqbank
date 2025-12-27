/* eslint-disable unicorn/prefer-string-raw */
 
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
  '/api/webhooks/clerk(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  // Skip authentication for webhook routes
  if (isWebhookRoute(request)) return NextResponse.next();

  if (isProtectedRoute(request)) await auth.protect();
  
  // For admin routes, provide redundant protection by checking Clerk metadata
  // Primary role checking still happens at the backend level for security
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
      console.log('Admin route accessed without Clerk admin role - backend will verify');
    }
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
