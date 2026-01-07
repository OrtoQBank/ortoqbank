/**
 * Static tenant configuration for branding and content.
 *
 * This file contains UI/branding settings that are:
 * - Type-safe with full TypeScript autocomplete
 * - Fast to access (no database query needed)
 * - Version controlled (changes go through PR review)
 *
 * Core tenant data (slug, domain, isActive, access control) lives in the
 * Convex `apps` table for dynamic updates.
 */

export interface TenantBranding {
  /** Display name shown in UI */
  name: string;
  /** Short name for compact spaces */
  shortName?: string;
  /** Primary brand color (hex) */
  primaryColor: string;
  /** Secondary brand color (hex) */
  secondaryColor?: string;
  /** Accent color for highlights (hex) */
  accentColor?: string;
  /** Sidebar background color (HSL values like "208 77% 51%" or hex) */
  sidebarBackground?: string;
  /** Sidebar foreground/text color (HSL values or hex) */
  sidebarForeground?: string;
  /** Logo URL for light backgrounds */
  logo: string;
  /** Logo URL for dark backgrounds */
  logoDark?: string;
  /** Favicon URL */
  favicon?: string;
}

export interface TenantContent {
  /** Tagline shown on landing/marketing pages */
  tagline: string;
  /** Meta description for SEO */
  metaDescription?: string;
  /** Custom labels/copy overrides */
  labels?: {
    /** Label for "themes" in this tenant's context */
    themes?: string;
    /** Label for "subthemes" */
    subthemes?: string;
    /** Label for "groups" */
    groups?: string;
    /** Label for "questions" */
    questions?: string;
    /** Label for "quiz" or "test" */
    quiz?: string;
  };
}

export interface TenantConfig {
  branding: TenantBranding;
  content: TenantContent;
}

/**
 * Configuration for all tenants.
 * Keys must match the `slug` field in the Convex `apps` table.
 */
export const tenantsConfig = {
  // Default tenant - OrtoQBank
  ortoqbank: {
    branding: {
      name: 'OrtoQBank',
      shortName: 'OQB',
      primaryColor: '#2563eb', // Blue
      secondaryColor: '#1e40af',
      accentColor: '#3b82f6',
      logo: '/logos/ortoqbank.svg',
      logoDark: '/logos/ortoqbank-dark.svg',
      favicon: '/favicon.ico',
    },
    content: {
      tagline: 'Banco de questões de ortopedia',
      metaDescription:
        'Prepare-se para o TEOT com o maior banco de questões de ortopedia do Brasil.',
      labels: {
        themes: 'Temas',
        subthemes: 'Subtemas',
        groups: 'Grupos',
        questions: 'Questões',
        quiz: 'Teste',
      },
    },
  },

  // Test tenant for local development
  app1: {
    branding: {
      name: 'App1 Test Tenant',
      shortName: 'APP1',
      primaryColor: '#ff0000',
      secondaryColor: '#059669',
      accentColor: '#34d399',
      sidebarBackground: '0 0% 0%', // Black
      sidebarForeground: '0 0% 100%', // White text
      logo: '/logos/app1.svg',
      logoDark: '/logos/app1-dark.svg',
      favicon: '/favicon.ico',
    },
    content: {
      tagline: 'Test tenant for development',
      metaDescription: 'Test tenant used for local multi-tenancy development.',
      labels: {
        themes: 'Categories',
        subthemes: 'Topics',
        groups: 'Sections',
        questions: 'Items',
        quiz: 'Assessment',
      },
    },
  },

  // TEOT tenant example
  teot: {
    branding: {
      name: 'OrtoQBank TEOT',
      shortName: 'TEOT',
      primaryColor: '#7c3aed', // Violet
      secondaryColor: '#6d28d9',
      accentColor: '#a78bfa',
      logo: '/logos/teot.svg',
      logoDark: '/logos/teot-dark.svg',
      favicon: '/favicon.ico',
    },
    content: {
      tagline: 'Preparação completa para o TEOT',
      metaDescription:
        'Estude para a prova do TEOT com questões comentadas e simulados.',
      labels: {
        themes: 'Especialidades',
        subthemes: 'Áreas',
        groups: 'Tópicos',
        questions: 'Questões',
        quiz: 'Simulado',
      },
    },
  },
} as const satisfies Record<string, TenantConfig>;

/** Type for valid tenant slugs */
export type TenantSlug = keyof typeof tenantsConfig;

/** Default tenant slug when none is detected */
export const DEFAULT_TENANT_SLUG: TenantSlug = 'ortoqbank';

/**
 * Get tenant configuration by slug.
 * Falls back to default tenant if slug is not found.
 */
export function getTenantConfig(slug: string): TenantConfig {
  if (slug in tenantsConfig) {
    return tenantsConfig[slug as TenantSlug];
  }
  return tenantsConfig[DEFAULT_TENANT_SLUG];
}

/**
 * Check if a slug is a valid tenant slug.
 */
export function isValidTenantSlug(slug: string): slug is TenantSlug {
  return slug in tenantsConfig;
}

/**
 * Get all available tenant slugs.
 */
export function getAllTenantSlugs(): TenantSlug[] {
  return Object.keys(tenantsConfig) as TenantSlug[];
}
