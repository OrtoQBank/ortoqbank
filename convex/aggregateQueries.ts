// ============================================================================
// ⚠️  MIGRATION STATUS: PARTIALLY MIGRATED TO userStatsCounts TABLE
// ============================================================================
// User statistics functions have been replaced by userStats.ts functions.
// Quiz generation functions still use old aggregates (marked as DEPRECATED).
// TODO: Update quiz generation to use userStatsCounts table.
// ============================================================================

import { v } from 'convex/values';

import { api } from './_generated/api';
import { Id } from './_generated/dataModel';
import {
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from './_generated/server';
import {
  questionCountByGroup,
  questionCountBySubtheme,
  questionCountByTheme,
  randomQuestions,
  randomQuestionsByGroup,
  randomQuestionsBySubtheme,
  randomQuestionsByTheme,
  totalQuestionCount,
} from './aggregates';
import { getCurrentUserOrThrow } from './users';
import { getWeekString } from './utils';

/**
 * UNIFIED AGGREGATE-BASED COUNTING SYSTEM
 *
 * This file consolidates all counting operations into a single, efficient aggregate-based system.
 * Previously split across countFunctions.ts and aggregateQueries.ts with mixed approaches.
 *
 * ARCHITECTURE:
 * 1. TOTAL QUESTION COUNT:
 *    - totalQuestionCount.count() → O(log n) global aggregate lookup
 *
 * 2. THEME/SUBTHEME/GROUP QUESTION COUNT:
 *    - questionCountByTheme/Subtheme/Group.count() → O(log n) aggregate lookup
 *    - Fallback to index scans for reliability
 *
 * 3. USER STATS (answered, incorrect, bookmarks):
 *    - answeredByUser/incorrectByUser/bookmarkedByUser.count() → O(log n) aggregate lookup
 *    - Pure aggregate approach, no fallbacks for maximum performance
 *
 * 4. HIGH-LEVEL QUERY FUNCTIONS:
 *    - getQuestionCountByFilter: Single filter-based counting
 *    - getAllQuestionCounts: Batch counting for UI efficiency
 *
 * PERFORMANCE BENEFITS:
 * - All counting operations are O(log n) instead of O(n) table scans
 * - User stats use per-user namespaces for isolated performance
 * - Question counts use theme/subtheme/group namespaces for efficient lookups
 *
 * CONVEX AGGREGATE BEST PRACTICES:
 * ✅ NAMESPACES: Each aggregate uses appropriate namespacing (user, theme, global)
 * ✅ BOUNDS: Efficient bounds usage to minimize dependency footprint
 * ✅ ATOMICITY: All aggregate operations are atomic
 * ✅ PERFORMANCE: Consistent O(log n) performance across all operations
 *
 * REPAIR FUNCTIONS:
 * - Comprehensive repair functions for all aggregates
 * - Production-safe paginated repairs for large datasets
 * - Individual and batch repair options
 */

// Query function to get total question count using aggregate - MOST EFFICIENT
export const getTotalQuestionCountQuery = query({
  args: {},
  returns: v.number(),
  handler: async ctx => {
    // Use the totalQuestionCount aggregate for O(log n) counting
    // This is the most efficient way to count all questions
    const count = await totalQuestionCount.count(ctx, {
      namespace: 'global',
      bounds: {} as any,
    });
    return count;
  },
});

// Query function to get theme question count using proven aggregate
export const getThemeQuestionCountQuery = query({
  args: {
    themeId: v.id('themes'),
    bounds: v.optional(
      v.object({
        lower: v.optional(
          v.object({
            key: v.any(),
            inclusive: v.boolean(),
          }),
        ),
        upper: v.optional(
          v.object({
            key: v.any(),
            inclusive: v.boolean(),
          }),
        ),
      }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    // Use the working aggregate pattern from questions.ts
    try {
      const count = await questionCountByTheme.count(ctx, {
        namespace: args.themeId,
        bounds: (args.bounds || {}) as any,
      });
      return count;
    } catch (error) {
      console.warn(`Aggregate failed for theme ${args.themeId}:`, error);
      // Fallback to efficient index-based query
      const questions = await ctx.db
        .query('questions')
        .withIndex('by_theme', q => q.eq('themeId', args.themeId))
        .collect();
      return questions.length;
    }
  },
});

// Query function to get subtheme question count using aggregate
export const getSubthemeQuestionCountQuery = query({
  args: {
    subthemeId: v.id('subthemes'),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    try {
      const count = await questionCountBySubtheme.count(ctx, {
        namespace: args.subthemeId,
        bounds: {} as any,
      });
      return count;
    } catch (error) {
      console.warn(`Aggregate failed for subtheme ${args.subthemeId}:`, error);
      // Fallback to efficient index-based query
      const questions = await ctx.db
        .query('questions')
        .withIndex('by_subtheme', q => q.eq('subthemeId', args.subthemeId))
        .collect();
      return questions.length;
    }
  },
});

// Query function to get group question count using aggregate
export const getGroupQuestionCountQuery = query({
  args: {
    groupId: v.id('groups'),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    try {
      const count = await questionCountByGroup.count(ctx, {
        namespace: args.groupId,
        bounds: {} as any,
      });
      return count;
    } catch (error) {
      console.warn(`Aggregate failed for group ${args.groupId}:`, error);
      // Fallback to efficient index-based query
      const questions = await ctx.db
        .query('questions')
        .withIndex('by_group', q => q.eq('groupId', args.groupId))
        .collect();
      return questions.length;
    }
  },
});

// USER-SPECIFIC AGGREGATE QUERY FUNCTIONS REMOVED
// These query functions are no longer needed as user-specific aggregates have been
// replaced by the userStatsCounts table for better performance:
// - getUserAnsweredCountQuery
// - getUserIncorrectCountQuery
// - getUserBookmarksCountQuery

// ============================================================================
// HIERARCHICAL USER-SPECIFIC COUNT QUERIES - REMOVED
// ============================================================================

// All hierarchical user-specific count query functions have been removed.
// These functions are no longer needed as user-specific aggregates have been
// replaced by the userStatsCounts table for better performance:
// - getUserIncorrectCountByThemeQuery, getUserIncorrectCountBySubthemeQuery, getUserIncorrectCountByGroupQuery
// - getUserBookmarksCountByThemeQuery, getUserBookmarksCountBySubthemeQuery, getUserBookmarksCountByGroupQuery
// - getUserAnsweredCountByThemeQuery, getUserAnsweredCountBySubthemeQuery, getUserAnsweredCountByGroupQuery

// Helper functions that call these queries
export async function getTotalQuestionCount(ctx: QueryCtx): Promise<number> {
  return await ctx.runQuery(api.aggregateQueries.getTotalQuestionCountQuery);
}

export async function getThemeQuestionCount(
  ctx: QueryCtx,
  themeId: Id<'themes'>,
): Promise<number> {
  return await ctx.runQuery(api.aggregateQueries.getThemeQuestionCountQuery, {
    themeId,
  });
}

export async function getSubthemeQuestionCount(
  ctx: QueryCtx,
  subthemeId: Id<'subthemes'>,
): Promise<number> {
  return await ctx.runQuery(
    api.aggregateQueries.getSubthemeQuestionCountQuery,
    {
      subthemeId,
    },
  );
}

export async function getGroupQuestionCount(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
): Promise<number> {
  return await ctx.runQuery(api.aggregateQueries.getGroupQuestionCountQuery, {
    groupId,
  });
}

// ============================================================================
// USER-SPECIFIC COUNT FUNCTIONS - UPDATED TO USE userStatsCounts TABLE
// ============================================================================

/**
 * Get user answered count using userStatsCounts table (replaces getUserAnsweredCount)
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

/**
 * Get user incorrect count using userStatsCounts table (replaces getUserIncorrectCount)
 */
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

/**
 * Get user bookmarks count using userStatsCounts table (replaces getUserBookmarksCount)
 */
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

/**
 * Get user answered count by theme using userStatsCounts table
 */
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

/**
 * Get user incorrect count by theme using userStatsCounts table
 */
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

/**
 * Get user bookmarks count by theme using userStatsCounts table
 */
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

/**
 * Get user answered count by subtheme using userStatsCounts table
 */
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

/**
 * Get user incorrect count by subtheme using userStatsCounts table
 */
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

/**
 * Get user bookmarks count by subtheme using userStatsCounts table
 */
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

/**
 * Get user answered count by group using userStatsCounts table
 */
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

/**
 * Get user incorrect count by group using userStatsCounts table
 */
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

/**
 * Get user bookmarks count by group using userStatsCounts table
 */
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

/**
 * Count questions based on filter type only (no taxonomy selection yet)
 * This function efficiently counts questions using aggregates where possible
 */
export const getQuestionCountByFilter = query({
  args: {
    filter: v.union(
      v.literal('all'),
      v.literal('unanswered'),
      v.literal('incorrect'),
      v.literal('bookmarked'),
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);
    return await getCountForFilterType(ctx, args.filter, userId._id);
  },
});

/**
 * Count questions with hierarchical selections (themes/subthemes/groups)
 * This provides a smart total that avoids double-counting overlapping hierarchies
 * OPTIMIZED: Uses new hierarchical user-specific aggregates when beneficial
 */
export const getQuestionCountBySelection = query({
  args: {
    filter: v.union(
      v.literal('all'),
      v.literal('unanswered'),
      v.literal('incorrect'),
      v.literal('bookmarked'),
    ),
    selectedThemes: v.optional(v.array(v.id('themes'))),
    selectedSubthemes: v.optional(v.array(v.id('subthemes'))),
    selectedGroups: v.optional(v.array(v.id('groups'))),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);

    const selectedThemes = args.selectedThemes || [];
    const selectedSubthemes = args.selectedSubthemes || [];
    const selectedGroups = args.selectedGroups || [];

    // If no selections, return total count for filter type
    if (
      selectedThemes.length === 0 &&
      selectedSubthemes.length === 0 &&
      selectedGroups.length === 0
    ) {
      return await getCountForFilterType(ctx, args.filter, userId._id);
    }

    // OPTIMIZATION: For user-specific filters with single selections, use hierarchical aggregates
    if (args.filter !== 'all' && args.filter !== 'unanswered') {
      // Single group selection - use most specific aggregate
      if (
        selectedGroups.length === 1 &&
        selectedThemes.length === 0 &&
        selectedSubthemes.length === 0
      ) {
        const groupId = selectedGroups[0];
        const namespace = `${userId._id}_${groupId}`;

        try {
          if (args.filter === 'incorrect') {
            return await getUserIncorrectCountByGroup(ctx, userId._id, groupId);
          } else if (args.filter === 'bookmarked') {
            return await getUserBookmarksCountByGroup(ctx, userId._id, groupId);
          }
        } catch (error) {
          console.warn(
            `Hierarchical aggregate failed for group ${groupId}:`,
            error,
          );
          // Fall through to legacy approach
        }
      }

      // Single subtheme selection - use subtheme aggregate
      if (
        selectedSubthemes.length === 1 &&
        selectedThemes.length === 0 &&
        selectedGroups.length === 0
      ) {
        const subthemeId = selectedSubthemes[0];
        const namespace = `${userId._id}_${subthemeId}`;

        try {
          if (args.filter === 'incorrect') {
            return await getUserIncorrectCountBySubtheme(
              ctx,
              userId._id,
              subthemeId,
            );
          } else if (args.filter === 'bookmarked') {
            return await getUserBookmarksCountBySubtheme(
              ctx,
              userId._id,
              subthemeId,
            );
          }
        } catch (error) {
          console.warn(
            `Hierarchical aggregate failed for subtheme ${subthemeId}:`,
            error,
          );
          // Fall through to legacy approach
        }
      }

      // Single theme selection - use theme aggregate
      if (
        selectedThemes.length === 1 &&
        selectedSubthemes.length === 0 &&
        selectedGroups.length === 0
      ) {
        const themeId = selectedThemes[0];
        const namespace = `${userId._id}_${themeId}`;

        try {
          if (args.filter === 'incorrect') {
            return await getUserIncorrectCountByTheme(ctx, userId._id, themeId);
          } else if (args.filter === 'bookmarked') {
            return await getUserBookmarksCountByTheme(ctx, userId._id, themeId);
          }
        } catch (error) {
          console.warn(
            `Hierarchical aggregate failed for theme ${themeId}:`,
            error,
          );
          // Fall through to legacy approach
        }
      }
    }

    // FALLBACK: Use legacy approach for complex selections or when aggregates fail
    // Get all questions that match the hierarchical selections
    let questionIds = new Set<Id<'questions'>>();

    // Add questions from selected groups (most specific)
    for (const groupId of selectedGroups) {
      const questions = await ctx.db
        .query('questions')
        .withIndex('by_group', q => q.eq('groupId', groupId))
        .collect();
      questions.forEach(q => questionIds.add(q._id));
    }

    // Add questions from selected subthemes (if no groups from that subtheme are selected)
    for (const subthemeId of selectedSubthemes) {
      // Check if any groups from this subtheme are already selected
      const subthemeGroups = await ctx.db
        .query('groups')
        .withIndex('by_subtheme', q => q.eq('subthemeId', subthemeId))
        .collect();

      const hasSelectedGroupsFromSubtheme = subthemeGroups.some(g =>
        selectedGroups.includes(g._id),
      );

      if (!hasSelectedGroupsFromSubtheme) {
        const questions = await ctx.db
          .query('questions')
          .withIndex('by_subtheme', q => q.eq('subthemeId', subthemeId))
          .collect();
        questions.forEach(q => questionIds.add(q._id));
      }
    }

    // Add questions from selected themes (if no subthemes from that theme are selected)
    for (const themeId of selectedThemes) {
      // Check if any subthemes from this theme are already selected
      const themeSubthemes = await ctx.db
        .query('subthemes')
        .withIndex('by_theme', q => q.eq('themeId', themeId))
        .collect();

      const hasSelectedSubthemesFromTheme = themeSubthemes.some(s =>
        selectedSubthemes.includes(s._id),
      );

      if (!hasSelectedSubthemesFromTheme) {
        const questions = await ctx.db
          .query('questions')
          .withIndex('by_theme', q => q.eq('themeId', themeId))
          .collect();
        questions.forEach(q => questionIds.add(q._id));
      }
    }

    // Convert to array for filtering
    const allQuestions = [...questionIds];

    // Apply question mode filter
    if (args.filter === 'all') {
      return allQuestions.length;
    }

    // For user-specific filters, we need to check user stats
    if (args.filter === 'unanswered') {
      const userStats = await ctx.db
        .query('userQuestionStats')
        .withIndex('by_user', q => q.eq('userId', userId._id))
        .collect();

      const answeredQuestionIds = new Set(
        userStats.map(stat => stat.questionId),
      );
      return allQuestions.filter(qId => !answeredQuestionIds.has(qId)).length;
    }

    if (args.filter === 'incorrect') {
      const incorrectStats = await ctx.db
        .query('userQuestionStats')
        .withIndex('by_user_incorrect', q =>
          q.eq('userId', userId._id).eq('isIncorrect', true),
        )
        .collect();

      const incorrectQuestionIds = new Set(
        incorrectStats.map(stat => stat.questionId),
      );
      return allQuestions.filter(qId => incorrectQuestionIds.has(qId)).length;
    }

    if (args.filter === 'bookmarked') {
      const bookmarks = await ctx.db
        .query('userBookmarks')
        .withIndex('by_user', q => q.eq('userId', userId._id))
        .collect();

      const bookmarkedQuestionIds = new Set(
        bookmarks.map(bookmark => bookmark.questionId),
      );
      return allQuestions.filter(qId => bookmarkedQuestionIds.has(qId)).length;
    }

    return 0;
  },
});

/**
 * Get count for a specific filter type (all/unanswered/incorrect/bookmarked)
 */
async function getCountForFilterType(
  ctx: QueryCtx,
  filter: 'all' | 'unanswered' | 'incorrect' | 'bookmarked',
  userId: Id<'users'>,
): Promise<number> {
  switch (filter) {
    case 'all': {
      return await getTotalQuestionCount(ctx);
    }

    case 'unanswered': {
      // Total questions minus answered questions
      const totalQuestions = await getTotalQuestionCount(ctx);
      const answeredCount = await getUserAnsweredCount(ctx, userId);
      return Math.max(0, totalQuestions - answeredCount);
    }

    case 'incorrect': {
      return await getUserIncorrectCount(ctx, userId);
    }

    case 'bookmarked': {
      return await getUserBookmarksCount(ctx, userId);
    }

    default: {
      return 0;
    }
  }
}

/**
 * Get question counts for all filter types at once (for efficiency)
 * This can be used to populate all counters in the UI with a single query
 */
export const getAllQuestionCounts = query({
  args: {},
  returns: v.object({
    all: v.number(),
    unanswered: v.number(),
    incorrect: v.number(),
    bookmarked: v.number(),
  }),
  handler: async ctx => {
    const userId = await getCurrentUserOrThrow(ctx);

    // Get all counts efficiently with parallel queries using aggregates
    const [all, answered, incorrect, bookmarked] = await Promise.all([
      getTotalQuestionCount(ctx),
      getUserAnsweredCount(ctx, userId._id),
      getUserIncorrectCount(ctx, userId._id),
      getUserBookmarksCount(ctx, userId._id),
    ]);

    return {
      all,
      unanswered: Math.max(0, all - answered),
      incorrect,
      bookmarked,
    };
  },
});

// Random question selection functions using aggregates for efficient randomization

/**
 * Get random questions from the global pool
 */
export const getRandomQuestions = query({
  args: {
    count: v.number(),
    seed: v.optional(v.string()),
  },
  returns: v.array(v.id('questions')),
  handler: async (ctx, args) => {
    const totalCount = await (randomQuestions.count as any)(ctx, {
      namespace: 'global',
      bounds: {},
    });

    if (totalCount === 0) return [];

    const questionIds: Id<'questions'>[] = [];
    const maxAttempts = Math.min(args.count * 3, totalCount); // Avoid infinite loops
    const usedIndices = new Set<number>();

    // Generate random indices and fetch questions
    for (let i = 0; i < args.count && usedIndices.size < maxAttempts; i++) {
      let randomIndex: number;
      do {
        randomIndex = Math.floor(Math.random() * totalCount);
      } while (usedIndices.has(randomIndex));

      usedIndices.add(randomIndex);

      try {
        const randomQuestion = await (randomQuestions.at as any)(
          ctx,
          randomIndex,
        );
        if (randomQuestion?.id) {
          questionIds.push(randomQuestion.id);
        }
      } catch (error) {
        console.warn(
          `Failed to get random question at index ${randomIndex}:`,
          error,
        );
      }
    }

    return questionIds;
  },
});

/**
 * Get random questions from a specific theme
 */
export const getRandomQuestionsByTheme = query({
  args: {
    themeId: v.id('themes'),
    count: v.number(),
  },
  returns: v.array(v.id('questions')),
  handler: async (ctx, args) => {
    const totalCount = await (randomQuestionsByTheme.count as any)(ctx, {
      namespace: args.themeId,
      bounds: {},
    });

    if (totalCount === 0) return [];

    const questionIds: Id<'questions'>[] = [];
    const maxAttempts = Math.min(args.count * 3, totalCount);
    const usedIndices = new Set<number>();

    for (let i = 0; i < args.count && usedIndices.size < maxAttempts; i++) {
      let randomIndex: number;
      do {
        randomIndex = Math.floor(Math.random() * totalCount);
      } while (usedIndices.has(randomIndex));

      usedIndices.add(randomIndex);

      try {
        const randomQuestion = await (randomQuestionsByTheme.at as any)(ctx, {
          namespace: args.themeId,
          index: randomIndex,
        });
        if (randomQuestion?.id) {
          questionIds.push(randomQuestion.id);
        }
      } catch (error) {
        console.warn(
          `Failed to get random question at index ${randomIndex} for theme ${args.themeId}:`,
          error,
        );
      }
    }

    return questionIds;
  },
});

/**
 * Get random questions from a specific subtheme
 */
export const getRandomQuestionsBySubtheme = query({
  args: {
    subthemeId: v.id('subthemes'),
    count: v.number(),
  },
  returns: v.array(v.id('questions')),
  handler: async (ctx, args) => {
    const totalCount = await (randomQuestionsBySubtheme.count as any)(ctx, {
      namespace: args.subthemeId,
      bounds: {},
    });

    if (totalCount === 0) return [];

    const questionIds: Id<'questions'>[] = [];
    const maxAttempts = Math.min(args.count * 3, totalCount);
    const usedIndices = new Set<number>();

    for (let i = 0; i < args.count && usedIndices.size < maxAttempts; i++) {
      let randomIndex: number;
      do {
        randomIndex = Math.floor(Math.random() * totalCount);
      } while (usedIndices.has(randomIndex));

      usedIndices.add(randomIndex);

      try {
        const randomQuestion = await (randomQuestionsBySubtheme.at as any)(
          ctx,
          {
            namespace: args.subthemeId,
            index: randomIndex,
          },
        );
        if (randomQuestion?.id) {
          questionIds.push(randomQuestion.id);
        }
      } catch (error) {
        console.warn(
          `Failed to get random question at index ${randomIndex} for subtheme ${args.subthemeId}:`,
          error,
        );
      }
    }

    return questionIds;
  },
});

/**
 * Get random questions from a specific group
 */
export const getRandomQuestionsByGroup = query({
  args: {
    groupId: v.id('groups'),
    count: v.number(),
  },
  returns: v.array(v.id('questions')),
  handler: async (ctx, args) => {
    const totalCount = await (randomQuestionsByGroup.count as any)(ctx, {
      namespace: args.groupId,
      bounds: {},
    });

    if (totalCount === 0) return [];

    const questionIds: Id<'questions'>[] = [];
    const maxAttempts = Math.min(args.count * 3, totalCount);
    const usedIndices = new Set<number>();

    for (let i = 0; i < args.count && usedIndices.size < maxAttempts; i++) {
      let randomIndex: number;
      do {
        randomIndex = Math.floor(Math.random() * totalCount);
      } while (usedIndices.has(randomIndex));

      usedIndices.add(randomIndex);

      try {
        const randomQuestion = await (randomQuestionsByGroup.at as any)(ctx, {
          namespace: args.groupId,
          index: randomIndex,
        });
        if (randomQuestion?.id) {
          questionIds.push(randomQuestion.id);
        }
      } catch (error) {
        console.warn(
          `Failed to get random question at index ${randomIndex} for group ${args.groupId}:`,
          error,
        );
      }
    }

    return questionIds;
  },
});

/**
 * OPTIMIZED: Get random questions using hierarchical aggregates for direct user-specific selection
 * This avoids expensive .collect() calls by using pre-computed hierarchical aggregates
 */
export const getRandomQuestionsByUserModeOptimized = query({
  args: {
    userId: v.id('users'),
    mode: v.union(
      v.literal('incorrect'),
      v.literal('bookmarked'),
      v.literal('unanswered'),
    ),
    count: v.number(),
    themeId: v.optional(v.id('themes')),
    subthemeId: v.optional(v.id('subthemes')),
    groupId: v.optional(v.id('groups')),
  },
  returns: v.array(v.id('questions')),
  handler: async (ctx, args) => {
    // For incorrect and bookmarked modes, use hierarchical aggregates for O(log n) performance
    if (args.mode === 'incorrect' || args.mode === 'bookmarked') {
      return await getRandomFromHierarchicalAggregates(ctx, args as any);
    }

    // For unanswered, use the optimized fallback approach
    return await getRandomUnansweredQuestions(ctx, args);
  },
});

/**
 * Get random questions from user-specific sets (incorrect/bookmarked) with hierarchical filtering
 * Updated to use userStatsCounts table and direct database queries instead of aggregates
 */
async function getRandomFromHierarchicalAggregates(
  ctx: QueryCtx,
  args: {
    userId: Id<'users'>;
    mode: 'incorrect' | 'bookmarked';
    count: number;
    themeId?: Id<'themes'>;
    subthemeId?: Id<'subthemes'>;
    groupId?: Id<'groups'>;
  },
): Promise<Id<'questions'>[]> {
  let questionIds: Id<'questions'>[] = [];

  if (args.mode === 'incorrect') {
    // Get incorrectly answered questions for this user with hierarchical filtering
    const query = ctx.db
      .query('userQuestionStats')
      .withIndex('by_user', q => q.eq('userId', args.userId));

    const allStats = await query.collect();

    // Filter to only incorrect stats
    const incorrectStats = allStats.filter(stat => stat.isIncorrect);

    // Filter by hierarchy if specified
    if (args.groupId || args.subthemeId || args.themeId) {
      const filteredStats: typeof incorrectStats = [];

      for (const stat of incorrectStats) {
        const question = await ctx.db.get(stat.questionId);
        if (!question) continue;

        // Check hierarchy match
        if (args.groupId && question.groupId !== args.groupId) continue;
        if (args.subthemeId && question.subthemeId !== args.subthemeId)
          continue;
        if (args.themeId && question.themeId !== args.themeId) continue;

        filteredStats.push(stat);
      }

      questionIds = filteredStats.map(stat => stat.questionId);
    } else {
      questionIds = incorrectStats.map(stat => stat.questionId);
    }
  } else if (args.mode === 'bookmarked') {
    // Get bookmarked questions for this user with hierarchical filtering
    const query = ctx.db
      .query('userBookmarks')
      .withIndex('by_user', q => q.eq('userId', args.userId));

    const bookmarks = await query.collect();

    // Filter by hierarchy if specified
    if (args.groupId || args.subthemeId || args.themeId) {
      const filteredBookmarks: typeof bookmarks = [];

      for (const bookmark of bookmarks) {
        const question = await ctx.db.get(bookmark.questionId);
        if (!question) continue;

        // Check hierarchy match
        if (args.groupId && question.groupId !== args.groupId) continue;
        if (args.subthemeId && question.subthemeId !== args.subthemeId)
          continue;
        if (args.themeId && question.themeId !== args.themeId) continue;

        filteredBookmarks.push(bookmark);
      }

      questionIds = filteredBookmarks.map(bookmark => bookmark.questionId);
    } else {
      questionIds = bookmarks.map(bookmark => bookmark.questionId);
    }
  }

  if (questionIds.length === 0) {
    return [];
  }

  // Shuffle and return the requested count
  const shuffled = questionIds.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(args.count, shuffled.length));
}

/**
 * Optimized unanswered questions using pagination instead of .collect()
 */
/**
 * Get random unanswered questions with hierarchical filtering
 * Updated to use userQuestionStats table directly instead of aggregates
 */
async function getRandomUnansweredQuestions(
  ctx: QueryCtx,
  args: {
    userId: Id<'users'>;
    count: number;
    themeId?: Id<'themes'>;
    subthemeId?: Id<'subthemes'>;
    groupId?: Id<'groups'>;
  },
): Promise<Id<'questions'>[]> {
  // Get all answered questions for this user
  const allStats = await ctx.db
    .query('userQuestionStats')
    .withIndex('by_user', q => q.eq('userId', args.userId))
    .collect();

  // Filter to only answered stats
  const answeredStats = allStats.filter(stat => stat.hasAnswered);

  const answeredQuestionIds = new Set(
    answeredStats.map(stat => stat.questionId),
  );

  // Get all questions in the specified scope
  let allQuestions: any[] = [];

  if (args.groupId) {
    allQuestions = await ctx.db
      .query('questions')
      .withIndex('by_group', q => q.eq('groupId', args.groupId!))
      .collect();
  } else if (args.subthemeId) {
    allQuestions = await ctx.db
      .query('questions')
      .withIndex('by_subtheme', q => q.eq('subthemeId', args.subthemeId!))
      .collect();
  } else if (args.themeId) {
    allQuestions = await ctx.db
      .query('questions')
      .withIndex('by_theme', q => q.eq('themeId', args.themeId!))
      .collect();
  } else {
    // Get all questions
    allQuestions = await ctx.db.query('questions').collect();
  }

  // Filter out answered questions
  const unansweredQuestions = allQuestions.filter(
    question => !answeredQuestionIds.has(question._id),
  );

  if (unansweredQuestions.length === 0) {
    return [];
  }

  // Shuffle and return the requested count
  const shuffled = unansweredQuestions.sort(() => Math.random() - 0.5);
  return shuffled
    .slice(0, Math.min(args.count, shuffled.length))
    .map(q => q._id);
}

/**
 * BATCH OPTIMIZED: Get random questions from multiple hierarchical selections in parallel
 * This is much faster than calling getRandomQuestionsByUserModeOptimized multiple times
 */
export const getRandomQuestionsByUserModeBatch = query({
  args: {
    userId: v.id('users'),
    mode: v.union(
      v.literal('incorrect'),
      v.literal('bookmarked'),
      v.literal('unanswered'),
    ),
    totalCount: v.number(),
    selections: v.array(
      v.object({
        type: v.union(
          v.literal('theme'),
          v.literal('subtheme'),
          v.literal('group'),
        ),
        id: v.string(), // Will be cast to appropriate ID type
        weight: v.optional(v.number()), // For proportional distribution
      }),
    ),
  },
  returns: v.array(v.id('questions')),
  handler: async (ctx, args) => {
    if (args.selections.length === 0) {
      return [];
    }

    // Calculate questions per selection based on weights or equal distribution
    const totalWeight = args.selections.reduce(
      (sum, sel) => sum + (sel.weight || 1),
      0,
    );
    const distributedCounts = args.selections.map(sel => ({
      ...sel,
      count: Math.ceil((args.totalCount * (sel.weight || 1)) / totalWeight),
    }));

    // Execute all queries in parallel for maximum performance
    const results = await Promise.all(
      distributedCounts.map(async sel => {
        const queryArgs = {
          userId: args.userId,
          mode: args.mode,
          count: sel.count,
          ...(sel.type === 'theme' ? { themeId: sel.id as Id<'themes'> } : {}),
          ...(sel.type === 'subtheme'
            ? { subthemeId: sel.id as Id<'subthemes'> }
            : {}),
          ...(sel.type === 'group' ? { groupId: sel.id as Id<'groups'> } : {}),
        };

        try {
          return await getRandomFromHierarchicalAggregates(
            ctx,
            queryArgs as any,
          );
        } catch (error) {
          console.warn(
            `Failed to get questions for ${sel.type} ${sel.id}:`,
            error,
          );
          return [];
        }
      }),
    );

    // Combine all results and remove duplicates
    const allQuestionIds = results.flat();
    const uniqueQuestionIds = [...new Set(allQuestionIds)];

    // Return up to the requested total count
    return uniqueQuestionIds.slice(0, args.totalCount);
  },
});

/**
 * LEGACY: Get random questions filtered by user mode (incorrect, bookmarked, unanswered)
 * This combines aggregate-based random selection with user filtering
 * @deprecated Use getRandomQuestionsByUserModeOptimized instead
 */
export const getRandomQuestionsByUserMode = query({
  args: {
    userId: v.id('users'),
    mode: v.union(
      v.literal('incorrect'),
      v.literal('bookmarked'),
      v.literal('unanswered'),
    ),
    count: v.number(),
    themeId: v.optional(v.id('themes')),
    subthemeId: v.optional(v.id('subthemes')),
    groupId: v.optional(v.id('groups')),
  },
  returns: v.array(v.id('questions')),
  handler: async (ctx, args) => {
    const questionIds: Id<'questions'>[] = [];
    const maxAttempts = args.count * 10; // Try more to account for filtering
    let attempts = 0;

    // Get user filter data based on mode
    let userQuestionIds: Set<Id<'questions'>>;

    switch (args.mode) {
      case 'incorrect': {
        const incorrectStats = await ctx.db
          .query('userQuestionStats')
          .withIndex('by_user_incorrect', q =>
            q.eq('userId', args.userId).eq('isIncorrect', true),
          )
          .collect();
        userQuestionIds = new Set(incorrectStats.map(s => s.questionId));
        break;
      }
      case 'bookmarked': {
        const bookmarks = await ctx.db
          .query('userBookmarks')
          .withIndex('by_user', q => q.eq('userId', args.userId))
          .collect();
        userQuestionIds = new Set(bookmarks.map(b => b.questionId));
        break;
      }
      case 'unanswered': {
        const answeredStats = await ctx.db
          .query('userQuestionStats')
          .withIndex('by_user', q => q.eq('userId', args.userId))
          .collect();
        const answeredIds = new Set(answeredStats.map(s => s.questionId));

        // For unanswered, we'll use a different strategy - get random from aggregate then filter
        let totalCount: number;
        let randomQuestionGetter: (index: number) => Promise<any>;

        if (args.groupId) {
          totalCount = await (randomQuestionsByGroup.count as any)(ctx, {
            namespace: args.groupId,
            bounds: {},
          });
          randomQuestionGetter = index =>
            (randomQuestionsByGroup.at as any)(ctx, {
              namespace: args.groupId,
              index,
            });
        } else if (args.subthemeId) {
          totalCount = await (randomQuestionsBySubtheme.count as any)(ctx, {
            namespace: args.subthemeId,
            bounds: {},
          });
          randomQuestionGetter = index =>
            (randomQuestionsBySubtheme.at as any)(ctx, {
              namespace: args.subthemeId,
              index,
            });
        } else if (args.themeId) {
          totalCount = await (randomQuestionsByTheme.count as any)(ctx, {
            namespace: args.themeId,
            bounds: {},
          });
          randomQuestionGetter = index =>
            (randomQuestionsByTheme.at as any)(ctx, {
              namespace: args.themeId,
              index,
            });
        } else {
          totalCount = await (randomQuestions.count as any)(ctx, {
            namespace: 'global',
            bounds: {},
          });
          randomQuestionGetter = index =>
            (randomQuestions.at as any)(ctx, index);
        }

        const usedIndices = new Set<number>();

        // Get random unanswered questions
        while (questionIds.length < args.count && attempts < maxAttempts) {
          let randomIndex: number;
          do {
            randomIndex = Math.floor(Math.random() * totalCount);
          } while (usedIndices.has(randomIndex));

          usedIndices.add(randomIndex);
          attempts++;

          try {
            const randomQuestion = await randomQuestionGetter(randomIndex);
            if (randomQuestion?.id && !answeredIds.has(randomQuestion.id)) {
              questionIds.push(randomQuestion.id);
            }
          } catch (error) {
            console.warn(
              `Failed to get random question at index ${randomIndex}:`,
              error,
            );
          }
        }

        return questionIds;
      }
    }

    // For incorrect and bookmarked modes: get random questions then filter
    if (userQuestionIds.size === 0) {
      return [];
    }

    // Strategy: Use appropriate aggregate then filter by user data
    let totalCount: number;
    let randomQuestionGetter: (index: number) => Promise<any>;

    if (args.groupId) {
      totalCount = await (randomQuestionsByGroup.count as any)(ctx, {
        namespace: args.groupId,
        bounds: {},
      });
      randomQuestionGetter = index =>
        (randomQuestionsByGroup.at as any)(ctx, {
          namespace: args.groupId,
          index,
        });
    } else if (args.subthemeId) {
      totalCount = await (randomQuestionsBySubtheme.count as any)(ctx, {
        namespace: args.subthemeId,
        bounds: {},
      });
      randomQuestionGetter = index =>
        (randomQuestionsBySubtheme.at as any)(ctx, {
          namespace: args.subthemeId,
          index,
        });
    } else if (args.themeId) {
      totalCount = await (randomQuestionsByTheme.count as any)(ctx, {
        namespace: args.themeId,
        bounds: {},
      });
      randomQuestionGetter = index =>
        (randomQuestionsByTheme.at as any)(ctx, {
          namespace: args.themeId,
          index,
        });
    } else {
      totalCount = await (randomQuestions.count as any)(ctx, {
        namespace: 'global',
        bounds: {},
      });
      randomQuestionGetter = index => (randomQuestions.at as any)(ctx, index);
    }

    const usedIndices = new Set<number>();

    // Get random questions that match user criteria
    while (questionIds.length < args.count && attempts < maxAttempts) {
      let randomIndex: number;
      do {
        randomIndex = Math.floor(Math.random() * totalCount);
      } while (usedIndices.has(randomIndex));

      usedIndices.add(randomIndex);
      attempts++;

      try {
        const randomQuestion = await randomQuestionGetter(randomIndex);
        if (randomQuestion?.id && userQuestionIds.has(randomQuestion.id)) {
          questionIds.push(randomQuestion.id);
        }
      } catch (error) {
        console.warn(
          `Failed to get random question at index ${randomIndex}:`,
          error,
        );
      }
    }

    return questionIds;
  },
});

/**
 * ============================================================================
 * OPTIMIZED HIERARCHICAL USER-SPECIFIC QUERIES
 * ============================================================================
 */

/**
 * Get efficient question counts for multiple hierarchical selections
 * This function batches hierarchical aggregate queries for maximum performance
 */
export const getBatchQuestionCountsBySelection = query({
  args: {
    filter: v.union(
      v.literal('all'),
      v.literal('unanswered'),
      v.literal('incorrect'),
      v.literal('bookmarked'),
    ),
    selections: v.array(
      v.object({
        type: v.union(
          v.literal('theme'),
          v.literal('subtheme'),
          v.literal('group'),
        ),
        id: v.string(), // Will be cast to appropriate ID type
      }),
    ),
  },
  returns: v.object({
    totalCount: v.number(),
    individualCounts: v.array(
      v.object({
        type: v.string(),
        id: v.string(),
        count: v.number(),
      }),
    ),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    totalCount: number;
    individualCounts: Array<{
      type: string;
      id: string;
      count: number;
    }>;
  }> => {
    const userId = await getCurrentUserOrThrow(ctx);

    if (args.filter === 'all' || args.filter === 'unanswered') {
      // Fall back to legacy approach for 'all' and 'unanswered' modes
      // as they don't benefit from user-specific hierarchical aggregates
      const totalCount: number = await ctx.runQuery(
        api.aggregateQueries.getQuestionCountBySelection,
        {
          filter: args.filter,
          selectedThemes: args.selections
            .filter(s => s.type === 'theme')
            .map(s => s.id as Id<'themes'>),
          selectedSubthemes: args.selections
            .filter(s => s.type === 'subtheme')
            .map(s => s.id as Id<'subthemes'>),
          selectedGroups: args.selections
            .filter(s => s.type === 'group')
            .map(s => s.id as Id<'groups'>),
        },
      );

      return {
        totalCount,
        individualCounts: [], // Not computed for efficiency
      };
    }

    // For user-specific modes, use hierarchical aggregates
    const individualCounts = await Promise.all(
      args.selections.map(async selection => {
        const namespace = `${userId._id}_${selection.id}`;

        try {
          let count = 0;

          if (args.filter === 'incorrect') {
            switch (selection.type) {
              case 'theme': {
                count = await getUserIncorrectCountByTheme(
                  ctx,
                  userId._id,
                  selection.id as Id<'themes'>,
                );
                break;
              }
              case 'subtheme': {
                count = await getUserIncorrectCountBySubtheme(
                  ctx,
                  userId._id,
                  selection.id as Id<'subthemes'>,
                );
                break;
              }
              case 'group': {
                count = await getUserIncorrectCountByGroup(
                  ctx,
                  userId._id,
                  selection.id as Id<'groups'>,
                );
                break;
              }
              // No default
            }
          } else if (args.filter === 'bookmarked') {
            switch (selection.type) {
              case 'theme': {
                count = await getUserBookmarksCountByTheme(
                  ctx,
                  userId._id,
                  selection.id as Id<'themes'>,
                );
                break;
              }
              case 'subtheme': {
                count = await getUserBookmarksCountBySubtheme(
                  ctx,
                  userId._id,
                  selection.id as Id<'subthemes'>,
                );
                break;
              }
              case 'group': {
                count = await getUserBookmarksCountByGroup(
                  ctx,
                  userId._id,
                  selection.id as Id<'groups'>,
                );
                break;
              }
              // No default
            }
          }

          return {
            type: selection.type,
            id: selection.id,
            count,
          };
        } catch (error) {
          console.warn(
            `Hierarchical aggregate failed for ${selection.type} ${selection.id}:`,
            error,
          );
          return {
            type: selection.type,
            id: selection.id,
            count: 0,
          };
        }
      }),
    );

    // Calculate total (avoiding double-counting by using the optimized single query)
    const totalCount: number = await ctx.runQuery(
      api.aggregateQueries.getQuestionCountBySelection,
      {
        filter: args.filter,
        selectedThemes: args.selections
          .filter(s => s.type === 'theme')
          .map(s => s.id as Id<'themes'>),
        selectedSubthemes: args.selections
          .filter(s => s.type === 'subtheme')
          .map(s => s.id as Id<'subthemes'>),
        selectedGroups: args.selections
          .filter(s => s.type === 'group')
          .map(s => s.id as Id<'groups'>),
      },
    );

    return {
      totalCount,
      individualCounts,
    };
  },
});

/**
 * ============================================================================
 * AGGREGATE REPAIR FUNCTIONS - MOVED TO aggregateWorkflows.ts
 * ============================================================================
 *
 * All repair operations are now consolidated in aggregateWorkflows.ts
 *
 * RECOMMENDED APPROACH (Production-Safe):
 * - api.aggregateWorkflows.startComprehensiveRepair()
 *   → Workflow-based repair for large datasets with full progress tracking
 *
 * EMERGENCY REPAIRS (Quick fixes):
 * - api.aggregateWorkflows.emergencyRepairQuestionCount()
 *   → Fast question count repair with pagination
 * - api.aggregateWorkflows.emergencyRepairUserStats(userId)
 *   → Fast user stats repair for specific user
 *
 * LEGACY WORKFLOW OPTIONS (Still available):
 * - api.aggregateWorkflows.startAggregateRepair()
 * - api.aggregateWorkflows.startUserAggregatesRepair()
 *
 * All repair functions now use:
 * ✅ Production-safe pagination (100-item batches)
 * ✅ Comprehensive progress logging
 * ✅ Memory-efficient processing
 * ✅ Automatic verification steps
 */

/**
 * Get user theme statistics using aggregates for efficient chart data
 */
// getUserThemeStatsWithAggregates function removed
// This function is no longer needed as it's been replaced by the more efficient
// getUserStatsFast function in userStats.ts that uses the userStatsCounts table

// getUserWeeklyProgressWithAggregates function removed
// This function is no longer needed as it's been replaced by the more efficient
// getUserWeeklyProgress function in userStats.ts that uses the userStatsCounts table
