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
  answeredByGroupByUser,
  answeredBySubthemeByUser,
  answeredByThemeByUser,
  answeredByUser,
  bookmarkedByGroupByUser,
  bookmarkedBySubthemeByUser,
  bookmarkedByThemeByUser,
  bookmarkedByUser,
  incorrectByGroupByUser,
  incorrectBySubthemeByUser,
  // Hierarchical user-specific count aggregates
  incorrectByThemeByUser,
  incorrectByUser,
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
      bounds: {},
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
        bounds: args.bounds || {},
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
        bounds: {},
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
        bounds: {},
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

// Query function to get user answer count - using aggregate for O(log n) performance
export const getUserAnsweredCountQuery = query({
  args: {
    userId: v.id('users'),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    // Use answeredByUser aggregate for O(log n) counting
    const count = await answeredByUser.count(ctx, {
      namespace: args.userId,
      bounds: {},
    } as { namespace: Id<'users'>; bounds: {} });
    return count;
  },
});

// Query function to get user incorrect count - using aggregate for O(log n) performance
export const getUserIncorrectCountQuery = query({
  args: {
    userId: v.id('users'),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    // Use incorrectByUser aggregate for O(log n) counting
    const count = await incorrectByUser.count(ctx, {
      namespace: args.userId,
      bounds: {},
    } as { namespace: Id<'users'>; bounds: {} });
    return count;
  },
});

// Query function to get user bookmarks count - using aggregate for O(log n) performance
export const getUserBookmarksCountQuery = query({
  args: {
    userId: v.id('users'),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    // Use bookmarkedByUser aggregate for O(log n) counting
    const count = await bookmarkedByUser.count(ctx, {
      namespace: args.userId,
      bounds: {},
    } as { namespace: Id<'users'>; bounds: {} });
    return count;
  },
});

// ============================================================================
// HIERARCHICAL USER-SPECIFIC COUNT QUERIES (Theme/Subtheme/Group by User)
// ============================================================================

// INCORRECT QUESTIONS BY USER WITHIN THEME/SUBTHEME/GROUP

export const getUserIncorrectCountByThemeQuery = query({
  args: {
    themeId: v.id('themes'),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);
    const namespace = `${userId._id}_${args.themeId}`;
    const count = await (incorrectByThemeByUser.count as any)(ctx, {
      namespace,
      bounds: {},
    });
    return count;
  },
});

export const getUserIncorrectCountBySubthemeQuery = query({
  args: {
    subthemeId: v.id('subthemes'),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);
    const namespace = `${userId._id}_${args.subthemeId}`;
    const count = await (incorrectBySubthemeByUser.count as any)(ctx, {
      namespace,
      bounds: {},
    });
    return count;
  },
});

export const getUserIncorrectCountByGroupQuery = query({
  args: {
    groupId: v.id('groups'),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);
    const namespace = `${userId._id}_${args.groupId}`;
    const count = await (incorrectByGroupByUser.count as any)(ctx, {
      namespace,
      bounds: {},
    });
    return count;
  },
});

// BOOKMARKED QUESTIONS BY USER WITHIN THEME/SUBTHEME/GROUP

export const getUserBookmarksCountByThemeQuery = query({
  args: {
    themeId: v.id('themes'),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);
    const namespace = `${userId._id}_${args.themeId}`;
    const count = await (bookmarkedByThemeByUser.count as any)(ctx, {
      namespace,
      bounds: {},
    });
    return count;
  },
});

export const getUserBookmarksCountBySubthemeQuery = query({
  args: {
    subthemeId: v.id('subthemes'),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);
    const namespace = `${userId._id}_${args.subthemeId}`;
    const count = await (bookmarkedBySubthemeByUser.count as any)(ctx, {
      namespace,
      bounds: {},
    });
    return count;
  },
});

export const getUserBookmarksCountByGroupQuery = query({
  args: {
    groupId: v.id('groups'),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);
    const namespace = `${userId._id}_${args.groupId}`;
    const count = await (bookmarkedByGroupByUser.count as any)(ctx, {
      namespace,
      bounds: {},
    });
    return count;
  },
});

// ANSWERED QUESTIONS BY USER WITHIN THEME/SUBTHEME/GROUP

