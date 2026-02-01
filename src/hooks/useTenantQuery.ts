'use client';

import {
  useAction,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from 'convex/react';
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
    if (args === 'skip') return true;
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

      const argsWithTenant = {
        ...args,
        tenantId: tenantId ?? undefined,
      };

       
      return baseMutation(argsWithTenant as any);
    },
    [baseMutation, tenantId, requireTenant],
  );

  return wrappedMutation;
}

/**
 * Options for useTenantAction
 */
interface TenantActionOptions {
  /**
   * If true, the action will throw if tenantId is not available.
   * Default: true
   */
  requireTenant?: boolean;
}

/**
 * Hook that wraps useAction and provides a wrapper to auto-inject tenantId.
 *
 * Usage:
 * ```typescript
 * const processPayment = useTenantAction(api.payments.process);
 *
 * // When calling, tenantId is automatically injected:
 * await processPayment({ amount: 100, currency: 'BRL' });
 * ```
 *
 * @param action - The Convex action function reference
 * @param options - Optional configuration
 * @returns An action function that auto-injects tenantId
 */
export function useTenantAction<Action extends FunctionReference<'action'>>(
  action: Action,
  options: TenantActionOptions = {},
) {
  const { tenantId } = useTenant();
  const baseAction = useAction(action);
  const { requireTenant = true } = options;

  const wrappedAction = useCallback(
    async (
      args: Omit<Parameters<typeof baseAction>[0], 'tenantId'>,
    ): Promise<FunctionReturnType<Action>> => {
      if (requireTenant && !tenantId) {
        throw new Error(
          'Tenant not available. Cannot perform action without tenant context.',
        );
      }

      const argsWithTenant = {
        ...args,
        tenantId: tenantId ?? undefined,
      };

       
      return baseAction(argsWithTenant as any);
    },
    [baseAction, tenantId, requireTenant],
  );

  return wrappedAction;
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

/**
 * Options for useTenantPaginatedQuery
 */
interface TenantPaginatedQueryOptions {
  /**
   * Initial number of items to load
   */
  initialNumItems: number;
}

/**
 * Hook that wraps usePaginatedQuery and auto-injects tenantId from TenantProvider.
 *
 * **IMPORTANT LIMITATION:**
 * Unlike `useTenantQuery`, this hook CANNOT skip the query when tenant is not ready.
 * Convex's `usePaginatedQuery` doesn't support the "skip" pattern.
 *
 * If your backend query requires `v.id("apps")` (not optional), you MUST ensure
 * the component only renders when tenant is available. Use one of these patterns:
 *
 * **Pattern 1: Guard with useTenantReady()**
 * ```typescript
 * function MyComponent() {
 *   const tenantReady = useTenantReady();
 *   if (!tenantReady) return <Loading />;
 *
 *   // Safe to use - tenant is guaranteed to be available
 *   const { results } = useTenantPaginatedQuery(api.items.list, {}, { initialNumItems: 10 });
 *   return <List items={results} />;
 * }
 * ```
 *
 * **Pattern 2: Conditional rendering from parent**
 * ```typescript
 * function Parent() {
 *   const tenantReady = useTenantReady();
 *   return tenantReady ? <ChildWithPagination /> : <Loading />;
 * }
 * ```
 *
 * @param query - The Convex query function reference
 * @param args - Query arguments (tenantId will be auto-injected)
 * @param options - Pagination options including initialNumItems
 * @returns The paginated query result with results, status, loadMore, and isLoading
 */
export function useTenantPaginatedQuery<
  Query extends FunctionReference<'query'>,
>(
  query: Query,
  args: Record<string, unknown>,
  options: TenantPaginatedQueryOptions,
) {
  const { tenantId, isLoading: isTenantLoading } = useTenant();
  const { initialNumItems } = options;

  // Build the final args with tenantId injected
  // Note: If tenantId is undefined and the query requires it, Convex will throw
  // a validation error. See the JSDoc above for how to handle this properly.
  const finalArgs = useMemo(() => {
    return {
      ...args,
      tenantId: tenantId ?? undefined,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(args), tenantId]);

  // usePaginatedQuery must be called unconditionally (React rules of hooks)
   
  const result = usePaginatedQuery(query, finalArgs as any, {
    initialNumItems,
  });

  return {
    ...result,
    // Consider loading if tenant is still loading OR if first page is loading
    isLoading: isTenantLoading || result.status === 'LoadingFirstPage',
  };
}
