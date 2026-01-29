/**
 * Custom Quiz Creation Module
 *
 * This module handles the creation of custom quizzes with optimized question selection.
 *
 * ARCHITECTURE:
 * - Mode-aware selection: Different strategies for all/unanswered/incorrect/bookmarked
 * - Hierarchy-first filtering: When filters are applied, query by hierarchy FIRST
 * - Aggregate-based for 'all' mode: Ultra-fast random selection using aggregates
 * - Index-based for filtered modes: Use DB indexes to query efficiently
 *
 * PERFORMANCE CONSIDERATIONS:
 * - Never do global table scans followed by post-filtering
 * - Use hierarchy indexes when theme/subtheme/group filters are applied
 * - Limit document fetches to only what's needed
 */

import { v } from 'convex/values';

import { api } from './_generated/api';
import { Doc, Id } from './_generated/dataModel';
import { mutation, type MutationCtx, type QueryCtx } from './_generated/server';
import { QuestionMode } from './customQuizzes';
import { selectRandom, shuffleArray } from './lib/shuffle';
import { getCurrentUserOrThrow } from './users';

// Maximum number of questions allowed in a custom quiz
export const MAX_QUESTIONS = 120;

// ============================================================================
// PUBLIC MUTATION
// ============================================================================

export const create = mutation({
  args: {
    // Multi-tenancy: required for proper data isolation
    tenantId: v.id('apps'),
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
    // Pre-computed parent relationships from frontend (optimization to avoid DB reads)
    groupParents: v.optional(
      v.record(
        v.id('groups'),
        v.object({
          subthemeId: v.id('subthemes'),
          themeId: v.id('themes'),
        }),
      ),
    ),
    subthemeParents: v.optional(
      v.record(
        v.id('subthemes'),
        v.object({
          themeId: v.id('themes'),
        }),
      ),
    ),
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
    const user = await getCurrentUserOrThrow(ctx);

    const requestedQuestions = args.numQuestions
      ? Math.min(args.numQuestions, MAX_QUESTIONS)
      : MAX_QUESTIONS;

    const selectedThemes = args.selectedThemes || [];
    const selectedSubthemes = args.selectedSubthemes || [];
    const selectedGroups = args.selectedGroups || [];

    // Collect questions using optimized strategy (tenant-scoped)
    const questionIds = await collectQuestionIds(
      ctx,
      user._id,
      args.tenantId,
      args.questionMode,
      selectedThemes,
      selectedSubthemes,
      selectedGroups,
      requestedQuestions,
      args.groupParents,
      args.subthemeParents,
    );

    // Handle no questions found
    if (questionIds.length === 0) {
      const isQuestionModeFiltering = args.questionMode !== 'all';
      return isQuestionModeFiltering
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
    }

    // Create quiz name and description
    const quizName =
      args.name || `Custom Quiz - ${new Date().toLocaleDateString()}`;
    const quizDescription =
      args.description || `Custom quiz with ${questionIds.length} questions`;

    // Create the custom quiz (tenant-scoped)
    const quizId = await ctx.db.insert('customQuizzes', {
      name: quizName,
      description: quizDescription,
      questions: questionIds,
      authorId: user._id,
      testMode: args.testMode,
      questionMode: args.questionMode,
      selectedThemes: args.selectedThemes,
      selectedSubthemes: args.selectedSubthemes,
      selectedGroups: args.selectedGroups,
      tenantId: args.tenantId,
    });

    // Create quiz session immediately (tenant-scoped)
    await ctx.db.insert('quizSessions', {
      userId: user._id,
      quizId,
      mode: args.testMode,
      currentQuestionIndex: 0,
      answers: [],
      answerFeedback: [],
      isComplete: false,
      tenantId: args.tenantId,
    });

    return {
      success: true as const,
      quizId,
      questionCount: questionIds.length,
    };
  },
});

// ============================================================================
// CORE QUESTION COLLECTION LOGIC
// ============================================================================

// Type for pre-computed parent relationships
type GroupParents = Record<
  Id<'groups'>,
  { subthemeId: Id<'subthemes'>; themeId: Id<'themes'> }
>;
type SubthemeParents = Record<Id<'subthemes'>, { themeId: Id<'themes'> }>;

/**
 * Main entry point for question collection.
 * Routes to the appropriate strategy based on mode and filters.
 * Multi-tenant: tenantId ensures questions are only selected from the current tenant.
 */
