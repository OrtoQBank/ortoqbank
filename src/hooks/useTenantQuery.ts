'use client';

import { useMutation, useQuery } from 'convex/react';
import { FunctionReference, FunctionReturnType } from 'convex/server';
import { useCallback, useMemo } from 'react';

import { useTenant } from '@/components/providers/TenantProvider';

import type { Id } from '../../convex/_generated/dataModel';

type QueryArgs = Record<string, unknown> | 'skip';

/**
 * Options for useTenantQuery
 */
interface TenantQueryOptions {
  /**
   * If true, the query will skip if tenantId is not yet available.
   * Default: true
   */
  requireTenant?: boolean;
}

/**
 * Hook that wraps useQuery and auto-injects tenantId from TenantProvider.
 *
 * Usage:
 * ```typescript
 * // Instead of:
 * const themes = useQuery(api.themes.list, {});
 *
 * // Use:
 * const themes = useTenantQuery(api.themes.list, {});
 * ```
 *
 * The hook automatically injects the current tenant's ID into the query args.
 * If tenantId is not yet available (loading), the query is skipped.
 *
 * @param query - The Convex query function reference
 * @param args - Query arguments (or 'skip' to skip the query)
 * @param options - Optional configuration
 * @returns The query result (undefined while loading)
 */
export function useTenantQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  args: QueryArgs,
  options: TenantQueryOptions = {},
): FunctionReturnType<Query> | undefined {
  const { tenantId, isLoading: isTenantLoading } = useTenant();
  const { requireTenant = true } = options;

  // Determine if we should skip the query
  const shouldSkip = useMemo(() => {
    // Always skip if args is 'skip'
    if (args === 'skip') return true;

    // Skip if tenant is required but not yet available
    if (requireTenant && isTenantLoading) return true;
    if (requireTenant && !tenantId) return true;

    return false;
  }, [args, requireTenant, isTenantLoading, tenantId]);

  // Build the final args with tenantId injected
  const finalArgs = useMemo(() => {
    if (shouldSkip || args === 'skip') return 'skip' as const;

    return {
      ...(args as Record<string, unknown>),
      tenantId: tenantId ?? undefined,
    };
  }, [shouldSkip, args, tenantId]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useQuery(query, finalArgs as any);
}

/**
 * Options for useTenantMutation
 */
interface TenantMutationOptions {
  /**
   * If true, the mutation will throw if tenantId is not available.
   * Default: true
   */
  requireTenant?: boolean;
}

/**
 * Hook that wraps useMutation and provides a wrapper to auto-inject tenantId.
 *
 * Usage:
 * ```typescript
 * const createTheme = useTenantMutation(api.themes.create);
 *
 * // When calling, tenantId is automatically injected:
 * await createTheme({ name: 'New Theme' });
 * ```
 *
 * @param mutation - The Convex mutation function reference
 * @param options - Optional configuration
 * @returns A mutation function that auto-injects tenantId
 */
export function useTenantMutation<
  Mutation extends FunctionReference<'mutation'>,
>(mutation: Mutation, options: TenantMutationOptions = {}) {
  const { tenantId } = useTenant();
  const baseMutation = useMutation(mutation);
  const { requireTenant = true } = options;

  const wrappedMutation = useCallback(
    async (
      args: Omit<Parameters<typeof baseMutation>[0], 'tenantId'>,
    ): Promise<FunctionReturnType<Mutation>> => {
      if (requireTenant && !tenantId) {
        throw new Error(
          'Tenant not available. Cannot perform mutation without tenant context.',
        );
      }

      // Inject tenantId into the args
      const argsWithTenant = {
        ...args,
        tenantId: tenantId ?? undefined,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return baseMutation(argsWithTenant as any);
    },
    [baseMutation, tenantId, requireTenant],
  );

  return wrappedMutation;
}

/**
 * Hook to get the current tenant ID for manual use cases.
 *
 * @returns The current tenant ID or null if not available
 */
export function useCurrentTenantId(): Id<'apps'> | null {
  const { tenantId } = useTenant();
  return tenantId;
}

/**
 * Hook to check if tenant context is ready.
 *
 * @returns True if tenant is loaded and available
 */
export function useTenantReady(): boolean {
  const { tenantId, isLoading } = useTenant();
  return !isLoading && tenantId !== null;
}

