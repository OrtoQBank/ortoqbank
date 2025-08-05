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

    // Use the requested number of questions or default to MAX_QUESTIONS
    const requestedQuestions = args.numQuestions
      ? Math.min(args.numQuestions, MAX_QUESTIONS)
      : MAX_QUESTIONS;

    // Use optimized question collection
    const selectedThemes = args.selectedThemes || [];
    const selectedSubthemes = args.selectedSubthemes || [];
    const selectedGroups = args.selectedGroups || [];

    const allQuestions = await collectQuestionsOptimized(
      ctx,
      userId._id,
      args.questionMode,
      selectedThemes,
      selectedSubthemes,
      selectedGroups,
      requestedQuestions,
    );

    // If there are no questions matching the criteria, return an error response
    if (allQuestions.length === 0) {
      console.log('allQuestions', allQuestions);
      console.log('selectedThemes', args.selectedThemes);
      console.log('selectedSubthemes', args.selectedSubthemes);
      console.log('selectedGroups', args.selectedGroups);

      // Determine the appropriate error code based on context:
      // - If question mode is "all" and we have taxonomy filters but no questions, it's a theme/taxonomy issue
      // - If question mode is specific (incorrect/bookmarked/unanswered), it's a filtering issue
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

    // Extract question IDs from the fully filtered results
    // Hybrid approach: 'all' mode uses original logic, user-specific modes use question mode → taxonomical filtering
    let uniqueQuestionIds = allQuestions.map(q => q._id);
    console.log(
      `🚀 DEBUG: Final question count after hybrid filtering: ${uniqueQuestionIds.length}`,
    );

    // If we have more than the requested number of questions, randomly select the desired amount
    if (uniqueQuestionIds.length > requestedQuestions) {
      // Randomly shuffle the array and take the first requestedQuestions elements
      uniqueQuestionIds = shuffleArray(uniqueQuestionIds).slice(
        0,
        requestedQuestions,
      );
    }

    // Create name and description if not provided
    const quizName =
      args.name || `Custom Quiz - ${new Date().toLocaleDateString()}`;
    const quizDescription =
      args.description ||
      `Custom quiz with ${uniqueQuestionIds.length} questions`;

    // Create the custom quiz with a single mode
    const quizId = await ctx.db.insert('customQuizzes', {
      name: quizName,
      description: quizDescription,
      questions: uniqueQuestionIds,
      authorId: userId._id,
      testMode: args.testMode,
      questionMode: args.questionMode, // Store a single mode instead of array
      selectedThemes: args.selectedThemes,
      selectedSubthemes: args.selectedSubthemes,
      selectedGroups: args.selectedGroups,
    });

    // If the user selected study or exam mode, create a session immediately
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
      questionCount: uniqueQuestionIds.length,
    };
  },
});

//Helper functions

/**
 * Hybrid question collection: Different logic for 'all' vs user-specific modes
 * - For 'all': Apply taxonomical filtering first (original logic)
 * - For user-specific modes (incorrect, unanswered, bookmarked): Question mode first, then taxonomical filtering
 */
async function collectQuestionsOptimized(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  questionMode: QuestionMode,
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
  maxQuestions: number,
): Promise<Doc<'questions'>[]> {
  console.log(
    `🚀 DEBUG: collectQuestionsOptimized - Hybrid filtering approach:`,
    {
      questionMode,
      themes: selectedThemes.length,
      subthemes: selectedSubthemes.length,
      groups: selectedGroups.length,
      maxQuestions,
    },
  );

  // Use aggregate approach for ALL modes (both 'all' and user-specific)
  console.log(`🚀 DEBUG: Using aggregate approach for '${questionMode}' mode`);

  const aggregateResult = await collectRandomQuestionsWithAggregates(
    ctx,
    userId,
    questionMode,
    selectedThemes,
    selectedSubthemes,
    selectedGroups,
    maxQuestions,
  );

  // If aggregate approach worked and gave us questions, use it
  if (aggregateResult.length > 0) {
    console.log(
      `🚀 DEBUG: Aggregate approach succeeded with ${aggregateResult.length} questions`,
    );

    // Convert IDs to full question objects for consistency with existing code
    const questions = await Promise.all(
      aggregateResult.map(id => ctx.db.get(id)),
    );

    return questions.filter((q): q is Doc<'questions'> => q !== null);
  }

  console.log(
    `🚀 DEBUG: Aggregate approach returned no questions, falling back to original logic`,
  );

  // Fall back to original logic only if aggregate approach completely failed
  if (questionMode === 'all') {
    return await collectQuestionsWithHierarchyRestriction(
      ctx,
      selectedThemes,
      selectedSubthemes,
      selectedGroups,
      maxQuestions,
    );
  }

  // Performance optimization: For user-specific modes with taxonomical filters,
  // use the efficient approach (taxonomical filtering first) to avoid loading entire database
  const hasFilters =
    selectedThemes.length > 0 ||
    selectedSubthemes.length > 0 ||
    selectedGroups.length > 0;

  if (
    hasFilters &&
    (questionMode === 'unanswered' ||
      questionMode === 'incorrect' ||
      questionMode === 'bookmarked')
  ) {
    console.log(
      `🚀 DEBUG: Using efficient approach for ${questionMode} mode with taxonomical filters`,
    );
    return await collectQuestionsWithTaxonomyThenUserFilter(
      ctx,
      userId,
      questionMode,
      selectedThemes,
      selectedSubthemes,
      selectedGroups,
      maxQuestions,
    );
  }

  // For user-specific modes: Question mode first, then taxonomical filtering
  console.log(
    `🚀 DEBUG: STEP 1 - Applying question mode filter: ${questionMode}`,
  );
  const baseQuestionPool = await getQuestionsByMode(
    ctx,
    userId,
    questionMode,
    maxQuestions,
  );
  console.log(`🚀 DEBUG: STEP 1 - Base pool size: ${baseQuestionPool.length}`);

  // If no base questions, return empty (let the main function handle the error)
  if (baseQuestionPool.length === 0) {
    console.log(`🚀 DEBUG: No questions in base pool, returning empty`);
    return [];
  }

  // STEP 2: Apply hierarchical taxonomical filtering to the baseline pool
  const hasTaxonomicalFilters =
    selectedThemes.length > 0 ||
    selectedSubthemes.length > 0 ||
    selectedGroups.length > 0;

  if (!hasTaxonomicalFilters) {
    console.log(
      `🚀 DEBUG: STEP 2 - No taxonomical filters, returning base pool`,
    );
    return baseQuestionPool;
  }

  console.log(`🚀 DEBUG: STEP 2 - Applying hierarchical taxonomical filtering`);
  const filteredQuestions = await applyHierarchicalTaxonomicalFilters(
    ctx,
    baseQuestionPool,
    selectedThemes,
    selectedSubthemes,
    selectedGroups,
  );

  console.log(
    `🚀 DEBUG: STEP 2 - Final filtered size: ${filteredQuestions.length}`,
  );
  return filteredQuestions;
}

