import { Id } from './_generated/dataModel';
import { type QueryCtx } from './_generated/server';

/**
 * User-specific count helpers backed by the `userStatsCounts` table.
 * These are lightweight utilities intended to be reused by queries/mutations.
 *
 * MULTI-TENANT: All functions require tenantId to ensure proper data isolation.
 * User stats are stored per (userId, tenantId) pair.
 */

/**
 * Get user stats counts for a specific tenant.
 * This is the core helper that all other functions use.
 */
async function getUserStatsCounts(
  ctx: QueryCtx,
  userId: Id<'users'>,
  tenantId: Id<'apps'>,
) {
  return await ctx.db
    .query('userStatsCounts')
    .withIndex('by_tenant_and_user', q =>
      q.eq('tenantId', tenantId).eq('userId', userId),
    )
    .first();
}

// =============================================================================
// GLOBAL COUNTS (within tenant)
// =============================================================================

export async function getUserAnsweredCount(
  ctx: QueryCtx,
  userId: Id<'users'>,
  tenantId: Id<'apps'>,
): Promise<number> {
  const userCounts = await getUserStatsCounts(ctx, userId, tenantId);
  return userCounts?.totalAnswered || 0;
}

export async function getUserIncorrectCount(
  ctx: QueryCtx,
  userId: Id<'users'>,
  tenantId: Id<'apps'>,
): Promise<number> {
  const userCounts = await getUserStatsCounts(ctx, userId, tenantId);
  return userCounts?.totalIncorrect || 0;
}

export async function getUserBookmarksCount(
  ctx: QueryCtx,
  userId: Id<'users'>,
  tenantId: Id<'apps'>,
): Promise<number> {
  const userCounts = await getUserStatsCounts(ctx, userId, tenantId);
  return userCounts?.totalBookmarked || 0;
}

// =============================================================================
// BY THEME COUNTS
// =============================================================================

export async function getUserAnsweredCountByTheme(
  ctx: QueryCtx,
  userId: Id<'users'>,
  tenantId: Id<'apps'>,
  themeId: Id<'themes'>,
): Promise<number> {
  const userCounts = await getUserStatsCounts(ctx, userId, tenantId);
  return userCounts?.answeredByTheme[themeId] || 0;
}

export async function getUserIncorrectCountByTheme(
  ctx: QueryCtx,
  userId: Id<'users'>,
  tenantId: Id<'apps'>,
  themeId: Id<'themes'>,
): Promise<number> {
  const userCounts = await getUserStatsCounts(ctx, userId, tenantId);
  return userCounts?.incorrectByTheme[themeId] || 0;
}

export async function getUserBookmarksCountByTheme(
  ctx: QueryCtx,
  userId: Id<'users'>,
  tenantId: Id<'apps'>,
  themeId: Id<'themes'>,
): Promise<number> {
  const userCounts = await getUserStatsCounts(ctx, userId, tenantId);
  return userCounts?.bookmarkedByTheme[themeId] || 0;
}

// =============================================================================
// BY SUBTHEME COUNTS
// =============================================================================

export async function getUserAnsweredCountBySubtheme(
  ctx: QueryCtx,
  userId: Id<'users'>,
  tenantId: Id<'apps'>,
  subthemeId: Id<'subthemes'>,
): Promise<number> {
  const userCounts = await getUserStatsCounts(ctx, userId, tenantId);
  return userCounts?.answeredBySubtheme[subthemeId] || 0;
}

export async function getUserIncorrectCountBySubtheme(
  ctx: QueryCtx,
  userId: Id<'users'>,
  tenantId: Id<'apps'>,
  subthemeId: Id<'subthemes'>,
): Promise<number> {
  const userCounts = await getUserStatsCounts(ctx, userId, tenantId);
  return userCounts?.incorrectBySubtheme[subthemeId] || 0;
}

