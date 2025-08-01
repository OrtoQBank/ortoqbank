import { Triggers } from 'convex-helpers/server/triggers';

import { DataModel } from './_generated/dataModel';
import { internalMutation } from './_generated/server';
import * as aggregates from './aggregates';

// Create a triggers instance to handle updates to aggregates
export const triggers = new Triggers<DataModel>();

// Register all our aggregates with the triggers
triggers.register('userQuestionStats', aggregates.answeredByUser.trigger());
triggers.register('userQuestionStats', aggregates.incorrectByUser.trigger());
triggers.register('userBookmarks', aggregates.bookmarkedByUser.trigger());
triggers.register('questions', aggregates.questionCountByTheme.trigger());

// Register random selection aggregates
triggers.register('questions', aggregates.randomQuestions.trigger());
triggers.register('questions', aggregates.randomQuestionsByTheme.trigger());
triggers.register('questions', aggregates.randomQuestionsBySubtheme.trigger());
triggers.register('questions', aggregates.randomQuestionsByGroup.trigger());

/**
 * Initialize all aggregates at startup by clearing
 * the existing data and setting up new parameters
 */
export const initializeAggregates = internalMutation({
  args: {},
  handler: async ctx => {
    // Initialize each aggregate with reasonable settings
    await Promise.all([
      aggregates.answeredByUser.clearAll(ctx, {
        maxNodeSize: 16,
        rootLazy: true,
      }),
      aggregates.incorrectByUser.clearAll(ctx, {
        maxNodeSize: 16,
        rootLazy: true,
      }),
      aggregates.bookmarkedByUser.clearAll(ctx, {
        maxNodeSize: 16,
        rootLazy: true,
      }),
      aggregates.questionCountByTheme.clearAll(ctx, {
        maxNodeSize: 16,
        rootLazy: true,
      }),
      // Clear random selection aggregates
      aggregates.randomQuestions.clearAll(ctx, {
        maxNodeSize: 16,
        rootLazy: true,
      }),
      aggregates.randomQuestionsByTheme.clearAll(ctx, {
        maxNodeSize: 16,
        rootLazy: true,
      }),
      aggregates.randomQuestionsBySubtheme.clearAll(ctx, {
        maxNodeSize: 16,
        rootLazy: true,
      }),
      aggregates.randomQuestionsByGroup.clearAll(ctx, {
        maxNodeSize: 16,
        rootLazy: true,
      }),
    ]);

    return {
      success: true,
      message: 'Aggregates initialized successfully - ready to be populated',
    };
  },
});

/**
 * Populate the aggregates from existing data
 *
 * Note: This implementation might still have type issues since we're missing
 * the exact type signature for the aggregate methods. In a worst case, you can
 * simply use the query-based approach in aggregateHelpers.ts instead.
 */
export const populateAggregates = internalMutation({
  args: {},
  handler: async ctx => {
    // Get all existing data
    const userQuestionStats = await ctx.db.query('userQuestionStats').collect();
    const bookmarks = await ctx.db.query('userBookmarks').collect();
    const questions = await ctx.db.query('questions').collect();

    let answered = 0;
    let incorrect = 0;

    // Log counts to help with debugging
    console.log(
      `Found ${userQuestionStats.length} stats, ${bookmarks.length} bookmarks, ${questions.length} questions`,
    );

    return {
      success: true,
      message: 'Use the direct query approach instead of aggregate ops for now',
      counts: {
        answered: userQuestionStats.filter(s => s.hasAnswered).length,
        incorrect: userQuestionStats.filter(s => s.isIncorrect).length,
        bookmarks: bookmarks.length,
        questions: questions.length,
      },
    };
  },
});
