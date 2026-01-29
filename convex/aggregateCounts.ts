// =============================================================================
// AGGREGATE COUNT QUERIES
// =============================================================================
// O(log n) aggregate-based counting for questions by taxonomy and user filters.
// For random selection queries, see aggregateRandom.ts

import { v } from 'convex/values';

import { api } from './_generated/api';
import { Id } from './_generated/dataModel';
import { query, type QueryCtx } from './_generated/server';
import {
  questionCountByGroup,
  questionCountBySubtheme,
  questionCountByTheme,
  totalQuestionCount,
} from './aggregates';
import { verifyTenantAccess } from './auth';
import { getCurrentUserOrThrow } from './users';
import {
  getUserAnsweredCount,
  getUserBookmarksCount,
  getUserBookmarksCountByGroup,
  getUserBookmarksCountBySubtheme,
  getUserBookmarksCountByTheme,
  getUserIncorrectCount,
  getUserIncorrectCountByGroup,
  getUserIncorrectCountBySubtheme,
  getUserIncorrectCountByTheme,
} from './userStatsCounts';

// =============================================================================
// USER STATS COUNT LOOKUP
// =============================================================================

type UserCountFn = (
  ctx: QueryCtx,
  userId: Id<'users'>,
  tenantId: Id<'apps'>,
  entityId: any,
) => Promise<number>;

const userStatCountFunctions: Record<
  'incorrect' | 'bookmarked',
  Record<'theme' | 'subtheme' | 'group', UserCountFn>
> = {
  incorrect: {
    theme: getUserIncorrectCountByTheme,
    subtheme: getUserIncorrectCountBySubtheme,
    group: getUserIncorrectCountByGroup,
  },
  bookmarked: {
    theme: getUserBookmarksCountByTheme,
    subtheme: getUserBookmarksCountBySubtheme,
    group: getUserBookmarksCountByGroup,
  },
};

// =============================================================================
// TOTAL COUNT QUERY
// =============================================================================

export const getTotalQuestionCountQuery = query({
  args: { tenantId: v.optional(v.id('apps')) },
  returns: v.number(),
  handler: async (ctx, args) => {
    await verifyTenantAccess(ctx, args.tenantId);
    if (!args.tenantId) return 0;
    return await totalQuestionCount.count(ctx, {
      namespace: args.tenantId,
      bounds: {} as any,
    });
  },
});

// Helper function for total count (used by other modules)
export async function getTotalQuestionCount(
  ctx: QueryCtx,
  tenantId: Id<'apps'>,
): Promise<number> {
  return await ctx.runQuery(api.aggregateCounts.getTotalQuestionCountQuery, {
    tenantId,
  });
}

// =============================================================================
// TAXONOMY COUNT QUERY FACTORY
// =============================================================================

type TaxonomyIndex =
  | 'by_tenant_and_theme'
  | 'by_tenant_and_subtheme'
  | 'by_tenant_and_group';

function createTaxonomyCountQuery(
  aggregate: typeof questionCountByTheme,
  indexName: TaxonomyIndex,
  entityField: 'themeId' | 'subthemeId' | 'groupId',
) {
  return query({
    args: {
      tenantId: v.id('apps'),
      ...(entityField === 'themeId' && { themeId: v.id('themes') }),
      ...(entityField === 'subthemeId' && { subthemeId: v.id('subthemes') }),
      ...(entityField === 'groupId' && { groupId: v.id('groups') }),
    },
    returns: v.number(),
    handler: async (ctx, args: any) => {
      const entityId = args[entityField];
      const namespace = `${args.tenantId}:${entityId}`;
      try {
        return await aggregate.count(ctx, { namespace, bounds: {} as any });
      } catch (error) {
        console.warn(`Aggregate failed for ${entityField} ${entityId}:`, error);
        const questions = await ctx.db
          .query('questions')
          .withIndex(indexName, (q: any) =>
            q.eq('tenantId', args.tenantId).eq(entityField, entityId),
          )
          .collect();
        return questions.length;
      }
    },
  });
}

export const getThemeQuestionCountQuery = createTaxonomyCountQuery(
  questionCountByTheme,
  'by_tenant_and_theme',
  'themeId',
);

export const getSubthemeQuestionCountQuery = createTaxonomyCountQuery(
  questionCountBySubtheme,
  'by_tenant_and_subtheme',
  'subthemeId',
);

export const getGroupQuestionCountQuery = createTaxonomyCountQuery(
  questionCountByGroup,
  'by_tenant_and_group',
  'groupId',
);

// =============================================================================
// FILTER-BASED COUNT QUERIES
// =============================================================================

