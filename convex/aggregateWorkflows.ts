// ============================================================================
// PRODUCTION-SAFE AGGREGATE REPAIR WORKFLOWS (15-SECOND COMPLIANT)
// ============================================================================
//
// This system is designed to repair aggregates efficiently within Convex's
// 15-second mutation limit using proper pagination and workflow orchestration.
//
// KEY FEATURES:
// - All mutations complete within 15-second limit
// - Proper pagination (not .collect() on large datasets)
// - Step-by-step progress tracking
// - Production-safe batch processing
// - Hierarchical processing (themes, subthemes, groups)
// - User-specific aggregate processing in small batches
//
// USAGE:
// - Individual sections: startSection1Repair(), startSection2Repair(), startSection3Repair()
// - Complete repair: startComprehensiveRepair()
// - Legacy single user: startUserRepair(userId)
//
// Based on Convex Workflow component: https://www.convex.dev/components/workflow
// ============================================================================

import { WorkflowManager } from '@convex-dev/workflow';
import { v } from 'convex/values';

import { api, components, internal } from './_generated/api';
import { internalMutation, mutation } from './_generated/server';

// Create the workflow manager
export const workflow = new WorkflowManager(components.workflow);

/**
 * Initiate simple user repair workflow
 */
export const initiateUserRepair = internalMutation({
  args: { userId: v.id('users') },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    console.log(`Starting user repair for ${args.userId}...`);

    const workflowId: any = await workflow.start(
      ctx,
      internal.aggregateWorkflows.userRepairInternalWorkflow,
      { userId: args.userId },
    );

    console.log(`User repair workflow started with ID: ${workflowId}`);
    return workflowId as string;
  },
});

/**
 * Get workflow status
 */
export const getWorkflowStatus = internalMutation({
  args: { workflowId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const status = await workflow.status(ctx, args.workflowId as any);
    return status;
  },
});

/**
 * Simple user repair internal workflow
 */
export const userRepairInternalWorkflow = workflow.define({
  args: { userId: v.id('users') },
  handler: async (
    step,
    args,
  ): Promise<{ success: boolean; processed: number }> => {
    console.log(`Workflow: Repairing aggregates for user ${args.userId}...`);

    // Step 1: Clear user aggregates
    await step.runMutation(
      internal.aggregateRepairs.internalRepairClearUserAggregates,
      {
        userId: args.userId,
      },
    );

    // Step 2: Repair basic aggregates with pagination
    let basicCursor: string | null = null;
    let basicProcessed = 0;
    let basicBatchCount = 0;
    let basicResult = { answered: 0, incorrect: 0, bookmarked: 0 };

    do {
      const batchResult: {
        processed: number;
        answered: number;
        incorrect: number;
        bookmarked: number;
        nextCursor: string | null;
        isDone: boolean;
      } = await step.runMutation(
        internal.aggregateRepairs.internalRepairUserBasicAggregatesBatch,
        { userId: args.userId, cursor: basicCursor, batchSize: 50 },
        { name: `userBasicAggregates_batch_${basicBatchCount}` },
      );

      basicResult.answered += batchResult.answered;
      basicResult.incorrect += batchResult.incorrect;
      basicResult.bookmarked += batchResult.bookmarked;
      basicProcessed += batchResult.processed;
      basicCursor = batchResult.nextCursor;
      basicBatchCount++;

      if (batchResult.isDone) break;
    } while (basicCursor);

    console.log(
      `Workflow: User ${args.userId} basic aggregates completed. Processed: ${basicProcessed} in ${basicBatchCount} batches`,
    );

    // Step 3: Repair hierarchical aggregates with pagination
    let hierarchicalCursor: string | null = null;
    let hierarchicalProcessed = 0;
    let hierarchicalBatchCount = 0;

    do {
      const batchResult: {
        processed: number;
        nextCursor: string | null;
        isDone: boolean;
      } = await step.runMutation(
        internal.aggregateRepairs.internalRepairUserHierarchicalAggregatesBatch,
        { userId: args.userId, cursor: hierarchicalCursor, batchSize: 50 },
        { name: `userHierarchicalAggregates_batch_${hierarchicalBatchCount}` },
      );

      hierarchicalProcessed += batchResult.processed;
      hierarchicalCursor = batchResult.nextCursor;
      hierarchicalBatchCount++;

      if (batchResult.isDone) break;
    } while (hierarchicalCursor);

    console.log(
      `Workflow: User ${args.userId} hierarchical aggregates completed. Processed: ${hierarchicalProcessed} in ${hierarchicalBatchCount} batches`,
    );

    const totalProcessed =
      basicResult.answered +
      basicResult.incorrect +
      basicResult.bookmarked +
      hierarchicalProcessed;

    console.log(
      `Workflow: User ${args.userId} repair completed. Total processed: ${totalProcessed}`,
    );

    return { success: true, processed: totalProcessed };
  },
});

