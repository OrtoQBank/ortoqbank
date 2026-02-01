// ============================================================================
// AGGREGATE REPAIR FUNCTIONS
// ============================================================================
//
// This module provides paginated functions to repair/rebuild aggregate data.
// All functions are designed to work within Convex's 15-second timeout limit.
//
// USAGE PATTERN:
// 1. Call the clear function for the aggregate type
// 2. Call the paginated repair function repeatedly until isDone: true
//
// Example:
//   npx convex run aggregateRepairs:repairGlobalQuestionCount \
//     '{"tenantId":"...", "startCursor": null}'
//   # Repeat with returned cursor until isComplete: true
//
// USER STATS:
// User statistics are handled by the userStatsCounts table, not aggregates.
// Use userStats.initializeUserStatsCounts() to rebuild user stats.
// ============================================================================

import { v } from 'convex/values';

import { internalMutation } from './_generated/server';
import {
  questionCountByGroup,
  questionCountBySubtheme,
  questionCountByTheme,
  randomQuestions,
  randomQuestionsByGroup,
  randomQuestionsBySubtheme,
  randomQuestionsByTheme,
  totalQuestionCount,
} from './aggregates';

// ============================================================================
// SECTION 1: TOTAL QUESTION COUNT AGGREGATE REPAIR
// ============================================================================

/**
 * Repair total question count for a tenant with pagination (memory-safe)
 *
 * Usage:
 *   npx convex run aggregateRepairs:repairGlobalQuestionCount \
 *     '{"tenantId":"...", "startCursor": null}'
 *   # Repeat with returned nextCursor until isComplete: true
 */
export const repairGlobalQuestionCount = internalMutation({
  args: {
    tenantId: v.id('apps'),
    batchSize: v.optional(v.number()),
    startCursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    totalProcessed: v.number(),
    batchCount: v.number(),
    nextCursor: v.union(v.string(), v.null()),
    isComplete: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 100;

    // Only clear existing aggregates if this is the first call (no startCursor)
    if (!args.startCursor) {
      await totalQuestionCount.clear(ctx, { namespace: args.tenantId });
    }

    // Process questions in paginated batches (filtered by tenant)
    let cursor: string | null = args.startCursor || null;
    let totalProcessed = 0;
    let batchCount = 0;
    let isComplete = false;

    do {
      const result = await ctx.db
        .query('questions')
        .withIndex('by_tenant', q => q.eq('tenantId', args.tenantId))
        .paginate({
          cursor,
          numItems: batchSize,
        });

      // Process this batch
      for (const question of result.page) {
        await totalQuestionCount.insertIfDoesNotExist(ctx, question);
      }

      totalProcessed += result.page.length;
      cursor = result.continueCursor;
      batchCount++;

      console.log(
        `Processed batch ${batchCount}: ${result.page.length} questions for tenant ${args.tenantId}`,
      );

      // Check if we're done with all data
      if (result.isDone) {
        isComplete = true;
        cursor = null;
        break;
      }

      // If we have more data but this is getting large, we should break
      // and let the caller call us again with the cursor
      if (batchCount >= 10) {
        console.log(
          `Processed ${batchCount} batches, stopping to prevent timeout. Resume with cursor: ${cursor}`,
        );
        break;
      }
    } while (cursor);

    const message = isComplete
      ? `Repair completed: ${totalProcessed} questions processed in ${batchCount} batches for tenant ${args.tenantId}`
      : `Partial repair: ${totalProcessed} questions processed in ${batchCount} batches. Resume with returned cursor.`;

    console.log(message);

    return {
      totalProcessed,
      batchCount,
      nextCursor: cursor,
      isComplete,
    };
  },
});

/**
 * Clear Section 1 aggregates for a tenant (fast operation)
 */
