import { v } from 'convex/values';

import { Doc, Id } from './_generated/dataModel';
import { mutation, type MutationCtx, type QueryCtx } from './_generated/server';
import { QuestionMode } from './customQuizzes';
import { getCurrentUserOrThrow } from './users';

// Maximum number of questions allowed in a custom quiz
export const MAX_QUESTIONS = 120;

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
    selectedThemes: v.optional(v.array(v.id('themes'))),
    selectedSubthemes: v.optional(v.array(v.id('subthemes'))),
    selectedGroups: v.optional(v.array(v.id('groups'))),
  },
  returns: v.union(
    v.object({
      success: v.literal(true),
      quizId: v.id('customQuizzes'),
      questionCount: v.number(),
    }),
    v.object({
      success: v.literal(false),
      error: v.string(),
      message: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);

    // Use the requested number of questions or default to MAX_QUESTIONS
    const requestedQuestions = args.numQuestions
      ? Math.min(args.numQuestions, MAX_QUESTIONS)
      : MAX_QUESTIONS;

    // Collect questions using simplified logic
    const questions = await collectQuestions(
      ctx,
      userId._id,
      args.questionMode,
      args.selectedThemes || [],
      args.selectedSubthemes || [],
      args.selectedGroups || [],
      requestedQuestions,
    );

    // Handle no questions found
    if (questions.length === 0) {
      const isQuestionModeFiltering = args.questionMode !== 'all';
      const errorResponse = isQuestionModeFiltering
        ? {
            success: false as const,
            error: 'NO_QUESTIONS_FOUND_AFTER_FILTER' as const,
            message:
              'Nenhuma questão encontrada com os filtros selecionados. Tente ajustar os filtros ou selecionar temas diferentes.',
          }
        : {
            success: false as const,
            error: 'NO_QUESTIONS_FOUND' as const,
            message:
              'Nenhuma questão encontrada com os critérios selecionados. Tente ajustar os filtros ou selecionar temas diferentes.',
          };
      return errorResponse;
    }

    // Randomly select questions if we have more than requested
    let selectedQuestionIds = questions.map(q => q._id);
    if (selectedQuestionIds.length > requestedQuestions) {
      selectedQuestionIds = shuffleArray(selectedQuestionIds).slice(
        0,
        requestedQuestions,
      );
    }

    // Create quiz name and description
    const quizName =
      args.name || `Custom Quiz - ${new Date().toLocaleDateString()}`;
    const quizDescription =
      args.description ||
      `Custom quiz with ${selectedQuestionIds.length} questions`;

    // Create the custom quiz
    const quizId = await ctx.db.insert('customQuizzes', {
      name: quizName,
      description: quizDescription,
      questions: selectedQuestionIds,
      authorId: userId._id,
      testMode: args.testMode,
      questionMode: args.questionMode,
      selectedThemes: args.selectedThemes,
      selectedSubthemes: args.selectedSubthemes,
      selectedGroups: args.selectedGroups,
    });

    // Create quiz session immediately
    await ctx.db.insert('quizSessions', {
      userId: userId._id,
      quizId,
      mode: args.testMode,
      currentQuestionIndex: 0,
      answers: [],
      answerFeedback: [],
      isComplete: false,
    });

    return {
      success: true as const,
      quizId,
      questionCount: selectedQuestionIds.length,
    };
  },
});

// Helper functions

/**
 * Main function to collect questions based on hierarchy and user preferences
 */
async function collectQuestions(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  questionMode: QuestionMode,
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
  maxQuestions: number,
): Promise<Doc<'questions'>[]> {
  console.log(
    `🚀 Collecting questions: mode=${questionMode}, themes=${selectedThemes.length}, subthemes=${selectedSubthemes.length}, groups=${selectedGroups.length}`,
  );

  // Step 1: Get base question pool based on question mode
  const baseQuestions =
    questionMode === 'all'
      ? await ctx.db.query('questions').collect()
      : await getQuestionsByUserMode(ctx, userId, questionMode);

  console.log(
    `🚀 Base questions from mode '${questionMode}': ${baseQuestions.length}`,
  );

  // Step 2: Apply hierarchy-based filtering if any filters are selected
  const hasFilters =
    selectedThemes.length > 0 ||
    selectedSubthemes.length > 0 ||
    selectedGroups.length > 0;

  if (!hasFilters) {
    return baseQuestions.slice(0, maxQuestions * 2); // Return more than needed for shuffling
  }

  const filteredQuestions = await applyHierarchyFilters(
    ctx,
    baseQuestions,
    selectedThemes,
    selectedSubthemes,
    selectedGroups,
  );

  console.log(
    `🚀 Questions after hierarchy filtering: ${filteredQuestions.length}`,
  );
  return filteredQuestions;
}

