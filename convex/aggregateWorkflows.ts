// ============================================================================
// PRODUCTION-SAFE AGGREGATE REPAIR WORKFLOWS (GLOBAL AGGREGATES ONLY)
// ============================================================================
//
// This system repairs global aggregates efficiently within Convex's
// 15-second mutation limit using proper pagination and workflow orchestration.
//
// ⚠️  USER-SPECIFIC AGGREGATES REMOVED
// User-specific aggregate workflows have been removed as they are replaced
// by the userStatsCounts table for better performance and maintainability.
//
// KEY FEATURES:
// - All mutations complete within 15-second limit
// - Proper pagination (not .collect() on large datasets)
// - Step-by-step progress tracking
// - Production-safe batch processing
// - Hierarchical processing (themes, subthemes, groups)
//
// AVAILABLE WORKFLOWS:
// - Section 1: Global Question Count Aggregates (initiateSection1Repair)
// - Section 2: Random Question Selection Aggregates (initiateSection2Repair)
// - Complete repair: Global aggregates only (initiateComprehensiveRepair)
//
// Based on Convex Workflow component: https://www.convex.dev/components/workflow
// ============================================================================

import { WorkflowManager } from '@convex-dev/workflow';
import { v } from 'convex/values';

import { components, internal } from './_generated/api';
import { internalMutation } from './_generated/server';

// Create the workflow manager
export const workflow = new WorkflowManager(components.workflow);

// USER-SPECIFIC REPAIR WORKFLOWS REMOVED
// User-specific aggregates have been replaced by the userStatsCounts table
// These workflows are no longer needed

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
 * Cancel a running workflow by ID
 */
export const cancelWorkflow = internalMutation({
  args: { workflowId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await workflow.cancel(ctx, args.workflowId as any);
    return null;
  },
});

/**
 * Cleanup a completed/canceled workflow's stored state
 */
export const cleanupWorkflow = internalMutation({
  args: { workflowId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await workflow.cleanup(ctx, args.workflowId as any);
    return null;
  },
});

// userRepairInternalWorkflow REMOVED
// User-specific aggregate workflows are no longer needed as they have been
// replaced by the userStatsCounts table for better performance

// ============================================================================
// SECTION 1: GLOBAL QUESTION COUNT AGGREGATES WORKFLOW
// ============================================================================

/**
 * Initiate Section 1 repair workflow (Global Question Count Aggregates)
 * Now requires tenantId for multi-tenant aggregate namespace support.
 */
export const initiateSection1Repair = internalMutation({
  args: {
    tenantId: v.id('apps'),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    console.log(
      `Starting Section 1: Global Question Count Aggregates Repair Workflow for tenant ${args.tenantId}...`,
    );

    const workflowId: any = await workflow.start(
      ctx,
      internal.aggregateWorkflows.section1RepairInternalWorkflow,
      { tenantId: args.tenantId },
    );

    console.log(`Section 1 repair workflow started with ID: ${workflowId}`);
    return workflowId as string;
  },
});

/**
 * Section 1 repair internal workflow (Global Question Count Aggregates) - 15-second safe
 * Uses composite namespace: "tenantId:entityId" for theme/subtheme/group aggregates.
 */
