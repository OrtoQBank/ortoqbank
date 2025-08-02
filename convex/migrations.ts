import { Migrations } from '@convex-dev/migrations';
import { v } from 'convex/values';

import { components } from './_generated/api';
import { internal } from './_generated/api';
import { DataModel } from './_generated/dataModel';
import { internalAction, internalMutation } from './_generated/server';

// Initialize migrations component
export const migrations = new Migrations<DataModel>(components.migrations);

// Runner functions for executing migrations
export const run = migrations.runner();

// Run taxonomy migrations for both tables
export const runTaxonomyMigrations = migrations.runner([
  internal.migrations.populateUserQuestionStatsTaxonomy,
  internal.migrations.populateUserBookmarksTaxonomy,
]);

// Individual migration runners
export const runUserStatsOnly = migrations.runner(
  internal.migrations.populateUserQuestionStatsTaxonomy,
);
export const runBookmarksOnly = migrations.runner(
  internal.migrations.populateUserBookmarksTaxonomy,
);

/**
 * Migration to populate taxonomy fields in userQuestionStats
 * This migration adds themeId, subthemeId, and groupId to existing records
 */
export const populateUserQuestionStatsTaxonomy = migrations.define({
  table: 'userQuestionStats',
  migrateOne: async (ctx, userStat) => {
    // Skip if taxonomy fields are already populated
    if (userStat.themeId) {
      return; // No update needed
    }

    // Get the question to extract taxonomy fields
    const question = await ctx.db.get(userStat.questionId);
    if (!question) {
      console.warn(
        `Question ${userStat.questionId} not found for userStat ${userStat._id}`,
      );
      return;
    }

    // Return the patch data to update taxonomy fields
    // Only include taxonomy fields that exist to avoid issues with hierarchical aggregates
    const updateData: any = {
      themeId: question.themeId,
    };

    // Only include optional taxonomy fields if they exist
    if (question.subthemeId) {
      updateData.subthemeId = question.subthemeId;
    }
    if (question.groupId) {
      updateData.groupId = question.groupId;
    }

    return updateData;
  },
});

/**
 * Migration to populate taxonomy fields in userBookmarks
 * This migration adds themeId, subthemeId, and groupId to existing records
 */
export const populateUserBookmarksTaxonomy = migrations.define({
  table: 'userBookmarks',
  migrateOne: async (ctx, bookmark) => {
    // Skip if taxonomy fields are already populated
    if (bookmark.themeId) {
      return; // No update needed
    }

    // Get the question to extract taxonomy fields
    const question = await ctx.db.get(bookmark.questionId);
    if (!question) {
      console.warn(
        `Question ${bookmark.questionId} not found for bookmark ${bookmark._id}`,
      );
      return;
    }

    // Return the patch data to update taxonomy fields
    // Only include taxonomy fields that exist to avoid issues with hierarchical aggregates
    const updateData: any = {
      themeId: question.themeId,
    };

    // Only include optional taxonomy fields if they exist
    if (question.subthemeId) {
      updateData.subthemeId = question.subthemeId;
    }
    if (question.groupId) {
      updateData.groupId = question.groupId;
    }

    return updateData;
  },
});

/**
 * Clean up old taxonomy fields using manual document replacement
 * This approach works when fields are no longer in the schema
 */
