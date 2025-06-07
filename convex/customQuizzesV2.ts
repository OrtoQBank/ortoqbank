import { ConvexError, v } from 'convex/values';

import { Doc, Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { getCurrentUserOrThrow } from './users';

type QuestionMode = 'all' | 'unanswered' | 'incorrect' | 'bookmarked';

// Maximum number of questions allowed in a custom quiz
const MAX_QUESTIONS = 120;

/**
 * Randomly shuffle an array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    testMode: v.union(v.literal('study'), v.literal('exam')),
    questionMode: v.union(
      v.literal('all'),
      v.literal('unanswered'),
      v.literal('incorrect'),
      v.literal('bookmarked'),
    ),
    numQuestions: v.optional(v.number()),
    // New taxonomy fields
    selectedTaxThemes: v.optional(v.array(v.id('taxonomy'))),
    selectedTaxSubthemes: v.optional(v.array(v.id('taxonomy'))),
    selectedTaxGroups: v.optional(v.array(v.id('taxonomy'))),
    taxonomyPathIds: v.optional(v.array(v.id('taxonomy'))),
  },
  returns: v.object({
    quizId: v.id('customQuizzes'),
    questionCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);

    // Use the requested number of questions or default to MAX_QUESTIONS
    const requestedQuestions = args.numQuestions
      ? Math.min(args.numQuestions, MAX_QUESTIONS)
      : MAX_QUESTIONS;

    let allQuestions: Doc<'questions'>[] = [];

    // Check if any taxonomy filters are provided
    const hasTaxonomy =
      args.selectedTaxThemes?.length ||
      args.selectedTaxSubthemes?.length ||
      args.selectedTaxGroups?.length ||
      args.taxonomyPathIds?.length;

    if (hasTaxonomy) {
      // Use new taxonomy system to get filtered questions
      allQuestions = await getQuestionsFromNewTaxonomy(ctx, {
        selectedTaxThemes: args.selectedTaxThemes,
        selectedTaxSubthemes: args.selectedTaxSubthemes,
        selectedTaxGroups: args.selectedTaxGroups,
      });
    } else {
      // For "all questions" - get a reasonable sample size (3x the max needed for good randomization)
      const sampleSize = Math.min(requestedQuestions * 3, 360); // Max 360 questions for good variety
      allQuestions = await ctx.db
        .query('questions')
        .order('desc') // Get recent questions for better variety
        .take(sampleSize);
    }

    // Apply question mode filtering
    const filteredQuestionIds = await applyQuestionModeFilter(
      ctx,
      userId._id,
      allQuestions,
      args.questionMode,
    );

    // If we have more than the requested number of questions, randomly select the desired amount
    let finalQuestionIds = filteredQuestionIds;
    if (finalQuestionIds.length > requestedQuestions) {
      finalQuestionIds = shuffleArray(finalQuestionIds).slice(
        0,
        requestedQuestions,
      );
    }

    if (finalQuestionIds.length === 0) {
      throw new ConvexError(
        'Nenhuma questão encontrada com os critérios selecionados',
      );
    }

    // Create name and description if not provided
    const quizName =
      args.name || `Custom Quiz - ${new Date().toLocaleDateString()}`;
    const quizDescription =
      args.description ||
      `Custom quiz with ${finalQuestionIds.length} questions`;

    // Create the custom quiz with new taxonomy system
    const quizId = await ctx.db.insert('customQuizzes', {
      name: quizName,
      description: quizDescription,
      questions: finalQuestionIds,
      authorId: userId._id,
      testMode: args.testMode,
      questionMode: args.questionMode,
      // New taxonomy fields only
      selectedTaxThemes: args.selectedTaxThemes,
      selectedTaxSubthemes: args.selectedTaxSubthemes,
      selectedTaxGroups: args.selectedTaxGroups,
      taxonomyPathIds: args.taxonomyPathIds,
    });

    // Create a session immediately
    await ctx.db.insert('quizSessions', {
      userId: userId._id,
      quizId,
      mode: args.testMode,
      currentQuestionIndex: 0,
      answers: [],
      answerFeedback: [],
      isComplete: false,
    });

    return { quizId, questionCount: finalQuestionIds.length };
  },
});

// Helper function to get questions from new taxonomy
async function getQuestionsFromNewTaxonomy(
  ctx: any,
  filters: {
    selectedTaxThemes?: Id<'taxonomy'>[];
    selectedTaxSubthemes?: Id<'taxonomy'>[];
    selectedTaxGroups?: Id<'taxonomy'>[];
  },
): Promise<Doc<'questions'>[]> {
  const allQuestions: Doc<'questions'>[] = [];

  // Get questions from provided themes
  if (filters.selectedTaxThemes?.length) {
    for (const taxonomyId of filters.selectedTaxThemes) {
      const themeQuestions = await ctx.db
        .query('questions')
        .withIndex('by_taxonomy_theme', (q: any) =>
          q.eq('TaxThemeId', taxonomyId),
        )
        .collect();
      allQuestions.push(...themeQuestions);
    }
  }

  // Get questions from provided subthemes
  if (filters.selectedTaxSubthemes?.length) {
    for (const taxonomyId of filters.selectedTaxSubthemes) {
      const subthemeQuestions = await ctx.db
        .query('questions')
        .withIndex('by_taxonomy_subtheme', (q: any) =>
          q.eq('TaxSubthemeId', taxonomyId),
        )
        .collect();
      allQuestions.push(...subthemeQuestions);
    }
  }

  // Get questions from provided groups
  if (filters.selectedTaxGroups?.length) {
    for (const taxonomyId of filters.selectedTaxGroups) {
      const groupQuestions = await ctx.db
        .query('questions')
        .withIndex('by_taxonomy_group', (q: any) =>
          q.eq('TaxGroupId', taxonomyId),
        )
        .collect();
      allQuestions.push(...groupQuestions);
    }
  }

  // Remove duplicates (in case same question appears multiple times)
  const uniqueQuestions = allQuestions.filter(
    (question, index, self) =>
      index === self.findIndex(q => q._id === question._id),
  );

  return uniqueQuestions;
}

// Helper function to apply question mode filtering
async function applyQuestionModeFilter(
  ctx: any,
  userId: Id<'users'>,
  questions: Doc<'questions'>[],
  questionMode: QuestionMode,
): Promise<Id<'questions'>[]> {
  switch (questionMode) {
    case 'all': {
      return questions.map(q => q._id);
    }

    case 'bookmarked': {
      const bookmarks = await ctx.db
        .query('userBookmarks')
        .withIndex('by_user', (q: any) => q.eq('userId', userId))
        .collect();
      const bookmarkedIds = new Set(bookmarks.map((b: any) => b.questionId));
      return questions.filter(q => bookmarkedIds.has(q._id)).map(q => q._id);
    }

    case 'incorrect':
    case 'unanswered': {
      const answeredQuestions = new Map<Id<'questions'>, boolean>();
      const questionIdsSet = new Set(questions.map(q => q._id));

      const completedSessions = await ctx.db
        .query('quizSessions')
        .withIndex('by_user_quiz', (q: any) => q.eq('userId', userId))
        .filter((q: any) => q.eq(q.field('isComplete'), true))
        .take(100);

      for (const session of completedSessions) {
        const quiz = await ctx.db.get(session.quizId);
        if (!quiz?.questions) continue;

        const relevantQuestions = quiz.questions.filter((qId: any) =>
          questionIdsSet.has(qId),
        );

        for (const questionId of relevantQuestions) {
          const questionIndex = quiz.questions.indexOf(questionId);
          if (questionIndex === -1) continue;

          const wasAnswered = questionIndex < session.answers.length;

          if (wasAnswered && session.answerFeedback[questionIndex]) {
            const wasCorrect = session.answerFeedback[questionIndex].isCorrect;
            if (
              !answeredQuestions.has(questionId) ||
              (answeredQuestions.get(questionId) && !wasCorrect)
            ) {
              answeredQuestions.set(questionId, wasCorrect);
            }
          } else if (wasAnswered) {
            answeredQuestions.set(questionId, true);
          } else if (!answeredQuestions.has(questionId)) {
            answeredQuestions.set(questionId, false);
          }
        }
      }

      return questions
        .filter(q =>
          questionMode === 'incorrect'
            ? answeredQuestions.has(q._id) && !answeredQuestions.get(q._id)
            : !answeredQuestions.has(q._id),
        )
        .map(q => q._id);
    }

    default: {
      return questions.map(q => q._id);
    }
  }
}

export const getCustomQuizzes = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id('customQuizzes'),
      _creationTime: v.number(),
      name: v.string(),
      description: v.string(),
      questions: v.array(v.id('questions')),
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
    const userId = await getCurrentUserOrThrow(ctx);
    const limit = args.limit || 50;

    const quizzes = await ctx.db
      .query('customQuizzes')
      .filter(q => q.eq(q.field('authorId'), userId._id))
      .order('desc')
      .take(limit);

    return quizzes;
  },
});

export const deleteCustomQuiz = mutation({
  args: {
    quizId: v.id('customQuizzes'),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);
    const quiz = await ctx.db.get(args.quizId);

    if (!quiz) {
      throw new Error('Quiz not found');
    }

    if (quiz.authorId !== userId._id) {
      throw new Error('You are not authorized to delete this quiz');
    }

    // Delete any active sessions for this quiz
    const sessions = await ctx.db
      .query('quizSessions')
      .withIndex('by_user_quiz', q =>
        q.eq('userId', userId._id).eq('quizId', args.quizId),
      )
      .collect();

    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    await ctx.db.delete(args.quizId);
    return { success: true };
  },
});

export const getById = query({
  args: { id: v.id('customQuizzes') },
  returns: v.object({
    _id: v.id('customQuizzes'),
    _creationTime: v.number(),
    name: v.string(),
    description: v.string(),
    questions: v.array(v.any()),
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
  handler: async (ctx, { id }) => {
    const userId = await getCurrentUserOrThrow(ctx);
    const quiz = await ctx.db.get(id);

    if (!quiz) {
      throw new Error('Quiz not found');
    }

    if (quiz.authorId !== userId._id) {
      throw new Error('Not authorized to access this quiz');
    }

    const questions = await Promise.all(
      quiz.questions.map(questionId => ctx.db.get(questionId)),
    );

    return {
      ...quiz,
      questions: questions.filter(Boolean),
    };
  },
});

export const updateName = mutation({
  args: {
    id: v.id('customQuizzes'),
    name: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);
    const quiz = await ctx.db.get(args.id);

    if (!quiz) {
      throw new Error('Quiz not found');
    }

    if (quiz.authorId !== userId._id) {
      throw new Error('Not authorized to update this quiz');
    }

    await ctx.db.patch(args.id, { name: args.name });
    return { success: true };
  },
});

export const searchByName = query({
  args: {
    name: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id('customQuizzes'),
      _creationTime: v.number(),
      name: v.string(),
      description: v.string(),
      questions: v.array(v.id('questions')),
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
    if (!args.name || args.name.trim() === '') {
      return [];
    }

    const userId = await getCurrentUserOrThrow(ctx);
    const searchTerm = args.name.trim();

    const matchingQuizzes = await ctx.db
      .query('customQuizzes')
      .withSearchIndex('search_by_name', q => q.search('name', searchTerm))
      .filter(q => q.eq(q.field('authorId'), userId._id))
      .take(50);

    return matchingQuizzes;
  },
});