async function collectQuestionIds(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  tenantId: Id<'apps'>,
  questionMode: QuestionMode,
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
  maxQuestions: number,
  groupParents?: GroupParents,
  subthemeParents?: SubthemeParents,
): Promise<Id<'questions'>[]> {
  const hasFilters =
    selectedThemes.length > 0 ||
    selectedSubthemes.length > 0 ||
    selectedGroups.length > 0;

  console.log(
    `🚀 Collecting questions: tenant=${tenantId}, mode=${questionMode}, hasFilters=${hasFilters}, max=${maxQuestions}`,
  );

  // Route to the appropriate strategy
  switch (questionMode) {
    case 'all': {
      return collectAllModeQuestions(
        ctx,
        tenantId,
        selectedThemes,
        selectedSubthemes,
        selectedGroups,
        maxQuestions,
        groupParents,
        subthemeParents,
      );
    }

    case 'unanswered': {
      return collectUnansweredQuestions(
        ctx,
        userId,
        tenantId,
        selectedThemes,
        selectedSubthemes,
        selectedGroups,
        maxQuestions,
        groupParents,
        subthemeParents,
      );
    }

    case 'incorrect': {
      return collectIncorrectQuestions(
        ctx,
        userId,
        tenantId,
        selectedThemes,
        selectedSubthemes,
        selectedGroups,
        maxQuestions,
        groupParents,
        subthemeParents,
      );
    }

    case 'bookmarked': {
      return collectBookmarkedQuestions(
        ctx,
        userId,
        tenantId,
        selectedThemes,
        selectedSubthemes,
        selectedGroups,
        maxQuestions,
        groupParents,
        subthemeParents,
      );
    }

    default: {
      throw new Error(`Unknown question mode: ${questionMode}`);
    }
  }
}

// ============================================================================
// MODE: ALL - Use aggregates for random selection
// ============================================================================

/**
 * For 'all' mode, use aggregate-based random selection.
 * This is ultra-fast and avoids loading question documents.
 * Multi-tenant: tenantId ensures questions are scoped to current tenant.
 */
async function collectAllModeQuestions(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<'apps'>,
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
  maxQuestions: number,
  groupParents?: GroupParents,
  subthemeParents?: SubthemeParents,
): Promise<Id<'questions'>[]> {
  // No filters: global random selection (tenant-scoped)
  if (
    selectedThemes.length === 0 &&
    selectedSubthemes.length === 0 &&
    selectedGroups.length === 0
  ) {
    return await ctx.runQuery(api.aggregateRandom.getRandomQuestions, {
      tenantId,
      count: maxQuestions,
    });
  }

  // With filters: use hierarchy-aware aggregate selection (tenant-scoped)
  return collectHierarchyFilteredQuestionsViaAggregates(
    ctx,
    tenantId,
    selectedThemes,
    selectedSubthemes,
    selectedGroups,
    maxQuestions,
    groupParents,
    subthemeParents,
  );
}

/**
 * Hierarchy-aware aggregate selection for 'all' mode with filters.
 * Handles hierarchy overrides: groups > subthemes > themes.
 * Multi-tenant: tenantId ensures questions are scoped to current tenant.
 */
async function collectHierarchyFilteredQuestionsViaAggregates(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<'apps'>,
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
  maxQuestions: number,
  groupParents?: GroupParents,
  subthemeParents?: SubthemeParents,
): Promise<Id<'questions'>[]> {
  // Compute hierarchy overrides (uses pre-computed parents if available)
  const { effectiveThemes, effectiveSubthemes, groupsBySubtheme } =
    await computeEffectiveHierarchy(
      ctx,
      selectedThemes,
      selectedSubthemes,
      selectedGroups,
      groupParents,
      subthemeParents,
    );

  // Collect IDs from each level in parallel (all tenant-scoped)
  const [groupResults, subthemeResults, themeResults] = await Promise.all([
    // Groups: always include all selected groups
    Promise.all(
      selectedGroups.map(groupId =>
        ctx.runQuery(api.aggregateRandom.getRandomQuestionsByGroup, {
          tenantId,
          groupId,
          count: maxQuestions,
        }),
      ),
    ),

    // Subthemes: include complement for overridden ones, full for effective ones
    collectSubthemeQuestions(
      ctx,
      tenantId,
      selectedSubthemes,
      effectiveSubthemes,
      groupsBySubtheme,
      maxQuestions,
    ),

    // Themes: only effective (non-overridden) themes
    Promise.all(
      effectiveThemes.map(themeId =>
        ctx.runQuery(api.aggregateRandom.getRandomQuestionsByTheme, {
          tenantId,
          themeId,
          count: maxQuestions,
        }),
      ),
    ),
  ]);

  // Combine, dedupe, and downsample
  const combined = [
    ...groupResults.flat(),
    ...subthemeResults.flat(),
    ...themeResults.flat(),
  ];

  const uniqueIds = [...new Set(combined)];
  console.log(`🚀 'all' mode collected ${uniqueIds.length} unique questions`);

  return uniqueIds.length <= maxQuestions
    ? uniqueIds
    : selectRandom(uniqueIds, maxQuestions);
}

