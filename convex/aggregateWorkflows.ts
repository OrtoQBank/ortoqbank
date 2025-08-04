// ============================================================================
// SIMPLE AGGREGATE WORKFLOWS
// ============================================================================

import { WorkflowManager } from '@convex-dev/workflow';
import { v } from 'convex/values';
import { components, internal, api } from './_generated/api';
import { mutation } from './_generated/server';

// Create the workflow manager
export const workflow = new WorkflowManager(components.workflow);

/**
 * Start simple user repair workflow
 */
export const startUserRepair = mutation({
  args: { userId: v.id('users') },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    console.log(`Starting user repair for ${args.userId}...`);

    const workflowId: any = await workflow.start(
      ctx,
      internal.aggregateWorkflows.userRepairWorkflow,
      { userId: args.userId },
    );

    console.log(`User repair workflow started with ID: ${workflowId}`);
    return workflowId as string;
  },
});

/**
 * Get workflow status
 */
export const getWorkflowStatus = mutation({
  args: { workflowId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const status = await workflow.status(ctx, args.workflowId as any);
    return status;
  },
});

/**
 * Simple user repair workflow
 */
export const userRepairWorkflow = workflow.define({
  args: { userId: v.id('users') },
  handler: async (
    step,
    args,
  ): Promise<{ success: boolean; processed: number }> => {
    console.log(`Workflow: Repairing aggregates for user ${args.userId}...`);

    // Step 1: Clear user aggregates
    await step.runMutation(internal.aggregateRepairs.clearUserAggregates, {
      userId: args.userId,
    });

    // Step 2: Repair basic aggregates
    const basicResult = await step.runMutation(
      internal.aggregateRepairs.repairUserBasicAggregates,
      {
        userId: args.userId,
      },
    );

    // Step 3: Repair hierarchical aggregates
    const hierarchicalResult = await step.runMutation(
      internal.aggregateRepairs.repairUserHierarchicalAggregates,
      {
        userId: args.userId,
      },
    );

    const totalProcessed =
      basicResult.answered +
      basicResult.incorrect +
      basicResult.bookmarked +
      hierarchicalResult.processed;

    console.log(
      `Workflow: User ${args.userId} repair completed. Processed: ${totalProcessed}`,
    );

    return { success: true, processed: totalProcessed };
  },
});
