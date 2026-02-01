// =============================================================================
// AGGREGATE RANDOM SELECTION QUERIES
// =============================================================================
// O(log n) aggregate-based random question selection.
// For count queries, see aggregateCounts.ts

import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { query, type QueryCtx } from './_generated/server';
import {
  randomQuestions,
  randomQuestionsByGroup,
  randomQuestionsBySubtheme,
  randomQuestionsByTheme,
} from './aggregates';
import { verifyTenantAccess } from './auth';

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

async function selectRandomIdsFromAggregate(
  getTotal: () => Promise<number>,
  getAt: (index: number) => Promise<{ id?: Id<'questions'> } | null>,
  desiredCount: number,
): Promise<Id<'questions'>[]> {
  const totalCount = await getTotal();
  if (totalCount === 0 || desiredCount <= 0) return [];

  const questionIds: Id<'questions'>[] = [];
  const maxAttempts = Math.min(desiredCount * 3, totalCount);
  const usedIndices = new Set<number>();

  for (let i = 0; i < desiredCount && usedIndices.size < maxAttempts; i++) {
    let randomIndex: number;
    do {
      randomIndex = Math.floor(Math.random() * totalCount);
    } while (usedIndices.has(randomIndex));

    usedIndices.add(randomIndex);

    try {
      const randomQuestion = await getAt(randomIndex);
      if (randomQuestion?.id) questionIds.push(randomQuestion.id);
    } catch (error) {
      console.warn(
        `Failed to get random question at index ${randomIndex}:`,
        error,
      );
    }
  }

  return questionIds;
}

// =============================================================================
// BASIC RANDOM SELECTION
// =============================================================================

export const getRandomQuestions = query({
  args: {
    tenantId: v.optional(v.id('apps')),
    count: v.number(),
    seed: v.optional(v.string()),
  },
  returns: v.array(v.id('questions')),
  handler: async (ctx, args) => {
    await verifyTenantAccess(ctx, args.tenantId);
    if (!args.tenantId) return [];

    return await selectRandomIdsFromAggregate(
      () =>
        (randomQuestions.count as any)(ctx, {
          namespace: args.tenantId,
          bounds: {},
        }),
      (index: number) =>
        (randomQuestions.at as any)(ctx, index, { namespace: args.tenantId }),
      args.count,
    );
  },
});

// =============================================================================
// TAXONOMY RANDOM SELECTION FACTORY
// =============================================================================

function createRandomSelectionQuery(
  aggregate: typeof randomQuestionsByTheme,
  entityField: 'themeId' | 'subthemeId' | 'groupId',
) {
  return query({
    args: {
      tenantId: v.id('apps'),
      ...(entityField === 'themeId' && { themeId: v.id('themes') }),
      ...(entityField === 'subthemeId' && { subthemeId: v.id('subthemes') }),
      ...(entityField === 'groupId' && { groupId: v.id('groups') }),
      count: v.number(),
    },
    returns: v.array(v.id('questions')),
    handler: async (ctx, args: any) => {
      const entityId = args[entityField];
      const namespace = `${args.tenantId}:${entityId}`;
      return await selectRandomIdsFromAggregate(
        () => (aggregate.count as any)(ctx, { namespace, bounds: {} }),
        (index: number) => (aggregate.at as any)(ctx, index, { namespace }),
        args.count,
      );
    },
  });
}

export const getRandomQuestionsByTheme = createRandomSelectionQuery(
  randomQuestionsByTheme,
  'themeId',
);
export const getRandomQuestionsBySubtheme = createRandomSelectionQuery(
  randomQuestionsBySubtheme,
  'subthemeId',
);
export const getRandomQuestionsByGroup = createRandomSelectionQuery(
  randomQuestionsByGroup,
  'groupId',
);

// =============================================================================
// USER-MODE RANDOM SELECTION
// =============================================================================

export const getRandomQuestionsByUserMode = query({
  args: {
    tenantId: v.optional(v.id('apps')),
    userId: v.id('users'),
    mode: v.union(
      v.literal('incorrect'),
      v.literal('bookmarked'),
      v.literal('unanswered'),
    ),
    count: v.number(),
    themeId: v.optional(v.id('themes')),
    subthemeId: v.optional(v.id('subthemes')),
    groupId: v.optional(v.id('groups')),
  },
  returns: v.array(v.id('questions')),
  handler: async (ctx, args) => {
    await verifyTenantAccess(ctx, args.tenantId);

    if (args.mode === 'incorrect' || args.mode === 'bookmarked') {
      return await getRandomFromUserMode(ctx, args as any);
    }
    return await getRandomUnansweredQuestions(ctx, {
      ...args,
      tenantId: args.tenantId,
    });
  },
});

