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

// Repair function for totalQuestionCount aggregate
export const repairTotalQuestionCount = mutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    console.log('Starting totalQuestionCount aggregate repair...');

    // Clear and rebuild the aggregate
    await totalQuestionCount.clear(ctx, { namespace: 'global' });
    console.log('Cleared existing totalQuestionCount aggregate');

    // Get all questions and insert them into the aggregate
    const allQuestions = await ctx.db.query('questions').collect();
    console.log(`Found ${allQuestions.length} questions to process`);

    for (const question of allQuestions) {
      await totalQuestionCount.insertIfDoesNotExist(ctx, question);
    }

    // Verify the count
    const finalCount = await totalQuestionCount.count(ctx, {
      namespace: 'global',
      bounds: {},
    });

    console.log(`Repair completed! Final aggregate count: ${finalCount}`);
    return;
  },
});

// Repair function for questionCountByTheme aggregate
export const repairQuestionCountByTheme = mutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    console.log('Starting questionCountByTheme aggregate repair...');

    // Note: We skip clearing the aggregate since it requires a specific namespace
    // Instead we'll just ensure all questions are properly inserted
    console.log('Rebuilding questionCountByTheme aggregate...');

    // Get all questions with themes and insert them
    const allQuestions = await ctx.db.query('questions').collect();
    let processedCount = 0;

    for (const question of allQuestions) {
      if (question.themeId) {
        await questionCountByTheme.insertIfDoesNotExist(ctx, question);
        processedCount++;
      }
    }

    console.log(
      `Repair completed! Processed ${processedCount} questions with themes.`,
    );
    return;
  },
});

// Repair function for questionCountBySubtheme aggregate
export const repairQuestionCountBySubtheme = mutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    console.log('Starting questionCountBySubtheme aggregate repair...');

    const allQuestions = await ctx.db.query('questions').collect();
    let processedCount = 0;

    for (const question of allQuestions) {
      if (question.subthemeId) {
        await questionCountBySubtheme.insertIfDoesNotExist(ctx, question);
        processedCount++;
      }
    }

    console.log(
      `Repair completed! Processed ${processedCount} questions with subthemes.`,
    );
    return;
  },
});

// Repair function for questionCountByGroup aggregate
export const repairQuestionCountByGroup = mutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    console.log('Starting questionCountByGroup aggregate repair...');

    const allQuestions = await ctx.db.query('questions').collect();
    let processedCount = 0;

    for (const question of allQuestions) {
      if (question.groupId) {
        await questionCountByGroup.insertIfDoesNotExist(ctx, question);
        processedCount++;
      }
    }

    console.log(
      `Repair completed! Processed ${processedCount} questions with groups.`,
    );
    return;
  },
});

// Combined repair function for all aggregates
export const repairAllAggregates = mutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    console.log('Starting repair of all question-related aggregates...');

    await ctx.runMutation(api.aggregateQueries.repairTotalQuestionCount);
    await ctx.runMutation(api.aggregateQueries.repairQuestionCountByTheme);
    await ctx.runMutation(api.aggregateQueries.repairQuestionCountBySubtheme);
    await ctx.runMutation(api.aggregateQueries.repairQuestionCountByGroup);

    console.log('All aggregate repairs completed!');
    return;
  },
});

