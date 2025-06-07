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
    subcategory: v.optional(v.string()),
    // New taxonomy fields
    TaxThemeId: v.optional(v.id('taxonomy')),
    TaxSubthemeId: v.optional(v.id('taxonomy')),
    TaxGroupId: v.optional(v.id('taxonomy')),
    taxonomyPathIds: v.optional(v.array(v.id('taxonomy'))),
    isPublic: v.optional(v.boolean()),
    displayOrder: v.optional(v.number()),
  },
  returns: v.id('presetQuizzes'),
  handler: async (ctx, args) => {
    // Validate that taxonomy is provided
    const hasTaxonomy =
      args.TaxThemeId ||
      args.TaxSubthemeId ||
      args.TaxGroupId ||
      args.taxonomyPathIds;

    if (!hasTaxonomy) {
      throw new Error('At least one taxonomy field must be specified');
    }

    return await ctx.db.insert('presetQuizzes', {
      name: args.name,
      description: args.description,
      category: args.category,
      questions: args.questions,
      subcategory: args.subcategory,
      // New taxonomy fields
      TaxThemeId: args.TaxThemeId,
      TaxSubthemeId: args.TaxSubthemeId,
      TaxGroupId: args.TaxGroupId,
      taxonomyPathIds: args.taxonomyPathIds,
      isPublic: args.isPublic ?? false, // Default to private
      displayOrder: args.displayOrder,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id('presetQuizzes'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.union(v.literal('trilha'), v.literal('simulado'))),
    questions: v.optional(v.array(v.id('questions'))),
    subcategory: v.optional(v.string()),
    // New taxonomy fields
    TaxThemeId: v.optional(v.id('taxonomy')),
    TaxSubthemeId: v.optional(v.id('taxonomy')),
    TaxGroupId: v.optional(v.id('taxonomy')),
    taxonomyPathIds: v.optional(v.array(v.id('taxonomy'))),
    isPublic: v.optional(v.boolean()),
    displayOrder: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error('Quiz not found');
    }

    await ctx.db.patch(id, updates);
    return null;
  },
});

export const getById = query({
  args: { id: v.union(v.id('presetQuizzes'), v.id('customQuizzes')) },
  returns: v.union(
    v.object({
      _id: v.id('presetQuizzes'),
      _creationTime: v.number(),
      name: v.string(),
      description: v.string(),
      category: v.union(v.literal('trilha'), v.literal('simulado')),
      questions: v.array(v.any()), // Will be populated with full question data
      subcategory: v.optional(v.string()),
      TaxThemeId: v.optional(v.id('taxonomy')),
      TaxSubthemeId: v.optional(v.id('taxonomy')),
      TaxGroupId: v.optional(v.id('taxonomy')),
      taxonomyPathIds: v.optional(v.array(v.id('taxonomy'))),
      isPublic: v.boolean(),
      displayOrder: v.optional(v.number()),
    }),
    v.object({
      _id: v.id('customQuizzes'),
      _creationTime: v.number(),
      name: v.string(),
      description: v.string(),
      questions: v.array(v.any()), // Will be populated with full question data
      authorId: v.id('users'),
      testMode: v.union(v.literal('exam'), v.literal('study')),
      questionMode: v.union(
        v.literal('all'),
        v.literal('unanswered'),
        v.literal('incorrect'),
        v.literal('bookmarked'),
      ),
      selectedTaxThemes: v.optional(v.array(v.id('taxonomy'))),
      selectedTaxSubthemes: v.optional(v.array(v.id('taxonomy'))),
      selectedTaxGroups: v.optional(v.array(v.id('taxonomy'))),
      taxonomyPathIds: v.optional(v.array(v.id('taxonomy'))),
    }),
  ),
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
  returns: v.union(
    v.object({
      _id: v.id('presetQuizzes'),
      _creationTime: v.number(),
      name: v.string(),
      description: v.string(),
      category: v.union(v.literal('trilha'), v.literal('simulado')),
      questions: v.array(
        v.object({
          _id: v.id('questions'),
          _creationTime: v.number(),
          title: v.string(),
          questionTextString: v.string(),
          alternatives: v.array(v.string()),
          questionCode: v.optional(v.string()),
        }),
      ),
      subcategory: v.optional(v.string()),
      TaxThemeId: v.optional(v.id('taxonomy')),
      TaxSubthemeId: v.optional(v.id('taxonomy')),
      TaxGroupId: v.optional(v.id('taxonomy')),
      taxonomyPathIds: v.optional(v.array(v.id('taxonomy'))),
      isPublic: v.boolean(),
      displayOrder: v.optional(v.number()),
    }),
    v.object({
      _id: v.id('customQuizzes'),
      _creationTime: v.number(),
      name: v.string(),
      description: v.string(),
      questions: v.array(
        v.object({
          _id: v.id('questions'),
          _creationTime: v.number(),
          title: v.string(),
          questionTextString: v.string(),
          alternatives: v.array(v.string()),
          questionCode: v.optional(v.string()),
        }),
      ),
      authorId: v.id('users'),
      testMode: v.union(v.literal('exam'), v.literal('study')),
      questionMode: v.union(
        v.literal('all'),
        v.literal('unanswered'),
        v.literal('incorrect'),
        v.literal('bookmarked'),
      ),
      selectedTaxThemes: v.optional(v.array(v.id('taxonomy'))),
      selectedTaxSubthemes: v.optional(v.array(v.id('taxonomy'))),
      selectedTaxGroups: v.optional(v.array(v.id('taxonomy'))),
      taxonomyPathIds: v.optional(v.array(v.id('taxonomy'))),
    }),
  ),
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

    return {
      ...quiz,
      questions: safeQuestions,
    };
  },
});

// Query to get quizzes by new taxonomy
export const getByTaxonomy = query({
  args: {
    TaxThemeId: v.optional(v.id('taxonomy')),
    TaxSubthemeId: v.optional(v.id('taxonomy')),
    TaxGroupId: v.optional(v.id('taxonomy')),
  },
  returns: v.array(
    v.object({
      _id: v.id('presetQuizzes'),
      _creationTime: v.number(),
      name: v.string(),
      description: v.string(),
      category: v.union(v.literal('trilha'), v.literal('simulado')),
      subcategory: v.optional(v.string()),
      TaxThemeId: v.optional(v.id('taxonomy')),
      TaxSubthemeId: v.optional(v.id('taxonomy')),
      TaxGroupId: v.optional(v.id('taxonomy')),
      taxonomyPathIds: v.optional(v.array(v.id('taxonomy'))),
      isPublic: v.boolean(),
      displayOrder: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    if (args.TaxGroupId) {
      return await ctx.db
        .query('presetQuizzes')
        .withIndex('by_taxonomy_group', q =>
          q.eq('TaxGroupId', args.TaxGroupId),
        )
        .collect();
    } else if (args.TaxSubthemeId) {
      return await ctx.db
        .query('presetQuizzes')
        .withIndex('by_taxonomy_subtheme', q =>
          q.eq('TaxSubthemeId', args.TaxSubthemeId),
        )
        .collect();
    } else if (args.TaxThemeId) {
      return await ctx.db
        .query('presetQuizzes')
        .withIndex('by_taxonomy_theme', q =>
          q.eq('TaxThemeId', args.TaxThemeId),
        )
        .collect();
    }

    return await ctx.db.query('presetQuizzes').collect();
  },
});