// ============================================================================
// MODE: UNANSWERED - Query by hierarchy first, then filter answered
// ============================================================================

/**
 * For 'unanswered' mode, we MUST query by hierarchy FIRST.
 *
 * CRITICAL: Do NOT use global random selection then post-filter.
 * That approach fails when the random sample has few matching questions.
 *
 * Strategy:
 * 1. If filters exist: Query questions by hierarchy using indexes
 * 2. Get user's answered question IDs (fast, uses index) - tenant scoped
 * 3. Filter out answered questions
 * 4. Randomly select from the remaining
 */
async function collectUnansweredQuestions(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  tenantId: Id<'apps'>,
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
  maxQuestions: number,
  groupParents?: GroupParents,
  subthemeParents?: SubthemeParents,
): Promise<Id<'questions'>[]> {
  // Get user's answered question IDs (tenant-scoped query)
  const answeredStats = await ctx.db
    .query('userQuestionStats')
    .withIndex('by_tenant_and_user', q =>
      q.eq('tenantId', tenantId).eq('userId', userId),
    )
    .filter(q => q.eq(q.field('hasAnswered'), true))
    .collect();

  const answeredIds = new Set<Id<'questions'>>(
    answeredStats.map(s => s.questionId),
  );

  console.log(`📊 User has answered ${answeredIds.size} questions in tenant`);

  // Get candidate question IDs from hierarchy
  const candidateIds = await getQuestionIdsByHierarchy(
    ctx,
    tenantId,
    selectedThemes,
    selectedSubthemes,
    selectedGroups,
    maxQuestions * 3, // Get extra for filtering buffer
    groupParents,
    subthemeParents,
  );

  console.log(`📊 Candidate questions from hierarchy: ${candidateIds.length}`);

  // Filter out answered questions
  const unansweredIds = candidateIds.filter(id => !answeredIds.has(id));

  console.log(`📊 Unanswered questions after filter: ${unansweredIds.length}`);

  // Randomly select the requested number
  return unansweredIds.length <= maxQuestions
    ? shuffleArray(unansweredIds)
    : selectRandom(unansweredIds, maxQuestions);
}

// ============================================================================
// MODE: INCORRECT - Query user stats first, then filter by hierarchy
// ============================================================================

/**
 * For 'incorrect' mode, the user's incorrect questions are the primary filter.
 *
 * Strategy:
 * 1. Get user's incorrect question IDs from stats
 * 2. If filters exist: filter by hierarchy
 * 3. Randomly select from the remaining
 */
async function collectIncorrectQuestions(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  tenantId: Id<'apps'>,
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
  maxQuestions: number,
  groupParents?: GroupParents,
  subthemeParents?: SubthemeParents,
): Promise<Id<'questions'>[]> {
  // Get user's incorrect question IDs (tenant-scoped)
  const incorrectStats = await ctx.db
    .query('userQuestionStats')
    .withIndex('by_tenant_and_user_incorrect', q =>
      q.eq('tenantId', tenantId).eq('userId', userId).eq('isIncorrect', true),
    )
    .collect();

  console.log(`📊 User has ${incorrectStats.length} incorrect questions in tenant`);

  if (incorrectStats.length === 0) {
    return [];
  }

  const hasFilters =
    selectedThemes.length > 0 ||
    selectedSubthemes.length > 0 ||
    selectedGroups.length > 0;

  if (!hasFilters) {
    // No filters: just shuffle and select
    const ids = incorrectStats.map(s => s.questionId);
    return ids.length <= maxQuestions
      ? shuffleArray(ids)
      : selectRandom(ids, maxQuestions);
  }

  // With filters: use taxonomy data from stats if available, else fetch questions
  const filteredIds = await filterQuestionsByHierarchy(
    ctx,
    incorrectStats,
    selectedThemes,
    selectedSubthemes,
    selectedGroups,
    groupParents,
    subthemeParents,
  );

  console.log(
    `📊 Incorrect questions after hierarchy filter: ${filteredIds.length}`,
  );

  return filteredIds.length <= maxQuestions
    ? shuffleArray(filteredIds)
    : selectRandom(filteredIds, maxQuestions);
}

