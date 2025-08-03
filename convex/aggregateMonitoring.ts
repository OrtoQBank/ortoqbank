// ============================================================================
// SIMPLE AGGREGATE MONITORING FUNCTIONS
// ============================================================================

import { v } from 'convex/values';
import { query, mutation } from './_generated/server';
import { Id } from './_generated/dataModel';
import {
  answeredByUser,
  bookmarkedByUser,
  incorrectByUser,
  incorrectByThemeByUser,
  incorrectBySubthemeByUser,
  incorrectByGroupByUser,
  totalQuestionCount,
} from './aggregates';

/**
 * Quick overview of aggregate health
 */
export const getAggregateOverview = query({
  args: {},
  returns: v.object({
    totalQuestions: v.number(),
    sampleUser: v.object({
      userId: v.optional(v.id('users')),
      answered: v.number(),
      incorrect: v.number(),
      bookmarked: v.number(),
      hierarchical: v.object({
        themes: v.number(),
        subthemes: v.number(),
        groups: v.number(),
      }),
    }),
  }),
  handler: async ctx => {
    // Get total questions
    const totalQuestions = await totalQuestionCount.count(ctx, {
      namespace: 'global',
      bounds: {},
    });

    // Get first user for sample
    const firstUser = await ctx.db.query('users').first();
    let sampleUser = {
      userId: undefined as Id<'users'> | undefined,
      answered: 0,
      incorrect: 0,
      bookmarked: 0,
      hierarchical: { themes: 0, subthemes: 0, groups: 0 },
    };

    if (firstUser) {
      sampleUser.userId = firstUser._id;

      // Basic user aggregates
      const [answered, incorrect, bookmarked] = await Promise.all([
        (answeredByUser.count as any)(ctx, {
          namespace: firstUser._id,
          bounds: {},
        }),
        (incorrectByUser.count as any)(ctx, {
          namespace: firstUser._id,
          bounds: {},
        }),
        (bookmarkedByUser.count as any)(ctx, {
          namespace: firstUser._id,
          bounds: {},
        }),
      ]);

      sampleUser.answered = answered;
      sampleUser.incorrect = incorrect;
      sampleUser.bookmarked = bookmarked;

      // Count hierarchical aggregates
      const [themes, subthemes, groups] = await Promise.all([
        ctx.db.query('themes').collect(),
        ctx.db.query('subthemes').collect(),
        ctx.db.query('groups').collect(),
      ]);

      let hierarchicalCounts = { themes: 0, subthemes: 0, groups: 0 };

      // Count non-zero hierarchical entries
      for (const theme of themes.slice(0, 5)) {
        // Sample first 5
        const count = await (incorrectByThemeByUser.count as any)(ctx, {
          namespace: `${firstUser._id}_${theme._id}`,
          bounds: {},
        });
        if (count > 0) hierarchicalCounts.themes += count;
      }

      for (const subtheme of subthemes.slice(0, 5)) {
        const count = await (incorrectBySubthemeByUser.count as any)(ctx, {
          namespace: `${firstUser._id}_${subtheme._id}`,
          bounds: {},
        });
        if (count > 0) hierarchicalCounts.subthemes += count;
      }

      for (const group of groups.slice(0, 5)) {
        const count = await (incorrectByGroupByUser.count as any)(ctx, {
          namespace: `${firstUser._id}_${group._id}`,
          bounds: {},
        });
        if (count > 0) hierarchicalCounts.groups += count;
      }

      sampleUser.hierarchical = hierarchicalCounts;
    }

    return {
      totalQuestions,
      sampleUser,
    };
  },
});

/**
 * Get specific user's aggregate counts
 */
