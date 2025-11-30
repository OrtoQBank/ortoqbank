import { v } from 'convex/values';

import { api } from './_generated/api';
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

    // Validation: 'unanswered' mode requires at least one filter to limit scope
    if (args.questionMode === 'unanswered') {
      const hasFilters =
        (args.selectedThemes?.length || 0) > 0 ||
        (args.selectedSubthemes?.length || 0) > 0 ||
        (args.selectedGroups?.length || 0) > 0;

      if (!hasFilters) {
        return {
          success: false as const,
          error: 'UNANSWERED_REQUIRES_FILTERS' as const,
          message:
            'Para o modo "Não Respondidas", selecione pelo menos um tema, subtema ou grupo. Isso ajuda a limitar o escopo e melhorar o desempenho.',
        };
      }
    }

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
  if (questionMode === 'all' || questionMode === 'unanswered') {
    // Use aggregate-backed random selection for 'all' and 'unanswered' modes
    // For 'unanswered', we'll filter out answered questions after getting random IDs
    const questionIds = await collectAllModeQuestionIds(
      ctx,
      selectedThemes,
      selectedSubthemes,
      selectedGroups,
      maxQuestions * 2, // Over-fetch for unanswered filtering
    );

    // For 'unanswered' mode, filter out answered questions
    let filteredIds = questionIds;
    if (questionMode === 'unanswered') {
      const answeredStats = await ctx.db
        .query('userQuestionStats')
        .withIndex('by_user', q => q.eq('userId', userId))
        .collect();

      const answeredQuestionIds = new Set(
        answeredStats.filter(stat => stat.hasAnswered).map(s => s.questionId),
      );

      filteredIds = questionIds.filter(id => !answeredQuestionIds.has(id));
      console.log(
        `🚀 Filtered to ${filteredIds.length} unanswered questions from ${questionIds.length} total`,
      );
    }

    const docs = await Promise.all(filteredIds.map(id => ctx.db.get(id)));
    const questions = docs.filter((q): q is Doc<'questions'> => q !== null);
    console.log(
      `🚀 '${questionMode}' mode selected ${questions.length} questions via aggregates`,
    );
    return questions;
  }

  // For 'incorrect' and 'bookmarked' modes
  const baseQuestions = await getQuestionsByUserMode(ctx, userId, questionMode);

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
 * Aggregate-backed random selection for questionMode 'all'.
 * Respects hierarchy overrides: groups > subthemes > themes.
 */
