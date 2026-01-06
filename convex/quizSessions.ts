import { v } from 'convex/values';

import { internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { query } from './_generated/server';
import { mutation } from './triggers';
import { getCurrentUserOrThrow } from './users';

/**
 * Quiz Sessions
 *
 * CONTENT MIGRATION STATUS: UPDATED
 *
 * This file has been updated to use string format for TipTap content:
 * - When saving quiz session feedback, we now use the explanationTextString field
 * - When returning explanation data, we use the string format
 *
 * This ensures consistency with the rest of the application where string format
 * is preferred over object format for TipTap content.
 */

//@deprecated('Use getActiveSession instead')
export const getCurrentSession = query({
  args: { quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')) },
  handler: async (ctx, { quizId }) => {
    const userId = await getCurrentUserOrThrow(ctx);

    return ctx.db
      .query('quizSessions')
      .withIndex('by_user_quiz', q =>
        q.eq('userId', userId._id).eq('quizId', quizId).eq('isComplete', false),
      )
      .first();
  },
});

// New function to get the active session regardless of completion status
export const getActiveSession = query({
  args: { quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')) },
  handler: async (ctx, { quizId }) => {
    const userId = await getCurrentUserOrThrow(ctx);

    // First try to get an incomplete session
    const incompleteSession = await ctx.db
      .query('quizSessions')
      .withIndex('by_user_quiz', q =>
        q.eq('userId', userId._id).eq('quizId', quizId).eq('isComplete', false),
      )
      .first();

    if (incompleteSession) {
      return incompleteSession;
    }

    // If no incomplete session, get the most recent completed one
    return ctx.db
      .query('quizSessions')
      .withIndex('by_user_quiz', q =>
        q.eq('userId', userId._id).eq('quizId', quizId).eq('isComplete', true),
      )
      .order('desc') // Most recent first
      .first();
  },
});

export const getLatestCompletedSession = query({
  args: { quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')) },
  handler: async (ctx, { quizId }) => {
    const userId = await getCurrentUserOrThrow(ctx);

    // Get the most recent completed session for this quiz
    return ctx.db
      .query('quizSessions')
      .withIndex('by_user_quiz', q =>
        q.eq('userId', userId._id).eq('quizId', quizId).eq('isComplete', true),
      )
      .order('desc') // Most recent first
      .first();
  },
});

export const startQuizSession = mutation({
  args: {
    quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')),
    mode: v.union(v.literal('study'), v.literal('exam')),
  },
  handler: async (ctx, { quizId, mode }) => {
    const userId = await getCurrentUserOrThrow(ctx);

    // Get quiz to inherit tenantId - try both table types
    const presetQuiz = await ctx.db.get(quizId as Id<'presetQuizzes'>);
    const customQuiz = await ctx.db.get(quizId as Id<'customQuizzes'>);
    const quiz = presetQuiz || customQuiz;

    const sessionId = await ctx.db.insert('quizSessions', {
      userId: userId._id,
      quizId,
      mode,
      currentQuestionIndex: 0,
      answers: [],
      answerFeedback: [],
      isComplete: false,
      // Multi-tenancy: inherit tenantId from quiz
      tenantId: quiz?.tenantId,
    });

    return { sessionId };
  },
});

export const submitAnswerAndProgress = mutation({
  args: {
    quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')),
    selectedAlternativeIndex: v.union(
      v.literal(0),
      v.literal(1),
      v.literal(2),
      v.literal(3),
      v.literal(4),
      v.literal(5),
    ),
  },
  handler: async (ctx, args) => {
    // Performance monitoring: Track submission timing
    const startTime = Date.now();
    const userId = await getCurrentUserOrThrow(ctx);

    // 1. Get current session
    const session = await ctx.db
      .query('quizSessions')
      .withIndex('by_user_quiz', q =>
        q
          .eq('userId', userId._id)
          .eq('quizId', args.quizId)
          .eq('isComplete', false),
      )
      .first();

    if (!session) throw new Error('No active quiz progress found');

    // 2. Get quiz and batch fetch question data for better performance
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) throw new Error('Quiz not found');

    // Only fetch the current question - remove unnecessary next question fetch
    const currentQuestionId = quiz.questions[session.currentQuestionIndex];
    if (currentQuestionId == null) {
      throw new Error('Session out of sync: question index out of bounds');
    }
    const currentQuestion = await ctx.db.get(currentQuestionId);

    if (!currentQuestion) throw new Error('Question not found');

    // Fetch explanation from questionContent table (heavy content separated)
    const questionContent = await ctx.db
      .query('questionContent')
      .withIndex('by_question', q => q.eq('questionId', currentQuestionId))
      .first();

    // 3. Pre-compute values for efficient session update
    const isAnswerCorrect =
      args.selectedAlternativeIndex === currentQuestion.correctAlternativeIndex;

    // Get explanation from questionContent table
    const explanationString = questionContent?.explanationTextString || '';

    const nextQuestionIndex = session.currentQuestionIndex + 1;
    const isQuizComplete = nextQuestionIndex >= quiz.questions.length;

    // Pre-build feedback object to avoid inline object creation
    const feedbackEntry = {
      isCorrect: isAnswerCorrect,
      explanation: explanationString,
      correctAlternative: currentQuestion.correctAlternativeIndex,
    };

    // 4. Update session with optimized single patch operation
    await ctx.db.patch(session._id, {
      answers: [...session.answers, args.selectedAlternativeIndex],
      answerFeedback: [...session.answerFeedback, feedbackEntry],
      currentQuestionIndex: nextQuestionIndex,
      isComplete: isQuizComplete,
    });

    // 4b. If quiz is complete, insert into lightweight summary table for efficient queries
    if (isQuizComplete) {
      const existingSummary = await ctx.db
        .query('completedQuizSummaries')
        .withIndex('by_session', q => q.eq('sessionId', session._id))
        .first();

      if (!existingSummary) {
        await ctx.db.insert('completedQuizSummaries', {
          tenantId: session.tenantId,
          userId: userId._id,
          quizId: args.quizId,
          sessionId: session._id,
          completedAt: Date.now(),
        });
      }
    }

    // 5. Schedule user stats update asynchronously (non-blocking)
    ctx.scheduler.runAfter(0, internal.userStats._updateQuestionStats, {
      userId: userId._id,
      questionId: currentQuestion._id,
      isCorrect: isAnswerCorrect,
    });

    // Performance monitoring: Log submission timing
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(
      `🚀 Quiz submission performance: ${duration}ms (quizId: ${args.quizId}, questionIndex: ${session.currentQuestionIndex})`,
    );

    return {
      isAnswerCorrect,
      feedback: isAnswerCorrect ? 'Correct!' : 'Incorrect',
      explanation: explanationString,
      correctAlternative: currentQuestion.correctAlternativeIndex,
      nextQuestionIndex,
      isComplete: isQuizComplete,
    };
  },
});

// Add new mutation for explicitly completing the quiz
export const completeQuizSession = mutation({
  args: { quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')) },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);

    const session = await ctx.db
      .query('quizSessions')
      .withIndex('by_user_quiz', q =>
        q
          .eq('userId', userId._id)
          .eq('quizId', args.quizId)
          .eq('isComplete', false),
      )
      .first();

    if (!session) throw new Error('No active quiz session found');

    await ctx.db.patch(session._id, { isComplete: true });

    // Insert into lightweight summary table for efficient queries
    const existingSummary = await ctx.db
      .query('completedQuizSummaries')
      .withIndex('by_session', q => q.eq('sessionId', session._id))
      .first();
    if (!existingSummary) {
      await ctx.db.insert('completedQuizSummaries', {
        tenantId: session.tenantId,
        userId: userId._id,
        quizId: args.quizId,
        sessionId: session._id,
        completedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// Add this new query function to list incomplete sessions for current user
export const listIncompleteSessions = query({
  args: {},
  handler: async ctx => {
    const userId = await getCurrentUserOrThrow(ctx);

    // Query for all incomplete sessions for this user
    const sessions = await ctx.db
      .query('quizSessions')
      .withIndex('by_user_quiz', q => q.eq('userId', userId._id))
      .filter(q => q.eq(q.field('isComplete'), false))
      .collect();

    return sessions;
  },
});

// Add this function to get completed sessions for a quiz
export const getCompletedSessions = query({
  args: { quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')) },
  handler: async (ctx, { quizId }) => {
    const userId = await getCurrentUserOrThrow(ctx);

    // Get completed sessions for this user and quiz, ordered by newest first
    const sessions = await ctx.db
      .query('quizSessions')
      .withIndex('by_user_quiz', q =>
        q.eq('userId', userId._id).eq('quizId', quizId),
      )
      .filter(q => q.eq(q.field('isComplete'), true))
      .order('desc')
      .collect();

    return sessions;
  },
});

// Get all completed sessions for the current user
export const getAllCompletedSessions = query({
  args: {},
  handler: async ctx => {
    const userId = await getCurrentUserOrThrow(ctx);

    // Get all completed sessions for this user, ordered by newest first
    const sessions = await ctx.db
      .query('quizSessions')
      .withIndex('by_user_quiz', q => q.eq('userId', userId._id))
      .filter(q => q.eq(q.field('isComplete'), true))
      .order('desc')
      .collect();

    return sessions;
  },
});

// Lightweight query for getting completed quiz IDs only (optimized for performance)
// Uses denormalized completedQuizSummaries table to avoid reading heavy session data
export const getCompletedQuizIds = query({
  args: {},
  returns: v.array(
    v.object({
      quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')),
    }),
  ),
  handler: async ctx => {
    const userId = await getCurrentUserOrThrow(ctx);

    const summaries = await ctx.db
      .query('completedQuizSummaries')
      .withIndex('by_user', q => q.eq('userId', userId._id))
      .collect();

    return summaries.map(s => ({ quizId: s.quizId }));
  },
});
