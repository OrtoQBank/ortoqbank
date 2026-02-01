// ============================================================================
// AGGREGATE REPAIR FUNCTIONS
// ============================================================================
//
// This module provides paginated functions to repair/rebuild aggregate data.
// All functions are designed to work within Convex's 15-second timeout limit.
//
// USAGE PATTERN:
// Call the paginated repair function repeatedly until isDone: true
// Each function clears the aggregate on first call (when cursor is null)
//
// Example:
//   npx convex run aggregateRepairs:repairGlobalQuestionCount \
//     '{"tenantId":"...", "cursor": null}'
//   # Repeat with returned cursor until isDone: true
//
// USER STATS:
// User statistics are handled by the userStatsCounts table, not aggregates.
// Use userStats.initializeUserStatsCounts() to rebuild user stats.
// ============================================================================

import { v } from 'convex/values';

import { internalMutation, internalQuery } from './_generated/server';
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

const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCHES_PER_CALL = 10;

const paginatedResultValidator = v.object({
  processed: v.number(),
  nextCursor: v.union(v.string(), v.null()),
  isDone: v.boolean(),
});

// ============================================================================
// SECTION 1: TOTAL QUESTION COUNT AGGREGATE REPAIR
// ============================================================================

/**
 * Repair total question count for a tenant with pagination
 *
 * Usage:
 *   npx convex run aggregateRepairs:repairGlobalQuestionCount \
 *     '{"tenantId":"...", "cursor": null}'
 *   # Repeat with returned cursor until isDone: true
 */
export const repairGlobalQuestionCount = internalMutation({
  args: {
    tenantId: v.id('apps'),
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
  },
  returns: paginatedResultValidator,
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? DEFAULT_BATCH_SIZE;

    if (!args.cursor) {
      await totalQuestionCount.clear(ctx, { namespace: args.tenantId });
    }

    let cursor: string | null = args.cursor;
    let totalProcessed = 0;
    let batchCount = 0;

    do {
      const result = await ctx.db
        .query('questions')
        .withIndex('by_tenant', q => q.eq('tenantId', args.tenantId))
        .paginate({ cursor, numItems: batchSize });

      for (const question of result.page) {
        await totalQuestionCount.insertIfDoesNotExist(ctx, question);
      }

      totalProcessed += result.page.length;
      cursor = result.continueCursor;
      batchCount++;

      if (result.isDone) {
        return { processed: totalProcessed, nextCursor: null, isDone: true };
      }

      if (batchCount >= MAX_BATCHES_PER_CALL) {
        return { processed: totalProcessed, nextCursor: cursor, isDone: false };
      }
    } while (cursor);

    return { processed: totalProcessed, nextCursor: null, isDone: true };
  },
});

// ============================================================================
// SECTION 2: THEME/SUBTHEME/GROUP COUNT AGGREGATES REPAIR
// ============================================================================

/**
 * Repair theme count aggregate with pagination
 */
export const repairThemeCount = internalMutation({
  args: {
    tenantId: v.id('apps'),
    themeId: v.id('themes'),
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
  },
  returns: paginatedResultValidator,
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? DEFAULT_BATCH_SIZE;
    const namespace = `${args.tenantId}:${args.themeId}`;

    if (!args.cursor) {
      await questionCountByTheme.clear(ctx, { namespace });
    }

    let cursor: string | null = args.cursor;
    let totalProcessed = 0;
    let batchCount = 0;

    do {
      const result = await ctx.db
        .query('questions')
        .withIndex('by_tenant_and_theme', q =>
          q.eq('tenantId', args.tenantId).eq('themeId', args.themeId),
        )
        .paginate({ cursor, numItems: batchSize });

      for (const question of result.page) {
        await questionCountByTheme.insertIfDoesNotExist(ctx, question);
      }

      totalProcessed += result.page.length;
      cursor = result.continueCursor;
      batchCount++;

      if (result.isDone) {
        return { processed: totalProcessed, nextCursor: null, isDone: true };
      }

      if (batchCount >= MAX_BATCHES_PER_CALL) {
        return { processed: totalProcessed, nextCursor: cursor, isDone: false };
      }
    } while (cursor);

    return { processed: totalProcessed, nextCursor: null, isDone: true };
  },
});

/**
 * Repair subtheme count aggregate with pagination
 */
