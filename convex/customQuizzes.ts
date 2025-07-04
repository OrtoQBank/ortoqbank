import { v } from 'convex/values';

import { Doc, Id } from './_generated/dataModel';
import {
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from './_generated/server';
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

/**
 * Two-step question collection: Question Mode → Taxonomical Filters
 * Step 1: Get base pool of questions based on question mode (incorrect, unanswered, bookmarked, all)
 * Step 2: Filter that pool by taxonomical criteria (themes/subthemes/groups)
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
  console.log(`🚀 DEBUG: collectQuestionsOptimized - Two-step filtering:`, {
    questionMode,
    themes: selectedThemes.length,
    subthemes: selectedSubthemes.length,
    groups: selectedGroups.length,
    maxQuestions,
  });

  // STEP 1: Get base pool based on question mode
  console.log(
    `🚀 DEBUG: STEP 1 - Applying question mode filter: ${questionMode}`,
  );
  const baseQuestionPool = await getQuestionsByMode(
    ctx,
    userId,
    questionMode,
    maxQuestions,
    selectedThemes,
    selectedSubthemes,
    selectedGroups,
  );
  console.log(`🚀 DEBUG: STEP 1 - Base pool size: ${baseQuestionPool.length}`);

  // If no base questions, return empty (let the main function handle the error)
  if (baseQuestionPool.length === 0) {
    console.log(`🚀 DEBUG: No questions in base pool, returning empty`);
    return [];
  }

  // STEP 2: Apply taxonomical filters to the base pool
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

  // For 'all' mode, we already applied taxonomical filters in Step 1, so skip Step 2
  if (questionMode === 'all') {
    console.log(
      `🚀 DEBUG: STEP 2 - Skipping taxonomical filtering for 'all' mode (already applied in Step 1)`,
    );
    return baseQuestionPool;
  }

  console.log(`🚀 DEBUG: STEP 2 - Applying taxonomical filters to base pool`);
  const filteredQuestions = await applyTaxonomicalFilters(
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
 * Get base pool of questions based on question mode (Step 1 of filtering)
 */
async function getQuestionsByMode(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  questionMode: QuestionMode,
  maxQuestions: number,
  selectedThemes?: Id<'themes'>[],
  selectedSubthemes?: Id<'subthemes'>[],
  selectedGroups?: Id<'groups'>[],
): Promise<Doc<'questions'>[]> {
  console.log(
    `🔥 DEBUG: collectQuestionsByMode called with mode: ${questionMode}, maxQuestions: ${maxQuestions}`,
  );

  switch (questionMode) {
    case 'incorrect': {
      console.log(`🔥 DEBUG: Getting ALL incorrect questions for user`);
      // Get ALL incorrect questions for this user (no limit)
      const incorrectStats = await ctx.db
        .query('userQuestionStats')
        .withIndex('by_user_incorrect', (q: any) =>
          q.eq('userId', userId).eq('isIncorrect', true),
        )
        .collect(); // Get all, not just a sample

      console.log(
        `🔥 DEBUG: Found ${incorrectStats.length} incorrect question stats`,
      );

      // Get the actual question documents
      const questions = await Promise.all(
        incorrectStats.map((stat: any) => ctx.db.get(stat.questionId)),
      );

      // Filter out any null results (deleted questions)
      const validQuestions = questions.filter(
        (q): q is Doc<'questions'> => q !== null,
      );
      console.log(
        `🔥 DEBUG: Retrieved ${validQuestions.length} valid incorrect questions`,
      );
      return validQuestions;
    }

    case 'unanswered': {
      console.log(
        `🔥 DEBUG: Getting ALL unanswered questions by checking answered stats`,
      );
      // For unanswered, we need to get ALL questions and exclude answered ones
      const allQuestions = await ctx.db.query('questions').collect(); // Get ALL questions

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
      // Get ALL bookmarked questions for this user (no limit)
      const bookmarks = await ctx.db
        .query('userBookmarks')
        .withIndex('by_user', (q: any) => q.eq('userId', userId))
        .collect(); // Get all, not just a sample

      console.log(`🔥 DEBUG: Found ${bookmarks.length} bookmarked questions`);

      // Get the actual question documents
      const questions = await Promise.all(
        bookmarks.map((bookmark: any) => ctx.db.get(bookmark.questionId)),
      );

      // Filter out any null results (deleted questions)
      const validQuestions = questions.filter(
        (q): q is Doc<'questions'> => q !== null,
      );
      console.log(
        `🔥 DEBUG: Retrieved ${validQuestions.length} valid bookmarked questions`,
      );
      return validQuestions;
    }

    case 'all': {
      // For 'all' mode, use proper hierarchical logic with direct database queries
      const hasTaxonomicalFilters =
        (selectedThemes && selectedThemes.length > 0) ||
        (selectedSubthemes && selectedSubthemes.length > 0) ||
        (selectedGroups && selectedGroups.length > 0);

      if (hasTaxonomicalFilters) {
        console.log(
          `🔥 DEBUG: Getting questions with hierarchical taxonomical filtering`,
        );
        // Use the proper hierarchical collection logic
        return await collectQuestionsWithHierarchyRestriction(
          ctx,
          selectedThemes || [],
          selectedSubthemes || [],
          selectedGroups || [],
          maxQuestions,
        );
      } else {
        console.log(`🔥 DEBUG: Getting all questions (no filters)`);
        return await ctx.db.query('questions').take(maxQuestions * 2);
      }
    }

    default: {
      console.log(`🔥 DEBUG: Getting all questions (fallback)`);
      return await ctx.db.query('questions').take(maxQuestions * 2);
    }
  }
}

/**
 * Apply taxonomical filters to a base pool of questions (Step 2 of filtering)
 */
async function applyTaxonomicalFilters(
  ctx: QueryCtx | MutationCtx,
  baseQuestions: Doc<'questions'>[],
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
): Promise<Doc<'questions'>[]> {
  console.log(
    `🔧 DEBUG: applyTaxonomicalFilters - filtering ${baseQuestions.length} questions`,
  );

  // Create a Set of valid question IDs based on taxonomical criteria
  const validQuestionIds = new Set<Id<'questions'>>();

  // Simple filtering logic: check each question against the selected criteria
  baseQuestions.forEach(question => {
    let shouldInclude = false;

    // If only groups are selected, include questions that match any selected group
    if (
      selectedGroups.length > 0 &&
      selectedSubthemes.length === 0 &&
      selectedThemes.length === 0
    ) {
      console.log(`🔧 DEBUG: Group-only filtering`);
      if (question.groupId && selectedGroups.includes(question.groupId)) {
        shouldInclude = true;
        console.log(
          `🔧 DEBUG: Question ${question._id} included by group ${question.groupId}`,
        );
      }
    }
    // If only subthemes are selected, include questions that match any selected subtheme
    else if (
      selectedSubthemes.length > 0 &&
      selectedGroups.length === 0 &&
      selectedThemes.length === 0
    ) {
      console.log(`🔧 DEBUG: Subtheme-only filtering`);
      if (
        question.subthemeId &&
        selectedSubthemes.includes(question.subthemeId)
      ) {
        shouldInclude = true;
        console.log(
          `🔧 DEBUG: Question ${question._id} included by subtheme ${question.subthemeId}`,
        );
      }
    }
    // If only themes are selected, include questions that match any selected theme
    else if (
      selectedThemes.length > 0 &&
      selectedSubthemes.length === 0 &&
      selectedGroups.length === 0
    ) {
      console.log(`🔧 DEBUG: Theme-only filtering`);
      if (selectedThemes.includes(question.themeId)) {
        shouldInclude = true;
        console.log(
          `🔧 DEBUG: Question ${question._id} included by theme ${question.themeId}`,
        );
      }
    }
    // Mixed selection: include questions that match ANY of the selected criteria
    else if (
      selectedGroups.length > 0 ||
      selectedSubthemes.length > 0 ||
      selectedThemes.length > 0
    ) {
      console.log(`🔧 DEBUG: Mixed taxonomical filtering`);

      // Check groups first (highest priority)
      if (
        selectedGroups.length > 0 &&
        question.groupId &&
        selectedGroups.includes(question.groupId)
      ) {
        shouldInclude = true;
        console.log(
          `🔧 DEBUG: Question ${question._id} included by group ${question.groupId}`,
        );
      }
      // Check subthemes
      else if (
        selectedSubthemes.length > 0 &&
        question.subthemeId &&
        selectedSubthemes.includes(question.subthemeId)
      ) {
        shouldInclude = true;
        console.log(
          `🔧 DEBUG: Question ${question._id} included by subtheme ${question.subthemeId}`,
        );
      }
      // Check themes
      else if (
        selectedThemes.length > 0 &&
        selectedThemes.includes(question.themeId)
      ) {
        shouldInclude = true;
        console.log(
          `🔧 DEBUG: Question ${question._id} included by theme ${question.themeId}`,
        );
      }
    }

    if (shouldInclude) {
      validQuestionIds.add(question._id);
    }
  });

  const filteredQuestions = baseQuestions.filter(q =>
    validQuestionIds.has(q._id),
  );
  console.log(
    `🔧 DEBUG: Filtered from ${baseQuestions.length} to ${filteredQuestions.length} questions`,
  );

  return filteredQuestions;
}

/**
 * Hierarchy restriction logic - subthemes override themes, groups override subthemes
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
  console.log(`🔍 DEBUG: Input - Themes:`, selectedThemes);
  console.log(`🔍 DEBUG: Input - Subthemes:`, selectedSubthemes);
  console.log(`🔍 DEBUG: Input - Groups:`, selectedGroups);

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

  // Step 4: Process subthemes (they override groups and may override themes)
  const processedSubthemes = new Set<Id<'subthemes'>>();
  console.log(
    `🔍 DEBUG: Processing ${selectedSubthemes.length} subthemes:`,
    selectedSubthemes,
  );
  console.log(
    `🔍 DEBUG: Groups by subtheme:`,
    Object.fromEntries(groupsBySubtheme),
  );

  // Check if ANY groups are selected globally
  const hasAnyGroupsSelected = selectedGroups.length > 0;
  console.log(`🔍 DEBUG: Has any groups selected: ${hasAnyGroupsSelected}`);

  // If groups are selected but no subthemes are explicitly selected,
  // we need to process the implied subthemes that contain those groups
  const subthemesToProcess = new Set(selectedSubthemes);
  if (hasAnyGroupsSelected) {
    const impliedSubthemeIds: Id<'subthemes'>[] = [];
    for (const [subthemeId] of groupsBySubtheme) {
      subthemesToProcess.add(subthemeId);
      console.log(
        `🔍 DEBUG: Adding implied subtheme ${subthemeId} because it contains selected groups`,
      );

      // Collect subtheme IDs that need theme mapping
      if (!subthemeToTheme.has(subthemeId)) {
        impliedSubthemeIds.push(subthemeId);
      }
    }

    // Batch fetch implied subthemes for theme override mapping
    if (impliedSubthemeIds.length > 0) {
      const impliedSubthemes = await Promise.all(
        impliedSubthemeIds.map(id => ctx.db.get(id)),
      );
      impliedSubthemes.forEach((subtheme, idx) => {
        if (subtheme?.themeId) {
          const subthemeId = impliedSubthemeIds[idx];
          subthemeToTheme.set(subthemeId, subtheme.themeId);
          console.log(
            `🔍 DEBUG: Marking theme ${subtheme.themeId} as overridden by implied subtheme ${subthemeId}`,
          );
        }
      });
    }
  }

  console.log(`🔍 DEBUG: Final subthemes to process:`, [...subthemesToProcess]);

  for (const subthemeId of subthemesToProcess) {
    const groupsForThisSubtheme = groupsBySubtheme.get(subthemeId);
    const isExplicitlySelected = selectedSubthemes.includes(subthemeId);

    console.log(
      `🔍 DEBUG: Processing subtheme ${subthemeId}, groups:`,
      groupsForThisSubtheme,
      `explicitly selected: ${isExplicitlySelected}`,
    );

    if (groupsForThisSubtheme && groupsForThisSubtheme.length > 0) {
      console.log(
        `🔍 DEBUG: Subtheme ${subthemeId} has groups selected - using restriction logic`,
      );
      let groupQuestionsCount = 0;

      // Get questions from selected groups
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

      // Only get subtheme non-group questions if the subtheme was explicitly selected
      if (isExplicitlySelected) {
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
        console.log(
          `🔍 DEBUG: Total for subtheme ${subthemeId}: ${groupQuestionsCount + addedFromSubtheme} questions`,
        );
      } else {
        console.log(
          `🔍 DEBUG: Subtheme ${subthemeId} was not explicitly selected - only using group questions`,
        );
        console.log(
          `🔍 DEBUG: Total for subtheme ${subthemeId}: ${groupQuestionsCount} questions (groups only)`,
        );
      }
    } else {
      // This subtheme has no groups selected
      if (hasAnyGroupsSelected) {
        if (isExplicitlySelected) {
          // Groups are selected globally, but this subtheme has none selected
          // Still get questions from this subtheme that don't belong to any group (only if explicitly selected)
          console.log(
            `🔍 DEBUG: Subtheme ${subthemeId} has no groups but groups are selected elsewhere - getting non-group questions`,
          );
          const beforeCount = allQuestions.length;
          const allSubthemeQuestions = await ctx.db
            .query('questions')
            .withIndex('by_subtheme', (q: any) =>
              q.eq('subthemeId', subthemeId),
            )
            .take(maxQuestions * 2);

          const subthemeQuestionsWithoutGroups = allSubthemeQuestions.filter(
            (q: any) => q.groupId === undefined || q.groupId === null,
          );
          addQuestions(subthemeQuestionsWithoutGroups);
          const addedFromSubtheme = allQuestions.length - beforeCount;
          console.log(
            `🔍 DEBUG: Subtheme ${subthemeId} (non-group questions only) added ${addedFromSubtheme} questions`,
          );
        } else {
          console.log(
            `🔍 DEBUG: Subtheme ${subthemeId} was not explicitly selected and has no groups - skipping`,
          );
        }
      } else {
        // Only get all subtheme questions if NO groups are selected anywhere
        console.log(
          `🔍 DEBUG: Subtheme ${subthemeId} has no groups and no global groups selected - getting all questions`,
        );
        const beforeCount = allQuestions.length;
        const subthemeQuestions = await ctx.db
          .query('questions')
          .withIndex('by_subtheme', (q: any) => q.eq('subthemeId', subthemeId))
          .take(maxQuestions * 2);
        addQuestions(subthemeQuestions);
        const addedFromSubtheme = allQuestions.length - beforeCount;
        console.log(
          `🔍 DEBUG: Subtheme ${subthemeId} (all) added ${addedFromSubtheme} questions`,
        );
      }
    }

    processedSubthemes.add(subthemeId);
  }

  // Step 5: Process themes that are NOT overridden by their subthemes
  const overriddenThemes = new Set(subthemeToTheme.values());
  console.log(
    `🔍 DEBUG: Processing ${selectedThemes.length} themes:`,
    selectedThemes,
  );
  console.log(`🔍 DEBUG: Overridden themes:`, [...overriddenThemes]);

  for (const themeId of selectedThemes) {
    if (overriddenThemes.has(themeId)) {
      console.log(`🔍 DEBUG: Theme ${themeId} is overridden - skipping`);
    } else {
      console.log(
        `🔍 DEBUG: Theme ${themeId} is NOT overridden - adding questions`,
      );
      const beforeCount = allQuestions.length;
      const themeQuestions = await ctx.db
        .query('questions')
        .withIndex('by_theme', (q: any) => q.eq('themeId', themeId))
        .take(maxQuestions * 2);
      addQuestions(themeQuestions);
      const addedFromTheme = allQuestions.length - beforeCount;
      console.log(
        `🔍 DEBUG: Theme ${themeId} added ${addedFromTheme} questions`,
      );
    }
  }

  console.log(`🔍 DEBUG: FINAL TOTAL: ${allQuestions.length} questions`);
  console.log(
    `🔍 DEBUG: Question IDs:`,
    allQuestions.map(q => q._id),
  );
  return allQuestions;
}

/**
 * Optimized user stats filtering
 */
async function applyUserStatsFilter(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  questions: Doc<'questions'>[],
  questionMode: QuestionMode,
): Promise<Id<'questions'>[]> {
  switch (questionMode) {
    case 'all': {
      return questions.map((q: Doc<'questions'>) => q._id);
    }

    case 'bookmarked': {
      const bookmarks = await ctx.db
        .query('userBookmarks')
        .withIndex('by_user', (q: any) => q.eq('userId', userId))
        .collect();

      const bookmarkedIds = new Set(bookmarks.map((b: any) => b.questionId));
      return questions
        .filter((q: Doc<'questions'>) => bookmarkedIds.has(q._id))
        .map((q: Doc<'questions'>) => q._id);
    }

    case 'unanswered': {
      // Get all answered questions for this user at once
      const answeredStats = await ctx.db
        .query('userQuestionStats')
        .withIndex('by_user', (q: any) => q.eq('userId', userId))
        .collect();

      const answeredQuestionIds = new Set(
        answeredStats.map((s: any) => s.questionId),
      );
      return questions
        .filter((q: Doc<'questions'>) => !answeredQuestionIds.has(q._id))
        .map((q: Doc<'questions'>) => q._id);
    }

    case 'incorrect': {
      // Get all incorrect questions for this user at once
      const incorrectStats = await ctx.db
        .query('userQuestionStats')
        .withIndex('by_user', (q: any) => q.eq('userId', userId))
        .filter((q: any) => q.eq(q.field('isIncorrect'), true))
        .collect();

      const incorrectQuestionIds = new Set(
        incorrectStats.map((s: any) => s.questionId),
      );
      return questions
        .filter((q: Doc<'questions'>) => incorrectQuestionIds.has(q._id))
        .map((q: Doc<'questions'>) => q._id);
    }

    default: {
      return questions.map((q: Doc<'questions'>) => q._id);
    }
  }
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
    // The new two-step approach already handles both question mode and taxonomical filtering
    let uniqueQuestionIds = allQuestions.map(q => q._id);
    console.log(
      `🚀 DEBUG: Final question count after two-step filtering: ${uniqueQuestionIds.length}`,
    );

    // Check if we have any questions after filtering
    if (uniqueQuestionIds.length === 0) {
      return {
        success: false as const,
        error: 'NO_QUESTIONS_FOUND_AFTER_FILTER',
        message:
          'Nenhuma questão encontrada com os filtros selecionados. Tente ajustar os filtros ou selecionar temas diferentes.',
      };
    }

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

// Lightweight version for quiz results - only fetches essential question fields
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

    // Get lightweight question data - only what's needed for results display
    const lightweightQuestions = await Promise.all(
      quiz.questions.map(async questionId => {
        const question = await ctx.db.get(questionId);
        if (!question) return null;
        return {
          _id: question._id,
          _creationTime: question._creationTime,
          questionTextString: question.questionTextString,
          alternatives: question.alternatives,
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

    // Step 3: Use the optimized collection logic
    const allQuestions = await collectQuestionsOptimized(
      ctx,
      userId._id,
      args.questionMode,
      selectedThemes,
      selectedSubthemes,
      selectedGroups,
      requestedQuestions,
    );

    // For debug purposes, we'll also collect questions using the old intersection logic
    const legacyQuestions: Doc<'questions'>[] = [];
    const processedQuestionIds = new Set<Id<'questions'>>();

    // Helper function to add questions without duplicates
    const addQuestions = (questions: Doc<'questions'>[], step: string) => {
      const stepQuestionIds: string[] = [];
      questions.forEach((q: any) => {
        if (!processedQuestionIds.has(q._id)) {
          processedQuestionIds.add(q._id);
          allQuestions.push(q);
          stepQuestionIds.push(q._id);
        }
      });

      // Update debug info based on step - accumulate for groups, replace for others
      switch (step) {
        case 'groups': {
          // Accumulate group questions (both from groups and null-group questions)
          debugInfo.step2_groupsProcessed.questionIds = [
            ...debugInfo.step2_groupsProcessed.questionIds,
            ...stepQuestionIds,
          ];
          debugInfo.step2_groupsProcessed.questionsFound =
            debugInfo.step2_groupsProcessed.questionIds.length;

          break;
        }
        case 'subthemes': {
          debugInfo.step3_subthemesProcessed.questionIds = stepQuestionIds;
          debugInfo.step3_subthemesProcessed.questionsFound =
            stepQuestionIds.length;

          break;
        }
        case 'themes': {
          debugInfo.step4_themesProcessed.questionIds = stepQuestionIds;
          debugInfo.step4_themesProcessed.questionsFound =
            stepQuestionIds.length;

          break;
        }
        // No default
      }
    };

    // Get questions from valid groups (highest priority)
    if (validGroupIds.length > 0) {
      for (const groupId of validGroupIds) {
        const groupQuestions = await ctx.db
          .query('questions')
          .withIndex('by_group', (q: any) => q.eq('groupId', groupId))
          .take(MAX_QUESTIONS * 2);
        addQuestions(groupQuestions, 'groups');
      }

      // When groups are selected, also include questions from the same subthemes that have no group
      const subthemesWithSelectedGroups = new Set<Id<'subthemes'>>();
      for (const groupId of validGroupIds) {
        const group = await ctx.db.get(groupId);
        if (group?.subthemeId) {
          subthemesWithSelectedGroups.add(group.subthemeId);
        }
      }

      // For each subtheme that has selected groups, get questions with no group
      for (const subthemeId of subthemesWithSelectedGroups) {
        const allSubthemeQuestions = await ctx.db
          .query('questions')
          .withIndex('by_subtheme', (q: any) => q.eq('subthemeId', subthemeId))
          .take(MAX_QUESTIONS * 2);

        // Filter to only questions without a group (undefined/null groupId)
        const subthemeQuestionsWithoutGroup = allSubthemeQuestions.filter(
          (q: any) => q.groupId === undefined || q.groupId === null,
        );
        addQuestions(subthemeQuestionsWithoutGroup, 'groups');
      }
    } else {
      // Fallback: Process hierarchy - subthemes take precedence over themes
      if (selectedSubthemes.length > 0) {
        for (const subthemeId of selectedSubthemes) {
          const allSubthemeQuestions = await ctx.db
            .query('questions')
            .withIndex('by_subtheme', (q: any) =>
              q.eq('subthemeId', subthemeId),
            )
            .take(MAX_QUESTIONS * 2);

          // Only include questions with no group assignment
          const subthemeQuestionsWithoutGroup = allSubthemeQuestions.filter(
            (q: any) => q.groupId === undefined || q.groupId === null,
          );
          addQuestions(subthemeQuestionsWithoutGroup, 'subthemes');
        }
      } else if (selectedThemes.length > 0) {
        // Fallback: Get questions from selected themes if no subthemes
        const shouldIncludeAllThemeQuestions =
          selectedSubthemes.length === 0 && selectedGroups.length === 0;

        for (const themeId of selectedThemes) {
          const allThemeQuestions = await ctx.db
            .query('questions')
            .withIndex('by_theme', (q: any) => q.eq('themeId', themeId))
            .take(MAX_QUESTIONS * 2);

          if (shouldIncludeAllThemeQuestions) {
            // Include ALL questions from this theme
            addQuestions(allThemeQuestions, 'themes');
          } else {
            // Only include questions with no subtheme or group assignment
            const themeQuestionsWithoutSubthemeOrGroup =
              allThemeQuestions.filter(
                (q: any) =>
                  (q.subthemeId === undefined || q.subthemeId === null) &&
                  (q.groupId === undefined || q.groupId === null),
              );
            addQuestions(themeQuestionsWithoutSubthemeOrGroup, 'themes');
          }
        }
      } else {
        // No selections at all - get all questions
        const allThemes = await ctx.db.query('themes').take(50);
        for (const theme of allThemes) {
          debugInfo.step4_themesProcessed.themesQueried.push(theme._id);
          const themeQuestions = await ctx.db
            .query('questions')
            .withIndex('by_theme', (q: any) => q.eq('themeId', theme._id))
            .take(MAX_QUESTIONS);
          addQuestions(themeQuestions, 'themes');
        }
      }
    }

    // Update step 5 debug info
    debugInfo.step5_totalQuestions.totalUniqueQuestions = allQuestions.length;
    debugInfo.step5_totalQuestions.allQuestionIds = allQuestions.map(
      (q: any) => q._id,
    );

    // Apply different filters based on question mode
    const filteredQuestionIds: Id<'questions'>[] = [];
    let modeQuestions: Id<'questions'>[] = [];

    debugInfo.step6_modeFiltering.questionsBeforeFilter = allQuestions.length;

    switch (args.questionMode) {
      case 'all': {
        // Include all questions matching theme/subtheme/group criteria
        modeQuestions = allQuestions.map((q: any) => q._id);
        break;
      }

      case 'bookmarked': {
        // Get bookmarked questions - use the by_user index to limit scanning
        const bookmarks = await ctx.db
          .query('userBookmarks')
          .withIndex('by_user', (q: any) => q.eq('userId', userId._id))
          .collect();

        // Create a Set for faster lookups
        const bookmarkedIds = new Set(bookmarks.map(b => b.questionId));

        // Filter questions to only include those that are bookmarked
        modeQuestions = allQuestions
          .filter((q: any) => bookmarkedIds.has(q._id))
          .map((q: any) => q._id);
        break;
      }

      case 'incorrect':
      case 'unanswered': {
        if (args.questionMode === 'incorrect') {
          // Efficient approach: only query for stats of questions we actually have
          const questionIds = allQuestions.map((q: any) => q._id);
          const incorrectQuestionIds: Id<'questions'>[] = [];

          // Process in batches to avoid large queries
          const batchSize = 50;
          for (let i = 0; i < questionIds.length; i += batchSize) {
            const batch = questionIds.slice(i, i + batchSize);

            // For each question in this batch, check if it's marked as incorrect
            for (const questionId of batch) {
              const stat = await ctx.db
                .query('userQuestionStats')
                .withIndex('by_user_question', (q: any) =>
                  q.eq('userId', userId._id).eq('questionId', questionId),
                )
                .filter((q: any) => q.eq(q.field('isIncorrect'), true))
                .first();

              if (stat) {
                incorrectQuestionIds.push(questionId);
              }
            }
          }

          modeQuestions = incorrectQuestionIds;
        } else {
          // For unanswered: check which questions have no userQuestionStats entry
          const questionIds = allQuestions.map((q: any) => q._id);
          const unansweredQuestionIds: Id<'questions'>[] = [];

          // Process in batches to avoid large queries
          const batchSize = 50;
          for (let i = 0; i < questionIds.length; i += batchSize) {
            const batch = questionIds.slice(i, i + batchSize);

            // For each question in this batch, check if it has been answered
            for (const questionId of batch) {
              const stat = await ctx.db
                .query('userQuestionStats')
                .withIndex('by_user_question', (q: any) =>
                  q.eq('userId', userId._id).eq('questionId', questionId),
                )
                .first();

              // If no stat exists, the question is unanswered
              if (!stat) {
                unansweredQuestionIds.push(questionId);
              }
            }
          }

          modeQuestions = unansweredQuestionIds;
        }
        break;
      }
      // No default
    }

    // Add questions from this mode to the filtered list
    filteredQuestionIds.push(...modeQuestions);

    // Remove duplicates
    let uniqueQuestionIds = [...new Set(filteredQuestionIds)];

    // Update step 6 debug info
    debugInfo.step6_modeFiltering.questionsAfterFilter =
      uniqueQuestionIds.length;
    debugInfo.step6_modeFiltering.filteredQuestionIds = uniqueQuestionIds;

    // If we have more than the requested number of questions, randomly select the desired amount
    if (uniqueQuestionIds.length > requestedQuestions) {
      // Randomly shuffle the array and take the first requestedQuestions elements
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