// ============================================================================
// SECTION 1: GLOBAL QUESTION COUNT AGGREGATES WORKFLOW
// ============================================================================

/**
 * Initiate Section 1 repair workflow (Global Question Count Aggregates)
 */
export const initiateSection1Repair = internalMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx): Promise<string> => {
    console.log(
      'Starting Section 1: Global Question Count Aggregates Repair Workflow...',
    );

    const workflowId: any = await workflow.start(
      ctx,
      internal.aggregateWorkflows.section1RepairInternalWorkflow,
      {},
    );

    console.log(`Section 1 repair workflow started with ID: ${workflowId}`);
    return workflowId as string;
  },
});

/**
 * Section 1 repair internal workflow (Global Question Count Aggregates) - 15-second safe
 */
export const section1RepairInternalWorkflow = workflow.define({
  args: {},
  handler: async (
    step,
  ): Promise<{
    success: boolean;
    totalQuestions: number;
    themes: number;
    subthemes: number;
    groups: number;
  }> => {
    console.log(
      'Workflow: Starting Section 1 - Global Question Count Aggregates Repair...',
    );

    // Step 1: Clear aggregates
    await step.runMutation(
      internal.aggregateRepairs.internalRepairClearSection1Aggregates,
      {},
    );

    // Step 2: Process questions in paginated batches
    let cursor: string | null = null;
    let totalProcessed = 0;
    let batchCount = 0;

    do {
      const batchResult: {
        processed: number;
        nextCursor: string | null;
        isDone: boolean;
      } = await step.runMutation(
        internal.aggregateRepairs.internalRepairProcessQuestionsBatchGlobal,
        { cursor, batchSize: 100 },
        { name: `processQuestionsBatch_${batchCount}` },
      );

      totalProcessed += batchResult.processed;
      cursor = batchResult.nextCursor;
      batchCount++;

      if (batchResult.isDone) break;
    } while (cursor);

    console.log(
      `Processed ${totalProcessed} questions in ${batchCount} batches`,
    );

    // Step 3: Get taxonomy IDs
    const [themeIds, subthemeIds, groupIds] = await Promise.all([
      step.runMutation(
        internal.aggregateRepairs.internalRepairGetAllThemeIds,
        {},
      ),
      step.runMutation(
        internal.aggregateRepairs.internalRepairGetAllSubthemeIds,
        {},
      ),
      step.runMutation(
        internal.aggregateRepairs.internalRepairGetAllGroupIds,
        {},
      ),
    ]);

    // Step 4: Process themes in batches (5 themes per batch)
    const themeBatchSize = 5;
    let themeCount = 0;
    for (let i = 0; i < themeIds.length; i += themeBatchSize) {
      const batch = themeIds.slice(i, i + themeBatchSize);
      const result = await step.runMutation(
        internal.aggregateRepairs.internalRepairProcessThemeAggregatesBatch,
        { themeIds: batch },
        { name: `processThemes_batch_${Math.floor(i / themeBatchSize)}` },
      );
      themeCount += result.processed;
    }

    // Step 5: Process subthemes in batches (5 subthemes per batch)
    const subthemeBatchSize = 5;
    let subthemeCount = 0;
    for (let i = 0; i < subthemeIds.length; i += subthemeBatchSize) {
      const batch = subthemeIds.slice(i, i + subthemeBatchSize);
      const result = await step.runMutation(
        internal.aggregateRepairs.internalRepairProcessSubthemeAggregatesBatch,
        { subthemeIds: batch },
        { name: `processSubthemes_batch_${Math.floor(i / subthemeBatchSize)}` },
      );
      subthemeCount += result.processed;
    }

    // Step 6: Process groups in batches (5 groups per batch)
    const groupBatchSize = 5;
    let groupCount = 0;
    for (let i = 0; i < groupIds.length; i += groupBatchSize) {
      const batch = groupIds.slice(i, i + groupBatchSize);
      const result = await step.runMutation(
        internal.aggregateRepairs.internalRepairProcessGroupAggregatesBatch,
        { groupIds: batch },
        { name: `processGroups_batch_${Math.floor(i / groupBatchSize)}` },
      );
      groupCount += result.processed;
    }

    const finalResult = {
      success: true,
      totalQuestions: totalProcessed,
      themes: themeCount,
      subthemes: subthemeCount,
      groups: groupCount,
    };

    console.log(
      'Workflow: Section 1 repair completed successfully:',
      finalResult,
    );

    return finalResult;
  },
});

