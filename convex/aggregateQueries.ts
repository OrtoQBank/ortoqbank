/* eslint-disable unicorn/no-null */

import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { api } from './_generated/api';
import { mutation, query } from './_generated/server';
import { getCurrentUserOrThrow } from './users';
import {
  questionCountByTheme,
  questionCountBySubtheme,
  questionCountByGroup,
  totalQuestionCount,
  answeredByUser,
  incorrectByUser,
  bookmarkedByUser,
  randomQuestions,
  randomQuestionsByTheme,
  randomQuestionsBySubtheme,
  randomQuestionsByGroup,
} from './aggregates';

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
    const count = await (answeredByUser.count as any)(ctx, {
      namespace: args.userId,
      bounds: {},
    });
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
    const count = await (incorrectByUser.count as any)(ctx, {
      namespace: args.userId,
      bounds: {},
    });
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
    const count = await (bookmarkedByUser.count as any)(ctx, {
      namespace: args.userId,
      bounds: {},
    });
    return count;
  },
});

// Helper functions that call these queries
export async function getTotalQuestionCount(ctx: any): Promise<number> {
  return await ctx.runQuery(api.aggregateQueries.getTotalQuestionCountQuery);
}

export async function getThemeQuestionCount(
  ctx: any,
  themeId: any,
): Promise<number> {
  return await ctx.runQuery(api.aggregateQueries.getThemeQuestionCountQuery, {
    themeId,
  });
}

export async function getSubthemeQuestionCount(
  ctx: any,
  subthemeId: any,
): Promise<number> {
  return await ctx.runQuery(
    api.aggregateQueries.getSubthemeQuestionCountQuery,
    {
      subthemeId,
    },
  );
}

export async function getGroupQuestionCount(
  ctx: any,
  groupId: any,
): Promise<number> {
  return await ctx.runQuery(api.aggregateQueries.getGroupQuestionCountQuery, {
    groupId,
  });
}

export async function getUserAnsweredCount(
  ctx: any,
  userId: any,
): Promise<number> {
  return await ctx.runQuery(api.aggregateQueries.getUserAnsweredCountQuery, {
    userId,
  });
}

export async function getUserIncorrectCount(
  ctx: any,
  userId: any,
): Promise<number> {
  return await ctx.runQuery(api.aggregateQueries.getUserIncorrectCountQuery, {
    userId,
  });
}

export async function getUserBookmarksCount(
  ctx: any,
  userId: any,
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
 * Get count for a specific filter type (all/unanswered/incorrect/bookmarked)
 */
async function getCountForFilterType(
  ctx: any,
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
 * Get random questions filtered by user mode (incorrect, bookmarked, unanswered)
 * This combines aggregate-based random selection with user filtering
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
