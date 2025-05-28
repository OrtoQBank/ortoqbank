/* eslint-disable unicorn/no-null */

import { WorkflowManager } from '@convex-dev/workflow';
import { v } from 'convex/values';

import { components, internal } from './_generated/api';
import { internalMutation, mutation } from './_generated/server';
import { questionCountByTheme, totalQuestionCount } from './aggregates';

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
