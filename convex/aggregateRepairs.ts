// ============================================================================
// SIMPLE AGGREGATE REPAIR FUNCTIONS
// ============================================================================

import { v } from 'convex/values';
import { internalMutation, mutation } from './_generated/server';
import {
  answeredByUser,
  bookmarkedByUser,
  incorrectByUser,
  incorrectByThemeByUser,
  incorrectBySubthemeByUser,
  incorrectByGroupByUser,
  bookmarkedByThemeByUser,
  bookmarkedBySubthemeByUser,
  bookmarkedByGroupByUser,
  answeredByThemeByUser,
  answeredBySubthemeByUser,
  answeredByGroupByUser,
  totalQuestionCount,
} from './aggregates';

/**
 * Clear all aggregates for a user
 */
export const clearUserAggregates = internalMutation({
  args: { userId: v.id('users') },
  returns: v.null(),
  handler: async (ctx, args) => {
    await Promise.all([
      // Basic aggregates
      answeredByUser.clear(ctx, { namespace: args.userId }),
      incorrectByUser.clear(ctx, { namespace: args.userId }),
      bookmarkedByUser.clear(ctx, { namespace: args.userId }),
      // Hierarchical aggregates
      incorrectByThemeByUser.clear(ctx, { namespace: args.userId }),
      incorrectBySubthemeByUser.clear(ctx, { namespace: args.userId }),
      incorrectByGroupByUser.clear(ctx, { namespace: args.userId }),
      bookmarkedByThemeByUser.clear(ctx, { namespace: args.userId }),
      bookmarkedBySubthemeByUser.clear(ctx, { namespace: args.userId }),
      bookmarkedByGroupByUser.clear(ctx, { namespace: args.userId }),
      answeredByThemeByUser.clear(ctx, { namespace: args.userId }),
      answeredBySubthemeByUser.clear(ctx, { namespace: args.userId }),
      answeredByGroupByUser.clear(ctx, { namespace: args.userId }),
    ]);
    return null;
  },
});

/**
 * Repair basic user aggregates (answered, incorrect, bookmarked)
 */
export const repairUserBasicAggregates = internalMutation({
  args: { userId: v.id('users') },
  returns: v.object({
    answered: v.number(),
    incorrect: v.number(),
    bookmarked: v.number(),
  }),
  handler: async (ctx, args) => {
    // Clear basic aggregates first
    await Promise.all([
      answeredByUser.clear(ctx, { namespace: args.userId }),
      incorrectByUser.clear(ctx, { namespace: args.userId }),
      bookmarkedByUser.clear(ctx, { namespace: args.userId }),
    ]);

    // Repair from userQuestionStats
    const stats = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .collect();

    let answered = 0,
      incorrect = 0;
    for (const stat of stats) {
      if (stat.hasAnswered) {
        await answeredByUser.insertIfDoesNotExist(ctx, stat);
        answered++;
      }
      if (stat.isIncorrect) {
        await incorrectByUser.insertIfDoesNotExist(ctx, stat);
        incorrect++;
      }
    }

    // Repair from userBookmarks
    const bookmarks = await ctx.db
      .query('userBookmarks')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .collect();

    let bookmarked = 0;
    for (const bookmark of bookmarks) {
      await bookmarkedByUser.insertIfDoesNotExist(ctx, bookmark);
      bookmarked++;
    }

    return { answered, incorrect, bookmarked };
  },
});

/**
 * Repair hierarchical aggregates for a user
 */