// ============================================================================
// MODE: BOOKMARKED - Query bookmarks first, then filter by hierarchy
// ============================================================================

/**
 * For 'bookmarked' mode, the user's bookmarks are the primary filter.
 * Multi-tenant: tenantId ensures bookmarks are scoped to current tenant.
 */
async function collectBookmarkedQuestions(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  tenantId: Id<'apps'>,
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
  maxQuestions: number,
  groupParents?: GroupParents,
  subthemeParents?: SubthemeParents,
): Promise<Id<'questions'>[]> {
  // Get user's bookmarks (tenant-scoped)
  const bookmarks = await ctx.db
    .query('userBookmarks')
    .withIndex('by_tenant_and_user', q =>
      q.eq('tenantId', tenantId).eq('userId', userId),
    )
    .collect();

  console.log(`📊 User has ${bookmarks.length} bookmarks`);

  if (bookmarks.length === 0) {
    return [];
  }

  const hasFilters =
    selectedThemes.length > 0 ||
    selectedSubthemes.length > 0 ||
    selectedGroups.length > 0;

  if (!hasFilters) {
    // No filters: just shuffle and select
    const ids = bookmarks.map(b => b.questionId);
    return ids.length <= maxQuestions
      ? shuffleArray(ids)
      : selectRandom(ids, maxQuestions);
  }

  // With filters: use taxonomy data from bookmarks if available
  const filteredIds = await filterBookmarksByHierarchy(
    ctx,
    bookmarks,
    selectedThemes,
    selectedSubthemes,
    selectedGroups,
    groupParents,
    subthemeParents,
  );

  console.log(`📊 Bookmarks after hierarchy filter: ${filteredIds.length}`);

  return filteredIds.length <= maxQuestions
    ? shuffleArray(filteredIds)
    : selectRandom(filteredIds, maxQuestions);
}

// ============================================================================
// HIERARCHY HELPERS
// ============================================================================

/**
 * Compute effective hierarchy after applying overrides.
 * Groups override subthemes, subthemes override themes.
 *
 * OPTIMIZATION: If groupParents and subthemeParents are provided (from frontend),
 * we skip DB fetches entirely and use the pre-computed parent relationships.
 */
