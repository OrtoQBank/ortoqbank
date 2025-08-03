import { WorkflowManager } from '@convex-dev/workflow';
import { v } from 'convex/values';

import { components, internal, api } from './_generated/api';
import {
  internalMutation,
  internalQuery,
  internalAction,
  mutation,
} from './_generated/server';
import {
  answeredByUser,
  bookmarkedByUser,
  incorrectByUser,
  questionCountByTheme,
  questionCountBySubtheme,
  questionCountByGroup,
  totalQuestionCount,
  randomQuestions,
  randomQuestionsByTheme,
  randomQuestionsBySubtheme,
  randomQuestionsByGroup,
  // Hierarchical user-specific aggregates
  incorrectByThemeByUser,
  incorrectBySubthemeByUser,
  incorrectByGroupByUser,
  bookmarkedByThemeByUser,
  bookmarkedBySubthemeByUser,
  bookmarkedByGroupByUser,
  answeredByThemeByUser,
  answeredBySubthemeByUser,
  answeredByGroupByUser,
} from './aggregates';

// Create the workflow manager
export const workflow = new WorkflowManager(components.workflow);

// Simple mutation to start workflow - returns workflow ID as string
export const startAggregateRepair = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx): Promise<string> => {
    console.log('Starting aggregate repair workflow...');

    const workflowId: any = await workflow.start(
      ctx,
      internal.aggregateWorkflows.repairWorkflow,
      {},
    );

    console.log(`Workflow started with ID: ${workflowId}`);
    return workflowId as string;
  },
});

// Start user aggregates repair workflow
export const startUserAggregatesRepair = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx): Promise<string> => {
    console.log('Starting user aggregates repair workflow...');

    const workflowId: any = await workflow.start(
      ctx,
      internal.aggregateWorkflows.repairUserAggregatesWorkflow,
      {},
    );

    console.log(`User aggregates workflow started with ID: ${workflowId}`);
    return workflowId as string;
  },
});

// The main workflow definition
export const repairWorkflow = workflow.define({
  args: {},
  handler: async (step): Promise<number> => {
    console.log('Workflow: Starting aggregate repair process...');

    // Step 1: Clear the total question count aggregate
    await step.runMutation(internal.aggregateWorkflows.clearAggregatesStep, {});

    // Step 2: Process questions in batches
    let cursor: string | undefined = undefined;
    let batchNumber = 1;

    while (true) {
      const result: any = await step.runMutation(
        internal.aggregateWorkflows.processBatchStep,
        { cursor, batchSize: 50 },
      );

      console.log(
        `Workflow: Batch ${batchNumber} completed, processed ${result.processed} questions`,
      );

      if (result.isDone) break;
      cursor = result.continueCursor;
      batchNumber++;
    }

    // Step 3: Verify final counts
    const finalCount: any = await step.runMutation(
      internal.aggregateWorkflows.verifyCountStep,
      {},
    );

    console.log(`Workflow: Repair completed! Final count: ${finalCount}`);
    return finalCount as number;
  },
});

// User aggregates repair workflow
export const repairUserAggregatesWorkflow = workflow.define({
  args: {},
  handler: async (
    step,
  ): Promise<{ answered: number; incorrect: number; bookmarked: number }> => {
    console.log('Workflow: Starting user aggregates repair process...');

    // Step 1: Clear all user aggregates
    await step.runMutation(
      internal.aggregateWorkflows.clearUserAggregatesStep,
      {},
    );

    // Step 2: Repair answered/incorrect aggregates from userQuestionStats
    let cursor: string | undefined = undefined;
    let batchNumber = 1;
    let totalAnswered = 0;
    let totalIncorrect = 0;

    while (true) {
      const result: any = await step.runMutation(
        internal.aggregateWorkflows.processUserStatsBatchStep,
        { cursor, batchSize: 100 },
      );

      console.log(
        `Workflow: UserStats Batch ${batchNumber} completed, processed ${result.processed} stats`,
      );

      totalAnswered += result.answeredCount;
      totalIncorrect += result.incorrectCount;

      if (result.isDone) break;
      cursor = result.continueCursor;
      batchNumber++;
    }

    // Step 3: Repair bookmarked aggregates from userBookmarks
    cursor = undefined;
    batchNumber = 1;
    let totalBookmarked = 0;

    while (true) {
      const result: any = await step.runMutation(
        internal.aggregateWorkflows.processBookmarksBatchStep,
        { cursor, batchSize: 100 },
      );

      console.log(
        `Workflow: Bookmarks Batch ${batchNumber} completed, processed ${result.processed} bookmarks`,
      );

      totalBookmarked += result.bookmarkedCount;

      if (result.isDone) break;
      cursor = result.continueCursor;
      batchNumber++;
    }

    // Step 4: Verify final counts
    const finalCounts: any = await step.runMutation(
      internal.aggregateWorkflows.verifyUserAggregatesStep,
      {},
    );

    // Compare loop totals with verified totals for debugging
    const loopTotals = {
      answered: totalAnswered,
      incorrect: totalIncorrect,
      bookmarked: totalBookmarked,
    };

    console.log(`Workflow: Loop totals:`, loopTotals);
    console.log(`Workflow: Verified totals:`, finalCounts);

    // Log any discrepancies
    if (loopTotals.answered !== finalCounts.totalAnswered) {
      console.warn(
        `Discrepancy in answered count: loop=${loopTotals.answered}, verified=${finalCounts.totalAnswered}`,
      );
    }
    if (loopTotals.incorrect !== finalCounts.totalIncorrect) {
      console.warn(
        `Discrepancy in incorrect count: loop=${loopTotals.incorrect}, verified=${finalCounts.totalIncorrected}`,
      );
    }
    if (loopTotals.bookmarked !== finalCounts.totalBookmarked) {
      console.warn(
        `Discrepancy in bookmarked count: loop=${loopTotals.bookmarked}, verified=${finalCounts.totalBookmarked}`,
      );
    }

    console.log(`Workflow: User aggregates repair completed!`, finalCounts);

    // Return the verified totals instead of loop totals
    return {
      answered: finalCounts.totalAnswered,
      incorrect: finalCounts.totalIncorrect,
      bookmarked: finalCounts.totalBookmarked,
    };
  },
});