export const repairSubthemeCount = internalMutation({
  args: {
    tenantId: v.id('apps'),
    subthemeId: v.id('subthemes'),
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
  },
  returns: paginatedResultValidator,
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? DEFAULT_BATCH_SIZE;
    const namespace = `${args.tenantId}:${args.subthemeId}`;

    if (!args.cursor) {
      await questionCountBySubtheme.clear(ctx, { namespace });
    }

    let cursor: string | null = args.cursor;
    let totalProcessed = 0;
    let batchCount = 0;

    do {
      const result = await ctx.db
        .query('questions')
        .withIndex('by_tenant_and_subtheme', q =>
          q.eq('tenantId', args.tenantId).eq('subthemeId', args.subthemeId),
        )
        .paginate({ cursor, numItems: batchSize });

      for (const question of result.page) {
        await questionCountBySubtheme.insertIfDoesNotExist(ctx, question);
      }

      totalProcessed += result.page.length;
      cursor = result.continueCursor;
      batchCount++;

      if (result.isDone) {
        return { processed: totalProcessed, nextCursor: null, isDone: true };
      }

      if (batchCount >= MAX_BATCHES_PER_CALL) {
        return { processed: totalProcessed, nextCursor: cursor, isDone: false };
      }
    } while (cursor);

    return { processed: totalProcessed, nextCursor: null, isDone: true };
  },
});

/**
 * Repair group count aggregate with pagination
 */
export const repairGroupCount = internalMutation({
  args: {
    tenantId: v.id('apps'),
    groupId: v.id('groups'),
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
  },
  returns: paginatedResultValidator,
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? DEFAULT_BATCH_SIZE;
    const namespace = `${args.tenantId}:${args.groupId}`;

    if (!args.cursor) {
      await questionCountByGroup.clear(ctx, { namespace });
    }

    let cursor: string | null = args.cursor;
    let totalProcessed = 0;
    let batchCount = 0;

    do {
      const result = await ctx.db
        .query('questions')
        .withIndex('by_tenant_and_group', q =>
          q.eq('tenantId', args.tenantId).eq('groupId', args.groupId),
        )
        .paginate({ cursor, numItems: batchSize });

      for (const question of result.page) {
        await questionCountByGroup.insertIfDoesNotExist(ctx, question);
      }

      totalProcessed += result.page.length;
      cursor = result.continueCursor;
      batchCount++;

      if (result.isDone) {
        return { processed: totalProcessed, nextCursor: null, isDone: true };
      }

      if (batchCount >= MAX_BATCHES_PER_CALL) {
        return { processed: totalProcessed, nextCursor: cursor, isDone: false };
      }
    } while (cursor);

    return { processed: totalProcessed, nextCursor: null, isDone: true };
  },
});

// ============================================================================
// SECTION 3: RANDOM QUESTION SELECTION AGGREGATES REPAIR
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
  returns: paginatedResultValidator,
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? DEFAULT_BATCH_SIZE;

    if (!args.cursor) {
      await randomQuestions.clear(ctx, { namespace: args.tenantId });
    }

    let cursor: string | null = args.cursor;
    let totalProcessed = 0;
    let batchCount = 0;

    do {
      const result = await ctx.db
        .query('questions')
        .withIndex('by_tenant', q => q.eq('tenantId', args.tenantId))
        .paginate({ cursor, numItems: batchSize });

      for (const question of result.page) {
        await randomQuestions.insertIfDoesNotExist(ctx, question);
      }

      totalProcessed += result.page.length;
      cursor = result.continueCursor;
      batchCount++;

      if (result.isDone) {
        return { processed: totalProcessed, nextCursor: null, isDone: true };
      }

      if (batchCount >= MAX_BATCHES_PER_CALL) {
        return { processed: totalProcessed, nextCursor: cursor, isDone: false };
      }
    } while (cursor);

    return { processed: totalProcessed, nextCursor: null, isDone: true };
  },
});

/**
 * Repair theme random aggregate with pagination
 */