export const getUserAnsweredCountByThemeQuery = query({
  args: {
    themeId: v.id('themes'),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);
    const namespace = `${userId._id}_${args.themeId}`;
    const count = await (answeredByThemeByUser.count as any)(ctx, {
      namespace,
      bounds: {},
    });
    return count;
  },
});

export const getUserAnsweredCountBySubthemeQuery = query({
  args: {
    subthemeId: v.id('subthemes'),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);
    const namespace = `${userId._id}_${args.subthemeId}`;
    const count = await (answeredBySubthemeByUser.count as any)(ctx, {
      namespace,
      bounds: {},
    });
    return count;
  },
});

export const getUserAnsweredCountByGroupQuery = query({
  args: {
    groupId: v.id('groups'),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);
    const namespace = `${userId._id}_${args.groupId}`;
    const count = await (answeredByGroupByUser.count as any)(ctx, {
      namespace,
      bounds: {},
    });
    return count;
  },
});

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

export async function getUserAnsweredCount(
  ctx: QueryCtx,
  userId: Id<'users'>,
): Promise<number> {
  return await ctx.runQuery(api.aggregateQueries.getUserAnsweredCountQuery, {
    userId,
  });
}

export async function getUserIncorrectCount(
  ctx: QueryCtx,
  userId: Id<'users'>,
): Promise<number> {
  return await ctx.runQuery(api.aggregateQueries.getUserIncorrectCountQuery, {
    userId,
  });
}

