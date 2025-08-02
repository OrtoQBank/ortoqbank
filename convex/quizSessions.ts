import { v } from 'convex/values';

import { internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { query } from './_generated/server';
import { getCurrentUserOrThrow } from './users';
import { mutation } from './triggers';

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

    // 2. Get quiz and current question
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) throw new Error('Quiz not found');

    const currentQuestion = await ctx.db.get(
      quiz.questions[session.currentQuestionIndex],
    );
    if (!currentQuestion) throw new Error('Question not found');

    // 3. Check if answer is correct and get explanation
    const isAnswerCorrect =
      args.selectedAlternativeIndex === currentQuestion.correctAlternativeIndex;

    // 4. Save answer and feedback for current question - ensure explanation is a string
    const explanationString =
      typeof currentQuestion.explanationTextString === 'string'
        ? currentQuestion.explanationTextString
        : JSON.stringify(currentQuestion.explanationTextString);

    await ctx.db.patch(session._id, {
      answers: [...session.answers, args.selectedAlternativeIndex],
      answerFeedback: [
        ...session.answerFeedback,
        {
          isCorrect: isAnswerCorrect,
          explanation: explanationString,
          correctAlternative: currentQuestion.correctAlternativeIndex,
        },
      ],
      currentQuestionIndex: session.currentQuestionIndex + 1,
      isComplete: session.currentQuestionIndex + 1 >= quiz.questions.length,
    });

    // 5. Update user stats for this question
    await ctx.runMutation(internal.userStats._updateQuestionStats, {
      questionId: currentQuestion._id,
      isCorrect: isAnswerCorrect,
    });

    return {
      isAnswerCorrect,
      feedback: isAnswerCorrect ? 'Correct!' : 'Incorrect',
      explanation: explanationString,
      correctAlternative: currentQuestion.correctAlternativeIndex,
      nextQuestionIndex: session.currentQuestionIndex + 1,
      isComplete: session.currentQuestionIndex + 1 >= quiz.questions.length,
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
