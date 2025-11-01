import { v } from 'convex/values';

import { internal } from './_generated/api';
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

    const sessionId = await ctx.db.insert('quizSessions', {
      userId: userId._id,
      quizId,
      mode,
      currentQuestionIndex: 0,
      answers: [],
      answerFeedback: [],
      isComplete: false,
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

    // 3. Pre-compute values for efficient session update
    const isAnswerCorrect =
      args.selectedAlternativeIndex === currentQuestion.correctAlternativeIndex;

    const explanationString =
      typeof currentQuestion.explanationTextString === 'string'
        ? currentQuestion.explanationTextString
        : JSON.stringify(currentQuestion.explanationTextString);

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

    // 5. If quiz is complete, write to lightweight quizCompletions table
    if (isQuizComplete) {
      await ctx.db.insert('quizCompletions', {
        userId: userId._id,
        quizId: args.quizId,
        sessionId: session._id,
        completedAt: Date.now(),
        mode: session.mode,
      });
    }

    // 6. Schedule user stats update asynchronously (non-blocking)
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

    // Write to lightweight quizCompletions table
    await ctx.db.insert('quizCompletions', {
      userId: userId._id,
      quizId: args.quizId,
      sessionId: session._id,
      completedAt: Date.now(),
      mode: session.mode,
    });

    return { success: true };
  },
});

// Add this new query function to list incomplete sessions for current user
export const listIncompleteSessions = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('quizSessions'),
      _creationTime: v.number(),
      userId: v.id('users'),
      quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')),
      mode: v.union(v.literal('exam'), v.literal('study')),
      currentQuestionIndex: v.number(),
      answers: v.array(v.number()),
      answerFeedback: v.array(
        v.object({
          isCorrect: v.boolean(),
          explanation: v.union(
            v.string(),
            v.object({ type: v.string(), content: v.array(v.any()) }),
          ),
          correctAlternative: v.optional(v.number()),
        }),
      ),
      isComplete: v.boolean(),
    }),
  ),
  handler: async ctx => {
    const userId = await getCurrentUserOrThrow(ctx);

    // Use optimized index to query incomplete sessions without .filter()
    const sessions = await ctx.db
      .query('quizSessions')
      .withIndex('by_user_complete', q =>
        q.eq('userId', userId._id).eq('isComplete', false),
      )
      .collect();

    return sessions;
  },
});

// Add this function to get completed sessions for a quiz
export const getCompletedSessions = query({
  args: { quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')) },
  returns: v.array(
    v.object({
      _id: v.id('quizSessions'),
      _creationTime: v.number(),
      userId: v.id('users'),
      quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')),
      mode: v.union(v.literal('exam'), v.literal('study')),
      currentQuestionIndex: v.number(),
      answers: v.array(v.number()),
      answerFeedback: v.array(
        v.object({
          isCorrect: v.boolean(),
          explanation: v.union(
            v.string(),
            v.object({ type: v.string(), content: v.array(v.any()) }),
          ),
          correctAlternative: v.optional(v.number()),
        }),
      ),
      isComplete: v.boolean(),
    }),
  ),
  handler: async (ctx, { quizId }) => {
    const userId = await getCurrentUserOrThrow(ctx);

    // Use the full index efficiently - no need for .filter()
    // The index is ['userId', 'quizId', 'isComplete'], so we can query all three fields
    const sessions = await ctx.db
      .query('quizSessions')
      .withIndex('by_user_quiz', q =>
        q.eq('userId', userId._id).eq('quizId', quizId).eq('isComplete', true),
      )
      .order('desc')
      .collect();

    return sessions;
  },
});

// Get all completed sessions for the current user
// Note: This returns full session data including heavy answerFeedback arrays.
// For checking quiz completion status only, use getCompletedQuizIds instead.
export const getAllCompletedSessions = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('quizSessions'),
      _creationTime: v.number(),
      userId: v.id('users'),
      quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')),
      mode: v.union(v.literal('exam'), v.literal('study')),
      currentQuestionIndex: v.number(),
      answers: v.array(v.number()),
      answerFeedback: v.array(
        v.object({
          isCorrect: v.boolean(),
          explanation: v.union(
            v.string(),
            v.object({ type: v.string(), content: v.array(v.any()) }),
          ),
          correctAlternative: v.optional(v.number()),
        }),
      ),
      isComplete: v.boolean(),
    }),
  ),
  handler: async ctx => {
    const userId = await getCurrentUserOrThrow(ctx);

    // Use optimized index to query completed sessions without .filter()
    // This avoids scanning incomplete sessions and is much more efficient
    const sessions = await ctx.db
      .query('quizSessions')
      .withIndex('by_user_complete', q =>
        q.eq('userId', userId._id).eq('isComplete', true),
      )
      .order('desc')
      .collect();

    return sessions;
  },
});

// ⚠️ DEPRECATED: Quiz completion queries have been moved to convex/quizCompletions.ts
// For checking quiz completion status, use:
//   - api.quizCompletions.getCompletedQuizIds() - Get all completed quiz IDs
//   - api.quizCompletions.hasCompletedQuiz() - Check if specific quiz is completed
//   - api.quizCompletions.getQuizCompletions() - Get all completions for a quiz
//
// These queries use the lightweight quizCompletions table and avoid loading
// heavy answerFeedback data from the database.