export const getQuestionCountByFilter = query({
  args: {
    tenantId: v.optional(v.id('apps')),
    filter: v.union(
      v.literal('all'),
      v.literal('unanswered'),
      v.literal('incorrect'),
      v.literal('bookmarked'),
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    await verifyTenantAccess(ctx, args.tenantId);
    if (!args.tenantId) return 0;
    const userId = await getCurrentUserOrThrow(ctx);
    return await getCountForFilterType(ctx, args.filter, userId._id, args.tenantId);
  },
});

async function getCountForFilterType(
  ctx: QueryCtx,
  filter: 'all' | 'unanswered' | 'incorrect' | 'bookmarked',
  userId: Id<'users'>,
  tenantId: Id<'apps'>,
): Promise<number> {
  switch (filter) {
    case 'all': {
      return await getTotalQuestionCount(ctx, tenantId);
    }
    case 'unanswered': {
      const total = await getTotalQuestionCount(ctx, tenantId);
      const answered = await getUserAnsweredCount(ctx, userId, tenantId);
      return Math.max(0, total - answered);
    }
    case 'incorrect': {
      return await getUserIncorrectCount(ctx, userId, tenantId);
    }
    case 'bookmarked': {
      return await getUserBookmarksCount(ctx, userId, tenantId);
    }
    default: {
      return 0;
    }
  }
}

// =============================================================================
// HIERARCHICAL SELECTION COUNT QUERY
// =============================================================================

export const getQuestionCountBySelection = query({
  args: {
    tenantId: v.optional(v.id('apps')),
    filter: v.union(
      v.literal('all'),
      v.literal('unanswered'),
      v.literal('incorrect'),
      v.literal('bookmarked'),
    ),
    selectedThemes: v.optional(v.array(v.id('themes'))),
    selectedSubthemes: v.optional(v.array(v.id('subthemes'))),
    selectedGroups: v.optional(v.array(v.id('groups'))),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    await verifyTenantAccess(ctx, args.tenantId);
    if (!args.tenantId) return 0;

    const userId = await getCurrentUserOrThrow(ctx);
    const selectedThemes = args.selectedThemes || [];
    const selectedSubthemes = args.selectedSubthemes || [];
    const selectedGroups = args.selectedGroups || [];

    // No selections = total count for filter
    if (
      selectedThemes.length === 0 &&
      selectedSubthemes.length === 0 &&
      selectedGroups.length === 0
    ) {
      return await getCountForFilterType(ctx, args.filter, userId._id, args.tenantId);
    }

    // Single selection optimization using lookup
    if (args.filter === 'incorrect' || args.filter === 'bookmarked') {
      const filterFns = userStatCountFunctions[args.filter];
      const singleSelection =
        selectedGroups.length === 1 &&
        selectedThemes.length === 0 &&
        selectedSubthemes.length === 0
          ? { type: 'group' as const, id: selectedGroups[0] }
          : selectedSubthemes.length === 1 &&
              selectedThemes.length === 0 &&
              selectedGroups.length === 0
            ? { type: 'subtheme' as const, id: selectedSubthemes[0] }
            : selectedThemes.length === 1 &&
                selectedSubthemes.length === 0 &&
                selectedGroups.length === 0
              ? { type: 'theme' as const, id: selectedThemes[0] }
              : null;

      if (singleSelection && filterFns[singleSelection.type]) {
        try {
          return await filterFns[singleSelection.type](
            ctx,
            userId._id,
            args.tenantId,
            singleSelection.id,
          );
        } catch (error) {
          console.warn(`Aggregate failed for ${singleSelection.type}:`, error);
        }
      }
    }

    // Fallback: collect question IDs from hierarchical selections
    const questionIds = new Set<Id<'questions'>>();

    for (const groupId of selectedGroups) {
      const questions = await ctx.db
        .query('questions')
        .withIndex('by_group', q => q.eq('groupId', groupId))
        .collect();
      questions.forEach(q => questionIds.add(q._id));
    }

    for (const subthemeId of selectedSubthemes) {
      const subthemeGroups = await ctx.db
        .query('groups')
        .withIndex('by_subtheme', q => q.eq('subthemeId', subthemeId))
        .collect();
      if (!subthemeGroups.some(g => selectedGroups.includes(g._id))) {
        const questions = await ctx.db
          .query('questions')
          .withIndex('by_subtheme', q => q.eq('subthemeId', subthemeId))
          .collect();
        questions.forEach(q => questionIds.add(q._id));
      }
    }

    for (const themeId of selectedThemes) {
      const themeSubthemes = await ctx.db
        .query('subthemes')
        .withIndex('by_theme', q => q.eq('themeId', themeId))
        .collect();
      if (!themeSubthemes.some(s => selectedSubthemes.includes(s._id))) {
        const questions = await ctx.db
          .query('questions')
          .withIndex('by_theme', q => q.eq('themeId', themeId))
          .collect();
        questions.forEach(q => questionIds.add(q._id));
      }
    }

    return await applyFilterToQuestions(ctx, [...questionIds], args.filter, userId._id);
  },
});

async function applyFilterToQuestions(
  ctx: QueryCtx,
  questionIds: Id<'questions'>[],
  filter: 'all' | 'unanswered' | 'incorrect' | 'bookmarked',
  userId: Id<'users'>,
): Promise<number> {
  if (filter === 'all') return questionIds.length;

  let userQuestionIds: Set<Id<'questions'>>;

  if (filter === 'unanswered') {
    const stats = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect();
    userQuestionIds = new Set(stats.map(s => s.questionId));
    return questionIds.filter(qId => !userQuestionIds.has(qId)).length;
  }

  if (filter === 'incorrect') {
    const stats = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user_incorrect', q => q.eq('userId', userId).eq('isIncorrect', true))
      .collect();
    userQuestionIds = new Set(stats.map(s => s.questionId));
  } else {
    const bookmarks = await ctx.db
      .query('userBookmarks')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect();
    userQuestionIds = new Set(bookmarks.map(b => b.questionId));
  }

  return questionIds.filter(qId => userQuestionIds.has(qId)).length;
}

// =============================================================================
// BATCH COUNT QUERIES
// =============================================================================

export const getAllQuestionCounts = query({
  args: { tenantId: v.optional(v.id('apps')) },
  returns: v.object({
    all: v.number(),
    unanswered: v.number(),
    incorrect: v.number(),
    bookmarked: v.number(),
  }),
  handler: async (ctx, args) => {
    await verifyTenantAccess(ctx, args.tenantId);
    if (!args.tenantId) return { all: 0, unanswered: 0, incorrect: 0, bookmarked: 0 };

    const userId = await getCurrentUserOrThrow(ctx);
    const [all, answered, incorrect, bookmarked] = await Promise.all([
      getTotalQuestionCount(ctx, args.tenantId),
      getUserAnsweredCount(ctx, userId._id, args.tenantId),
      getUserIncorrectCount(ctx, userId._id, args.tenantId),
      getUserBookmarksCount(ctx, userId._id, args.tenantId),
    ]);

    return { all, unanswered: Math.max(0, all - answered), incorrect, bookmarked };
  },
});

export const getBatchQuestionCountsBySelection = query({
  args: {
    tenantId: v.optional(v.id('apps')),
    filter: v.union(
      v.literal('all'),
      v.literal('unanswered'),
      v.literal('incorrect'),
      v.literal('bookmarked'),
    ),
    selections: v.array(
      v.object({
        type: v.union(v.literal('theme'), v.literal('subtheme'), v.literal('group')),
        id: v.string(),
      }),
    ),
  },
  returns: v.object({
    totalCount: v.number(),
    individualCounts: v.array(v.object({ type: v.string(), id: v.string(), count: v.number() })),
  }),
  handler: async (ctx, args) => {
    await verifyTenantAccess(ctx, args.tenantId);
    if (!args.tenantId) return { totalCount: 0, individualCounts: [] };

    const tenantId = args.tenantId;
    const userId = await getCurrentUserOrThrow(ctx);

    if (args.filter === 'all' || args.filter === 'unanswered') {
      const totalCount: number = await ctx.runQuery(
        api.aggregateCounts.getQuestionCountBySelection,
        {
          tenantId,
          filter: args.filter,
          selectedThemes: args.selections.filter(s => s.type === 'theme').map(s => s.id as Id<'themes'>),
          selectedSubthemes: args.selections.filter(s => s.type === 'subtheme').map(s => s.id as Id<'subthemes'>),
          selectedGroups: args.selections.filter(s => s.type === 'group').map(s => s.id as Id<'groups'>),
        },
      );
      return { totalCount, individualCounts: [] };
    }

    const individualCounts = await Promise.all(
      args.selections.map(async selection => {
        try {
          const filterFns = userStatCountFunctions[args.filter as 'incorrect' | 'bookmarked'];
          const countFn = filterFns?.[selection.type as 'theme' | 'subtheme' | 'group'];
          const count = countFn ? await countFn(ctx, userId._id, tenantId, selection.id) : 0;
          return { type: selection.type, id: selection.id, count };
        } catch {
          return { type: selection.type, id: selection.id, count: 0 };
        }
      }),
    );

    const totalCount: number = await ctx.runQuery(
      api.aggregateCounts.getQuestionCountBySelection,
      {
        tenantId,
        filter: args.filter,
        selectedThemes: args.selections.filter(s => s.type === 'theme').map(s => s.id as Id<'themes'>),
        selectedSubthemes: args.selections.filter(s => s.type === 'subtheme').map(s => s.id as Id<'subthemes'>),
        selectedGroups: args.selections.filter(s => s.type === 'group').map(s => s.id as Id<'groups'>),
      },
    );

    return { totalCount, individualCounts };
  },
});
