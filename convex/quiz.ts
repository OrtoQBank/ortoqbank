import { v } from 'convex/values';

import { Doc, Id } from './_generated/dataModel';
import { query } from './_generated/server';
import { requireAppModerator } from './auth';
import { mutation } from './triggers';

// Helper to fetch question content from questionContent table
// Falls back to deprecated fields on the question itself if content not migrated yet
async function fetchQuestionContent(
  ctx: any,
  questionId: Id<'questions'>,
  question?: Doc<'questions'> | null,
): Promise<{ questionTextString: string; alternatives: string[] }> {
  // First try the new questionContent table
  const content = await ctx.db
    .query('questionContent')
    .withIndex('by_question', (q: any) => q.eq('questionId', questionId))
    .first();

  if (content) {
    return {
      questionTextString: content.questionTextString,
      alternatives: content.alternatives,
    };
  }

  // Fallback to deprecated fields on the question itself (for non-migrated questions)
  const questionDoc = question || (await ctx.db.get(questionId));
  return {
    questionTextString: questionDoc?.questionTextString || '',
    alternatives: questionDoc?.alternatives || [],
  };
}

export const create = mutation({
  args: {
    tenantId: v.id('apps'),
    name: v.string(),
    description: v.string(),
    category: v.union(v.literal('trilha'), v.literal('simulado')),
    questions: v.array(v.id('questions')),
    themeId: v.id('themes'),
    subthemeId: v.optional(v.id('subthemes')),
    groupId: v.optional(v.id('groups')),
  },
  handler: async (ctx, args) => {
    await requireAppModerator(ctx, args.tenantId);

    const { tenantId, ...quizData } = args;
    return await ctx.db.insert('presetQuizzes', {
      ...quizData,
      isPublic: false, // Default to private
      tenantId,
    });
  },
});

export const getById = query({
  args: { id: v.union(v.id('presetQuizzes'), v.id('customQuizzes')) },
  handler: async (ctx, { id }) => {
    const quiz = await ctx.db.get(id);
    if (!quiz) {
      throw new Error('Quiz not found');
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

export type SafeQuestion = {
  _id: Id<'questions'>;
  _creationTime: number;
  title: string;
  questionTextString: string;
  alternatives: string[];
  questionCode?: string;
};

export const getQuizData = query({
  args: { quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')) },
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) throw new Error('Quiz not found');

    // Get all questions with content from questionContent table
    // Falls back to deprecated fields on question if not migrated
    const safeQuestions: SafeQuestion[] = await Promise.all(
      quiz.questions.map(async questionId => {
        const question = await ctx.db.get(questionId);
        if (!question) throw new Error('Question not found');

        // Fetch heavy content (with fallback to deprecated fields)
        const content = await fetchQuestionContent(ctx, questionId, question);

        return {
          _id: question._id,
          _creationTime: question._creationTime,
          title: question.title,
          questionTextString: content.questionTextString,
          alternatives: content.alternatives,
          questionCode: question.questionCode,
        };
      }),
    );

    return {
      ...quiz,
      questions: safeQuestions,
    };
  },
});

// Type for quiz results questions - includes correctAlternativeIndex
export type ResultsQuestion = {
  _id: Id<'questions'>;
  _creationTime: number;
  questionTextString: string;
  alternatives: string[];
  correctAlternativeIndex: number;
  questionCode?: string;
};

// Lightweight version for quiz results - fetches content from questionContent table
// Falls back to deprecated fields on question if not migrated
export const getQuizDataForResults = query({
  args: { quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')) },
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) throw new Error('Quiz not found');

    // Get question data with content (with fallback to deprecated fields)
    const lightweightQuestions: ResultsQuestion[] = await Promise.all(
      quiz.questions.map(async questionId => {
        const question = await ctx.db.get(questionId);
        if (!question) throw new Error('Question not found');

        // Fetch heavy content (with fallback to deprecated fields)
        const content = await fetchQuestionContent(ctx, questionId, question);

        return {
          _id: question._id,
          _creationTime: question._creationTime,
          questionTextString: content.questionTextString,
          alternatives: content.alternatives,
          correctAlternativeIndex: question.correctAlternativeIndex,
          questionCode: question.questionCode,
        };
      }),
    );

    return {
      ...quiz,
      questions: lightweightQuestions,
    };
  },
});
