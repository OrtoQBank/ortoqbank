import { WorkflowManager } from '@convex-dev/workflow';
import { v } from 'convex/values';

import { components, internal, api } from './_generated/api';
import { internalMutation, mutation } from './_generated/server';
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
        `Discrepancy in incorrect count: loop=${loopTotals.incorrect}, verified=${finalCounts.totalIncorrect}`,
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
 * This is the recommended way to repair all aggregates in production
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
 * PRODUCTION OPTIMIZED REPAIR - Ultra-safe with micro-batches for large datasets
 */
export const startProductionRepair = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx): Promise<string> => {
    console.log(
      '🏭 Starting PRODUCTION-OPTIMIZED aggregate repair workflow...',
    );

    const workflowId: any = await workflow.start(
      ctx,
      internal.aggregateWorkflows.productionRepairWorkflow,
      {},
    );

    console.log(`✅ Production repair workflow started with ID: ${workflowId}`);
    return workflowId as string;
  },
});

/**
 * COMPREHENSIVE REPAIR WORKFLOW - Handles all aggregates with production-safe pagination
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

    // PHASE 1.5: Clear hierarchical user-specific aggregates
    await step.runMutation(
      internal.aggregateWorkflows.clearHierarchicalAggregatesStep,
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

    // PHASE 4.5: Repair hierarchical user-specific aggregates (paginated)
    cursor = undefined;
    batchNumber = 1;
    let hierarchicalStatsProcessed = 0;

    while (true) {
      const result: any = await step.runMutation(
        internal.aggregateWorkflows.processHierarchicalAggregatesBatchStep,
        { cursor, batchSize: 50 },
      );

      console.log(
        `🏗️ Workflow: Hierarchical batch ${batchNumber} completed - ${result.processed} stats processed`,
      );

      hierarchicalStatsProcessed += result.processed;

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
      hierarchicalStatsProcessed,
      finalCounts,
    });

    return {
      questionsProcessed,
      userStatsProcessed,
      bookmarksProcessed,
      hierarchicalStatsProcessed,
      totalUsers: finalCounts.userCount,
    };
  },
});

/**
 * PRODUCTION REPAIR WORKFLOW - Ultra-optimized for large datasets with micro-batches
 */