async function computeEffectiveHierarchy(
  ctx: QueryCtx | MutationCtx,
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
  groupParents?: GroupParents,
  subthemeParents?: SubthemeParents,
): Promise<{
  effectiveThemes: Id<'themes'>[];
  effectiveSubthemes: Id<'subthemes'>[];
  groupsBySubtheme: Map<Id<'subthemes'>, Set<Id<'groups'>>>;
}> {
  const overriddenSubthemes = new Set<Id<'subthemes'>>();
  const overriddenThemes = new Set<Id<'themes'>>();
  const groupsBySubtheme = new Map<Id<'subthemes'>, Set<Id<'groups'>>>();

  // Process groups to find which subthemes/themes they override
  if (selectedGroups.length > 0) {
    if (groupParents) {
      // OPTIMIZED PATH: Use pre-computed parent relationships from frontend
      for (const groupId of selectedGroups) {
        const parent = groupParents[groupId];
        if (parent) {
          overriddenSubthemes.add(parent.subthemeId);
          overriddenThemes.add(parent.themeId);

          if (!groupsBySubtheme.has(parent.subthemeId)) {
            groupsBySubtheme.set(parent.subthemeId, new Set());
          }
          groupsBySubtheme.get(parent.subthemeId)!.add(groupId);
        }
      }
    } else {
      // FALLBACK: Fetch group documents from DB
      const groupDocs = await Promise.all(
        selectedGroups.map(id => ctx.db.get(id)),
      );

      for (const group of groupDocs) {
        if (group?.subthemeId) {
          overriddenSubthemes.add(group.subthemeId);

          if (!groupsBySubtheme.has(group.subthemeId)) {
            groupsBySubtheme.set(group.subthemeId, new Set());
          }
          groupsBySubtheme.get(group.subthemeId)!.add(group._id);
        }
      }

      // Get themes overridden by groups (need to fetch subtheme docs)
      const subthemeIds = [
        ...new Set(groupDocs.map(g => g?.subthemeId).filter(Boolean)),
      ] as Id<'subthemes'>[];
      if (subthemeIds.length > 0) {
        const subthemeDocs = await Promise.all(
          subthemeIds.map(id => ctx.db.get(id)),
        );
        for (const st of subthemeDocs) {
          if (st?.themeId) {
            overriddenThemes.add(st.themeId);
          }
        }
      }
    }
  }

  // Process subthemes to find which themes they override
  if (selectedSubthemes.length > 0) {
    if (subthemeParents) {
      // OPTIMIZED PATH: Use pre-computed parent relationships from frontend
      for (const subthemeId of selectedSubthemes) {
        const parent = subthemeParents[subthemeId];
        if (parent) {
          overriddenThemes.add(parent.themeId);
        }
      }
    } else {
      // FALLBACK: Fetch subtheme documents from DB
      const subthemeDocs = await Promise.all(
        selectedSubthemes.map(id => ctx.db.get(id)),
      );
      for (const st of subthemeDocs) {
        if (st?.themeId) {
          overriddenThemes.add(st.themeId);
        }
      }
    }
  }

  // Compute effective selections (non-overridden)
  const effectiveSubthemes = selectedSubthemes.filter(
    st => !overriddenSubthemes.has(st),
  );
  const effectiveThemes = selectedThemes.filter(
    th => !overriddenThemes.has(th),
  );

  return { effectiveThemes, effectiveSubthemes, groupsBySubtheme };
}

/**
 * Collect subtheme questions handling the group override case.
 * For subthemes with selected groups, only include the complement.
 * Multi-tenant: tenantId ensures questions are scoped to current tenant.
 */
async function collectSubthemeQuestions(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<'apps'>,
  selectedSubthemes: Id<'subthemes'>[],
  effectiveSubthemes: Set<Id<'subthemes'>> | Id<'subthemes'>[],
  groupsBySubtheme: Map<Id<'subthemes'>, Set<Id<'groups'>>>,
  maxQuestions: number,
): Promise<Id<'questions'>[][]> {
  const effectiveSet =
    effectiveSubthemes instanceof Set
      ? effectiveSubthemes
      : new Set(effectiveSubthemes);

  const results: Id<'questions'>[][] = [];

  for (const subthemeId of selectedSubthemes) {
    const selectedGroupsForSubtheme = groupsBySubtheme.get(subthemeId);

    if (selectedGroupsForSubtheme && selectedGroupsForSubtheme.size > 0) {
      // This subtheme has selected groups - include only complement
      // (questions in subtheme but NOT in any of the selected groups)
      // Use tenant-scoped index
      const qDocs = await ctx.db
        .query('questions')
        .withIndex('by_tenant_and_subtheme', q =>
          q.eq('tenantId', tenantId).eq('subthemeId', subthemeId),
        )
        .collect();

      const complementIds = qDocs
        .filter(q => !q.groupId || !selectedGroupsForSubtheme.has(q.groupId))
        .map(q => q._id);

      results.push(complementIds);
    } else if (effectiveSet.has(subthemeId)) {
      // Effective subtheme (not overridden) - use tenant-scoped aggregate
      const ids = await ctx.runQuery(
        api.aggregateRandom.getRandomQuestionsBySubtheme,
        { tenantId, subthemeId, count: maxQuestions },
      );
      results.push(ids);
    }
  }

  return results;
}

/**
 * Get question IDs by hierarchy using indexed queries.
 * This is the core function for filter-first approaches.
 * Multi-tenant: tenantId ensures questions are scoped to current tenant.
 */