// ============================================================================
// SECTION 2: RANDOM QUESTION SELECTION AGGREGATES WORKFLOW
// ============================================================================

/**
 * Initiate Section 2 repair workflow (Random Question Selection Aggregates)
 */
export const initiateSection2Repair = internalMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx): Promise<string> => {
    console.log(
      'Starting Section 2: Random Question Selection Aggregates Repair Workflow...',
    );

    const workflowId: any = await workflow.start(
      ctx,
      internal.aggregateWorkflows.section2RepairInternalWorkflow,
      {},
    );

    console.log(`Section 2 repair workflow started with ID: ${workflowId}`);
    return workflowId as string;
  },
});

/**
 * Section 2 repair internal workflow (Random Question Selection Aggregates) - 15-second safe
 */
export const section2RepairInternalWorkflow = workflow.define({
  args: {},
  handler: async (
    step,
  ): Promise<{
    success: boolean;
    totalQuestions: number;
    themes: number;
    subthemes: number;
    groups: number;
  }> => {
    console.log(
      'Workflow: Starting Section 2 - Random Question Selection Aggregates Repair...',
    );

    // Step 1: Clear aggregates
    await step.runMutation(
      internal.aggregateRepairs.internalRepairClearSection2Aggregates,
      {},
    );

    // Step 2: Process questions in paginated batches for random selection
    let cursor: string | null = null;
    let totalProcessed = 0;
    let batchCount = 0;

    do {
      const batchResult: {
        processed: number;
        nextCursor: string | null;
        isDone: boolean;
      } = await step.runMutation(
        internal.aggregateRepairs.internalRepairProcessQuestionsBatchRandom,
        { cursor, batchSize: 100 },
        { name: `processRandomQuestionsBatch_${batchCount}` },
      );

      totalProcessed += batchResult.processed;
      cursor = batchResult.nextCursor;
      batchCount++;

      if (batchResult.isDone) break;
    } while (cursor);

    console.log(
      `Processed ${totalProcessed} questions for random selection in ${batchCount} batches`,
    );

    // Step 3: Get taxonomy IDs
    const [themeIds, subthemeIds, groupIds] = await Promise.all([
      step.runMutation(
        internal.aggregateRepairs.internalRepairGetAllThemeIds,
        {},
      ),
      step.runMutation(
        internal.aggregateRepairs.internalRepairGetAllSubthemeIds,
        {},
      ),
      step.runMutation(
        internal.aggregateRepairs.internalRepairGetAllGroupIds,
        {},
      ),
    ]);

    // Step 4: Process themes in batches (5 themes per batch)
    const themeBatchSize = 5;
    let themeCount = 0;
    for (let i = 0; i < themeIds.length; i += themeBatchSize) {
      const batch = themeIds.slice(i, i + themeBatchSize);
      const result = await step.runMutation(
        internal.aggregateRepairs
          .internalRepairProcessThemeRandomAggregatesBatch,
        { themeIds: batch },
        { name: `processRandomThemes_batch_${Math.floor(i / themeBatchSize)}` },
      );
      themeCount += result.processed;
    }

    // Step 5: Process subthemes in batches (5 subthemes per batch)
    const subthemeBatchSize = 5;
    let subthemeCount = 0;
    for (let i = 0; i < subthemeIds.length; i += subthemeBatchSize) {
      const batch = subthemeIds.slice(i, i + subthemeBatchSize);
      const result = await step.runMutation(
        internal.aggregateRepairs
          .internalRepairProcessSubthemeRandomAggregatesBatch,
        { subthemeIds: batch },
        {
          name: `processRandomSubthemes_batch_${Math.floor(i / subthemeBatchSize)}`,
        },
      );
      subthemeCount += result.processed;
    }

    // Step 6: Process groups in batches (5 groups per batch)
    const groupBatchSize = 5;
    let groupCount = 0;
    for (let i = 0; i < groupIds.length; i += groupBatchSize) {
      const batch = groupIds.slice(i, i + groupBatchSize);
      const result = await step.runMutation(
        internal.aggregateRepairs
          .internalRepairProcessGroupRandomAggregatesBatch,
        { groupIds: batch },
        { name: `processRandomGroups_batch_${Math.floor(i / groupBatchSize)}` },
      );
      groupCount += result.processed;
    }

    const finalResult = {
      success: true,
      totalQuestions: totalProcessed,
      themes: themeCount,
      subthemes: subthemeCount,
      groups: groupCount,
    };

    console.log(
      'Workflow: Section 2 repair completed successfully:',
      finalResult,
    );

    return finalResult;
  },
});