export const repairRandomQuestionsByTheme = internalMutation({
  args: {
    tenantId: v.id('apps'),
    themeId: v.id('themes'),
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
  },
  returns: paginatedResultValidator,
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? DEFAULT_BATCH_SIZE;
    const namespace = `${args.tenantId}:${args.themeId}`;

    if (!args.cursor) {
      await randomQuestionsByTheme.clear(ctx, { namespace });
    }

    let cursor: string | null = args.cursor;
    let totalProcessed = 0;
    let batchCount = 0;

    do {
      const result = await ctx.db
        .query('questions')
        .withIndex('by_tenant_and_theme', q =>
          q.eq('tenantId', args.tenantId).eq('themeId', args.themeId),
        )
        .paginate({ cursor, numItems: batchSize });

      for (const question of result.page) {
        await randomQuestionsByTheme.insertIfDoesNotExist(ctx, question);
      }

      totalProcessed += result.page.length;
      cursor = result.continueCursor;
      batchCount++;

      if (result.isDone) {
        return { processed: totalProcessed, nextCursor: null, isDone: true };
      }

      if (batchCount >= MAX_BATCHES_PER_CALL) {
        return { processed: totalProcessed, nextCursor: cursor, isDone: false };
      }
    } while (cursor);

    return { processed: totalProcessed, nextCursor: null, isDone: true };
  },
});

/**
 * Repair subtheme random aggregate with pagination
 */
export const repairRandomQuestionsBySubtheme = internalMutation({
  args: {
    tenantId: v.id('apps'),
    subthemeId: v.id('subthemes'),
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
  },
  returns: paginatedResultValidator,
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? DEFAULT_BATCH_SIZE;
    const namespace = `${args.tenantId}:${args.subthemeId}`;

    if (!args.cursor) {
      await randomQuestionsBySubtheme.clear(ctx, { namespace });
    }

    let cursor: string | null = args.cursor;
    let totalProcessed = 0;
    let batchCount = 0;

    do {
      const result = await ctx.db
        .query('questions')
        .withIndex('by_tenant_and_subtheme', q =>
          q.eq('tenantId', args.tenantId).eq('subthemeId', args.subthemeId),
        )
        .paginate({ cursor, numItems: batchSize });

      for (const question of result.page) {
        await randomQuestionsBySubtheme.insertIfDoesNotExist(ctx, question);
      }

      totalProcessed += result.page.length;
      cursor = result.continueCursor;
      batchCount++;

      if (result.isDone) {
        return { processed: totalProcessed, nextCursor: null, isDone: true };
      }

      if (batchCount >= MAX_BATCHES_PER_CALL) {
        return { processed: totalProcessed, nextCursor: cursor, isDone: false };
      }
    } while (cursor);

    return { processed: totalProcessed, nextCursor: null, isDone: true };
  },
});

/**
 * Repair group random aggregate with pagination
 */
export const repairRandomQuestionsByGroup = internalMutation({
  args: {
    tenantId: v.id('apps'),
    groupId: v.id('groups'),
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
  },
  returns: paginatedResultValidator,
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? DEFAULT_BATCH_SIZE;
    const namespace = `${args.tenantId}:${args.groupId}`;

    if (!args.cursor) {
      await randomQuestionsByGroup.clear(ctx, { namespace });
    }

    let cursor: string | null = args.cursor;
    let totalProcessed = 0;
    let batchCount = 0;

    do {
      const result = await ctx.db
        .query('questions')
        .withIndex('by_tenant_and_group', q =>
          q.eq('tenantId', args.tenantId).eq('groupId', args.groupId),
        )
        .paginate({ cursor, numItems: batchSize });

      for (const question of result.page) {
        await randomQuestionsByGroup.insertIfDoesNotExist(ctx, question);
      }

      totalProcessed += result.page.length;
      cursor = result.continueCursor;
      batchCount++;

      if (result.isDone) {
        return { processed: totalProcessed, nextCursor: null, isDone: true };
      }

      if (batchCount >= MAX_BATCHES_PER_CALL) {
        return { processed: totalProcessed, nextCursor: cursor, isDone: false };
      }
    } while (cursor);

    return { processed: totalProcessed, nextCursor: null, isDone: true };
  },
});

// ============================================================================
// HELPER QUERIES
// ============================================================================

/**
 * Get all theme IDs for a tenant (for batch processing)
 */
export const getThemeIdsForTenant = internalQuery({
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
export const getSubthemeIdsForTenant = internalQuery({
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
export const getGroupIdsForTenant = internalQuery({
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
