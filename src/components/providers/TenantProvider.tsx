'use client';

import { useQuery } from 'convex/react';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import {
  DEFAULT_TENANT_SLUG,
  getTenantConfig,
  TENANT_COOKIE_NAME,
  type TenantConfig,
  type TenantSlug,
} from '@/lib/tenant';

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
 * User's access status for the current app
 */
interface UserAppAccessStatus {
  /** Whether the user has access to this app */
  hasAccess: boolean;
  /** Whether the user is a moderator for this app */
  isModerator: boolean;
  /** Whether the user is a super admin (global) */
  isSuperAdmin: boolean;
  /** When access expires (if applicable) */
  expiresAt?: number;
  /** Whether access data is still loading */
  isLoading: boolean;
}

/**
 * Full tenant context combining static config and dynamic data
 */
interface TenantContextValue {
  /** Current tenant slug */
  slug: TenantSlug;
  /** Tenant ID from database (null if not found) */
  tenantId: Id<'apps'> | null;
  /** Static configuration from tenants.config.ts */
  config: TenantConfig;
  /** Dynamic data from Convex (null if loading or not found) */
  data: TenantData | null;
  /** Whether the tenant data is still loading */
  isLoading: boolean;
  /** Whether using the default tenant (no subdomain detected) */
  isDefault: boolean;
  /** Whether the tenant was found in the database */
  isValid: boolean;
  /** User's access status for this app */
  access: UserAppAccessStatus;
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
 * Combines:
 * - Static configuration from tenants.config.ts (branding, content)
 * - Dynamic data from Convex apps table (isActive, tenantId)
 *
 * The tenant slug is read from:
 * 1. initialSlug prop (from server)
 * 2. Cookie set by proxy.ts middleware
 * 3. Falls back to default tenant
 */
export function TenantProvider({ children, initialSlug }: TenantProviderProps) {
  // Read tenant slug from cookie or use initial/default
  const [slug, setSlug] = useState<TenantSlug>(() => {
    if (initialSlug && isValidSlug(initialSlug)) {
      return initialSlug as TenantSlug;
    }
    // Will be updated on client side from cookie
    return DEFAULT_TENANT_SLUG;
  });

  // Read cookie on client side
  useEffect(() => {
    const cookieSlug = getCookie(TENANT_COOKIE_NAME);
    if (cookieSlug && isValidSlug(cookieSlug) && cookieSlug !== slug) {
      setSlug(cookieSlug as TenantSlug);
    }
  }, [slug]);

  // Get static config
  const config = useMemo(() => getTenantConfig(slug), [slug]);

  // Query dynamic data from Convex
  const appData = useQuery(api.apps.getAppBySlug, { slug });

  // Query user's access to this app (only if we have the app ID)
  const userAccess = useQuery(
    api.userAppAccess.checkMyAccess,
    appData?._id ? { appId: appData._id } : 'skip',
  );

  // Build context value
  const contextValue = useMemo<TenantContextValue>(() => {
    const isLoading = appData === undefined;
    const data = appData
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

    // Build access status
    const access: UserAppAccessStatus = {
      hasAccess: userAccess?.hasAccess ?? false,
      isModerator: userAccess?.role === 'moderator' || userAccess?.isSuperAdmin === true,
      isSuperAdmin: userAccess?.isSuperAdmin ?? false,
      expiresAt: userAccess?.expiresAt,
      isLoading: appData !== undefined && userAccess === undefined,
    };

    return {
      slug,
      tenantId: appData?._id ?? null,
      config,
      data,
      isLoading,
      isDefault: slug === DEFAULT_TENANT_SLUG,
      isValid: appData !== null && appData !== undefined,
      access,
    };
  }, [slug, config, appData, userAccess]);

  // Apply CSS variables for tenant branding
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--tenant-primary', config.branding.primaryColor);
    if (config.branding.secondaryColor) {
      root.style.setProperty(
        '--tenant-secondary',
        config.branding.secondaryColor,
      );
    }
    if (config.branding.accentColor) {
      root.style.setProperty('--tenant-accent', config.branding.accentColor);
    }
    // Sidebar colors
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

/**
 * Hook to get user's access status for the current tenant.
 */
export function useTenantAccess(): UserAppAccessStatus {
  const { access } = useTenant();
  return access;
}

/**
 * Hook to check if user has moderator access to the current tenant.
 * Returns true for app moderators and super admins.
 */
export function useIsTenantModerator(): boolean {
  const { access } = useTenant();
  return access.isModerator || access.isSuperAdmin;
}

/**
 * Hook to check if user has access to the current tenant.
 */
export function useHasTenantAccess(): boolean {
  const { access } = useTenant();
  return access.hasAccess;
}

// Helper to check if a string is a valid tenant slug
function isValidSlug(slug: string): boolean {
  // Import would cause circular dependency, so check against known slugs
  const validSlugs = ['ortoqbank', 'app1', 'teot'];
  return validSlugs.includes(slug);
}

