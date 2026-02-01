import { v } from 'convex/values';

import { internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { internalMutation, mutation, query } from './_generated/server';
import { getTotalQuestionCount } from './aggregateCounts.js';
import { verifyTenantAccess } from './auth';
import { getCurrentUser, getCurrentUserOrThrow } from './users';
import { getWeekString } from './utils';

type UserStats = {
  overall: {
    totalAnswered: number;
    totalCorrect: number;
    totalIncorrect: number;
    totalBookmarked: number;
    correctPercentage: number;
  };
  byTheme: {
    themeId: Id<'themes'>;
    themeName: string;
    total: number;
    correct: number;
    percentage: number;
  }[];
  totalQuestions: number;
};

/**
 * Transform flat count records into structured format
 */
function transformCounts(
  answeredCounts: Record<string, number>,
  incorrectCounts: Record<string, number>,
  bookmarkedCounts: Record<string, number>,
) {
  const result: Record<
    string,
    { answered: number; incorrect: number; bookmarked: number }
  > = {};

  // Get all unique keys from all count types
  const allKeys = new Set([
    ...Object.keys(answeredCounts),
    ...Object.keys(incorrectCounts),
    ...Object.keys(bookmarkedCounts),
  ]);

  for (const key of allKeys) {
    result[key] = {
      answered: answeredCounts[key] || 0,
      incorrect: incorrectCounts[key] || 0,
      bookmarked: bookmarkedCounts[key] || 0,
    };
  }

  return result;
}

/**
 * Internal mutation to update question statistics when a user answers a question
 * This should only be called from the quizSessions.submitAnswerAndProgress function
 *
 * NOTE: Uses raw internalMutation + manual aggregate updates to avoid DELETE_MISSING_KEY errors
 * while still keeping aggregates in sync in real-time.
 */
export const _updateQuestionStats = internalMutation({
  args: {
    userId: v.id('users'),
    questionId: v.id('questions'),
    isCorrect: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = args.userId; // Use passed userId instead of getCurrentUserOrThrow
    const now = Date.now();

    // Get question data to extract taxonomy fields for aggregates
    const question = await ctx.db.get(args.questionId);
    if (!question) {
      throw new Error('Question not found');
    }

    // Check if we already have a record for this user and question
    const existingStat = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user_question', q =>
        q.eq('userId', userId).eq('questionId', args.questionId),
      )
      .first();

    const wasIncorrectBefore = existingStat?.isIncorrect || false;

    if (existingStat) {
      // Update existing record with taxonomy fields
      const updateData = {
        isIncorrect: !args.isCorrect,
        answeredAt: now,
        themeId: question.themeId,
        ...(question.subthemeId && { subthemeId: question.subthemeId }),
        ...(question.groupId && { groupId: question.groupId }),
      };

      await ctx.db.patch(existingStat._id, updateData);
    } else {
      // Skip creating stats only if question lacks themeId (minimum requirement)
      if (!question.themeId) {
        return {
          success: false,
          action: 'skipped',
          error: 'Question lacks themeId required for stats tracking',
        };
      }

      // Create a new record with available taxonomy fields for aggregates
      const newStatData = {
        userId: userId,
        questionId: args.questionId,
        hasAnswered: true,
        isIncorrect: !args.isCorrect,
        answeredAt: now,
        themeId: question.themeId,
        subthemeId: question.subthemeId,
        groupId: question.groupId,
        // Multi-tenancy: inherit tenantId from question
        tenantId: question.tenantId,
      };

      await ctx.db.insert('userQuestionStats', newStatData);
    }

    // ASYNC STATS UPDATES - Schedule userStatsCounts updates to run separately
    // This prevents blocking the main quiz submission flow and avoids timeouts
    ctx.scheduler.runAfter(100, internal.userStats._updateUserStatsCounts, {
      userId,
      questionId: args.questionId,
      isCorrect: args.isCorrect,
      wasIncorrectBefore,
      isNewAnswer: !existingStat,
      themeId: question.themeId,
      subthemeId: question.subthemeId || null,
      groupId: question.groupId || null,
      // Multi-tenancy: pass tenantId to scheduled function
      tenantId: question.tenantId || null,
    });

    return {
      success: true,
      action: existingStat ? 'updated' : 'created',
    };
  },
});

