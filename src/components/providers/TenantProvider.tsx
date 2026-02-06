'use client';

import { useQuery } from 'convex/react';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  DEFAULT_TENANT_SLUG,
  getTenantConfig,
  TENANT_COOKIE_NAME,
  type TenantConfig,
} from '@/lib/tenant';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';

/**
 * Parse a cookie value from document.cookie string
 */
function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift();
  }
  return undefined;
}

/**
 * Validate slug format using regex
 * Allows lowercase alphanumeric with hyphens, 1-50 chars, no leading/trailing hyphens
 */
function isValidSlugFormat(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/.test(slug.toLowerCase());
}

/**
 * Dynamic tenant data from Convex database
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
 * Simplified tenant context - only provides tenant identification and branding
 * Access control is handled separately in protected routes/Convex functions
 */
interface TenantContextValue {
  /** Current tenant slug */
  slug: string;
  /** Tenant ID from database (null if not found) */
  tenantId: Id<'apps'> | null;
  /** Static configuration from tenants.config.ts */
  config: TenantConfig;
  /** Dynamic data from Convex (null if loading or not found) */
  data: TenantData | null;
  /** Whether the tenant data is still loading */
  isLoading: boolean;
  /** Whether the tenant was found in the database */
  isValid: boolean;
  /** Error message if tenant not found or inactive */
  error: string | null;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

interface TenantProviderProps {
  children: ReactNode;
  /** Optional initial slug from server-side */
  initialSlug?: string;
}

/**
 * TenantProvider - Provides tenant context to the application.
 *
 * Purpose:
 * 1. Detect tenant slug from domain (via cookie set by proxy.ts)
 * 2. Query Convex to get tenantId from slug
 * 3. Provide tenantId and slug to React context
 *
 * The tenant slug is read from:
 * 1. initialSlug prop (from server)
 * 2. Cookie set by proxy.ts middleware
 * 3. Falls back to default tenant
 *
 * Note: Access control is NOT handled here. Use protected routes or
 * Convex functions with access checks for authorization.
 */
export function TenantProvider({ children, initialSlug }: TenantProviderProps) {
  // Read tenant slug from cookie or use initial/default
  const [slug] = useState<string>(() => {
    // Priority: initialSlug prop > cookie > default
    if (initialSlug && isValidSlugFormat(initialSlug)) {
      return initialSlug;
    }

    // Read from cookie on client side
    const cookieSlug = getCookie(TENANT_COOKIE_NAME);
    if (cookieSlug && isValidSlugFormat(cookieSlug)) {
      return cookieSlug;
    }

    return DEFAULT_TENANT_SLUG;
  });

  // Get static config
  const config = useMemo(() => getTenantConfig(slug), [slug]);

  // Query dynamic data from Convex
  const appData = useQuery(api.apps.getAppBySlug, { slug });

  // Build context value
  const contextValue = useMemo<TenantContextValue>(() => {
    const isLoading = appData === undefined;
    const isValid = appData !== null && appData !== undefined;

    const data: TenantData | null = appData
      ? {
          _id: appData._id,
          slug: appData.slug,
          name: appData.name,
          domain: appData.domain,
          description: appData.description,
          logoUrl: appData.logoUrl,
          isActive: appData.isActive,
        }
      : null;

    // Determine error state
    let error: string | null = null;
    if (!isLoading && appData === null) {
      error = `Tenant "${slug}" not found`;
    } else if (appData && !appData.isActive) {
      error = 'This application is currently inactive';
    }

    return {
      slug,
      tenantId: appData?._id ?? null,
      config,
      data,
      isLoading,
      isValid,
      error,
    };
  }, [slug, config, appData]);

  // Apply CSS variables for tenant branding (sidebar only for now)
  useEffect(() => {
    const root = document.documentElement;

    if (config.branding.sidebarBackground) {
      root.style.setProperty(
        '--sidebar-background',
        config.branding.sidebarBackground,
      );
    }
    if (config.branding.sidebarForeground) {
      root.style.setProperty(
        '--sidebar-foreground',
        config.branding.sidebarForeground,
      );
    }

    // Cleanup on unmount
    return () => {
      root.style.removeProperty('--sidebar-background');
      root.style.removeProperty('--sidebar-foreground');
    };
  }, [config.branding]);

  return (
    <TenantContext.Provider value={contextValue}>
      {children}
    </TenantContext.Provider>
  );
}

/**
 * Hook to access tenant context.
 * Must be used within a TenantProvider.
 */
export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

/**
 * Hook to get just the tenant ID (for passing to Convex queries).
 * Returns null if tenant is not loaded yet.
 */
export function useTenantId(): Id<'apps'> | null {
  const { tenantId } = useTenant();
  return tenantId;
}

/**
 * Hook to get tenant branding configuration.
 */
export function useTenantBranding() {
  const { config } = useTenant();
  return config.branding;
}

/**
 * Hook to get tenant content/copy configuration.
 */
export function useTenantContent() {
  const { config } = useTenant();
  return config.content;
}
