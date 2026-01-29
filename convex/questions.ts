import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';

import { query } from './_generated/server';
import { questionCountByTheme } from './aggregates';
import { requireAppModerator, verifyTenantAccess } from './auth';
import { mutationWithTriggers } from './functions';
import { updateTaxonomyDenormalization } from './questionsTaxonomySync';
import { validateNoBlobs } from './utils';
// Question aggregates are now handled automatically via triggers in functions.ts

// =============================================================================
// QUESTION CONTENT QUERIES
// =============================================================================

/**
 * Get question content (heavy fields) from the questionContent table.
 * This is the preferred way to fetch content - avoids loading heavy data from questions table.
 */
export const getQuestionContent = query({
  args: { questionId: v.id('questions') },
  returns: v.union(
    v.object({
      questionTextString: v.string(),
      explanationTextString: v.string(),
      alternatives: v.array(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const content = await ctx.db
      .query('questionContent')
      .withIndex('by_question', q => q.eq('questionId', args.questionId))
      .first();
    if (!content) return null;
    return {
      questionTextString: content.questionTextString,
      explanationTextString: content.explanationTextString,
      alternatives: content.alternatives,
    };
  },
});

/**
 * Batch fetch question content for multiple questions.
 * More efficient than multiple individual calls.
 */
export const getQuestionContentBatch = query({
  args: { questionIds: v.array(v.id('questions')) },
  returns: v.record(
    v.id('questions'),
    v.object({
      questionTextString: v.string(),
      explanationTextString: v.string(),
      alternatives: v.array(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const result: Record<
      string,
      {
        questionTextString: string;
        explanationTextString: string;
        alternatives: string[];
      }
    > = {};

    // Fetch content for all questions in parallel
    await Promise.all(
      args.questionIds.map(async questionId => {
        const content = await ctx.db
          .query('questionContent')
          .withIndex('by_question', q => q.eq('questionId', questionId))
          .first();
        if (content) {
          result[questionId] = {
            questionTextString: content.questionTextString,
            explanationTextString: content.explanationTextString,
            alternatives: content.alternatives,
          };
        }
      }),
    );

    return result;
  },
});

export const create = mutationWithTriggers({
  args: {
    // Multi-tenancy
    tenantId: v.id('apps'),
    // Accept stringified content from frontend
    questionTextString: v.string(),
    explanationTextString: v.string(),
    questionCode: v.optional(v.string()),
    title: v.string(),
    alternatives: v.array(v.string()),
    correctAlternativeIndex: v.number(),
    themeId: v.id('themes'),
    subthemeId: v.optional(v.id('subthemes')),
    groupId: v.optional(v.id('groups')),
  },
  handler: async (ctx, args) => {
    // Verify moderator access for this app
    await requireAppModerator(ctx, args.tenantId);

    // Validate JSON structure of string content
    try {
      const questionTextObj = JSON.parse(args.questionTextString);
      const explanationTextObj = JSON.parse(args.explanationTextString);

      // Validate structure after parsing
      if (questionTextObj.content) {
        validateNoBlobs(questionTextObj.content);
      }
      if (explanationTextObj.content) {
        validateNoBlobs(explanationTextObj.content);
      }
    } catch (error: any) {
      throw new Error(
        'Invalid content format: ' + (error.message || 'Unknown error'),
      );
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkUserId', q => q.eq('clerkUserId', identity.subject))
      .unique();
    if (!user) throw new Error('User not found');

    // tenantId is now required (validated by requireAppModerator)
    const tenantId = args.tenantId;

    // Lookup taxonomy names for denormalization
    const theme = await ctx.db.get(args.themeId);
    if (!theme) throw new Error('Theme not found');

    const subtheme = args.subthemeId ? await ctx.db.get(args.subthemeId) : null;
    const group = args.groupId ? await ctx.db.get(args.groupId) : null;

    // Prepare question data with ONLY lightweight fields
    // Heavy content (questionTextString, explanationTextString, alternatives)
    // is stored ONLY in questionContent table for optimal performance
    const questionData = {
      // Multi-tenancy
      tenantId,

      // Metadata
      title: args.title,
      normalizedTitle: args.title.trim().toLowerCase(),
      questionCode: args.questionCode,

      // Taxonomy IDs
      themeId: args.themeId,
      subthemeId: args.subthemeId,
      groupId: args.groupId,

      // DENORMALIZED: Taxonomy names (new)
      themeName: theme.name,
      subthemeName: subtheme?.name,
      groupName: group?.name,

      // Quiz essentials (lightweight)
      correctAlternativeIndex: args.correctAlternativeIndex,
      alternativeCount: args.alternatives.length,

      // Publishing
      isPublic: false,
      authorId: user._id,

      // Mark as migrated (content exists ONLY in questionContent table)
      contentMigrated: true,
    };

    // Insert question - triggers automatically update all 8 aggregates
    const questionId = await ctx.db.insert('questions', questionData);

    // Store heavy content in questionContent table (separate from aggregates)
    await ctx.db.insert('questionContent', {
      questionId,
      questionTextString: args.questionTextString,
      explanationTextString: args.explanationTextString,
      alternatives: args.alternatives,
    });

    return questionId;
  },
});

export const list = query({
  args: {
    tenantId: v.optional(v.id('apps')),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (context, { tenantId, paginationOpts }) => {
    // Verify user has access to this tenant
    await verifyTenantAccess(context, tenantId);

    let questions;
    if (tenantId) {
      questions = await context.db
        .query('questions')
        .withIndex('by_tenant', q => q.eq('tenantId', tenantId))
        .order('desc')
        .paginate(paginationOpts);
    } else {
      questions = await context.db
        .query('questions')
        .order('desc')
        .paginate(paginationOpts);
    }

    // Only fetch themes for the current page of questions, not all themes
    const themes = await Promise.all(
      questions.page.map(question => context.db.get(question.themeId)),
    );

    return {
      ...questions,
      page: questions.page.map((question, index) => ({
        ...question,
        theme: themes[index],
      })),
    };
  },
});

export const getById = query({
  args: {
    id: v.id('questions'),
    tenantId: v.optional(v.id('apps')),
  },
  handler: async (context, arguments_) => {
    // Verify user has access to this tenant
    await verifyTenantAccess(context, arguments_.tenantId);

    const question = await context.db.get(arguments_.id);
    if (!question) {
      throw new Error('Question not found');
    }

    // Validate tenant access if tenantId is provided
    if (
      arguments_.tenantId &&
      question.tenantId &&
      question.tenantId !== arguments_.tenantId
    ) {
      throw new Error('Question not found'); // Don't reveal it exists in another tenant
    }

    const theme = await context.db.get(question.themeId);

    const subtheme = question.subthemeId
      ? await context.db.get(question.subthemeId)
      : undefined;

    // Fetch content from questionContent table (the new normalized table)
    const content = await context.db
      .query('questionContent')
      .withIndex('by_question', q => q.eq('questionId', arguments_.id))
      .first();

    return {
      ...question,
      theme,
      subtheme,
      // Merge content from questionContent table (overrides deprecated fields from questions table)
      ...(content && {
        questionTextString: content.questionTextString,
        explanationTextString: content.explanationTextString,
        alternatives: content.alternatives,
      }),
    };
  },
});

export const update = mutationWithTriggers({
  args: {
    id: v.id('questions'),
    // Accept stringified content from frontend
    questionTextString: v.string(),
    explanationTextString: v.string(),
    questionCode: v.optional(v.string()),
    title: v.string(),
    alternatives: v.array(v.string()),
    correctAlternativeIndex: v.number(),
    themeId: v.id('themes'),
    subthemeId: v.optional(v.id('subthemes')),
    groupId: v.optional(v.id('groups')),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Get the existing question to check tenant
    const existingQuestion = await ctx.db.get(args.id);
    if (!existingQuestion) {
      throw new Error('Question not found');
    }

    // Verify moderator access for the question's app
    if (existingQuestion.tenantId) {
      await requireAppModerator(ctx, existingQuestion.tenantId);
    }

    // Validate JSON structure of string content
    try {
      const questionTextObj = JSON.parse(args.questionTextString);
      const explanationTextObj = JSON.parse(args.explanationTextString);

      // Validate structure after parsing
      if (questionTextObj.content) {
        validateNoBlobs(questionTextObj.content);
      }
      if (explanationTextObj.content) {
        validateNoBlobs(explanationTextObj.content);
      }
    } catch (error: any) {
      throw new Error(
        'Invalid content format: ' + (error.message || 'Unknown error'),
      );
    }

    // Lookup taxonomy names for denormalization
    const theme = await ctx.db.get(args.themeId);
    if (!theme) throw new Error('Theme not found');

    const subtheme = args.subthemeId ? await ctx.db.get(args.subthemeId) : null;
    const group = args.groupId ? await ctx.db.get(args.groupId) : null;

    const {
      id,
      questionTextString,
      explanationTextString,
      alternatives,
      ...otherFields
    } = args;

    // Prepare update data for questions table - ONLY lightweight fields
    // Heavy content is stored in questionContent table only
    const updates = {
      ...otherFields,
      normalizedTitle: args.title?.trim().toLowerCase(),
      // Update denormalized taxonomy names
      themeName: theme.name,
      subthemeName: subtheme?.name,
      groupName: group?.name,
      // Update alternative count (lightweight)
      alternativeCount: alternatives.length,
    };

    // Update question - triggers automatically handle aggregate sync
    await ctx.db.patch(id, updates);

    // Get the updated question for denormalization
    const updatedQuestion = await ctx.db.get(id);
    if (updatedQuestion) {
      // Update denormalized taxonomy fields in related tables (userQuestionStats, userBookmarks, userStatsCounts)
      await updateTaxonomyDenormalization(
        ctx,
        id,
        existingQuestion,
        updatedQuestion,
      );
    }

    // Update heavy content in questionContent table ONLY
    const existingContent = await ctx.db
      .query('questionContent')
      .withIndex('by_question', q => q.eq('questionId', id))
      .first();

    // Update or create content in questionContent table
    await (existingContent
      ? ctx.db.patch(existingContent._id, {
          questionTextString,
          explanationTextString,
          alternatives,
        })
      : ctx.db.insert('questionContent', {
          questionId: id,
          questionTextString,
          explanationTextString,
          alternatives,
        }));

    return true; // Indicate success
  },
});

export const listAll = query({
  // WARNING: This query downloads the entire questions table and should be avoided in production
  // or with large datasets as it will consume significant bandwidth.
  // Consider using paginated queries (like 'list') or filtering server-side instead.
  args: { tenantId: v.optional(v.id('apps')) },
  handler: async (context, { tenantId }) => {
    // Verify user has access to this tenant
    await verifyTenantAccess(context, tenantId);

    if (tenantId) {
      return await context.db
        .query('questions')
        .withIndex('by_tenant', q => q.eq('tenantId', tenantId))
        .collect();
    }
    return await context.db.query('questions').collect();
  },
});

export const getMany = query({
  args: { ids: v.array(v.id('questions')) },
  handler: async (ctx, args) => {
    const questions = await Promise.all(args.ids.map(id => ctx.db.get(id)));
    return questions;
  },
});

export const countQuestionsByMode = query({
  args: {
    tenantId: v.optional(v.id('apps')),
    questionMode: v.union(
      v.literal('all'),
      v.literal('unanswered'),
      v.literal('incorrect'),
      v.literal('bookmarked'),
    ),
  },
  handler: async (ctx, { tenantId }) => {
    // Verify user has access to this tenant
    await verifyTenantAccess(ctx, tenantId);

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkUserId', q => q.eq('clerkUserId', identity.subject))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    // Get total questions (filtered by tenant if provided)
    let totalQuestions;
    if (tenantId) {
      totalQuestions = await ctx.db
        .query('questions')
        .withIndex('by_tenant', q => q.eq('tenantId', tenantId))
        .collect();
    } else {
      totalQuestions = await ctx.db.query('questions').collect();
    }
    const totalCount = totalQuestions.length;

    const result = {
      all: totalCount,
      unanswered: 0,
      incorrect: 0,
      bookmarked: 0,
    };

    // Get user stats (filtered by tenant if provided)
    let incorrectStats;
    if (tenantId) {
      incorrectStats = await ctx.db
        .query('userQuestionStats')
        .withIndex('by_tenant_and_user_incorrect', q =>
          q
            .eq('tenantId', tenantId)
            .eq('userId', user._id)
            .eq('isIncorrect', true),
        )
        .collect();
    } else {
      incorrectStats = await ctx.db
        .query('userQuestionStats')
        .withIndex('by_user_incorrect', q =>
          q.eq('userId', user._id).eq('isIncorrect', true),
        )
        .collect();
    }
    result.incorrect = incorrectStats.length;

    // Get bookmarks (filtered by tenant if provided)
    let bookmarks;
    if (tenantId) {
      bookmarks = await ctx.db
        .query('userBookmarks')
        .withIndex('by_tenant_and_user', q =>
          q.eq('tenantId', tenantId).eq('userId', user._id),
        )
        .collect();
    } else {
      bookmarks = await ctx.db
        .query('userBookmarks')
        .withIndex('by_user', q => q.eq('userId', user._id))
        .collect();
    }
    result.bookmarked = bookmarks.length;

    // Get answered stats (filtered by tenant if provided)
    let answeredStats;
    if (tenantId) {
      answeredStats = await ctx.db
        .query('userQuestionStats')
        .withIndex('by_tenant_and_user', q =>
          q.eq('tenantId', tenantId).eq('userId', user._id),
        )
        .collect();
      // Filter for hasAnswered after fetching since compound index doesn't include hasAnswered
      answeredStats = answeredStats.filter(s => s.hasAnswered);
    } else {
      answeredStats = await ctx.db
        .query('userQuestionStats')
        .withIndex('by_user_answered', q =>
          q.eq('userId', user._id).eq('hasAnswered', true),
        )
        .collect();
    }
    result.unanswered = totalCount - answeredStats.length;

    return result;
  },
});

export const getQuestionCountForTheme = query({
  args: { themeId: v.id('themes') },
  handler: async (ctx, args) => {
    const count = await questionCountByTheme.count(ctx, {
      namespace: args.themeId,
      bounds: {},
    });
    return count;
  },
});

export const deleteQuestion = mutationWithTriggers({
  args: { id: v.id('questions') },
  handler: async (ctx, args) => {
    // Get the existing question to check tenant
    const existingQuestion = await ctx.db.get(args.id);
    if (!existingQuestion) {
      throw new Error('Question not found');
    }

    // Verify moderator access for the question's app
    if (existingQuestion.tenantId) {
      await requireAppModerator(ctx, existingQuestion.tenantId);
    }

    // First, remove the question from all preset quizzes that contain it
    const allPresetQuizzes = await ctx.db.query('presetQuizzes').collect();
    for (const quiz of allPresetQuizzes) {
      if (quiz.questions.includes(args.id)) {
        const updatedQuestions = quiz.questions.filter(qId => qId !== args.id);
        await ctx.db.patch(quiz._id, { questions: updatedQuestions });
      }
    }

    // Also remove the question from all custom quizzes that contain it
    const allCustomQuizzes = await ctx.db.query('customQuizzes').collect();
    for (const quiz of allCustomQuizzes) {
      if (quiz.questions.includes(args.id)) {
        const updatedQuestions = quiz.questions.filter(qId => qId !== args.id);
        await ctx.db.patch(quiz._id, { questions: updatedQuestions });
      }
    }

    // Delete associated questionContent record first
    const questionContent = await ctx.db
      .query('questionContent')
      .withIndex('by_question', q => q.eq('questionId', args.id))
      .first();

    if (questionContent) {
      await ctx.db.delete(questionContent._id);
    }

    // Delete the question - triggers automatically handle aggregate sync
    await ctx.db.delete(args.id);
    return true;
  },
});

export const searchByCode = query({
  args: {
    code: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!args.code || args.code.trim() === '') {
      return [];
    }

    // Normalize the search code
    const searchTerm = args.code.trim();

    // Use provided limit or default to 50
    const limit = args.limit || 50;

    // First search by code (since that's more specific)
    const codeResults = await ctx.db
      .query('questions')
      .withSearchIndex('search_by_code', q =>
        q.search('questionCode', searchTerm),
      )
      .take(limit); // Use the limit parameter

    // If we have enough code results, just return those
    if (codeResults.length >= limit) {
      const themes = await Promise.all(
        codeResults.map(question => ctx.db.get(question.themeId)),
      );
      return codeResults.map((question, index) => ({
        _id: question._id,
        title: question.title,
        questionCode: question.questionCode,
        themeId: question.themeId,
        theme: themes[index],
      }));
    }

    // If code search didn't return enough, search by title too
    const titleResults = await ctx.db
      .query('questions')
      .withSearchIndex('search_by_title', q => q.search('title', searchTerm))
      .take(limit - codeResults.length);

    // Combine results, eliminating duplicates (code results take priority)
    const seenIds = new Set(codeResults.map(q => q._id.toString()));
    const combinedResults = [
      ...codeResults,
      ...titleResults.filter(q => !seenIds.has(q._id.toString())),
    ];

    // If we have questions, fetch their themes
    if (combinedResults.length > 0) {
      const themes = await Promise.all(
        combinedResults.map(question => ctx.db.get(question.themeId)),
      );

      // Return minimal data to reduce bandwidth
      return combinedResults.map((question, index) => ({
        _id: question._id,
        title: question.title,
        questionCode: question.questionCode,
        themeId: question.themeId,
        theme: themes[index],
      }));
    }

    return [];
  },
});

// Add a standalone search by title function for specific title-only searches
export const searchByTitle = query({
  args: {
    title: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!args.title || args.title.trim() === '') {
      return [];
    }

    // Normalize the search term
    const searchTerm = args.title.trim();

    // Use provided limit or default to 50
    const limit = args.limit || 50;

    // Use the search index for efficient text search
    const matchingQuestions = await ctx.db
      .query('questions')
      .withSearchIndex('search_by_title', q => q.search('title', searchTerm))
      .take(limit);

    // If we have questions, fetch their themes
    if (matchingQuestions.length > 0) {
      const themes = await Promise.all(
        matchingQuestions.map(question => ctx.db.get(question.themeId)),
      );

      // Return minimal data to reduce bandwidth
      return matchingQuestions.map((question, index) => ({
        _id: question._id,
        title: question.title,
        questionCode: question.questionCode,
        themeId: question.themeId,
        theme: themes[index],
      }));
    }

    return [];
  },
});
