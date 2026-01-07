import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { query } from './_generated/server';
import { mutation } from './triggers';
import { getCurrentUserOrThrow } from './users';

export const toggleBookmark = mutation({
  args: {
    questionId: v.id('questions'),
  },
  returns: v.object({
    success: v.boolean(),
    bookmarked: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);

    // Get question data to extract taxonomy fields for aggregates
    const question = await ctx.db.get(args.questionId);
    if (!question) {
      throw new Error('Question not found');
    }

    const existingBookmark = await ctx.db
      .query('userBookmarks')
      .withIndex('by_user_question', q =>
        q.eq('userId', userId._id).eq('questionId', args.questionId),
      )
      .first();

    // If bookmark exists, delete it
    if (existingBookmark) {
      await ctx.db.delete(existingBookmark._id);

      // Update userStatsCounts - decrease bookmark counts
      await updateBookmarkCounts(ctx, userId._id, question, false);

      return { success: true, bookmarked: false };
    }

    // Create bookmark with available taxonomy fields
    // Aggregates will conditionally participate based on available fields
    const bookmarkData = {
      userId: userId._id,
      questionId: args.questionId,
      themeId: question.themeId,
      ...(question.subthemeId && { subthemeId: question.subthemeId }),
      ...(question.groupId && { groupId: question.groupId }),
      // Multi-tenancy: inherit tenantId from question
      tenantId: question.tenantId,
    };

    await ctx.db.insert('userBookmarks', bookmarkData);

    // Update userStatsCounts - increase bookmark counts
    await updateBookmarkCounts(ctx, userId._id, question, true);

    return { success: true, bookmarked: true };
  },
});

export const isBookmarked = query({
  args: {
    questionId: v.id('questions'),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);
    const { db } = ctx;

    const existing = db
      .query('userBookmarks')
      .withIndex('by_user_question', q =>
        q.eq('userId', userId._id).eq('questionId', args.questionId),
      )
      .first();

    return !!existing;
  },
});

// Check bookmark status for multiple questions in a single batch
export const getBookmarkStatusForQuestions = query({
  args: {
    questionIds: v.array(v.id('questions')),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);
    const { db } = ctx;

    // If no questions to check, return empty result
    if (args.questionIds.length === 0) {
      return {};
    }

    // Get all bookmarks for this user - we use the by_user index for efficiency
    const bookmarks = await db
      .query('userBookmarks')
      .withIndex('by_user', q => q.eq('userId', userId._id))
      .collect();

    // Create a map of questionId -> bookmarked status
    const bookmarkMap: Record<string, boolean> = {};

    // Initialize all requested questions as not bookmarked
    for (const questionId of args.questionIds) {
      bookmarkMap[questionId] = false;
    }

    // Mark the ones that are bookmarked
    for (const bookmark of bookmarks) {
      if (args.questionIds.includes(bookmark.questionId)) {
        bookmarkMap[bookmark.questionId] = true;
      }
    }

    return bookmarkMap;
  },
});

// Get all bookmarked question IDs for a user
export const getBookmarkedQuestionIds = query({
  args: { tenantId: v.optional(v.id('apps')) },
  handler: async (ctx, { tenantId }) => {
    const userId = await getCurrentUserOrThrow(ctx);
    const { db } = ctx;

    // Get all bookmarks for this user
    let bookmarks;
    if (tenantId) {
      bookmarks = await db
        .query('userBookmarks')
        .withIndex('by_tenant_and_user', q =>
          q.eq('tenantId', tenantId).eq('userId', userId._id),
        )
        .collect();
    } else {
      bookmarks = await db
        .query('userBookmarks')
        .withIndex('by_user', q => q.eq('userId', userId._id))
        .collect();
    }

    // Return just the question IDs
    return bookmarks.map(bookmark => bookmark.questionId);
  },
});