export const productionRepairWorkflow = workflow.define({
  args: {},
  handler: async (
    step,
  ): Promise<{
    questionsProcessed: number;
    userStatsProcessed: number;
    bookmarksProcessed: number;
    hierarchicalStatsProcessed: number;
    totalUsers: number;
    phases: string[];
  }> => {
    console.log(
      '🏭 Production Workflow: Starting ultra-safe aggregate repair...',
    );
    const phases: string[] = [];

    // PHASE 1: Clear aggregates in micro-chunks to avoid timeouts
    phases.push('clearing_aggregates');
    await step.runMutation(
      internal.aggregateWorkflows.productionClearAggregatesStep,
      { maxUsersPerBatch: 5 }, // Very small batches
    );

    // PHASE 2: Clear hierarchical aggregates in ultra-small chunks
    phases.push('clearing_hierarchical');
    await step.runMutation(
      internal.aggregateWorkflows.productionClearHierarchicalStep,
      { maxCombinationsPerBatch: 10 }, // Ultra-small chunks
    );

    // PHASE 3: Process questions with micro-batches
    phases.push('processing_questions');
    let questionsProcessed = 0;
    let cursor: string | undefined = undefined;
    let batchNumber = 1;

    while (true) {
      const result: any = await step.runMutation(
        internal.aggregateWorkflows.productionProcessQuestionsBatchStep,
        { cursor, batchSize: 5 }, // Micro-batches for production
      );

      console.log(
        `🏭 Production: Questions micro-batch ${batchNumber} - ${result.processed} questions`,
      );

      questionsProcessed += result.processed;
      if (result.isDone) break;
      cursor = result.continueCursor;
      batchNumber++;
    }

    // PHASE 4: Process user stats with micro-batches
    phases.push('processing_user_stats');
    cursor = undefined;
    batchNumber = 1;
    let userStatsProcessed = 0;

    while (true) {
      const result: any = await step.runMutation(
        internal.aggregateWorkflows.productionProcessUserStatsBatchStep,
        { cursor, batchSize: 5 }, // Micro-batches
      );

      console.log(
        `🏭 Production: User stats micro-batch ${batchNumber} - ${result.processed} stats`,
      );

      userStatsProcessed += result.processed;
      if (result.isDone) break;
      cursor = result.continueCursor;
      batchNumber++;
    }

    // PHASE 5: Process bookmarks with micro-batches
    phases.push('processing_bookmarks');
    cursor = undefined;
    batchNumber = 1;
    let bookmarksProcessed = 0;

    while (true) {
      const result: any = await step.runMutation(
        internal.aggregateWorkflows.productionProcessBookmarksBatchStep,
        { cursor, batchSize: 5 }, // Micro-batches
      );

      console.log(
        `🏭 Production: Bookmarks micro-batch ${batchNumber} - ${result.processed} bookmarks`,
      );

      bookmarksProcessed += result.processed;
      if (result.isDone) break;
      cursor = result.continueCursor;
      batchNumber++;
    }

    // PHASE 6: Process hierarchical aggregates with ultra-micro-batches
    phases.push('processing_hierarchical');
    cursor = undefined;
    batchNumber = 1;
    let hierarchicalStatsProcessed = 0;

    while (true) {
      const result: any = await step.runMutation(
        internal.aggregateWorkflows.productionProcessHierarchicalBatchStep,
        { cursor, batchSize: 3 }, // Ultra-micro-batches
      );

      console.log(
        `🏭 Production: Hierarchical micro-batch ${batchNumber} - ${result.processed} stats`,
      );

      hierarchicalStatsProcessed += result.processed;
      if (result.isDone) break;
      cursor = result.continueCursor;
      batchNumber++;
    }

    // PHASE 7: Quick verification with sampling
    phases.push('verification');
    const finalCounts: any = await step.runMutation(
      internal.aggregateWorkflows.productionVerifyStep,
      {},
    );

    console.log('🏭 Production Workflow: Ultra-safe repair completed!', {
      questionsProcessed,
      userStatsProcessed,
      bookmarksProcessed,
      hierarchicalStatsProcessed,
      finalCounts,
      phases,
    });

    return {
      questionsProcessed,
      userStatsProcessed,
      bookmarksProcessed,
      hierarchicalStatsProcessed,
      totalUsers: finalCounts.userCount,
      phases,
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

/**
 * EMERGENCY REPAIR - Quick user stats repair for specific user (production-safe)
 */
export const emergencyRepairUserStats = mutation({
  args: {
    userId: v.id('users'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    console.log(`🚨 Emergency: Repairing user stats for ${args.userId}...`);

    // Clear user aggregates
    await answeredByUser.clear(ctx, { namespace: args.userId });
    await incorrectByUser.clear(ctx, { namespace: args.userId });
    await bookmarkedByUser.clear(ctx, { namespace: args.userId });

    // Rebuild stats in batches
    let cursor: string | null = null;
    let statsProcessed = 0;
    const batchSize = 100;

    while (true) {
      const result = await ctx.db
        .query('userQuestionStats')
        .withIndex('by_user', q => q.eq('userId', args.userId))
        .paginate({
          cursor,
          numItems: batchSize,
        });

      for (const stat of result.page) {
        await answeredByUser.insertIfDoesNotExist(ctx, stat);
        if (stat.isIncorrect) {
          await incorrectByUser.insertIfDoesNotExist(ctx, stat);
        }
        statsProcessed++;
      }

      if (result.isDone) break;
      cursor = result.continueCursor;
    }

    // Rebuild bookmarks
    cursor = null;
    let bookmarksProcessed = 0;

    while (true) {
      const result = await ctx.db
        .query('userBookmarks')
        .withIndex('by_user', q => q.eq('userId', args.userId))
        .paginate({
          cursor,
          numItems: batchSize,
        });

      for (const bookmark of result.page) {
        await bookmarkedByUser.insertIfDoesNotExist(ctx, bookmark);
        bookmarksProcessed++;
      }

      if (result.isDone) break;
      cursor = result.continueCursor;
    }

    console.log(
      `✅ Emergency user repair completed! Stats: ${statsProcessed}, Bookmarks: ${bookmarksProcessed}`,
    );
    return null;
  },
});

// ============================================================================
// HIERARCHICAL AGGREGATE REPAIR STEPS
// ============================================================================

/**
 * CLEAR HIERARCHICAL AGGREGATES STEP - Clear all hierarchical user-specific aggregates
 */
export const clearHierarchicalAggregatesStep = internalMutation({
  args: {},
  returns: v.object({
    totalCombinationsCleared: v.number(),
  }),
  handler: async ctx => {
    console.log('🧹 Step: Clearing hierarchical user-specific aggregates...');

    let totalCombinationsCleared = 0;

    // Get all users, themes, subthemes, and groups to clear all possible combinations
    const [users, themes, subthemes, groups] = await Promise.all([
      ctx.db.query('users').collect(),
      ctx.db.query('themes').collect(),
      ctx.db.query('subthemes').collect(),
      ctx.db.query('groups').collect(),
    ]);

    console.log(
      `🧹 Found ${users.length} users, ${themes.length} themes, ${subthemes.length} subthemes, ${groups.length} groups`,
    );

    // Clear theme-level hierarchical aggregates
    for (const user of users) {
      for (const theme of themes) {
        const namespace = `${user._id}_${theme._id}`;
        try {
          await incorrectByThemeByUser.clear(ctx, { namespace });
          await bookmarkedByThemeByUser.clear(ctx, { namespace });
          await answeredByThemeByUser.clear(ctx, { namespace });
          totalCombinationsCleared += 3;
        } catch (error) {
          // Ignore errors for non-existent namespaces
        }
      }
    }

    // Clear subtheme-level hierarchical aggregates
    for (const user of users) {
      for (const subtheme of subthemes) {
        const namespace = `${user._id}_${subtheme._id}`;
        try {
          await incorrectBySubthemeByUser.clear(ctx, { namespace });
          await bookmarkedBySubthemeByUser.clear(ctx, { namespace });
          await answeredBySubthemeByUser.clear(ctx, { namespace });
          totalCombinationsCleared += 3;
        } catch (error) {
          // Ignore errors for non-existent namespaces
        }
      }
    }

    // Clear group-level hierarchical aggregates
    for (const user of users) {
      for (const group of groups) {
        const namespace = `${user._id}_${group._id}`;
        try {
          await incorrectByGroupByUser.clear(ctx, { namespace });
          await bookmarkedByGroupByUser.clear(ctx, { namespace });
          await answeredByGroupByUser.clear(ctx, { namespace });
          totalCombinationsCleared += 3;
        } catch (error) {
          // Ignore errors for non-existent namespaces
        }
      }
    }

    console.log(
      `✅ Step: Cleared ${totalCombinationsCleared} hierarchical aggregate combinations`,
    );
    return { totalCombinationsCleared };
  },
});

/**
 * PROCESS HIERARCHICAL AGGREGATES BATCH - Repair hierarchical user-specific aggregates from userQuestionStats
 */
export const processHierarchicalAggregatesBatchStep = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.number(),
  },
  returns: v.object({
    processed: v.number(),
    hierarchicalInserts: v.number(),
    continueCursor: v.optional(v.string()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    console.log(
      `🏗️ Step: Processing batch of ${args.batchSize} userQuestionStats for hierarchical aggregates...`,
    );

    const result = await ctx.db.query('userQuestionStats').paginate({
      cursor: args.cursor ?? null,
      numItems: args.batchSize,
    });

    let processed = 0;
    let hierarchicalInserts = 0;

    for (const stat of result.page) {
      // Get the question to find theme/subtheme/group IDs
      const question = await ctx.db.get(stat.questionId);
      if (!question) continue;

      // Insert into hierarchical answered aggregates (all stats represent answered questions)
      if (question.themeId) {
        const compositeAnsweredStat = { ...stat, themeId: question.themeId };
        try {
          await answeredByThemeByUser.insertIfDoesNotExist(
            ctx,
            compositeAnsweredStat,
          );
          hierarchicalInserts++;
        } catch (error) {
          console.warn(
            `Failed to insert answered stat for theme ${question.themeId}:`,
            error,
          );
        }
      }
      if (question.subthemeId) {
        const compositeAnsweredStat = {
          ...stat,
          subthemeId: question.subthemeId,
        };
        try {
          await answeredBySubthemeByUser.insertIfDoesNotExist(
            ctx,
            compositeAnsweredStat,
          );
          hierarchicalInserts++;
        } catch (error) {
          console.warn(
            `Failed to insert answered stat for subtheme ${question.subthemeId}:`,
            error,
          );
        }
      }
      if (question.groupId) {
        const compositeAnsweredStat = { ...stat, groupId: question.groupId };
        try {
          await answeredByGroupByUser.insertIfDoesNotExist(
            ctx,
            compositeAnsweredStat,
          );
          hierarchicalInserts++;
        } catch (error) {
          console.warn(
            `Failed to insert answered stat for group ${question.groupId}:`,
            error,
          );
        }
      }

      // Insert into hierarchical incorrect aggregates if the answer was incorrect
      if (stat.isIncorrect) {
        if (question.themeId) {
          const compositeIncorrectStat = { ...stat, themeId: question.themeId };
          try {
            await incorrectByThemeByUser.insertIfDoesNotExist(
              ctx,
              compositeIncorrectStat,
            );
            hierarchicalInserts++;
          } catch (error) {
            console.warn(
              `Failed to insert incorrect stat for theme ${question.themeId}:`,
              error,
            );
          }
        }
        if (question.subthemeId) {
          const compositeIncorrectStat = {
            ...stat,
            subthemeId: question.subthemeId,
          };
          try {
            await incorrectBySubthemeByUser.insertIfDoesNotExist(
              ctx,
              compositeIncorrectStat,
            );
            hierarchicalInserts++;
          } catch (error) {
            console.warn(
              `Failed to insert incorrect stat for subtheme ${question.subthemeId}:`,
              error,
            );
          }
        }
        if (question.groupId) {
          const compositeIncorrectStat = { ...stat, groupId: question.groupId };
          try {
            await incorrectByGroupByUser.insertIfDoesNotExist(
              ctx,
              compositeIncorrectStat,
            );
            hierarchicalInserts++;
          } catch (error) {
            console.warn(
              `Failed to insert incorrect stat for group ${question.groupId}:`,
              error,
            );
          }
        }
      }

      processed++;
    }

    // Also process bookmarks for the same questions
    for (const stat of result.page) {
      // Check if this question is bookmarked by this user
      const bookmark = await ctx.db
        .query('userBookmarks')
        .withIndex('by_user_question', q =>
          q.eq('userId', stat.userId).eq('questionId', stat.questionId),
        )
        .first();

      if (bookmark) {
        const question = await ctx.db.get(stat.questionId);
        if (!question) continue;

        // Insert into hierarchical bookmarked aggregates
        if (question.themeId) {
          const compositeBookmark = { ...bookmark, themeId: question.themeId };
          await bookmarkedByThemeByUser.insertIfDoesNotExist(
            ctx,
            compositeBookmark,
          );
          hierarchicalInserts++;
        }
        if (question.subthemeId) {
          const compositeBookmark = {
            ...bookmark,
            subthemeId: question.subthemeId,
          };
          await bookmarkedBySubthemeByUser.insertIfDoesNotExist(
            ctx,
            compositeBookmark,
          );
          hierarchicalInserts++;
        }
        if (question.groupId) {
          const compositeBookmark = { ...bookmark, groupId: question.groupId };
          await bookmarkedByGroupByUser.insertIfDoesNotExist(
            ctx,
            compositeBookmark,
          );
          hierarchicalInserts++;
        }
      }
    }

    console.log(
      `✅ Step: Processed ${processed} stats, made ${hierarchicalInserts} hierarchical inserts. Done: ${result.isDone}`,
    );

    return {
      processed,
      hierarchicalInserts,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

// ============================================================================
// PRODUCTION-SPECIFIC STEP FUNCTIONS (Ultra-optimized for large datasets)
// ============================================================================

/**
 * PRODUCTION CLEAR AGGREGATES - Clear with ultra-small batches
 */
export const productionClearAggregatesStep = internalMutation({
  args: {
    maxUsersPerBatch: v.number(),
  },
  returns: v.object({
    totalUsersCleared: v.number(),
    batchesProcessed: v.number(),
  }),
  handler: async (ctx, args) => {
    console.log(
      '🧹 Production Step: Clearing aggregates with micro-batches...',
    );

    // Clear global aggregates first
    await totalQuestionCount.clear(ctx, { namespace: 'global' });
    await randomQuestions.clear(ctx, { namespace: 'global' });
    console.log('✅ Cleared global aggregates');

    // Clear user aggregates in micro-batches
    let cursor: string | null = null;
    let totalUsersCleared = 0;
    let batchesProcessed = 0;

    while (true) {
      const result = await ctx.db.query('users').paginate({
        cursor,
        numItems: args.maxUsersPerBatch,
      });

      for (const user of result.page) {
        await answeredByUser.clear(ctx, { namespace: user._id });
        await incorrectByUser.clear(ctx, { namespace: user._id });
        await bookmarkedByUser.clear(ctx, { namespace: user._id });
        totalUsersCleared++;
      }

      batchesProcessed++;
      console.log(
        `🧹 Production: Cleared batch ${batchesProcessed} - ${result.page.length} users (total: ${totalUsersCleared})`,
      );

      if (result.isDone) break;
      cursor = result.continueCursor;
    }

    return { totalUsersCleared, batchesProcessed };
  },
});

/**
 * PRODUCTION CLEAR HIERARCHICAL - Clear hierarchical aggregates in ultra-small chunks
 */
export const productionClearHierarchicalStep = internalMutation({
  args: {
    maxCombinationsPerBatch: v.number(),
  },
  returns: v.object({
    totalCombinationsCleared: v.number(),
    userBatchesProcessed: v.number(),
  }),
  handler: async (ctx, args) => {
    console.log('🧹 Production Step: Clearing hierarchical aggregates...');

    let totalCombinationsCleared = 0;
    let userBatchesProcessed = 0;

    // Process users in small batches to avoid timeouts
    let userCursor: string | null = null;

    while (true) {
      const userResult = await ctx.db.query('users').paginate({
        cursor: userCursor,
        numItems: Math.max(1, Math.floor(args.maxCombinationsPerBatch / 10)), // Even smaller user batches
      });

      if (userResult.page.length === 0) break;

      // For each user batch, clear their hierarchical aggregates
      for (const user of userResult.page) {
        // Clear theme-level aggregates for this user
        const themes = await ctx.db.query('themes').take(100); // Limit themes per iteration
        for (const theme of themes) {
          const namespace = `${user._id}_${theme._id}`;
          try {
            await incorrectByThemeByUser.clear(ctx, { namespace });
            await bookmarkedByThemeByUser.clear(ctx, { namespace });
            await answeredByThemeByUser.clear(ctx, { namespace });
            totalCombinationsCleared += 3;
          } catch (error) {
            // Ignore errors for non-existent namespaces
          }
        }
      }

      userBatchesProcessed++;
      console.log(
        `🧹 Production: Cleared hierarchical batch ${userBatchesProcessed} - ${userResult.page.length} users`,
      );

      if (userResult.isDone) break;
      userCursor = userResult.continueCursor;
    }

    return { totalCombinationsCleared, userBatchesProcessed };
  },
});

/**
 * PRODUCTION PROCESS QUESTIONS - Handle questions with micro-batches
 */
export const productionProcessQuestionsBatchStep = internalMutation({
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
    console.log(
      `🏭 Production Step: Processing ${args.batchSize} questions...`,
    );

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

    return {
      processed,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * PRODUCTION PROCESS USER STATS - Handle user stats with micro-batches
 */
export const productionProcessUserStatsBatchStep = internalMutation({
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
      `🏭 Production Step: Processing ${args.batchSize} user stats...`,
    );

    const result = await ctx.db.query('userQuestionStats').paginate({
      cursor: args.cursor ?? null,
      numItems: args.batchSize,
    });

    let processed = 0;
    let answeredCount = 0;
    let incorrectCount = 0;

    for (const stat of result.page) {
      await answeredByUser.insertIfDoesNotExist(ctx, stat);
      answeredCount++;

      if (stat.isIncorrect) {
        await incorrectByUser.insertIfDoesNotExist(ctx, stat);
        incorrectCount++;
      }

      processed++;
    }

    return {
      processed,
      answeredCount,
      incorrectCount,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * PRODUCTION PROCESS BOOKMARKS - Handle bookmarks with micro-batches
 */
export const productionProcessBookmarksBatchStep = internalMutation({
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
    console.log(
      `🏭 Production Step: Processing ${args.batchSize} bookmarks...`,
    );

    const result = await ctx.db.query('userBookmarks').paginate({
      cursor: args.cursor ?? null,
      numItems: args.batchSize,
    });

    let processed = 0;
    let bookmarkedCount = 0;

    for (const bookmark of result.page) {
      await bookmarkedByUser.insertIfDoesNotExist(ctx, bookmark);
      bookmarkedCount++;
      processed++;
    }

    return {
      processed,
      bookmarkedCount,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * PRODUCTION PROCESS HIERARCHICAL - Handle hierarchical aggregates with ultra-micro-batches
 */
export const productionProcessHierarchicalBatchStep = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.number(),
  },
  returns: v.object({
    processed: v.number(),
    hierarchicalInserts: v.number(),
    continueCursor: v.optional(v.string()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    console.log(
      `🏭 Production Step: Processing ${args.batchSize} hierarchical stats...`,
    );

    const result = await ctx.db.query('userQuestionStats').paginate({
      cursor: args.cursor ?? null,
      numItems: args.batchSize,
    });

    let processed = 0;
    let hierarchicalInserts = 0;

    // Process all stats and bookmarks in a single loop to avoid multiple queries
    for (const stat of result.page) {
      const question = await ctx.db.get(stat.questionId);
      if (!question) continue;

      // Insert into hierarchical answered aggregates
      if (question.themeId) {
        const compositeAnsweredStat = { ...stat, themeId: question.themeId };
        try {
          await answeredByThemeByUser.insertIfDoesNotExist(
            ctx,
            compositeAnsweredStat,
          );
          hierarchicalInserts++;
        } catch (error) {
          console.warn(`Failed to insert answered stat for theme:`, error);
        }
      }

      if (question.subthemeId) {
        const compositeAnsweredStat = {
          ...stat,
          subthemeId: question.subthemeId,
        };
        try {
          await answeredBySubthemeByUser.insertIfDoesNotExist(
            ctx,
            compositeAnsweredStat,
          );
          hierarchicalInserts++;
        } catch (error) {
          console.warn(`Failed to insert answered stat for subtheme:`, error);
        }
      }

      if (question.groupId) {
        const compositeAnsweredStat = { ...stat, groupId: question.groupId };
        try {
          await answeredByGroupByUser.insertIfDoesNotExist(
            ctx,
            compositeAnsweredStat,
          );
          hierarchicalInserts++;
        } catch (error) {
          console.warn(`Failed to insert answered stat for group:`, error);
        }
      }

      // Insert into hierarchical incorrect aggregates if applicable
      if (stat.isIncorrect) {
        if (question.themeId) {
          const compositeIncorrectStat = { ...stat, themeId: question.themeId };
          try {
            await incorrectByThemeByUser.insertIfDoesNotExist(
              ctx,
              compositeIncorrectStat,
            );
            hierarchicalInserts++;
          } catch (error) {
            console.warn(`Failed to insert incorrect stat for theme:`, error);
          }
        }

        if (question.subthemeId) {
          const compositeIncorrectStat = {
            ...stat,
            subthemeId: question.subthemeId,
          };
          try {
            await incorrectBySubthemeByUser.insertIfDoesNotExist(
              ctx,
              compositeIncorrectStat,
            );
            hierarchicalInserts++;
          } catch (error) {
            console.warn(
              `Failed to insert incorrect stat for subtheme:`,
              error,
            );
          }
        }

        if (question.groupId) {
          const compositeIncorrectStat = { ...stat, groupId: question.groupId };
          try {
            await incorrectByGroupByUser.insertIfDoesNotExist(
              ctx,
              compositeIncorrectStat,
            );
            hierarchicalInserts++;
          } catch (error) {
            console.warn(`Failed to insert incorrect stat for group:`, error);
          }
        }
      }

      // Check if this question is bookmarked by this user (single query per stat)
      const bookmark = await ctx.db
        .query('userBookmarks')
        .withIndex('by_user_question', q =>
          q.eq('userId', stat.userId).eq('questionId', stat.questionId),
        )
        .first();

      if (bookmark) {
        // Insert into hierarchical bookmarked aggregates
        if (question.themeId) {
          const compositeBookmark = { ...bookmark, themeId: question.themeId };
          try {
            await bookmarkedByThemeByUser.insertIfDoesNotExist(
              ctx,
              compositeBookmark,
            );
            hierarchicalInserts++;
          } catch (error) {
            console.warn(`Failed to insert bookmark for theme:`, error);
          }
        }
        if (question.subthemeId) {
          const compositeBookmark = {
            ...bookmark,
            subthemeId: question.subthemeId,
          };
          try {
            await bookmarkedBySubthemeByUser.insertIfDoesNotExist(
              ctx,
              compositeBookmark,
            );
            hierarchicalInserts++;
          } catch (error) {
            console.warn(`Failed to insert bookmark for subtheme:`, error);
          }
        }
        if (question.groupId) {
          const compositeBookmark = { ...bookmark, groupId: question.groupId };
          try {
            await bookmarkedByGroupByUser.insertIfDoesNotExist(
              ctx,
              compositeBookmark,
            );
            hierarchicalInserts++;
          } catch (error) {
            console.warn(`Failed to insert bookmark for group:`, error);
          }
        }
      }

      processed++;
    }

    return {
      processed,
      hierarchicalInserts,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * PRODUCTION VERIFY - Quick verification with sampling for performance
 */
export const productionVerifyStep = internalMutation({
  args: {},
  returns: v.object({
    totalQuestions: v.number(),
    totalAnswered: v.number(),
    totalIncorrect: v.number(),
    totalBookmarked: v.number(),
    userCount: v.number(),
    sampleSize: v.number(),
  }),
  handler: async ctx => {
    console.log('🔍 Production Step: Quick verification with sampling...');

    // Verify global question count
    const totalQuestions = await totalQuestionCount.count(ctx, {
      namespace: 'global',
      bounds: {},
    });

    // Sample a smaller subset of users for verification to avoid timeouts
    const allUsers = await ctx.db.query('users').take(50); // Sample only first 50 users
    let totalAnswered = 0;
    let totalIncorrect = 0;
    let totalBookmarked = 0;

    // Use parallel processing for the sample
    const userCounts = await Promise.all(
      allUsers.map(async user => {
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
    }

    const result = {
      totalQuestions,
      totalAnswered,
      totalIncorrect,
      totalBookmarked,
      userCount: allUsers.length,
      sampleSize: 50,
    };

    console.log(
      '✅ Production Step: Verification completed (sampled):',
      result,
    );
    return result;
  },
});

// ============================================================================
// SEPARATE AGGREGATE REPAIR WORKFLOWS (By Category)
// ============================================================================

/**
 * 1. SIMPLE USER AGGREGATES REPAIR - Fastest and safest
 */
export const startSimpleUserAggregatesRepair = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx): Promise<string> => {
    console.log('👤 Starting Simple User Aggregates repair workflow...');

    const workflowId: any = await workflow.start(
      ctx,
      internal.aggregateWorkflows.simpleUserAggregatesWorkflow,
      {},
    );

    console.log(
      `✅ Simple User Aggregates workflow started with ID: ${workflowId}`,
    );
    return workflowId as string;
  },
});

/**
 * 2. QUESTION COUNT AGGREGATES REPAIR - Medium complexity
 */
export const startQuestionCountAggregatesRepair = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx): Promise<string> => {
    console.log('📊 Starting Question Count Aggregates repair workflow...');

    const workflowId: any = await workflow.start(
      ctx,
      internal.aggregateWorkflows.questionCountAggregatesWorkflow,
      {},
    );

    console.log(
      `✅ Question Count Aggregates workflow started with ID: ${workflowId}`,
    );
    return workflowId as string;
  },
});

/**
 * 3. RANDOM QUESTION AGGREGATES REPAIR - Medium complexity
 */
export const startRandomQuestionAggregatesRepair = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx): Promise<string> => {
    console.log('🎲 Starting Random Question Aggregates repair workflow...');

    const workflowId: any = await workflow.start(
      ctx,
      internal.aggregateWorkflows.randomQuestionAggregatesWorkflow,
      {},
    );

    console.log(
      `✅ Random Question Aggregates workflow started with ID: ${workflowId}`,
    );
    return workflowId as string;
  },
});

/**
 * 4. HIERARCHICAL USER AGGREGATES REPAIR - Most complex
 */
export const startHierarchicalUserAggregatesRepair = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx): Promise<string> => {
    console.log('🏗️ Starting Hierarchical User Aggregates repair workflow...');

    const workflowId: any = await workflow.start(
      ctx,
      internal.aggregateWorkflows.hierarchicalUserAggregatesWorkflow,
      {},
    );

    console.log(
      `✅ Hierarchical User Aggregates workflow started with ID: ${workflowId}`,
    );
    return workflowId as string;
  },
});

// ============================================================================
// WORKFLOW DEFINITIONS
// ============================================================================

/**
 * SIMPLE USER AGGREGATES WORKFLOW - answeredByUser, incorrectByUser, bookmarkedByUser
 */
export const simpleUserAggregatesWorkflow = workflow.define({
  args: {},
  handler: async (
    step,
  ): Promise<{ userStatsProcessed: number; bookmarksProcessed: number }> => {
    console.log('👤 Workflow: Starting Simple User Aggregates repair...');

    // Clear simple user aggregates
    await step.runMutation(
      internal.aggregateWorkflows.clearSimpleUserAggregatesStep,
      {},
    );

    // Process user stats
    let userStatsProcessed = 0;
    let cursor: string | undefined = undefined;
    let batchNumber = 1;

    while (true) {
      const result: any = await step.runMutation(
        internal.aggregateWorkflows.productionProcessUserStatsBatchStep,
        { cursor, batchSize: 10 },
      );

      console.log(
        `👤 User stats batch ${batchNumber} - ${result.processed} stats`,
      );
      userStatsProcessed += result.processed;

      if (result.isDone) break;
      cursor = result.continueCursor;
      batchNumber++;
    }

    // Process bookmarks
    cursor = undefined;
    batchNumber = 1;
    let bookmarksProcessed = 0;

    while (true) {
      const result: any = await step.runMutation(
        internal.aggregateWorkflows.productionProcessBookmarksBatchStep,
        { cursor, batchSize: 10 },
      );

      console.log(
        `👤 Bookmarks batch ${batchNumber} - ${result.processed} bookmarks`,
      );
      bookmarksProcessed += result.processed;

      if (result.isDone) break;
      cursor = result.continueCursor;
      batchNumber++;
    }

    console.log('✅ Simple User Aggregates repair completed!');
    return { userStatsProcessed, bookmarksProcessed };
  },
});

/**
 * QUESTION COUNT AGGREGATES WORKFLOW - totalQuestionCount, questionCountByTheme/Subtheme/Group
 */
export const questionCountAggregatesWorkflow = workflow.define({
  args: {},
  handler: async (step): Promise<{ questionsProcessed: number }> => {
    console.log('📊 Workflow: Starting Question Count Aggregates repair...');

    // Clear question count aggregates
    await step.runMutation(
      internal.aggregateWorkflows.clearQuestionCountAggregatesStep,
      {},
    );

    // Process questions
    let questionsProcessed = 0;
    let cursor: string | undefined = undefined;
    let batchNumber = 1;

    while (true) {
      const result: any = await step.runMutation(
        internal.aggregateWorkflows.processQuestionCountBatchStep,
        { cursor, batchSize: 15 },
      );

      console.log(
        `📊 Questions batch ${batchNumber} - ${result.processed} questions`,
      );
      questionsProcessed += result.processed;

      if (result.isDone) break;
      cursor = result.continueCursor;
      batchNumber++;
    }

    console.log('✅ Question Count Aggregates repair completed!');
    return { questionsProcessed };
  },
});

/**
 * RANDOM QUESTION AGGREGATES WORKFLOW - randomQuestions, randomQuestionsByTheme/Subtheme/Group
 */
export const randomQuestionAggregatesWorkflow = workflow.define({
  args: {},
  handler: async (step): Promise<{ questionsProcessed: number }> => {
    console.log('🎲 Workflow: Starting Random Question Aggregates repair...');

    // Clear random question aggregates
    await step.runMutation(
      internal.aggregateWorkflows.clearRandomQuestionAggregatesStep,
      {},
    );

    // Process questions
    let questionsProcessed = 0;
    let cursor: string | undefined = undefined;
    let batchNumber = 1;

    while (true) {
      const result: any = await step.runMutation(
        internal.aggregateWorkflows.processRandomQuestionBatchStep,
        { cursor, batchSize: 15 },
      );

      console.log(
        `🎲 Questions batch ${batchNumber} - ${result.processed} questions`,
      );
      questionsProcessed += result.processed;

      if (result.isDone) break;
      cursor = result.continueCursor;
      batchNumber++;
    }

    console.log('✅ Random Question Aggregates repair completed!');
    return { questionsProcessed };
  },
});

/**
 * HIERARCHICAL USER AGGREGATES WORKFLOW - All hierarchical user-specific aggregates
 */
export const hierarchicalUserAggregatesWorkflow = workflow.define({
  args: {},
  handler: async (step): Promise<{ hierarchicalStatsProcessed: number }> => {
    console.log('🏗️ Workflow: Starting Hierarchical User Aggregates repair...');

    // Clear hierarchical aggregates
    await step.runMutation(
      internal.aggregateWorkflows.clearHierarchicalAggregatesStep,
      {},
    );

    // Process hierarchical aggregates
    let hierarchicalStatsProcessed = 0;
    let cursor: string | undefined = undefined;
    let batchNumber = 1;

    while (true) {
      const result: any = await step.runMutation(
        internal.aggregateWorkflows.productionProcessHierarchicalBatchStep,
        { cursor, batchSize: 5 }, // Smaller batches for complex processing
      );

      console.log(
        `🏗️ Hierarchical batch ${batchNumber} - ${result.processed} stats`,
      );
      hierarchicalStatsProcessed += result.processed;

      if (result.isDone) break;
      cursor = result.continueCursor;
      batchNumber++;
    }

    console.log('✅ Hierarchical User Aggregates repair completed!');
    return { hierarchicalStatsProcessed };
  },
});

// ============================================================================
// SUPPORTING STEP FUNCTIONS FOR SEPARATE WORKFLOWS
// ============================================================================

/**
 * Clear simple user aggregates only
 */
export const clearSimpleUserAggregatesStep = internalMutation({
  args: {},
  returns: v.object({
    totalUsersCleared: v.number(),
  }),
  handler: async ctx => {
    console.log('🧹 Step: Clearing simple user aggregates...');

    let cursor: string | null = null;
    let totalUsersCleared = 0;
    const batchSize = 10;

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

      if (result.isDone) break;
      cursor = result.continueCursor;
    }

    console.log(
      `✅ Cleared simple user aggregates for ${totalUsersCleared} users`,
    );
    return { totalUsersCleared };
  },
});

/**
 * Clear question count aggregates only
 */
export const clearQuestionCountAggregatesStep = internalMutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    console.log('🧹 Step: Clearing question count aggregates...');

    // Clear all question count aggregates
    await totalQuestionCount.clear(ctx, { namespace: 'global' });

    // Clear theme-based counts
    const themes = await ctx.db.query('themes').collect();
    for (const theme of themes) {
      await questionCountByTheme.clear(ctx, { namespace: theme._id });
    }

    // Clear subtheme and group counts (using namespace pattern)
    const subthemes = await ctx.db.query('subthemes').collect();
    for (const subtheme of subthemes) {
      await questionCountBySubtheme.clear(ctx, { namespace: subtheme._id });
    }

    const groups = await ctx.db.query('groups').collect();
    for (const group of groups) {
      await questionCountByGroup.clear(ctx, { namespace: group._id });
    }

    console.log('✅ Cleared all question count aggregates');
    return null;
  },
});

/**
 * Clear random question aggregates only
 */
export const clearRandomQuestionAggregatesStep = internalMutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    console.log('🧹 Step: Clearing random question aggregates...');

    // Clear global random questions
    await randomQuestions.clear(ctx, { namespace: 'global' });

    // Clear theme-based random questions
    const themes = await ctx.db.query('themes').collect();
    for (const theme of themes) {
      await randomQuestionsByTheme.clear(ctx, { namespace: theme._id });
    }

    // Clear subtheme and group random questions
    const subthemes = await ctx.db.query('subthemes').collect();
    for (const subtheme of subthemes) {
      await randomQuestionsBySubtheme.clear(ctx, { namespace: subtheme._id });
    }

    const groups = await ctx.db.query('groups').collect();
    for (const group of groups) {
      await randomQuestionsByGroup.clear(ctx, { namespace: group._id });
    }

    console.log('✅ Cleared all random question aggregates');
    return null;
  },
});

/**
 * Process questions for count aggregates only
 */
export const processQuestionCountBatchStep = internalMutation({
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
    console.log(
      `📊 Step: Processing ${args.batchSize} questions for count aggregates...`,
    );

    const result = await ctx.db.query('questions').paginate({
      cursor: args.cursor ?? null,
      numItems: args.batchSize,
    });

    let processed = 0;
    for (const question of result.page) {
      // Insert into count aggregates
      await totalQuestionCount.insertIfDoesNotExist(ctx, question);

      if (question.themeId) {
        await questionCountByTheme.insertIfDoesNotExist(ctx, question);
      }
      if (question.subthemeId) {
        await questionCountBySubtheme.insertIfDoesNotExist(ctx, question);
      }
      if (question.groupId) {
        await questionCountByGroup.insertIfDoesNotExist(ctx, question);
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
 * Process questions for random aggregates only
 */
export const processRandomQuestionBatchStep = internalMutation({
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
    console.log(
      `🎲 Step: Processing ${args.batchSize} questions for random aggregates...`,
    );

    const result = await ctx.db.query('questions').paginate({
      cursor: args.cursor ?? null,
      numItems: args.batchSize,
    });

    let processed = 0;
    for (const question of result.page) {
      // Insert into random aggregates
      await randomQuestions.insertIfDoesNotExist(ctx, question);
      await randomQuestionsByTheme.insertIfDoesNotExist(ctx, question);

      if (question.subthemeId) {
        await randomQuestionsBySubtheme.insertIfDoesNotExist(ctx, question);
      }
      if (question.groupId) {
        await randomQuestionsByGroup.insertIfDoesNotExist(ctx, question);
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
