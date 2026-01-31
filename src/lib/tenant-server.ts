/**
 * Server-side tenant utilities for Next.js Server Components.
 *
 * This module provides utilities for:
 * - Reading tenant from cookies in Server Components
 * - Fetching tenant data from Convex on the server
 *
 * IMPORTANT: This file uses Next.js server-only APIs (cookies).
 * Only import this in Server Components or Route Handlers.
 */

import { fetchQuery } from 'convex/nextjs';
import { cookies } from 'next/headers';

import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import {
  DEFAULT_TENANT_SLUG,
  getTenantConfig,
  isValidTenantSlug,
  TENANT_COOKIE_NAME,
  type TenantConfig,
  type TenantSlug,
} from './tenant';

/**
 * Get the current tenant slug from cookies.
 * This is for use in Server Components.
 *
 * @returns The tenant slug from cookie or default
 */
export async function getServerTenantSlug(): Promise<TenantSlug> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(TENANT_COOKIE_NAME)?.value;

  if (cookieValue && isValidTenantSlug(cookieValue)) {
    return cookieValue;
  }

  return DEFAULT_TENANT_SLUG;
}

/**
 * Get the tenant configuration on the server.
 * Uses cookies to determine the current tenant.
 *
 * @returns The tenant config for the current tenant
 */
export async function getServerTenantConfig(): Promise<TenantConfig> {
  const slug = await getServerTenantSlug();
  return getTenantConfig(slug);
}

/**
 * Tenant data from Convex database
 */
interface TenantData {
  _id: Id<'apps'>;
  slug: string;
  name: string;
  domain: string;
  description?: string;
  logoUrl?: string;
  isActive: boolean;
}

/**
 * Get the full tenant context on the server.
 * Fetches both static config and dynamic data from Convex.
 *
 * @returns Object with slug, config, tenantId, and data
 */
export async function getServerTenantContext(): Promise<{
  slug: TenantSlug;
  config: TenantConfig;
  tenantId: Id<'apps'> | null;
  data: TenantData | null;
  isDefault: boolean;
}> {
  const slug = await getServerTenantSlug();
  const config = getTenantConfig(slug);

  // Fetch the app data from Convex
  let data: TenantData | null = null;
  let tenantId: Id<'apps'> | null = null;

  try {
    const appData = await fetchQuery(api.apps.getAppBySlug, { slug });
    if (appData) {
      data = {
        _id: appData._id,
        slug: appData.slug,
        name: appData.name,
        domain: appData.domain,
        description: appData.description,
        logoUrl: appData.logoUrl,
        isActive: appData.isActive,
      };
      tenantId = appData._id;
    }
  } catch (error) {
    console.error('Failed to fetch tenant data from Convex:', error);
  }

  return {
    slug,
    config,
    tenantId,
    data,
    isDefault: slug === DEFAULT_TENANT_SLUG,
  };
}

/**
 * Get just the tenant ID from the server.
 * Useful for passing to Convex queries that need tenantId.
 *
 * @returns The tenant ID or null if not found
 */
export async function getServerTenantId(): Promise<Id<'apps'> | null> {
  const slug = await getServerTenantSlug();

  try {
    const appData = await fetchQuery(api.apps.getAppBySlug, { slug });
    return appData?._id ?? null;
  } catch (error) {
    console.error('Failed to fetch tenant ID from Convex:', error);
    return null;
  }
}