// Paginated repair function for totalQuestionCount aggregate (production-safe)
export const repairTotalQuestionCountPaginated = mutation({
  args: {
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.string()),
    clearFirst: v.optional(v.boolean()),
  },
  returns: v.object({
    processed: v.number(),
    continueCursor: v.optional(v.string()),
    isDone: v.boolean(),
    totalProcessed: v.number(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 50; // Process 50 questions at a time
    const isFirstRun = args.clearFirst === true;

    console.log(`Processing batch of ${batchSize} questions...`);

    // Clear the aggregate only on first run
    if (isFirstRun) {
      console.log('Clearing totalQuestionCount aggregate...');
      await totalQuestionCount.clear(ctx, { namespace: 'global' });
      console.log('Aggregate cleared successfully');
    }

    // Get a batch of questions
    const result = await ctx.db.query('questions').paginate({
      cursor: args.cursor ?? null,
      numItems: batchSize,
    });

    // Process each question in this batch
    let processed = 0;
    for (const question of result.page) {
      await totalQuestionCount.insertIfDoesNotExist(ctx, question);
      processed++;
    }

    console.log(`Processed ${processed} questions in this batch`);

    return {
      processed,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
      totalProcessed: processed, // This will be accumulated by the caller
    };
  },
});

// Paginated repair function for questionCountByTheme aggregate (production-safe)
export const repairQuestionCountByThemePaginated = mutation({
  args: {
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    processed: v.number(),
    continueCursor: v.optional(v.string()),
    isDone: v.boolean(),
    totalProcessed: v.number(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 50; // Process 50 questions at a time

    console.log(
      `Processing batch of ${batchSize} questions for theme aggregate...`,
    );

    // Get a batch of questions
    const result = await ctx.db.query('questions').paginate({
      cursor: args.cursor ?? null,
      numItems: batchSize,
    });

    // Process each question in this batch (only those with themeId)
    let processed = 0;
    for (const question of result.page) {
      if (question.themeId) {
        await questionCountByTheme.insertIfDoesNotExist(ctx, question);
        processed++;
      }
    }

    console.log(`Processed ${processed} questions with themes in this batch`);

    return {
      processed,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
      totalProcessed: processed,
    };
  },
});

// Orchestrator function to run paginated repair for totalQuestionCount
export const runTotalQuestionCountRepair = mutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    console.log('Starting paginated totalQuestionCount repair...');

    let cursor: string | undefined;
    let totalProcessed = 0;
    let batchCount = 0;
    let isFirstRun = true;

    while (true) {
      const result = await ctx.runMutation(
        api.aggregateQueries.repairTotalQuestionCountPaginated,
        {
          batchSize: 50,
          cursor,
          clearFirst: isFirstRun,
        },
      );

      totalProcessed += result.processed;
      batchCount++;
      isFirstRun = false;

      console.log(
        `Batch ${batchCount} completed. Total processed: ${totalProcessed}`,
      );

      if (result.isDone) {
        break;
      }

      cursor = result.continueCursor;
    }

    // Verify the final count
    const finalCount = await totalQuestionCount.count(ctx, {
      namespace: 'global',
      bounds: {},
    });

    console.log(
      `Repair completed! Processed ${totalProcessed} questions in ${batchCount} batches. Final count: ${finalCount}`,
    );
    return;
  },
});

// Orchestrator function to run paginated repair for questionCountByTheme
export const runQuestionCountByThemeRepair = mutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    console.log('Starting paginated questionCountByTheme repair...');

    let cursor: string | undefined;
    let totalProcessed = 0;
    let batchCount = 0;

    while (true) {
      const result = await ctx.runMutation(
        api.aggregateQueries.repairQuestionCountByThemePaginated,
        {
          batchSize: 50,
          cursor,
        },
      );

      totalProcessed += result.processed;
      batchCount++;

      console.log(
        `Batch ${batchCount} completed. Total processed: ${totalProcessed}`,
      );

      if (result.isDone) {
        break;
      }

      cursor = result.continueCursor;
    }

    console.log(
      `Theme repair completed! Processed ${totalProcessed} questions with themes in ${batchCount} batches.`,
    );
    return;
  },
});

// Repair function for answeredByUser aggregate
export const repairAnsweredByUser = mutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    console.log('Starting answeredByUser aggregate repair...');

    const allStats = await ctx.db.query('userQuestionStats').collect();
    let processedCount = 0;

    for (const stat of allStats) {
      if (stat.hasAnswered) {
        await answeredByUser.insertIfDoesNotExist(ctx, stat);
        processedCount++;
      }
    }

    console.log(
      `Repair completed! Processed ${processedCount} answered stats.`,
    );
    return;
  },
});