/**
 * Hierarchical filtering criteria for applying taxonomy rules consistently
 */
interface HierarchicalFilteringCriteria {
  // Hierarchy mappings
  subthemeToTheme: Map<Id<'subthemes'>, Id<'themes'>>;
  groupToSubtheme: Map<Id<'groups'>, Id<'subthemes'>>;
  groupsBySubtheme: Map<Id<'subthemes'>, Id<'groups'>[]>;

  // Processing criteria for subthemes
  subthemesToProcess: Array<{
    subthemeId: Id<'subthemes'>;
    groupsForThisSubtheme: Id<'groups'>[] | undefined;
    isExplicitlySelected: boolean;
    shouldIncludeNonGroupQuestions: boolean;
  }>;

  // Processing criteria for themes
  themesToProcess: Array<{
    themeId: Id<'themes'>;
    isOverridden: boolean;
  }>;

  // Global flags
  hasAnyGroupsSelected: boolean;
  selectedGroups: Id<'groups'>[];
}

/**
 * Build hierarchical filtering criteria that can be applied as either database queries or in-memory filters
 */
async function buildHierarchicalFilteringCriteria(
  ctx: QueryCtx | MutationCtx,
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
): Promise<HierarchicalFilteringCriteria> {
  console.log(
    `🔧 DEBUG: Building hierarchical filtering criteria - themes: ${selectedThemes.length}, subthemes: ${selectedSubthemes.length}, groups: ${selectedGroups.length}`,
  );

  // Step 1: Batch fetch subtheme-to-theme relationships
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

  // Step 2: Batch fetch group-to-subtheme relationships
  const groupToSubtheme = new Map<Id<'groups'>, Id<'subthemes'>>();
  if (selectedGroups.length > 0) {
    const groups = await Promise.all(selectedGroups.map(id => ctx.db.get(id)));
    groups.forEach((group, idx) => {
      if (group?.subthemeId) {
        groupToSubtheme.set(selectedGroups[idx], group.subthemeId);
      }
    });
  }

  // Step 3: Group selected groups by their subtheme
  const groupsBySubtheme = new Map<Id<'subthemes'>, Id<'groups'>[]>();
  for (const groupId of selectedGroups) {
    const subthemeId = groupToSubtheme.get(groupId);
    if (subthemeId) {
      if (!groupsBySubtheme.has(subthemeId)) {
        groupsBySubtheme.set(subthemeId, []);
      }
      groupsBySubtheme.get(subthemeId)!.push(groupId);
    }
  }

  // Step 4: Determine subthemes to process (including implied ones from groups)
  const hasAnyGroupsSelected = selectedGroups.length > 0;
  const subthemesToProcess = new Set(selectedSubthemes);

  // Add implied subthemes from groups
  if (hasAnyGroupsSelected) {
    for (const [subthemeId] of groupsBySubtheme) {
      subthemesToProcess.add(subthemeId);

      // Add to subtheme-to-theme mapping if missing
      if (!subthemeToTheme.has(subthemeId)) {
        const subtheme = await ctx.db.get(subthemeId);
        if (subtheme?.themeId) {
          subthemeToTheme.set(subthemeId, subtheme.themeId);
        }
      }
    }
  }

  // Step 5: Build subtheme processing criteria
  const subthemeProcessingCriteria = [];
  for (const subthemeId of subthemesToProcess) {
    const groupsForThisSubtheme = groupsBySubtheme.get(subthemeId);
    const isExplicitlySelected = selectedSubthemes.includes(subthemeId);

    // Determine if we should include non-group questions from this subtheme
    const shouldIncludeNonGroupQuestions =
      groupsForThisSubtheme && groupsForThisSubtheme.length > 0
        ? isExplicitlySelected // This subtheme has selected groups - only include non-group questions if explicitly selected
        : hasAnyGroupsSelected
          ? isExplicitlySelected // Groups are selected globally - only include if explicitly selected
          : true; // No groups selected anywhere - include all questions

    subthemeProcessingCriteria.push({
      subthemeId,
      groupsForThisSubtheme,
      isExplicitlySelected,
      shouldIncludeNonGroupQuestions,
    });
  }

  // Step 6: Build theme processing criteria
  const overriddenThemes = new Set(subthemeToTheme.values());
  const themeProcessingCriteria = selectedThemes.map(themeId => ({
    themeId,
    isOverridden: overriddenThemes.has(themeId),
  }));

  return {
    subthemeToTheme,
    groupToSubtheme,
    groupsBySubtheme,
    subthemesToProcess: subthemeProcessingCriteria,
    themesToProcess: themeProcessingCriteria,
    hasAnyGroupsSelected,
    selectedGroups,
  };
}