/**
 * Internal mutation to update userStatsCounts asynchronously
 * This is scheduled from _updateQuestionStats to avoid blocking the main quiz flow
 */
export const _updateUserStatsCounts = internalMutation({
  args: {
    userId: v.id('users'),
    questionId: v.id('questions'),
    isCorrect: v.boolean(),
    wasIncorrectBefore: v.boolean(),
    isNewAnswer: v.boolean(),
    themeId: v.id('themes'),
    subthemeId: v.union(v.id('subthemes'), v.null()),
    groupId: v.union(v.id('groups'), v.null()),
    // Multi-tenancy
    tenantId: v.union(v.id('apps'), v.null()),
  },
  handler: async (ctx, params) => {
    await updateUserStatsCounts(ctx, {
      userId: params.userId,
      questionId: params.questionId,
      isCorrect: params.isCorrect,
      wasIncorrectBefore: params.wasIncorrectBefore,
      isNewAnswer: params.isNewAnswer,
      question: {
        themeId: params.themeId,
        subthemeId: params.subthemeId,
        groupId: params.groupId,
        // Multi-tenancy: forward tenantId to helper
        tenantId: params.tenantId,
      },
    });
  },
});

/**
 * Helper function to update userStatsCounts when a question is answered
 */
async function updateUserStatsCounts(
  ctx: any,
  params: {
    userId: Id<'users'>;
    questionId: Id<'questions'>;
    isCorrect: boolean;
    wasIncorrectBefore: boolean;
    isNewAnswer: boolean;
    question: any;
  },
) {
  const { userId, isCorrect, wasIncorrectBefore, isNewAnswer, question } =
    params;

  // Get or create user counts record
  let userCounts = await ctx.db
    .query('userStatsCounts')
    .withIndex('by_user', (q: any) => q.eq('userId', userId))
    .first();

  if (!userCounts) {
    // Initialize counts for new user
    userCounts = {
      userId,
      totalAnswered: 0,
      totalIncorrect: 0,
      totalBookmarked: 0,
      answeredByTheme: {},
      incorrectByTheme: {},
      bookmarkedByTheme: {},
      answeredBySubtheme: {},
      incorrectBySubtheme: {},
      bookmarkedBySubtheme: {},
      answeredByGroup: {},
      incorrectByGroup: {},
      bookmarkedByGroup: {},
      lastUpdated: Date.now(),
      // Multi-tenancy: inherit tenantId from question
      tenantId: question?.tenantId,
    };

    const countsId = await ctx.db.insert('userStatsCounts', userCounts);
    userCounts = { ...userCounts, _id: countsId };
  }

  // Prepare updates
  const updates: any = {
    lastUpdated: Date.now(),
  };

  // Update answered counts (only for first-time answers)
  if (isNewAnswer) {
    updates.totalAnswered = userCounts.totalAnswered + 1;

    // Update answered by theme
    if (question.themeId) {
      updates.answeredByTheme = {
        ...userCounts.answeredByTheme,
        [question.themeId]:
          (userCounts.answeredByTheme[question.themeId] || 0) + 1,
      };
    }

    // Update answered by subtheme
    if (question.subthemeId) {
      updates.answeredBySubtheme = {
        ...userCounts.answeredBySubtheme,
        [question.subthemeId]:
          (userCounts.answeredBySubtheme[question.subthemeId] || 0) + 1,
      };
    }

    // Update answered by group
    if (question.groupId) {
      updates.answeredByGroup = {
        ...userCounts.answeredByGroup,
        [question.groupId]:
          (userCounts.answeredByGroup[question.groupId] || 0) + 1,
      };
    }
  }

  // Handle incorrect count changes
  if (!isCorrect && !wasIncorrectBefore) {
    // New incorrect answer
    updates.totalIncorrect = userCounts.totalIncorrect + 1;

    if (question.themeId) {
      updates.incorrectByTheme = {
        ...userCounts.incorrectByTheme,
        [question.themeId]:
          (userCounts.incorrectByTheme[question.themeId] || 0) + 1,
      };
    }

    if (question.subthemeId) {
      updates.incorrectBySubtheme = {
        ...userCounts.incorrectBySubtheme,
        [question.subthemeId]:
          (userCounts.incorrectBySubtheme[question.subthemeId] || 0) + 1,
      };
    }

    if (question.groupId) {
      updates.incorrectByGroup = {
        ...userCounts.incorrectByGroup,
        [question.groupId]:
          (userCounts.incorrectByGroup[question.groupId] || 0) + 1,
      };
    }
  } else if (isCorrect && wasIncorrectBefore) {
    // Changed from incorrect to correct
    updates.totalIncorrect = Math.max(0, userCounts.totalIncorrect - 1);

    if (question.themeId) {
      updates.incorrectByTheme = {
        ...userCounts.incorrectByTheme,
        [question.themeId]: Math.max(
          0,
          (userCounts.incorrectByTheme[question.themeId] || 0) - 1,
        ),
      };
    }

    if (question.subthemeId) {
      updates.incorrectBySubtheme = {
        ...userCounts.incorrectBySubtheme,
        [question.subthemeId]: Math.max(
          0,
          (userCounts.incorrectBySubtheme[question.subthemeId] || 0) - 1,
        ),
      };
    }

    if (question.groupId) {
      updates.incorrectByGroup = {
        ...userCounts.incorrectByGroup,
        [question.groupId]: Math.max(
          0,
          (userCounts.incorrectByGroup[question.groupId] || 0) - 1,
        ),
      };
    }
  }

  // Apply updates
  await ctx.db.patch(userCounts._id, updates);
}

