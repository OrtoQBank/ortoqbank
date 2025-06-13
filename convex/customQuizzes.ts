import { ConvexError, v } from 'convex/values';

import { Doc, Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
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
    const userId = 'k57ae8wq7tv5h7gx1122erj4ed7e631e' as Id<'users'>;
    //const userId = await getCurrentUserOrThrow(ctx);

    // Use the requested number of questions or default to MAX_QUESTIONS
    const requestedQuestions = args.numQuestions
      ? Math.min(args.numQuestions, MAX_QUESTIONS)
      : MAX_QUESTIONS;

    // Collect questions efficiently using hierarchical "children win" logic
    const allQuestions: Doc<'questions'>[] = [];
    const processedQuestionIds = new Set<Id<'questions'>>();

    // Helper function to add questions without duplicates
    const addQuestions = (questions: Doc<'questions'>[]) => {
      questions.forEach(q => {
        if (!processedQuestionIds.has(q._id)) {
          processedQuestionIds.add(q._id);
          allQuestions.push(q);
        }
      });
    };

    // Determine which entities to actually query based on hierarchical rules
    const selectedThemes = args.selectedThemes || [];
    const selectedSubthemes = args.selectedSubthemes || [];
    const selectedGroups = args.selectedGroups || [];

    // Process groups first (highest priority - leaf nodes)
    if (selectedGroups.length > 0) {
      for (const groupId of selectedGroups) {
        const groupQuestions = await ctx.db
          .query('questions')
          .withIndex('by_group', q => q.eq('groupId', groupId))
          .take(MAX_QUESTIONS * 2);
        addQuestions(groupQuestions);
      }
    }

    // Process subthemes, but exclude those that have selected groups as children
    if (selectedSubthemes.length > 0) {
      for (const subthemeId of selectedSubthemes) {
        // Check if this subtheme has any selected groups as children
        let hasSelectedChildGroups = false;

        if (selectedGroups.length > 0) {
          // Get groups belonging to this subtheme to check for overlap
          const subthemeGroups = await ctx.db
            .query('groups')
            .withIndex('by_subtheme', q => q.eq('subthemeId', subthemeId))
            .collect();

          hasSelectedChildGroups = subthemeGroups.some(group =>
            selectedGroups.includes(group._id),
          );
        }

        // Only include subtheme questions if no child groups are selected
        if (!hasSelectedChildGroups) {
          const subthemeQuestions = await ctx.db
            .query('questions')
            .withIndex('by_subtheme', q => q.eq('subthemeId', subthemeId))
            .take(MAX_QUESTIONS * 2);
          addQuestions(subthemeQuestions);
        }
      }
    }

    // Process themes, but exclude those that have selected subthemes or groups as children
    if (selectedThemes.length > 0) {
      for (const themeId of selectedThemes) {
        // Check if this theme has any selected subthemes as children
        let hasSelectedChildSubthemes = false;
        let hasSelectedChildGroups = false;

        if (selectedSubthemes.length > 0) {
          // Get subthemes belonging to this theme to check for overlap
          const themeSubthemes = await ctx.db
            .query('subthemes')
            .withIndex('by_theme', q => q.eq('themeId', themeId))
            .collect();

          hasSelectedChildSubthemes = themeSubthemes.some(subtheme =>
            selectedSubthemes.includes(subtheme._id),
          );
        }

        if (selectedGroups.length > 0) {
          // Check if any selected groups belong to subthemes of this theme
          const themeSubthemes = await ctx.db
            .query('subthemes')
            .withIndex('by_theme', q => q.eq('themeId', themeId))
            .collect();

          for (const subtheme of themeSubthemes) {
            const subthemeGroups = await ctx.db
              .query('groups')
              .withIndex('by_subtheme', q => q.eq('subthemeId', subtheme._id))
              .collect();

            if (
              subthemeGroups.some(group => selectedGroups.includes(group._id))
            ) {
              hasSelectedChildGroups = true;
              break;
            }
          }
        }

        // Only include theme questions if no child subthemes or groups are selected
        if (!hasSelectedChildSubthemes && !hasSelectedChildGroups) {
          const themeQuestions = await ctx.db
            .query('questions')
            .withIndex('by_theme', q => q.eq('themeId', themeId))
            .take(MAX_QUESTIONS * 2);
          addQuestions(themeQuestions);
        }
      }
    }

    // If no specific selections, get all questions from all themes
    if (
      selectedThemes.length === 0 &&
      selectedSubthemes.length === 0 &&
      selectedGroups.length === 0
    ) {
      const allThemes = await ctx.db.query('themes').take(50);
      for (const theme of allThemes) {
        const themeQuestions = await ctx.db
          .query('questions')
          .withIndex('by_theme', q => q.eq('themeId', theme._id))
          .take(MAX_QUESTIONS);
        addQuestions(themeQuestions);
      }
    }

    // If there are no questions matching the criteria, return an error response
    if (allQuestions.length === 0) {
      console.log('allQuestions', allQuestions);
      console.log('selectedThemes', args.selectedThemes);
      console.log('selectedSubthemes', args.selectedSubthemes);
      console.log('selectedGroups', args.selectedGroups);

      return {
        success: false as const,
        error: 'NO_QUESTIONS_FOUND',
        message:
          'Nenhuma questão encontrada com os critérios selecionados. Tente ajustar os filtros ou selecionar temas diferentes.',
      };
    }

    // Apply different filters based on question mode
    const filteredQuestionIds: Id<'questions'>[] = [];

    // Process the single mode
    let modeQuestions: Id<'questions'>[] = [];

    switch (args.questionMode) {
      case 'all': {
        // Include all questions matching theme/subtheme/group criteria
        modeQuestions = allQuestions.map(q => q._id);
        break;
      }

      case 'bookmarked': {
        // Get bookmarked questions - use the by_user index to limit scanning
        const bookmarks = await ctx.db
          .query('userBookmarks')
          .withIndex('by_user', q => q.eq('userId', userId))
          .collect();

        // Create a Set for faster lookups
        const bookmarkedIds = new Set(bookmarks.map(b => b.questionId));

        // Filter questions to only include those that are bookmarked
        modeQuestions = allQuestions
          .filter(q => bookmarkedIds.has(q._id))
          .map(q => q._id);
        break;
      }

      case 'incorrect':
      case 'unanswered': {
        if (args.questionMode === 'incorrect') {
          // Use the same logic as aggregateHelpers - query userQuestionStats directly
          const incorrectStats = await ctx.db
            .query('userQuestionStats')
            .withIndex('by_user_incorrect', q =>
              q.eq('userId', userId).eq('isIncorrect', true),
            )
            .collect();

          // Filter to only include questions that are in our filtered set
          const questionIdsSet = new Set(allQuestions.map(q => q._id));
          modeQuestions = incorrectStats
            .filter(stat => questionIdsSet.has(stat.questionId))
            .map(stat => stat.questionId);
        } else {
          // For unanswered questions, use the same logic as countFunctions
          // Get all answered questions from userQuestionStats
          const answeredStats = await ctx.db
            .query('userQuestionStats')
            .withIndex('by_user', q => q.eq('userId', userId))
            .collect();

          // Create a Set of answered question IDs for faster lookups
          const answeredQuestionIds = new Set(
            answeredStats.map(stat => stat.questionId),
          );

          // Filter to only include questions that are NOT answered and are in our filtered set
          modeQuestions = allQuestions
            .filter(q => !answeredQuestionIds.has(q._id))
            .map(q => q._id);
        }
        break;
      }
      // No default
    }

    // Add questions from this mode to the filtered list
    filteredQuestionIds.push(...modeQuestions);

    // Remove duplicates
    let uniqueQuestionIds = [...new Set(filteredQuestionIds)];

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
      authorId: userId,
      testMode: args.testMode,
      questionMode: args.questionMode, // Store a single mode instead of array
      selectedThemes: args.selectedThemes,
      selectedSubthemes: args.selectedSubthemes,
      selectedGroups: args.selectedGroups,
    });

    // If the user selected study or exam mode, create a session immediately
    await ctx.db.insert('quizSessions', {
      userId: userId,
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
    const userId = 'k57ae8wq7tv5h7gx1122erj4ed7e631e' as Id<'users'>;
    //const userId = await getUserIdDev(ctx);

    // Use an index on authorId if available or limit the number of results
    // to avoid a full table scan
    const limit = args.limit || 50; // Default to 50 if not specified

    // Get custom quizzes created by this user with pagination
    const quizzes = await ctx.db
      .query('customQuizzes')
      .filter(q => q.eq(q.field('authorId'), userId))
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
    const userId = 'k57ae8wq7tv5h7gx1122erj4ed7e631e' as Id<'users'>;
    //const userId = await getUserIdDev(ctx);

    const quiz = await ctx.db.get(args.quizId);

    if (!quiz) {
      throw new Error('Quiz not found');
    }

    if (quiz.authorId !== userId) {
      throw new Error('You are not authorized to delete this quiz');
    }

    // Delete any active sessions for this quiz - using proper index
    const sessions = await ctx.db
      .query('quizSessions')
      .withIndex('by_user_quiz', q =>
        q.eq('userId', userId).eq('quizId', args.quizId),
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
    const userId = 'k57ae8wq7tv5h7gx1122erj4ed7e631e' as Id<'users'>;
    //const userId = await getUserIdDev(ctx);
    const quiz = await ctx.db.get(id);

    if (!quiz) {
      throw new Error('Quiz not found');
    }

    // Verify that the user has access to this quiz
    if (quiz.authorId !== userId) {
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

export const updateName = mutation({
  args: {
    id: v.id('customQuizzes'),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = 'k57ae8wq7tv5h7gx1122erj4ed7e631e' as Id<'users'>;
    //const userId = await getUserIdDev(ctx);

    const quiz = await ctx.db.get(args.id);

    if (!quiz) {
      throw new Error('Quiz not found');
    }

    // Verify that the user has access to this quiz
    if (quiz.authorId !== userId) {
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

    const userId = 'k57ae8wq7tv5h7gx1122erj4ed7e631e' as Id<'users'>;
    //const userId = await getUserIdDev(ctx);

    // Normalize the search term
    const searchTerm = args.name.trim();

    // Use the search index for efficient text search
    // Also filter by the current user's ID since custom quizzes are user-specific
    const matchingQuizzes = await ctx.db
      .query('customQuizzes')
      .withSearchIndex('search_by_name', q => q.search('name', searchTerm))
      .filter(q => q.eq(q.field('authorId'), userId))
      .take(50); // Limit results to reduce bandwidth

    return matchingQuizzes;
  },
});

// New mutation that uses the taxonomy system
export const createWithTaxonomy = mutation({
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
    selectedThemes: v.optional(v.array(v.id('taxonomy'))),
    selectedSubthemes: v.optional(v.array(v.id('taxonomy'))),
    selectedGroups: v.optional(v.array(v.id('taxonomy'))),
  },
  handler: async (ctx, args) => {
    const userId = 'k57ae8wq7tv5h7gx1122erj4ed7e631e' as Id<'users'>;
    //const userId = await getUserIdDev(ctx);

    // Use the requested number of questions or default to MAX_QUESTIONS
    const requestedQuestions = args.numQuestions
      ? Math.min(args.numQuestions, MAX_QUESTIONS)
      : MAX_QUESTIONS;

    let allQuestions: Doc<'questions'>[] = [];

    // Collect questions from all selected taxonomy levels
    const hasAnySelection =
      (args.selectedThemes && args.selectedThemes.length > 0) ||
      (args.selectedSubthemes && args.selectedSubthemes.length > 0) ||
      (args.selectedGroups && args.selectedGroups.length > 0);

    if (hasAnySelection) {
      // Get questions from selected themes
      if (args.selectedThemes && args.selectedThemes.length > 0) {
        for (const taxonomyId of args.selectedThemes) {
          const themeQuestions = await ctx.db
            .query('questions')
            .withIndex('by_taxonomy_theme', q => q.eq('TaxThemeId', taxonomyId))
            .collect();
          allQuestions.push(...themeQuestions);
        }
      }

      // Get questions from selected subthemes
      if (args.selectedSubthemes && args.selectedSubthemes.length > 0) {
        for (const taxonomyId of args.selectedSubthemes) {
          const subthemeQuestions = await ctx.db
            .query('questions')
            .withIndex('by_taxonomy_subtheme', q =>
              q.eq('TaxSubthemeId', taxonomyId),
            )
            .collect();
          allQuestions.push(...subthemeQuestions);
        }
      }

      // Get questions from selected groups
      if (args.selectedGroups && args.selectedGroups.length > 0) {
        for (const taxonomyId of args.selectedGroups) {
          const groupQuestions = await ctx.db
            .query('questions')
            .withIndex('by_taxonomy_group', q => q.eq('TaxGroupId', taxonomyId))
            .collect();
          allQuestions.push(...groupQuestions);
        }
      }
    } else {
      // No taxonomy filters, get all questions
      allQuestions = await ctx.db.query('questions').collect();
    }

    // Remove duplicates (in case a question appears in multiple taxonomies)
    const uniqueQuestions = allQuestions.filter(
      (question, index, self) =>
        index === self.findIndex(q => q._id === question._id),
    );

    // Apply question mode filtering
    let filteredQuestionIds: Id<'questions'>[] = [];
    let modeQuestions: Id<'questions'>[] = [];

    switch (args.questionMode) {
      case 'all': {
        modeQuestions = uniqueQuestions.map(q => q._id);
        break;
      }
      case 'bookmarked': {
        const bookmarks = await ctx.db
          .query('userBookmarks')
          .withIndex('by_user', q => q.eq('userId', userId))
          .collect();
        const bookmarkedQuestionIds = new Set(bookmarks.map(b => b.questionId));
        modeQuestions = uniqueQuestions
          .filter(q => bookmarkedQuestionIds.has(q._id))
          .map(q => q._id);
        break;
      }
      case 'unanswered':
      case 'incorrect': {
        if (args.questionMode === 'incorrect') {
          // Use the same logic as aggregateHelpers - query userQuestionStats directly
          const incorrectStats = await ctx.db
            .query('userQuestionStats')
            .withIndex('by_user_incorrect', q =>
              q.eq('userId', userId).eq('isIncorrect', true),
            )
            .collect();

          // Filter to only include questions that are in our filtered set
          const questionIdsSet = new Set(allQuestions.map(q => q._id));
          modeQuestions = incorrectStats
            .filter(stat => questionIdsSet.has(stat.questionId))
            .map(stat => stat.questionId);
        } else {
          // For unanswered questions, use the same logic as countFunctions
          // Get all answered questions from userQuestionStats
          const answeredStats = await ctx.db
            .query('userQuestionStats')
            .withIndex('by_user', q => q.eq('userId', userId))
            .collect();

          // Create a Set of answered question IDs for faster lookups
          const answeredQuestionIds = new Set(
            answeredStats.map(stat => stat.questionId),
          );

          // Filter to only include questions that are NOT answered and are in our filtered set
          modeQuestions = allQuestions
            .filter(q => !answeredQuestionIds.has(q._id))
            .map(q => q._id);
        }
        break;
      }
      // No default
    }

    // Add questions from this mode to the filtered list
    filteredQuestionIds.push(...modeQuestions);

    // Remove duplicates
    let uniqueQuestionIds = [...new Set(filteredQuestionIds)];

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

    // Create the custom quiz with taxonomy support
    const quizId = await ctx.db.insert('customQuizzes', {
      name: quizName,
      description: quizDescription,
      questions: uniqueQuestionIds,
      authorId: userId,
      testMode: args.testMode,
      questionMode: args.questionMode,
      // Keep legacy fields empty for backward compatibility
      selectedThemes: [],
      selectedSubthemes: [],
      selectedGroups: [],
      // Add new taxonomy fields (these would need to be added to the schema)
      // selectedTaxonomyIds: args.selectedTaxonomyIds,
      // selectedLevel: args.selectedLevel,
    });

    // If the user selected study or exam mode, create a session immediately
    await ctx.db.insert('quizSessions', {
      userId: userId,
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