async function getQuestionIdsByHierarchy(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<'apps'>,
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
  maxQuestions: number,
  groupParents?: GroupParents,
  subthemeParents?: SubthemeParents,
): Promise<Id<'questions'>[]> {
  const hasFilters =
    selectedThemes.length > 0 ||
    selectedSubthemes.length > 0 ||
    selectedGroups.length > 0;

  // No filters: use global random aggregate (tenant-scoped)
  if (!hasFilters) {
    return await ctx.runQuery(api.aggregateRandom.getRandomQuestions, {
      tenantId,
      count: maxQuestions,
    });
  }

  // Compute effective hierarchy (uses pre-computed parents if available)
  const { effectiveThemes, effectiveSubthemes, groupsBySubtheme } =
    await computeEffectiveHierarchy(
      ctx,
      selectedThemes,
      selectedSubthemes,
      selectedGroups,
      groupParents,
      subthemeParents,
    );

  const allIds: Id<'questions'>[] = [];

  // Collect from groups (most specific) - tenant scoped via taxonomy
  for (const groupId of selectedGroups) {
    const docs = await ctx.db
      .query('questions')
      .withIndex('by_tenant_and_group', q =>
        q.eq('tenantId', tenantId).eq('groupId', groupId),
      )
      .collect();
    allIds.push(...docs.map(d => d._id));
  }

  // Collect from effective subthemes (not overridden by groups)
  for (const subthemeId of effectiveSubthemes) {
    // Skip if this subtheme has selected groups
    if (groupsBySubtheme.has(subthemeId)) {
      continue;
    }

    const docs = await ctx.db
      .query('questions')
      .withIndex('by_tenant_and_subtheme', q =>
        q.eq('tenantId', tenantId).eq('subthemeId', subthemeId),
      )
      .collect();
    allIds.push(...docs.map(d => d._id));
  }

  // Collect from effective themes (not overridden by subthemes or groups)
  for (const themeId of effectiveThemes) {
    const docs = await ctx.db
      .query('questions')
      .withIndex('by_tenant_and_theme', q =>
        q.eq('tenantId', tenantId).eq('themeId', themeId),
      )
      .collect();
    allIds.push(...docs.map(d => d._id));
  }

  // Also handle subthemes that have groups selected (get complement)
  for (const [subthemeId, selectedGroupIds] of groupsBySubtheme.entries()) {
    // Only if this subtheme was actually selected
    if (!selectedSubthemes.includes(subthemeId)) {
      continue;
    }

    const docs = await ctx.db
      .query('questions')
      .withIndex('by_tenant_and_subtheme', q =>
        q.eq('tenantId', tenantId).eq('subthemeId', subthemeId),
      )
      .collect();

    // Include questions not in any of the selected groups
    const complementIds = docs
      .filter(q => !q.groupId || !selectedGroupIds.has(q.groupId))
      .map(q => q._id);

    allIds.push(...complementIds);
  }

  // Dedupe
  return [...new Set(allIds)];
}

/**
 * Filter user stats by hierarchy using taxonomy data from the stats themselves
 * or fetching question documents if needed.
 */
async function filterQuestionsByHierarchy(
  ctx: QueryCtx | MutationCtx,
  stats: Array<{
    questionId: Id<'questions'>;
    themeId?: Id<'themes'>;
    subthemeId?: Id<'subthemes'>;
    groupId?: Id<'groups'>;
  }>,
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
  groupParents?: GroupParents,
  subthemeParents?: SubthemeParents,
): Promise<Id<'questions'>[]> {
  // Compute effective hierarchy (uses pre-computed parents if available)
  const { effectiveThemes, effectiveSubthemes, groupsBySubtheme } =
    await computeEffectiveHierarchy(
      ctx,
      selectedThemes,
      selectedSubthemes,
      selectedGroups,
      groupParents,
      subthemeParents,
    );

  const effectiveSubthemesSet = new Set(effectiveSubthemes);
  const effectiveThemesSet = new Set(effectiveThemes);
  const selectedGroupsSet = new Set(selectedGroups);
  const selectedSubthemesSet = new Set(selectedSubthemes);

  const matchingIds: Id<'questions'>[] = [];

  for (const stat of stats) {
    // Check if taxonomy data is available on the stat
    const hasLocalTaxonomy =
      stat.themeId !== undefined ||
      stat.subthemeId !== undefined ||
      stat.groupId !== undefined;

    if (hasLocalTaxonomy) {
      // Use local taxonomy data
      const matches = checkHierarchyMatch(
        stat.themeId,
        stat.subthemeId,
        stat.groupId,
        effectiveThemesSet,
        effectiveSubthemesSet,
        selectedGroupsSet,
        selectedSubthemesSet,
        groupsBySubtheme,
      );

      if (matches) {
        matchingIds.push(stat.questionId);
      }
    } else {
      // Fallback: fetch question to get taxonomy
      const question = await ctx.db.get(stat.questionId);
      if (!question) continue;

      const matches = checkHierarchyMatch(
        question.themeId,
        question.subthemeId,
        question.groupId,
        effectiveThemesSet,
        effectiveSubthemesSet,
        selectedGroupsSet,
        selectedSubthemesSet,
        groupsBySubtheme,
      );

      if (matches) {
        matchingIds.push(stat.questionId);
      }
    }
  }

  return matchingIds;
}

