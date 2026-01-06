import { Id } from './_generated/dataModel';
import { type QueryCtx } from './_generated/server';

/**
 * User-specific count helpers backed by the `userStatsCounts` table.
 * These are lightweight utilities intended to be reused by queries/mutations.
 */

export async function getUserAnsweredCount(
  ctx: QueryCtx,
  userId: Id<'users'>,
): Promise<number> {
  const userCounts = await ctx.db
    .query('userStatsCounts')
    .withIndex('by_user', q => q.eq('userId', userId))
    .first();
  return userCounts?.totalAnswered || 0;
}

export async function getUserIncorrectCount(
  ctx: QueryCtx,
  userId: Id<'users'>,
): Promise<number> {
  const userCounts = await ctx.db
    .query('userStatsCounts')
    .withIndex('by_user', q => q.eq('userId', userId))
    .first();
  return userCounts?.totalIncorrect || 0;
}

export async function getUserBookmarksCount(
  ctx: QueryCtx,
  userId: Id<'users'>,
): Promise<number> {
  const userCounts = await ctx.db
    .query('userStatsCounts')
    .withIndex('by_user', q => q.eq('userId', userId))
    .first();
  return userCounts?.totalBookmarked || 0;
}

export async function getUserAnsweredCountByTheme(
  ctx: QueryCtx,
  userId: Id<'users'>,
  themeId: Id<'themes'>,
): Promise<number> {
  const userCounts = await ctx.db
    .query('userStatsCounts')
    .withIndex('by_user', q => q.eq('userId', userId))
    .first();
  return userCounts?.answeredByTheme[themeId] || 0;
}

export async function getUserIncorrectCountByTheme(
  ctx: QueryCtx,
  userId: Id<'users'>,
  themeId: Id<'themes'>,
): Promise<number> {
  const userCounts = await ctx.db
    .query('userStatsCounts')
    .withIndex('by_user', q => q.eq('userId', userId))
    .first();
  return userCounts?.incorrectByTheme[themeId] || 0;
}

export async function getUserBookmarksCountByTheme(
  ctx: QueryCtx,
  userId: Id<'users'>,
  themeId: Id<'themes'>,
): Promise<number> {
  const userCounts = await ctx.db
    .query('userStatsCounts')
    .withIndex('by_user', q => q.eq('userId', userId))
    .first();
  return userCounts?.bookmarkedByTheme[themeId] || 0;
}

export async function getUserAnsweredCountBySubtheme(
  ctx: QueryCtx,
  userId: Id<'users'>,
  subthemeId: Id<'subthemes'>,
): Promise<number> {
  const userCounts = await ctx.db
    .query('userStatsCounts')
    .withIndex('by_user', q => q.eq('userId', userId))
    .first();
  return userCounts?.answeredBySubtheme[subthemeId] || 0;
}

export async function getUserIncorrectCountBySubtheme(
  ctx: QueryCtx,
  userId: Id<'users'>,
  subthemeId: Id<'subthemes'>,
): Promise<number> {
  const userCounts = await ctx.db
    .query('userStatsCounts')
    .withIndex('by_user', q => q.eq('userId', userId))
    .first();
  return userCounts?.incorrectBySubtheme[subthemeId] || 0;
}

export async function getUserBookmarksCountBySubtheme(
  ctx: QueryCtx,
  userId: Id<'users'>,
  subthemeId: Id<'subthemes'>,
): Promise<number> {
  const userCounts = await ctx.db
    .query('userStatsCounts')
    .withIndex('by_user', q => q.eq('userId', userId))
    .first();
  return userCounts?.bookmarkedBySubtheme[subthemeId] || 0;
}

export async function getUserAnsweredCountByGroup(
  ctx: QueryCtx,
  userId: Id<'users'>,
  groupId: Id<'groups'>,
): Promise<number> {
  const userCounts = await ctx.db
    .query('userStatsCounts')
    .withIndex('by_user', q => q.eq('userId', userId))
    .first();
  return userCounts?.answeredByGroup[groupId] || 0;
}

export async function getUserIncorrectCountByGroup(
  ctx: QueryCtx,
  userId: Id<'users'>,
  groupId: Id<'groups'>,
): Promise<number> {
  const userCounts = await ctx.db
    .query('userStatsCounts')
    .withIndex('by_user', q => q.eq('userId', userId))
    .first();
  return userCounts?.incorrectByGroup[groupId] || 0;
}

export async function getUserBookmarksCountByGroup(
  ctx: QueryCtx,
  userId: Id<'users'>,
  groupId: Id<'groups'>,
): Promise<number> {
  const userCounts = await ctx.db
    .query('userStatsCounts')
    .withIndex('by_user', q => q.eq('userId', userId))
    .first();
  return userCounts?.bookmarkedByGroup[groupId] || 0;
}
