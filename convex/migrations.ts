import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalAction, internalMutation } from './_generated/server';

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

    console.log(
      `Starting cleanup of ${args.table} with batch size: ${batchSize}`,
    );

    while (hasMore) {
      const result = await ctx.runMutation(internal.migrations.processBatch, {
        table: args.table,
        batchSize,
        skipCount: totalProcessed,
      });

      totalProcessed += result.processedCount;
      totalUpdated += result.updatedCount;
      hasMore = result.hasMore;

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
    skipCount: v.number(),
  },
  returns: v.object({
    processedCount: v.number(),
    updatedCount: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Get all documents from the table
    let allDocs: any[];
    if (args.table === 'presetQuizzes') {
      allDocs = await ctx.db.query('presetQuizzes').collect();
    } else if (args.table === 'customQuizzes') {
      allDocs = await ctx.db.query('customQuizzes').collect();
    } else {
      allDocs = await ctx.db.query('questions').collect();
    }

    // Get the batch to process
    const batch = allDocs.slice(
      args.skipCount,
      args.skipCount + args.batchSize,
    );
    let updatedCount = 0;

    for (const doc of batch) {
      let hasOldFields = false;
      let fieldsToRemove: string[] = [];

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
      hasMore: args.skipCount + args.batchSize < allDocs.length,
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