async function getRandomFromUserMode(
  ctx: QueryCtx,
  args: {
    userId: Id<'users'>;
    mode: 'incorrect' | 'bookmarked';
    count: number;
    themeId?: Id<'themes'>;
    subthemeId?: Id<'subthemes'>;
    groupId?: Id<'groups'>;
  },
): Promise<Id<'questions'>[]> {
  // Get records based on mode
  let records: Array<{ questionId: Id<'questions'> }>;

  if (args.mode === 'incorrect') {
    const allStats = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .collect();
    records = allStats.filter(stat => stat.isIncorrect);
  } else {
    records = await ctx.db
      .query('userBookmarks')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .collect();
  }

  // Filter by hierarchy if specified
  let questionIds: Id<'questions'>[];
  if (args.groupId || args.subthemeId || args.themeId) {
    const filtered: Id<'questions'>[] = [];
    for (const record of records) {
      const question = await ctx.db.get(record.questionId);
      if (!question) continue;
      if (args.groupId && question.groupId !== args.groupId) continue;
      if (args.subthemeId && question.subthemeId !== args.subthemeId) continue;
      if (args.themeId && question.themeId !== args.themeId) continue;
      filtered.push(record.questionId);
    }
    questionIds = filtered;
  } else {
    questionIds = records.map(r => r.questionId);
  }

  if (questionIds.length === 0) return [];
  const shuffled = questionIds.toSorted(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(args.count, shuffled.length));
}

async function getRandomUnansweredQuestions(
  ctx: QueryCtx,
  args: {
    userId: Id<'users'>;
    count: number;
    themeId?: Id<'themes'>;
    subthemeId?: Id<'subthemes'>;
    groupId?: Id<'groups'>;
    tenantId?: Id<'apps'>;
  },
): Promise<Id<'questions'>[]> {
  const answeredStats = await ctx.db
    .query('userQuestionStats')
    .withIndex('by_user_answered', q =>
      q.eq('userId', args.userId).eq('hasAnswered', true),
    )
    .collect();
  const answeredIds = new Set<Id<'questions'>>(
    answeredStats.map(s => s.questionId),
  );

  // Get question IDs using hierarchy index or aggregates
  let allQuestionIds: Id<'questions'>[] = [];
  const indexConfig = args.groupId
    ? { index: 'by_group' as const, field: 'groupId', value: args.groupId }
    : args.subthemeId
      ? {
          index: 'by_subtheme' as const,
          field: 'subthemeId',
          value: args.subthemeId,
        }
      : args.themeId
        ? { index: 'by_theme' as const, field: 'themeId', value: args.themeId }
        : null;

  if (indexConfig) {
    const docs = await ctx.db
      .query('questions')
      .withIndex(indexConfig.index, (q: any) =>
        q.eq(indexConfig.field, indexConfig.value),
      )
      .collect();
    allQuestionIds = docs.map(d => d._id);
  } else if (args.tenantId) {
    allQuestionIds = await selectRandomIdsFromAggregate(
      () =>
        (randomQuestions.count as any)(ctx, {
          namespace: args.tenantId,
          bounds: {},
        }),
      (index: number) =>
        (randomQuestions.at as any)(ctx, index, { namespace: args.tenantId }),
      args.count * 3,
    );
  }

  const unansweredIds = allQuestionIds.filter(id => !answeredIds.has(id));
  if (unansweredIds.length === 0) return [];

  const shuffled = unansweredIds.toSorted(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(args.count, shuffled.length));
}

// =============================================================================
// BATCH RANDOM SELECTION
// =============================================================================

export const getRandomQuestionsByUserModeBatch = query({
  args: {
    userId: v.id('users'),
    mode: v.union(
      v.literal('incorrect'),
      v.literal('bookmarked'),
      v.literal('unanswered'),
    ),
    totalCount: v.number(),
    selections: v.array(
      v.object({
        type: v.union(
          v.literal('theme'),
          v.literal('subtheme'),
          v.literal('group'),
        ),
        id: v.string(),
        weight: v.optional(v.number()),
      }),
    ),
  },
  returns: v.array(v.id('questions')),
  handler: async (ctx, args) => {
    if (args.selections.length === 0) return [];

    const totalWeight = args.selections.reduce(
      (sum, sel) => sum + (sel.weight || 1),
      0,
    );
    const distributedCounts = args.selections.map(sel => ({
      ...sel,
      count: Math.ceil((args.totalCount * (sel.weight || 1)) / totalWeight),
    }));

    const results = await Promise.all(
      distributedCounts.map(async sel => {
        const queryArgs = {
          userId: args.userId,
          mode: args.mode as 'incorrect' | 'bookmarked',
          count: sel.count,
          ...(sel.type === 'theme' ? { themeId: sel.id as Id<'themes'> } : {}),
          ...(sel.type === 'subtheme'
            ? { subthemeId: sel.id as Id<'subthemes'> }
            : {}),
          ...(sel.type === 'group' ? { groupId: sel.id as Id<'groups'> } : {}),
        };

        try {
          return await getRandomFromUserMode(ctx, queryArgs);
        } catch (error) {
          console.warn(
            `Failed to get questions for ${sel.type} ${sel.id}:`,
            error,
          );
          return [];
        }
      }),
    );

    const uniqueIds = [...new Set(results.flat())];
    return uniqueIds.slice(0, args.totalCount);
  },
});
