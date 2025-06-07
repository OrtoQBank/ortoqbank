import { v } from 'convex/values';

import { Doc } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { getCurrentUserOrThrow } from './users';

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    category: v.union(v.literal('trilha'), v.literal('simulado')),
    questions: v.array(v.id('questions')),
    themeId: v.id('themes'),
    subthemeId: v.optional(v.id('subthemes')),
    groupId: v.optional(v.id('groups')),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('presetQuizzes', {
      ...args,
      isPublic: false, // Default to private
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
  _id: Doc<'questions'>['_id'];
  _creationTime: Doc<'questions'>['_creationTime'];
  title: Doc<'questions'>['title'];
  questionTextString: Doc<'questions'>['questionTextString'];
  alternatives: Doc<'questions'>['alternatives'];
  questionCode?: Doc<'questions'>['questionCode'];
};

// Utility function to prepare question data for client
function sanitizeQuestionForClient(question: Doc<'questions'>): SafeQuestion {
  const safeQuestion = {
    _id: question._id,
    _creationTime: question._creationTime,
    title: question.title,
    questionTextString: question.questionTextString,
    alternatives: question.alternatives,
    questionCode: question.questionCode,
  };
  return safeQuestion;
}

export const getQuizData = query({
  args: { quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')) },
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) throw new Error('Quiz not found');

    // Get all questions and sanitize them
    const safeQuestions: SafeQuestion[] = await Promise.all(
      quiz.questions.map(async questionId => {
        const question = await ctx.db.get(questionId);
        if (!question) throw new Error('Question not found');
        return sanitizeQuestionForClient(question);
      }),
    );

    // Return quiz data, preserving all fields (including new taxonomy fields if they exist)
    // This ensures backwards compatibility while supporting new fields
    return {
      ...quiz,
      questions: safeQuestions,
    };
  },
});
