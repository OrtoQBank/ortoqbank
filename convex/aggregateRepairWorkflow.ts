import { WorkflowManager } from '@convex-dev/workflow';
import { v } from 'convex/values';

import { components, internal } from './_generated/api';
import { internalMutation, mutation } from './_generated/server';
import {
  answeredByUser,
  bookmarkedByUser,
  incorrectByUser,
  questionCountByTheme,
  totalQuestionCount,
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
      internal.aggregateRepairWorkflow.repairWorkflow,
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
      internal.aggregateRepairWorkflow.repairUserAggregatesWorkflow,
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
    await step.runMutation(
      internal.aggregateRepairWorkflow.clearAggregatesStep,
      {},
    );

    // Step 2: Process questions in batches
    let cursor: string | undefined = undefined;
    let batchNumber = 1;

    while (true) {
      const result: any = await step.runMutation(
        internal.aggregateRepairWorkflow.processBatchStep,
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
      internal.aggregateRepairWorkflow.verifyCountStep,
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
      internal.aggregateRepairWorkflow.clearUserAggregatesStep,
      {},
    );

    // Step 2: Repair answered/incorrect aggregates from userQuestionStats
    let cursor: string | undefined = undefined;
    let batchNumber = 1;
    let totalAnswered = 0;
    let totalIncorrect = 0;

    while (true) {
      const result: any = await step.runMutation(
        internal.aggregateRepairWorkflow.processUserStatsBatchStep,
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
        internal.aggregateRepairWorkflow.processBookmarksBatchStep,
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
      internal.aggregateRepairWorkflow.verifyUserAggregatesStep,
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
