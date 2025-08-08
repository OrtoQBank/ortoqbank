// ============================================================================
// SIMPLE AGGREGATE REPAIR FUNCTIONS
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

// USER-SPECIFIC AGGREGATE REPAIR FUNCTIONS REMOVED
// These functions are no longer needed as user-specific aggregates have been
// replaced by the userStatsCounts table for better performance

// All user-specific aggregate repair functions have been removed
// User statistics are now handled by the userStatsCounts table

/**
 * Repair global question count with pagination (memory-safe)
 */
export const repairGlobalQuestionCount = internalMutation({
  args: {
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
      await totalQuestionCount.clear(ctx, { namespace: 'global' });
    }

    // Process questions in paginated batches
    let cursor: string | null = args.startCursor || null;
    let totalProcessed = 0;
    let batchCount = 0;
    let isComplete = false;

    do {
      const result = await ctx.db.query('questions').paginate({
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
        `Processed batch ${batchCount}: ${result.page.length} questions`,
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
      ? `Repair completed: ${totalProcessed} questions processed in ${batchCount} batches`
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

// ============================================================================
// SECTION 1: GLOBAL QUESTION COUNT AGGREGATES REPAIR
// ============================================================================

// ============================================================================
// SECTION 1: PAGINATED REPAIR FUNCTIONS (15-second safe)
// ============================================================================

/**
 * Clear Section 1 aggregates (fast operation)
 */
export const internalRepairClearSection1Aggregates = internalMutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    await totalQuestionCount.clear(ctx, { namespace: 'global' });
    console.log('Section 1 aggregates cleared');
    return null;
  },
});

/**
 * Process questions batch for global count (15-second safe)
 */
export const internalRepairProcessQuestionsBatchGlobal = internalMutation({
  args: {
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

    const result = await ctx.db.query('questions').paginate({
      cursor: args.cursor,
      numItems: batchSize,
    });

    // Process this batch
    for (const question of result.page) {
      await totalQuestionCount.insertIfDoesNotExist(ctx, question);
    }

    console.log(`Processed ${result.page.length} questions for global count`);

    return {
      processed: result.page.length,
      nextCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * Process theme aggregates batch (15-second safe)
 */
export const internalRepairProcessThemeAggregatesBatch = internalMutation({
  args: {
    themeIds: v.array(v.id('themes')),
  },
  returns: v.object({
    processed: v.number(),
  }),
  handler: async (ctx, args) => {
    let processed = 0;

    for (const themeId of args.themeIds) {
      // Clear theme aggregate
      await questionCountByTheme.clear(ctx, { namespace: themeId });
      // Get questions for this theme
      const questions = await ctx.db
        .query('questions')
        .withIndex('by_theme', q => q.eq('themeId', themeId))
        .collect();

      // Insert all questions for this theme
      for (const question of questions) {
        await questionCountByTheme.insertIfDoesNotExist(ctx, question);
      }

      processed++;
      console.log(`Processed theme ${themeId}: ${questions.length} questions`);
    }

    return { processed };
  },
});

/**
 * Process subtheme aggregates batch (15-second safe)
 */
export const internalRepairProcessSubthemeAggregatesBatch = internalMutation({
  args: {
    subthemeIds: v.array(v.id('subthemes')),
  },
  returns: v.object({
    processed: v.number(),
  }),
  handler: async (ctx, args) => {
    let processed = 0;

    for (const subthemeId of args.subthemeIds) {
      // Clear subtheme aggregate
      await questionCountBySubtheme.clear(ctx, { namespace: subthemeId });

      // Get questions for this subtheme
      const questions = await ctx.db
        .query('questions')
        .withIndex('by_subtheme', q => q.eq('subthemeId', subthemeId))
        .collect();

      // Insert all questions for this subtheme
      for (const question of questions) {
        await questionCountBySubtheme.insertIfDoesNotExist(ctx, question);
      }

      processed++;
      console.log(
        `Processed subtheme ${subthemeId}: ${questions.length} questions`,
      );
    }

    return { processed };
  },
});

/**
 * Process group aggregates batch (15-second safe)
 */
export const internalRepairProcessGroupAggregatesBatch = internalMutation({
  args: {
    groupIds: v.array(v.id('groups')),
  },
  returns: v.object({
    processed: v.number(),
  }),
  handler: async (ctx, args) => {
    let processed = 0;

    for (const groupId of args.groupIds) {
      // Clear group aggregate
      await questionCountByGroup.clear(ctx, { namespace: groupId });

      // Get questions for this group
      const questions = await ctx.db
        .query('questions')
        .withIndex('by_group', q => q.eq('groupId', groupId))
        .collect();

      // Insert all questions for this group
      for (const question of questions) {
        await questionCountByGroup.insertIfDoesNotExist(ctx, question);
      }

      processed++;
      console.log(`Processed group ${groupId}: ${questions.length} questions`);
    }

    return { processed };
  },
});

/**
 * Get all theme IDs for batch processing
 */
export const internalRepairGetAllThemeIds = internalMutation({
  args: {},
  returns: v.array(v.id('themes')),
  handler: async ctx => {
    const themes = await ctx.db.query('themes').collect();
    return themes.map(t => t._id);
  },
});

/**
 * Get all subtheme IDs for batch processing
 */
export const internalRepairGetAllSubthemeIds = internalMutation({
  args: {},
  returns: v.array(v.id('subthemes')),
  handler: async ctx => {
    const subthemes = await ctx.db.query('subthemes').collect();
    return subthemes.map(s => s._id);
  },
});

/**
 * Get all group IDs for batch processing
 */
export const internalRepairGetAllGroupIds = internalMutation({
  args: {},
  returns: v.array(v.id('groups')),
  handler: async ctx => {
    const groups = await ctx.db.query('groups').collect();
    return groups.map(g => g._id);
  },
});

// ============================================================================
// SECTION 2: RANDOM QUESTION SELECTION AGGREGATES REPAIR (15-second safe)
// ============================================================================

/**
 * Clear Section 2 aggregates (fast operation)
 */
export const internalRepairClearSection2Aggregates = internalMutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    await randomQuestions.clear(ctx, { namespace: 'global' });
    console.log('Section 2 aggregates cleared');
    return null;
  },
});

/**
 * Process questions batch for random selection (15-second safe)
 */
export const internalRepairProcessQuestionsBatchRandom = internalMutation({
  args: {
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

    const result = await ctx.db.query('questions').paginate({
      cursor: args.cursor,
      numItems: batchSize,
    });

    // Process this batch
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
 * Process theme random aggregates batch (15-second safe)
 */
export const internalRepairProcessThemeRandomAggregatesBatch = internalMutation(
  {
    args: {
      themeIds: v.array(v.id('themes')),
    },
    returns: v.object({
      processed: v.number(),
    }),
    handler: async (ctx, args) => {
      let processed = 0;

      for (const themeId of args.themeIds) {
        // Clear theme random aggregate
        await randomQuestionsByTheme.clear(ctx, { namespace: themeId });
        // Get questions for this theme
        const questions = await ctx.db
          .query('questions')
          .withIndex('by_theme', q => q.eq('themeId', themeId))
          .collect();

        // Insert all questions for this theme
        for (const question of questions) {
          await randomQuestionsByTheme.insertIfDoesNotExist(ctx, question);
        }

        processed++;
        console.log(
          `Processed theme random ${themeId}: ${questions.length} questions`,
        );
      }

      return { processed };
    },
  },
);

/**
 * Process subtheme random aggregates batch (15-second safe)
 */
export const internalRepairProcessSubthemeRandomAggregatesBatch =
  internalMutation({
    args: {
      subthemeIds: v.array(v.id('subthemes')),
    },
    returns: v.object({
      processed: v.number(),
    }),
    handler: async (ctx, args) => {
      let processed = 0;

      for (const subthemeId of args.subthemeIds) {
        // Clear subtheme random aggregate
        await randomQuestionsBySubtheme.clear(ctx, { namespace: subthemeId });

        // Get questions for this subtheme
        const questions = await ctx.db
          .query('questions')
          .withIndex('by_subtheme', q => q.eq('subthemeId', subthemeId))
          .collect();

        // Insert all questions for this subtheme
        for (const question of questions) {
          await randomQuestionsBySubtheme.insertIfDoesNotExist(ctx, question);
        }

        processed++;
        console.log(
          `Processed subtheme random ${subthemeId}: ${questions.length} questions`,
        );
      }

      return { processed };
    },
  });

/**
 * Process group random aggregates batch (15-second safe)
 */
export const internalRepairProcessGroupRandomAggregatesBatch = internalMutation(
  {
    args: {
      groupIds: v.array(v.id('groups')),
    },
    returns: v.object({
      processed: v.number(),
    }),
    handler: async (ctx, args) => {
      let processed = 0;

      for (const groupId of args.groupIds) {
        // Clear group random aggregate
        await randomQuestionsByGroup.clear(ctx, { namespace: groupId });

        // Get questions for this group
        const questions = await ctx.db
          .query('questions')
          .withIndex('by_group', q => q.eq('groupId', groupId))
          .collect();

        // Insert all questions for this group
        for (const question of questions) {
          await randomQuestionsByGroup.insertIfDoesNotExist(ctx, question);
        }

        processed++;
        console.log(
          `Processed group random ${groupId}: ${questions.length} questions`,
        );
      }

      return { processed };
    },
  },
);

// ============================================================================
// SECTION 3: USER-SPECIFIC AGGREGATES REPAIR - REMOVED
// ============================================================================

// All Section 3 user-specific aggregate repair functions have been removed.
// User statistics are now efficiently handled by the userStatsCounts table,
// which provides much better performance than the old aggregate system.

// All remaining user-specific aggregate repair functions have been removed.
// The userStatsCounts table now handles all user statistics efficiently.
