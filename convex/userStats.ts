import { v } from 'convex/values';

import { api } from './_generated/api';
import { Doc, Id } from './_generated/dataModel';
import { internalMutation, query } from './_generated/server';
import * as aggregateHelpers from './aggregateHelpers';
import { getCurrentUserOrThrow } from './users';

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

type UserStatsSummary = {
  totalAnswered: number;
  totalCorrect: number;
  totalIncorrect: number;
  totalBookmarked: number;
  correctPercentage: number;
  totalQuestions: number;
};

/**
 * Get user statistics from the persistent userQuestionStats table
 * Uses aggregate to reduce bandwidth and improve efficiency
 */
export const getUserStatsFromTable = query({
  args: {},
  handler: async (ctx): Promise<UserStats> => {
    const userId = await getCurrentUserOrThrow(ctx);

    // We'll skip the aggregate for now until we properly set it up
    // Just go directly to more efficient queries

    // Get user stats efficiently with a single query using aggregation
    const userStatsSummary = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user', q => q.eq('userId', userId._id))
      .collect();

    // Count the totals from the summary rather than making individual queries
    const totalAnswered = userStatsSummary.filter(
      stat => stat.hasAnswered,
    ).length;
    const totalIncorrect = userStatsSummary.filter(
      stat => stat.isIncorrect,
    ).length;
    const totalCorrect = totalAnswered - totalIncorrect;

    // Get bookmarks count (can't be avoided, but this is a smaller query)
    const bookmarks = await ctx.db
      .query('userBookmarks')
      .withIndex('by_user', q => q.eq('userId', userId._id))
      .collect();
    const totalBookmarked = bookmarks.length;

    // Get total questions count using aggregate
    const totalQuestions = await ctx.runQuery(
      api.questionStats.getTotalQuestionCount,
      {},
    );

    // Efficiently process theme stats using a group approach
    // We'll use a Map to store stats by theme
    const themeStatsMap = new Map<
      Id<'themes'>,
      { correct: number; total: number }
    >();

    // First, efficiently fetch all themes to have their names ready
    const themeIds = new Set<Id<'themes'>>();
    for (const stat of userStatsSummary) {
      // Fetch the question to get its themeId
      const question = await ctx.db.get(stat.questionId);
      if (question) {
        themeIds.add(question.themeId);
      }
    }

    // Fetch all needed themes in one batch
    const themeIdsArray = [...themeIds];
    const themes = await Promise.all(themeIdsArray.map(id => ctx.db.get(id)));

    // Create a map of theme IDs to theme names
    const themeNameMap = new Map<Id<'themes'>, string>();
    themes.forEach(theme => {
      if (theme) {
        themeNameMap.set(theme._id, theme.name);
      }
    });

    // Now process each user stat to build theme stats
    for (const stat of userStatsSummary) {
      const question = await ctx.db.get(stat.questionId);
      if (!question) continue;

      const themeId = question.themeId;

      if (!themeStatsMap.has(themeId)) {
        themeStatsMap.set(themeId, { correct: 0, total: 0 });
      }

      const themeStat = themeStatsMap.get(themeId)!;

      if (stat.hasAnswered) {
        themeStat.total++;
        if (!stat.isIncorrect) {
          themeStat.correct++;
        }
      }
    }

    // Convert Map to array for frontend
    const themeStats = [...themeStatsMap.entries()]
      .map(([themeId, stats]) => ({
        themeId,
        themeName: themeNameMap.get(themeId) || 'Unknown Theme',
        total: stats.total,
        correct: stats.correct,
        percentage:
          stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      overall: {
        totalAnswered,
        totalCorrect,
        totalIncorrect,
        totalBookmarked,
        correctPercentage:
          totalAnswered > 0
            ? Math.round((totalCorrect / totalAnswered) * 100)
            : 0,
      },
      byTheme: themeStats,
      totalQuestions,
    };
  },
});

/**
 * Get user statistics summary using aggregates for faster performance
 */
export const getUserStatsSummaryWithAggregates = query({
  args: {},
  handler: async (ctx): Promise<UserStatsSummary> => {
    const userId = await getCurrentUserOrThrow(ctx);

    // Using our aggregate helpers for efficient counting
    const [totalQuestions, totalAnswered, totalIncorrect, totalBookmarked] =
      await Promise.all([
        aggregateHelpers.getTotalQuestionCount(ctx),
        aggregateHelpers.getUserAnsweredCount(ctx, userId._id),
        aggregateHelpers.getUserIncorrectCount(ctx, userId._id),
        aggregateHelpers.getUserBookmarksCount(ctx, userId._id),
      ]);

    // Calculate derived values
    const totalCorrect = totalAnswered - totalIncorrect;
    const correctPercentage =
      totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

    return {
      totalAnswered,
      totalCorrect,
      totalIncorrect,
      totalBookmarked,
      correctPercentage,
      totalQuestions,
    };
  },
});

/**
 * Internal mutation to update question statistics when a user answers a question
 * This should only be called from the quizSessions.submitAnswerAndProgress function
 */
export const _updateQuestionStats = internalMutation({
  args: {
    questionId: v.id('questions'),
    isCorrect: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);
    const now = Date.now();

    // Check if we already have a record for this user and question
    const existingStat = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user_question', q =>
        q.eq('userId', userId._id).eq('questionId', args.questionId),
      )
      .first();

    if (existingStat) {
      // Update existing record
      if (args.isCorrect && existingStat.isIncorrect) {
        // If the question was previously incorrect but is now correct,
        // update the record to show it's no longer incorrect
        await ctx.db.patch(existingStat._id, {
          isIncorrect: false,
          answeredAt: now,
          // Keep the original firstAnsweredAt - don't update it
        });
      } else if (args.isCorrect) {
        // Just update the timestamp
        await ctx.db.patch(existingStat._id, {
          answeredAt: now,
          // Keep the original firstAnsweredAt - don't update it
        });
      } else {
        // If the answer is incorrect, mark it as incorrect
        await ctx.db.patch(existingStat._id, {
          isIncorrect: true,
          answeredAt: now,
          // Keep the original firstAnsweredAt - don't update it
        });
      }

      return { success: true, action: 'updated' };
    } else {
      // Create a new record
      await ctx.db.insert('userQuestionStats', {
        userId: userId._id,
        questionId: args.questionId,
        hasAnswered: true,
        isIncorrect: !args.isCorrect,
        answeredAt: now,
        // _creationTime will automatically track when this was first answered
      });

      return { success: true, action: 'created' };
    }
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

// Helper function to get week string from timestamp
function getWeekString(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor(
    (date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000),
  );
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

/**
 * Get user progress over time grouped by weeks
 */
export const getUserWeeklyProgress = query({
  args: {},
  returns: v.array(
    v.object({
      week: v.string(),
      totalAnswered: v.number(),
      weeklyAnswered: v.number(),
    }),
  ),
  handler: async ctx => {
    const userId = await getCurrentUserOrThrow(ctx);

    // Get all answered questions with timestamps
    const answeredStats = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user_answered', q =>
        q.eq('userId', userId._id).eq('hasAnswered', true),
      )
      .collect();

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
      .sort(([a], [b]) => a.localeCompare(b))
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