export const internalRepairClearSection1Aggregates = internalMutation({
  args: {
    tenantId: v.id('apps'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await totalQuestionCount.clear(ctx, { namespace: args.tenantId });
    console.log(`Section 1 aggregates cleared for tenant ${args.tenantId}`);
    return null;
  },
});

// ============================================================================
// SECTION 1: THEME/SUBTHEME/GROUP COUNT AGGREGATES REPAIR (Paginated)
// ============================================================================

/**
 * Clear theme count aggregate for a specific theme
 */
export const internalRepairClearThemeCountAggregate = internalMutation({
  args: {
    tenantId: v.id('apps'),
    themeId: v.id('themes'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const namespace = `${args.tenantId}:${args.themeId}`;
    await questionCountByTheme.clear(ctx, { namespace });
    return null;
  },
});

/**
 * Repair theme count aggregate with pagination
 */
export const repairThemeCountPage = internalMutation({
  args: {
    tenantId: v.id('apps'),
    themeId: v.id('themes'),
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    nextCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 100;

    // Clear on first call (no cursor)
    if (!args.cursor) {
      const namespace = `${args.tenantId}:${args.themeId}`;
      await questionCountByTheme.clear(ctx, { namespace });
    }

    const result = await ctx.db
      .query('questions')
      .withIndex('by_tenant_and_theme', q =>
        q.eq('tenantId', args.tenantId).eq('themeId', args.themeId),
      )
      .paginate({ cursor: args.cursor, numItems: batchSize });

    for (const question of result.page) {
      await questionCountByTheme.insertIfDoesNotExist(ctx, question);
    }

    return {
      processed: result.page.length,
      nextCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * Clear subtheme count aggregate for a specific subtheme
 */
export const internalRepairClearSubthemeCountAggregate = internalMutation({
  args: {
    tenantId: v.id('apps'),
    subthemeId: v.id('subthemes'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const namespace = `${args.tenantId}:${args.subthemeId}`;
    await questionCountBySubtheme.clear(ctx, { namespace });
    return null;
  },
});

/**
 * Repair subtheme count aggregate with pagination
 */
export const repairSubthemeCountPage = internalMutation({
  args: {
    tenantId: v.id('apps'),
    subthemeId: v.id('subthemes'),
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    nextCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 100;

    // Clear on first call (no cursor)
    if (!args.cursor) {
      const namespace = `${args.tenantId}:${args.subthemeId}`;
      await questionCountBySubtheme.clear(ctx, { namespace });
    }

    const result = await ctx.db
      .query('questions')
      .withIndex('by_tenant_and_subtheme', q =>
        q.eq('tenantId', args.tenantId).eq('subthemeId', args.subthemeId),
      )
      .paginate({ cursor: args.cursor, numItems: batchSize });

    for (const question of result.page) {
      await questionCountBySubtheme.insertIfDoesNotExist(ctx, question);
    }

    return {
      processed: result.page.length,
      nextCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * Clear group count aggregate for a specific group
 */
export const internalRepairClearGroupCountAggregate = internalMutation({
  args: {
    tenantId: v.id('apps'),
    groupId: v.id('groups'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const namespace = `${args.tenantId}:${args.groupId}`;
    await questionCountByGroup.clear(ctx, { namespace });
    return null;
  },
});

/**
 * Repair group count aggregate with pagination
 */
export const repairGroupCountPage = internalMutation({
  args: {
    tenantId: v.id('apps'),
    groupId: v.id('groups'),
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    nextCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 100;

    // Clear on first call (no cursor)
    if (!args.cursor) {
      const namespace = `${args.tenantId}:${args.groupId}`;
      await questionCountByGroup.clear(ctx, { namespace });
    }

    const result = await ctx.db
      .query('questions')
      .withIndex('by_tenant_and_group', q =>
        q.eq('tenantId', args.tenantId).eq('groupId', args.groupId),
      )
      .paginate({ cursor: args.cursor, numItems: batchSize });

    for (const question of result.page) {
      await questionCountByGroup.insertIfDoesNotExist(ctx, question);
    }

    return {
      processed: result.page.length,
      nextCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

// ============================================================================
// SECTION 2: RANDOM QUESTION SELECTION AGGREGATES REPAIR (Paginated)
// ============================================================================

/**
 * Repair random questions aggregate for a tenant with pagination
 */
export const repairRandomQuestions = internalMutation({
  args: {
    tenantId: v.id('apps'),
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    nextCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 100;

    // Clear on first call (no cursor)
    if (!args.cursor) {
      await randomQuestions.clear(ctx, { namespace: args.tenantId });
    }

    const result = await ctx.db
      .query('questions')
      .withIndex('by_tenant', q => q.eq('tenantId', args.tenantId))
      .paginate({
        cursor: args.cursor,
        numItems: batchSize,
      });

    for (const question of result.page) {
      await randomQuestions.insertIfDoesNotExist(ctx, question);
    }

    console.log(
      `Processed ${result.page.length} questions for random selection`,
    );

    return {
      processed: result.page.length,
      nextCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * Clear Section 2 aggregates for a tenant (fast operation)
 */
export const internalRepairClearSection2Aggregates = internalMutation({
  args: {
    tenantId: v.id('apps'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await randomQuestions.clear(ctx, { namespace: args.tenantId });
    console.log(`Section 2 aggregates cleared for tenant ${args.tenantId}`);
    return null;
  },
});

/**
 * Clear theme random aggregate
 */
export const internalRepairClearThemeRandomAggregate = internalMutation({
  args: {
    tenantId: v.id('apps'),
    themeId: v.id('themes'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const namespace = `${args.tenantId}:${args.themeId}`;
    await randomQuestionsByTheme.clear(ctx, { namespace });
    return null;
  },
});

/**
 * Repair theme random aggregate with pagination
 */
export const internalRepairProcessThemeRandomPage = internalMutation({
  args: {
    tenantId: v.id('apps'),
    themeId: v.id('themes'),
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    nextCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 100;

    // Clear on first call (no cursor)
    if (!args.cursor) {
      const namespace = `${args.tenantId}:${args.themeId}`;
      await randomQuestionsByTheme.clear(ctx, { namespace });
    }

    const result = await ctx.db
      .query('questions')
      .withIndex('by_tenant_and_theme', q =>
        q.eq('tenantId', args.tenantId).eq('themeId', args.themeId),
      )
      .paginate({ cursor: args.cursor, numItems: batchSize });

    for (const question of result.page) {
      await randomQuestionsByTheme.insertIfDoesNotExist(ctx, question);
    }

    return {
      processed: result.page.length,
      nextCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * Clear subtheme random aggregate
 */
export const internalRepairClearSubthemeRandomAggregate = internalMutation({
  args: {
    tenantId: v.id('apps'),
    subthemeId: v.id('subthemes'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const namespace = `${args.tenantId}:${args.subthemeId}`;
    await randomQuestionsBySubtheme.clear(ctx, { namespace });
    return null;
  },
});

/**
 * Repair subtheme random aggregate with pagination
 */
export const internalRepairProcessSubthemeRandomPage = internalMutation({
  args: {
    tenantId: v.id('apps'),
    subthemeId: v.id('subthemes'),
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    nextCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 100;

    // Clear on first call (no cursor)
    if (!args.cursor) {
      const namespace = `${args.tenantId}:${args.subthemeId}`;
      await randomQuestionsBySubtheme.clear(ctx, { namespace });
    }

    const result = await ctx.db
      .query('questions')
      .withIndex('by_tenant_and_subtheme', q =>
        q.eq('tenantId', args.tenantId).eq('subthemeId', args.subthemeId),
      )
      .paginate({ cursor: args.cursor, numItems: batchSize });

    for (const question of result.page) {
      await randomQuestionsBySubtheme.insertIfDoesNotExist(ctx, question);
    }

    return {
      processed: result.page.length,
      nextCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * Clear group random aggregate
 */
export const internalRepairClearGroupRandomAggregate = internalMutation({
  args: {
    tenantId: v.id('apps'),
    groupId: v.id('groups'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const namespace = `${args.tenantId}:${args.groupId}`;
    await randomQuestionsByGroup.clear(ctx, { namespace });
    return null;
  },
});

/**
 * Repair group random aggregate with pagination
 */
export const internalRepairProcessGroupRandomPage = internalMutation({
  args: {
    tenantId: v.id('apps'),
    groupId: v.id('groups'),
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    nextCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 100;

    // Clear on first call (no cursor)
    if (!args.cursor) {
      const namespace = `${args.tenantId}:${args.groupId}`;
      await randomQuestionsByGroup.clear(ctx, { namespace });
    }

    const result = await ctx.db
      .query('questions')
      .withIndex('by_tenant_and_group', q =>
        q.eq('tenantId', args.tenantId).eq('groupId', args.groupId),
      )
      .paginate({ cursor: args.cursor, numItems: batchSize });

    for (const question of result.page) {
      await randomQuestionsByGroup.insertIfDoesNotExist(ctx, question);
    }

    return {
      processed: result.page.length,
      nextCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all theme IDs for a tenant (for batch processing)
 */
export const getThemeIdsForTenant = internalMutation({
  args: {
    tenantId: v.id('apps'),
  },
  returns: v.array(v.id('themes')),
  handler: async (ctx, args) => {
    const themes = await ctx.db
      .query('themes')
      .withIndex('by_tenant', q => q.eq('tenantId', args.tenantId))
      .collect();
    return themes.map(t => t._id);
  },
});

/**
 * Get all subtheme IDs for a tenant (for batch processing)
 */
export const getSubthemeIdsForTenant = internalMutation({
  args: {
    tenantId: v.id('apps'),
  },
  returns: v.array(v.id('subthemes')),
  handler: async (ctx, args) => {
    const subthemes = await ctx.db
      .query('subthemes')
      .withIndex('by_tenant', q => q.eq('tenantId', args.tenantId))
      .collect();
    return subthemes.map(s => s._id);
  },
});

/**
 * Get all group IDs for a tenant (for batch processing)
 */
export const getGroupIdsForTenant = internalMutation({
  args: {
    tenantId: v.id('apps'),
  },
  returns: v.array(v.id('groups')),
  handler: async (ctx, args) => {
    const groups = await ctx.db
      .query('groups')
      .withIndex('by_tenant', q => q.eq('tenantId', args.tenantId))
      .collect();
    return groups.map(g => g._id);
  },
});
