import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { getCurrentUserOrThrow } from './users';

// Helper to fetch question content from questionContent table
async function fetchQuestionContent(
  ctx: any,
  questionId: Id<'questions'>,
): Promise<{ questionTextString: string; alternatives: string[] } | null> {
  const content = await ctx.db
    .query('questionContent')
    .withIndex('by_question', (q: any) => q.eq('questionId', questionId))
    .first();
  if (!content) return null;
  return {
    questionTextString: content.questionTextString,
    alternatives: content.alternatives,
  };
}

export type QuestionMode = 'all' | 'unanswered' | 'incorrect' | 'bookmarked';

export const getCustomQuizzes = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);

    // Use an index on authorId if available or limit the number of results
    // to avoid a full table scan
    const limit = args.limit || 50; // Default to 50 if not specified

    // Get custom quizzes created by this user with pagination
    const quizzes = await ctx.db
      .query('customQuizzes')
      .filter((q: any) => q.eq(q.field('authorId'), userId._id))
      .order('desc') // Most recent first
      .take(limit);

    return quizzes;
  },
});

export const deleteCustomQuiz = mutation({
  args: {
    quizId: v.id('customQuizzes'),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);

    const quiz = await ctx.db.get(args.quizId);

    if (!quiz) {
      throw new Error('Quiz not found');
    }

    if (quiz.authorId !== userId._id) {
      throw new Error('You are not authorized to delete this quiz');
    }

    // Delete any active sessions for this quiz - using proper index
    const sessions = await ctx.db
      .query('quizSessions')
      .withIndex('by_user_quiz', (q: any) =>
        q.eq('userId', userId._id).eq('quizId', args.quizId),
      )
      .collect();

    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    // Delete the quiz itself
    await ctx.db.delete(args.quizId);

    return { success: true };
  },
});

export const getById = query({
  args: { id: v.id('customQuizzes') },
  handler: async (ctx, { id }) => {
    const userId = await getCurrentUserOrThrow(ctx);
    const quiz = await ctx.db.get(id);

    if (!quiz) {
      throw new Error('Quiz not found');
    }

    // Verify that the user has access to this quiz
    if (quiz.authorId !== userId._id) {
      throw new Error('Not authorized to access this quiz');
    }

    // Fetch all questions data
    const questions = await Promise.all(
      quiz.questions.map(questionId => ctx.db.get(questionId)),
    );

    return {
      ...quiz,
      questions: questions.filter(Boolean), // Remove any null values
    };
  },
});

// Lightweight version for quiz results - fetches content from questionContent table
export const getByIdForResults = query({
  args: { id: v.id('customQuizzes') },
  handler: async (ctx, { id }) => {
    const userId = await getCurrentUserOrThrow(ctx);
    const quiz = await ctx.db.get(id);

    if (!quiz) {
      throw new Error('Quiz not found');
    }

    // Verify that the user has access to this quiz
    if (quiz.authorId !== userId._id) {
      throw new Error('Not authorized to access this quiz');
    }

    // Get question data with content from questionContent table
    const lightweightQuestions = await Promise.all(
      quiz.questions.map(async questionId => {
        const question = await ctx.db.get(questionId);
        if (!question) return null;

        // Fetch heavy content from questionContent table
        const content = await fetchQuestionContent(ctx, questionId);

        return {
          _id: question._id,
          _creationTime: question._creationTime,
          questionTextString: content?.questionTextString || '',
          alternatives: content?.alternatives || [],
          correctAlternativeIndex: question.correctAlternativeIndex,
          questionCode: question.questionCode,
        };
      }),
    );

    return {
      ...quiz,
      questions: lightweightQuestions.filter(Boolean), // Remove any null values
    };
  },
});

export const updateName = mutation({
  args: {
    id: v.id('customQuizzes'),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);

    const quiz = await ctx.db.get(args.id);

    if (!quiz) {
      throw new Error('Quiz not found');
    }

    // Verify that the user has access to this quiz
    if (quiz.authorId !== userId._id) {
      throw new Error('Not authorized to update this quiz');
    }

    // Update the name
    await ctx.db.patch(args.id, {
      name: args.name,
    });

    return { success: true };
  },
});

export const searchByName = query({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.name || args.name.trim() === '') {
      return [];
    }

    const userId = await getCurrentUserOrThrow(ctx);

    // Normalize the search term
    const searchTerm = args.name.trim();

    // Use the search index for efficient text search
    // Also filter by the current user's ID since custom quizzes are user-specific
    const matchingQuizzes = await ctx.db
      .query('customQuizzes')
      .withSearchIndex('search_by_name', (q: any) =>
        q.search('name', searchTerm),
      )
      .filter((q: any) => q.eq(q.field('authorId'), userId._id))
      .take(50); // Limit results to reduce bandwidth

    return matchingQuizzes;
  },
});
