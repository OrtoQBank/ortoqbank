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

    console.log(`Workflow: User aggregates repair completed!`, finalCounts);
    return {
      answered: totalAnswered,
      incorrect: totalIncorrect,
      bookmarked: totalBookmarked,
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
  returns: v.null(),
  handler: async ctx => {
    console.log('Step: Clearing user aggregates...');

    // Get all users to clear their namespaces
    const users = await ctx.db.query('users').collect();

    for (const user of users) {
      await answeredByUser.clear(ctx, { namespace: user._id });
      await incorrectByUser.clear(ctx, { namespace: user._id });
      await bookmarkedByUser.clear(ctx, { namespace: user._id });
    }

    console.log(`Step: Cleared aggregates for ${users.length} users`);
    return null;
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

    const users = await ctx.db.query('users').collect();
    let totalAnswered = 0;
    let totalIncorrect = 0;
    let totalBookmarked = 0;

    for (const user of users) {
      const answered = await answeredByUser.count(ctx, {
        namespace: user._id,
        bounds: {},
      });
      const incorrect = await incorrectByUser.count(ctx, {
        namespace: user._id,
        bounds: {},
      });
      const bookmarked = await bookmarkedByUser.count(ctx, {
        namespace: user._id,
        bounds: {},
      });

      totalAnswered += answered;
      totalIncorrect += incorrect;
      totalBookmarked += bookmarked;
    }

    const result = {
      totalAnswered,
      totalIncorrect,
      totalBookmarked,
      userCount: users.length,
    };

    console.log(`Step: Final verification - User aggregates:`, result);
    return result;
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