export const repairUserHierarchicalAggregates = internalMutation({
  args: { userId: v.id('users') },
  returns: v.object({
    processed: v.number(),
  }),
  handler: async (ctx, args) => {
    // Clear hierarchical aggregates
    await Promise.all([
      incorrectByThemeByUser.clear(ctx, { namespace: args.userId }),
      incorrectBySubthemeByUser.clear(ctx, { namespace: args.userId }),
      incorrectByGroupByUser.clear(ctx, { namespace: args.userId }),
      bookmarkedByThemeByUser.clear(ctx, { namespace: args.userId }),
      bookmarkedBySubthemeByUser.clear(ctx, { namespace: args.userId }),
      bookmarkedByGroupByUser.clear(ctx, { namespace: args.userId }),
      answeredByThemeByUser.clear(ctx, { namespace: args.userId }),
      answeredBySubthemeByUser.clear(ctx, { namespace: args.userId }),
      answeredByGroupByUser.clear(ctx, { namespace: args.userId }),
    ]);

    // Get user stats and bookmarks
    const [stats, bookmarks] = await Promise.all([
      ctx.db
        .query('userQuestionStats')
        .withIndex('by_user', q => q.eq('userId', args.userId))
        .collect(),
      ctx.db
        .query('userBookmarks')
        .withIndex('by_user', q => q.eq('userId', args.userId))
        .collect(),
    ]);

    let processed = 0;

    // Process stats (answered and incorrect)
    for (const stat of stats) {
      const question = await ctx.db.get(stat.questionId);
      if (question) {
        // Answered stats
        if (stat.hasAnswered) {
          if (question.themeId) {
            await answeredByThemeByUser.insertIfDoesNotExist(ctx, {
              ...stat,
              themeId: question.themeId,
            });
          }
          if (question.subthemeId) {
            await answeredBySubthemeByUser.insertIfDoesNotExist(ctx, {
              ...stat,
              subthemeId: question.subthemeId,
            });
          }
          if (question.groupId) {
            await answeredByGroupByUser.insertIfDoesNotExist(ctx, {
              ...stat,
              groupId: question.groupId,
            });
          }
        }

        // Incorrect stats
        if (stat.isIncorrect) {
          if (question.themeId) {
            await incorrectByThemeByUser.insertIfDoesNotExist(ctx, {
              ...stat,
              themeId: question.themeId,
            });
          }
          if (question.subthemeId) {
            await incorrectBySubthemeByUser.insertIfDoesNotExist(ctx, {
              ...stat,
              subthemeId: question.subthemeId,
            });
          }
          if (question.groupId) {
            await incorrectByGroupByUser.insertIfDoesNotExist(ctx, {
              ...stat,
              groupId: question.groupId,
            });
          }
        }
        processed++;
      }
    }

    // Process bookmarks
    for (const bookmark of bookmarks) {
      const question = await ctx.db.get(bookmark.questionId);
      if (question) {
        if (question.themeId) {
          await bookmarkedByThemeByUser.insertIfDoesNotExist(ctx, {
            ...bookmark,
            themeId: question.themeId,
          });
        }
        if (question.subthemeId) {
          await bookmarkedBySubthemeByUser.insertIfDoesNotExist(ctx, {
            ...bookmark,
            subthemeId: question.subthemeId,
          });
        }
        if (question.groupId) {
          await bookmarkedByGroupByUser.insertIfDoesNotExist(ctx, {
            ...bookmark,
            groupId: question.groupId,
          });
        }
        processed++;
      }
    }

    return { processed };
  },
});

/**
 * Repair global question count
 */
export const repairGlobalQuestionCount = mutation({
  args: {},
  returns: v.number(),
  handler: async ctx => {
    await totalQuestionCount.clear(ctx, { namespace: 'global' });

    const questions = await ctx.db.query('questions').collect();

    for (const question of questions) {
      await totalQuestionCount.insertIfDoesNotExist(ctx, question);
    }

    return questions.length;
  },
});

/**
 * One-click repair for a user (basic + hierarchical)
 */
export const repairUserAllAggregates = mutation({
  args: { userId: v.id('users') },
  returns: v.object({
    basic: v.object({
      answered: v.number(),
      incorrect: v.number(),
      bookmarked: v.number(),
    }),
    hierarchical: v.object({
      processed: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const [basic, hierarchical] = await Promise.all([
      ctx.runMutation(repairUserBasicAggregates, { userId: args.userId }),
      ctx.runMutation(repairUserHierarchicalAggregates, {
        userId: args.userId,
      }),
    ]);

    return { basic, hierarchical };
  },
});
