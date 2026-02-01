/**
 * Tenant/Multi-tenancy utility functions.
 *
 * This module provides utilities for:
 * - Extracting subdomain from hostname
 * - Detecting localhost development subdomains
 * - Managing tenant cookies
 * - Getting tenant configuration
 */

import {
  DEFAULT_TENANT_SLUG,
  getTenantConfig,
  isValidTenantSlug,
  type TenantConfig,
  type TenantSlug,
} from '@/config/tenants.config';

/** Cookie name for storing the current tenant slug */
export const TENANT_COOKIE_NAME = 'x-tenant-slug';

/** Cookie max age in seconds (1 year) */
export const TENANT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Resolve tenant slug from hostname.
 * Handles both Vercel preview (--) and production (.) formats.
 *
 * Hostname formats:
 * - Local development: "app1.localhost:3000" -> "app1"
 * - Vercel preview: "app1--project-git-branch.vercel.app" -> "app1"
 * - Production: "app1.domain.com" -> "app1"
 *
 * Environment detection:
 * - Uses VERCEL_ENV to detect preview vs production
 * - Falls back to NODE_ENV for local development
 *
 * @param host - The full hostname (e.g., "app1--project.vercel.app")
 * @returns The tenant slug or null if none detected
 */
export function resolveTenant(host: string): string | null {
  const hostWithoutPort = host.split(':')[0];

  // Check environment
  const isPreviewOrDev =
    process.env.VERCEL_ENV === 'preview' ||
    process.env.VERCEL_ENV === 'development' ||
    process.env.NODE_ENV === 'development';

  // Handle localhost subdomains (e.g., "app1.localhost")
  if (hostWithoutPort.endsWith('.localhost')) {
    return hostWithoutPort.replace('.localhost', '') || null;
  }

  // Preview: app1--project(-git-branch).vercel.app
  // The -- separator is used by Vercel for preview deployments
  if (isPreviewOrDev && hostWithoutPort.includes('--')) {
    return hostWithoutPort.split('--')[0];
  }

  // Production: app1.domain.com (3+ parts)
  const parts = hostWithoutPort.split('.');
  if (parts.length >= 3) {
    const subdomain = parts[0];

    // Skip common non-tenant subdomains
    if (subdomain === 'www' || subdomain === 'api') {
      return null;
    }

    return subdomain;
  }

  return null;
}

/**
 * Extract the subdomain from a hostname.
 * This is an alias for resolveTenant() for backward compatibility.
 *
 * @param hostname - The full hostname (e.g., "app1.localhost:3000")
 * @returns The subdomain or null if none detected
 * @deprecated Use resolveTenant() directly for new code
 */
export function extractSubdomain(hostname: string): string | null {
  return resolveTenant(hostname);
}

/**
 * Check if the hostname is a localhost subdomain.
 *
 * @param hostname - The full hostname
 * @returns True if it's a *.localhost subdomain
 */
export function isLocalhostSubdomain(hostname: string): boolean {
  const hostWithoutPort = hostname.split(':')[0];
  return hostWithoutPort.endsWith('.localhost');
}

/**
 * Check if the hostname is plain localhost (no subdomain).
 *
 * @param hostname - The full hostname
 * @returns True if it's just "localhost" or "localhost:port"
 */
export function isPlainLocalhost(hostname: string): boolean {
  const hostWithoutPort = hostname.split(':')[0];
  return hostWithoutPort === 'localhost';
}

/**
 * Get the tenant slug from a hostname.
 * Falls back to default tenant if no valid subdomain is found.
 *
 * @param hostname - The full hostname
 * @returns The tenant slug
 */
export function getTenantSlugFromHostname(hostname: string): TenantSlug {
  const subdomain = extractSubdomain(hostname);

  if (subdomain && isValidTenantSlug(subdomain)) {
    return subdomain;
  }

  return DEFAULT_TENANT_SLUG;
}

/**
 * Get full tenant context from hostname.
 * Includes both the slug and the static configuration.
 *
 * @param hostname - The full hostname
 * @returns Object with slug and config
 */
export function getTenantFromHostname(hostname: string): {
  slug: TenantSlug;
  config: TenantConfig;
  isDefault: boolean;
} {
  const subdomain = extractSubdomain(hostname);
  const isValidSlug = subdomain && isValidTenantSlug(subdomain);
  const slug = isValidSlug ? subdomain : DEFAULT_TENANT_SLUG;

  return {
    slug,
    config: getTenantConfig(slug),
    isDefault: !isValidSlug,
  };
}

/**
 * Build the tenant cookie options for setting the cookie.
 */
export function getTenantCookieOptions(): {
  name: string;
  maxAge: number;
  path: string;
  sameSite: 'lax' | 'strict' | 'none';
  secure: boolean;
} {
  return {
    name: TENANT_COOKIE_NAME,
    maxAge: TENANT_COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    // Secure only in production
    secure: process.env.NODE_ENV === 'production',
  };
}

// Re-export types and functions from config for convenience
export {
  DEFAULT_TENANT_SLUG,
  getAllTenantSlugs,
  getTenantConfig,
  isValidTenantSlug,
  type TenantBranding,
  type TenantConfig,
  type TenantContent,
  type TenantSlug
} from '@/config/tenants.config';

// Note: resolveTenant is the primary function for tenant resolution
// extractSubdomain is kept for backward compatibility but marked as deprecated

