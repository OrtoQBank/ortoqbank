/* eslint-disable unicorn/no-null */

import { v } from 'convex/values';

import { api } from './_generated/api';
import { mutation, query } from './_generated/server';
import { questionCountByTheme, totalQuestionCount } from './aggregates';

/**
 * OPTIMIZED AGGREGATE HELPERS - NO MORE FULL TABLE SCANS!
 *
 * BEFORE: All functions used .collect() causing O(n) full table scans
 * AFTER: Using efficient strategies to avoid scanning entire tables:
 *
 * 1. TOTAL QUESTION COUNT:
 *    - OLD: ctx.db.query('questions').collect() → SCANS ALL QUESTIONS
 *    - NEW: totalQuestionCount.count() → O(log n) aggregate lookup
 *    - USES: Global aggregate with 'global' namespace
 *
 * 2. THEME QUESTION COUNT:
 *    - OLD: .withIndex().collect() → Could scan many rows
 *    - NEW: questionCountByTheme.count() → O(log n) aggregate lookup
 *    - FALLBACK: Efficient index scan for reliability
 *
 * 3. USER STATS (answered, incorrect, bookmarks):
 *    - OLD: .filter().collect() → FULL TABLE SCANS
 *    - NEW: .withIndex().collect() → INDEX SCANS only relevant user data
 *    - Uses by_user, by_user_answered, by_user_incorrect indexes
 *
 * PERFORMANCE IMPACT:
 * - Total questions: O(n) → O(log n) with global aggregate
 * - Theme questions: O(n) → O(log n) with theme aggregate
 * - User stats: O(n) → O(user_data) where user_data << total_data
 *
 * This eliminates full table scans that could scan thousands of irrelevant rows!
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
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    // Use the working aggregate pattern from questions.ts
    try {
      const count = await questionCountByTheme.count(ctx, {
        namespace: args.themeId,
        bounds: {},
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

// Query function to get user answer count - optimized with index
export const getUserAnsweredCountQuery = query({
  args: {
    userId: v.id('users'),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    // Use efficient index scan instead of .collect() on full table
    const stats = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user_answered', q =>
        q.eq('userId', args.userId).eq('hasAnswered', true),
      )
      .collect();
    return stats.length;
  },
});

// Query function to get user incorrect count - optimized with index
export const getUserIncorrectCountQuery = query({
  args: {
    userId: v.id('users'),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    // Use efficient index scan instead of .collect() on full table
    const stats = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user_incorrect', q =>
        q.eq('userId', args.userId).eq('isIncorrect', true),
      )
      .collect();
    return stats.length;
  },
});

// Query function to get user bookmarks count - optimized with index
export const getUserBookmarksCountQuery = query({
  args: {
    userId: v.id('users'),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    // Use efficient index scan instead of .collect() on full table
    const bookmarks = await ctx.db
      .query('userBookmarks')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .collect();
    return bookmarks.length;
  },
});

// Helper functions that call these queries
export async function getTotalQuestionCount(ctx: any): Promise<number> {
  return await ctx.runQuery(api.aggregateHelpers.getTotalQuestionCountQuery);
}

export async function getThemeQuestionCount(
  ctx: any,
  themeId: any,
): Promise<number> {
  return await ctx.runQuery(api.aggregateHelpers.getThemeQuestionCountQuery, {
    themeId,
  });
}

export async function getUserAnsweredCount(
  ctx: any,
  userId: any,
): Promise<number> {
  return await ctx.runQuery(api.aggregateHelpers.getUserAnsweredCountQuery, {
    userId,
  });
}

export async function getUserIncorrectCount(
  ctx: any,
  userId: any,
): Promise<number> {
  return await ctx.runQuery(api.aggregateHelpers.getUserIncorrectCountQuery, {
    userId,
  });
}

export async function getUserBookmarksCount(
  ctx: any,
  userId: any,
): Promise<number> {
  return await ctx.runQuery(api.aggregateHelpers.getUserBookmarksCountQuery, {
    userId,
  });
}

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

// Combined repair function for all aggregates
export const repairAllAggregates = mutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    console.log('Starting repair of all question-related aggregates...');

    await ctx.runMutation(api.aggregateHelpers.repairTotalQuestionCount);
    await ctx.runMutation(api.aggregateHelpers.repairQuestionCountByTheme);

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
        api.aggregateHelpers.repairTotalQuestionCountPaginated,
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
        api.aggregateHelpers.repairQuestionCountByThemePaginated,
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

// Production-safe combined repair function
export const repairAllAggregatesProduction = mutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    console.log(
      'Starting production-safe repair of all question-related aggregates...',
    );

    // Repair totalQuestionCount with pagination
    await ctx.runMutation(api.aggregateHelpers.runTotalQuestionCountRepair);

    // Repair questionCountByTheme with pagination
    await ctx.runMutation(api.aggregateHelpers.runQuestionCountByThemeRepair);

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