// ============================================================================
// SECTION 3: USER-SPECIFIC AGGREGATES WORKFLOW
// ============================================================================

/**
 * Initiate Section 3 repair workflow (User-Specific Aggregates)
 */
export const initiateSection3Repair = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    console.log(
      'Starting Section 3: User-Specific Aggregates Repair Workflow...',
    );

    const workflowId: any = await workflow.start(
      ctx,
      internal.aggregateWorkflows.section3RepairInternalWorkflow,
      { batchSize: args.batchSize || 50 },
    );

    console.log(`Section 3 repair workflow started with ID: ${workflowId}`);
    return workflowId as string;
  },
});

/**
 * Section 3 repair internal workflow (User-Specific Aggregates) - 15-second safe
 */
export const section3RepairInternalWorkflow = workflow.define({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (
    step,
    args,
  ): Promise<{
    success: boolean;
    usersProcessed: number;
    totalStats: number;
    totalBookmarks: number;
    hierarchicalEntries: number;
  }> => {
    const userBatchSize = args.batchSize || 8; // Small batches for 15-second safety
    console.log(
      `Workflow: Starting Section 3 - User-Specific Aggregates Repair (batch size: ${userBatchSize})...`,
    );

    // Step 1: Get all user IDs
    const userIds = await step.runMutation(
      internal.aggregateRepairs.internalRepairGetAllUserIds,
      {},
    );

    console.log(
      `Processing ${userIds.length} users in batches of ${userBatchSize}`,
    );

    // Step 2: Process users in small batches
    let totalUsersProcessed = 0;
    let totalStats = 0;
    let totalBookmarks = 0;
    let totalHierarchicalEntries = 0;

    for (let i = 0; i < userIds.length; i += userBatchSize) {
      const userBatch = userIds.slice(i, i + userBatchSize);
      const batchNumber = Math.floor(i / userBatchSize);

      const batchResult = await step.runMutation(
        internal.aggregateRepairs.internalRepairProcessUsersBatch,
        { userIds: userBatch },
        { name: `processUsersBatch_${batchNumber}` },
      );

      totalUsersProcessed += batchResult.usersProcessed;
      totalStats += batchResult.totalStats;
      totalBookmarks += batchResult.totalBookmarks;
      totalHierarchicalEntries += batchResult.hierarchicalEntries;

      console.log(
        `Completed batch ${batchNumber + 1}/${Math.ceil(userIds.length / userBatchSize)}: ${batchResult.usersProcessed} users processed`,
      );
    }

    const finalResult = {
      success: true,
      usersProcessed: totalUsersProcessed,
      totalStats,
      totalBookmarks,
      hierarchicalEntries: totalHierarchicalEntries,
    };

    console.log(
      'Workflow: Section 3 repair completed successfully:',
      finalResult,
    );

    return finalResult;
  },
});