/**
 * User statistics using pre-computed counts table
 */
export const getUserStats = query({
  args: { tenantId: v.optional(v.id('apps')) },
  returns: v.object({
    overall: v.object({
      totalAnswered: v.number(),
      totalCorrect: v.number(),
      totalIncorrect: v.number(),
      totalBookmarked: v.number(),
      correctPercentage: v.number(),
    }),
    byTheme: v.array(
      v.object({
        themeId: v.id('themes'),
        themeName: v.string(),
        total: v.number(),
        correct: v.number(),
        percentage: v.number(),
      }),
    ),
    totalQuestions: v.number(),
  }),
  handler: async (ctx, { tenantId }): Promise<UserStats> => {
    // Verify user has access to this tenant
    await verifyTenantAccess(ctx, tenantId);

    const user = await getCurrentUser(ctx);
    if (!user) {
      // Return empty stats for unauthenticated users
      return {
        overall: {
          totalAnswered: 0,
          totalCorrect: 0,
          totalIncorrect: 0,
          totalBookmarked: 0,
          correctPercentage: 0,
        },
        byTheme: [],
        totalQuestions: 0,
      };
    }
    const userId = user._id;

    // Get pre-computed counts (ultra-fast single lookup)
    // Filter by tenant if provided
    let userCounts;
    userCounts = await (tenantId ? ctx.db
        .query('userStatsCounts')
        .withIndex('by_tenant_and_user', q =>
          q.eq('tenantId', tenantId).eq('userId', userId),
        )
        .first() : ctx.db
        .query('userStatsCounts')
        .withIndex('by_user', q => q.eq('userId', userId))
        .first());

    // Get total questions count using existing aggregate
    // If no tenantId, return 0 (tenant context is required for accurate counts)
    const totalQuestions = tenantId
      ? await getTotalQuestionCount(ctx, tenantId)
      : 0;

    // Handle new users with no counts yet
    if (!userCounts) {
      return {
        overall: {
          totalAnswered: 0,
          totalCorrect: 0,
          totalIncorrect: 0,
          totalBookmarked: 0,
          correctPercentage: 0,
        },
        byTheme: [],
        totalQuestions,
      };
    }

    // Calculate derived values
    const totalCorrect = userCounts.totalAnswered - userCounts.totalIncorrect;
    const correctPercentage =
      userCounts.totalAnswered > 0
        ? Math.round((totalCorrect / userCounts.totalAnswered) * 100)
        : 0;

    // Get theme names for the themes that have counts
    const themeIdsWithCounts = Object.keys(
      userCounts.answeredByTheme,
    ) as Id<'themes'>[];
    const themes = await Promise.all(
      themeIdsWithCounts.map(id => ctx.db.get(id)),
    );

    // Create theme statistics
    const themeStats = themeIdsWithCounts
      .map((themeId, index) => {
        const theme = themes[index];
        if (!theme) return null;

        const total = userCounts.answeredByTheme[themeId] || 0;
        const incorrect = userCounts.incorrectByTheme[themeId] || 0;
        const correct = total - incorrect;
        const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

        return {
          themeId,
          themeName: theme.name,
          total,
          correct,
          percentage,
        };
      })
      .filter((stat): stat is NonNullable<typeof stat> => stat !== null)
      .toSorted((a, b) => b.total - a.total);

    return {
      overall: {
        totalAnswered: userCounts.totalAnswered,
        totalCorrect,
        totalIncorrect: userCounts.totalIncorrect,
        totalBookmarked: userCounts.totalBookmarked,
        correctPercentage,
      },
      byTheme: themeStats,
      totalQuestions,
    };
  },
});