/**
 * Get questions filtered by user mode (incorrect, unanswered, bookmarked)
 */
async function getQuestionsByUserMode(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  questionMode: QuestionMode,
): Promise<Doc<'questions'>[]> {
  switch (questionMode) {
    case 'incorrect': {
      const incorrectStats = await ctx.db
        .query('userQuestionStats')
        .withIndex('by_user_incorrect', q =>
          q.eq('userId', userId).eq('isIncorrect', true),
        )
        .collect();

      const questions = await Promise.all(
        incorrectStats.map(stat => ctx.db.get(stat.questionId)),
      );
      return questions.filter((q): q is Doc<'questions'> => q !== null);
    }

    case 'unanswered': {
      const allQuestions = await ctx.db.query('questions').collect();
      const answeredStats = await ctx.db
        .query('userQuestionStats')
        .withIndex('by_user', q => q.eq('userId', userId))
        .collect();

      const answeredQuestionIds = new Set(answeredStats.map(s => s.questionId));
      return allQuestions.filter(q => !answeredQuestionIds.has(q._id));
    }

    case 'bookmarked': {
      const bookmarks = await ctx.db
        .query('userBookmarks')
        .withIndex('by_user', q => q.eq('userId', userId))
        .collect();

      const questions = await Promise.all(
        bookmarks.map(bookmark => ctx.db.get(bookmark.questionId)),
      );
      return questions.filter((q): q is Doc<'questions'> => q !== null);
    }

    default: {
      throw new Error(`Unknown question mode: ${questionMode}`);
    }
  }
}

/**
 * Apply hierarchy-based filtering: Groups override subthemes, subthemes override themes
 */
async function applyHierarchyFilters(
  ctx: QueryCtx | MutationCtx,
  baseQuestions: Doc<'questions'>[],
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
): Promise<Doc<'questions'>[]> {
  const validQuestionIds = new Set<Id<'questions'>>();

  // Step 1: Process groups (highest priority)
  if (selectedGroups.length > 0) {
    console.log(`🔧 Processing ${selectedGroups.length} groups`);
    baseQuestions.forEach(question => {
      if (question.groupId && selectedGroups.includes(question.groupId)) {
        validQuestionIds.add(question._id);
      }
    });
  }

  // Step 2: Process subthemes (only if not overridden by groups)
  if (selectedSubthemes.length > 0) {
    console.log(`🔧 Processing ${selectedSubthemes.length} subthemes`);

    // Build group->subtheme mapping to detect overrides
    const groupToSubtheme = new Map<Id<'groups'>, Id<'subthemes'>>();
    if (selectedGroups.length > 0) {
      const groups = await Promise.all(
        selectedGroups.map(id => ctx.db.get(id)),
      );
      groups.forEach((group, idx) => {
        if (group?.subthemeId) {
          groupToSubtheme.set(selectedGroups[idx], group.subthemeId);
        }
      });
    }

    const overriddenSubthemes = new Set(groupToSubtheme.values());

    baseQuestions.forEach(question => {
      if (
        question.subthemeId &&
        selectedSubthemes.includes(question.subthemeId) &&
        (!overriddenSubthemes.has(question.subthemeId) || !question.groupId)
      ) {
        validQuestionIds.add(question._id);
      }
    });
  }

  // Step 3: Process themes (only if not overridden by subthemes)
  if (selectedThemes.length > 0) {
    console.log(`🔧 Processing ${selectedThemes.length} themes`);

    // Build subtheme->theme mapping to detect overrides
    const subthemeToTheme = new Map<Id<'subthemes'>, Id<'themes'>>();
    if (selectedSubthemes.length > 0) {
      const subthemes = await Promise.all(
        selectedSubthemes.map(id => ctx.db.get(id)),
      );
      subthemes.forEach((subtheme, idx) => {
        if (subtheme?.themeId) {
          subthemeToTheme.set(selectedSubthemes[idx], subtheme.themeId);
        }
      });
    }

    const overriddenThemes = new Set(subthemeToTheme.values());

    baseQuestions.forEach(question => {
      if (
        question.themeId &&
        selectedThemes.includes(question.themeId) &&
        !overriddenThemes.has(question.themeId)
      ) {
        validQuestionIds.add(question._id);
      }
    });
  }

  const filteredQuestions = baseQuestions.filter(q =>
    validQuestionIds.has(q._id),
  );
  console.log(
    `🔧 Hierarchy filtering: ${baseQuestions.length} -> ${filteredQuestions.length} questions`,
  );

  return filteredQuestions;
}

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