/**
 * Apply hierarchical taxonomical filtering to a baseline pool (Step 2 of filtering)
 */
async function applyHierarchicalTaxonomicalFilters(
  ctx: QueryCtx | MutationCtx,
  baseQuestions: Doc<'questions'>[],
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
): Promise<Doc<'questions'>[]> {
  console.log(
    `🔧 DEBUG: Applying hierarchical taxonomical filters to ${baseQuestions.length} questions`,
  );

  // Use shared hierarchical filtering criteria
  const criteria = await buildHierarchicalFilteringCriteria(
    ctx,
    selectedThemes,
    selectedSubthemes,
    selectedGroups,
  );

  const validQuestionIds = new Set<Id<'questions'>>();

  // Process groups first (highest priority)
  for (const groupId of criteria.selectedGroups) {
    baseQuestions.forEach(question => {
      if (question.groupId === groupId) {
        validQuestionIds.add(question._id);
      }
    });
  }

  // Process subthemes using criteria
  for (const subthemeInfo of criteria.subthemesToProcess) {
    const {
      subthemeId,
      groupsForThisSubtheme,
      shouldIncludeNonGroupQuestions,
    } = subthemeInfo;

    if (groupsForThisSubtheme && groupsForThisSubtheme.length > 0) {
      // Add questions from selected groups in this subtheme
      baseQuestions.forEach(question => {
        if (
          question.groupId &&
          groupsForThisSubtheme.includes(question.groupId)
        ) {
          validQuestionIds.add(question._id);
        }
      });

      // Add non-group questions if criteria indicates we should
      if (shouldIncludeNonGroupQuestions) {
        baseQuestions.forEach(question => {
          if (
            question.subthemeId === subthemeId &&
            (question.groupId === undefined || question.groupId === null)
          ) {
            validQuestionIds.add(question._id);
          }
        });
      }
    } else {
      // This subtheme has no selected groups
      if (shouldIncludeNonGroupQuestions) {
        baseQuestions.forEach(question => {
          if (question.subthemeId === subthemeId) {
            validQuestionIds.add(question._id);
          }
        });
      }
    }
  }

  // Process themes using criteria
  for (const themeInfo of criteria.themesToProcess) {
    if (!themeInfo.isOverridden) {
      baseQuestions.forEach(question => {
        if (question.themeId === themeInfo.themeId) {
          validQuestionIds.add(question._id);
        }
      });
    }
  }

  const filteredQuestions = baseQuestions.filter(q =>
    validQuestionIds.has(q._id),
  );

  console.log(`🔧 DEBUG: ===== FILTERING SUMMARY =====`);
  console.log(`🔧 DEBUG: Base questions: ${baseQuestions.length}`);
  console.log(
    `🔧 DEBUG: Valid question IDs collected: ${validQuestionIds.size}`,
  );
  console.log(
    `🔧 DEBUG: Final filtered questions: ${filteredQuestions.length}`,
  );

  return filteredQuestions;
}

/**
 * Hierarchy restriction logic - subthemes override themes, groups override subthemes
 * This is the original function used for 'all' mode
 */