/**
 * Get all user counts optimized for quiz creation page
 * Single fetch with all counts for efficient filtering UI
 */
export const getUserCountsForQuizCreation = query({
  args: { tenantId: v.optional(v.id('apps')) },
  returns: v.object({
    global: v.object({
      totalAnswered: v.number(),
      totalIncorrect: v.number(),
      totalBookmarked: v.number(),
    }),
    byTheme: v.record(
      v.id('themes'),
      v.object({
        answered: v.number(),
        incorrect: v.number(),
        bookmarked: v.number(),
      }),
    ),
    bySubtheme: v.record(
      v.id('subthemes'),
      v.object({
        answered: v.number(),
        incorrect: v.number(),
        bookmarked: v.number(),
      }),
    ),
    byGroup: v.record(
      v.id('groups'),
      v.object({
        answered: v.number(),
        incorrect: v.number(),
        bookmarked: v.number(),
      }),
    ),
  }),
  handler: async (ctx, { tenantId }) => {
    // Verify user has access to this tenant
    await verifyTenantAccess(ctx, tenantId);

    const userId = await getCurrentUserOrThrow(ctx);

    // Single lookup gets all counts
    // Filter by tenant if provided
    let userCounts;
    userCounts = await (tenantId ? ctx.db
        .query('userStatsCounts')
        .withIndex('by_tenant_and_user', q =>
          q.eq('tenantId', tenantId).eq('userId', userId._id),
        )
        .first() : ctx.db
        .query('userStatsCounts')
        .withIndex('by_user', q => q.eq('userId', userId._id))
        .first());

    // Handle new users with no counts
    if (!userCounts) {
      return {
        global: {
          totalAnswered: 0,
          totalIncorrect: 0,
          totalBookmarked: 0,
        },
        byTheme: {},
        bySubtheme: {},
        byGroup: {},
      };
    }

    // Use the transformCounts helper function

    return {
      global: {
        totalAnswered: userCounts.totalAnswered,
        totalIncorrect: userCounts.totalIncorrect,
        totalBookmarked: userCounts.totalBookmarked,
      },
      byTheme: transformCounts(
        userCounts.answeredByTheme,
        userCounts.incorrectByTheme,
        userCounts.bookmarkedByTheme,
      ),
      bySubtheme: transformCounts(
        userCounts.answeredBySubtheme,
        userCounts.incorrectBySubtheme,
        userCounts.bookmarkedBySubtheme,
      ),
      byGroup: transformCounts(
        userCounts.answeredByGroup,
        userCounts.incorrectByGroup,
        userCounts.bookmarkedByGroup,
      ),
    };
  },
});