// Repair function for incorrectByUser aggregate
export const repairIncorrectByUser = mutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    console.log('Starting incorrectByUser aggregate repair...');

    const allStats = await ctx.db.query('userQuestionStats').collect();
    let processedCount = 0;

    for (const stat of allStats) {
      if (stat.isIncorrect) {
        await incorrectByUser.insertIfDoesNotExist(ctx, stat);
        processedCount++;
      }
    }

    console.log(
      `Repair completed! Processed ${processedCount} incorrect stats.`,
    );
    return;
  },
});

// Repair function for bookmarkedByUser aggregate
export const repairBookmarkedByUser = mutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    console.log('Starting bookmarkedByUser aggregate repair...');

    const allBookmarks = await ctx.db.query('userBookmarks').collect();
    let processedCount = 0;

    for (const bookmark of allBookmarks) {
      await bookmarkedByUser.insertIfDoesNotExist(ctx, bookmark);
      processedCount++;
    }

    console.log(`Repair completed! Processed ${processedCount} bookmarks.`);
    return;
  },
});

// Production-safe combined repair function
export const repairAllAggregatesProduction = mutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    console.log('Starting production-safe repair of all aggregates...');

    // Repair question-related aggregates with pagination
    await ctx.runMutation(api.aggregateQueries.runTotalQuestionCountRepair);
    await ctx.runMutation(api.aggregateQueries.runQuestionCountByThemeRepair);
    await ctx.runMutation(api.aggregateQueries.repairQuestionCountBySubtheme);
    await ctx.runMutation(api.aggregateQueries.repairQuestionCountByGroup);

    // Repair user stat aggregates
    await ctx.runMutation(api.aggregateQueries.repairAnsweredByUser);
    await ctx.runMutation(api.aggregateQueries.repairIncorrectByUser);
    await ctx.runMutation(api.aggregateQueries.repairBookmarkedByUser);

    console.log('All aggregate repairs completed successfully!');
    return;
  },
});

// Single-step repair functions that can be called individually
export const stepOneClearTotalQuestionCount = mutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    console.log('Step 1: Clearing totalQuestionCount aggregate...');
    await totalQuestionCount.clear(ctx, { namespace: 'global' });
    console.log('totalQuestionCount aggregate cleared successfully');
    return;
  },
});

export const stepTwoRepairTotalQuestionCountBatch = mutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    continueCursor: v.optional(v.string()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 100;
    console.log(
      `Step 2: Processing batch of ${batchSize} questions for totalQuestionCount...`,
    );

    const result = await ctx.db.query('questions').paginate({
      cursor: args.cursor ?? null,
      numItems: batchSize,
    });

    let processed = 0;
    for (const question of result.page) {
      await totalQuestionCount.insertIfDoesNotExist(ctx, question);
      processed++;
    }

    console.log(`Processed ${processed} questions. Done: ${result.isDone}`);

    return {
      processed,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const stepThreeRepairThemeCountBatch = mutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    continueCursor: v.optional(v.string()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 100;
    console.log(
      `Step 3: Processing batch of ${batchSize} questions for questionCountByTheme...`,
    );

    const result = await ctx.db.query('questions').paginate({
      cursor: args.cursor ?? null,
      numItems: batchSize,
    });

    let processed = 0;
    for (const question of result.page) {
      if (question.themeId) {
        await questionCountByTheme.insertIfDoesNotExist(ctx, question);
        processed++;
      }
    }

    console.log(
      `Processed ${processed} questions with themes. Done: ${result.isDone}`,
    );

    return {
      processed,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const stepFourVerifyTotalCount = mutation({
  args: {},
  returns: v.number(),
  handler: async ctx => {
    console.log('Step 4: Verifying totalQuestionCount...');
    const count = await totalQuestionCount.count(ctx, {
      namespace: 'global',
      bounds: {},
    });
    console.log(`Final totalQuestionCount: ${count}`);
    return count;
  },
});