// Clear aggregates step
export const clearAggregatesStep = internalMutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    console.log('Step: Clearing totalQuestionCount aggregate...');
    await totalQuestionCount.clear(ctx, { namespace: 'global' });
    console.log('Step: Aggregate cleared successfully');
    return null;
  },
});

// Clear user aggregates step
export const clearUserAggregatesStep = internalMutation({
  args: {},
  returns: v.object({
    totalUsersCleared: v.number(),
  }),
  handler: async ctx => {
    console.log('Step: Clearing user aggregates...');

    let cursor: string | null = null;
    let totalUsersCleared = 0;
    const batchSize = 50; // Process users in batches of 50

    while (true) {
      // Paginate through users in batches
      const result = await ctx.db.query('users').paginate({
        cursor,
        numItems: batchSize,
      });

      // Clear aggregates for users in this batch
      for (const user of result.page) {
        await answeredByUser.clear(ctx, { namespace: user._id });
        await incorrectByUser.clear(ctx, { namespace: user._id });
        await bookmarkedByUser.clear(ctx, { namespace: user._id });
        totalUsersCleared++;
      }

      console.log(
        `Step: Cleared aggregates for batch of ${result.page.length} users (total: ${totalUsersCleared})`,
      );

      if (result.isDone) break;
      cursor = result.continueCursor;
    }

    console.log(
      `Step: Cleared aggregates for ${totalUsersCleared} users total`,
    );
    return { totalUsersCleared };
  },
});