async function collectAllModeQuestionIds(
  ctx: QueryCtx | MutationCtx,
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
  maxQuestions: number,
): Promise<Array<Id<'questions'>>> {
  // No filters: grab random questions globally
  if (
    selectedThemes.length === 0 &&
    selectedSubthemes.length === 0 &&
    selectedGroups.length === 0
  ) {
    return await ctx.runQuery(api.aggregateQueries.getRandomQuestions, {
      count: maxQuestions,
    });
  }

  // Determine overrides and map selected groups by subtheme
  const overriddenSubthemes = new Set<Id<'subthemes'>>();
  const overriddenThemesByGroups = new Set<Id<'themes'>>();
  const groupsBySubtheme = new Map<Id<'subthemes'>, Set<Id<'groups'>>>();
  let selectedGroupDocs: Array<Doc<'groups'> | null> = [];
  if (selectedGroups.length > 0) {
    selectedGroupDocs = await Promise.all(
      selectedGroups.map(id => ctx.db.get(id)),
    );
    for (const g of selectedGroupDocs) {
      if (g?.subthemeId) {
        overriddenSubthemes.add(g.subthemeId);
        if (!groupsBySubtheme.has(g.subthemeId)) {
          groupsBySubtheme.set(g.subthemeId, new Set());
        }
        groupsBySubtheme.get(g.subthemeId)!.add(g._id as Id<'groups'>);
      }
    }

    // Any selected group also overrides its parent theme. Compute themes of selected groups.
    const uniqueSubthemeIds = [
      ...new Set(
        selectedGroupDocs
          .map(g => g?.subthemeId)
          .filter(Boolean) as Id<'subthemes'>[],
      ),
    ];
    if (uniqueSubthemeIds.length > 0) {
      const subthemeDocs = await Promise.all(
        uniqueSubthemeIds.map(id => ctx.db.get(id)),
      );
      for (const st of subthemeDocs) {
        if (st?.themeId) {
          overriddenThemesByGroups.add(st.themeId);
        }
      }
    }
  }

  // Themes overridden by selected subthemes
  const overriddenThemes = new Set<Id<'themes'>>();
  if (selectedSubthemes.length > 0) {
    const subthemes = await Promise.all(
      selectedSubthemes.map(id => ctx.db.get(id)),
    );
    for (const s of subthemes) {
      if (s?.themeId) overriddenThemes.add(s.themeId);
    }
  }

  // Apply overrides to selections
  const effectiveSubthemesSet = new Set(
    selectedSubthemes.filter(st => !overriddenSubthemes.has(st)),
  );
  const effectiveThemes = selectedThemes.filter(
    th => !overriddenThemes.has(th) && !overriddenThemesByGroups.has(th),
  );

  // 1) Always include selected groups via random aggregate
  const groupResults = await Promise.all(
    selectedGroups.map(groupId =>
      ctx.runQuery(api.aggregateQueries.getRandomQuestionsByGroup, {
        groupId,
        count: maxQuestions,
      }),
    ),
  );

  // 2) For each selected subtheme:
  //    - If it has selected groups, include ONLY the complement (questions in subtheme without those groups)
  //    - Otherwise include random-by-subtheme aggregate
  const subthemeResults: Array<Array<Id<'questions'>>> = [];
  for (const subthemeId of selectedSubthemes) {
    const selectedGroupsForSubtheme = groupsBySubtheme.get(subthemeId);
    if (selectedGroupsForSubtheme && selectedGroupsForSubtheme.size > 0) {
      // Fetch complement via indexed query
      const qDocs = await ctx.db
        .query('questions')
        .withIndex('by_subtheme', q => q.eq('subthemeId', subthemeId))
        .collect();
      const complementIds = qDocs
        .filter(q => !q.groupId || !selectedGroupsForSubtheme.has(q.groupId))
        .map(q => q._id as Id<'questions'>);
      subthemeResults.push(complementIds);
    } else if (effectiveSubthemesSet.has(subthemeId)) {
      const ids = await ctx.runQuery(
        api.aggregateQueries.getRandomQuestionsBySubtheme,
        { subthemeId, count: maxQuestions },
      );
      subthemeResults.push(ids);
    }
  }

  // 3) Include any themes that aren't covered by selected subthemes
  const themeResults = await Promise.all(
    effectiveThemes.map(themeId =>
      ctx.runQuery(api.aggregateQueries.getRandomQuestionsByTheme, {
        themeId,
        count: maxQuestions,
      }),
    ),
  );

  // Combine, dedupe, and downsample
  const combined = [
    ...groupResults.flat(),
    ...subthemeResults.flat(),
    ...themeResults.flat(),
  ];
  const uniqueIds = [...new Set(combined)];

  if (uniqueIds.length <= maxQuestions) return uniqueIds;

  // Fisher-Yates shuffle then slice
  const shuffled = [...uniqueIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, maxQuestions);
}

