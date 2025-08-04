import { GenericMutationCtx, paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';

import { api, internal } from './_generated/api';
import { DataModel, Doc, Id } from './_generated/dataModel';
import {
  // Keep these for defining the actual mutations/queries
  internalAction,
  internalMutation,
  mutation,
  query,
} from './_generated/server';
import {
  questionCountByGroup,
  questionCountBySubtheme,
  questionCountByTheme,
  totalQuestionCount,
} from './aggregates';
// Question stats are now handled by aggregates and triggers

// ---------- Helper Functions for Question CRUD + Aggregate Sync ----------

// Use GenericMutationCtx with DataModel
async function _internalInsertQuestion(
  ctx: GenericMutationCtx<DataModel>,
  data: Omit<Doc<'questions'>, '_id' | '_creationTime'>,
) {
  const questionId = await ctx.db.insert('questions', data);
  const questionDoc = (await ctx.db.get(questionId))!;

  console.log(`Attempting to insert question ${questionId} into aggregates...`);

  // Try to update aggregates, but don't fail the question creation if there are aggregate issues
  let aggregateErrors: string[] = [];

  // 1. Theme count aggregate
  try {
    await questionCountByTheme.insert(ctx, questionDoc);
    console.log(
      `Successfully inserted question ${questionId} into theme aggregate`,
    );
  } catch (error: any) {
    console.warn(
      `Error inserting question ${questionId} into theme aggregate:`,
      error,
    );
    aggregateErrors.push(`theme aggregate: ${error.message}`);
  }

  // 2. Subtheme count aggregate (only if question has subthemeId)
  if (questionDoc.subthemeId) {
    try {
      await questionCountBySubtheme.insert(ctx, questionDoc);
      console.log(
        `Successfully inserted question ${questionId} into subtheme aggregate`,
      );
    } catch (error: any) {
      console.warn(
        `Error inserting question ${questionId} into subtheme aggregate:`,
        error,
      );
      aggregateErrors.push(`subtheme aggregate: ${error.message}`);
    }
  }

  // 3. Group count aggregate (only if question has groupId)
  if (questionDoc.groupId) {
    try {
      await questionCountByGroup.insert(ctx, questionDoc);
      console.log(
        `Successfully inserted question ${questionId} into group aggregate`,
      );
    } catch (error: any) {
      console.warn(
        `Error inserting question ${questionId} into group aggregate:`,
        error,
      );
      aggregateErrors.push(`group aggregate: ${error.message}`);
    }
  }

  // 4. Total count aggregate
  try {
    await totalQuestionCount.insert(ctx, questionDoc);
    console.log(
      `Successfully inserted question ${questionId} into total count aggregate`,
    );
  } catch (error: any) {
    console.warn(
      `Error inserting question ${questionId} into total count aggregate:`,
      error,
    );
    aggregateErrors.push(`total count aggregate: ${error.message}`);
  }

  // Question stats are now handled automatically by aggregate triggers

  if (aggregateErrors.length > 0) {
    console.warn(
      `Question ${questionId} created successfully but with aggregate issues:`,
      aggregateErrors,
    );
  } else {
    console.log(
      `Question ${questionId} created successfully with all aggregates updated`,
    );
  }

  return questionId;
}

async function _internalUpdateQuestion(
  ctx: GenericMutationCtx<DataModel>,
  id: Id<'questions'>,
  updates: Partial<Doc<'questions'>>,
) {
  const oldQuestionDoc = await ctx.db.get(id);
  if (!oldQuestionDoc) {
    throw new Error(`Question not found for update: ${id}`);
  }
  await ctx.db.patch(id, updates);
  const newQuestionDoc = (await ctx.db.get(id))!;

  // Check if any taxonomy fields changed
  const taxonomyChanged =
    (updates.themeId && updates.themeId !== oldQuestionDoc.themeId) ||
    (updates.subthemeId !== undefined &&
      updates.subthemeId !== oldQuestionDoc.subthemeId) ||
    (updates.groupId !== undefined &&
      updates.groupId !== oldQuestionDoc.groupId);

  if (taxonomyChanged) {
    console.log(`Question ${id} taxonomy changed, updating aggregates...`);

    // Update theme aggregate if themeId changed
    if (updates.themeId && updates.themeId !== oldQuestionDoc.themeId) {
      try {
        await questionCountByTheme.replace(ctx, oldQuestionDoc, newQuestionDoc);
      } catch (error: any) {
        if (error.code === 'DELETE_MISSING_KEY') {
          console.warn(
            `Question ${id} not found in theme aggregate, inserting instead`,
          );
          await questionCountByTheme.insert(ctx, newQuestionDoc);
        } else {
          throw error;
        }
      }
    }

    // Update subtheme aggregate if subthemeId changed
    if (
      updates.subthemeId !== undefined &&
      updates.subthemeId !== oldQuestionDoc.subthemeId
    ) {
      // Remove from old subtheme aggregate if it had one
      if (oldQuestionDoc.subthemeId) {
        try {
          await questionCountBySubtheme.delete(ctx, oldQuestionDoc);
        } catch (error: any) {
          console.warn(
            `Error removing question ${id} from old subtheme aggregate:`,
            error,
          );
        }
      }

      // Add to new subtheme aggregate if it has one
      if (newQuestionDoc.subthemeId) {
        try {
          await questionCountBySubtheme.insert(ctx, newQuestionDoc);
        } catch (error: any) {
          console.warn(
            `Error inserting question ${id} into new subtheme aggregate:`,
            error,
          );
        }
      }
    }

    // Update group aggregate if groupId changed
    if (
      updates.groupId !== undefined &&
      updates.groupId !== oldQuestionDoc.groupId
    ) {
      // Remove from old group aggregate if it had one
      if (oldQuestionDoc.groupId) {
        try {
          await questionCountByGroup.delete(ctx, oldQuestionDoc);
        } catch (error: any) {
          console.warn(
            `Error removing question ${id} from old group aggregate:`,
            error,
          );
        }
      }

      // Add to new group aggregate if it has one
      if (newQuestionDoc.groupId) {
        try {
          await questionCountByGroup.insert(ctx, newQuestionDoc);
        } catch (error: any) {
          console.warn(
            `Error inserting question ${id} into new group aggregate:`,
            error,
          );
        }
      }
    }

    // totalQuestionCount doesn't change when moving between themes, so no update needed
  }

  // Note: Add update logic for _updateQuestionStats if needed here as well
}

async function _internalDeleteQuestion(
  ctx: GenericMutationCtx<DataModel>,
  id: Id<'questions'>,
) {
  const questionDoc = await ctx.db.get(id);
  if (!questionDoc) {
    console.warn(`Question not found for deletion: ${id}`);
    return false; // Indicate deletion didn't happen
  }
  await ctx.db.delete(id);

  // Handle ALL aggregate operations with comprehensive error recovery
  // If any operation fails with DELETE_MISSING_KEY, just skip it and continue

  console.log(`Attempting to delete question ${id} from aggregates...`);

  // 1. Theme count aggregate
  try {
    await questionCountByTheme.delete(ctx, questionDoc);
    console.log(`Successfully deleted question ${id} from theme aggregate`);
  } catch (error: any) {
    console.warn(`Error deleting question ${id} from theme aggregate:`, error);
    if (error.code !== 'DELETE_MISSING_KEY') {
      console.error(`Unexpected error type:`, error);
    }
    // Continue regardless of error type for now
  }

  // 2. Subtheme count aggregate (only if question had subthemeId)
  if (questionDoc.subthemeId) {
    try {
      await questionCountBySubtheme.delete(ctx, questionDoc);
      console.log(
        `Successfully deleted question ${id} from subtheme aggregate`,
      );
    } catch (error: any) {
      console.warn(
        `Error deleting question ${id} from subtheme aggregate:`,
        error,
      );
      if (error.code !== 'DELETE_MISSING_KEY') {
        console.error(`Unexpected error type:`, error);
      }
      // Continue regardless of error type for now
    }
  }

  // 3. Group count aggregate (only if question had groupId)
  if (questionDoc.groupId) {
    try {
      await questionCountByGroup.delete(ctx, questionDoc);
      console.log(`Successfully deleted question ${id} from group aggregate`);
    } catch (error: any) {
      console.warn(
        `Error deleting question ${id} from group aggregate:`,
        error,
      );
      if (error.code !== 'DELETE_MISSING_KEY') {
        console.error(`Unexpected error type:`, error);
      }
      // Continue regardless of error type for now
    }
  }

  // 4. Total count aggregate
  try {
    await totalQuestionCount.delete(ctx, questionDoc);
    console.log(
      `Successfully deleted question ${id} from total count aggregate`,
    );
  } catch (error: any) {
    console.warn(
      `Error deleting question ${id} from total count aggregate:`,
      error,
    );
    if (error.code !== 'DELETE_MISSING_KEY') {
      console.error(`Unexpected error type:`, error);
    }
    // Continue regardless of error type for now
  }

  // Question stats are now handled automatically by aggregate triggers

  console.log(`Completed deletion process for question ${id}`);
  return true; // Indicate successful deletion
}

// -----------------------------------------------------------------------

const validateNoBlobs = (content: any[]) => {
  for (const node of content) {
    if (node.type === 'image' && node.attrs?.src?.startsWith('blob:')) {
      throw new Error('Invalid image URL detected');
    }
  }
};

// Helper function to stringify content if it's an object
function stringifyContent(content: any): string {
  if (typeof content === 'string') {
    return content; // Already a string
  }
  return JSON.stringify(content);
}

export const create = mutation({
  args: {
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

    // Prepare data and call the internal helper
    const questionData = {
      ...args,
      // Set migration flag
      normalizedTitle: args.title.trim().toLowerCase(),
      authorId: user._id,
      isPublic: false, // Default value
    };

    // Use the helper function
    const questionId = await _internalInsertQuestion(ctx, questionData);
    return questionId;
  },
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (context, arguments_) => {
    const questions = await context.db
      .query('questions')
      .order('desc')
      .paginate(arguments_.paginationOpts);

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
  args: { id: v.id('questions') },
  handler: async (context, arguments_) => {
    const question = await context.db.get(arguments_.id);
    if (!question) {
      throw new Error('Question not found');
    }

    const theme = await context.db.get(question.themeId);

    const subtheme = question.subthemeId
      ? await context.db.get(question.subthemeId)
      : undefined;

    return {
      ...question,
      theme,
      subtheme,
    };
  },
});

export const update = mutation({
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

    // Don't need to check if question exists here, helper does it

    const { id, ...otherFields } = args;

    // Prepare update data
    const updates = {
      ...otherFields,

      normalizedTitle: args.title?.trim().toLowerCase(), // Handle optional title in updates
    };

    // Use the helper function
    await _internalUpdateQuestion(ctx, id, updates);

    return true; // Indicate success
  },
});

export const listAll = query({
  // WARNING: This query downloads the entire questions table and should be avoided in production
  // or with large datasets as it will consume significant bandwidth.
  // Consider using paginated queries (like 'list') or filtering server-side instead.
  handler: async context => {
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
    questionMode: v.union(
      v.literal('all'),
      v.literal('unanswered'),
      v.literal('incorrect'),
      v.literal('bookmarked'),
    ),
  },
  handler: async ctx => {
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

    const totalQuestions = await ctx.db.query('questions').collect();
    const totalCount = totalQuestions.length;

    const result = {
      all: totalCount,
      unanswered: 0,
      incorrect: 0,
      bookmarked: 0,
    };

    const incorrectStats = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user_incorrect', q =>
        q.eq('userId', user._id).eq('isIncorrect', true),
      )
      .collect();
    result.incorrect = incorrectStats.length;

    const bookmarks = await ctx.db
      .query('userBookmarks')
      .withIndex('by_user', q => q.eq('userId', user._id))
      .collect();
    result.bookmarked = bookmarks.length;

    const answeredStats = await ctx.db
      .query('userQuestionStats')
      .withIndex('by_user_answered', q =>
        q.eq('userId', user._id).eq('hasAnswered', true),
      )
      .collect();
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

export const deleteQuestion = mutation({
  args: { id: v.id('questions') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

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

    // Then delete the question itself using the helper function
    const success = await _internalDeleteQuestion(ctx, args.id);
    return success;
  },
});

// --- Backfill Action ---
// This action should be run manually ONCE after deployment
// to populate the aggregate with existing question data.
export const backfillThemeCounts = internalAction({
  handler: async ctx => {
    console.log('Starting backfill for question theme counts...');
    let count = 0;
    // Fetch all existing questions using api
    const questions = await ctx.runQuery(api.questions.listAll);

    // Iterate and insert each question into the aggregate using internal
    for (const questionDoc of questions) {
      try {
        await ctx.runMutation(internal.questions.insertIntoThemeAggregate, {
          questionDoc,
        });
        count++;
      } catch (error) {
        console.error(
          `Failed to insert question ${questionDoc._id} into theme aggregate:`,
          error,
        );
      }
    }

    console.log(
      `Successfully backfilled ${count} questions into theme aggregate.`,
    );
    return { count };
  },
});

// Helper internal mutation for the backfill action to call
// Using a mutation ensures atomicity for each aggregate insert
export const insertIntoThemeAggregate = internalMutation({
  args: { questionDoc: v.any() }, // Pass the whole doc
  handler: async (ctx, args) => {
    // We need to cast the doc because internal mutations don't
    // have full type inference across action/mutation boundary easily.
    const questionDoc = args.questionDoc as Doc<'questions'>;
    await questionCountByTheme.insert(ctx, questionDoc);
    await totalQuestionCount.insert(ctx, questionDoc);
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

/**
 * Clean up old taxonomy fields from questions
 * Removes: TaxThemeId, TaxSubthemeId, TaxGroupId
 */
export const cleanupQuestionsOldFields = internalAction({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processedCount: v.number(),
    updatedCount: v.number(),
    message: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    processedCount: number;
    updatedCount: number;
    message: string;
  }> => {
    // Delegate to the centralized cleanup function
    return await ctx.runAction(internal.migrations.cleanupOldTaxonomyFields, {
      table: 'questions',
      batchSize: args.batchSize,
    });
  },
});