// ============================================================================
// COMPREHENSIVE REPAIR WORKFLOW (ALL SECTIONS)
// ============================================================================

/**
 * Initiate comprehensive repair workflow (All 3 Sections)
 */
export const initiateComprehensiveRepair = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    console.log(
      'Starting Comprehensive Aggregate Repair Workflow (All Sections)...',
    );

    const workflowId: any = await workflow.start(
      ctx,
      internal.aggregateWorkflows.comprehensiveRepairInternalWorkflow,
      { batchSize: args.batchSize || 50 },
    );

    console.log(`Comprehensive repair workflow started with ID: ${workflowId}`);
    return workflowId as string;
  },
});

/**
 * Comprehensive repair internal workflow (All 3 Sections sequentially)
 */
export const comprehensiveRepairInternalWorkflow = workflow.define({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (
    step,
    args,
  ): Promise<{
    success: boolean;
    section1: any;
    section2: any;
    section3: any;
    totalDuration: number;
  }> => {
    const startTime = Date.now();
    const batchSize = args.batchSize || 50;

    console.log(
      'Workflow: Starting Comprehensive Aggregate Repair (All 3 Sections)...',
    );

    // Step 1: Section 1 - Global Question Count Aggregates (direct execution)
    console.log('Workflow: Phase 1/3 - Global Question Count Aggregates...');
    await step.runMutation(
      internal.aggregateRepairs.internalRepairClearSection1Aggregates,
      {},
    );

    // Process questions in paginated batches
    let cursor1: string | null = null;
    let totalProcessed1 = 0;
    let batchCount1 = 0;

    do {
      const batchResult: {
        processed: number;
        nextCursor: string | null;
        isDone: boolean;
      } = await step.runMutation(
        internal.aggregateRepairs.internalRepairProcessQuestionsBatchGlobal,
        { cursor: cursor1, batchSize: 100 },
        { name: `comprehensive_section1_batch_${batchCount1}` },
      );

      totalProcessed1 += batchResult.processed;
      cursor1 = batchResult.nextCursor;
      batchCount1++;

      if (batchResult.isDone) break;
    } while (cursor1);

    // Get taxonomy IDs and process them
    const [themeIds1, subthemeIds1, groupIds1] = await Promise.all([
      step.runMutation(
        internal.aggregateRepairs.internalRepairGetAllThemeIds,
        {},
      ),
      step.runMutation(
        internal.aggregateRepairs.internalRepairGetAllSubthemeIds,
        {},
      ),
      step.runMutation(
        internal.aggregateRepairs.internalRepairGetAllGroupIds,
        {},
      ),
    ]);

    // Process taxonomies in batches
    let section1Count = 0;
    for (let i = 0; i < themeIds1.length; i += 5) {
      const batch = themeIds1.slice(i, i + 5);
      await step.runMutation(
        internal.aggregateRepairs.internalRepairProcessThemeAggregatesBatch,
        { themeIds: batch },
        { name: `comprehensive_section1_themes_${Math.floor(i / 5)}` },
      );
      section1Count += batch.length;
    }

    const section1Result = {
      success: true,
      totalQuestions: totalProcessed1,
      themes: section1Count,
      subthemes: subthemeIds1.length,
      groups: groupIds1.length,
    };

    // Step 2: Section 2 - Random Question Selection Aggregates (direct execution)
    console.log(
      'Workflow: Phase 2/3 - Random Question Selection Aggregates...',
    );
    await step.runMutation(
      internal.aggregateRepairs.internalRepairClearSection2Aggregates,
      {},
    );

    // Process questions for random selection
    let cursor2: string | null = null;
    let totalProcessed2 = 0;
    let batchCount2 = 0;

    do {
      const batchResult: {
        processed: number;
        nextCursor: string | null;
        isDone: boolean;
      } = await step.runMutation(
        internal.aggregateRepairs.internalRepairProcessQuestionsBatchRandom,
        { cursor: cursor2, batchSize: 100 },
        { name: `comprehensive_section2_batch_${batchCount2}` },
      );

      totalProcessed2 += batchResult.processed;
      cursor2 = batchResult.nextCursor;
      batchCount2++;

      if (batchResult.isDone) break;
    } while (cursor2);

    // Process random taxonomies
    let section2Count = 0;
    for (let i = 0; i < themeIds1.length; i += 5) {
      const batch = themeIds1.slice(i, i + 5);
      await step.runMutation(
        internal.aggregateRepairs
          .internalRepairProcessThemeRandomAggregatesBatch,
        { themeIds: batch },
        { name: `comprehensive_section2_themes_${Math.floor(i / 5)}` },
      );
      section2Count += batch.length;
    }

    const section2Result = {
      success: true,
      totalQuestions: totalProcessed2,
      themes: section2Count,
      subthemes: subthemeIds1.length,
      groups: groupIds1.length,
    };

    // Step 3: Section 3 - User-Specific Aggregates (direct execution)
    console.log('Workflow: Phase 3/3 - User-Specific Aggregates...');
    const userIds = await step.runMutation(
      internal.aggregateRepairs.internalRepairGetAllUserIds,
      {},
    );

    let totalUsersProcessed = 0;
    let totalStats = 0;
    let totalBookmarks = 0;
    let totalHierarchicalEntries = 0;

    // Process users in small batches
    for (let i = 0; i < userIds.length; i += batchSize) {
      const userBatch = userIds.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize);

      const batchResult = await step.runMutation(
        internal.aggregateRepairs.internalRepairProcessUsersBatch,
        { userIds: userBatch },
        { name: `comprehensive_section3_batch_${batchNumber}` },
      );

      totalUsersProcessed += batchResult.usersProcessed;
      totalStats += batchResult.totalStats;
      totalBookmarks += batchResult.totalBookmarks;
      totalHierarchicalEntries += batchResult.hierarchicalEntries;
    }

    const section3Result = {
      success: true,
      usersProcessed: totalUsersProcessed,
      totalStats,
      totalBookmarks,
      hierarchicalEntries: totalHierarchicalEntries,
    };

    const totalDuration = Date.now() - startTime;

    const result = {
      success: true,
      section1: section1Result,
      section2: section2Result,
      section3: section3Result,
      totalDuration,
    };

    console.log(
      'Workflow: Comprehensive repair completed successfully in',
      totalDuration,
      'ms',
    );
    console.log('Final results:', result);

    return result;
  },
});

/**
 * Test function to verify user repair workflow works
 */
export const testUserRepair = mutation({
  args: { userId: v.id('users') },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    console.log(`Testing user repair for ${args.userId}...`);

    const workflowId = await ctx.runMutation(
      internal.aggregateWorkflows.initiateUserRepair,
      { userId: args.userId },
    );

    console.log(`Test workflow started with ID: ${workflowId}`);
    return workflowId;
  },
});