export const section1RepairInternalWorkflow = workflow.define({
  args: {
    tenantId: v.id('apps'),
  },
  handler: async (
    step,
    args,
  ): Promise<{
    success: boolean;
    totalQuestions: number;
    themes: number;
    subthemes: number;
    groups: number;
  }> => {
    console.log(
      `Workflow: Starting Section 1 - Global Question Count Aggregates Repair for tenant ${args.tenantId}...`,
    );

    // Step 1: Clear aggregates for this tenant
    await step.runMutation(
      internal.aggregateRepairs.internalRepairClearSection1Aggregates,
      { tenantId: args.tenantId },
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
        { cursor, batchSize: 25 },
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

    // Step 4: Process themes in batches (1 theme per batch to stay <15s)
    // Pass tenantId for composite namespace
    const themeBatchSize = 1;
    let themeCount = 0;
    for (let i = 0; i < themeIds.length; i += themeBatchSize) {
      const batch = themeIds.slice(i, i + themeBatchSize);
      const result = await step.runMutation(
        internal.aggregateRepairs.internalRepairProcessThemeAggregatesBatch,
        { tenantId: args.tenantId, themeIds: batch },
        { name: `processThemes_batch_${Math.floor(i / themeBatchSize)}` },
      );
      themeCount += result.processed;
    }

    // Step 5: Process subthemes in batches (1 subtheme per batch)
    // Pass tenantId for composite namespace
    const subthemeBatchSize = 1;
    let subthemeCount = 0;
    for (let i = 0; i < subthemeIds.length; i += subthemeBatchSize) {
      const batch = subthemeIds.slice(i, i + subthemeBatchSize);
      const result = await step.runMutation(
        internal.aggregateRepairs.internalRepairProcessSubthemeAggregatesBatch,
        { tenantId: args.tenantId, subthemeIds: batch },
        { name: `processSubthemes_batch_${Math.floor(i / subthemeBatchSize)}` },
      );
      subthemeCount += result.processed;
    }

    // Step 6: Process groups in batches (1 group per batch)
    // Pass tenantId for composite namespace
    const groupBatchSize = 1;
    let groupCount = 0;
    for (let i = 0; i < groupIds.length; i += groupBatchSize) {
      const batch = groupIds.slice(i, i + groupBatchSize);
      const result = await step.runMutation(
        internal.aggregateRepairs.internalRepairProcessGroupAggregatesBatch,
        { tenantId: args.tenantId, groupIds: batch },
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
 * Now requires tenantId for multi-tenant aggregate namespace support.
 */
export const initiateSection2Repair = internalMutation({
  args: {
    tenantId: v.id('apps'),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    console.log(
      `Starting Section 2: Random Question Selection Aggregates Repair Workflow for tenant ${args.tenantId}...`,
    );

    const workflowId: any = await workflow.start(
      ctx,
      internal.aggregateWorkflows.section2RepairInternalWorkflow,
      { tenantId: args.tenantId },
    );

    console.log(`Section 2 repair workflow started with ID: ${workflowId}`);
    return workflowId as string;
  },
});

/**
 * Section 2 repair internal workflow (Random Question Selection Aggregates) - 15-second safe
 * Uses composite namespace: "tenantId:entityId" for theme/subtheme/group aggregates.
 */
export const section2RepairInternalWorkflow = workflow.define({
  args: {
    tenantId: v.id('apps'),
  },
  handler: async (
    step,
    args,
  ): Promise<{
    success: boolean;
    totalQuestions: number;
    themes: number;
    subthemes: number;
    groups: number;
  }> => {
    console.log(
      `Workflow: Starting Section 2 - Random Question Selection Aggregates Repair for tenant ${args.tenantId}...`,
    );

    // Step 1: Clear aggregates for this tenant
    await step.runMutation(
      internal.aggregateRepairs.internalRepairClearSection2Aggregates,
      { tenantId: args.tenantId },
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
        { cursor, batchSize: 25 },
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

    // Step 4: Process themes (paginated per theme)
    // Pass tenantId for composite namespace
    let themeCount = 0;
    for (const [i, themeId] of themeIds.entries()) {
      await step.runMutation(
        internal.aggregateRepairs.internalRepairClearThemeRandomAggregate,
        { tenantId: args.tenantId, themeId },
        { name: `randomTheme_clear_${i}` },
      );
      let pageCursor: string | null = null;
      let pageIndex = 0;
      do {
        const page: {
          processed: number;
          nextCursor: string | null;
          isDone: boolean;
        } = await step.runMutation(
          internal.aggregateRepairs.internalRepairProcessThemeRandomPage,
          {
            tenantId: args.tenantId,
            themeId,
            cursor: pageCursor,
            batchSize: 25,
          },
          { name: `randomTheme_page_${i}_${pageIndex}` },
        );
        pageCursor = page.nextCursor;
        pageIndex += 1;
        if (page.isDone) break;
      } while (pageCursor);
      themeCount += 1;
    }

    // Step 5: Process subthemes (paginated per subtheme)
    // Pass tenantId for composite namespace
    let subthemeCount = 0;
    for (const [i, subthemeId] of subthemeIds.entries()) {
      await step.runMutation(
        internal.aggregateRepairs.internalRepairClearSubthemeRandomAggregate,
        { tenantId: args.tenantId, subthemeId },
        { name: `randomSubtheme_clear_${i}` },
      );
      let pageCursor: string | null = null;
      let pageIndex = 0;
      do {
        const page: {
          processed: number;
          nextCursor: string | null;
          isDone: boolean;
        } = await step.runMutation(
          internal.aggregateRepairs.internalRepairProcessSubthemeRandomPage,
          {
            tenantId: args.tenantId,
            subthemeId,
            cursor: pageCursor,
            batchSize: 25,
          },
          { name: `randomSubtheme_page_${i}_${pageIndex}` },
        );
        pageCursor = page.nextCursor;
        pageIndex += 1;
        if (page.isDone) break;
      } while (pageCursor);
      subthemeCount += 1;
    }

    // Step 6: Process groups (paginated per group)
    // Pass tenantId for composite namespace
    let groupCount = 0;
    for (const [i, groupId] of groupIds.entries()) {
      await step.runMutation(
        internal.aggregateRepairs.internalRepairClearGroupRandomAggregate,
        { tenantId: args.tenantId, groupId },
        { name: `randomGroup_clear_${i}` },
      );
      let pageCursor: string | null = null;
      let pageIndex = 0;
      do {
        const page: {
          processed: number;
          nextCursor: string | null;
          isDone: boolean;
        } = await step.runMutation(
          internal.aggregateRepairs.internalRepairProcessGroupRandomPage,
          {
            tenantId: args.tenantId,
            groupId,
            cursor: pageCursor,
            batchSize: 25,
          },
          { name: `randomGroup_page_${i}_${pageIndex}` },
        );
        pageCursor = page.nextCursor;
        pageIndex += 1;
        if (page.isDone) break;
      } while (pageCursor);
      groupCount += 1;
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
// SECTION 3: USER-SPECIFIC AGGREGATES WORKFLOW - REMOVED
// ============================================================================

// All Section 3 user-specific aggregate workflows have been removed.
// User statistics are now efficiently handled by the userStatsCounts table,
// which provides much better performance than the old aggregate system.
// Use userStats.initializeAllUserStatsCounts() instead for data migration.

// ============================================================================
// COMPREHENSIVE REPAIR WORKFLOW (ALL SECTIONS)
// ============================================================================

/**
 * Initiate comprehensive repair workflow (Sections 1 & 2 only)
 * Now requires tenantId for multi-tenant aggregate namespace support.
 */
export const initiateComprehensiveRepair = internalMutation({
  args: {
    tenantId: v.id('apps'),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    console.log(
      `Starting Comprehensive Aggregate Repair Workflow (Global Aggregates Only) for tenant ${args.tenantId}...`,
    );

    const workflowId: any = await workflow.start(
      ctx,
      internal.aggregateWorkflows.comprehensiveRepairInternalWorkflow,
      { tenantId: args.tenantId },
    );

    console.log(`Comprehensive repair workflow started with ID: ${workflowId}`);
    return workflowId as string;
  },
});

/**
 * Comprehensive repair internal workflow (Sections 1 & 2 only)
 * Uses composite namespace: "tenantId:entityId" for theme/subtheme/group aggregates.
 */
export const comprehensiveRepairInternalWorkflow = workflow.define({
  args: {
    tenantId: v.id('apps'),
  },
  handler: async (
    step,
    args,
  ): Promise<{
    success: boolean;
    section1: any;
    section2: any;
    totalDuration: number;
  }> => {
    const startTime = Date.now();

    console.log(
      `Workflow: Starting Comprehensive Aggregate Repair (Global Aggregates Only) for tenant ${args.tenantId}...`,
    );

    // Step 1: Section 1 - Global Question Count Aggregates (direct execution)
    console.log('Workflow: Phase 1/2 - Global Question Count Aggregates...');
    await step.runMutation(
      internal.aggregateRepairs.internalRepairClearSection1Aggregates,
      { tenantId: args.tenantId },
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
        { cursor: cursor1, batchSize: 25 },
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

    // Process taxonomies in batches - pass tenantId for composite namespace
    let section1Count = 0;
    for (let i = 0; i < themeIds1.length; i += 5) {
      const batch = themeIds1.slice(i, i + 5);
      await step.runMutation(
        internal.aggregateRepairs.internalRepairProcessThemeAggregatesBatch,
        { tenantId: args.tenantId, themeIds: batch },
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
      'Workflow: Phase 2/2 - Random Question Selection Aggregates...',
    );
    await step.runMutation(
      internal.aggregateRepairs.internalRepairClearSection2Aggregates,
      { tenantId: args.tenantId },
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
        { cursor: cursor2, batchSize: 25 },
        { name: `comprehensive_section2_batch_${batchCount2}` },
      );

      totalProcessed2 += batchResult.processed;
      cursor2 = batchResult.nextCursor;
      batchCount2++;

      if (batchResult.isDone) break;
    } while (cursor2);

    // Process random taxonomies - pass tenantId for composite namespace
    let section2Count = 0;
    for (let i = 0; i < themeIds1.length; i += 5) {
      const batch = themeIds1.slice(i, i + 5);
      await step.runMutation(
        internal.aggregateRepairs
          .internalRepairProcessThemeRandomAggregatesBatch,
        { tenantId: args.tenantId, themeIds: batch },
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

    const totalDuration = Date.now() - startTime;

    const result = {
      success: true,
      section1: section1Result,
      section2: section2Result,
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

// testUserRepair function removed
// User-specific aggregate repair workflows are no longer needed