export async function getUserBookmarksCount(
  ctx: QueryCtx,
  userId: Id<'users'>,
): Promise<number> {
  return await ctx.runQuery(api.aggregateQueries.getUserBookmarksCountQuery, {
    userId,
  });
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
            return await (incorrectByGroupByUser.count as any)(ctx, {
              namespace,
              bounds: {},
            });
          } else if (args.filter === 'bookmarked') {
            return await (bookmarkedByGroupByUser.count as any)(ctx, {
              namespace,
              bounds: {},
            });
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
            return await (incorrectBySubthemeByUser.count as any)(ctx, {
              namespace,
              bounds: {},
            });
          } else if (args.filter === 'bookmarked') {
            return await (bookmarkedBySubthemeByUser.count as any)(ctx, {
              namespace,
              bounds: {},
            });
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
            return await (incorrectByThemeByUser.count as any)(ctx, {
              namespace,
              bounds: {},
            });
          } else if (args.filter === 'bookmarked') {
            return await (bookmarkedByThemeByUser.count as any)(ctx, {
              namespace,
              bounds: {},
            });
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
 * Get random questions from hierarchical user-specific aggregates (FAST!)
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
  let totalCount: number;
  let randomGetter: (index: number) => Promise<any>;
  let namespace: string;

  // Determine which hierarchical aggregate to use
  if (args.groupId) {
    namespace = `${args.userId}_${args.groupId}`;
    if (args.mode === 'incorrect') {
      totalCount = await (incorrectByGroupByUser.count as any)(ctx, {
        namespace,
        bounds: {},
      });
      randomGetter = (index: number) =>
        (incorrectByGroupByUser.at as any)(ctx, { namespace, index });
    } else {
      totalCount = await (bookmarkedByGroupByUser.count as any)(ctx, {
        namespace,
        bounds: {},
      });
      randomGetter = (index: number) =>
        (bookmarkedByGroupByUser.at as any)(ctx, { namespace, index });
    }
  } else if (args.subthemeId) {
    namespace = `${args.userId}_${args.subthemeId}`;
    if (args.mode === 'incorrect') {
      totalCount = await (incorrectBySubthemeByUser.count as any)(ctx, {
        namespace,
        bounds: {},
      });
      randomGetter = (index: number) =>
        (incorrectBySubthemeByUser.at as any)(ctx, { namespace, index });
    } else {
      totalCount = await (bookmarkedBySubthemeByUser.count as any)(ctx, {
        namespace,
        bounds: {},
      });
      randomGetter = (index: number) =>
        (bookmarkedBySubthemeByUser.at as any)(ctx, { namespace, index });
    }
  } else if (args.themeId) {
    namespace = `${args.userId}_${args.themeId}`;
    if (args.mode === 'incorrect') {
      totalCount = await (incorrectByThemeByUser.count as any)(ctx, {
        namespace,
        bounds: {},
      });
      randomGetter = (index: number) =>
        (incorrectByThemeByUser.at as any)(ctx, { namespace, index });
    } else {
      totalCount = await (bookmarkedByThemeByUser.count as any)(ctx, {
        namespace,
        bounds: {},
      });
      randomGetter = (index: number) =>
        (bookmarkedByThemeByUser.at as any)(ctx, { namespace, index });
    }
  } else {
    // Fall back to basic user aggregates for global queries
    if (args.mode === 'incorrect') {
      totalCount = await (incorrectByUser.count as any)(ctx, {
        namespace: args.userId,
        bounds: {},
      });
      randomGetter = (index: number) =>
        (incorrectByUser.at as any)(ctx, { namespace: args.userId, index });
    } else {
      totalCount = await (bookmarkedByUser.count as any)(ctx, {
        namespace: args.userId,
        bounds: {},
      });
      randomGetter = (index: number) =>
        (bookmarkedByUser.at as any)(ctx, { namespace: args.userId, index });
    }
  }

  // If no questions available, return empty
  if (totalCount === 0) {
    return [];
  }

  // Get random questions efficiently
  const questionIds: Id<'questions'>[] = [];
  const requestedCount = Math.min(args.count, totalCount);
  const usedIndices = new Set<number>();

  for (let i = 0; i < requestedCount; i++) {
    let randomIndex: number;
    let attempts = 0;

    // Find an unused index (max 20 attempts to avoid infinite loops)
    do {
      randomIndex = Math.floor(Math.random() * totalCount);
      attempts++;
    } while (usedIndices.has(randomIndex) && attempts < 20);

    if (attempts >= 20) break; // Avoid infinite loops

    usedIndices.add(randomIndex);

    try {
      const result = await randomGetter(randomIndex);
      if (result?.id) {
        questionIds.push(result.id);
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

/**
 * Optimized unanswered questions using pagination instead of .collect()
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
  // Use paginated approach to avoid loading all answered questions into memory
  const answeredIds = new Set<Id<'questions'>>();
  let cursor: string | null = null;
  const batchSize = 100; // Process in small batches

  // Load answered questions in batches
  while (answeredIds.size < 5000) {
    // Reasonable limit to prevent infinite pagination
    const result: any = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user', (q: any) => q.eq('userId', args.userId))
      .paginate({ cursor, numItems: batchSize });

    result.page.forEach((stat: any) => answeredIds.add(stat.questionId));

    if (result.isDone) break;
    cursor = result.continueCursor;
  }

  // Get random questions from appropriate aggregate
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

  // Find unanswered questions
  const questionIds: Id<'questions'>[] = [];
  const usedIndices = new Set<number>();
  let attempts = 0;
  const maxAttempts = Math.min(args.count * 5, 100); // Reasonable limit

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
                count = await (incorrectByThemeByUser.count as any)(ctx, {
                  namespace,
                  bounds: {},
                });

                break;
              }
              case 'subtheme': {
                count = await (incorrectBySubthemeByUser.count as any)(ctx, {
                  namespace,
                  bounds: {},
                });

                break;
              }
              case 'group': {
                count = await (incorrectByGroupByUser.count as any)(ctx, {
                  namespace,
                  bounds: {},
                });

                break;
              }
              // No default
            }
          } else if (args.filter === 'bookmarked') {
            switch (selection.type) {
              case 'theme': {
                count = await (bookmarkedByThemeByUser.count as any)(ctx, {
                  namespace,
                  bounds: {},
                });

                break;
              }
              case 'subtheme': {
                count = await (bookmarkedBySubthemeByUser.count as any)(ctx, {
                  namespace,
                  bounds: {},
                });

                break;
              }
              case 'group': {
                count = await (bookmarkedByGroupByUser.count as any)(ctx, {
                  namespace,
                  bounds: {},
                });

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
export const getUserThemeStatsWithAggregates = query({
  args: {},
  returns: v.array(
    v.object({
      themeId: v.id('themes'),
      themeName: v.string(),
      total: v.number(),
      correct: v.number(),
      percentage: v.number(),
    }),
  ),
  handler: async (
    ctx,
  ): Promise<
    Array<{
      themeId: Id<'themes'>;
      themeName: string;
      total: number;
      correct: number;
      percentage: number;
    }>
  > => {
    const userId = await getCurrentUserOrThrow(ctx);

    // Get all themes first
    const themes = await ctx.db.query('themes').collect();

    if (themes.length === 0) {
      return [];
    }

    // Get theme statistics in parallel using aggregates
    const themeStatsPromises: Promise<{
      themeId: Id<'themes'>;
      themeName: string;
      total: number;
      correct: number;
      percentage: number;
    }>[] = themes.map(
      async (
        theme,
      ): Promise<{
        themeId: Id<'themes'>;
        themeName: string;
        total: number;
        correct: number;
        percentage: number;
      }> => {
        const [totalAnswered, totalIncorrect]: [number, number] =
          await Promise.all([
            ctx.runQuery(
              api.aggregateQueries.getUserAnsweredCountByThemeQuery,
              {
                themeId: theme._id,
              },
            ),
            ctx.runQuery(
              api.aggregateQueries.getUserIncorrectCountByThemeQuery,
              {
                themeId: theme._id,
              },
            ),
          ]);

        const totalCorrect = totalAnswered - totalIncorrect;
        const percentage =
          totalAnswered > 0
            ? Math.round((totalCorrect / totalAnswered) * 100)
            : 0;

        return {
          themeId: theme._id,
          themeName: theme.name,
          total: totalAnswered,
          correct: totalCorrect,
          percentage,
        };
      },
    );

    const themeStats: Array<{
      themeId: Id<'themes'>;
      themeName: string;
      total: number;
      correct: number;
      percentage: number;
    }> = await Promise.all(themeStatsPromises);

    // Filter out themes with no answered questions and sort by total answered (descending)
    return themeStats
      .filter(
        (stat: {
          themeId: Id<'themes'>;
          themeName: string;
          total: number;
          correct: number;
          percentage: number;
        }) => stat.total > 0,
      )
      .sort(
        (
          a: {
            themeId: Id<'themes'>;
            themeName: string;
            total: number;
            correct: number;
            percentage: number;
          },
          b: {
            themeId: Id<'themes'>;
            themeName: string;
            total: number;
            correct: number;
            percentage: number;
          },
        ) => b.total - a.total,
      );
  },
});

/**
 * Get user weekly progress using aggregates for efficient chart data
 * Note: This still uses table scan for weekly grouping but is more efficient than the old approach
 */
export const getUserWeeklyProgressWithAggregates = query({
  args: {},
  returns: v.array(
    v.object({
      week: v.string(),
      totalAnswered: v.number(),
      weeklyAnswered: v.number(),
    }),
  ),
  handler: async (
    ctx,
  ): Promise<
    Array<{
      week: string;
      totalAnswered: number;
      weeklyAnswered: number;
    }>
  > => {
    const userId = await getCurrentUserOrThrow(ctx);

    // Get answered count using aggregate for validation
    const totalAnsweredCount: number = await getUserAnsweredCount(
      ctx,
      userId._id,
    );

    if (totalAnsweredCount === 0) {
      return [];
    }

    // Still need to scan for weekly grouping, but we can optimize the query
    const answeredStats = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user_answered', q =>
        q.eq('userId', userId._id).eq('hasAnswered', true),
      )
      .collect();

    if (answeredStats.length === 0) {
      return [];
    }

    // Group by week and calculate cumulative totals
    const weeklyData = new Map<string, number>();

    // Count questions answered per week (using creation time - when first answered)
    for (const stat of answeredStats) {
      const weekString = getWeekString(stat._creationTime);
      weeklyData.set(weekString, (weeklyData.get(weekString) || 0) + 1);
    }

    // Convert to array and sort by week
    const sortedWeeks: [string, number][] = [...weeklyData.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12); // Get last 12 weeks

    // Calculate cumulative totals
    let cumulativeTotal = 0;
    const result: Array<{
      week: string;
      totalAnswered: number;
      weeklyAnswered: number;
    }> = sortedWeeks.map(([week, weeklyCount]) => {
      cumulativeTotal += weeklyCount;
      return {
        week,
        totalAnswered: cumulativeTotal,
        weeklyAnswered: weeklyCount,
      };
    });

    return result;
  },
});
