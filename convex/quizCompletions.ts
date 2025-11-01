import { v } from 'convex/values';

import { query } from './_generated/server';
import { getCurrentUserOrThrow } from './users';

/**
 * Quiz Completions
 * 
 * This file manages the lightweight quizCompletions table, which tracks
 * completed quizzes without storing heavy answerFeedback data.
 * 
 * This is a performance optimization that allows checking quiz completion
 * status without loading large JSON strings from the database.
 */

// 🚀 OPTIMIZED: Lightweight query that uses quizCompletions table
// This truly avoids loading heavy answerFeedback data at the database level.
// Use this for checking quiz completion status (Trilhas, Simulados pages).
export const getCompletedQuizIds = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('quizCompletions'),
      quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')),
      completedAt: v.number(),
      mode: v.union(v.literal('exam'), v.literal('study')),
      sessionId: v.id('quizSessions'),
    }),
  ),
  handler: async ctx => {
    const userId = await getCurrentUserOrThrow(ctx);

    // Query lightweight quizCompletions table - NO heavy answerFeedback data!
    const completions = await ctx.db
      .query('quizCompletions')
      .withIndex('by_user', q => q.eq('userId', userId._id))
      .order('desc')
      .collect();

    return completions;
  },
});

// Get completions for a specific quiz
export const getQuizCompletions = query({
  args: { quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')) },
  returns: v.array(
    v.object({
      _id: v.id('quizCompletions'),
      quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')),
      completedAt: v.number(),
      mode: v.union(v.literal('exam'), v.literal('study')),
      sessionId: v.id('quizSessions'),
    }),
  ),
  handler: async (ctx, { quizId }) => {
    const userId = await getCurrentUserOrThrow(ctx);

    const completions = await ctx.db
      .query('quizCompletions')
      .withIndex('by_user_quiz', q =>
        q.eq('userId', userId._id).eq('quizId', quizId),
      )
      .order('desc')
      .collect();

    return completions;
  },
});

// Check if a specific quiz has been completed
export const hasCompletedQuiz = query({
  args: { quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')) },
  returns: v.boolean(),
  handler: async (ctx, { quizId }) => {
    const userId = await getCurrentUserOrThrow(ctx);

    const completion = await ctx.db
      .query('quizCompletions')
      .withIndex('by_user_quiz', q =>
        q.eq('userId', userId._id).eq('quizId', quizId),
      )
      .first();

    return !!completion;
  },
});

// Get the most recent completion for a quiz
export const getLatestCompletion = query({
  args: { quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')) },
  returns: v.union(
    v.object({
      _id: v.id('quizCompletions'),
      quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')),
      completedAt: v.number(),
      mode: v.union(v.literal('exam'), v.literal('study')),
      sessionId: v.id('quizSessions'),
    }),
    v.null(),
  ),
  handler: async (ctx, { quizId }) => {
    const userId = await getCurrentUserOrThrow(ctx);

    const completion = await ctx.db
      .query('quizCompletions')
      .withIndex('by_user_quiz', q =>
        q.eq('userId', userId._id).eq('quizId', quizId),
      )
      .order('desc')
      .first();

    return completion || null;
  },
});

