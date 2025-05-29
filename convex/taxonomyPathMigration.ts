import { WorkflowManager } from '@convex-dev/workflow';
import { v } from 'convex/values';

import { components, internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';

// Initialize workflow manager
export const workflow = new WorkflowManager(components.workflow);

// Define the migration workflow
export const taxonomyPathMigrationWorkflow = workflow.define({
  args: {
    batchSize: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (
    step,
    args,
  ): Promise<{ processed: number; updated: number; errors: number }> => {
    const batchSize = args.batchSize ?? 100;
    const dryRun = args.dryRun ?? false;

    console.log(
      `Starting taxonomy path migration workflow (dryRun: ${dryRun}, batchSize: ${batchSize})`,
    );

    // Step 1: Get total count of questions to migrate
    const totalCount = await step.runQuery(
      internal.taxonomyPathMigration.getDocumentsToMigrateCount,
      {},
      { name: 'count-questions-to-migrate' },
    );

    console.log(`Found ${totalCount} questions that need migration`);

    if (totalCount === 0) {
      return { processed: 0, updated: 0, errors: 0 };
    }

    let processed = 0;
    let updated = 0;
    let errors = 0;
    let cursor: string | null = null;

    // Step 2: Process questions in batches
    while (processed < totalCount) {
      const batchResult: {
        processed: number;
        updated: number;
        errors: number;
        nextCursor: string | null;
      } = await step.runMutation(
        internal.taxonomyPathMigration.migrateBatch,
        {
          batchSize,
          cursor,
          dryRun,
        },
        {
          name: `migrate-batch-${Math.floor(processed / batchSize) + 1}`,
        },
      );

      processed += batchResult.processed;
      updated += batchResult.updated;
      errors += batchResult.errors;
      cursor = batchResult.nextCursor;

      console.log(
        `Migration progress: ${processed}/${totalCount} processed, ${updated} updated, ${errors} errors`,
      );

      // Break if we've processed all questions or there's no next cursor
      if (!cursor || processed >= totalCount) {
        break;
      }

      // Add a small delay between batches to avoid overwhelming the system
      await step.runAction(
        internal.taxonomyPathMigration.delay,
        { ms: 100 },
        { name: 'batch-delay' },
      );
    }

    // Step 3: Verify migration results
    const verificationResult = await step.runQuery(
      internal.taxonomyPathMigration.verifyMigration,
      {},
      { name: 'verify-migration' },
    );

    console.log(
      `Migration completed. Total processed: ${processed}, updated: ${updated}, errors: ${errors}`,
    );
    console.log(
      `Verification: ${verificationResult.migratedCount} questions have taxonomyPathIds, ${verificationResult.remainingCount} still need migration`,
    );

    return { processed, updated, errors };
  },
});

// Query to count questions that need migration
export const getDocumentsToMigrateCount = internalQuery({
  args: {},
  returns: v.number(),
  handler: async (ctx): Promise<number> => {
    // Get all questions and filter in JavaScript since field existence checks are complex in Convex
    const allQuestions = await ctx.db.query('questions').collect();

    const questionsToMigrate = allQuestions.filter(question => {
      // Has at least one old taxonomy field
      const hasOldFields =
        question.TaxThemeId || question.TaxSubthemeId || question.TaxGroupId;
      // Doesn't have new field or it's empty
      const needsNewField =
        !question.taxonomyPathIds || question.taxonomyPathIds.length === 0;

      return hasOldFields && needsNewField;
    });

    return questionsToMigrate.length;
  },
});

// Mutation to migrate a batch of questions
export const migrateBatch = internalMutation({
  args: {
    batchSize: v.number(),
    cursor: v.union(v.string(), v.null()),
    dryRun: v.boolean(),
  },
  returns: v.object({
    processed: v.number(),
    updated: v.number(),
    errors: v.number(),
    nextCursor: v.union(v.string(), v.null()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    processed: number;
    updated: number;
    errors: number;
    nextCursor: string | null;
  }> => {
    let query = ctx.db.query('questions');

    if (args.cursor) {
      query = query.filter(q =>
        q.gt(q.field('_id'), args.cursor as Id<'questions'>),
      );
    }

    // Get a larger batch and filter in JavaScript
    const allQuestions = await query.order('asc').take(args.batchSize * 3); // Get more to account for filtering

    // Filter questions that need migration
    const questionsToMigrate = allQuestions
      .filter(question => {
        // Has at least one old taxonomy field
        const hasOldFields =
          question.TaxThemeId || question.TaxSubthemeId || question.TaxGroupId;
        // Doesn't have new field or it's empty
        const needsNewField =
          !question.taxonomyPathIds || question.taxonomyPathIds.length === 0;

        return hasOldFields && needsNewField;
      })
      .slice(0, args.batchSize); // Take only the requested batch size

    let processed = 0;
    let updated = 0;
    let errors = 0;
    let lastId: string | null = null;

    for (const question of questionsToMigrate) {
      processed++;
      lastId = question._id;

      try {
        // Build the taxonomyPathIds array from the individual fields in order
        const taxonomyPathIds: Id<'taxonomy'>[] = [];

        // Add in the correct order: Theme -> Subtheme -> Group
        if (question.TaxThemeId) {
          taxonomyPathIds.push(question.TaxThemeId);
        }
        if (question.TaxSubthemeId) {
          taxonomyPathIds.push(question.TaxSubthemeId);
        }
        if (question.TaxGroupId) {
          taxonomyPathIds.push(question.TaxGroupId);
        }

        if (taxonomyPathIds.length > 0) {
          if (!args.dryRun) {
            // Update the question with the new field
            await ctx.db.patch(question._id, {
              taxonomyPathIds,
              // Optionally remove the old fields - uncomment if you want to clean up
              // TaxThemeId: undefined,
              // TaxSubthemeId: undefined,
              // TaxGroupId: undefined,
            });
          }
          updated++;

          console.log(
            `${args.dryRun ? '[DRY RUN] ' : ''}Migrated question ${question._id}: [${taxonomyPathIds.join(', ')}]`,
          );
        }
      } catch (error) {
        errors++;
        console.error(`Error migrating question ${question._id}:`, error);
      }
    }

    // Use the last processed ID from all questions, not just migrated ones
    if (allQuestions.length > 0) {
      lastId = allQuestions.at(-1)!._id;
    }

    return {
      processed,
      updated,
      errors,
      nextCursor: lastId,
    };
  },
});

// Query to verify migration results
export const verifyMigration = internalQuery({
  args: {},
  returns: v.object({
    migratedCount: v.number(),
    remainingCount: v.number(),
  }),
  handler: async (
    ctx,
  ): Promise<{ migratedCount: number; remainingCount: number }> => {
    // Get all questions and filter in JavaScript
    const allQuestions = await ctx.db.query('questions').collect();

    // Count questions with taxonomyPathIds
    const migratedQuestions = allQuestions.filter(
      question =>
        question.taxonomyPathIds && question.taxonomyPathIds.length > 0,
    );

    // Count questions that still need migration
    const remainingQuestions = allQuestions.filter(question => {
      // Has at least one old taxonomy field
      const hasOldFields =
        question.TaxThemeId || question.TaxSubthemeId || question.TaxGroupId;
      // Doesn't have new field or it's empty
      const needsNewField =
        !question.taxonomyPathIds || question.taxonomyPathIds.length === 0;

      return hasOldFields && needsNewField;
    });

    return {
      migratedCount: migratedQuestions.length,
      remainingCount: remainingQuestions.length,
    };
  },
});

// Action to add delay between batches
export const delay = internalAction({
  args: { ms: v.number() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await new Promise(resolve => setTimeout(resolve, args.ms));
    return null;
  },
});

// Public mutation to start the migration
export const startTaxonomyPathMigration = mutation({
  args: {
    batchSize: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    console.log('Starting taxonomy path migration workflow...');

    const workflowId = await workflow.start(
      ctx,
      internal.taxonomyPathMigration.taxonomyPathMigrationWorkflow,
      {
        batchSize: args.batchSize ?? 100,
        dryRun: args.dryRun ?? false,
      },
    );

    return workflowId;
  },
});

// Handle workflow completion
export const onMigrationComplete = mutation({
  args: {
    workflowId: v.string(),
    result: v.any(),
    context: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const startTime = args.context?.startTime || 0;
    const duration = Date.now() - startTime;

    switch (args.result.kind) {
      case 'success': {
        const { processed, updated, errors } = args.result.returnValue;
        console.log(`✅ Taxonomy path migration completed successfully!`);
        console.log(
          `📊 Results: ${processed} processed, ${updated} updated, ${errors} errors`,
        );
        console.log(`⏱️ Duration: ${Math.round(duration / 1000)}s`);

        break;
      }
      case 'error': {
        console.error(`❌ Taxonomy path migration failed:`, args.result.error);

        break;
      }
      case 'canceled': {
        console.log(`⚠️ Taxonomy path migration was canceled`);

        break;
      }
      // No default
    }

    return null;
  },
});

// Public query to check migration status
export const getMigrationStatus = query({
  args: { workflowId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await workflow.status(ctx, args.workflowId as any);
  },
});

// Public mutation to cancel migration
export const cancelMigration = mutation({
  args: { workflowId: v.string() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await workflow.cancel(ctx, args.workflowId as any);
    console.log(`Migration ${args.workflowId} canceled`);
    return null;
  },
});
