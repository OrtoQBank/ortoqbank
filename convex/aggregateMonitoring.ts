// ============================================================================
// SIMPLE AGGREGATE MONITORING FUNCTIONS
// ============================================================================

import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import {
  answeredByGroupByUser,
  answeredBySubthemeByUser,
  answeredByThemeByUser,
  answeredByUser,
  bookmarkedByGroupByUser,
  bookmarkedBySubthemeByUser,
  bookmarkedByThemeByUser,
  bookmarkedByUser,
  incorrectByGroupByUser,
  incorrectBySubthemeByUser,
  incorrectByThemeByUser,
  incorrectByUser,
  questionCountByGroup,
  questionCountBySubtheme,
  questionCountByTheme,
  randomQuestions,
  randomQuestionsByGroup,
  randomQuestionsBySubtheme,
  randomQuestionsByTheme,
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
    const firstUser = await ctx.db.query('users').first();
    const userId = args.userId || firstUser?._id;

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

/**
 * Comprehensive aggregate status for a specific user
 * Returns all user-specific aggregates plus global aggregates
 */
export const getAllUserAggregates = query({
  args: { userId: v.id('users') },
  returns: v.any(),
  handler: async (ctx, args) => {
    // ========================================================================
    // GLOBAL AGGREGATES (non-user-specific)
    // ========================================================================

    // Get total questions count
    const totalQuestions = await (totalQuestionCount.count as any)(ctx, {
      namespace: 'global',
      bounds: {},
    });

    // Get random questions count
    const randomQuestionsCount = await (randomQuestions.count as any)(ctx, {
      namespace: 'global',
      bounds: {},
    });

    // Get all taxonomy data
    const [themes, subthemes, groups] = await Promise.all([
      ctx.db.query('themes').collect(),
      ctx.db.query('subthemes').collect(),
      ctx.db.query('groups').collect(),
    ]);

    // Get question counts by theme
    const questionsByTheme = await Promise.all(
      themes.map(async theme => {
        const [count, randomCount] = await Promise.all([
          (questionCountByTheme.count as any)(ctx, {
            namespace: theme._id,
            bounds: {},
          }),
          (randomQuestionsByTheme.count as any)(ctx, {
            namespace: theme._id,
            bounds: {},
          }),
        ]);
        return {
          themeId: theme._id,
          themeName: theme.name,
          count,
          randomCount,
        };
      }),
    );

    // Get question counts by subtheme
    const questionsBySubtheme = await Promise.all(
      subthemes.map(async subtheme => {
        const [count, randomCount] = await Promise.all([
          (questionCountBySubtheme.count as any)(ctx, {
            namespace: subtheme._id,
            bounds: {},
          }),
          (randomQuestionsBySubtheme.count as any)(ctx, {
            namespace: subtheme._id,
            bounds: {},
          }),
        ]);
        return {
          subthemeId: subtheme._id,
          subthemeName: subtheme.name,
          count,
          randomCount,
        };
      }),
    );

    // Add 'no-subtheme' entry
    const noSubthemeCount = await (questionCountBySubtheme.count as any)(ctx, {
      namespace: 'no-subtheme',
      bounds: {},
    });
    const noSubthemeRandomCount = await (randomQuestionsBySubtheme.count as any)(ctx, {
      namespace: 'no-subtheme',
      bounds: {},
    });
    questionsBySubtheme.push({
      subthemeId: 'no-subtheme' as Id<'subthemes'>,
      subthemeName: 'No Subtheme',
      count: noSubthemeCount,
      randomCount: noSubthemeRandomCount,
    });

    // Get question counts by group
    const questionsByGroup = await Promise.all(
      groups.map(async group => {
        const [count, randomCount] = await Promise.all([
          (questionCountByGroup.count as any)(ctx, {
            namespace: group._id,
            bounds: {},
          }),
          (randomQuestionsByGroup.count as any)(ctx, {
            namespace: group._id,
            bounds: {},
          }),
        ]);
        return {
          groupId: group._id,
          groupName: group.name,
          count,
          randomCount,
        };
      }),
    );

    // Add 'no-group' entry
    const noGroupCount = await (questionCountByGroup.count as any)(ctx, {
      namespace: 'no-group',
      bounds: {},
    });
    const noGroupRandomCount = await (randomQuestionsByGroup.count as any)(ctx, {
      namespace: 'no-group',
      bounds: {},
    });
    questionsByGroup.push({
      groupId: 'no-group' as Id<'groups'>,
      groupName: 'No Group',
      count: noGroupCount,
      randomCount: noGroupRandomCount,
    });

    // ========================================================================
    // USER-SPECIFIC AGGREGATES
    // ========================================================================

    // Basic user aggregates
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

    // Hierarchical user aggregates by theme
    const answeredByTheme = await Promise.all(
      themes.map(async theme => {
        const count = await (answeredByThemeByUser.count as any)(ctx, {
          namespace: `${args.userId}_${theme._id}`,
          bounds: {},
        });
        return {
          themeId: theme._id,
          themeName: theme.name,
          count,
        };
      }),
    ).then(results => results.filter(r => r.count > 0));

    const incorrectByTheme = await Promise.all(
      themes.map(async theme => {
        const count = await (incorrectByThemeByUser.count as any)(ctx, {
          namespace: `${args.userId}_${theme._id}`,
          bounds: {},
        });
        return {
          themeId: theme._id,
          themeName: theme.name,
          count,
        };
      }),
    ).then(results => results.filter(r => r.count > 0));

    const bookmarkedByTheme = await Promise.all(
      themes.map(async theme => {
        const count = await (bookmarkedByThemeByUser.count as any)(ctx, {
          namespace: `${args.userId}_${theme._id}`,
          bounds: {},
        });
        return {
          themeId: theme._id,
          themeName: theme.name,
          count,
        };
      }),
    ).then(results => results.filter(r => r.count > 0));

    // Hierarchical user aggregates by subtheme
    const answeredBySubtheme = await Promise.all(
      subthemes.map(async subtheme => {
        const count = await (answeredBySubthemeByUser.count as any)(ctx, {
          namespace: `${args.userId}_${subtheme._id}`,
          bounds: {},
        });
        return {
          subthemeId: subtheme._id,
          subthemeName: subtheme.name,
          count,
        };
      }),
    ).then(results => results.filter(r => r.count > 0));

    const incorrectBySubtheme = await Promise.all(
      subthemes.map(async subtheme => {
        const count = await (incorrectBySubthemeByUser.count as any)(ctx, {
          namespace: `${args.userId}_${subtheme._id}`,
          bounds: {},
        });
        return {
          subthemeId: subtheme._id,
          subthemeName: subtheme.name,
          count,
        };
      }),
    ).then(results => results.filter(r => r.count > 0));

    const bookmarkedBySubtheme = await Promise.all(
      subthemes.map(async subtheme => {
        const count = await (bookmarkedBySubthemeByUser.count as any)(ctx, {
          namespace: `${args.userId}_${subtheme._id}`,
          bounds: {},
        });
        return {
          subthemeId: subtheme._id,
          subthemeName: subtheme.name,
          count,
        };
      }),
    ).then(results => results.filter(r => r.count > 0));

    // Hierarchical user aggregates by group
    const answeredByGroup = await Promise.all(
      groups.map(async group => {
        const count = await (answeredByGroupByUser.count as any)(ctx, {
          namespace: `${args.userId}_${group._id}`,
          bounds: {},
        });
        return {
          groupId: group._id,
          groupName: group.name,
          count,
        };
      }),
    ).then(results => results.filter(r => r.count > 0));

    const incorrectByGroup = await Promise.all(
      groups.map(async group => {
        const count = await (incorrectByGroupByUser.count as any)(ctx, {
          namespace: `${args.userId}_${group._id}`,
          bounds: {},
        });
        return {
          groupId: group._id,
          groupName: group.name,
          count,
        };
      }),
    ).then(results => results.filter(r => r.count > 0));

    const bookmarkedByGroup = await Promise.all(
      groups.map(async group => {
        const count = await (bookmarkedByGroupByUser.count as any)(ctx, {
          namespace: `${args.userId}_${group._id}`,
          bounds: {},
        });
        return {
          groupId: group._id,
          groupName: group.name,
          count,
        };
      }),
    ).then(results => results.filter(r => r.count > 0));

    return {
      userId: args.userId,
      global: {
        totalQuestions,
        randomQuestions: randomQuestionsCount,
        questionsByTheme,
        questionsBySubtheme,
        questionsByGroup,
      },
      userSpecific: {
        basic: {
          answered,
          incorrect,
          bookmarked,
        },
        hierarchical: {
          answeredByTheme,
          answeredBySubtheme,
          answeredByGroup,
          incorrectByTheme,
          incorrectBySubtheme,
          incorrectByGroup,
          bookmarkedByTheme,
          bookmarkedBySubtheme,
          bookmarkedByGroup,
        },
      },
    };
  },
});