export const getUserAggregates = query({
  args: { userId: v.id('users') },
  returns: v.object({
    basic: v.object({
      answered: v.number(),
      incorrect: v.number(),
      bookmarked: v.number(),
    }),
    hierarchical: v.object({
      totalThemes: v.number(),
      totalSubthemes: v.number(),
      totalGroups: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    // Basic aggregates
    const [answered, incorrect, bookmarked] = await Promise.all([
      (answeredByUser.count as any)(ctx, {
        namespace: args.userId,
        bounds: {},
      }),
      (incorrectByUser.count as any)(ctx, {
        namespace: args.userId,
        bounds: {},
      }),
      (bookmarkedByUser.count as any)(ctx, {
        namespace: args.userId,
        bounds: {},
      }),
    ]);

    // Count total hierarchical aggregates
    const [themes, subthemes, groups] = await Promise.all([
      ctx.db.query('themes').collect(),
      ctx.db.query('subthemes').collect(),
      ctx.db.query('groups').collect(),
    ]);

    let hierarchicalTotals = {
      totalThemes: 0,
      totalSubthemes: 0,
      totalGroups: 0,
    };

    // Count all hierarchical entries for this user
    for (const theme of themes) {
      const count = await (incorrectByThemeByUser.count as any)(ctx, {
        namespace: `${args.userId}_${theme._id}`,
        bounds: {},
      });
      hierarchicalTotals.totalThemes += count;
    }

    for (const subtheme of subthemes) {
      const count = await (incorrectBySubthemeByUser.count as any)(ctx, {
        namespace: `${args.userId}_${subtheme._id}`,
        bounds: {},
      });
      hierarchicalTotals.totalSubthemes += count;
    }

    for (const group of groups) {
      const count = await (incorrectByGroupByUser.count as any)(ctx, {
        namespace: `${args.userId}_${group._id}`,
        bounds: {},
      });
      hierarchicalTotals.totalGroups += count;
    }

    return {
      basic: { answered, incorrect, bookmarked },
      hierarchical: hierarchicalTotals,
    };
  },
});

/**
 * Simple health check - compare aggregate vs raw database counts
 */
export const getHealthCheck = query({
  args: { userId: v.optional(v.id('users')) },
  returns: v.object({
    status: v.string(),
    aggregate: v.object({
      answered: v.number(),
      incorrect: v.number(),
      bookmarked: v.number(),
    }),
    database: v.object({
      answered: v.number(),
      incorrect: v.number(),
      bookmarked: v.number(),
    }),
    match: v.object({
      answered: v.boolean(),
      incorrect: v.boolean(),
      bookmarked: v.boolean(),
    }),
  }),
  handler: async (ctx, args) => {
    const userId = args.userId || (await ctx.db.query('users').first())?._id;

    if (!userId) {
      return {
        status: 'NO_USERS',
        aggregate: { answered: 0, incorrect: 0, bookmarked: 0 },
        database: { answered: 0, incorrect: 0, bookmarked: 0 },
        match: { answered: true, incorrect: true, bookmarked: true },
      };
    }

    // Get aggregate counts
    const [aggAnswered, aggIncorrect, aggBookmarked] = await Promise.all([
      (answeredByUser.count as any)(ctx, { namespace: userId, bounds: {} }),
      (incorrectByUser.count as any)(ctx, { namespace: userId, bounds: {} }),
      (bookmarkedByUser.count as any)(ctx, { namespace: userId, bounds: {} }),
    ]);

    // Get raw database counts
    const [dbAnswered, dbIncorrect, dbBookmarked] = await Promise.all([
      ctx.db
        .query('userQuestionStats')
        .withIndex('by_user_answered', q =>
          q.eq('userId', userId).eq('hasAnswered', true),
        )
        .collect()
        .then(stats => stats.length),
      ctx.db
        .query('userQuestionStats')
        .withIndex('by_user_incorrect', q =>
          q.eq('userId', userId).eq('isIncorrect', true),
        )
        .collect()
        .then(stats => stats.length),
      ctx.db
        .query('userBookmarks')
        .withIndex('by_user', q => q.eq('userId', userId))
        .collect()
        .then(bookmarks => bookmarks.length),
    ]);

    const match = {
      answered: aggAnswered === dbAnswered,
      incorrect: aggIncorrect === dbIncorrect,
      bookmarked: aggBookmarked === dbBookmarked,
    };

    const allMatch = match.answered && match.incorrect && match.bookmarked;
    const status = allMatch ? 'HEALTHY' : 'MISMATCH';

    return {
      status,
      aggregate: {
        answered: aggAnswered,
        incorrect: aggIncorrect,
        bookmarked: aggBookmarked,
      },
      database: {
        answered: dbAnswered,
        incorrect: dbIncorrect,
        bookmarked: dbBookmarked,
      },
      match,
    };
  },
});