/**
 * Get questions that the user has answered incorrectly
 */
export const getIncorrectlyAnsweredQuestions = query({
  args: {},
  handler: async ctx => {
    const userId = await getCurrentUserOrThrow(ctx);

    // Get all incorrectly answered questions
    const incorrectStats = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user_incorrect', q =>
        q.eq('userId', userId._id).eq('isIncorrect', true),
      )
      .collect();

    if (incorrectStats.length === 0) {
      return [];
    }

    // Get the full question data
    const questionIds = incorrectStats.map(stat => stat.questionId);
    const questionsPromises = questionIds.map(id => ctx.db.get(id));
    const questions = await Promise.all(questionsPromises);

    // Filter out any null results (deleted questions)
    return questions.filter(q => q !== null);
  },
});

/**
 * Get questions that the user has answered at least once
 */
export const getAnsweredQuestions = query({
  args: {},
  handler: async ctx => {
    const userId = await getCurrentUserOrThrow(ctx);

    // Get all answered questions
    const answeredStats = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user_answered', q =>
        q.eq('userId', userId._id).eq('hasAnswered', true),
      )
      .collect();

    if (answeredStats.length === 0) {
      return [];
    }

    // Get the full question data
    const questionIds = answeredStats.map(stat => stat.questionId);
    const questionsPromises = questionIds.map(id => ctx.db.get(id));
    const questions = await Promise.all(questionsPromises);

    // Filter out any null results (deleted questions)
    return questions.filter(q => q !== null);
  },
});

/**
 * Check if a specific question has been answered and/or incorrectly answered by the user
 */
export const getQuestionStatus = query({
  args: {
    questionId: v.id('questions'),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);

    const stat = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user_question', q =>
        q.eq('userId', userId._id).eq('questionId', args.questionId),
      )
      .first();

    // Check bookmark status
    const bookmark = await ctx.db
      .query('userBookmarks')
      .withIndex('by_user_question', q =>
        q.eq('userId', userId._id).eq('questionId', args.questionId),
      )
      .first();

    return {
      hasAnswered: stat ? stat.hasAnswered : false,
      isIncorrect: stat ? stat.isIncorrect : false,
      isBookmarked: !!bookmark,
      answeredAt: stat ? stat.answeredAt : undefined,
    };
  },
});

/**
 * Get user progress over time grouped by weeks
 */
export const getUserWeeklyProgress = query({
  args: { tenantId: v.optional(v.id('apps')) },
  returns: v.array(
    v.object({
      week: v.string(),
      totalAnswered: v.number(),
      weeklyAnswered: v.number(),
    }),
  ),
  handler: async (ctx, { tenantId }) => {
    // Verify user has access to this tenant
    await verifyTenantAccess(ctx, tenantId);

    const userId = await getCurrentUserOrThrow(ctx);

    // Get all answered questions with timestamps, scoped by tenant
    // Filter by tenant if provided
    const allStats = await (tenantId
      ? ctx.db
          .query('userQuestionStats')
          .withIndex('by_tenant_and_user', q =>
            q.eq('tenantId', tenantId).eq('userId', userId._id),
          )
          .collect()
      : ctx.db
          .query('userQuestionStats')
          .withIndex('by_user', q => q.eq('userId', userId._id))
          .collect());

    // Filter for answered questions only
    const answeredStats = allStats.filter(stat => stat.hasAnswered);

    if (answeredStats.length === 0) {
      return [];
    }

    // Group by week and calculate cumulative totals
    const weeklyData = new Map<string, number>();

    // Count questions answered per week (using creation time - when first answered)
    for (const stat of answeredStats) {
      // Use _creationTime which tracks when the question was first answered
      const weekString = getWeekString(stat._creationTime);
      weeklyData.set(weekString, (weeklyData.get(weekString) || 0) + 1);
    }

    // Convert to array and sort by week
    const sortedWeeks = [...weeklyData.entries()]
      .toSorted(([a], [b]) => a.localeCompare(b))
      .slice(-12); // Get last 12 weeks

    // Calculate cumulative totals
    let cumulativeTotal = 0;
    const result = sortedWeeks.map(([week, weeklyCount]) => {
      cumulativeTotal += weeklyCount;
      return {
        week,
        totalAnswered: cumulativeTotal,
        weeklyAnswered: weeklyCount,
      };
    });

    return result;
  },
});