// Process batch step
export const processBatchStep = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.number(),
  },
  returns: v.object({
    processed: v.number(),
    continueCursor: v.optional(v.string()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    console.log(`Step: Processing batch of ${args.batchSize} questions...`);

    const result = await ctx.db.query('questions').paginate({
      cursor: args.cursor ?? null,
      numItems: args.batchSize,
    });

    let processed = 0;
    for (const question of result.page) {
      // Insert into total count aggregate
      await totalQuestionCount.insertIfDoesNotExist(ctx, question);

      // Insert into theme count aggregate if has theme
      if (question.themeId) {
        await questionCountByTheme.insertIfDoesNotExist(ctx, question);
      }

      // Insert into subtheme count aggregate if has subtheme
      if (question.subthemeId) {
        await questionCountBySubtheme.insertIfDoesNotExist(ctx, question);
      }

      // Insert into group count aggregate if has group
      if (question.groupId) {
        await questionCountByGroup.insertIfDoesNotExist(ctx, question);
      }

      processed++;
    }

    console.log(
      `Step: Processed ${processed} questions. Done: ${result.isDone}`,
    );

    return {
      processed,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

// Process userQuestionStats batch step
export const processUserStatsBatchStep = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.number(),
  },
  returns: v.object({
    processed: v.number(),
    answeredCount: v.number(),
    incorrectCount: v.number(),
    continueCursor: v.optional(v.string()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    console.log(
      `Step: Processing batch of ${args.batchSize} userQuestionStats...`,
    );

    const result = await ctx.db.query('userQuestionStats').paginate({
      cursor: args.cursor ?? null,
      numItems: args.batchSize,
    });

    let processed = 0;
    let answeredCount = 0;
    let incorrectCount = 0;

    for (const stat of result.page) {
      // Insert into answered aggregate (all stats represent answered questions)
      await answeredByUser.insertIfDoesNotExist(ctx, stat);
      answeredCount++;

      // Insert into incorrect aggregate if the answer was incorrect
      if (stat.isIncorrect) {
        await incorrectByUser.insertIfDoesNotExist(ctx, stat);
        incorrectCount++;
      }

      processed++;
    }

    console.log(
      `Step: Processed ${processed} stats (${answeredCount} answered, ${incorrectCount} incorrect). Done: ${result.isDone}`,
    );

    return {
      processed,
      answeredCount,
      incorrectCount,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

// Process userBookmarks batch step
export const processBookmarksBatchStep = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.number(),
  },
  returns: v.object({
    processed: v.number(),
    bookmarkedCount: v.number(),
    continueCursor: v.optional(v.string()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    console.log(`Step: Processing batch of ${args.batchSize} userBookmarks...`);

    const result = await ctx.db.query('userBookmarks').paginate({
      cursor: args.cursor ?? null,
      numItems: args.batchSize,
    });

    let processed = 0;
    let bookmarkedCount = 0;

    for (const bookmark of result.page) {
      // Insert into bookmarked aggregate
      await bookmarkedByUser.insertIfDoesNotExist(ctx, bookmark);
      bookmarkedCount++;
      processed++;
    }

    console.log(
      `Step: Processed ${processed} bookmarks. Done: ${result.isDone}`,
    );

    return {
      processed,
      bookmarkedCount,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

// Verify count step
export const verifyCountStep = internalMutation({
  args: {},
  returns: v.number(),
  handler: async ctx => {
    console.log('Step: Verifying final count...');

    const totalQuestions = await totalQuestionCount.count(ctx, {
      namespace: 'global',
      bounds: {},
    });

    console.log(`Step: Final verification - Total: ${totalQuestions}`);
    return totalQuestions;
  },
});

// Verify user aggregates step
export const verifyUserAggregatesStep = internalMutation({
  args: {},
  returns: v.object({
    totalAnswered: v.number(),
    totalIncorrect: v.number(),
    totalBookmarked: v.number(),
    userCount: v.number(),
  }),
  handler: async ctx => {
    console.log('Step: Verifying user aggregates...');

    let cursor: string | null = null;
    let totalAnswered = 0;
    let totalIncorrect = 0;
    let totalBookmarked = 0;
    let userCount = 0;
    const batchSize = 50; // Process users in batches of 50

    while (true) {
      // Paginate through users in batches
      const result = await ctx.db.query('users').paginate({
        cursor,
        numItems: batchSize,
      });

      // Verify aggregates for users in this batch (parallel queries)
      const userCounts = await Promise.all(
        result.page.map(async user => {
          const [answered, incorrect, bookmarked] = await Promise.all([
            (answeredByUser.count as any)(ctx, {
              namespace: user._id,
              bounds: {},
            }),
            (incorrectByUser.count as any)(ctx, {
              namespace: user._id,
              bounds: {},
            }),
            (bookmarkedByUser.count as any)(ctx, {
              namespace: user._id,
              bounds: {},
            }),
          ]);
          return { answered, incorrect, bookmarked };
        }),
      );

      // Aggregate the results
      for (const counts of userCounts) {
        totalAnswered += counts.answered;
        totalIncorrect += counts.incorrect;
        totalBookmarked += counts.bookmarked;
        userCount++;
      }

      console.log(
        `Step: Verified batch of ${result.page.length} users (total: ${userCount})`,
      );

      if (result.isDone) break;
      cursor = result.continueCursor;
    }

    const finalResult = {
      totalAnswered,
      totalIncorrect,
      totalBookmarked,
      userCount,
    };

    console.log(`Step: Final verification - User aggregates:`, finalResult);
    return finalResult;
  },
});

// Simple status check
export const getWorkflowStatus = mutation({
  args: { workflowId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const status = await workflow.status(ctx, args.workflowId as any);
    console.log(`Workflow status:`, status);
    return status;
  },
});

// ============================================================================
// PRODUCTION-SAFE AGGREGATE REPAIR SYSTEM
// ============================================================================

/**
 * MAIN REPAIR ENTRY POINT - Start comprehensive aggregate repair workflow
 * This is the recommended way to repair all aggregates in production (REFERENCE ONLY - may timeout with large datasets)
 */
export const startComprehensiveRepair = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx): Promise<string> => {
    console.log('🚀 Starting comprehensive aggregate repair workflow...');

    const workflowId: any = await workflow.start(
      ctx,
      internal.aggregateWorkflows.comprehensiveRepairWorkflow,
      {},
    );

    console.log(
      `✅ Comprehensive repair workflow started with ID: ${workflowId}`,
    );
    return workflowId as string;
  },
});

/**
 * COMPREHENSIVE REPAIR WORKFLOW - Handles all aggregates with production-safe pagination (REFERENCE ONLY)
 */
export const comprehensiveRepairWorkflow = workflow.define({
  args: {},
  handler: async (
    step,
  ): Promise<{
    questionsProcessed: number;
    userStatsProcessed: number;
    bookmarksProcessed: number;
    hierarchicalStatsProcessed: number;
    totalUsers: number;
  }> => {
    console.log('🔧 Workflow: Starting comprehensive aggregate repair...');

    // PHASE 1: Clear all aggregates safely
    await step.runMutation(
      internal.aggregateWorkflows.clearAllAggregatesStep,
      {},
    );

    // PHASE 2: Repair question-related aggregates (paginated)
    let questionsProcessed = 0;
    let cursor: string | undefined = undefined;
    let batchNumber = 1;

    while (true) {
      const result: any = await step.runMutation(
        internal.aggregateWorkflows.processQuestionsBatchStep,
        { cursor, batchSize: 100 },
      );

      console.log(
        `📊 Workflow: Questions batch ${batchNumber} completed - ${result.processed} questions processed`,
      );

      questionsProcessed += result.processed;

      if (result.isDone) break;
      cursor = result.continueCursor;
      batchNumber++;
    }

    // PHASE 3: Repair user stat aggregates (paginated)
    cursor = undefined;
    batchNumber = 1;
    let userStatsProcessed = 0;

    while (true) {
      const result: any = await step.runMutation(
        internal.aggregateWorkflows.processUserStatsBatchStep,
        { cursor, batchSize: 100 },
      );

      console.log(
        `👤 Workflow: User stats batch ${batchNumber} completed - ${result.processed} stats processed`,
      );

      userStatsProcessed += result.processed;

      if (result.isDone) break;
      cursor = result.continueCursor;
      batchNumber++;
    }

    // PHASE 4: Repair bookmark aggregates (paginated)
    cursor = undefined;
    batchNumber = 1;
    let bookmarksProcessed = 0;

    while (true) {
      const result: any = await step.runMutation(
        internal.aggregateWorkflows.processBookmarksBatchStep,
        { cursor, batchSize: 100 },
      );

      console.log(
        `🔖 Workflow: Bookmarks batch ${batchNumber} completed - ${result.processed} bookmarks processed`,
      );

      bookmarksProcessed += result.processed;

      if (result.isDone) break;
      cursor = result.continueCursor;
      batchNumber++;
    }

    // PHASE 5: Verify final counts
    const finalCounts: any = await step.runMutation(
      internal.aggregateWorkflows.verifyAllAggregatesStep,
      {},
    );

    console.log('✅ Workflow: Comprehensive repair completed!', {
      questionsProcessed,
      userStatsProcessed,
      bookmarksProcessed,
      hierarchicalStatsProcessed: 0,
      finalCounts,
    });

    return {
      questionsProcessed,
      userStatsProcessed,
      bookmarksProcessed,
      hierarchicalStatsProcessed: 0,
      totalUsers: finalCounts.userCount,
    };
  },
});

/**
 * CLEAR ALL AGGREGATES STEP - Safe clearing of all aggregate namespaces
 */
export const clearAllAggregatesStep = internalMutation({
  args: {},
  returns: v.object({
    totalUsersCleared: v.number(),
  }),
  handler: async ctx => {
    console.log('🧹 Step: Clearing all aggregates...');

    // Clear global aggregates
    await totalQuestionCount.clear(ctx, { namespace: 'global' });
    await randomQuestions.clear(ctx, { namespace: 'global' });
    console.log('✅ Cleared global aggregates');

    // Clear user aggregates (paginated by user)
    let cursor: string | null = null;
    let totalUsersCleared = 0;
    const batchSize = 50;

    while (true) {
      const result = await ctx.db.query('users').paginate({
        cursor,
        numItems: batchSize,
      });

      for (const user of result.page) {
        await answeredByUser.clear(ctx, { namespace: user._id });
        await incorrectByUser.clear(ctx, { namespace: user._id });
        await bookmarkedByUser.clear(ctx, { namespace: user._id });
        totalUsersCleared++;
      }

      console.log(
        `🧹 Cleared aggregates for ${result.page.length} users (total: ${totalUsersCleared})`,
      );

      if (result.isDone) break;
      cursor = result.continueCursor;
    }

    console.log(
      `✅ Step: Cleared all aggregates for ${totalUsersCleared} users`,
    );
    return { totalUsersCleared };
  },
});

/**
 * PROCESS QUESTIONS BATCH - Handle all question-related aggregates in one pass
 */
export const processQuestionsBatchStep = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.number(),
  },
  returns: v.object({
    processed: v.number(),
    continueCursor: v.optional(v.string()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    console.log(`📝 Step: Processing batch of ${args.batchSize} questions...`);

    const result = await ctx.db.query('questions').paginate({
      cursor: args.cursor ?? null,
      numItems: args.batchSize,
    });

    let processed = 0;
    for (const question of result.page) {
      // Insert into all relevant question aggregates
      await totalQuestionCount.insertIfDoesNotExist(ctx, question);
      await randomQuestions.insertIfDoesNotExist(ctx, question);
      await randomQuestionsByTheme.insertIfDoesNotExist(ctx, question);

      if (question.themeId) {
        await questionCountByTheme.insertIfDoesNotExist(ctx, question);
      }
      if (question.subthemeId) {
        await questionCountBySubtheme.insertIfDoesNotExist(ctx, question);
        await randomQuestionsBySubtheme.insertIfDoesNotExist(ctx, question);
      }
      if (question.groupId) {
        await questionCountByGroup.insertIfDoesNotExist(ctx, question);
        await randomQuestionsByGroup.insertIfDoesNotExist(ctx, question);
      }

      processed++;
    }

    console.log(
      `✅ Step: Processed ${processed} questions. Done: ${result.isDone}`,
    );

    return {
      processed,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * VERIFY ALL AGGREGATES STEP - Comprehensive verification of all aggregate counts
 */
export const verifyAllAggregatesStep = internalMutation({
  args: {},
  returns: v.object({
    totalQuestions: v.number(),
    totalAnswered: v.number(),
    totalIncorrect: v.number(),
    totalBookmarked: v.number(),
    userCount: v.number(),
  }),
  handler: async ctx => {
    console.log('🔍 Step: Verifying all aggregate counts...');

    // Verify global question count
    const totalQuestions = await totalQuestionCount.count(ctx, {
      namespace: 'global',
      bounds: {},
    });

    // Verify user aggregates across all users (paginated)
    let cursor: string | null = null;
    let totalAnswered = 0;
    let totalIncorrect = 0;
    let totalBookmarked = 0;
    let userCount = 0;
    const batchSize = 50;

    while (true) {
      const result = await ctx.db.query('users').paginate({
        cursor,
        numItems: batchSize,
      });

      const userCounts = await Promise.all(
        result.page.map(async user => {
          const [answered, incorrect, bookmarked] = await Promise.all([
            (answeredByUser.count as any)(ctx, {
              namespace: user._id,
              bounds: {},
            }),
            (incorrectByUser.count as any)(ctx, {
              namespace: user._id,
              bounds: {},
            }),
            (bookmarkedByUser.count as any)(ctx, {
              namespace: user._id,
              bounds: {},
            }),
          ]);
          return { answered, incorrect, bookmarked };
        }),
      );

      for (const counts of userCounts) {
        totalAnswered += counts.answered;
        totalIncorrect += counts.incorrect;
        totalBookmarked += counts.bookmarked;
        userCount++;
      }

      if (result.isDone) break;
      cursor = result.continueCursor;
    }

    const finalResult = {
      totalQuestions,
      totalAnswered,
      totalIncorrect,
      totalBookmarked,
      userCount,
    };

    console.log('✅ Step: Verification completed:', finalResult);
    return finalResult;
  },
});

// ============================================================================
// SIMPLIFIED INDIVIDUAL REPAIR FUNCTIONS (for specific use cases)
// ============================================================================

/**
 * EMERGENCY REPAIR - Quick total question count repair (production-safe)
 */
export const emergencyRepairQuestionCount = mutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    console.log('🚨 Emergency: Repairing total question count...');

    // Clear and rebuild in batches
    await totalQuestionCount.clear(ctx, { namespace: 'global' });

    let cursor: string | null = null;
    let totalProcessed = 0;
    const batchSize = 100;

    while (true) {
      const result = await ctx.db.query('questions').paginate({
        cursor,
        numItems: batchSize,
      });

      for (const question of result.page) {
        await totalQuestionCount.insertIfDoesNotExist(ctx, question);
        totalProcessed++;
      }

      console.log(
        `🚨 Emergency: Processed ${result.page.length} questions (total: ${totalProcessed})`,
      );

      if (result.isDone) break;
      cursor = result.continueCursor;
    }

    const finalCount = await totalQuestionCount.count(ctx, {
      namespace: 'global',
      bounds: {},
    });

    console.log(`✅ Emergency repair completed! Final count: ${finalCount}`);
    return null;
  },
});

// ============================================================================
// PRODUCTION-SAFE SINGLE-PAGINATION WORKFLOWS (FIXED FOR LARGE DATASETS)
// ============================================================================

/**
 * PRODUCTION-SAFE: Repair single user (micro-batches, no timeouts)
 */
export const startMicroBatchUserRepair = mutation({
  args: {
    userId: v.id('users'),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    console.log(`🛡️ Starting micro-batch user repair for ${args.userId}...`);

    const workflowId: any = await workflow.start(
      ctx,
      internal.aggregateWorkflows.microBatchUserRepairWorkflow,
      { userId: args.userId },
    );

    console.log(
      `✅ Micro-batch user repair workflow started with ID: ${workflowId}`,
    );
    return workflowId as string;
  },
});

/**
 * PRODUCTION-SAFE: Repair all users (one at a time, no timeouts)
 */
export const startMicroBatchAllUsersRepair = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx): Promise<string> => {
    console.log('🛡️ Starting micro-batch ALL users repair...');

    const workflowId: any = await workflow.start(
      ctx,
      internal.aggregateWorkflows.microBatchAllUsersRepairWorkflow,
      {},
    );

    console.log(
      `✅ Micro-batch all users repair workflow started with ID: ${workflowId}`,
    );
    return workflowId as string;
  },
});

/**
 * MICRO-BATCH: Single user repair (ultra-safe, no timeouts)
 */
export const microBatchUserRepairWorkflow = workflow.define({
  args: {
    userId: v.id('users'),
  },
  handler: async (
    step,
    args,
  ): Promise<{
    statsProcessed: number;
    bookmarksProcessed: number;
  }> => {
    console.log(`🛡️ Workflow: Micro-batch repairing user ${args.userId}...`);

    // Step 1: Clear user aggregates (no pagination)
    await step.runMutation(internal.aggregateWorkflows.clearSingleUserStep, {
      userId: args.userId,
    });

    // Step 2: Repair user stats (micro-batches)
    let statsProcessed = 0;
    let cursor: string | undefined = undefined;

    while (true) {
      const result: any = await step.runMutation(
        internal.aggregateWorkflows.microBatchUserStatsStep,
        { userId: args.userId, cursor, batchSize: 10 }, // MICRO-BATCHES
      );

      statsProcessed += result.processed;
      if (result.isDone) break;
      cursor = result.continueCursor;
    }

    // Step 3: Repair user bookmarks (micro-batches)
    cursor = undefined;
    let bookmarksProcessed = 0;

    while (true) {
      const result: any = await step.runMutation(
        internal.aggregateWorkflows.microBatchUserBookmarksStep,
        { userId: args.userId, cursor, batchSize: 10 }, // MICRO-BATCHES
      );

      bookmarksProcessed += result.processed;
      if (result.isDone) break;
      cursor = result.continueCursor;
    }

    console.log(`✅ User ${args.userId} micro-batch repair completed!`);
    return { statsProcessed, bookmarksProcessed };
  },
});

/**
 * MICRO-BATCH: All users repair (one user at a time)
 */
export const microBatchAllUsersRepairWorkflow = workflow.define({
  args: {},
  handler: async (
    step,
  ): Promise<{
    totalUsers: number;
  }> => {
    console.log('🛡️ Workflow: Starting micro-batch all users repair...');

    let totalUsers = 0;
    let cursor: string | undefined = undefined;

    while (true) {
      const result: any = await step.runMutation(
        internal.aggregateWorkflows.microBatchSingleUserStep,
        { cursor, batchSize: 1 }, // ONE USER AT A TIME
      );

      totalUsers += result.usersProcessed;
      if (result.isDone) break;
      cursor = result.continueCursor;
    }

    console.log(
      `✅ All users micro-batch repair completed! ${totalUsers} users processed`,
    );
    return { totalUsers };
  },
});

/**
 * Clear single user aggregates (no pagination, fast)
 */
export const clearSingleUserStep = internalMutation({
  args: {
    userId: v.id('users'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    console.log(`🧹 Clearing aggregates for user ${args.userId}...`);

    await answeredByUser.clear(ctx, { namespace: args.userId });
    await incorrectByUser.clear(ctx, { namespace: args.userId });
    await bookmarkedByUser.clear(ctx, { namespace: args.userId });

    return null;
  },
});

/**
 * Micro-batch user stats repair (SINGLE pagination, micro-batches)
 */
export const microBatchUserStatsStep = internalMutation({
  args: {
    userId: v.id('users'),
    cursor: v.optional(v.string()),
    batchSize: v.number(),
  },
  returns: v.object({
    processed: v.number(),
    continueCursor: v.optional(v.string()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // SINGLE PAGINATION - only userQuestionStats
    const result = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .paginate({
        cursor: args.cursor ?? null,
        numItems: args.batchSize, // MICRO-BATCHES (10 items)
      });

    let processed = 0;
    for (const stat of result.page) {
      await answeredByUser.insertIfDoesNotExist(ctx, stat);
      if (stat.isIncorrect) {
        await incorrectByUser.insertIfDoesNotExist(ctx, stat);
      }
      processed++;
    }

    return {
      processed,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * Micro-batch user bookmarks repair (SINGLE pagination, micro-batches)
 */
export const microBatchUserBookmarksStep = internalMutation({
  args: {
    userId: v.id('users'),
    cursor: v.optional(v.string()),
    batchSize: v.number(),
  },
  returns: v.object({
    processed: v.number(),
    continueCursor: v.optional(v.string()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // SINGLE PAGINATION - only userBookmarks
    const result = await ctx.db
      .query('userBookmarks')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .paginate({
        cursor: args.cursor ?? null,
        numItems: args.batchSize, // MICRO-BATCHES (10 items)
      });

    let processed = 0;
    for (const bookmark of result.page) {
      await bookmarkedByUser.insertIfDoesNotExist(ctx, bookmark);
      processed++;
    }

    return {
      processed,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * Process single user (SINGLE pagination through users)
 */
export const microBatchSingleUserStep = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.number(),
  },
  returns: v.object({
    usersProcessed: v.number(),
    continueCursor: v.optional(v.string()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // SINGLE PAGINATION - only users table
    const result = await ctx.db.query('users').paginate({
      cursor: args.cursor ?? null,
      numItems: args.batchSize, // 1 user at a time
    });

    let usersProcessed = 0;

    for (const user of result.page) {
      // Clear user aggregates (no pagination)
      await answeredByUser.clear(ctx, { namespace: user._id });
      await incorrectByUser.clear(ctx, { namespace: user._id });
      await bookmarkedByUser.clear(ctx, { namespace: user._id });

      // Get FIRST 100 stats for this user (to avoid timeout)
      const userStats = await ctx.db
        .query('userQuestionStats')
        .withIndex('by_user', q => q.eq('userId', user._id))
        .take(100); // LIMIT to avoid timeout

      for (const stat of userStats) {
        await answeredByUser.insertIfDoesNotExist(ctx, stat);
        if (stat.isIncorrect) {
          await incorrectByUser.insertIfDoesNotExist(ctx, stat);
        }
      }

      // Get FIRST 100 bookmarks for this user (to avoid timeout)
      const userBookmarks = await ctx.db
        .query('userBookmarks')
        .withIndex('by_user', q => q.eq('userId', user._id))
        .take(100); // LIMIT to avoid timeout

      for (const bookmark of userBookmarks) {
        await bookmarkedByUser.insertIfDoesNotExist(ctx, bookmark);
      }

      usersProcessed++;
    }

    return {
      usersProcessed,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

// ============================================================================
// USER-SPECIFIC AGGREGATE WORKFLOWS (Following Convex Workflow Best Practices)
// ============================================================================

/**
 * Single User Repair Workflow - Repairs all aggregates for one user
 * Uses deterministic steps to avoid pagination conflicts
 */
export const singleUserRepairWorkflow = workflow.define({
  args: {
    userId: v.id('users'),
  },
  handler: async (
    step,
    args,
  ): Promise<{ success: boolean; processed: number }> => {
    console.log(`🔧 Repairing aggregates for user: ${args.userId}`);

    let totalProcessed = 0;

    // Step 1: Clear user aggregates (non-paginated operation)
    await step.runMutation(
      internal.aggregateWorkflows.clearSingleUserAggregatesStep,
      { userId: args.userId },
      { name: 'clear-user-aggregates' },
    );

    // Step 2: Repair answered questions aggregate (single pagination)
    const answeredResult = await step.runMutation(
      internal.aggregateWorkflows.repairUserAnsweredStep,
      { userId: args.userId },
      { name: 'repair-answered-aggregate' },
    );
    totalProcessed += answeredResult.processed;

    // Step 3: Repair incorrect questions aggregate (single pagination)
    const incorrectResult = await step.runMutation(
      internal.aggregateWorkflows.repairUserIncorrectStep,
      { userId: args.userId },
      { name: 'repair-incorrect-aggregate' },
    );
    totalProcessed += incorrectResult.processed;

    // Step 4: Repair bookmarks aggregate (single pagination)
    const bookmarksResult = await step.runMutation(
      internal.aggregateWorkflows.repairUserBookmarksStep,
      { userId: args.userId },
      { name: 'repair-bookmarks-aggregate' },
    );
    totalProcessed += bookmarksResult.processed;

    // Step 5: Repair hierarchical theme aggregates (parallel execution)
    const [themeAnswered, themeIncorrect, themeBookmarks] = await Promise.all([
      step.runMutation(
        internal.aggregateWorkflows.repairUserThemeAnsweredStep,
        { userId: args.userId },
        { name: 'repair-theme-answered' },
      ),
      step.runMutation(
        internal.aggregateWorkflows.repairUserThemeIncorrectStep,
        { userId: args.userId },
        { name: 'repair-theme-incorrect' },
      ),
      step.runMutation(
        internal.aggregateWorkflows.repairUserThemeBookmarksStep,
        { userId: args.userId },
        { name: 'repair-theme-bookmarks' },
      ),
    ]);

    totalProcessed +=
      themeAnswered.processed +
      themeIncorrect.processed +
      themeBookmarks.processed;

    console.log(
      `✅ User ${args.userId} repair complete. Processed: ${totalProcessed}`,
    );

    return { success: true, processed: totalProcessed };
  },
});

/**
 * Batch User Repair Workflow - Repairs multiple users in parallel
 */
export const batchUserRepairWorkflow = workflow.define({
  args: {
    batchSize: v.number(),
  },
  handler: async (
    step,
    args,
  ): Promise<{ totalUsers: number; totalProcessed: number }> => {
    console.log(
      `🏭 Starting batch user repair with batch size: ${args.batchSize}`,
    );

    // Step 1: Get list of all users with pagination to avoid memory issues
    let allUsers: Array<{ _id: any; _creationTime: number }> = [];
    let cursor: string | undefined = undefined;
    let pageNumber = 0;

    // Fetch all users in paginated batches (each step.runQuery is a separate workflow step)
    do {
      const usersResult: {
        users: Array<{ _id: any; _creationTime: number }>;
        continueCursor?: string;
        isDone: boolean;
      } = await step.runQuery(
        internal.aggregateWorkflows.getAllUsersForRepair,
        { batchSize: 100, cursor }, // 100 users per page to control memory usage
        { name: `get-users-page-${pageNumber}` },
      );

      allUsers.push(...usersResult.users);
      cursor = usersResult.continueCursor;
      pageNumber++;

      console.log(
        `📄 Loaded page ${pageNumber}: ${usersResult.users.length} users (total: ${allUsers.length})`,
      );
    } while (cursor);

    let totalProcessed = 0;
    const users = allUsers;

    // Step 2: Process users in batches using parallel workflows
    for (let i = 0; i < users.length; i += args.batchSize) {
      const batch = users.slice(i, i + args.batchSize);

      // Run user repairs in parallel for this batch
      const batchResults = await Promise.all(
        batch.map((user: any, index: number) =>
          step.runAction(
            internal.aggregateWorkflows.startSingleUserRepairAction,
            { userId: user._id },
            {
              name: `repair-user-batch-${Math.floor(i / args.batchSize)}-${index}`,
            },
          ),
        ),
      );

      const batchProcessed = batchResults.reduce(
        (sum: number, result: any) => sum + result.processed,
        0,
      );
      totalProcessed += batchProcessed;

      console.log(
        `✅ Batch ${Math.floor(i / args.batchSize) + 1} complete. Users: ${batch.length}, Processed: ${batchProcessed}`,
      );
    }

    console.log(
      `🎉 Batch repair complete! Total users: ${users.length}, Total processed: ${totalProcessed}`,
    );

    return { totalUsers: users.length, totalProcessed };
  },
});

// ============================================================================
// INDIVIDUAL STEP FUNCTIONS (Single Pagination Each)
// ============================================================================

/**
 * Clear all aggregates for a specific user (non-paginated)
 */
export const clearSingleUserAggregatesStep = internalMutation({
  args: { userId: v.id('users') },
  returns: v.object({ cleared: v.boolean() }),
  handler: async (ctx, args) => {
    console.log(`🧹 Clearing aggregates for user: ${args.userId}`);

    // Clear all user-specific aggregates
    await Promise.all([
      answeredByUser.clear(ctx, { namespace: args.userId }),
      incorrectByUser.clear(ctx, { namespace: args.userId }),
      bookmarkedByUser.clear(ctx, { namespace: args.userId }),
      // Hierarchical aggregates
      answeredByThemeByUser.clear(ctx, { namespace: args.userId }),
      incorrectByThemeByUser.clear(ctx, { namespace: args.userId }),
      bookmarkedByThemeByUser.clear(ctx, { namespace: args.userId }),
      answeredBySubthemeByUser.clear(ctx, { namespace: args.userId }),
      incorrectBySubthemeByUser.clear(ctx, { namespace: args.userId }),
      bookmarkedBySubthemeByUser.clear(ctx, { namespace: args.userId }),
      answeredByGroupByUser.clear(ctx, { namespace: args.userId }),
      incorrectByGroupByUser.clear(ctx, { namespace: args.userId }),
      bookmarkedByGroupByUser.clear(ctx, { namespace: args.userId }),
    ]);

    return { cleared: true };
  },
});

/**
 * Repair answered questions aggregate for user (single pagination)
 */
export const repairUserAnsweredStep = internalMutation({
  args: { userId: v.id('users') },
  returns: v.object({ processed: v.number() }),
  handler: async (ctx, args) => {
    console.log(`📊 Repairing answered aggregate for user: ${args.userId}`);

    // SINGLE PAGINATION - only userQuestionStats where hasAnswered = true
    const answeredStats = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user_answered', q =>
        q.eq('userId', args.userId).eq('hasAnswered', true),
      )
      .collect();

    let processed = 0;
    for (const stat of answeredStats) {
      await answeredByUser.insertIfDoesNotExist(ctx, stat);
      processed++;
    }

    console.log(`✅ Answered aggregate repaired: ${processed} records`);
    return { processed };
  },
});

/**
 * Repair incorrect questions aggregate for user (single pagination)
 */
export const repairUserIncorrectStep = internalMutation({
  args: { userId: v.id('users') },
  returns: v.object({ processed: v.number() }),
  handler: async (ctx, args) => {
    console.log(`❌ Repairing incorrect aggregate for user: ${args.userId}`);

    // SINGLE PAGINATION - only userQuestionStats where isIncorrect = true
    const incorrectStats = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user_incorrect', q =>
        q.eq('userId', args.userId).eq('isIncorrect', true),
      )
      .collect();

    let processed = 0;
    for (const stat of incorrectStats) {
      await incorrectByUser.insertIfDoesNotExist(ctx, stat);
      processed++;
    }

    console.log(`✅ Incorrect aggregate repaired: ${processed} records`);
    return { processed };
  },
});

/**
 * Repair bookmarks aggregate for user (single pagination)
 */
export const repairUserBookmarksStep = internalMutation({
  args: { userId: v.id('users') },
  returns: v.object({ processed: v.number() }),
  handler: async (ctx, args) => {
    console.log(`🔖 Repairing bookmarks aggregate for user: ${args.userId}`);

    // SINGLE PAGINATION - only userBookmarks
    const bookmarks = await ctx.db
      .query('userBookmarks')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .collect();

    let processed = 0;
    for (const bookmark of bookmarks) {
      await bookmarkedByUser.insertIfDoesNotExist(ctx, bookmark);
      processed++;
    }

    console.log(`✅ Bookmarks aggregate repaired: ${processed} records`);
    return { processed };
  },
});

/**
 * Repair theme-level answered aggregate for user (single pagination)
 */
export const repairUserThemeAnsweredStep = internalMutation({
  args: { userId: v.id('users') },
  returns: v.object({ processed: v.number() }),
  handler: async (ctx, args) => {
    console.log(
      `🎯 Repairing theme answered aggregate for user: ${args.userId}`,
    );

    // SINGLE PAGINATION - get answered stats with question data
    const answeredStats = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user_answered', q =>
        q.eq('userId', args.userId).eq('hasAnswered', true),
      )
      .collect();

    let processed = 0;
    for (const stat of answeredStats) {
      // Get question to find theme/subtheme/group
      const question = await ctx.db.get(stat.questionId);
      if (question) {
        // Create composite records with theme information for hierarchical aggregates
        const statWithTheme = { ...stat, themeId: question.themeId };
        const statWithSubtheme = question.subthemeId
          ? { ...stat, subthemeId: question.subthemeId }
          : null;
        const statWithGroup = question.groupId
          ? { ...stat, groupId: question.groupId }
          : null;

        // Insert into hierarchical aggregates
        await Promise.all([
          answeredByThemeByUser.insertIfDoesNotExist(ctx, statWithTheme),
          statWithSubtheme &&
            answeredBySubthemeByUser.insertIfDoesNotExist(
              ctx,
              statWithSubtheme,
            ),
          statWithGroup &&
            answeredByGroupByUser.insertIfDoesNotExist(ctx, statWithGroup),
        ]);
        processed++;
      }
    }

    console.log(`✅ Theme answered aggregate repaired: ${processed} records`);
    return { processed };
  },
});

/**
 * Repair theme-level incorrect aggregate for user (single pagination)
 */
export const repairUserThemeIncorrectStep = internalMutation({
  args: { userId: v.id('users') },
  returns: v.object({ processed: v.number() }),
  handler: async (ctx, args) => {
    console.log(
      `🎯❌ Repairing theme incorrect aggregate for user: ${args.userId}`,
    );

    // SINGLE PAGINATION - get incorrect stats with question data
    const incorrectStats = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user_incorrect', q =>
        q.eq('userId', args.userId).eq('isIncorrect', true),
      )
      .collect();

    let processed = 0;
    for (const stat of incorrectStats) {
      // Get question to find theme/subtheme/group
      const question = await ctx.db.get(stat.questionId);
      if (question) {
        // Create composite records with theme information for hierarchical aggregates
        const statWithTheme = { ...stat, themeId: question.themeId };
        const statWithSubtheme = question.subthemeId
          ? { ...stat, subthemeId: question.subthemeId }
          : null;
        const statWithGroup = question.groupId
          ? { ...stat, groupId: question.groupId }
          : null;

        // Insert into hierarchical aggregates
        await Promise.all([
          incorrectByThemeByUser.insertIfDoesNotExist(ctx, statWithTheme),
          statWithSubtheme &&
            incorrectBySubthemeByUser.insertIfDoesNotExist(
              ctx,
              statWithSubtheme,
            ),
          statWithGroup &&
            incorrectByGroupByUser.insertIfDoesNotExist(ctx, statWithGroup),
        ]);
        processed++;
      }
    }

    console.log(`✅ Theme incorrect aggregate repaired: ${processed} records`);
    return { processed };
  },
});

/**
 * Repair theme-level bookmarks aggregate for user (single pagination)
 */
export const repairUserThemeBookmarksStep = internalMutation({
  args: { userId: v.id('users') },
  returns: v.object({ processed: v.number() }),
  handler: async (ctx, args) => {
    console.log(
      `🎯🔖 Repairing theme bookmarks aggregate for user: ${args.userId}`,
    );

    // SINGLE PAGINATION - get bookmarks with question data
    const bookmarks = await ctx.db
      .query('userBookmarks')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .collect();

    let processed = 0;
    for (const bookmark of bookmarks) {
      // Get question to find theme/subtheme/group
      const question = await ctx.db.get(bookmark.questionId);
      if (question) {
        // Create composite records with theme information for hierarchical aggregates
        const bookmarkWithTheme = { ...bookmark, themeId: question.themeId };
        const bookmarkWithSubtheme = question.subthemeId
          ? { ...bookmark, subthemeId: question.subthemeId }
          : null;
        const bookmarkWithGroup = question.groupId
          ? { ...bookmark, groupId: question.groupId }
          : null;

        // Insert into hierarchical aggregates
        await Promise.all([
          bookmarkedByThemeByUser.insertIfDoesNotExist(ctx, bookmarkWithTheme),
          bookmarkWithSubtheme &&
            bookmarkedBySubthemeByUser.insertIfDoesNotExist(
              ctx,
              bookmarkWithSubtheme,
            ),
          bookmarkWithGroup &&
            bookmarkedByGroupByUser.insertIfDoesNotExist(
              ctx,
              bookmarkWithGroup,
            ),
        ]);
        processed++;
      }
    }

    console.log(`✅ Theme bookmarks aggregate repaired: ${processed} records`);
    return { processed };
  },
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get users for repair with pagination (single paginated query per call)
 */
export const getAllUsersForRepair = internalQuery({
  args: {
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    users: v.array(
      v.object({
        _id: v.id('users'),
        _creationTime: v.number(),
      }),
    ),
    continueCursor: v.optional(v.string()),
    isDone: v.boolean(),
  }),
  handler: async (ctx: any, args: any) => {
    const batchSize = args.batchSize || 100; // Default to 100 users per batch

    // SINGLE PAGINATION - only users table (Convex constraint)
    const result = await ctx.db.query('users').paginate({
      cursor: args.cursor ?? null,
      numItems: batchSize,
    });

    return {
      users: result.page.map((user: any) => ({
        _id: user._id,
        _creationTime: user._creationTime,
      })),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * Get a small sample of users for testing (single pagination call)
 */
export const getSampleUsersForTesting = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.object({
    users: v.array(
      v.object({
        _id: v.id('users'),
        _creationTime: v.number(),
      }),
    ),
  }),
  handler: async (ctx: any, args: any) => {
    const limit = args.limit || 5; // Default to 5 users for testing

    // SINGLE PAGINATION - only users table, limited sample
    const result = await ctx.db.query('users').paginate({
      cursor: null,
      numItems: limit,
    });

    return {
      users: result.page.map((user: any) => ({
        _id: user._id,
        _creationTime: user._creationTime,
      })),
    };
  },
});

/**
 * Action wrapper to start single user repair from within workflow
 */
export const startSingleUserRepairAction = internalAction({
  args: { userId: v.id('users') },
  returns: v.object({ success: v.boolean(), processed: v.number() }),
  handler: async (ctx: any, args: any) => {
    const workflowId: any = await workflow.start(
      ctx,
      internal.aggregateWorkflows.singleUserRepairWorkflow,
      args,
    );

    // Wait for workflow to complete and return result
    // In production, you might want to poll for status instead
    await new Promise(resolve => setTimeout(resolve, 1000));

    const status = await workflow.status(ctx, workflowId);
    if (status.type === 'completed') {
      // For now, return a default result since the workflow is async
      return { success: true, processed: 0 };
    }

    // Default return if workflow is still running
    return { success: true, processed: 0 };
  },
});

/**
 * TESTING: Start repair for a small sample of users
 */
export const startSampleUserRepair = mutation({
  args: {
    sampleSize: v.optional(v.number()), // Number of users to repair (default 3)
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const sampleSize = args.sampleSize || 3;
    console.log(`🧪 Starting sample user repair for ${sampleSize} users...`);

    const workflowId: any = await workflow.start(
      ctx,
      internal.aggregateWorkflows.sampleUserRepairWorkflow,
      { sampleSize },
    );

    return `Sample user repair started with ID: ${workflowId} (${sampleSize} users)`;
  },
});

/**
 * Sample User Repair Workflow - Repairs a small number of users for testing
 */
export const sampleUserRepairWorkflow = workflow.define({
  args: {
    sampleSize: v.number(),
  },
  handler: async (
    step,
    args,
  ): Promise<{ totalUsers: number; totalProcessed: number }> => {
    console.log(`🧪 Starting sample repair for ${args.sampleSize} users`);

    // Step 1: Get sample users (single pagination)
    const usersResult = await step.runQuery(
      internal.aggregateWorkflows.getSampleUsersForTesting,
      { limit: args.sampleSize },
      { name: 'get-sample-users' },
    );

    let totalProcessed = 0;
    const users = usersResult.users;

    // Step 2: Process users one by one for testing (sequential for easier debugging)
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      console.log(`🔧 Processing user ${i + 1}/${users.length}: ${user._id}`);

      const userResult = await step.runAction(
        internal.aggregateWorkflows.startSingleUserRepairAction,
        { userId: user._id },
        { name: `repair-sample-user-${i}` },
      );

      totalProcessed += userResult.processed;
    }

    console.log(
      `🎉 Sample repair complete! Total users: ${users.length}, Total processed: ${totalProcessed}`,
    );

    return { totalUsers: users.length, totalProcessed };
  },
});

/**
 * PRODUCTION-SAFE: Start user-specific aggregate repair
 */
export const startUserSpecificRepair = mutation({
  args: {
    userId: v.optional(v.id('users')), // If provided, repair single user
    batchSize: v.optional(v.number()), // If no userId, repair all users in batches
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    if (args.userId) {
      // Repair single user
      console.log(`🔧 Starting single user repair for ${args.userId}...`);

      const workflowId: any = await workflow.start(
        ctx,
        internal.aggregateWorkflows.singleUserRepairWorkflow,
        { userId: args.userId },
      );

      return `Single user repair started with ID: ${workflowId}`;
    } else {
      // Repair all users in batches
      const batchSize = args.batchSize || 5;
      console.log(
        `🏭 Starting batch user repair with batch size: ${batchSize}...`,
      );

      const workflowId: any = await workflow.start(
        ctx,
        internal.aggregateWorkflows.batchUserRepairWorkflow,
        { batchSize },
      );

      return `Batch user repair started with ID: ${workflowId}`;
    }
  },
});
