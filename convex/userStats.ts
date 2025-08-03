import { v } from 'convex/values';

import { api } from './_generated/api';
import { Doc, Id } from './_generated/dataModel';
import { query, internalMutation } from './_generated/server';
import {
  getTotalQuestionCount,
  getUserAnsweredCount,
  getUserIncorrectCount,
  getUserBookmarksCount,
} from './aggregateQueries.js';
import { getCurrentUserOrThrow } from './users';
import {
  answeredByUser,
  incorrectByUser,
  answeredByThemeByUser,
  answeredBySubthemeByUser,
  answeredByGroupByUser,
  incorrectByThemeByUser,
  incorrectBySubthemeByUser,
  incorrectByGroupByUser,
} from './aggregates';

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

    // Use efficient aggregates for user stats
    const [totalAnswered, totalIncorrect, totalBookmarked] = await Promise.all([
      getUserAnsweredCount(ctx, userId._id),
      getUserIncorrectCount(ctx, userId._id),
      getUserBookmarksCount(ctx, userId._id),
    ]);

    const totalCorrect = totalAnswered - totalIncorrect;

    // Still need to collect user stats for theme breakdown
    const userStatsSummary = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user', q => q.eq('userId', userId._id))
      .collect();

    // Get total questions count using aggregate
    const totalQuestions = await getTotalQuestionCount(ctx);

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
        getTotalQuestionCount(ctx),
        getUserAnsweredCount(ctx, userId._id),
        getUserIncorrectCount(ctx, userId._id),
        getUserBookmarksCount(ctx, userId._id),
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
    let statRecord;

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
      statRecord = { ...existingStat, ...updateData };
    } else {
      // Skip creating stats if question lacks required taxonomy fields for aggregates
      // The hierarchical aggregates require complete taxonomy hierarchy
      if (!question.subthemeId || !question.groupId) {
        return {
          success: false,
          action: 'skipped',
          error:
            'Question lacks complete taxonomy hierarchy required for stats tracking',
        };
      }

      // Create a new record with complete taxonomy fields for aggregates
      const newStatData = {
        userId: userId,
        questionId: args.questionId,
        hasAnswered: true,
        isIncorrect: !args.isCorrect,
        answeredAt: now,
        themeId: question.themeId,
        subthemeId: question.subthemeId,
        groupId: question.groupId,
      };

      const statId = await ctx.db.insert('userQuestionStats', newStatData);
      statRecord = { ...newStatData, _id: statId, _creationTime: now };
    }

    // REAL-TIME AGGREGATE UPDATES using batch processing for better performance

    // Batch all answered aggregate operations
    const answeredAggregateOps = [
      () => answeredByUser.insertIfDoesNotExist(ctx, statRecord),
      question.themeId
        ? () => answeredByThemeByUser.insertIfDoesNotExist(ctx, statRecord)
        : null,
      question.subthemeId
        ? () => answeredBySubthemeByUser.insertIfDoesNotExist(ctx, statRecord)
        : null,
      question.groupId
        ? () => answeredByGroupByUser.insertIfDoesNotExist(ctx, statRecord)
        : null,
    ].filter(Boolean) as (() => Promise<any>)[];

    // Execute answered aggregates in parallel
    await Promise.all(answeredAggregateOps.map(op => op()));

    // Handle incorrect aggregates based on answer correctness
    if (!args.isCorrect) {
      // Batch all incorrect aggregate insert operations
      const incorrectInsertOps = [
        () => incorrectByUser.insertIfDoesNotExist(ctx, statRecord),
        question.themeId
          ? () => incorrectByThemeByUser.insertIfDoesNotExist(ctx, statRecord)
          : null,
        question.subthemeId
          ? () =>
              incorrectBySubthemeByUser.insertIfDoesNotExist(ctx, statRecord)
          : null,
        question.groupId
          ? () => incorrectByGroupByUser.insertIfDoesNotExist(ctx, statRecord)
          : null,
      ].filter(Boolean) as (() => Promise<any>)[];

      // Execute incorrect insert aggregates in parallel
      await Promise.all(incorrectInsertOps.map(op => op()));
    } else if (wasIncorrectBefore && args.isCorrect) {
      // Batch all incorrect aggregate delete operations
      const incorrectDeleteOps = [
        () => incorrectByUser.delete(ctx, statRecord),
        question.themeId
          ? () => incorrectByThemeByUser.delete(ctx, statRecord)
          : null,
        question.subthemeId
          ? () => incorrectBySubthemeByUser.delete(ctx, statRecord)
          : null,
        question.groupId
          ? () => incorrectByGroupByUser.delete(ctx, statRecord)
          : null,
      ].filter(Boolean) as (() => Promise<any>)[];

      // Execute incorrect delete aggregates in parallel with error handling
      try {
        await Promise.all(incorrectDeleteOps.map(op => op()));
      } catch (error) {
        // Gracefully handle missing entries - they might not exist in aggregates
        console.warn(
          'Could not delete from incorrect aggregates (entry may not exist):',
          error,
        );
      }
    }

    return {
      success: true,
      action: existingStat ? 'updated' : 'created',
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

// Helper function to get week string from timestamp following ISO 8601 standards
function getWeekString(timestamp: number): string {
  const date = new Date(timestamp);

  // Adjust to nearest Thursday (ISO week date system)
  // Thursday is day 4 in ISO (Monday=1, Tuesday=2, ..., Sunday=7)
  const dayOfWeek = (date.getDay() + 6) % 7; // Convert Sunday=0 to Sunday=6, Monday=0
  const nearestThursday = new Date(date.getTime());
  nearestThursday.setDate(date.getDate() - dayOfWeek + 3); // Adjust to Thursday

  // Get the year of the Thursday (this determines the ISO year)
  const isoYear = nearestThursday.getFullYear();

  // Find the first Thursday of the ISO year (which is in the first ISO week)
  const jan4 = new Date(isoYear, 0, 4);
  const firstThursday = new Date(jan4.getTime());
  const jan4DayOfWeek = (jan4.getDay() + 6) % 7; // Convert to Monday=0 system
  firstThursday.setDate(4 - jan4DayOfWeek + 3); // Adjust to first Thursday

  // Calculate week number
  const weekNumber =
    Math.floor(
      (nearestThursday.getTime() - firstThursday.getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    ) + 1;

  return `${isoYear}-W${weekNumber.toString().padStart(2, '0')}`;
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