export async function getUserBookmarksCountBySubtheme(
  ctx: QueryCtx,
  userId: Id<'users'>,
  tenantId: Id<'apps'>,
  subthemeId: Id<'subthemes'>,
): Promise<number> {
  const userCounts = await getUserStatsCounts(ctx, userId, tenantId);
  return userCounts?.bookmarkedBySubtheme[subthemeId] || 0;
}

// =============================================================================
// BY GROUP COUNTS
// =============================================================================

export async function getUserAnsweredCountByGroup(
  ctx: QueryCtx,
  userId: Id<'users'>,
  tenantId: Id<'apps'>,
  groupId: Id<'groups'>,
): Promise<number> {
  const userCounts = await getUserStatsCounts(ctx, userId, tenantId);
  return userCounts?.answeredByGroup[groupId] || 0;
}

export async function getUserIncorrectCountByGroup(
  ctx: QueryCtx,
  userId: Id<'users'>,
  tenantId: Id<'apps'>,
  groupId: Id<'groups'>,
): Promise<number> {
  const userCounts = await getUserStatsCounts(ctx, userId, tenantId);
  return userCounts?.incorrectByGroup[groupId] || 0;
}

export async function getUserBookmarksCountByGroup(
  ctx: QueryCtx,
  userId: Id<'users'>,
  tenantId: Id<'apps'>,
  groupId: Id<'groups'>,
): Promise<number> {
  const userCounts = await getUserStatsCounts(ctx, userId, tenantId);
  return userCounts?.bookmarkedByGroup[groupId] || 0;
}

// =============================================================================
// BULK OPERATIONS
// =============================================================================

/**
 * Transform counts into structured format
 */
const transformCounts = <T extends string>(
  answered: Record<T, number>,
  incorrect: Record<T, number>,
  bookmarked: Record<T, number>,
): Record<T, { answered: number; incorrect: number; bookmarked: number }> => {
  const result = {} as Record<
    T,
    { answered: number; incorrect: number; bookmarked: number }
  >;
  const allKeys = new Set([
    ...Object.keys(answered),
    ...Object.keys(incorrect),
    ...Object.keys(bookmarked),
  ]) as Set<T>;

  for (const key of allKeys) {
    result[key] = {
      answered: answered[key] || 0,
      incorrect: incorrect[key] || 0,
      bookmarked: bookmarked[key] || 0,
    };
  }
  return result;
};

/**
 * Get all user counts in a single query - most efficient for UI
 */
export async function getAllUserCounts(
  ctx: QueryCtx,
  userId: Id<'users'>,
  tenantId: Id<'apps'>,
) {
  const userCounts = await getUserStatsCounts(ctx, userId, tenantId);

  if (!userCounts) {
    return {
      global: {
        totalAnswered: 0,
        totalIncorrect: 0,
        totalBookmarked: 0,
      },
      byTheme: {} as Record<
        Id<'themes'>,
        { answered: number; incorrect: number; bookmarked: number }
      >,
      bySubtheme: {} as Record<
        Id<'subthemes'>,
        { answered: number; incorrect: number; bookmarked: number }
      >,
      byGroup: {} as Record<
        Id<'groups'>,
        { answered: number; incorrect: number; bookmarked: number }
      >,
    };
  }

  return {
    global: {
      totalAnswered: userCounts.totalAnswered,
      totalIncorrect: userCounts.totalIncorrect,
      totalBookmarked: userCounts.totalBookmarked,
    },
    byTheme: transformCounts(
      userCounts.answeredByTheme,
      userCounts.incorrectByTheme,
      userCounts.bookmarkedByTheme,
    ),
    bySubtheme: transformCounts(
      userCounts.answeredBySubtheme,
      userCounts.incorrectBySubtheme,
      userCounts.bookmarkedBySubtheme,
    ),
    byGroup: transformCounts(
      userCounts.answeredByGroup,
      userCounts.incorrectByGroup,
      userCounts.bookmarkedByGroup,
    ),
  };
}