/**
 * Filter bookmarks by hierarchy.
 */
async function filterBookmarksByHierarchy(
  ctx: QueryCtx | MutationCtx,
  bookmarks: Array<{
    questionId: Id<'questions'>;
    themeId?: Id<'themes'>;
    subthemeId?: Id<'subthemes'>;
    groupId?: Id<'groups'>;
  }>,
  selectedThemes: Id<'themes'>[],
  selectedSubthemes: Id<'subthemes'>[],
  selectedGroups: Id<'groups'>[],
  groupParents?: GroupParents,
  subthemeParents?: SubthemeParents,
): Promise<Id<'questions'>[]> {
  // Reuse the same logic as filterQuestionsByHierarchy
  return filterQuestionsByHierarchy(
    ctx,
    bookmarks,
    selectedThemes,
    selectedSubthemes,
    selectedGroups,
    groupParents,
    subthemeParents,
  );
}

/**
 * Check if a question matches the hierarchy filters.
 */
function checkHierarchyMatch(
  themeId: Id<'themes'> | undefined,
  subthemeId: Id<'subthemes'> | undefined,
  groupId: Id<'groups'> | undefined,
  effectiveThemes: Set<Id<'themes'>>,
  effectiveSubthemes: Set<Id<'subthemes'>>,
  selectedGroups: Set<Id<'groups'>>,
  selectedSubthemes: Set<Id<'subthemes'>>,
  groupsBySubtheme: Map<Id<'subthemes'>, Set<Id<'groups'>>>,
): boolean {
  // Check group match (highest priority)
  if (groupId && selectedGroups.has(groupId)) {
    return true;
  }

  // Check subtheme match
  if (subthemeId && effectiveSubthemes.has(subthemeId)) {
    return true;
  }

  // Check subtheme complement match (subtheme selected but has groups, question not in those groups)
  if (subthemeId && selectedSubthemes.has(subthemeId)) {
    const selectedGroupsForSubtheme = groupsBySubtheme.get(subthemeId);
    if (
      selectedGroupsForSubtheme &&
      selectedGroupsForSubtheme.size > 0 && // This subtheme has selected groups
      // Question matches if it's NOT in any of those groups
      (!groupId || !selectedGroupsForSubtheme.has(groupId))
    ) {
      return true;
    }
  }

  // Check theme match (lowest priority)
  if (themeId && effectiveThemes.has(themeId)) {
    return true;
  }

  return false;
}

// ============================================================================
// DEBUG MUTATION
// ============================================================================

/**
 * Debug mutation to test question collection without creating a quiz.
 */
export const debugQuestionCollection = mutation({
  args: {
    tenantId: v.id('apps'),
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
    hasFilters: v.boolean(),
    filtersApplied: v.object({
      themes: v.number(),
      subthemes: v.number(),
      groups: v.number(),
    }),
    questionsCollected: v.number(),
    executionTimeMs: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const maxQuestions = args.maxQuestions || 50;

    const startTime = Date.now();

    const questionIds = await collectQuestionIds(
      ctx,
      user._id,
      args.tenantId,
      args.questionMode,
      args.selectedThemes || [],
      args.selectedSubthemes || [],
      args.selectedGroups || [],
      maxQuestions,
    );

    const executionTimeMs = Date.now() - startTime;

    const hasFilters =
      (args.selectedThemes?.length || 0) > 0 ||
      (args.selectedSubthemes?.length || 0) > 0 ||
      (args.selectedGroups?.length || 0) > 0;

    return {
      questionMode: args.questionMode,
      hasFilters,
      filtersApplied: {
        themes: args.selectedThemes?.length || 0,
        subthemes: args.selectedSubthemes?.length || 0,
        groups: args.selectedGroups?.length || 0,
      },
      questionsCollected: questionIds.length,
      executionTimeMs,
    };
  },
});