async function collectQuestionsWithHierarchyRestriction(
  ctx: QueryCtx | MutationCtx,
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
  maxQuestions: number,
): Promise<Doc<'questions'>[]> {
  const allQuestions: Doc<'questions'>[] = [];
  const processedQuestionIds = new Set<Id<'questions'>>();

  const addQuestions = (questions: Doc<'questions'>[]) => {
    questions.forEach((q: any) => {
      if (!processedQuestionIds.has(q._id)) {
        processedQuestionIds.add(q._id);
        allQuestions.push(q);
      }
    });
  };

  console.log(`🔍 DEBUG: ===== HIERARCHY RESTRICTION LOGIC =====`);

  // Use shared hierarchical filtering criteria
  const criteria = await buildHierarchicalFilteringCriteria(
    ctx,
    selectedThemes,
    selectedSubthemes,
    selectedGroups,
  );

  // Process groups first (highest priority)
  for (const groupId of criteria.selectedGroups) {
    const beforeCount = allQuestions.length;
    const groupQuestions = await ctx.db
      .query('questions')
      .withIndex('by_group', (q: any) => q.eq('groupId', groupId))
      .take(maxQuestions * 2);
    addQuestions(groupQuestions);
    const addedFromGroup = allQuestions.length - beforeCount;
    console.log(`🔍 DEBUG: Group ${groupId} added ${addedFromGroup} questions`);
  }

  // Process subthemes using criteria
  for (const subthemeInfo of criteria.subthemesToProcess) {
    const {
      subthemeId,
      groupsForThisSubtheme,
      isExplicitlySelected,
      shouldIncludeNonGroupQuestions,
    } = subthemeInfo;

    console.log(
      `🔍 DEBUG: Processing subtheme ${subthemeId}, groups:`,
      groupsForThisSubtheme,
      `explicitly selected: ${isExplicitlySelected}`,
    );

    if (groupsForThisSubtheme && groupsForThisSubtheme.length > 0) {
      // Get questions from selected groups in this subtheme
      let groupQuestionsCount = 0;
      for (const groupId of groupsForThisSubtheme) {
        const beforeCount = allQuestions.length;
        const groupQuestions = await ctx.db
          .query('questions')
          .withIndex('by_group', (q: any) => q.eq('groupId', groupId))
          .take(maxQuestions * 2);
        addQuestions(groupQuestions);
        const addedFromGroup = allQuestions.length - beforeCount;
        groupQuestionsCount += addedFromGroup;
        console.log(
          `🔍 DEBUG: Group ${groupId} added ${addedFromGroup} questions`,
        );
      }

      // Get non-group questions if criteria indicates we should
      if (shouldIncludeNonGroupQuestions) {
        const beforeSubthemeCount = allQuestions.length;
        const allSubthemeQuestions = await ctx.db
          .query('questions')
          .withIndex('by_subtheme', (q: any) => q.eq('subthemeId', subthemeId))
          .take(maxQuestions * 2);

        const subthemeQuestionsWithoutGroups = allSubthemeQuestions.filter(
          (q: any) => q.groupId === undefined || q.groupId === null,
        );
        addQuestions(subthemeQuestionsWithoutGroups);
        const addedFromSubtheme = allQuestions.length - beforeSubthemeCount;
        console.log(
          `🔍 DEBUG: Subtheme ${subthemeId} (without groups) added ${addedFromSubtheme} questions`,
        );
      }
    } else {
      // This subtheme has no selected groups
      if (shouldIncludeNonGroupQuestions) {
        const beforeCount = allQuestions.length;
        const subthemeQuestions = await ctx.db
          .query('questions')
          .withIndex('by_subtheme', (q: any) => q.eq('subthemeId', subthemeId))
          .take(maxQuestions * 2);

        // Filter to non-group questions if groups are selected globally
        const questionsToAdd = criteria.hasAnyGroupsSelected
          ? subthemeQuestions.filter(
              (q: any) => q.groupId === undefined || q.groupId === null,
            )
          : subthemeQuestions;

        addQuestions(questionsToAdd);
        const addedFromSubtheme = allQuestions.length - beforeCount;
        console.log(
          `🔍 DEBUG: Subtheme ${subthemeId} added ${addedFromSubtheme} questions`,
        );
      }
    }
  }

  // Process themes using criteria
  for (const themeInfo of criteria.themesToProcess) {
    if (themeInfo.isOverridden) {
      console.log(
        `🔍 DEBUG: Theme ${themeInfo.themeId} is overridden - skipping`,
      );
    } else {
      console.log(
        `🔍 DEBUG: Theme ${themeInfo.themeId} is NOT overridden - adding questions`,
      );
      const beforeCount = allQuestions.length;
      const themeQuestions = await ctx.db
        .query('questions')
        .withIndex('by_theme', (q: any) => q.eq('themeId', themeInfo.themeId))
        .take(maxQuestions * 2);
      addQuestions(themeQuestions);
      const addedFromTheme = allQuestions.length - beforeCount;
      console.log(
        `🔍 DEBUG: Theme ${themeInfo.themeId} added ${addedFromTheme} questions`,
      );
    }
  }

  console.log(`🔍 DEBUG: FINAL TOTAL: ${allQuestions.length} questions`);
  return allQuestions;
}