/**
 * Reset the current user's statistics counts to a fresh state.
 * Does NOT modify bookmarks-related counts.
 */
export const resetMyStatsCounts = mutation({
  args: {},
  returns: v.object({ success: v.boolean() }),
  handler: async ctx => {
    const userId = await getCurrentUserOrThrow(ctx);

    // 1) Delete all per-question stats for this user
    const statsForUser = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user', q => q.eq('userId', userId._id))
      .collect();

    for (const stat of statsForUser) {
      await ctx.db.delete(stat._id);
    }

    // 2) Reset aggregate counts (answered/incorrect) but keep bookmarks-related counts
    const counts = await ctx.db
      .query('userStatsCounts')
      .withIndex('by_user', q => q.eq('userId', userId._id))
      .first();

    if (!counts) {
      // Nothing to reset, treat as success
      return { success: true };
    }

    await ctx.db.patch(counts._id, {
      totalAnswered: 0,
      totalIncorrect: 0,
      answeredByTheme: {},
      incorrectByTheme: {},
      answeredBySubtheme: {},
      incorrectBySubtheme: {},
      answeredByGroup: {},
      incorrectByGroup: {},
      lastUpdated: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Initialize userStatsCounts for a specific user by computing counts from existing data
 * This function should be called once per user during migration
 * Multi-tenant: requires tenantId to properly scope the counts
 */
export const initializeUserStatsCounts = mutation({
  args: {
    userId: v.id('users'),
    tenantId: v.id('apps'),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    counts: v.optional(
      v.object({
        totalAnswered: v.number(),
        totalIncorrect: v.number(),
        totalBookmarked: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    // Check if counts already exist for this user in this tenant
    const existingCounts = await ctx.db
      .query('userStatsCounts')
      .withIndex('by_tenant_and_user', q =>
        q.eq('tenantId', args.tenantId).eq('userId', args.userId),
      )
      .first();

    if (existingCounts) {
      return {
        success: false,
        message: 'User stats counts already exist for this tenant',
      };
    }

    // Get all user question stats for this tenant
    const userStats = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_tenant_and_user', q =>
        q.eq('tenantId', args.tenantId).eq('userId', args.userId),
      )
      .collect();

    // Get all user bookmarks for this tenant
    const userBookmarks = await ctx.db
      .query('userBookmarks')
      .withIndex('by_tenant_and_user', q =>
        q.eq('tenantId', args.tenantId).eq('userId', args.userId),
      )
      .collect();

    // Initialize count objects
    const answeredByTheme: Record<Id<'themes'>, number> = {};
    const incorrectByTheme: Record<Id<'themes'>, number> = {};
    const bookmarkedByTheme: Record<Id<'themes'>, number> = {};

    const answeredBySubtheme: Record<Id<'subthemes'>, number> = {};
    const incorrectBySubtheme: Record<Id<'subthemes'>, number> = {};
    const bookmarkedBySubtheme: Record<Id<'subthemes'>, number> = {};

    const answeredByGroup: Record<Id<'groups'>, number> = {};
    const incorrectByGroup: Record<Id<'groups'>, number> = {};
    const bookmarkedByGroup: Record<Id<'groups'>, number> = {};

    let totalAnswered = 0;
    let totalIncorrect = 0;

    // Process answered questions
    for (const stat of userStats) {
      if (stat.hasAnswered) {
        totalAnswered++;

        // Count by theme
        if (stat.themeId) {
          answeredByTheme[stat.themeId] =
            (answeredByTheme[stat.themeId] || 0) + 1;
        }

        // Count by subtheme
        if (stat.subthemeId) {
          answeredBySubtheme[stat.subthemeId] =
            (answeredBySubtheme[stat.subthemeId] || 0) + 1;
        }

        // Count by group
        if (stat.groupId) {
          answeredByGroup[stat.groupId] =
            (answeredByGroup[stat.groupId] || 0) + 1;
        }

        // Count incorrect answers
        if (stat.isIncorrect) {
          totalIncorrect++;

          // Count incorrect by theme
          if (stat.themeId) {
            incorrectByTheme[stat.themeId] =
              (incorrectByTheme[stat.themeId] || 0) + 1;
          }

          // Count incorrect by subtheme
          if (stat.subthemeId) {
            incorrectBySubtheme[stat.subthemeId] =
              (incorrectBySubtheme[stat.subthemeId] || 0) + 1;
          }

          // Count incorrect by group
          if (stat.groupId) {
            incorrectByGroup[stat.groupId] =
              (incorrectByGroup[stat.groupId] || 0) + 1;
          }
        }
      }
    }

    // Process bookmarked questions
    const totalBookmarked = userBookmarks.length;
    for (const bookmark of userBookmarks) {
      // Count by theme
      if (bookmark.themeId) {
        bookmarkedByTheme[bookmark.themeId] =
          (bookmarkedByTheme[bookmark.themeId] || 0) + 1;
      }

      // Count by subtheme
      if (bookmark.subthemeId) {
        bookmarkedBySubtheme[bookmark.subthemeId] =
          (bookmarkedBySubtheme[bookmark.subthemeId] || 0) + 1;
      }

      // Count by group
      if (bookmark.groupId) {
        bookmarkedByGroup[bookmark.groupId] =
          (bookmarkedByGroup[bookmark.groupId] || 0) + 1;
      }
    }

    // Insert the computed counts (tenant-scoped)
    await ctx.db.insert('userStatsCounts', {
      userId: args.userId,
      tenantId: args.tenantId,
      totalAnswered,
      totalIncorrect,
      totalBookmarked,
      answeredByTheme,
      incorrectByTheme,
      bookmarkedByTheme,
      answeredBySubtheme,
      incorrectBySubtheme,
      bookmarkedBySubtheme,
      answeredByGroup,
      incorrectByGroup,
      bookmarkedByGroup,
      lastUpdated: Date.now(),
    });

    return {
      success: true,
      message: `Successfully initialized counts for user ${args.userId}`,
      counts: {
        totalAnswered,
        totalIncorrect,
        totalBookmarked,
      },
    };
  },
});

/**
 * Initialize userStatsCounts for all users in the system for a specific tenant
 * This is a migration function that should be run once per tenant
 * Multi-tenant: requires tenantId to properly scope the counts
 */
export const initializeAllUserStatsCounts = mutation({
  args: {
    tenantId: v.id('apps'),
    batchSize: v.optional(v.number()), // Process users in batches to avoid timeouts
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    processedUsers: v.number(),
    skippedUsers: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 10; // Default to 10 users at a time
    const tenantId = args.tenantId;

    let processedUsers = 0;
    let skippedUsers = 0;
    const errors: string[] = [];

    let cursor: string | null = null;

    // Paginate through all users, batch by batch
    // Loop continues until `isDone` is true
    while (true) {
      const page = await ctx.db
        .query('users')
        .order('asc')
        .paginate({ numItems: batchSize, cursor });

      for (const user of page.page) {
        try {
          // Check if counts already exist for this user in this tenant
          const existingCounts = await ctx.db
            .query('userStatsCounts')
            .withIndex('by_tenant_and_user', q =>
              q.eq('tenantId', tenantId).eq('userId', user._id),
            )
            .first();

          if (existingCounts) {
            skippedUsers++;
            continue;
          }

          // Inline the initialization logic to avoid nested mutation calls
          // Query user stats for this tenant only
          const userStats = await ctx.db
            .query('userQuestionStats')
            .withIndex('by_tenant_and_user', q =>
              q.eq('tenantId', tenantId).eq('userId', user._id),
            )
            .collect();

          const userBookmarks = await ctx.db
            .query('userBookmarks')
            .withIndex('by_tenant_and_user', q =>
              q.eq('tenantId', tenantId).eq('userId', user._id),
            )
            .collect();

          // Initialize count objects
          const answeredByTheme: Record<Id<'themes'>, number> = {};
          const incorrectByTheme: Record<Id<'themes'>, number> = {};
          const bookmarkedByTheme: Record<Id<'themes'>, number> = {};

          const answeredBySubtheme: Record<Id<'subthemes'>, number> = {};
          const incorrectBySubtheme: Record<Id<'subthemes'>, number> = {};
          const bookmarkedBySubtheme: Record<Id<'subthemes'>, number> = {};

          const answeredByGroup: Record<Id<'groups'>, number> = {};
          const incorrectByGroup: Record<Id<'groups'>, number> = {};
          const bookmarkedByGroup: Record<Id<'groups'>, number> = {};

          let totalAnswered = 0;
          let totalIncorrect = 0;

          // Process answered questions
          for (const stat of userStats) {
            if (stat.hasAnswered) {
              totalAnswered++;

              if (stat.themeId) {
                answeredByTheme[stat.themeId] =
                  (answeredByTheme[stat.themeId] || 0) + 1;
              }
              if (stat.subthemeId) {
                answeredBySubtheme[stat.subthemeId] =
                  (answeredBySubtheme[stat.subthemeId] || 0) + 1;
              }
              if (stat.groupId) {
                answeredByGroup[stat.groupId] =
                  (answeredByGroup[stat.groupId] || 0) + 1;
              }

              if (stat.isIncorrect) {
                totalIncorrect++;
                if (stat.themeId) {
                  incorrectByTheme[stat.themeId] =
                    (incorrectByTheme[stat.themeId] || 0) + 1;
                }
                if (stat.subthemeId) {
                  incorrectBySubtheme[stat.subthemeId] =
                    (incorrectBySubtheme[stat.subthemeId] || 0) + 1;
                }
                if (stat.groupId) {
                  incorrectByGroup[stat.groupId] =
                    (incorrectByGroup[stat.groupId] || 0) + 1;
                }
              }
            }
          }

          // Process bookmarked questions
          const totalBookmarked = userBookmarks.length;
          for (const bookmark of userBookmarks) {
            if (bookmark.themeId) {
              bookmarkedByTheme[bookmark.themeId] =
                (bookmarkedByTheme[bookmark.themeId] || 0) + 1;
            }
            if (bookmark.subthemeId) {
              bookmarkedBySubtheme[bookmark.subthemeId] =
                (bookmarkedBySubtheme[bookmark.subthemeId] || 0) + 1;
            }
            if (bookmark.groupId) {
              bookmarkedByGroup[bookmark.groupId] =
                (bookmarkedByGroup[bookmark.groupId] || 0) + 1;
            }
          }

          // Insert the computed counts (tenant-scoped)
          await ctx.db.insert('userStatsCounts', {
            userId: user._id,
            tenantId,
            totalAnswered,
            totalIncorrect,
            totalBookmarked,
            answeredByTheme,
            incorrectByTheme,
            bookmarkedByTheme,
            answeredBySubtheme,
            incorrectBySubtheme,
            bookmarkedBySubtheme,
            answeredByGroup,
            incorrectByGroup,
            bookmarkedByGroup,
            lastUpdated: Date.now(),
          });

          processedUsers++;
        } catch (error) {
          errors.push(
            `Failed to initialize counts for user ${user._id}: ${error}`,
          );
          skippedUsers++;
        }
      }

      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    return {
      success: true,
      message: `Migration completed for tenant: ${processedUsers} users processed, ${skippedUsers} skipped`,
      processedUsers,
      skippedUsers,
      errors,
    };
  },
});