/**
 * Get questions filtered by user mode (incorrect, bookmarked)
 * NOTE: 'unanswered' mode is handled directly in collectQuestions using aggregates
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

    case 'all':
    case 'unanswered': {
      // These modes are handled in collectQuestions via aggregates
      throw new Error(
        `${questionMode} mode should be handled in collectQuestions`,
      );
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
  console.log(
    `🔧 DEBUG: Starting hierarchy filtering with ${baseQuestions.length} base questions`,
  );
  console.log(
    `🔧 DEBUG: Filters - themes: ${selectedThemes.length}, subthemes: ${selectedSubthemes.length}, groups: ${selectedGroups.length}`,
  );

  // Sample a few questions to see their structure
  if (baseQuestions.length > 0) {
    const sample = baseQuestions.slice(0, 3);
    console.log(
      `🔧 DEBUG: Sample questions structure:`,
      sample.map(q => ({
        id: q._id,
        hasThemeId: !!q.themeId,
        hasSubthemeId: !!q.subthemeId,
        hasGroupId: !!q.groupId,
        themeId: q.themeId,
        subthemeId: q.subthemeId,
        groupId: q.groupId,
      })),
    );
  }

  const validQuestionIds = new Set<Id<'questions'>>();

  // Step 1: Process groups (highest priority)
  if (selectedGroups.length > 0) {
    console.log(`🔧 Processing ${selectedGroups.length} groups`);
    let groupMatches = 0;
    baseQuestions.forEach(question => {
      if (question.groupId && selectedGroups.includes(question.groupId)) {
        validQuestionIds.add(question._id);
        groupMatches++;
      }
    });
    console.log(
      `🔧 DEBUG: Found ${groupMatches} questions matching selected groups`,
    );
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
    console.log(`🔧 DEBUG: Overridden subthemes by groups:`, [
      ...overriddenSubthemes,
    ]);

    let subthemeMatches = 0;
    baseQuestions.forEach(question => {
      if (
        question.subthemeId &&
        selectedSubthemes.includes(question.subthemeId) && // Include if this subtheme is not overridden by groups OR this question has no group
        (!overriddenSubthemes.has(question.subthemeId) || !question.groupId)
      ) {
        validQuestionIds.add(question._id);
        subthemeMatches++;
      }
    });
    console.log(
      `🔧 DEBUG: Found ${subthemeMatches} questions matching selected subthemes`,
    );
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
    console.log(`🔧 DEBUG: Overridden themes by subthemes:`, [
      ...overriddenThemes,
    ]);

    let themeMatches = 0;
    baseQuestions.forEach(question => {
      if (
        question.themeId &&
        selectedThemes.includes(question.themeId) &&
        !overriddenThemes.has(question.themeId)
      ) {
        validQuestionIds.add(question._id);
        themeMatches++;
      }
    });
    console.log(
      `🔧 DEBUG: Found ${themeMatches} questions matching selected themes`,
    );
  }

  const filteredQuestions = baseQuestions.filter(q =>
    validQuestionIds.has(q._id),
  );
  console.log(
    `🔧 Hierarchy filtering: ${baseQuestions.length} -> ${filteredQuestions.length} questions`,
  );

  // Debug: Log when no questions match filters
  if (filteredQuestions.length === 0 && baseQuestions.length > 0) {
    console.log(
      `🔧 WARNING: No questions matched hierarchy filters. This suggests an issue with filter criteria.`,
    );
    console.log(
      `🔧 DEBUG: Selected themes: ${selectedThemes.length}, subthemes: ${selectedSubthemes.length}, groups: ${selectedGroups.length}`,
    );
  }

  return filteredQuestions;
}

/**
 * Debug mutation to test question collection without creating a quiz
 */
export const debugQuestionCollection = mutation({
  args: {
    questionMode: v.union(
      v.literal('all'),
      v.literal('unanswered'),
      v.literal('incorrect'),
      v.literal('bookmarked'),
    ),
    selectedThemes: v.optional(v.array(v.id('themes'))),
    selectedSubthemes: v.optional(v.array(v.id('subthemes'))),
    selectedGroups: v.optional(v.array(v.id('groups'))),
    maxQuestions: v.optional(v.number()),
  },
  returns: v.object({
    questionMode: v.string(),
    totalQuestionsInDB: v.number(),
    baseQuestionsFound: v.number(),
    hasFilters: v.boolean(),
    filtersApplied: v.object({
      themes: v.number(),
      subthemes: v.number(),
      groups: v.number(),
    }),
    finalQuestionCount: v.number(),
    sampleQuestions: v.array(
      v.object({
        id: v.string(),
        hasThemeId: v.boolean(),
        hasSubthemeId: v.boolean(),
        hasGroupId: v.boolean(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);
    const maxQuestions = args.maxQuestions || 50;

    // Get total questions in DB for reference
    const allQuestionsInDB = await ctx.db.query('questions').collect();

    // Test the collection logic
    const questions = await collectQuestions(
      ctx,
      userId._id,
      args.questionMode,
      args.selectedThemes || [],
      args.selectedSubthemes || [],
      args.selectedGroups || [],
      maxQuestions,
    );

    const hasFilters =
      (args.selectedThemes?.length || 0) > 0 ||
      (args.selectedSubthemes?.length || 0) > 0 ||
      (args.selectedGroups?.length || 0) > 0;

    return {
      questionMode: args.questionMode,
      totalQuestionsInDB: allQuestionsInDB.length,
      baseQuestionsFound: questions.length,
      hasFilters,
      filtersApplied: {
        themes: args.selectedThemes?.length || 0,
        subthemes: args.selectedSubthemes?.length || 0,
        groups: args.selectedGroups?.length || 0,
      },
      finalQuestionCount: questions.length,
      sampleQuestions: questions.slice(0, 5).map(q => ({
        id: q._id,
        hasThemeId: !!q.themeId,
        hasSubthemeId: !!q.subthemeId,
        hasGroupId: !!q.groupId,
      })),
    };
  },
});

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