// Debug function to trace question collection logic
export const debugQuestionCollection = mutation({
  args: {
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
  returns: v.object({
    debugInfo: v.object({
      step1_selectedEntities: v.object({
        themes: v.array(v.string()),
        subthemes: v.array(v.string()),
        groups: v.array(v.string()),
      }),
      step2_groupsProcessed: v.object({
        groupsQueried: v.array(v.string()),
        questionsFound: v.number(),
        questionIds: v.array(v.string()),
      }),
      step3_subthemesProcessed: v.object({
        subthemesQueried: v.array(v.string()),
        subthemesSkipped: v.array(
          v.object({
            subthemeId: v.string(),
            reason: v.string(),
            conflictingGroups: v.array(v.string()),
          }),
        ),
        questionsFound: v.number(),
        questionIds: v.array(v.string()),
      }),
      step4_themesProcessed: v.object({
        themesQueried: v.array(v.string()),
        themesSkipped: v.array(
          v.object({
            themeId: v.string(),
            reason: v.string(),
            conflictingSubthemes: v.array(v.string()),
            conflictingGroups: v.array(v.string()),
          }),
        ),
        questionsFound: v.number(),
        questionIds: v.array(v.string()),
      }),
      step5_totalQuestions: v.object({
        totalUniqueQuestions: v.number(),
        allQuestionIds: v.array(v.string()),
      }),
      step6_modeFiltering: v.object({
        questionMode: v.string(),
        questionsBeforeFilter: v.number(),
        questionsAfterFilter: v.number(),
        filteredQuestionIds: v.array(v.string()),
      }),
      step7_finalResult: v.object({
        requestedQuestions: v.number(),
        finalQuestionCount: v.number(),
        finalQuestionIds: v.array(v.string()),
      }),
    }),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);

    // Use the requested number of questions or default to MAX_QUESTIONS
    const requestedQuestions = args.numQuestions
      ? Math.min(args.numQuestions, MAX_QUESTIONS)
      : MAX_QUESTIONS;

    // Initialize debug info
    const debugInfo = {
      step1_selectedEntities: {
        themes: args.selectedThemes?.map(id => id) || [],
        subthemes: args.selectedSubthemes?.map(id => id) || [],
        groups: args.selectedGroups?.map(id => id) || [],
      },
      step2_groupsProcessed: {
        groupsQueried: [] as string[],
        questionsFound: 0,
        questionIds: [] as string[],
      },
      step3_subthemesProcessed: {
        subthemesQueried: [] as string[],
        subthemesSkipped: [] as Array<{
          subthemeId: string;
          reason: string;
          conflictingGroups: string[];
        }>,
        questionsFound: 0,
        questionIds: [] as string[],
      },
      step4_themesProcessed: {
        themesQueried: [] as string[],
        themesSkipped: [] as Array<{
          themeId: string;
          reason: string;
          conflictingSubthemes: string[];
          conflictingGroups: string[];
        }>,
        questionsFound: 0,
        questionIds: [] as string[],
      },
      step5_totalQuestions: {
        totalUniqueQuestions: 0,
        allQuestionIds: [] as string[],
      },
      step6_modeFiltering: {
        questionMode: args.questionMode,
        questionsBeforeFilter: 0,
        questionsAfterFilter: 0,
        filteredQuestionIds: [] as string[],
      },
      step7_finalResult: {
        requestedQuestions,
        finalQuestionCount: 0,
        finalQuestionIds: [] as string[],
      },
    };

    // Step 1: Build group candidates from selected themes and subthemes
    const selectedThemes = args.selectedThemes || [];
    const selectedSubthemes = args.selectedSubthemes || [];
    const selectedGroups = args.selectedGroups || [];

    const groupCandidates = new Set<Id<'groups'>>();

    // Add groups from selected themes
    for (const themeId of selectedThemes) {
      const subthemes = await ctx.db
        .query('subthemes')
        .withIndex('by_theme', (q: any) => q.eq('themeId', themeId))
        .collect();

      for (const subtheme of subthemes) {
        const groups = await ctx.db
          .query('groups')
          .withIndex('by_subtheme', (q: any) =>
            q.eq('subthemeId', subtheme._id),
          )
          .collect();
        groups.forEach(g => groupCandidates.add(g._id));
      }
    }

    // Add groups from selected subthemes
    for (const subthemeId of selectedSubthemes) {
      const groups = await ctx.db
        .query('groups')
        .withIndex('by_subtheme', (q: any) => q.eq('subthemeId', subthemeId))
        .collect();
      groups.forEach(g => groupCandidates.add(g._id));
    }

    // Step 2: Final group set = selectedGroups ∩ groupCandidates
    const validGroupIds = selectedGroups.filter(groupId =>
      groupCandidates.has(groupId),
    );

    // Update debug info for the new logic
    debugInfo.step2_groupsProcessed.groupsQueried = validGroupIds;
    debugInfo.step3_subthemesProcessed.subthemesQueried = selectedSubthemes;
    debugInfo.step4_themesProcessed.themesQueried = selectedThemes;

    // Track intersections in debug
    debugInfo.step3_subthemesProcessed.subthemesSkipped = [];
    debugInfo.step4_themesProcessed.themesSkipped = [];

    // Add debug info about group candidates vs selected groups
    const invalidGroups = selectedGroups.filter(
      groupId => !groupCandidates.has(groupId),
    );
    if (invalidGroups.length > 0) {
      debugInfo.step2_groupsProcessed.groupsQueried = [
        ...debugInfo.step2_groupsProcessed.groupsQueried,
        ...invalidGroups.map(id => `INVALID: ${id}`),
      ];
    }

    // Step 3: Use the fixed collection logic - separate the two steps for debugging
    const baseQuestions = await getQuestionsByMode(
      ctx,
      userId._id,
      args.questionMode,
      requestedQuestions,
    );

    // Update step 5 debug info with question mode results
    debugInfo.step5_totalQuestions.totalUniqueQuestions = baseQuestions.length;
    debugInfo.step5_totalQuestions.allQuestionIds = baseQuestions.map(
      (q: any) => q._id,
    );

    // Apply taxonomical filtering
    debugInfo.step6_modeFiltering.questionsBeforeFilter = baseQuestions.length;

    const hasTaxonomicalFilters =
      selectedThemes.length > 0 ||
      selectedSubthemes.length > 0 ||
      selectedGroups.length > 0;

    let filteredQuestions = baseQuestions;
    if (hasTaxonomicalFilters) {
      filteredQuestions = await applyHierarchicalTaxonomicalFilters(
        ctx,
        baseQuestions,
        selectedThemes,
        selectedSubthemes,
        selectedGroups,
      );
    }

    // Update step 6 debug info
    debugInfo.step6_modeFiltering.questionsAfterFilter =
      filteredQuestions.length;
    debugInfo.step6_modeFiltering.filteredQuestionIds = filteredQuestions.map(
      q => q._id,
    );

    // Apply final selection limit
    let uniqueQuestionIds = filteredQuestions.map(q => q._id);
    if (uniqueQuestionIds.length > requestedQuestions) {
      uniqueQuestionIds = shuffleArray(uniqueQuestionIds).slice(
        0,
        requestedQuestions,
      );
    }

    // Update step 7 debug info
    debugInfo.step7_finalResult.finalQuestionCount = uniqueQuestionIds.length;
    debugInfo.step7_finalResult.finalQuestionIds = uniqueQuestionIds;

    return { debugInfo };
  },
});

/**
 * Efficient approach: Apply taxonomical filtering first, then user mode filtering
 * This avoids loading the entire database when there are many unanswered questions
 */
async function collectQuestionsWithTaxonomyThenUserFilter(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  questionMode: QuestionMode,
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
  maxQuestions: number,
): Promise<Doc<'questions'>[]> {
  console.log(
    `🚀 DEBUG: Using efficient approach: taxonomy first, then ${questionMode} filtering`,
  );

  // Step 1: Get taxonomically filtered questions (like 'all' mode)
  const taxonomicallyFilteredQuestions =
    await collectQuestionsWithHierarchyRestriction(
      ctx,
      selectedThemes,
      selectedSubthemes,
      selectedGroups,
      maxQuestions * 3, // Get more to account for filtering
    );

  console.log(
    `🚀 DEBUG: After taxonomical filtering: ${taxonomicallyFilteredQuestions.length} questions`,
  );

  // Step 2: Apply user mode filtering to the smaller set
  let finalQuestions: Doc<'questions'>[] = [];

  switch (questionMode) {
    case 'unanswered': {
      // Get user's answered questions
      const answeredStats = await ctx.db
        .query('userQuestionStats')
        .withIndex('by_user', (q: any) => q.eq('userId', userId))
        .collect();

      const answeredQuestionIds = new Set(
        answeredStats.map((s: any) => s.questionId),
      );

      finalQuestions = taxonomicallyFilteredQuestions.filter(
        (q: any) => !answeredQuestionIds.has(q._id),
      );
      break;
    }

    case 'incorrect': {
      // Get user's incorrect questions
      const incorrectStats = await ctx.db
        .query('userQuestionStats')
        .withIndex('by_user_incorrect', (q: any) =>
          q.eq('userId', userId).eq('isIncorrect', true),
        )
        .collect();

      const incorrectQuestionIds = new Set(
        incorrectStats.map((s: any) => s.questionId),
      );

      finalQuestions = taxonomicallyFilteredQuestions.filter((q: any) =>
        incorrectQuestionIds.has(q._id),
      );
      break;
    }

    case 'bookmarked': {
      // Get user's bookmarked questions
      const bookmarks = await ctx.db
        .query('userBookmarks')
        .withIndex('by_user', (q: any) => q.eq('userId', userId))
        .collect();

      const bookmarkedQuestionIds = new Set(
        bookmarks.map((b: any) => b.questionId),
      );

      finalQuestions = taxonomicallyFilteredQuestions.filter((q: any) =>
        bookmarkedQuestionIds.has(q._id),
      );
      break;
    }

    default: {
      finalQuestions = taxonomicallyFilteredQuestions;
      break;
    }
  }

  console.log(
    `🚀 DEBUG: After ${questionMode} filtering: ${finalQuestions.length} questions`,
  );
  return finalQuestions;
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

/**
 * Get baseline pool of questions based on question mode (Step 1 of filtering)
 */
async function getQuestionsByMode(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  questionMode: QuestionMode,
  maxQuestions: number,
): Promise<Doc<'questions'>[]> {
  console.log(`🔥 DEBUG: getQuestionsByMode called with mode: ${questionMode}`);

  switch (questionMode) {
    case 'incorrect': {
      console.log(`🔥 DEBUG: Getting ALL incorrect questions for user`);
      const incorrectStats = await ctx.db
        .query('userQuestionStats')
        .withIndex('by_user_incorrect', (q: any) =>
          q.eq('userId', userId).eq('isIncorrect', true),
        )
        .collect();

      console.log(
        `🔥 DEBUG: Found ${incorrectStats.length} incorrect question stats`,
      );

      const questions = await Promise.all(
        incorrectStats.map((stat: any) => ctx.db.get(stat.questionId)),
      );

      const validQuestions = questions.filter(
        (q): q is Doc<'questions'> => q !== null,
      );
      console.log(
        `🔥 DEBUG: Retrieved ${validQuestions.length} valid incorrect questions`,
      );
      return validQuestions;
    }

    case 'unanswered': {
      console.log(`🔥 DEBUG: Getting ALL unanswered questions`);
      const allQuestions = await ctx.db.query('questions').collect();

      const answeredStats = await ctx.db
        .query('userQuestionStats')
        .withIndex('by_user', (q: any) => q.eq('userId', userId))
        .collect();

      const answeredQuestionIds = new Set(
        answeredStats.map((s: any) => s.questionId),
      );

      const unansweredQuestions = allQuestions.filter(
        (q: any) => !answeredQuestionIds.has(q._id),
      );

      console.log(
        `🔥 DEBUG: Found ${unansweredQuestions.length} unanswered questions from ${allQuestions.length} total questions`,
      );
      return unansweredQuestions;
    }

    case 'bookmarked': {
      console.log(`🔥 DEBUG: Getting ALL bookmarked questions for user`);
      const bookmarks = await ctx.db
        .query('userBookmarks')
        .withIndex('by_user', (q: any) => q.eq('userId', userId))
        .collect();

      console.log(`🔥 DEBUG: Found ${bookmarks.length} bookmarked questions`);

      const questions = await Promise.all(
        bookmarks.map((bookmark: any) => ctx.db.get(bookmark.questionId)),
      );

      const validQuestions = questions.filter(
        (q): q is Doc<'questions'> => q !== null,
      );
      console.log(
        `🔥 DEBUG: Retrieved ${validQuestions.length} valid bookmarked questions`,
      );
      return validQuestions;
    }

    default: {
      console.log(`🔥 DEBUG: Unknown question mode: ${questionMode}`);
      throw new Error(`Unknown question mode: ${questionMode}`);
    }
  }
}

/**
 * Aggregate-based random selection with complete hierarchy support
 * Handles all hierarchy cases using the same override logic as the original
 */
async function collectRandomQuestionsWithAggregates(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  questionMode: QuestionMode,
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
  maxQuestions: number,
): Promise<Id<'questions'>[]> {
  console.log(
    `🚀 AGGREGATE ADVANCED: Using hierarchy-aware aggregate random selection:`,
    {
      questionMode,
      themes: selectedThemes.length,
      subthemes: selectedSubthemes.length,
      groups: selectedGroups.length,
      maxQuestions,
    },
  );

  // For user-specific modes, use batch-optimized approach for maximum performance
  if (questionMode !== 'all') {
    console.log(
      `🚀 AGGREGATE BATCH: Using batch-optimized approach for user mode ${questionMode}`,
    );

    // OPTIMIZATION: Use batch processing for multiple selections
    const hasHierarchicalSelections =
      selectedGroups.length > 0 ||
      selectedSubthemes.length > 0 ||
      selectedThemes.length > 0;

    if (hasHierarchicalSelections) {
      // Prepare selections for batch processing (priority order: group > subtheme > theme)
      const selections = [
        ...selectedGroups.map(id => ({ type: 'group' as const, id })),
        ...selectedSubthemes.map(id => ({ type: 'subtheme' as const, id })),
        ...selectedThemes.map(id => ({ type: 'theme' as const, id })),
      ];

      console.log(
        `🚀 AGGREGATE BATCH: Processing ${selections.length} selections in parallel`,
      );

      // Special case: If only one selection, use direct query for better performance
      if (selections.length === 1) {
        const selection = selections[0];
        console.log(
          `🚀 AGGREGATE SINGLE: Using direct query for single ${selection.type} selection`,
        );

        const queryArgs = {
          userId,
          mode: questionMode as 'incorrect' | 'bookmarked' | 'unanswered',
          count: maxQuestions,
          ...(selection.type === 'theme'
            ? { themeId: selection.id as Id<'themes'> }
            : {}),
          ...(selection.type === 'subtheme'
            ? { subthemeId: selection.id as Id<'subthemes'> }
            : {}),
          ...(selection.type === 'group'
            ? { groupId: selection.id as Id<'groups'> }
            : {}),
        };

        const questionIds = await ctx.runQuery(
          api.aggregateQueries.getRandomQuestionsByUserModeOptimized,
          queryArgs,
        );

        console.log(
          `🚀 AGGREGATE SINGLE: Returned ${questionIds.length} questions for single ${selection.type} selection`,
        );
        return questionIds;
      }

      // Use the batch-optimized function for multiple selections
      const questionIds = await ctx.runQuery(
        api.aggregateQueries.getRandomQuestionsByUserModeBatch,
        {
          userId,
          mode: questionMode as 'incorrect' | 'bookmarked' | 'unanswered',
          totalCount: maxQuestions,
          selections,
        },
      );

      console.log(
        `🚀 AGGREGATE BATCH: Returned ${questionIds.length} questions for mode '${questionMode}'`,
      );
      return questionIds;
    } else {
      // Global query for cases with no hierarchical selections
      const questionIds = await ctx.runQuery(
        api.aggregateQueries.getRandomQuestionsByUserModeOptimized,
        {
          userId,
          mode: questionMode as 'incorrect' | 'bookmarked' | 'unanswered',
          count: maxQuestions,
        },
      );

      console.log(
        `🚀 AGGREGATE GLOBAL: Returned ${questionIds.length} questions for mode '${questionMode}'`,
      );
      return questionIds;
    }
  }

  const allQuestionIds = new Set<Id<'questions'>>();
  let remainingQuestions = maxQuestions;

  // Step 1: Build hierarchy mappings (same logic as original)
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

  const groupToSubtheme = new Map<Id<'groups'>, Id<'subthemes'>>();
  if (selectedGroups.length > 0) {
    const groups = await Promise.all(selectedGroups.map(id => ctx.db.get(id)));
    groups.forEach((group, idx) => {
      if (group?.subthemeId) {
        groupToSubtheme.set(selectedGroups[idx], group.subthemeId);
      }
    });
  }

  // Step 2: Group selected groups by their subtheme
  const groupsBySubtheme = new Map<Id<'subthemes'>, Id<'groups'>[]>();
  for (const groupId of selectedGroups) {
    const subthemeId = groupToSubtheme.get(groupId);
    if (subthemeId) {
      if (!groupsBySubtheme.has(subthemeId)) {
        groupsBySubtheme.set(subthemeId, []);
      }
      groupsBySubtheme.get(subthemeId)!.push(groupId);
    }
  }

  // Step 3: Process groups (highest priority)
  if (selectedGroups.length > 0) {
    const questionsPerGroup = Math.ceil(
      remainingQuestions / selectedGroups.length,
    );
    console.log(
      `🚀 AGGREGATE: Processing ${selectedGroups.length} groups with ${questionsPerGroup} questions each`,
    );

    for (const groupId of selectedGroups) {
      if (remainingQuestions <= 0) break;

      // For user-specific modes, use user-specific group aggregates
      if (questionMode === 'all') {
        // For 'all' mode, use global group aggregates
        const groupQuestionIds = await ctx.runQuery(
          api.aggregateQueries.getRandomQuestionsByGroup,
          {
            groupId,
            count: Math.min(questionsPerGroup, remainingQuestions),
          },
        );

        groupQuestionIds.forEach((id: Id<'questions'>) =>
          allQuestionIds.add(id),
        );
        remainingQuestions -= groupQuestionIds.length;
        console.log(
          `🚀 AGGREGATE: Group ${groupId} contributed ${groupQuestionIds.length} questions (global mode)`,
        );
      } else {
        // For user-specific modes, use user-specific group aggregates
        const groupQuestionIds = await ctx.runQuery(
          api.aggregateQueries.getRandomQuestionsByUserModeOptimized,
          {
            userId,
            mode: questionMode as 'incorrect' | 'bookmarked' | 'unanswered',
            count: Math.min(questionsPerGroup, remainingQuestions),
            groupId,
          },
        );

        groupQuestionIds.forEach((id: Id<'questions'>) =>
          allQuestionIds.add(id),
        );
        remainingQuestions -= groupQuestionIds.length;
        console.log(
          `🚀 AGGREGATE: Group ${groupId} contributed ${groupQuestionIds.length} questions (user-specific mode)`,
        );
      }
    }
  }

  // Step 4: Process subthemes (only those not overridden by groups)
  const hasAnyGroupsSelected = selectedGroups.length > 0;
  const subthemesToProcess = new Set(selectedSubthemes);

  // Add implied subthemes from groups
  if (hasAnyGroupsSelected) {
    for (const [subthemeId] of groupsBySubtheme) {
      subthemesToProcess.add(subthemeId);
    }
  }

  for (const subthemeId of subthemesToProcess) {
    if (remainingQuestions <= 0) break;

    const groupsForThisSubtheme = groupsBySubtheme.get(subthemeId);
    const isExplicitlySelected = selectedSubthemes.includes(subthemeId);

    // Only get subtheme questions if:
    // 1. Subtheme was explicitly selected AND
    // 2. Either no groups are selected globally OR this subtheme has no groups
    const shouldProcessSubtheme =
      isExplicitlySelected &&
      (!hasAnyGroupsSelected ||
        !groupsForThisSubtheme ||
        groupsForThisSubtheme.length === 0);

    if (shouldProcessSubtheme) {
      // For user-specific modes, use user-specific subtheme aggregates
      if (questionMode === 'all') {
        // For 'all' mode, use global subtheme aggregates
        const subthemeQuestionIds = await ctx.runQuery(
          api.aggregateQueries.getRandomQuestionsBySubtheme,
          {
            subthemeId,
            count: remainingQuestions,
          },
        );

        subthemeQuestionIds.forEach((id: Id<'questions'>) =>
          allQuestionIds.add(id),
        );
        remainingQuestions -= subthemeQuestionIds.length;
        console.log(
          `🚀 AGGREGATE: Subtheme ${subthemeId} contributed ${subthemeQuestionIds.length} questions (global mode)`,
        );
      } else {
        // For user-specific modes, use user-specific subtheme aggregates
        const subthemeQuestionIds = await ctx.runQuery(
          api.aggregateQueries.getRandomQuestionsByUserModeOptimized,
          {
            userId,
            mode: questionMode as 'incorrect' | 'bookmarked' | 'unanswered',
            count: remainingQuestions,
            subthemeId,
          },
        );

        subthemeQuestionIds.forEach((id: Id<'questions'>) =>
          allQuestionIds.add(id),
        );
        remainingQuestions -= subthemeQuestionIds.length;
        console.log(
          `🚀 AGGREGATE: Subtheme ${subthemeId} contributed ${subthemeQuestionIds.length} questions (user-specific mode)`,
        );
      }
    }
  }

  // Step 5: Process themes (only those not overridden by subthemes)
  const overriddenThemes = new Set(subthemeToTheme.values());

  for (const themeId of selectedThemes) {
    if (remainingQuestions <= 0) break;

    if (overriddenThemes.has(themeId)) {
      console.log(
        `🚀 AGGREGATE: Theme ${themeId} skipped (overridden by subthemes)`,
      );
    } else {
      // For user-specific modes, use user-specific theme aggregates
      if (questionMode === 'all') {
        // For 'all' mode, use global theme aggregates
        const themeQuestionIds = await ctx.runQuery(
          api.aggregateQueries.getRandomQuestionsByTheme,
          {
            themeId,
            count: remainingQuestions,
          },
        );

        themeQuestionIds.forEach((id: Id<'questions'>) =>
          allQuestionIds.add(id),
        );
        remainingQuestions -= themeQuestionIds.length;
        console.log(
          `🚀 AGGREGATE: Theme ${themeId} contributed ${themeQuestionIds.length} questions (global mode)`,
        );
      } else {
        // For user-specific modes, use user-specific theme aggregates
        const themeQuestionIds = await ctx.runQuery(
          api.aggregateQueries.getRandomQuestionsByUserModeOptimized,
          {
            userId,
            mode: questionMode as 'incorrect' | 'bookmarked' | 'unanswered',
            count: remainingQuestions,
            themeId,
          },
        );

        themeQuestionIds.forEach((id: Id<'questions'>) =>
          allQuestionIds.add(id),
        );
        remainingQuestions -= themeQuestionIds.length;
        console.log(
          `🚀 AGGREGATE: Theme ${themeId} contributed ${themeQuestionIds.length} questions (user-specific mode)`,
        );
      }
    }
  }

  // Step 6: If no filters, get from global pool
  if (
    selectedThemes.length === 0 &&
    selectedSubthemes.length === 0 &&
    selectedGroups.length === 0
  ) {
    console.log(`🚀 AGGREGATE: Getting random questions from global pool`);
    const globalQuestionIds = await ctx.runQuery(
      api.aggregateQueries.getRandomQuestions,
      {
        count: maxQuestions,
      },
    );
    globalQuestionIds.forEach((id: Id<'questions'>) => allQuestionIds.add(id));
  }

  const finalQuestionIds = [...allQuestionIds];
  console.log(
    `🚀 AGGREGATE: Final result: ${finalQuestionIds.length} unique questions`,
  );
  return finalQuestionIds;
}