// Get all bookmarked questions with full data
export const getBookmarkedQuestions = query({
  args: { tenantId: v.optional(v.id('apps')) },
  handler: async (ctx, { tenantId }) => {
    const userId = await getCurrentUserOrThrow(ctx);
    const { db } = ctx;

    // Get all bookmarks for this user
    let bookmarks;
    if (tenantId) {
      bookmarks = await db
        .query('userBookmarks')
        .withIndex('by_tenant_and_user', q =>
          q.eq('tenantId', tenantId).eq('userId', userId._id),
        )
        .collect();
    } else {
      bookmarks = await db
        .query('userBookmarks')
        .withIndex('by_user', q => q.eq('userId', userId._id))
        .collect();
    }

    if (bookmarks.length === 0) {
      return [];
    }

    // Get all questions in a single batch
    const questionIds = bookmarks.map(bookmark => bookmark.questionId);

    // Use getAll to fetch all questions at once
    const questionsPromises = questionIds.map(id => db.get(id));
    const questions = await Promise.all(questionsPromises);

    // Filter out any null results (deleted questions)
    return questions.filter(q => q !== null);
  },
});

// Remove all bookmarks for a question (admin function)
export const removeAllBookmarksForQuestion = mutation({
  args: {
    questionId: v.id('questions'),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserOrThrow(ctx);
    // Optional: Add admin check here

    const bookmarks = await ctx.db
      .query('userBookmarks')
      .withIndex('by_question', q => q.eq('questionId', args.questionId))
      .collect();

    for (const bookmark of bookmarks) {
      await ctx.db.delete(bookmark._id);
    }

    return { success: true, count: bookmarks.length };
  },
});

/**
 * Helper function to update bookmark counts in userStatsCounts
 */
async function updateBookmarkCounts(
  ctx: any,
  userId: Id<'users'>,
  question: any,
  isBookmarked: boolean,
) {
  // Get or create user counts record
  let userCounts = await ctx.db
    .query('userStatsCounts')
    .withIndex('by_user', (q: any) => q.eq('userId', userId))
    .first();

  if (!userCounts) {
    // Initialize counts for new user
    userCounts = {
      userId,
      totalAnswered: 0,
      totalIncorrect: 0,
      totalBookmarked: 0,
      answeredByTheme: {},
      incorrectByTheme: {},
      bookmarkedByTheme: {},
      answeredBySubtheme: {},
      incorrectBySubtheme: {},
      bookmarkedBySubtheme: {},
      answeredByGroup: {},
      incorrectByGroup: {},
      bookmarkedByGroup: {},
      lastUpdated: Date.now(),
      // Multi-tenancy: inherit tenantId from question
      tenantId: question?.tenantId,
    };

    const countsId = await ctx.db.insert('userStatsCounts', userCounts);
    userCounts = { ...userCounts, _id: countsId };
  }

  const delta = isBookmarked ? 1 : -1;

  // Prepare updates
  const updates: any = {
    totalBookmarked: Math.max(0, userCounts.totalBookmarked + delta),
    lastUpdated: Date.now(),
  };

  // Update bookmarked by theme
  if (question.themeId) {
    updates.bookmarkedByTheme = {
      ...userCounts.bookmarkedByTheme,
      [question.themeId]: Math.max(
        0,
        (userCounts.bookmarkedByTheme[question.themeId] || 0) + delta,
      ),
    };
  }

  // Update bookmarked by subtheme
  if (question.subthemeId) {
    updates.bookmarkedBySubtheme = {
      ...userCounts.bookmarkedBySubtheme,
      [question.subthemeId]: Math.max(
        0,
        (userCounts.bookmarkedBySubtheme[question.subthemeId] || 0) + delta,
      ),
    };
  }

  // Update bookmarked by group
  if (question.groupId) {
    updates.bookmarkedByGroup = {
      ...userCounts.bookmarkedByGroup,
      [question.groupId]: Math.max(
        0,
        (userCounts.bookmarkedByGroup[question.groupId] || 0) + delta,
      ),
    };
  }

  // Apply updates
  await ctx.db.patch(userCounts._id, updates);
}
