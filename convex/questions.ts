import { GenericMutationCtx, paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';

import { api, internal } from './_generated/api';
import { DataModel, Doc, Id } from './_generated/dataModel';
import {
  // Keep these for defining the actual mutations/queries
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import { questionCountByTheme, totalQuestionCount } from './aggregates';
import {
  _updateQuestionStatsOnDelete,
  _updateQuestionStatsOnInsert,
} from './questionStats';

// ---------- Helper Functions for Question Count Management ----------

/**
 * Updates the questionCounts table when a question is created
 */
async function _updateQuestionCountOnInsert(
  ctx: GenericMutationCtx<DataModel>,
  questionDoc: Doc<'questions'>,
) {
  const { themeId, subthemeId, groupId } = questionDoc;

  // We need all three values to create a count entry
  if (!themeId || !subthemeId || !groupId) {
    console.warn(
      `Question ${questionDoc._id} missing required taxonomy fields for count tracking`,
    );
    return;
  }

  // Check if an entry already exists for this combination
  const existingCount = await ctx.db
    .query('questionCounts')
    .withIndex('byThemeSubGroup', q =>
      q
        .eq('themeId', themeId)
        .eq('subthemeId', subthemeId)
        .eq('groupId', groupId),
    )
    .unique();

  if (existingCount) {
    // Increment existing count
    await ctx.db.patch(existingCount._id, {
      questionCount: existingCount.questionCount + 1,
    });
    console.log(
      `Incremented question count for theme/subtheme/group: ${existingCount.questionCount + 1}`,
    );
  } else {
    // Create new count entry
    await ctx.db.insert('questionCounts', {
      themeId,
      subthemeId,
      groupId,
      questionCount: 1,
    });
    console.log(`Created new question count entry for theme/subtheme/group`);
  }
}

/**
 * Updates the questionCounts table when a question is deleted
 */
async function _updateQuestionCountOnDelete(
  ctx: GenericMutationCtx<DataModel>,
  questionDoc: Doc<'questions'>,
) {
  const { themeId, subthemeId, groupId } = questionDoc;

  // We need all three values to find the count entry
  if (!themeId || !subthemeId || !groupId) {
    console.warn(
      `Question ${questionDoc._id} missing required taxonomy fields for count tracking`,
    );
    return;
  }

  // Find the existing count entry
  const existingCount = await ctx.db
    .query('questionCounts')
    .withIndex('byThemeSubGroup', q =>
      q
        .eq('themeId', themeId)
        .eq('subthemeId', subthemeId)
        .eq('groupId', groupId),
    )
    .unique();

  if (existingCount) {
    if (existingCount.questionCount <= 1) {
      // Delete the entry if count would become 0
      await ctx.db.delete(existingCount._id);
      console.log(
        `Deleted question count entry for theme/subtheme/group (count was ${existingCount.questionCount})`,
      );
    } else {
      // Decrement the count
      await ctx.db.patch(existingCount._id, {
        questionCount: existingCount.questionCount - 1,
      });
      console.log(
        `Decremented question count for theme/subtheme/group: ${existingCount.questionCount - 1}`,
      );
    }
  } else {
    console.warn(
      `No question count entry found for theme/subtheme/group when deleting question ${questionDoc._id}`,
    );
  }
}

/**
 * Updates the questionCounts table when a question's taxonomy changes
 */
async function _updateQuestionCountOnUpdate(
  ctx: GenericMutationCtx<DataModel>,
  oldQuestionDoc: Doc<'questions'>,
  newQuestionDoc: Doc<'questions'>,
) {
  const oldTaxonomy = {
    themeId: oldQuestionDoc.themeId,
    subthemeId: oldQuestionDoc.subthemeId,
    groupId: oldQuestionDoc.groupId,
  };

  const newTaxonomy = {
    themeId: newQuestionDoc.themeId,
    subthemeId: newQuestionDoc.subthemeId,
    groupId: newQuestionDoc.groupId,
  };

  // Check if any taxonomy field changed
  const taxonomyChanged =
    oldTaxonomy.themeId !== newTaxonomy.themeId ||
    oldTaxonomy.subthemeId !== newTaxonomy.subthemeId ||
    oldTaxonomy.groupId !== newTaxonomy.groupId;

  if (!taxonomyChanged) {
    return; // No update needed
  }

  console.log(
    `Question ${newQuestionDoc._id} taxonomy changed, updating counts...`,
  );

  // Remove from old taxonomy (if it had complete taxonomy)
  if (oldTaxonomy.themeId && oldTaxonomy.subthemeId && oldTaxonomy.groupId) {
    await _updateQuestionCountOnDelete(ctx, oldQuestionDoc);
  }

  // Add to new taxonomy (if it has complete taxonomy)
  if (newTaxonomy.themeId && newTaxonomy.subthemeId && newTaxonomy.groupId) {
    await _updateQuestionCountOnInsert(ctx, newQuestionDoc);
  }
}

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

  // 2. Total count aggregate
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

  // 3. Question counts table update
  try {
    await _updateQuestionCountOnInsert(ctx, questionDoc);
    console.log(
      `Successfully updated question counts for question ${questionId}`,
    );
  } catch (error: any) {
    console.warn(
      `Error updating question counts for question ${questionId}:`,
      error,
    );
    aggregateErrors.push(`question counts: ${error.message}`);
  }

  // 4. Question stats aggregate (no-op but wrap it)
  try {
    await _updateQuestionStatsOnInsert(ctx, questionDoc);
    console.log(
      `Successfully called _updateQuestionStatsOnInsert for question ${questionId}`,
    );
  } catch (error: any) {
    console.warn(
      `Error in _updateQuestionStatsOnInsert for question ${questionId}:`,
      error,
    );
    aggregateErrors.push(`question stats: ${error.message}`);
  }

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

    // Update theme-based aggregates if themeId changed
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

    // Update question counts table
    try {
      await _updateQuestionCountOnUpdate(ctx, oldQuestionDoc, newQuestionDoc);
      console.log(`Successfully updated question counts for question ${id}`);
    } catch (error: any) {
      console.warn(`Error updating question counts for question ${id}:`, error);
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

  // 2. Total count aggregate
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

  // 3. Question counts table update
  try {
    await _updateQuestionCountOnDelete(ctx, questionDoc);
    console.log(
      `Successfully updated question counts for deleted question ${id}`,
    );
  } catch (error: any) {
    console.warn(
      `Error updating question counts for deleted question ${id}:`,
      error,
    );
    // Continue regardless of error
  }

  // 4. Question stats aggregate (although it's a no-op, wrap it just in case)
  try {
    await _updateQuestionStatsOnDelete(ctx, questionDoc);
    console.log(
      `Successfully called _updateQuestionStatsOnDelete for question ${id}`,
    );
  } catch (error: any) {
    console.warn(
      `Error in _updateQuestionStatsOnDelete for question ${id}:`,
      error,
    );
    // Continue regardless of error
  }

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

// ---------- Question Count Utilities ----------

/**
 * Get question count for a specific theme/subtheme/group combination
 */
export const getQuestionCount = query({
  args: {
    themeId: v.id('themes'),
    subthemeId: v.id('subthemes'),
    groupId: v.id('groups'),
  },
  handler: async (ctx, args) => {
    const countEntry = await ctx.db
      .query('questionCounts')
      .withIndex('byThemeSubGroup', q =>
        q
          .eq('themeId', args.themeId)
          .eq('subthemeId', args.subthemeId)
          .eq('groupId', args.groupId),
      )
      .unique();

    return countEntry?.questionCount || 0;
  },
});

/**
 * Get all question counts for a specific theme
 */
export const getQuestionCountsByTheme = query({
  args: { themeId: v.id('themes') },
  handler: async (ctx, args) => {
    const counts = await ctx.db
      .query('questionCounts')
      .withIndex('byThemeSubGroup', q => q.eq('themeId', args.themeId))
      .collect();

    // Fetch subtheme and group names for better readability
    const enrichedCounts = await Promise.all(
      counts.map(async count => {
        const [subtheme, group] = await Promise.all([
          ctx.db.get(count.subthemeId),
          ctx.db.get(count.groupId),
        ]);

        return {
          ...count,
          subthemeName: subtheme?.name,
          groupName: group?.name,
        };
      }),
    );

    return enrichedCounts;
  },
});

/**
 * Get all question counts with full details
 */
export const getAllQuestionCounts = query({
  handler: async ctx => {
    const counts = await ctx.db.query('questionCounts').collect();

    // Fetch theme, subtheme, and group names
    const enrichedCounts = await Promise.all(
      counts.map(async count => {
        const [theme, subtheme, group] = await Promise.all([
          ctx.db.get(count.themeId),
          ctx.db.get(count.subthemeId),
          ctx.db.get(count.groupId),
        ]);

        return {
          ...count,
          themeName: theme?.name,
          subthemeName: subtheme?.name,
          groupName: group?.name,
        };
      }),
    );

    return enrichedCounts;
  },
});

// ---------- Cleanup Functions for Deleted Taxonomy ----------

/**
 * Clean up question counts when a theme is deleted
 * This should be called when deleting a theme
 */
export const cleanupQuestionCountsForTheme = internalMutation({
  args: { themeId: v.id('themes') },
  returns: v.object({ deletedCount: v.number() }),
  handler: async (ctx, args) => {
    // Delete all question count entries for this theme
    const countsToDelete = await ctx.db
      .query('questionCounts')
      .withIndex('byThemeSubGroup', q => q.eq('themeId', args.themeId))
      .collect();

    for (const count of countsToDelete) {
      await ctx.db.delete(count._id);
    }

    console.log(
      `Cleaned up ${countsToDelete.length} question count entries for deleted theme ${args.themeId}`,
    );
    return { deletedCount: countsToDelete.length };
  },
});

/**
 * Clean up question counts when a subtheme is deleted
 * This should be called when deleting a subtheme
 */
export const cleanupQuestionCountsForSubtheme = internalMutation({
  args: { subthemeId: v.id('subthemes') },
  returns: v.object({ deletedCount: v.number() }),
  handler: async (ctx, args) => {
    // Find all question count entries for this subtheme
    const allCounts = await ctx.db.query('questionCounts').collect();
    const countsToDelete = allCounts.filter(
      count => count.subthemeId === args.subthemeId,
    );

    for (const count of countsToDelete) {
      await ctx.db.delete(count._id);
    }

    console.log(
      `Cleaned up ${countsToDelete.length} question count entries for deleted subtheme ${args.subthemeId}`,
    );
    return { deletedCount: countsToDelete.length };
  },
});

/**
 * Clean up question counts when a group is deleted
 * This should be called when deleting a group
 */
export const cleanupQuestionCountsForGroup = internalMutation({
  args: { groupId: v.id('groups') },
  returns: v.object({ deletedCount: v.number() }),
  handler: async (ctx, args) => {
    // Find all question count entries for this group
    const allCounts = await ctx.db.query('questionCounts').collect();
    const countsToDelete = allCounts.filter(
      count => count.groupId === args.groupId,
    );

    for (const count of countsToDelete) {
      await ctx.db.delete(count._id);
    }

    console.log(
      `Cleaned up ${countsToDelete.length} question count entries for deleted group ${args.groupId}`,
    );
    return { deletedCount: countsToDelete.length };
  },
});

// ---------- Backfill Functions ----------

/**
 * Backfill question counts from existing questions
 * This should be run once to populate the questionCounts table
 */
export const backfillQuestionCounts = internalAction({
  args: {},
  returns: v.object({
    totalQuestions: v.number(),
    questionsWithFullTaxonomy: v.number(),
    insertedCountEntries: v.number(),
  }),
  handler: async (
    ctx,
  ): Promise<{
    totalQuestions: number;
    questionsWithFullTaxonomy: number;
    insertedCountEntries: number;
  }> => {
    console.log('Starting backfill for question counts...');

    // Get all questions
    const questions: Doc<'questions'>[] = await ctx.runQuery(
      api.questions.listAll,
    );

    // Group questions by theme/subtheme/group combination
    const countMap = new Map<string, number>();

    for (const question of questions) {
      // Only count questions that have all three taxonomy fields
      if (question.themeId && question.subthemeId && question.groupId) {
        const key = `${question.themeId}-${question.subthemeId}-${question.groupId}`;
        countMap.set(key, (countMap.get(key) || 0) + 1);
      }
    }

    // Insert the counts
    let insertedCount = 0;
    for (const [key, count] of countMap.entries()) {
      const [themeId, subthemeId, groupId] = key.split('-');

      try {
        await ctx.runMutation(internal.questions.insertQuestionCount, {
          themeId: themeId as Id<'themes'>,
          subthemeId: subthemeId as Id<'subthemes'>,
          groupId: groupId as Id<'groups'>,
          questionCount: count,
        });
        insertedCount++;
      } catch (error) {
        console.error(`Failed to insert count for ${key}:`, error);
      }
    }

    console.log(
      `Successfully backfilled ${insertedCount} question count entries.`,
    );
    return {
      totalQuestions: questions.length,
      questionsWithFullTaxonomy: [...countMap.values()].reduce(
        (a, b) => a + b,
        0,
      ),
      insertedCountEntries: insertedCount,
    };
  },
});

/**
 * Batched backfill function for large datasets
 * Processes questions in chunks to avoid timeout issues
 */
export const backfillQuestionCountsBatched = internalAction({
  args: {
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.string()),
    totalProcessed: v.optional(v.number()),
    totalInserted: v.optional(v.number()),
  },
  returns: v.object({
    isComplete: v.boolean(),
    totalProcessed: v.number(),
    totalInserted: v.number(),
    nextCursor: v.optional(v.string()),
    currentBatchSize: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    isComplete: boolean;
    totalProcessed: number;
    totalInserted: number;
    nextCursor: string | undefined;
    currentBatchSize: number;
  }> => {
    const batchSize: number = args.batchSize || 500; // Process 500 questions at a time
    const totalProcessed: number = args.totalProcessed || 0;
    const totalInserted: number = args.totalInserted || 0;

    console.log(`Processing batch starting from position ${totalProcessed}...`);

    // Get a batch of questions using pagination
    const result: {
      questions: Doc<'questions'>[];
      isDone: boolean;
      continueCursor?: string;
    } = await ctx.runQuery(internal.questions.getQuestionsBatch, {
      cursor: args.cursor || null,
      batchSize,
    });

    if (result.questions.length === 0) {
      console.log('Batched backfill completed - no more questions to process');
      return {
        isComplete: true,
        totalProcessed,
        totalInserted,
        nextCursor: undefined,
        currentBatchSize: 0,
      };
    }

    // Group questions by theme/subtheme/group combination for this batch
    const countMap = new Map<string, number>();

    for (const question of result.questions) {
      // Only count questions that have all three taxonomy fields
      if (question.themeId && question.subthemeId && question.groupId) {
        const key = `${question.themeId}-${question.subthemeId}-${question.groupId}`;
        countMap.set(key, (countMap.get(key) || 0) + 1);
      }
    }

    // Update counts for this batch
    let insertedThisBatch = 0;
    for (const [key, count] of countMap.entries()) {
      const [themeId, subthemeId, groupId] = key.split('-');

      try {
        // Use upsert logic to handle existing entries
        await ctx.runMutation(internal.questions.upsertQuestionCount, {
          themeId: themeId as Id<'themes'>,
          subthemeId: subthemeId as Id<'subthemes'>,
          groupId: groupId as Id<'groups'>,
          additionalCount: count,
        });
        insertedThisBatch++;
      } catch (error) {
        console.error(`Failed to upsert count for ${key}:`, error);
      }
    }

    const newTotalProcessed = totalProcessed + result.questions.length;
    const newTotalInserted = totalInserted + insertedThisBatch;

    console.log(
      `Processed batch: ${result.questions.length} questions, ${insertedThisBatch} count entries updated. ` +
        `Total: ${newTotalProcessed} processed, ${newTotalInserted} entries updated.`,
    );

    // If we got fewer questions than the batch size, we're done
    const isComplete: boolean =
      result.questions.length < batchSize || result.isDone;

    if (isComplete) {
      console.log(
        `Batched backfill completed! Total processed: ${newTotalProcessed}, Total inserted: ${newTotalInserted}`,
      );
    } else {
      // Schedule the next batch
      console.log('Scheduling next batch...');
      await ctx.scheduler.runAfter(
        0,
        internal.questions.backfillQuestionCountsBatched,
        {
          batchSize,
          cursor: result.continueCursor,
          totalProcessed: newTotalProcessed,
          totalInserted: newTotalInserted,
        },
      );
    }

    return {
      isComplete,
      totalProcessed: newTotalProcessed,
      totalInserted: newTotalInserted,
      nextCursor: result.continueCursor,
      currentBatchSize: result.questions.length,
    };
  },
});

/**
 * Helper query to get a batch of questions for backfill processing
 */
export const getQuestionsBatch = internalQuery({
  args: {
    cursor: v.union(v.string(), v.null()),
    batchSize: v.number(),
  },
  returns: v.object({
    questions: v.array(v.any()), // Using v.any() for question documents
    isDone: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const paginationOpts = {
      numItems: args.batchSize,
      cursor: args.cursor,
    };

    const result = await ctx.db
      .query('questions')
      .order('asc') // Use ascending order for consistent pagination
      .paginate(paginationOpts);

    return {
      questions: result.page,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

/**
 * Upsert function for batched backfill - adds to existing count or creates new entry
 */
export const upsertQuestionCount = internalMutation({
  args: {
    themeId: v.id('themes'),
    subthemeId: v.id('subthemes'),
    groupId: v.id('groups'),
    additionalCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check if entry already exists
    const existing = await ctx.db
      .query('questionCounts')
      .withIndex('byThemeSubGroup', q =>
        q
          .eq('themeId', args.themeId)
          .eq('subthemeId', args.subthemeId)
          .eq('groupId', args.groupId),
      )
      .unique();

    // Add to existing count or create new entry
    await (existing
      ? ctx.db.patch(existing._id, {
          questionCount: existing.questionCount + args.additionalCount,
        })
      : ctx.db.insert('questionCounts', {
          themeId: args.themeId,
          subthemeId: args.subthemeId,
          groupId: args.groupId,
          questionCount: args.additionalCount,
        }));

    return null;
  },
});

/**
 * Helper internal mutation for backfill (simple version)
 */
export const insertQuestionCount = internalMutation({
  args: {
    themeId: v.id('themes'),
    subthemeId: v.id('subthemes'),
    groupId: v.id('groups'),
    questionCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check if entry already exists
    const existing = await ctx.db
      .query('questionCounts')
      .withIndex('byThemeSubGroup', q =>
        q
          .eq('themeId', args.themeId)
          .eq('subthemeId', args.subthemeId)
          .eq('groupId', args.groupId),
      )
      .unique();

    // Update existing entry or create new one
    await (existing
      ? ctx.db.patch(existing._id, { questionCount: args.questionCount })
      : ctx.db.insert('questionCounts', {
          themeId: args.themeId,
          subthemeId: args.subthemeId,
          groupId: args.groupId,
          questionCount: args.questionCount,
        }));

    return null;
  },
});

/**
 * Start the batched backfill process
 * This is the main function to call for large datasets
 */
export const startBatchedBackfill = internalAction({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    message: v.string(),
    batchSize: v.number(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 500;

    console.log(`Starting batched backfill with batch size: ${batchSize}`);

    // Schedule the first batch
    await ctx.scheduler.runAfter(
      0,
      internal.questions.backfillQuestionCountsBatched,
      {
        batchSize,
        cursor: undefined,
        totalProcessed: 0,
        totalInserted: 0,
      },
    );

    return {
      message: `Batched backfill started with batch size ${batchSize}. Check logs for progress.`,
      batchSize,
    };
  },
});

// ---------- Public Client Functions ----------

/**
 * Public mutation to trigger simple backfill from client
 */
export const triggerSimpleBackfill = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    try {
      // Schedule the backfill action
      await ctx.scheduler.runAfter(
        0,
        internal.questions.backfillQuestionCounts,
        {},
      );

      return {
        success: true,
        message:
          'Simple backfill started successfully. Check logs for progress.',
      };
    } catch (error) {
      console.error('Error starting simple backfill:', error);
      return {
        success: false,
        message: `Failed to start backfill: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

/**
 * Public mutation to trigger batched backfill from client
 */
export const triggerBatchedBackfill = mutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    batchSize: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    try {
      const batchSize = args.batchSize || 500;

      // Schedule the batched backfill action
      await ctx.scheduler.runAfter(0, internal.questions.startBatchedBackfill, {
        batchSize,
      });

      return {
        success: true,
        message: `Batched backfill started with batch size ${batchSize}. Check logs for progress.`,
        batchSize,
      };
    } catch (error) {
      console.error('Error starting batched backfill:', error);
      return {
        success: false,
        message: `Failed to start backfill: ${error instanceof Error ? error.message : 'Unknown error'}`,
        batchSize: undefined,
      };
    }
  },
});

/**
 * Public query to get basic backfill status/info
 */
export const getBackfillInfo = query({
  args: {},
  returns: v.object({
    totalQuestions: v.number(),
    questionsWithTaxonomy: v.number(),
    countEntries: v.number(),
    coverage: v.number(),
  }),
  handler: async ctx => {
    // Get total questions
    const allQuestions = await ctx.db.query('questions').collect();
    const totalQuestions = allQuestions.length;

    // Count questions with complete taxonomy
    const questionsWithTaxonomy = allQuestions.filter(
      q => q.themeId && q.subthemeId && q.groupId,
    ).length;

    // Get count entries
    const countEntries = await ctx.db.query('questionCounts').collect();
    const totalCountEntries = countEntries.length;

    // Calculate coverage
    const coverage =
      totalQuestions > 0 ? (questionsWithTaxonomy / totalQuestions) * 100 : 0;

    return {
      totalQuestions,
      questionsWithTaxonomy,
      countEntries: totalCountEntries,
      coverage: Math.round(coverage * 100) / 100, // Round to 2 decimal places
    };
  },
});
