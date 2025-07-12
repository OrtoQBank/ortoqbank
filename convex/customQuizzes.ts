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

  // For 'all' mode: Keep original logic (taxonomical filtering first)
  if (questionMode === 'all') {
    console.log(`🚀 DEBUG: Using original logic for 'all' mode`);
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
  console.log(
    `🔧 DEBUG: Filters - themes: ${selectedThemes.length}, subthemes: ${selectedSubthemes.length}, groups: ${selectedGroups.length}`,
  );

  // Use the same hierarchical logic as collectQuestionsWithHierarchyRestriction
  // but apply it to the baseline pool instead of querying the database directly
  const validQuestionIds = new Set<Id<'questions'>>();
  const processedQuestionIds = new Set<Id<'questions'>>();

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
    console.log(
      `🔧 DEBUG: Looking up ${selectedGroups.length} groups:`,
      selectedGroups,
    );
    const groups = await Promise.all(selectedGroups.map(id => ctx.db.get(id)));
    console.log(
      `🔧 DEBUG: Found groups:`,
      groups.map((g, idx) => ({
        groupId: selectedGroups[idx],
        exists: !!g,
        subthemeId: g?.subthemeId,
      })),
    );
    groups.forEach((group, idx) => {
      if (group?.subthemeId) {
        groupToSubtheme.set(selectedGroups[idx], group.subthemeId);
        console.log(
          `🔧 DEBUG: Mapped group ${selectedGroups[idx]} to subtheme ${group.subthemeId}`,
        );
      } else {
        console.log(
          `🔧 DEBUG: Group ${selectedGroups[idx]} has no subthemeId or doesn't exist`,
        );
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
      console.log(`🔧 DEBUG: Added group ${groupId} to subtheme ${subthemeId}`);
    } else {
      console.log(
        `🔧 DEBUG: Group ${groupId} has no subthemeId mapping, skipping`,
      );
    }
  }
  console.log(
    `🔧 DEBUG: Groups by subtheme:`,
    Object.fromEntries(groupsBySubtheme),
  );

  // Step 4: Process subthemes (they override groups and may override themes)
  const processedSubthemes = new Set<Id<'subthemes'>>();
  const hasAnyGroupsSelected = selectedGroups.length > 0;
  console.log(`🔧 DEBUG: hasAnyGroupsSelected: ${hasAnyGroupsSelected}`);

  // If groups are selected but no subthemes are explicitly selected,
  // we need to process the implied subthemes that contain those groups
  const subthemesToProcess = new Set(selectedSubthemes);
  console.log(`🔧 DEBUG: Initial subthemesToProcess (explicit):`, [
    ...subthemesToProcess,
  ]);
  if (hasAnyGroupsSelected) {
    for (const [subthemeId] of groupsBySubtheme) {
      subthemesToProcess.add(subthemeId);
      console.log(`🔧 DEBUG: Added implied subtheme: ${subthemeId}`);
    }
  }

  console.log(`🔧 DEBUG: Final subthemesToProcess:`, [...subthemesToProcess]);

  for (const subthemeId of subthemesToProcess) {
    const groupsForThisSubtheme = groupsBySubtheme.get(subthemeId);
    const isExplicitlySelected = selectedSubthemes.includes(subthemeId);

    console.log(`🔧 DEBUG: Processing subtheme ${subthemeId}:`);
    console.log(`🔧 DEBUG: - groupsForThisSubtheme:`, groupsForThisSubtheme);
    console.log(`🔧 DEBUG: - isExplicitlySelected:`, isExplicitlySelected);

    if (groupsForThisSubtheme && groupsForThisSubtheme.length > 0) {
      console.log(
        `🔧 DEBUG: Filtering ${baseQuestions.length} base questions for groups:`,
        groupsForThisSubtheme,
      );
      let matchedQuestions = 0;

      // Add questions from selected groups in this subtheme
      baseQuestions.forEach(question => {
        if (
          question.groupId &&
          groupsForThisSubtheme.includes(question.groupId)
        ) {
          validQuestionIds.add(question._id);
          matchedQuestions++;
        }
      });

      console.log(
        `🔧 DEBUG: Found ${matchedQuestions} questions matching the selected groups`,
      );
      console.log(
        `🔧 DEBUG: Sample question groupIds from base pool:`,
        baseQuestions.slice(0, 5).map(q => ({ id: q._id, groupId: q.groupId })),
      );

      // Only add subtheme non-group questions if the subtheme was explicitly selected
      if (isExplicitlySelected) {
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
      // This subtheme has no groups selected in our mapping
      // If groups are selected globally, DO NOT add any questions from this subtheme
      // unless the subtheme was explicitly selected
      if (hasAnyGroupsSelected) {
        if (isExplicitlySelected) {
          // Add questions from this subtheme that don't belong to any group
          baseQuestions.forEach(question => {
            if (
              question.subthemeId === subthemeId &&
              (question.groupId === undefined || question.groupId === null)
            ) {
              validQuestionIds.add(question._id);
            }
          });
        }
        // If groups are selected but this subtheme wasn't explicitly selected,
        // DO NOT add any questions from this subtheme to avoid the bug
      } else {
        // Add all questions from this subtheme ONLY if no groups are selected anywhere
        baseQuestions.forEach(question => {
          if (question.subthemeId === subthemeId) {
            validQuestionIds.add(question._id);
          }
        });
      }
    }

    processedSubthemes.add(subthemeId);
  }

  // Step 5: Process themes that are NOT overridden by their subthemes
  const overriddenThemes = new Set(subthemeToTheme.values());
  console.log(`🔧 DEBUG: Processing themes, overridden:`, [
    ...overriddenThemes,
  ]);

  for (const themeId of selectedThemes) {
    if (!overriddenThemes.has(themeId)) {
      baseQuestions.forEach(question => {
        if (question.themeId === themeId) {
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
  if (
    filteredQuestions.length === 0 &&
    baseQuestions.length > 0 &&
    selectedGroups.length > 0
  ) {
    console.log(`🔧 DEBUG: ⚠️  NO QUESTIONS MATCHED! This likely means:`);
    console.log(`🔧 DEBUG: - The selected group(s) don't exist, OR`);
    console.log(`🔧 DEBUG: - The group(s) have no subthemeId, OR`);
    console.log(
      `🔧 DEBUG: - None of the base questions belong to the selected group(s)`,
    );
  }

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
