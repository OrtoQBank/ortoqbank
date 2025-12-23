import { v } from 'convex/values';

import { api } from './_generated/api';
import { Id } from './_generated/dataModel';
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

    // Collect question IDs using optimized logic (no full document fetches)
    const questionIds = await collectQuestions(
      ctx,
      userId._id,
      args.questionMode,
      args.selectedThemes || [],
      args.selectedSubthemes || [],
      args.selectedGroups || [],
      requestedQuestions,
    );

    // Handle no questions found
    if (questionIds.length === 0) {
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
    let selectedQuestionIds = questionIds;
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
 * Main function to collect question IDs based on hierarchy and user preferences
 * OPTIMIZED: Returns only IDs, never fetches full question documents
 */
async function collectQuestions(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  questionMode: QuestionMode,
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
  maxQuestions: number,
): Promise<Id<'questions'>[]> {
  console.log(
    `🚀 Collecting questions: mode=${questionMode}, themes=${selectedThemes.length}, subthemes=${selectedSubthemes.length}, groups=${selectedGroups.length}`,
  );

  // Step 1: Get question IDs based on question mode
  if (questionMode === 'all' || questionMode === 'unanswered') {
    // Use aggregate-backed random selection for 'all' and 'unanswered' modes
    const questionIds = await collectAllModeQuestionIds(
      ctx,
      selectedThemes,
      selectedSubthemes,
      selectedGroups,
      maxQuestions * 2, // Over-fetch for unanswered filtering
    );

    // For 'unanswered' mode, filter out answered questions
    if (questionMode === 'unanswered') {
      const answeredStats = await ctx.db
        .query('userQuestionStats')
        .withIndex('by_user', q => q.eq('userId', userId))
        .collect();

      const answeredQuestionIds = new Set(
        answeredStats.filter(stat => stat.hasAnswered).map(s => s.questionId),
      );

      const filteredIds = questionIds.filter(
        id => !answeredQuestionIds.has(id),
      );
      console.log(
        `🚀 Filtered to ${filteredIds.length} unanswered questions from ${questionIds.length} total`,
      );
      return filteredIds;
    }

    console.log(
      `🚀 '${questionMode}' mode selected ${questionIds.length} questions via aggregates`,
    );
    return questionIds;
  }

  // For 'incorrect' and 'bookmarked' modes - use denormalized taxonomy fields
  // This avoids fetching full question documents entirely
  const questionIds = await getQuestionIdsByUserMode(
    ctx,
    userId,
    questionMode,
    selectedThemes,
    selectedSubthemes,
    selectedGroups,
  );

  console.log(
    `🚀 '${questionMode}' mode selected ${questionIds.length} question IDs`,
  );
  return questionIds;
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

  if (selectedGroups.length > 0) {
    const selectedGroupDocs = await Promise.all(
      selectedGroups.map(id => ctx.db.get(id)),
    );
    for (const g of selectedGroupDocs) {
      if (g?.subthemeId) {
        overriddenSubthemes.add(g.subthemeId);
        if (!groupsBySubtheme.has(g.subthemeId)) {
          groupsBySubtheme.set(g.subthemeId, new Set());
        }
        groupsBySubtheme.get(g.subthemeId)!.add(g._id);
      }
    }

    // Any selected group also overrides its parent theme. Compute themes of selected groups.
    const uniqueSubthemeIds = [
      ...new Set(
        selectedGroupDocs
          .map(g => g?.subthemeId)
          .filter((id): id is Id<'subthemes'> => id !== undefined),
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
 * Get question IDs filtered by user mode (incorrect, bookmarked) with hierarchy filtering
 * OPTIMIZED: Uses denormalized taxonomy fields in userQuestionStats/userBookmarks
 * to filter without fetching any question documents
 */
async function getQuestionIdsByUserMode(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  questionMode: QuestionMode,
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
): Promise<Id<'questions'>[]> {
  const hasFilters =
    selectedThemes.length > 0 ||
    selectedSubthemes.length > 0 ||
    selectedGroups.length > 0;

  // Build sets for efficient lookup
  const themeSet = new Set(selectedThemes);
  const subthemeSet = new Set(selectedSubthemes);
  const groupSet = new Set(selectedGroups);

  switch (questionMode) {
    case 'incorrect': {
      const incorrectStats = await ctx.db
        .query('userQuestionStats')
        .withIndex('by_user_incorrect', q =>
          q.eq('userId', userId).eq('isIncorrect', true),
        )
        .collect();

      if (!hasFilters) {
        return incorrectStats.map(stat => stat.questionId);
      }

      // Filter using denormalized taxonomy fields (no question document fetch needed)
      return filterByHierarchy(
        incorrectStats,
        themeSet,
        subthemeSet,
        groupSet,
      ).map(stat => stat.questionId);
    }

    case 'bookmarked': {
      const bookmarks = await ctx.db
        .query('userBookmarks')
        .withIndex('by_user', q => q.eq('userId', userId))
        .collect();

      if (!hasFilters) {
        return bookmarks.map(bookmark => bookmark.questionId);
      }

      // Filter using denormalized taxonomy fields (no question document fetch needed)
      return filterByHierarchy(bookmarks, themeSet, subthemeSet, groupSet).map(
        bookmark => bookmark.questionId,
      );
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
 * Filter records by hierarchy using denormalized taxonomy fields
 * Hierarchy override rules: groups > subthemes > themes
 */
function filterByHierarchy<
  T extends {
    themeId?: Id<'themes'>;
    subthemeId?: Id<'subthemes'>;
    groupId?: Id<'groups'>;
  },
>(
  records: T[],
  themeSet: Set<Id<'themes'>>,
  subthemeSet: Set<Id<'subthemes'>>,
  groupSet: Set<Id<'groups'>>,
): T[] {
  return records.filter(record => {
    // If groups are selected and this record has a matching group, include it
    if (groupSet.size > 0 && record.groupId && groupSet.has(record.groupId)) {
      return true;
    }

    // If subthemes are selected and this record has a matching subtheme
    // Only include if this record's group (if any) is not in the selected groups
    // This implements the hierarchy override: specific group selection overrides subtheme
    const matchesSubtheme =
      subthemeSet.size > 0 &&
      record.subthemeId &&
      subthemeSet.has(record.subthemeId) &&
      (!record.groupId || !groupSet.has(record.groupId));

    if (matchesSubtheme) {
      return true;
    }

    // If themes are selected and this record has a matching theme
    // Only include if this record's subtheme (if any) is not in the selected subthemes
    // This implements the hierarchy override: specific subtheme selection overrides theme
    const matchesTheme =
      themeSet.size > 0 &&
      record.themeId &&
      themeSet.has(record.themeId) &&
      (!record.subthemeId || !subthemeSet.has(record.subthemeId));

    if (matchesTheme) {
      return true;
    }

    return false;
  });
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
    sampleQuestionIds: v.array(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    questionMode: string;
    totalQuestionsInDB: number;
    baseQuestionsFound: number;
    hasFilters: boolean;
    filtersApplied: {
      themes: number;
      subthemes: number;
      groups: number;
    };
    finalQuestionCount: number;
    sampleQuestionIds: string[];
  }> => {
    const userId = await getCurrentUserOrThrow(ctx);
    const maxQuestions = args.maxQuestions || 50;

    // Get total questions count using aggregate (efficient)
    const totalCount: number = await ctx.runQuery(
      api.aggregateQueries.getTotalQuestionCountQuery,
    );

    // Test the collection logic
    const questionIds = await collectQuestions(
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
      totalQuestionsInDB: totalCount,
      baseQuestionsFound: questionIds.length,
      hasFilters,
      filtersApplied: {
        themes: args.selectedThemes?.length || 0,
        subthemes: args.selectedSubthemes?.length || 0,
        groups: args.selectedGroups?.length || 0,
      },
      finalQuestionCount: questionIds.length,
      sampleQuestionIds: questionIds.slice(0, 5).map(id => id.toString()),
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
