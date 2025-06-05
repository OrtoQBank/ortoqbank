import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { query } from './_generated/server';
import * as aggregateHelpers from './aggregateHelpers';
import { getCurrentUserOrThrow } from './users';

/**
 * Count questions based on filter type only (no taxonomy selection yet)
 * This function efficiently counts questions using aggregates where possible
 */
export const getQuestionCountByFilter = query({
  args: {
    filter: v.union(
      v.literal('all'),
      v.literal('unanswered'),
      v.literal('incorrect'),
      v.literal('bookmarked'),
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);
    return await getCountForFilterType(ctx, args.filter, userId._id);
  },
});

/**
 * Get count for a specific filter type (all/unanswered/incorrect/bookmarked)
 */
async function getCountForFilterType(
  ctx: any,
  filter: 'all' | 'unanswered' | 'incorrect' | 'bookmarked',
  userId: Id<'users'>,
): Promise<number> {
  switch (filter) {
    case 'all': {
      return await aggregateHelpers.getTotalQuestionCount(ctx);
    }

    case 'unanswered': {
      // Total questions minus answered questions
      const totalQuestions = await aggregateHelpers.getTotalQuestionCount(ctx);
      const answeredCount = await aggregateHelpers.getUserAnsweredCount(
        ctx,
        userId,
      );
      return Math.max(0, totalQuestions - answeredCount);
    }

    case 'incorrect': {
      return await aggregateHelpers.getUserIncorrectCount(ctx, userId);
    }

    case 'bookmarked': {
      return await aggregateHelpers.getUserBookmarksCount(ctx, userId);
    }

    default: {
      return 0;
    }
  }
}

/**
 * Get question counts for all filter types at once (for efficiency)
 * This can be used to populate all counters in the UI with a single query
 */
export const getAllQuestionCounts = query({
  args: {},
  returns: v.object({
    all: v.number(),
    unanswered: v.number(),
    incorrect: v.number(),
    bookmarked: v.number(),
  }),
  handler: async ctx => {
    const userId = await getCurrentUserOrThrow(ctx);

    // Get all counts efficiently with parallel queries using aggregates
    const [all, answered, incorrect, bookmarked] = await Promise.all([
      aggregateHelpers.getTotalQuestionCount(ctx),
      aggregateHelpers.getUserAnsweredCount(ctx, userId._id),
      aggregateHelpers.getUserIncorrectCount(ctx, userId._id),
      aggregateHelpers.getUserBookmarksCount(ctx, userId._id),
    ]);

    return {
      all,
      unanswered: Math.max(0, all - answered),
      incorrect,
      bookmarked,
    };
  },
});

// TODO: Future implementation for taxonomy-based filtering
// When ready to implement taxonomy selection, we'll add functions that:
// 1. Use the new taxonomy table structure (taxonomy.type, taxonomy.parentId)
// 2. Query questions using TaxThemeId, TaxSubthemeId, TaxGroupId fields
// 3. Use taxonomyPathIds for efficient hierarchy filtering
// 4. Work with the taxonomyHierarchy table for UI data