export const cleanupOldTaxonomyFields = internalAction({
  args: {
    table: v.union(
      v.literal('presetQuizzes'),
      v.literal('customQuizzes'),
      v.literal('questions'),
    ),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processedCount: v.number(),
    updatedCount: v.number(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 50;
    let totalProcessed = 0;
    let totalUpdated = 0;
    let hasMore = true;
    let lastProcessedTime: number | undefined;

    console.log(
      `Starting cleanup of ${args.table} with batch size: ${batchSize}`,
    );

    while (hasMore) {
      const result = await ctx.runMutation(internal.migrations.processBatch, {
        table: args.table,
        batchSize,
        lastProcessedTime,
      });

      totalProcessed += result.processedCount;
      totalUpdated += result.updatedCount;
      hasMore = result.hasMore;
      lastProcessedTime = result.lastProcessedTime;

      // Small delay between batches
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const message = `${args.table} cleanup completed. Processed: ${totalProcessed}, Updated: ${totalUpdated}`;
    console.log(message);

    return {
      processedCount: totalProcessed,
      updatedCount: totalUpdated,
      message,
    };
  },
});

/**
 * Process a single batch of documents
 */
export const processBatch = internalMutation({
  args: {
    table: v.union(
      v.literal('presetQuizzes'),
      v.literal('customQuizzes'),
      v.literal('questions'),
    ),
    batchSize: v.number(),
    lastProcessedTime: v.optional(v.number()),
  },
  returns: v.object({
    processedCount: v.number(),
    updatedCount: v.number(),
    hasMore: v.boolean(),
    lastProcessedTime: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    // Fetch batch using cursor-based pagination with creation time
    let batch: any[];
    if (args.table === 'presetQuizzes') {
      const query = ctx.db.query('presetQuizzes').order('asc');
      batch = args.lastProcessedTime
        ? await query
            .filter(q =>
              q.gt(q.field('_creationTime'), args.lastProcessedTime!),
            )
            .take(args.batchSize)
        : await query.take(args.batchSize);
    } else if (args.table === 'customQuizzes') {
      const query = ctx.db.query('customQuizzes').order('asc');
      batch = args.lastProcessedTime
        ? await query
            .filter(q =>
              q.gt(q.field('_creationTime'), args.lastProcessedTime!),
            )
            .take(args.batchSize)
        : await query.take(args.batchSize);
    } else {
      const query = ctx.db.query('questions').order('asc');
      batch = args.lastProcessedTime
        ? await query
            .filter(q =>
              q.gt(q.field('_creationTime'), args.lastProcessedTime!),
            )
            .take(args.batchSize)
        : await query.take(args.batchSize);
    }

    let updatedCount = 0;
    let lastProcessedTime: number | undefined;

    for (const doc of batch) {
      let hasOldFields = false;
      let fieldsToRemove: string[] = [];

      // Track the last processed document's creation time
      lastProcessedTime = doc._creationTime;

      // Check for old fields based on table type
      switch (args.table) {
        case 'presetQuizzes': {
          if ('TaxThemeId' in doc) fieldsToRemove.push('TaxThemeId');
          if ('TaxSubthemeId' in doc) fieldsToRemove.push('TaxSubthemeId');
          if ('TaxGroupId' in doc) fieldsToRemove.push('TaxGroupId');
          if ('taxonomyPathIds' in doc) fieldsToRemove.push('taxonomyPathIds');

          break;
        }
        case 'customQuizzes': {
          if ('selectedTaxThemes' in doc)
            fieldsToRemove.push('selectedTaxThemes');
          if ('selectedTaxSubthemes' in doc)
            fieldsToRemove.push('selectedTaxSubthemes');
          if ('selectedTaxGroups' in doc)
            fieldsToRemove.push('selectedTaxGroups');
          if ('taxonomyPathIds' in doc) fieldsToRemove.push('taxonomyPathIds');

          break;
        }
        case 'questions': {
          if ('TaxThemeId' in doc) fieldsToRemove.push('TaxThemeId');
          if ('TaxSubthemeId' in doc) fieldsToRemove.push('TaxSubthemeId');
          if ('TaxGroupId' in doc) fieldsToRemove.push('TaxGroupId');
          if ('taxonomyPathIds' in doc) fieldsToRemove.push('taxonomyPathIds');

          break;
        }
        // No default
      }

      hasOldFields = fieldsToRemove.length > 0;

      if (hasOldFields) {
        // Create new document without old fields
        const cleanDoc: any = {};
        Object.keys(doc).forEach(key => {
          if (
            !fieldsToRemove.includes(key) &&
            key !== '_id' &&
            key !== '_creationTime'
          ) {
            cleanDoc[key] = doc[key];
          }
        });

        // Replace the document
        await ctx.db.replace(doc._id, cleanDoc);
        updatedCount++;

        console.log(
          `Cleaned ${args.table} document ${doc._id} - removed: ${fieldsToRemove.join(', ')}`,
        );
      }
    }

    return {
      processedCount: batch.length,
      updatedCount,
      hasMore: batch.length === args.batchSize, // If we got fewer than requested, we're done
      lastProcessedTime,
    };
  },
});

/**
 * Run all taxonomy cleanup operations
 */
export const runAllTaxonomyCleanup = internalAction({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    presetQuizzesResult: v.object({
      processedCount: v.number(),
      updatedCount: v.number(),
      message: v.string(),
    }),
    customQuizzesResult: v.object({
      processedCount: v.number(),
      updatedCount: v.number(),
      message: v.string(),
    }),
    questionsResult: v.object({
      processedCount: v.number(),
      updatedCount: v.number(),
      message: v.string(),
    }),
    overallMessage: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    presetQuizzesResult: {
      processedCount: number;
      updatedCount: number;
      message: string;
    };
    customQuizzesResult: {
      processedCount: number;
      updatedCount: number;
      message: string;
    };
    questionsResult: {
      processedCount: number;
      updatedCount: number;
      message: string;
    };
    overallMessage: string;
  }> => {
    const batchSize = args.batchSize || 50;

    console.log('Starting full taxonomy cleanup...');

    // Clean up each table
    const presetQuizzesResult: {
      processedCount: number;
      updatedCount: number;
      message: string;
    } = await ctx.runAction(internal.migrations.cleanupOldTaxonomyFields, {
      table: 'presetQuizzes',
      batchSize,
    });

    const customQuizzesResult: {
      processedCount: number;
      updatedCount: number;
      message: string;
    } = await ctx.runAction(internal.migrations.cleanupOldTaxonomyFields, {
      table: 'customQuizzes',
      batchSize,
    });

    const questionsResult: {
      processedCount: number;
      updatedCount: number;
      message: string;
    } = await ctx.runAction(internal.migrations.cleanupOldTaxonomyFields, {
      table: 'questions',
      batchSize,
    });

    const overallMessage =
      `Full taxonomy cleanup completed! ` +
      `PresetQuizzes: ${presetQuizzesResult.updatedCount} updated. ` +
      `CustomQuizzes: ${customQuizzesResult.updatedCount} updated. ` +
      `Questions: ${questionsResult.updatedCount} updated.`;

    console.log(overallMessage);

    return {
      presetQuizzesResult,
      customQuizzesResult,
      questionsResult,
      overallMessage,
    };
  },
});
