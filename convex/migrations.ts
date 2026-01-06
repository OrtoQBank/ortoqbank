import { Migrations } from '@convex-dev/migrations';
import { v } from 'convex/values';

import { components, internal } from './_generated/api';
import { DataModel, Id } from './_generated/dataModel';
import {
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server';

// Initialize migrations component
export const migrations = new Migrations<DataModel>(components.migrations);

// Runner functions for executing migrations
export const run = migrations.runner();

// =============================================================================
// MULTI-TENANCY MIGRATIONS
// =============================================================================

/**
 * Get or create the default app for migration
 * Call this FIRST before running any tenantId backfill migrations
 */
export const getOrCreateDefaultApp = internalMutation({
  args: {
    slug: v.optional(v.string()),
    name: v.optional(v.string()),
    domain: v.optional(v.string()),
  },
  returns: v.id('apps'),
  handler: async (ctx, args) => {
    const slug = args.slug || 'ortoqbank';
    const name = args.name || 'OrtoQBank';
    const domain = args.domain || 'ortoqbank.com';

    // Check if default app already exists
    const existingApp = await ctx.db
      .query('apps')
      .withIndex('by_slug', q => q.eq('slug', slug))
      .first();

    if (existingApp) {
      console.log(`Default app already exists: ${existingApp._id}`);
      return existingApp._id;
    }

    // Create default app
    const appId = await ctx.db.insert('apps', {
      slug,
      name,
      domain,
      description: 'Default OrtoQBank application',
      isActive: true,
      createdAt: Date.now(),
    });

    console.log(`Created default app: ${appId}`);
    return appId;
  },
});

/**
 * Get the default app ID (query version for use in migrations)
 */
export const getDefaultAppId = internalQuery({
  args: {
    slug: v.optional(v.string()),
  },
  returns: v.union(v.id('apps'), v.null()),
  handler: async (ctx, args) => {
    const slug = args.slug || 'ortoqbank';
    const app = await ctx.db
      .query('apps')
      .withIndex('by_slug', q => q.eq('slug', slug))
      .first();
    return app?._id || null;
  },
});

// Runner for multi-tenancy migrations (run in order)
export const runMultiTenancyMigrations = migrations.runner([
  internal.migrations.backfillThemesTenantId,
  internal.migrations.backfillSubthemesTenantId,
  internal.migrations.backfillGroupsTenantId,
  internal.migrations.backfillQuestionsTenantId,
  internal.migrations.backfillPresetQuizzesTenantId,
  internal.migrations.backfillCustomQuizzesTenantId,
  internal.migrations.backfillQuizSessionsTenantId,
  internal.migrations.backfillUserBookmarksTenantId,
  internal.migrations.backfillUserQuestionStatsTenantId,
  internal.migrations.backfillUserStatsCountsTenantId,
]);

// Runner for question denormalization migrations
export const runDenormalizationMigrations = migrations.runner([
  internal.migrations.backfillQuestionDenormalizedNames,
  internal.migrations.migrateQuestionContent,
]);

/**
 * Backfill tenantId for themes table
 */
export const backfillThemesTenantId = migrations.define({
  table: 'themes',
  migrateOne: async (
    ctx,
    doc,
  ): Promise<{ tenantId: Id<'apps'> } | undefined> => {
    // Skip if already has tenantId
    if (doc.tenantId) {
      return;
    }

    const defaultAppId = await ctx.runQuery(
      internal.migrations.getDefaultAppId,
      {},
    );
    if (!defaultAppId) {
      throw new Error(
        'Default app not found. Run getOrCreateDefaultApp first.',
      );
    }
    return { tenantId: defaultAppId };
  },
});

/**
 * Backfill tenantId for subthemes table
 */
export const backfillSubthemesTenantId = migrations.define({
  table: 'subthemes',
  migrateOne: async (
    ctx,
    doc,
  ): Promise<{ tenantId: Id<'apps'> } | undefined> => {
    if (doc.tenantId) return;

    const defaultAppId = await ctx.runQuery(
      internal.migrations.getDefaultAppId,
      {},
    );
    if (!defaultAppId) {
      throw new Error(
        'Default app not found. Run getOrCreateDefaultApp first.',
      );
    }
    return { tenantId: defaultAppId };
  },
});

/**
 * Backfill tenantId for groups table
 */
export const backfillGroupsTenantId = migrations.define({
  table: 'groups',
  migrateOne: async (
    ctx,
    doc,
  ): Promise<{ tenantId: Id<'apps'> } | undefined> => {
    if (doc.tenantId) return;

    const defaultAppId = await ctx.runQuery(
      internal.migrations.getDefaultAppId,
      {},
    );
    if (!defaultAppId) {
      throw new Error(
        'Default app not found. Run getOrCreateDefaultApp first.',
      );
    }
    return { tenantId: defaultAppId };
  },
});

/**
 * Backfill tenantId for questions table
 */
export const backfillQuestionsTenantId = migrations.define({
  table: 'questions',
  migrateOne: async (
    ctx,
    doc,
  ): Promise<{ tenantId: Id<'apps'> } | undefined> => {
    if (doc.tenantId) return;

    const defaultAppId = await ctx.runQuery(
      internal.migrations.getDefaultAppId,
      {},
    );
    if (!defaultAppId) {
      throw new Error(
        'Default app not found. Run getOrCreateDefaultApp first.',
      );
    }
    return { tenantId: defaultAppId };
  },
});

/**
 * Backfill tenantId for presetQuizzes table
 */
export const backfillPresetQuizzesTenantId = migrations.define({
  table: 'presetQuizzes',
  migrateOne: async (
    ctx,
    doc,
  ): Promise<{ tenantId: Id<'apps'> } | undefined> => {
    if (doc.tenantId) return;

    const defaultAppId = await ctx.runQuery(
      internal.migrations.getDefaultAppId,
      {},
    );
    if (!defaultAppId) {
      throw new Error(
        'Default app not found. Run getOrCreateDefaultApp first.',
      );
    }
    return { tenantId: defaultAppId };
  },
});

/**
 * Backfill tenantId for customQuizzes table
 */
export const backfillCustomQuizzesTenantId = migrations.define({
  table: 'customQuizzes',
  migrateOne: async (
    ctx,
    doc,
  ): Promise<{ tenantId: Id<'apps'> } | undefined> => {
    if (doc.tenantId) return;

    const defaultAppId = await ctx.runQuery(
      internal.migrations.getDefaultAppId,
      {},
    );
    if (!defaultAppId) {
      throw new Error(
        'Default app not found. Run getOrCreateDefaultApp first.',
      );
    }
    return { tenantId: defaultAppId };
  },
});

/**
 * Backfill tenantId for quizSessions table
 */
export const backfillQuizSessionsTenantId = migrations.define({
  table: 'quizSessions',
  migrateOne: async (
    ctx,
    doc,
  ): Promise<{ tenantId: Id<'apps'> } | undefined> => {
    if (doc.tenantId) return;

    const defaultAppId = await ctx.runQuery(
      internal.migrations.getDefaultAppId,
      {},
    );
    if (!defaultAppId) {
      throw new Error(
        'Default app not found. Run getOrCreateDefaultApp first.',
      );
    }
    return { tenantId: defaultAppId };
  },
});

/**
 * Backfill tenantId for userBookmarks table
 */
export const backfillUserBookmarksTenantId = migrations.define({
  table: 'userBookmarks',
  migrateOne: async (
    ctx,
    doc,
  ): Promise<{ tenantId: Id<'apps'> } | undefined> => {
    if (doc.tenantId) return;

    const defaultAppId = await ctx.runQuery(
      internal.migrations.getDefaultAppId,
      {},
    );
    if (!defaultAppId) {
      throw new Error(
        'Default app not found. Run getOrCreateDefaultApp first.',
      );
    }
    return { tenantId: defaultAppId };
  },
});

/**
 * Backfill tenantId for userQuestionStats table
 */
export const backfillUserQuestionStatsTenantId = migrations.define({
  table: 'userQuestionStats',
  migrateOne: async (
    ctx,
    doc,
  ): Promise<{ tenantId: Id<'apps'> } | undefined> => {
    if (doc.tenantId) return;

    const defaultAppId = await ctx.runQuery(
      internal.migrations.getDefaultAppId,
      {},
    );
    if (!defaultAppId) {
      throw new Error(
        'Default app not found. Run getOrCreateDefaultApp first.',
      );
    }
    return { tenantId: defaultAppId };
  },
});

/**
 * Backfill tenantId for userStatsCounts table
 */
export const backfillUserStatsCountsTenantId = migrations.define({
  table: 'userStatsCounts',
  migrateOne: async (
    ctx,
    doc,
  ): Promise<{ tenantId: Id<'apps'> } | undefined> => {
    if (doc.tenantId) return;

    const defaultAppId = await ctx.runQuery(
      internal.migrations.getDefaultAppId,
      {},
    );
    if (!defaultAppId) {
      throw new Error(
        'Default app not found. Run getOrCreateDefaultApp first.',
      );
    }
    return { tenantId: defaultAppId };
  },
});

/**
 * Backfill denormalized theme/subtheme/group names on questions
 */
export const backfillQuestionDenormalizedNames = migrations.define({
  table: 'questions',
  migrateOne: async (
    ctx,
    doc,
  ): Promise<
    | {
        themeName?: string;
        subthemeName?: string;
        groupName?: string;
        alternativeCount?: number;
      }
    | undefined
  > => {
    // Skip if already has denormalized names
    if (doc.themeName) {
      return;
    }

    const updates: {
      themeName?: string;
      subthemeName?: string;
      groupName?: string;
      alternativeCount?: number;
    } = {};

    // Get theme name
    const theme = await ctx.db.get(doc.themeId);
    if (theme) {
      updates.themeName = theme.name;
    }

    // Get subtheme name if exists
    if (doc.subthemeId) {
      const subtheme = await ctx.db.get(doc.subthemeId);
      if (subtheme) {
        updates.subthemeName = subtheme.name;
      }
    }

    // Get group name if exists
    if (doc.groupId) {
      const group = await ctx.db.get(doc.groupId);
      if (group) {
        updates.groupName = group.name;
      }
    }

    // Set alternative count (from legacy field or default to 0)
    if (doc.alternatives && !doc.alternativeCount) {
      updates.alternativeCount = doc.alternatives.length;
    }

    return Object.keys(updates).length > 0 ? updates : undefined;
  },
});

/**
 * Migrate question content to separate questionContent table
 * This moves heavy content (questionTextString, explanationTextString, alternatives)
 * to the questionContent table for better query performance
 */
export const migrateQuestionContent = migrations.define({
  table: 'questions',
  migrateOne: async (ctx, doc): Promise<undefined> => {
    // Check if questionContent ACTUALLY exists for this question (don't rely on flag)
    const existingContent = await ctx.db
      .query('questionContent')
      .withIndex('by_question', q => q.eq('questionId', doc._id))
      .first();

    // Skip if content already exists in questionContent table
    if (existingContent) {
      return;
    }

    // Skip if no content to migrate
    if (
      !doc.questionTextString &&
      !doc.explanationTextString &&
      !doc.alternatives
    ) {
      return;
    }

    // Create questionContent record with the heavy content
    await ctx.db.insert('questionContent', {
      questionId: doc._id,
      questionTextString: doc.questionTextString || '',
      explanationTextString: doc.explanationTextString || '',
      alternatives: doc.alternatives || [],
      // Also migrate legacy rich text fields if they exist
      questionText: doc.questionText,
      explanationText: doc.explanationText,
    });

    // No need to update contentMigrated flag - we check actual content existence
    return;
  },
});

/**
 * Master action to run all multi-tenancy setup
 * Run this action to perform the complete multi-tenancy migration
 */
export const setupMultiTenancy = internalAction({
  args: {
    defaultAppSlug: v.optional(v.string()),
    defaultAppName: v.optional(v.string()),
    defaultAppDomain: v.optional(v.string()),
  },
  returns: v.object({
    defaultAppId: v.id('apps'),
    message: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ defaultAppId: Id<'apps'>; message: string }> => {
    console.log('=== Starting Multi-Tenancy Setup ===');

    // Step 1: Create default app
    console.log('Step 1: Creating/getting default app...');
    const defaultAppId: Id<'apps'> = await ctx.runMutation(
      internal.migrations.getOrCreateDefaultApp,
      {
        slug: args.defaultAppSlug,
        name: args.defaultAppName,
        domain: args.defaultAppDomain,
      },
    );
    console.log(`Default app ID: ${defaultAppId}`);

    // Step 2: Run tenantId backfill migrations
    console.log('Step 2: Running tenantId backfill migrations...');
    console.log('Run the following in Convex dashboard:');
    console.log('  npx convex run migrations:runMultiTenancyMigrations');

    // Step 3: Run denormalization migrations
    console.log(
      'Step 3: After tenantId backfill, run denormalization migrations:',
    );
    console.log('  npx convex run migrations:runDenormalizationMigrations');

    return {
      defaultAppId,
      message: `Multi-tenancy setup initiated. Default app created: ${defaultAppId}. Now run the migration runners.`,
    };
  },
});

// =============================================================================
// ADDITIONAL TENANTID MIGRATIONS (coupons, pricingPlans, waitlist)
// =============================================================================

/**
 * Backfill tenantId for coupons table
 */
export const backfillCouponsTenantId = migrations.define({
  table: 'coupons',
  migrateOne: async (
    ctx,
    doc,
  ): Promise<{ tenantId: Id<'apps'> } | undefined> => {
    if (doc.tenantId) return;

    const defaultAppId = await ctx.runQuery(
      internal.migrations.getDefaultAppId,
      {},
    );
    if (!defaultAppId) {
      throw new Error(
        'Default app not found. Run getOrCreateDefaultApp first.',
      );
    }
    return { tenantId: defaultAppId };
  },
});

/**
 * Backfill tenantId for pricingPlans table
 */
export const backfillPricingPlansTenantId = migrations.define({
  table: 'pricingPlans',
  migrateOne: async (
    ctx,
    doc,
  ): Promise<{ tenantId: Id<'apps'> } | undefined> => {
    if (doc.tenantId) return;

    const defaultAppId = await ctx.runQuery(
      internal.migrations.getDefaultAppId,
      {},
    );
    if (!defaultAppId) {
      throw new Error(
        'Default app not found. Run getOrCreateDefaultApp first.',
      );
    }
    return { tenantId: defaultAppId };
  },
});

/**
 * Backfill tenantId for waitlist table
 */
export const backfillWaitlistTenantId = migrations.define({
  table: 'waitlist',
  migrateOne: async (
    ctx,
    doc,
  ): Promise<{ tenantId: Id<'apps'> } | undefined> => {
    if (doc.tenantId) return;

    const defaultAppId = await ctx.runQuery(
      internal.migrations.getDefaultAppId,
      {},
    );
    if (!defaultAppId) {
      throw new Error(
        'Default app not found. Run getOrCreateDefaultApp first.',
      );
    }
    return { tenantId: defaultAppId };
  },
});

// Runner for additional tables (coupons, pricingPlans, waitlist)
export const runAdditionalTenantIdMigrations = migrations.runner([
  internal.migrations.backfillCouponsTenantId,
  internal.migrations.backfillPricingPlansTenantId,
  internal.migrations.backfillWaitlistTenantId,
]);

// =============================================================================
// COMPLETED QUIZ SUMMARIES MIGRATION
// =============================================================================

/**
 * Backfill completedQuizSummaries from existing completed quizSessions
 * This creates lightweight summary records for performance optimization
 */
export const backfillCompletedQuizSummaries = migrations.define({
  table: 'quizSessions',
  migrateOne: async (ctx, doc): Promise<undefined> => {
    // Skip if not complete
    if (!doc.isComplete) {
      return;
    }

    // Check if summary already exists for this session
    const existing = await ctx.db
      .query('completedQuizSummaries')
      .withIndex('by_session', q => q.eq('sessionId', doc._id))
      .first();

    if (existing) {
      return;
    }

    // Create summary record
    await ctx.db.insert('completedQuizSummaries', {
      tenantId: doc.tenantId,
      userId: doc.userId,
      quizId: doc.quizId,
      sessionId: doc._id,
      completedAt: doc._creationTime, // Use session creation time as fallback
    });

    return;
  },
});

// Runner for completed quiz summaries backfill
export const runCompletedQuizSummariesMigration = migrations.runner([
  internal.migrations.backfillCompletedQuizSummaries,
]);

// =============================================================================
// QUESTION CONTENT CLEANUP MIGRATION
// =============================================================================

/**
 * Remove heavy content fields from questions table.
 *
 * PREREQUISITES:
 * 1. ALL read operations MUST be updated to fetch from questionContent table
 * 2. Verify that questionContent records exist for all questions
 * 3. Run this ONLY after confirming the app works correctly with questionContent
 *
 * This migration removes the following fields from questions documents:
 * - questionTextString
 * - explanationTextString
 * - alternatives
 * - questionText (legacy object format)
 * - explanationText (legacy object format)
 *
 * After running this migration, questions will be significantly smaller,
 * preventing 16MB limit issues during quiz creation queries.
 */
export const removeHeavyContentFromQuestions = migrations.define({
  table: 'questions',
  migrateOne: async (
    ctx,
    doc,
  ): Promise<
    | {
        questionTextString?: undefined;
        explanationTextString?: undefined;
        alternatives?: undefined;
        questionText?: undefined;
        explanationText?: undefined;
      }
    | undefined
  > => {
    // Skip if already cleaned up (no heavy content fields)
    if (
      doc.questionTextString === undefined &&
      doc.explanationTextString === undefined &&
      doc.alternatives === undefined &&
      doc.questionText === undefined &&
      doc.explanationText === undefined
    ) {
      return;
    }

    // Verify questionContent exists before removing from questions
    const questionContent = await ctx.db
      .query('questionContent')
      .withIndex('by_question', q => q.eq('questionId', doc._id))
      .first();

    if (!questionContent) {
      // Log warning but don't fail - content might need to be backfilled separately
      console.warn(
        `Question ${doc._id} has no questionContent record. Skipping cleanup.`,
      );
      return;
    }

    // Return the fields to set to undefined (removes them from the document)
    return {
      questionTextString: undefined,
      explanationTextString: undefined,
      alternatives: undefined,
      questionText: undefined,
      explanationText: undefined,
    };
  },
});

// Runner for removing heavy content from questions
export const runRemoveHeavyContentMigration = migrations.runner([
  internal.migrations.removeHeavyContentFromQuestions,
]);

/**
 * Verify migration: Check that all questions have content in questionContent table
 * Run this BEFORE the cleanup migration to ensure data integrity
 */
export const verifyQuestionContentExists = internalQuery({
  args: {},
  handler: async ctx => {
    const questions = await ctx.db.query('questions').collect();
    const missing: Id<'questions'>[] = [];

    for (const question of questions) {
      const content = await ctx.db
        .query('questionContent')
        .withIndex('by_question', q => q.eq('questionId', question._id))
        .first();

      if (!content) {
        missing.push(question._id);
      }
    }

    return {
      totalQuestions: questions.length,
      questionsWithContent: questions.length - missing.length,
      missingContent: missing,
    };
  },
});
